/*
 * docker-build.js — Mô phỏng "docker build" (BuildKit) chạy trong trình duyệt.
 * Mục đích: cho người học thấy đúng cơ chế cache theo lớp, vai trò của .dockerignore,
 * multi-stage build và lý do image to/nhỏ — thay vì chỉ đọc lý thuyết.
 * Không đụng DOM: engine gọi run() rồi tự in các dòng kết quả ra terminal.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./shell.js'));
  } else {
    const ns = (root.DevOpsSim = root.DevOpsSim || {});
    ns.build = factory(ns.shell);
  }
})(typeof self !== 'undefined' ? self : this, function (SH) {
  'use strict';

  const INSTR = ['FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'MAINTAINER'];
  // Chỉ các chỉ thị này tạo lớp hệ thống file (được đánh số [n/N]); số còn lại chỉ đổi metadata
  const STEP = new Set(['WORKDIR', 'COPY', 'ADD', 'RUN']);

  // Kích thước ước lượng (byte) của gói pip/apt/npm — đủ sát thực tế để so sánh tối ưu image
  const PIP_SIZE = { flask: 9e6, redis: 4e6, requests: 2e6, numpy: 60e6, pandas: 70e6, fastapi: 12e6, uvicorn: 6e6, gunicorn: 1e6, 'scikit-learn': 45e6, torch: 800e6, pip: 3e6, django: 40e6, sqlalchemy: 10e6, 'psycopg2-binary': 15e6, pillow: 15e6 };
  const APT_SIZE = { 'build-essential': 180e6, gcc: 110e6, curl: 8e6, git: 40e6, wget: 3e6, 'ca-certificates': 1e6, python3: 30e6, 'libpq-dev': 12e6 };
  const NPM_SIZE = { express: 2e6, react: 1e6, next: 90e6, typescript: 22e6, lodash: 1.4e6, axios: 2e6 };
  const APT_LISTS = 18e6;

  class BuildError extends Error {
    constructor(msg, line, hint) { super(msg); this.name = 'BuildError'; this.line = line || 0; this.hint = hint || ''; }
  }

  // ---------- Tiện ích ----------
  const pad = (s, w) => (s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length));
  const secs = (t) => `${t.toFixed(1)}s`;
  const sizeOf = (v) => (typeof v === 'string' ? v.length : (v && v.size) || 0);
  const basename = (p) => p.replace(/\/+$/, '').split('/').pop();

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  // Ghép đường dẫn POSIX và chuẩn hóa ".", ".."
  function resolvePath(p, cwd) {
    const full = p.startsWith('/') ? p : `${cwd.replace(/\/$/, '')}/${p}`;
    const out = [];
    full.split('/').forEach((s) => { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
    return '/' + out.join('/');
  }

  // Thay biến $VAR / ${VAR} / ${VAR:-mặc định} giống Dockerfile
  function subst(str, vars) {
    return String(str).replace(/\$\{(\w+)(?::?-([^}]*))?\}|\$(\w+)/g, (m, a, def, b) => {
      const k = a || b;
      if (vars[k] !== undefined && vars[k] !== '') return vars[k];
      return def !== undefined ? def : '';
    });
  }

  // Chuyển mẫu glob (*, **, ?) thành RegExp khớp toàn bộ đường dẫn
  function globRe(p) {
    let r = '';
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ch === '*') {
        if (p[i + 1] === '*') { r += '.*'; i++; if (p[i + 1] === '/') i++; } else r += '[^/]*';
      } else if (ch === '?') r += '[^/]';
      else r += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + r + '$');
  }
  const hasGlob = (s) => /[*?[]/.test(s);

  // Đọc .dockerignore: mẫu khớp sau cùng thắng, "!" để loại trừ ngược lại
  function ignoreRules(text) {
    return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const neg = l.startsWith('!');
      const pat = (neg ? l.slice(1) : l).trim().replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
      return { neg, pat, raw: l, re: globRe(pat) };
    }).filter((r) => r.pat);
  }
  function ignoredBy(path, rules) {
    const segs = path.split('/');
    let hit = null;
    rules.forEach((r) => {
      for (let k = 1; k <= segs.length; k++) {
        if (r.re.test(segs.slice(0, k).join('/'))) { hit = r.neg ? null : r.raw; return; }
      }
    });
    return hit;
  }

  // Lịch sử theo định dạng Go của "docker history": CMD ["python" "app.py"]
  const goArr = (a) => '[' + a.map((x) => JSON.stringify(x)).join(' ') + ']';

  function parseExec(args) {
    const t = args.trim();
    if (t.startsWith('[')) {
      try { const v = JSON.parse(t); if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return { json: true, arr: v }; } catch (e) { /* Docker coi JSON hỏng là dạng shell */ }
    }
    return { json: false, arr: ['/bin/sh', '-c', t] };
  }

  // ---------- Đọc Dockerfile ----------
  function parseDockerfile(text) {
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const list = [];
    let buf = '', start = 0;
    const push = () => {
      const s = buf.trim(); buf = '';
      if (!s) return;
      const m = s.match(/^(\S+)\s*([\s\S]*)$/);
      const ins = m[1].toUpperCase();
      if (!INSTR.includes(ins)) {
        const best = INSTR.map((k) => [k, lev(ins, k)]).sort((a, b) => a[1] - b[1])[0];
        const hint = best[1] <= 2 ? `Có phải ý bạn là "${best[0]}"? Dòng ${start} gõ sai tên chỉ thị "${m[1]}".` : `"${m[1]}" không phải chỉ thị Dockerfile hợp lệ. Các chỉ thị hay dùng: FROM, WORKDIR, COPY, RUN, ENV, EXPOSE, CMD.`;
        throw new BuildError(`dockerfile parse error on line ${start}: unknown instruction: ${m[1]}`, start, hint);
      }
      const args = m[2].replace(/\s+/g, ' ').trim();
      list.push({ ins, args, raw: `${ins} ${args}`.trim(), line: start });
    };
    for (let i = 0; i < src.length; i++) {
      const l = src[i];
      // Dòng comment (kể cả nằm giữa chuỗi nối dòng) bị bỏ qua giống Docker
      if (/^\s*#/.test(l)) continue;
      if (!buf && !l.trim()) continue;
      if (!buf) start = i + 1;
      if (/\\\s*$/.test(l)) { buf += l.replace(/\\\s*$/, '') + ' '; continue; }
      buf += l;
      push();
    }
    push();
    if (!list.length) throw new BuildError('the Dockerfile cannot be empty', 0, 'Dockerfile đang trống. Bắt đầu bằng FROM <image>, ví dụ: FROM python:3.12-slim');

    const globalArgs = [], stages = [];
    list.forEach((it) => {
      if (it.ins === 'FROM') {
        const t = it.args.split(' ').filter((x) => !x.startsWith('--platform'));
        const asI = t.findIndex((x) => x.toUpperCase() === 'AS');
        stages.push({ from: t[0] || '', name: asI > 0 && t[asI + 1] ? t[asI + 1].toLowerCase() : null, line: it.line, raw: it.raw, instrs: [] });
        if (!t[0]) throw new BuildError(`dockerfile parse error on line ${it.line}: FROM requires either one or three arguments`, it.line, 'FROM cần tên image, ví dụ: FROM node:20-alpine');
      } else if (!stages.length) {
        if (it.ins === 'ARG') globalArgs.push(it);
        else throw new BuildError('no build stage in current context', it.line, 'Mọi Dockerfile phải bắt đầu bằng FROM (chỉ ARG được phép đứng trước FROM).');
      } else stages[stages.length - 1].instrs.push(it);
    });
    if (!stages.length) throw new BuildError('no build stage in current context', globalArgs[0] ? globalArgs[0].line : 0, 'Dockerfile thiếu FROM: cần chọn image gốc, ví dụ FROM python:3.12-slim.');
    return { instructions: list, stages, globalArgs };
  }

  // Tham chiếu image → dạng đầy đủ docker.io/library/<repo>:<tag>
  function fullRef(ref) {
    let r = String(ref).split('@')[0];
    let tag = 'latest';
    const c = r.lastIndexOf(':');
    if (c > r.lastIndexOf('/')) { tag = r.slice(c + 1); r = r.slice(0, c); }
    r = r.replace(/^docker\.io\//, '');
    return `docker.io/${r.includes('/') ? r : 'library/' + r}:${tag}`;
  }

  // ---------- Mô phỏng lệnh RUN ----------
  function hasRuntime(S, lang) {
    const k = S.cfg.kind;
    if (lang === 'python') return ['python', 'counter'].includes(k) || (k === 'app' && (!S.cfg.app || S.cfg.app.lang !== 'node')) || S.pkgs.has('python3');
    return k === 'node' || (k === 'app' && S.cfg.app && S.cfg.app.lang === 'node') || S.pkgs.has('nodejs');
  }

  function simRun(cmd, S) {
    const res = { code: 0, size: 0, out: [], hint: '', writes: [] };
    const alpine = S.cfg.shell === 'sh';
    const notFound = (bin) => { res.code = 127; res.out.push(alpine ? `/bin/sh: ${bin}: not found` : `/bin/sh: 1: ${bin}: not found`); };
    let updatedHere = false;
    const parts = cmd.split(/&&|;|\|\|/).map((x) => x.trim()).filter(Boolean);
    for (const part of parts) {
      let tok;
      try { tok = SH.tokenize(part); } catch (e) { tok = part.split(/\s+/); }
      const prog = (tok[0] || '').split('/').pop();
      if (prog === 'apt-get' || prog === 'apt') {
        if (alpine) { notFound(prog); res.hint = 'Image dựa trên Alpine dùng apk thay cho apt-get: RUN apk add --no-cache <gói>'; return res; }
        if (tok[1] === 'update') { res.size += APT_LISTS; updatedHere = true; S.aptLists = true; continue; }
        if (tok[1] === 'install') {
          const pkgs = tok.slice(2).filter((x) => !x.startsWith('-'));
          if (!S.aptLists) {
            res.code = 100; res.out.push('Reading package lists...', 'Building dependency tree...', `E: Unable to locate package ${pkgs[0] || ''}`);
            res.hint = 'Image gốc không kèm sẵn danh sách gói. Gộp vào cùng một lệnh: RUN apt-get update && apt-get install -y <gói>';
            return res;
          }
          let build = 0;
          pkgs.forEach((p) => {
            if (S.pkgs.has(p)) return;
            S.pkgs.add(p);
            // build-essential đã bao gồm gcc nên chỉ tính phần lớn hơn
            if (p === 'build-essential' || p === 'gcc') build = Math.max(build, APT_SIZE[p]);
            else res.size += APT_SIZE[p] || 10e6;
          });
          res.size += build;
          continue;
        }
        continue;
      }
      if (prog === 'rm' && /\/var\/lib\/apt\/lists/.test(part)) {
        // Xóa danh sách gói chỉ giảm kích thước nếu nằm cùng lệnh RUN đã tạo ra nó
        if (updatedHere) res.size -= APT_LISTS;
        S.aptLists = false;
        continue;
      }
      if (prog === 'apk') {
        if (!alpine) { notFound('apk'); res.hint = 'Image Debian/Ubuntu dùng apt-get, không có apk.'; return res; }
        const pkgs = tok.slice(2).filter((x) => !x.startsWith('-'));
        pkgs.forEach((p) => S.pkgs.add(p === 'python3' ? 'python3' : p === 'nodejs' ? 'nodejs' : p));
        res.size += pkgs.length * 5e6 + (tok.includes('--no-cache') ? 0 : 2e6);
        continue;
      }
      const isPip = ['pip', 'pip3'].includes(prog) || (/^python3?$/.test(prog) && tok[1] === '-m' && tok[2] === 'pip');
      if (isPip) {
        if (!hasRuntime(S, 'python')) { notFound(prog); res.hint = 'Image gốc không có Python. Dùng image python:3.12-slim hoặc cài python trước.'; return res; }
        const it = tok.indexOf('install');
        if (it < 0) continue;
        const pk = [];
        let prefix = null, noCache = false, user = false;
        for (let i = it + 1; i < tok.length; i++) {
          const t = tok[i];
          if (t === '-r' || t === '--requirement') {
            const f = tok[++i] || '';
            const path = resolvePath(f, S.workdir);
            const e = S.fs[path];
            if (!e || typeof e.content !== 'string') {
              res.code = 1;
              res.out.push(`ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${f}'`);
              res.hint = `Lệnh RUN chạy bên trong image đang build: lúc này ${f} chưa được COPY vào ${S.workdir}. Đặt "COPY ${f} ." trước bước pip install.`;
              return res;
            }
            e.content.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter((l) => l && !l.startsWith('-')).forEach((l) => pk.push(l));
          } else if (t.startsWith('--prefix=')) prefix = t.slice(9);
          else if (t === '--prefix') prefix = tok[++i];
          else if (t === '--no-cache-dir') noCache = true;
          else if (t === '--user') user = true;
          else if (['-i', '--index-url', '-c', '--constraint', '-t', '--target'].includes(t)) i++;
          else if (!t.startsWith('-')) pk.push(t);
        }
        const pkgSize = pk.reduce((s, spec) => s + (PIP_SIZE[spec.split(/[=<>!~[;@ ]/)[0].toLowerCase()] || 5e6), 0);
        const dir = prefix ? resolvePath(prefix, S.workdir) : user ? '/root/.local' : '/usr/local/lib/python3.12/site-packages';
        res.writes.push({ path: `${dir}/.pip-${SH.hash(pk.join(','))}`, size: pkgSize });
        // Không có --no-cache-dir: pip giữ thêm bộ đệm tải về trong ~/.cache/pip (~60%)
        if (!noCache) res.writes.push({ path: `/root/.cache/pip/.${SH.hash(pk.join(','))}`, size: pkgSize * 0.6 });
        res.size += pkgSize * (noCache ? 1 : 1.6);
        continue;
      }
      if (prog === 'npm') {
        if (!hasRuntime(S, 'node')) { notFound('npm'); res.hint = 'Image gốc không có Node.js. Dùng image node:20-alpine.'; return res; }
        const sub = tok[1];
        const pj = S.fs[resolvePath('package.json', S.workdir)];
        if (['install', 'i', 'ci', 'run', 'start'].includes(sub) && (!pj || typeof pj.content !== 'string')) {
          res.code = 254;
          res.out.push('npm error code ENOENT', 'npm error syscall open', `npm error path ${resolvePath('package.json', S.workdir)}`, `npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '${resolvePath('package.json', S.workdir)}'`);
          res.hint = `package.json chưa có trong ${S.workdir} khi chạy npm. Đặt "COPY package*.json ./" trước bước npm install.`;
          return res;
        }
        if (sub === 'ci' && !S.fs[resolvePath('package-lock.json', S.workdir)]) {
          res.code = 1;
          res.out.push('npm error code EUSAGE', 'npm error The `npm ci` command can only install with an existing package-lock.json or', 'npm error npm-shrinkwrap.json with lockfileVersion >= 1.');
          res.hint = 'npm ci cần package-lock.json. COPY cả file khóa: COPY package*.json ./';
          return res;
        }
        if (['install', 'i', 'ci'].includes(sub)) {
          let deps = {};
          try { const j = JSON.parse(pj.content); deps = Object.assign({}, j.dependencies, tok.some((x) => /^--(omit=dev|production)$/.test(x)) ? {} : j.devDependencies); } catch (e) { /* package.json lỗi: coi như không có phụ thuộc */ }
          const sz = Object.keys(deps).reduce((s, k) => s + (NPM_SIZE[k] || 8e6), 0) + 1e6;
          res.writes.push({ path: resolvePath('node_modules', S.workdir) + '/.npm-' + SH.hash(Object.keys(deps).join(',')), size: sz });
          res.size += sz * 1.3; // bộ đệm ~/.npm
          continue;
        }
        if (sub === 'run' && tok[2] === 'build') { res.writes.push({ path: resolvePath('dist', S.workdir) + '/index.js', size: 1e6 }); res.size += 1e6; continue; }
        continue;
      }
      if (prog === 'exit') { res.code = parseInt(tok[1], 10) || 0; if (res.code) return res; continue; }
      if (prog === 'false') { res.code = 1; return res; }
      if (prog === 'mkdir') { tok.slice(1).filter((x) => !x.startsWith('-')).forEach((d) => S.dirs.add(resolvePath(d, S.workdir))); continue; }
      if (prog === 'echo' || prog === 'printf') {
        const m = part.match(/>{1,2}\s*(\S+)\s*$/);
        if (m) { const txt = part.replace(/>{1,2}\s*\S+\s*$/, '').replace(/^\S+\s*/, '').replace(/^(["'])(.*)\1\s*$/, '$2'); res.writes.push({ path: resolvePath(m[1], S.workdir), content: txt + '\n' }); }
        continue;
      }
      if (prog === 'touch') { tok.slice(1).forEach((f) => res.writes.push({ path: resolvePath(f, S.workdir), content: '' })); continue; }
      res.size += 0.1e6;
    }
    res.size = Math.max(0, res.size);
    return res;
  }

  // ---------- Nhận diện ứng dụng web trong image vừa build ----------
  function detectApp(S) {
    const ent = S.cfg.entrypoint || [], cmd = S.cfg.cmd || [];
    const full = [...ent, ...cmd].join(' ');
    const read = (p) => { const e = S.fs[resolvePath(p, S.workdir)]; return e && typeof e.content === 'string' ? e.content : undefined; };
    const portOf = (src, re, dflt) => { const m = src.match(re) || full.match(/--port[ =](\d+)|-b\s*\S*:(\d+)/); return m ? +(m[1] || m[2]) : (S.cfg.expose && S.cfg.expose[0]) || dflt; };
    let m;
    if (/python|flask|gunicorn|uvicorn/.test(full)) {
      let file = (m = full.match(/([\w./-]+\.py)\b/)) ? m[1] : null;
      if (!file && (m = full.match(/(?:uvicorn|gunicorn)\s+(?:\S+\s+)*?([\w.]+):\w+/))) file = m[1].replace(/\./g, '/') + '.py';
      if (!file && /flask\s+run/.test(full)) file = 'app.py';
      const src = file && read(file);
      if (src && /flask|Flask|app\.run|http\.server|FastAPI|serve_forever/.test(src)) {
        const msg = src.match(/return\s+f?(["'])(.*?)\1/);
        return { port: portOf(src, /port\s*=\s*(\d+)/, 5000), lang: 'python', message: msg ? msg[2].replace(/\\n/g, '') : undefined };
      }
      return null;
    }
    if (/node|npm/.test(full)) {
      let file = (m = full.match(/node\s+([\w./-]+\.[cm]?js)\b/)) ? m[1] : null;
      if (!file && /npm\s+(run\s+)?start/.test(full)) {
        try { const s = JSON.parse(read('package.json') || '{}').scripts || {}; const mm = (s.start || '').match(/node\s+([\w./-]+)/); file = mm ? mm[1] : 'index.js'; } catch (e) { file = 'index.js'; }
      }
      const src = file && read(file);
      if (src && /listen\s*\(/.test(src)) {
        const msg = src.match(/res\.(?:send|end)\(\s*(["'`])(.*?)\1/);
        return { port: portOf(src, /listen\(\s*(\d+)|PORT\s*\|\|\s*(\d+)/, 3000), lang: 'node', message: msg ? msg[2].replace(/\\n/g, '') : undefined };
      }
    }
    return null;
  }

  // ---------- Chạy build ----------
  function run(o) {
    const L = [];
    const p = (text, cls = '') => String(text).split('\n').forEach((t) => L.push({ text: t, cls }));
    const hint = (t) => { if (t) p('💡 ' + t, 'hint'); };
    const now = typeof o.now === 'function' ? o.now : () => Date.now();
    const files = o.files || {};
    const cache = o.cache || {};
    const steps = [];
    let elapsed = 0, done = 0, total = 0;
    const body = [];
    const line = (text, t, cls = '') => { body.push({ text: t === undefined ? text : pad(text, 64) + secs(t), cls }); };

    // Kết thúc với lỗi: in tiêu đề, các dòng đã chạy, đoạn Dockerfile quanh dòng lỗi và gợi ý
    let dfName = 'Dockerfile', dfLines = [];
    function fail(msg, errLine, hintText, detail) {
      p(`[+] Building ${secs(elapsed)} (${done}/${Math.max(total, done + 1)})`, 'dim');
      body.forEach((b) => L.push(b));
      if (detail) { p('------', 'dim'); detail.forEach((d) => p(d, d.startsWith(' >') ? '' : 'err')); p('------', 'dim'); }
      if (errLine && dfLines.length) {
        p(`${dfName}:${errLine}`, 'dim');
        p('--------------------', 'dim');
        for (let i = Math.max(1, errLine - 2); i <= Math.min(dfLines.length, errLine + 2); i++) p(`${String(i).padStart(4)} | ${i === errLine ? '>>> ' : ''}${dfLines[i - 1]}`, i === errLine ? 'err' : 'dim');
        p('--------------------', 'dim');
      }
      p(`ERROR: failed to solve: ${msg}`, 'err');
      hint(hintText);
      return { ok: false, lines: L, steps, image: null, errorLine: errLine || undefined };
    }

    // 1) Ngữ cảnh build: danh sách file trong thư mục được chỉ định (mặc định ".")
    const ctx = String(o.context || '.').replace(/^\/home\/user\/lab\/?/, './').replace(/^\.\/?/, '').replace(/\/+$/, '');
    const entries = [];
    Object.keys(files).forEach((k) => {
      const dir = k.endsWith('/');
      const key = k.replace(/\/+$/, '');
      if (ctx && !(key === ctx || key.startsWith(ctx + '/'))) return;
      const rel = ctx ? key.slice(ctx.length + 1) : key;
      if (!rel) return;
      const v = files[k];
      entries.push({ path: rel, content: typeof v === 'string' ? v : undefined, size: sizeOf(v), dir: dir || typeof v !== 'string' });
    });
    if (ctx && !entries.length) {
      p(`ERROR: unable to prepare context: path "${o.context}" not found`, 'err');
      hint(`Thư mục ngữ cảnh "${o.context}" không tồn tại. Thường dùng dấu "." (thư mục hiện tại).`);
      return { ok: false, lines: L, steps, image: null };
    }

    // 2) Dockerfile: ưu tiên trong thư mục ngữ cảnh, sau đó đường dẫn -f tính từ thư mục hiện tại
    dfName = o.dockerfile || 'Dockerfile';
    const dfKey = [ctx ? `${ctx}/${dfName}` : dfName, dfName].map((k) => k.replace(/^\.\//, '')).find((k) => typeof files[k] === 'string');
    total = 1;
    if (!dfKey) {
      line(` => [internal] load build definition from ${dfName}`, 0);
      line(' => => transferring dockerfile: 2B', 0, 'dim');
      done = 1;
      return fail(`failed to read dockerfile: open ${dfName}: no such file or directory`, 0, `Không thấy file "${dfName}" trong thư mục ngữ cảnh. Tên file phải đúng "Dockerfile" (chữ D hoa, không đuôi), hoặc chỉ định bằng -f.`);
    }
    const dfText = files[dfKey];
    dfLines = dfText.replace(/\r\n?/g, '\n').split('\n');
    line(` => [internal] load build definition from ${dfName}`, 0);
    line(` => => transferring dockerfile: ${dfText.length}B`, 0, 'dim');
    done = 1;
    let df;
    try { df = parseDockerfile(dfText); } catch (e) {
      if (e instanceof BuildError) return fail(e.message, e.line, e.hint);
      throw e;
    }

    // 3) Chọn stage cần build (--target) và các stage phụ thuộc (FROM <stage>, COPY --from=<stage>)
    const st = df.stages;
    const stageIndex = (ref) => {
      if (ref == null) return -1;
      const r = String(ref).toLowerCase();
      const i = st.findIndex((s) => s.name === r);
      if (i >= 0) return i;
      return /^\d+$/.test(r) && +r < st.length ? +r : -1;
    };
    let target = st.length - 1;
    if (o.target) {
      target = stageIndex(o.target);
      if (target < 0) return fail(`target stage "${o.target}" could not be found`, 0, `Không có stage tên "${o.target}". Đặt tên stage bằng: FROM <image> AS ${o.target}`);
    }
    const needed = new Set();
    (function need(i) {
      if (needed.has(i)) return;
      needed.add(i);
      const fi = stageIndex(st[i].from);
      if (fi >= 0 && fi < i) need(fi);
      st[i].instrs.forEach((it) => { const m = it.ins !== 'RUN' && it.args.match(/--from=(\S+)/); if (m) { const k = stageIndex(m[1]); if (k >= 0 && k < i) need(k); } });
    })(target);
    const order = [...needed].sort((a, b) => a - b);

    // ARG toàn cục (trước FROM) dùng được trong dòng FROM
    const gArgs = {};
    df.globalArgs.forEach((a) => { const [k, ...v] = a.args.split('='); gArgs[k.trim()] = (o.buildArgs && o.buildArgs[k.trim()] !== undefined) ? o.buildArgs[k.trim()] : v.join('='); });

    // 4) Phân giải image gốc (giống bước "load metadata" của BuildKit)
    const bases = {};
    total = 2 + order.reduce((s, i) => s + 1 + st[i].instrs.filter((x) => STEP.has(x.ins)).length, 0) + 2;
    for (const i of order) {
      const ref = subst(st[i].from, gArgs);
      if (stageIndex(ref) >= 0 && stageIndex(ref) < i) continue;
      if (ref.toLowerCase() === 'scratch') { bases[i] = { scratch: true }; continue; }
      const b = o.resolveBase ? o.resolveBase(ref) : null;
      const fr = fullRef(ref);
      if (!b) {
        line(` => ERROR [internal] load metadata for ${fr}`, 0.9, 'err');
        elapsed += 0.9;
        return fail(`${ref}: failed to resolve source metadata for ${fr}: pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed`, st[i].line, `Image gốc "${ref}" không tồn tại (sai tên hoặc tag). Kiểm tra dòng ${st[i].line} của Dockerfile.`);
      }
      bases[i] = b;
      const t = 0.4 + (SH.hash(fr).charCodeAt(0) % 9) / 10;
      line(` => [internal] load metadata for ${fr}`, t);
      elapsed += t; done++;
    }

    // 5) .dockerignore và gửi ngữ cảnh build
    const ignFile = entries.find((e) => e.path === '.dockerignore');
    const rules = ignoreRules(ignFile && ignFile.content);
    line(' => [internal] load .dockerignore', 0);
    line(` => => transferring context: ${ignFile ? ignFile.size : 2}B`, 0, 'dim');
    const ignored = {};
    const ctxFiles = entries.filter((e) => { const r = ignoredBy(e.path, rules); if (r) ignored[e.path] = r; return !r; });
    const ctxSize = ctxFiles.reduce((s, e) => s + e.size, 0);
    const ctxT = 0.1 + ctxSize / 100e6;
    line(' => [internal] load build context', ctxT);
    line(` => => transferring context: ${SH.fmtSize(ctxSize)}`, ctxT, 'dim');
    elapsed += ctxT; done++;

    // 6) Chạy từng stage
    const results = {};
    const warnings = [];
    for (const i of order) {
      const stage = st[i];
      const label = st.length === 1 ? '' : (stage.name || `stage-${i}`) + ' ';
      const N = 1 + stage.instrs.filter((x) => STEP.has(x.ins)).length;
      let S;
      const fromStage = stageIndex(subst(stage.from, gArgs));
      if (fromStage >= 0 && fromStage < i) {
        const P = results[fromStage];
        S = { fs: {}, cfg: JSON.parse(JSON.stringify(P.cfg)), layers: P.layers.map((l) => Object.assign({}, l)), size: P.size, chain: P.chain, pkgs: new Set(P.pkgs), dirs: new Set(P.dirs), aptLists: P.aptLists, args: {} };
        Object.keys(P.fs).forEach((k) => { S.fs[k] = Object.assign({}, P.fs[k]); });
        line(` => [${label}1/${N}] FROM ${stage.from}`, 0);
      } else {
        const b = bases[i];
        const cfg = b.scratch ? { kind: 'shell', shell: null, cmd: [], entrypoint: [], env: {}, workdir: '/', expose: [], files: {}, layers: [] } : JSON.parse(JSON.stringify(b.config || {}));
        cfg.env = Object.assign({}, cfg.env); cfg.expose = (cfg.expose || []).slice(); cfg.cmd = (cfg.cmd || []).slice(); cfg.entrypoint = (cfg.entrypoint || []).slice();
        S = { fs: {}, cfg, layers: b.scratch ? [] : (b.layers || []).map((l) => Object.assign({ created: b.created }, l)), size: b.scratch ? 0 : b.size, chain: SH.hash('base:' + (b.scratch ? 'scratch' : b.id)), pkgs: new Set(), dirs: new Set(), aptLists: false, args: {} };
        Object.keys(cfg.files || {}).forEach((k) => { S.fs[k] = { content: cfg.files[k], size: sizeOf(cfg.files[k]), base: true }; });
        const fr = b.scratch ? 'scratch' : `${fullRef(subst(stage.from, gArgs))}@sha256:${SH.hash64('digest:' + b.id)}`;
        line(` => [${label}1/${N}] FROM ${fr}`, 0.1);
        elapsed += 0.1;
      }
      S.workdir = S.cfg.workdir || '/';
      done++;
      let n = 1;
      const vars = () => Object.assign({}, gArgs, S.args, S.cfg.env);

      for (const it of stage.instrs) {
        const text = it.raw;
        const created = now();
        const addMeta = (hist) => {
          S.chain = SH.hash(S.chain + '|' + it.raw + '|' + JSON.stringify(vars()));
          S.layers.push({ id: SH.hash64(S.chain).slice(0, 12), size: 0, cmd: hist, built: true, created, empty: true });
        };
        if (!STEP.has(it.ins)) {
          const a = it.args;
          if (it.ins === 'ENV') {
            const tk = SH.tokenize(a);
            if (tk.length && !tk[0].includes('=')) S.cfg.env[tk[0]] = subst(tk.slice(1).join(' '), vars());
            else tk.forEach((t) => { const e = t.indexOf('='); if (e > 0) S.cfg.env[t.slice(0, e)] = subst(t.slice(e + 1), vars()); });
            addMeta(`ENV ${a}`);
          } else if (it.ins === 'ARG') {
            const [k, ...v] = a.split('=');
            const key = k.trim();
            S.args[key] = o.buildArgs && o.buildArgs[key] !== undefined ? o.buildArgs[key] : (v.length ? v.join('=') : (gArgs[key] || ''));
            addMeta(`ARG ${a}`);
          } else if (it.ins === 'EXPOSE') {
            subst(a, vars()).split(' ').forEach((x) => { const pn = parseInt(x, 10); if (pn && !S.cfg.expose.includes(pn)) S.cfg.expose.push(pn); });
            addMeta(`EXPOSE map[${S.cfg.expose.map((x) => x + '/tcp:{}').join(' ')}]`);
          } else if (it.ins === 'CMD' || it.ins === 'ENTRYPOINT') {
            const ex = parseExec(a);
            if (!ex.json) warnings.push(`JSONArgsRecommended: JSON arguments recommended for ${it.ins} to prevent unintended behavior related to OS signals (line ${it.line})`);
            if (it.ins === 'CMD') S.cfg.cmd = ex.arr;
            else { S.cfg.entrypoint = ex.arr; S.cfg.cmd = []; } // ENTRYPOINT mới xóa CMD kế thừa từ image gốc (đúng hành vi Docker)
            addMeta(`${it.ins} ${goArr(ex.arr)}`);
          } else if (it.ins === 'USER') { S.cfg.user = subst(a, vars()); addMeta(`USER ${a}`); }
          else if (it.ins === 'LABEL') { S.cfg.labels = Object.assign({}, S.cfg.labels); SH.tokenize(a).forEach((t) => { const e = t.indexOf('='); if (e > 0) S.cfg.labels[t.slice(0, e)] = t.slice(e + 1); }); addMeta(`LABEL ${a}`); }
          else addMeta(`${it.ins} ${a}`);
          continue;
        }

        n++;
        const tag = `[${label}${n}/${N}]`;
        let size = 0, t = 0, hist = '', writes = [];
        if (it.ins === 'WORKDIR') {
          S.workdir = resolvePath(subst(it.args, vars()), S.workdir);
          S.cfg.workdir = S.workdir;
          S.dirs.add(S.workdir);
          S.chain = SH.hash(S.chain + '|' + it.raw + '|' + S.workdir);
          hist = `WORKDIR ${S.workdir}`;
          t = 0.0;
        } else if (it.ins === 'COPY' || it.ins === 'ADD') {
          let tk;
          const pe = parseExec(it.args);
          const flags = {};
          if (pe.json) tk = pe.arr;
          else { tk = SH.tokenize(subst(it.args, vars())); }
          while (tk.length && tk[0].startsWith('--')) { const f = tk.shift(); const e = f.indexOf('='); flags[e > 0 ? f.slice(2, e) : f.slice(2)] = e > 0 ? f.slice(e + 1) : true; }
          if (tk.length < 2) return fail(`dockerfile parse error on line ${it.line}: ${it.ins} requires at least two arguments, but only one was provided. Destination could not be determined`, it.line, `${it.ins} cần nguồn và đích, ví dụ: ${it.ins} . .   (chép toàn bộ ngữ cảnh vào thư mục làm việc)`);
          const dest = tk.pop();
          const srcs = tk;
          const copies = [];
          let multi = srcs.length > 1;
          for (const src of srcs) {
            if (flags.from) {
              // Lấy file từ stage trước (multi-stage): đường dẫn nguồn là đường dẫn tuyệt đối bên trong stage đó
              const k = stageIndex(flags.from);
              const P = k >= 0 ? results[k] : null;
              if (!P) return fail(`failed to parse stage name "${flags.from}": invalid reference format`, it.line, `Không có stage "${flags.from}" đứng trước dòng ${it.line}. Đặt tên stage bằng FROM <image> AS ${flags.from}.`);
              const sp = resolvePath(src, '/');
              const found = Object.keys(P.fs).filter((pth) => pth === sp || pth.startsWith(sp + '/'));
              if (!found.length) {
                line(` => ERROR ${tag} ${text}`, 0, 'err');
                return fail(`failed to compute cache key: failed to calculate checksum of ref ${SH.hash64(P.chain).slice(0, 25)}::${SH.hash(sp)}: "${sp}": not found`, it.line, `Stage "${flags.from}" không có "${sp}". Kiểm tra đường dẫn mà stage đó đã tạo (ví dụ pip --prefix=/install).`);
              }
              found.forEach((pth) => { if (pth !== sp) multi = true; copies.push({ rel: pth === sp ? basename(sp) : pth.slice(sp.length + 1), single: pth === sp, e: P.fs[pth] }); });
            } else if (/^https?:\/\//.test(src) && it.ins === 'ADD') {
              copies.push({ rel: basename(src), single: true, e: { content: '', size: 1e6 } });
            } else {
              const s = src.replace(/^\.\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '');
              let matched = [];
              if (!s) { matched = ctxFiles.map((e) => ({ rel: e.path, single: false, e })); multi = true; }
              else if (hasGlob(s)) {
                const re = globRe(s);
                ctxFiles.forEach((e) => {
                  const segs = e.path.split('/');
                  for (let k2 = 1; k2 <= segs.length; k2++) { const pre = segs.slice(0, k2).join('/'); if (re.test(pre)) { matched.push({ rel: k2 === segs.length ? basename(e.path) : segs.slice(k2 - 1).join('/'), single: false, e }); break; } }
                });
                multi = true;
              } else {
                ctxFiles.forEach((e) => {
                  if (e.path === s) matched.push({ rel: basename(s), single: !e.dir, e });
                  else if (e.path.startsWith(s + '/')) { matched.push({ rel: e.path.slice(s.length + 1), single: false, e }); multi = true; }
                });
              }
              if (!matched.length) {
                line(` => ERROR ${tag} ${text}`, 0, 'err');
                const ig = Object.keys(ignored).find((k2) => k2 === s || k2.startsWith(s + '/'));
                const h = ig ? `"${s}" đang bị loại bởi .dockerignore (mẫu "${ignored[ig]}") nên không được gửi vào ngữ cảnh build.` : `Không có "${s}" trong thư mục ngữ cảnh build. Đường dẫn nguồn của ${it.ins} tính từ thư mục ngữ cảnh (dấu "." trong lệnh build).`;
                return fail(`failed to compute cache key: failed to calculate checksum of ref ${SH.hash64(S.chain).slice(0, 25)}::${SH.hash(s)}: "/${s}": not found`, it.line, h);
              }
              matched.forEach((m) => copies.push(m));
            }
          }
          const dAbs = resolvePath(subst(dest, vars()), S.workdir);
          const destDir = dest.endsWith('/') || dest === '.' || multi || copies.length !== 1 || !copies[0].single;
          let sig = '';
          copies.forEach((c) => {
            const to = destDir ? `${dAbs.replace(/\/$/, '')}/${c.rel}` : dAbs;
            sig += to + ':' + (typeof c.e.content === 'string' ? SH.hash(c.e.content) : 's' + c.e.size) + ';';
            writes.push({ path: to, content: c.e.content, size: c.e.size });
            size += c.e.size;
          });
          // Khóa cache của COPY gồm cả băm nội dung file: sửa một file là lớp này và mọi lớp sau phải build lại
          S.chain = SH.hash(S.chain + '|' + it.raw + '|' + SH.hash(sig));
          hist = `${it.ins} ${it.args} # buildkit`;
          t = 0.1 + size / 150e6;
        } else if (it.ins === 'RUN') {
          const ex = parseExec(it.args);
          const cmd = ex.json ? ex.arr.join(' ') : it.args;
          S.chain = SH.hash(S.chain + '|' + it.raw + '|' + JSON.stringify(S.args));
          const r = simRun(subst(cmd, vars()), S);
          if (r.code) {
            const tt = 0.4 + (r.out.length ? 0.4 : 0);
            line(` => ERROR ${tag} ${text}`, tt, 'err');
            elapsed += tt;
            const det = [` > ${tag} ${text}:`].concat(r.out.map((x, k) => `${(0.2 + k * 0.05).toFixed(3)} ${x}`));
            const proc = ex.json ? goArr(ex.arr) : `"/bin/sh -c ${cmd.replace(/"/g, '\\"')}"`;
            return fail(`process ${proc} did not complete successfully: exit code: ${r.code}`, it.line, r.hint || `Lệnh ở dòng ${it.line} thất bại bên trong image đang build (mã thoát ${r.code}).`, det);
          }
          size = r.size;
          writes = r.writes;
          hist = `RUN ${ex.json ? goArr(ex.arr) : '/bin/sh -c ' + cmd} # buildkit`;
          t = /pip|npm|apt|apk/.test(cmd) ? 1.5 + size / 12e6 : 0.3;
        }

        // Ghi thay đổi vào hệ thống file của stage
        writes.forEach((w) => { S.fs[w.path] = { content: w.content, size: w.size !== undefined ? w.size : sizeOf(w.content) }; });
        const cached = !o.noCache && !!cache[S.chain];
        if (cached) { line(` => CACHED ${tag} ${text}`, 0); size = cache[S.chain].size; }
        else { line(` => ${tag} ${text}`, t); elapsed += t; cache[S.chain] = { size, created }; }
        S.size += size;
        S.layers.push({ id: SH.hash64(S.chain).slice(0, 12), size, cmd: hist, built: true, created: cache[S.chain].created });
        steps.push({ text, cached, size, stage: label.trim(), n, N, line: it.line, ins: it.ins });
        done++;
      }
      results[i] = S;
    }

    // 7) Đóng gói image cuối cùng từ stage đích
    const F = results[target];
    const cfg = Object.assign({}, F.cfg);
    cfg.files = {};
    Object.keys(F.fs).forEach((k) => { if (typeof F.fs[k].content === 'string') cfg.files[k] = F.fs[k].content; });
    cfg.layers = F.layers;
    cfg.workdir = F.workdir;
    delete cfg.app;
    const app = detectApp({ cfg, fs: F.fs, workdir: F.workdir });
    if (app) { cfg.kind = 'app'; cfg.app = app; }
    const expT = 0.2 + steps.filter((s) => !s.cached).length * 0.1;
    line(' => exporting to image', expT);
    line(' => => exporting layers', expT - 0.1, 'dim');
    elapsed += expT; done += 2;
    total = done;
    p(`[+] Building ${secs(elapsed)} (${done}/${total}) FINISHED`, '');
    body.forEach((b) => L.push(b));
    if (warnings.length) {
      p('');
      p(` ${warnings.length} warning${warnings.length > 1 ? 's' : ''} found (use docker --debug to expand):`, 'warn');
      warnings.forEach((w) => p(` - ${w}`, 'warn'));
      hint('Viết CMD/ENTRYPOINT dạng mảng JSON, ví dụ CMD ["python", "app.py"], để tiến trình nhận được tín hiệu dừng (SIGTERM) đúng cách.');
    }
    return { ok: true, lines: L, steps, errorLine: undefined, image: { key: F.chain + ':' + SH.hash(JSON.stringify([cfg.cmd, cfg.entrypoint, cfg.env, cfg.expose])), size: F.size, layers: F.layers, config: cfg } };
  }

  return { parseDockerfile, run, BuildError, ignoreRules, ignoredBy };
});
