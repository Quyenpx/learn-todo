/*
 * ui-devops.js — Thành phần giao diện dùng chung cho khóa DevOps:
 * terminal giả lập, trình sửa file, sơ đồ trạng thái Docker và sơ đồ lớp image.
 * Mọi chuỗi từ bộ mô phỏng đều gán bằng textContent (không dùng innerHTML) để tránh chèn HTML.
 */
(function () {
  'use strict';
  const App = window.App;

  // ---------- Terminal ----------
  App.terminal = function (parent, { engine, welcome = [], chips = [], onExec, height = 320, title = 'Terminal — máy ảo lab' } = {}) {
    const el = App.h(`<div class="term" role="region" aria-label="Terminal giả lập">
      <div class="term-bar"><i></i><i></i><i></i><span class="t"></span><button type="button" data-a="clear" title="Xóa màn hình (Ctrl+L)">Xóa</button></div>
      <div class="term-out" role="log" aria-live="polite"></div>
      <div class="term-opts" hidden></div>
      <label class="term-input"><span class="ps"></span><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Nhập lệnh"></label>
      ${chips.length ? '<div class="chips" aria-label="Lệnh mẫu"></div>' : ''}
    </div>`);
    el.querySelector('.t').textContent = title;
    parent.appendChild(el);
    const out = el.querySelector('.term-out'), input = el.querySelector('input'), ps = el.querySelector('.term-input .ps'), opts = el.querySelector('.term-opts');
    out.style.height = height + 'px';
    const hist = [];
    let hi = 0;

    function line(text, cls) {
      const d = document.createElement('div');
      d.className = 'term-line' + (cls ? ' ' + cls : '');
      d.textContent = text;
      out.appendChild(d);
      return d;
    }
    function print(lines) { lines.forEach((l) => (typeof l === 'string' ? line(l) : line(l.text, l.cls))); out.scrollTop = out.scrollHeight; }
    function clear() { out.innerHTML = ''; }
    const setPrompt = () => { ps.textContent = engine.prompt(); };

    function run(cmd) {
      const d = line('', 'cmd');
      const p = document.createElement('span'); p.className = 'ps'; p.textContent = engine.prompt() + ' ';
      d.appendChild(p); d.appendChild(document.createTextNode(cmd));
      opts.hidden = true;
      if (cmd.trim()) { hist.push(cmd); hi = hist.length; }
      const r = engine.exec(cmd);
      if (r.clear) clear();
      print(r.lines);
      setPrompt();
      onExec && onExec(cmd, r);
      return r;
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const r = engine.complete(input.value);
        input.value = r.line;
        opts.hidden = !r.options.length;
        opts.textContent = r.options.join('   ');
      } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clear(); }
      else if (e.key === 'c' && e.ctrlKey) {
        if (input.selectionStart !== input.selectionEnd) return; // đang bôi đen: để trình duyệt sao chép
        line(engine.prompt() + ' ' + input.value + '^C', 'dim'); input.value = '';
      }
    });
    out.addEventListener('click', () => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); });
    el.querySelector('[data-a="clear"]').addEventListener('click', clear);
    if (chips.length) {
      const box = el.querySelector('.chips');
      chips.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = c; b.title = 'Bấm để chạy lệnh này';
        b.addEventListener('click', () => { run(c); input.focus({ preventScroll: true }); });
        box.appendChild(b);
      });
    }
    print(welcome.map((t) => ({ text: t, cls: 'welcome' })));
    setPrompt();
    return { el, run, print, clear, focus: () => input.focus({ preventScroll: true }), refresh: setPrompt };
  };

  // ---------- Trình sửa file trong thư mục lab ----------
  App.fileEditor = function (parent, { engine, files, onChange } = {}) {
    const el = App.h(`<div class="fed">
      <div class="fed-tabs" role="tablist"></div>
      <div class="fed-body"><div class="fed-gutter" aria-hidden="true"></div><textarea class="fed-area" spellcheck="false" aria-label="Nội dung file"></textarea></div>
      <div class="fed-foot"><span class="fed-info">Sửa trực tiếp — thay đổi được lưu ngay vào thư mục lab (~/lab)</span><button type="button" class="btn small ghost" data-a="reset">↺ Khôi phục file gốc</button></div>
    </div>`);
    parent.appendChild(el);
    const tabs = el.querySelector('.fed-tabs'), area = el.querySelector('.fed-area'), gutter = el.querySelector('.fed-gutter'), info = el.querySelector('.fed-info');
    let current = files[0], badLine = 0;
    const content = (n) => (typeof engine.files[n] === 'string' ? engine.files[n] : '');

    function renderTabs() {
      tabs.innerHTML = '';
      files.forEach((n) => {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = n;
        b.className = (n === current ? 'on ' : '') + (content(n) !== (engine.initialFiles[n] || '') ? 'dirty' : '');
        b.setAttribute('aria-selected', n === current);
        b.addEventListener('click', () => select(n));
        tabs.appendChild(b);
      });
    }
    function renderGutter() {
      const n = area.value.split('\n').length;
      gutter.innerHTML = '';
      for (let i = 1; i <= n; i++) {
        const s = document.createElement('div');
        s.textContent = i;
        if (i === badLine) s.className = 'bad';
        gutter.appendChild(s);
      }
      area.style.height = 'auto';
      area.style.height = Math.max(220, area.scrollHeight) + 'px';
    }
    function select(n) { current = n; badLine = 0; area.value = content(n); renderTabs(); renderGutter(); }
    function highlight(line) { badLine = line; renderGutter(); }

    area.addEventListener('input', () => {
      engine.setFile(current, area.value);
      badLine = 0;
      renderGutter(); renderTabs();
      onChange && onChange(current, area.value);
    });
    // Tab chèn 2 khoảng trắng (YAML không cho phép ký tự tab)
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = area.selectionStart;
      area.setRangeText('  ', s, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input'));
    });
    el.querySelector('[data-a="reset"]').addEventListener('click', () => { engine.resetFile(current); select(current); });
    const offFiles = engine.on('files', () => { if (document.activeElement !== area) select(current); });
    const offEvt = engine.on('event', (e) => {
      if (e.type === 'fileError' && files.includes(e.file)) { if (current !== e.file) select(e.file); highlight(e.line); info.textContent = `⚠ Lỗi ở dòng ${e.line} của ${e.file}`; }
      if (e.type === 'build') info.textContent = 'Sửa trực tiếp — thay đổi được lưu ngay vào thư mục lab (~/lab)';
    });
    select(current);
    return { el, select, highlight, destroy() { offFiles(); offEvt(); } };
  };

  // ---------- Vẽ hình chữ nhật bo góc ----------
  App.rrect = function (ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  };
  const fit = (ctx, s, w) => { if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
  const COL = { run: '#34d399', exit: '#64748b', fail: '#f87171', created: '#fbbf24', img: '#38bdf8', vol: '#c084fc', net: 'rgba(45,212,191,0.55)' };

  // ---------- Sơ đồ trạng thái Docker: image → container (theo network) → volume ----------
  App.dockerDiagram = function (cv, engine, t = 0) {
    const { ctx, w, h } = cv;
    const S = engine.state;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 560;
    const imgW = narrow ? Math.max(96, w * 0.28) : Math.min(210, w * 0.24);
    const vols = S.volumes;
    const volW = vols.length ? (narrow ? 92 : 150) : 0;
    const midX = imgW + 26, midW = w - midX - (volW ? volW + 26 : 8);
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
    ctx.textBaseline = 'middle';
    // Tiêu đề cột
    ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText(narrow ? 'IMAGE' : 'IMAGE (khuôn)', 8, 12);
    ctx.fillText(narrow ? 'CONTAINER' : 'CONTAINER (đang chạy từ khuôn)', midX, 12);
    if (volW) ctx.fillText('VOLUME', w - volW - 4, 12);

    // Cột image
    const imgPos = {};
    const imgs = S.images.slice(0, 9);
    imgs.forEach((im, i) => {
      const y = 26 + i * 32;
      const dangling = im.repo === '<none>';
      App.rrect(ctx, 6, y, imgW - 12, 26, 7, dangling ? 'rgba(100,116,139,0.12)' : 'rgba(56,189,248,0.10)', dangling ? 'rgba(100,116,139,0.4)' : 'rgba(56,189,248,0.38)');
      ctx.fillStyle = dangling ? '#94a3b8' : '#e0f2fe';
      ctx.font = '600 11.5px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, `${im.repo}:${im.tag}`, imgW - 70), 14, y + 13);
      ctx.fillStyle = '#7c879f'; ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
      ctx.fillText(App.fmtBytes(im.size), imgW - 12, y + 13); ctx.textAlign = 'left';
      imgPos[im.id] = imgPos[im.id] || { x: imgW - 6, y: y + 13 };
    });
    if (!imgs.length) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText(narrow ? '(trống)' : 'Chưa có image — thử docker pull nginx', 8, 40); }
    if (S.images.length > imgs.length) { ctx.fillStyle = '#64748b'; ctx.font = '11px "Be Vietnam Pro"'; ctx.fillText(`+${S.images.length - imgs.length} image khác`, 10, 26 + imgs.length * 32 + 8); }

    // Container gom theo network đầu tiên
    const groups = {};
    S.containers.forEach((c) => { const n = Object.keys(c.networks)[0] || 'none'; (groups[n] = groups[n] || []).push(c); });
    let y = 24;
    const cW = narrow ? midW - 16 : Math.min(200, (midW - 28) / 2);
    const perRow = Math.max(1, Math.floor((midW - 16) / (cW + 10)));
    const pos = {};
    Object.keys(groups).forEach((net) => {
      const list = groups[net];
      const rows = Math.ceil(list.length / perRow);
      const gh = 26 + rows * 62;
      ctx.setLineDash([5, 4]);
      App.rrect(ctx, midX, y, midW, gh, 12, 'rgba(45,212,191,0.03)', COL.net);
      ctx.setLineDash([]);
      ctx.fillStyle = '#5eead4'; ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(`network: ${net}${net === 'bridge' && !narrow ? ' (mặc định — không gọi nhau bằng tên)' : ''}`, midX + 10, y + 13);
      list.forEach((c, i) => {
        const cx = midX + 8 + (i % perRow) * (cW + 10), cy = y + 24 + Math.floor(i / perRow) * 62;
        const st = c.status === 'running' ? 'run' : c.status === 'created' ? 'created' : c.exitCode ? 'fail' : 'exit';
        App.rrect(ctx, cx, cy, cW, 54, 10, st === 'run' ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)', st === 'run' ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)');
        const pulse = st === 'run' ? 3.5 + Math.sin(t / 300 + i) * 1.3 : 3.5;
        App.dot(ctx, cx + 12, cy + 15, pulse, COL[st]);
        ctx.fillStyle = '#f1f5f9'; ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
        ctx.fillText(fit(ctx, c.name, cW - 30), cx + 22, cy + 15);
        ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px "JetBrains Mono", monospace';
        const status = st === 'run' ? 'Up' : st === 'created' ? 'Created' : `Exited (${c.exitCode})`;
        ctx.fillText(fit(ctx, `${c.image} · ${status}`, cW - 16), cx + 8, cy + 32);
        if (c.ports.length) { ctx.fillStyle = '#fbbf24'; ctx.fillText(fit(ctx, c.ports.map((p) => `:${p.host}→${p.container}`).join(' '), cW - 16), cx + 8, cy + 46); }
        pos[c.id] = { x: cx, y: cy + 27, r: cx + cW };
        // Đường nối container ← image
        const ip = imgPos[c.imageId];
        if (ip) {
          ctx.strokeStyle = st === 'run' ? 'rgba(56,189,248,0.4)' : 'rgba(100,116,139,0.25)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(ip.x, ip.y); ctx.bezierCurveTo(ip.x + 20, ip.y, cx - 20, cy + 27, cx, cy + 27); ctx.stroke();
        }
      });
      y += gh + 10;
    });
    if (!S.containers.length) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText(narrow ? 'Chưa có container' : 'Chưa có container — thử docker run hello-world', midX + 4, 40); }

    // Cột volume và đường nối mount
    vols.slice(0, 8).forEach((v, i) => {
      const vx = w - volW - 4, vy = 26 + i * 36;
      App.rrect(ctx, vx, vy, volW, 28, 8, 'rgba(192,132,252,0.10)', 'rgba(192,132,252,0.42)');
      ctx.fillStyle = '#e9d5ff'; ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, '🗄 ' + v.name, volW - 12), vx + 8, vy + 14);
      S.containers.forEach((c) => c.mounts.forEach((m) => {
        if (m.type !== 'volume' || m.source !== v.name || !pos[c.id]) return;
        const p = pos[c.id];
        ctx.strokeStyle = 'rgba(192,132,252,0.45)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(p.r, p.y); ctx.bezierCurveTo(p.r + 20, p.y, vx - 20, vy + 14, vx, vy + 14); ctx.stroke(); ctx.setLineDash([]);
      }));
    });
    return Math.max(y, 26 + imgs.length * 32, 26 + vols.length * 36) + 8;
  };
  App.fmtBytes = (b) => (window.DevOpsSim ? window.DevOpsSim.shell.fmtSize(b) : Math.round(b / 1e6) + 'MB');

  // ---------- Sơ đồ lớp của lần build gần nhất + so sánh kích thước các image đã build ----------
  App.layerDiagram = function (cv, engine) {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const b = engine.builds[engine.builds.length - 1];
    const narrow = w < 560;
    const leftW = narrow ? w : w * 0.56;
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText(b ? `LỚP CỦA LẦN BUILD GẦN NHẤT${b.tag ? ' — ' + b.tag : ''}` : 'LỚP IMAGE', 8, 12);
    if (!b) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText('Chạy docker build -t myapp:v1 . để xem từng lớp', 8, 40); return; }
    const steps = b.steps.slice();
    const rowH = Math.min(30, (h - 70) / Math.max(1, steps.length + 1));
    const maxS = Math.max(1, ...steps.map((s) => s.size));
    // Lớp gốc ở dưới cùng, các bước xếp chồng lên trên đúng như cấu trúc image
    const base = h - 18 - rowH;
    App.rrect(ctx, 8, base, leftW - 16, rowH - 4, 6, 'rgba(100,116,139,0.18)', 'rgba(100,116,139,0.4)');
    ctx.fillStyle = '#cbd5e1'; ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('FROM — các lớp của image gốc', 16, base + rowH / 2 - 2);
    steps.forEach((s, i) => {
      const y = base - (i + 1) * rowH;
      const c = s.cached ? ['rgba(45,212,191,0.12)', 'rgba(45,212,191,0.5)', '#5eead4'] : ['rgba(251,146,60,0.12)', 'rgba(251,146,60,0.55)', '#fdba74'];
      App.rrect(ctx, 8, y, leftW - 16, rowH - 4, 6, c[0], c[1]);
      const bw = Math.max(2, ((leftW - 16) * 0.3) * Math.sqrt(s.size / maxS));
      ctx.fillStyle = c[1]; ctx.globalAlpha = 0.35; ctx.fillRect(leftW - 8 - bw, y, bw, rowH - 4); ctx.globalAlpha = 1;
      ctx.fillStyle = c[2]; ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillText(s.cached ? 'CACHED' : 'BUILD', 14, y + rowH / 2 - 2);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, s.text, leftW - 150), 66, y + rowH / 2 - 2);
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.fillText(App.fmtBytes(s.size), leftW - 14, y + rowH / 2 - 2); ctx.textAlign = 'left';
    });
    if (!b.ok) { ctx.fillStyle = '#fca5a5'; ctx.font = '600 12px "Be Vietnam Pro"'; ctx.fillText(`✖ Build lỗi${b.errorLine ? ' ở dòng ' + b.errorLine : ''}`, 8, 30); }
    if (narrow) return;
    // Bên phải: so sánh kích thước các image đã build (mỗi tag lấy lần build cuối)
    const rx = leftW + 16, rw = w - rx - 8;
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText('KÍCH THƯỚC IMAGE ĐÃ BUILD', rx, 12);
    const seen = {};
    engine.builds.forEach((x) => { if (x.ok && x.tag) seen[x.tag] = x.size; });
    const list = Object.entries(seen).slice(-8);
    const mx = Math.max(1, ...list.map((x) => x[1]));
    list.forEach(([tag, size], i) => {
      const y = 30 + i * 34;
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, tag, rw - 70), rx, y + 6);
      ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.fillText(App.fmtBytes(size), rx + rw, y + 6); ctx.textAlign = 'left';
      const g = ctx.createLinearGradient(rx, 0, rx + rw, 0); g.addColorStop(0, '#2496ed'); g.addColorStop(1, '#2dd4bf');
      App.rrect(ctx, rx, y + 14, rw, 8, 4, 'rgba(255,255,255,0.06)');
      App.rrect(ctx, rx, y + 14, Math.max(4, (rw * size) / mx), 8, 4, g);
    });
  };

  // ---------- Sơ đồ cluster Kubernetes: Ingress → Service → Pod trên từng node ----------
  // Màu Pod theo trạng thái; dải màu bên trái theo nhãn app để phân biệt các Deployment khác nhau
  const K8S_COL = { ok: '#34d399', wait: '#fbbf24', boot: '#38bdf8', bad: '#f87171', gone: '#64748b' };
  const podCol = (v) => {
    if (v.status === 'Terminating' || v.status === 'Completed') return 'gone';
    if (/Err|BackOff|OOM|Error|ConfigError/.test(v.status)) return 'bad';
    if (v.status === 'Running') return v.ready ? 'ok' : 'wait';
    return 'boot';
  };
  const appHue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  App.k8sDiagram = function (cv, engine, t = 0) {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    const narrow = w < 520;
    const ns = engine.state.ns;
    const deps = engine.list('Deployment');
    const stss = engine.list('StatefulSet');
    const jobs = engine.list('Job');
    const hpas = engine.list('HorizontalPodAutoscaler');
    const svcs = engine.list('Service').filter((s) => s.metadata.name !== 'kubernetes');
    const ings = engine.list('Ingress', null);
    const pods = engine.list('Pod').filter((p) => !p.sim.system);
    const label = (txt, x, y) => { ctx.font = '600 10.5px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = 'rgba(154,164,189,0.85)'; ctx.fillText(txt, x, y); };
    // Hình trụ nhỏ tượng trưng ổ đĩa PVC
    const cyl = (x, y, cw, ch, col) => {
      ctx.strokeStyle = col; ctx.fillStyle = col + '33'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x + cw / 2, y + 2, cw / 2, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + ch - 2); ctx.ellipse(x + cw / 2, y + ch - 2, cw / 2, 2, 0, Math.PI, 0, true); ctx.lineTo(x + cw, y + 2); ctx.fill(); ctx.stroke();
    };

    // Cột trái (màn rộng): Deployment, StatefulSet, Job (+ HPA, Helm) — "mong muốn" so với "thực tế"
    const leftW = narrow ? 0 : Math.min(220, w * 0.26);
    let y = 8;
    if (!narrow) {
      ctx.font = '600 10.5px "Be Vietnam Pro", sans-serif';
      label(fit(ctx, 'WORKLOAD (mong muốn → thực tế)', leftW - 12), 8, 12);
      y = 26;
      const items = [...deps.map((o) => ({ k: 'deploy', o })), ...stss.map((o) => ({ k: 'sts', o })), ...jobs.map((o) => ({ k: 'job', o }))];
      const maxItems = Math.max(1, Math.floor((h - 30) / 56));
      items.slice(0, maxItems).forEach(({ k, o: d }) => {
        const c0 = d.spec.template.spec.containers[0];
        const rel = (d.metadata.annotations || {})['meta.helm.sh/release-name'];
        let ready, desired, okAll, sub;
        if (k === 'deploy') { const v = engine.depView(d); ready = v.ready; desired = v.desired; okAll = v.ready === v.desired && v.total === v.desired; const rev = d.metadata.annotations['deployment.kubernetes.io/revision']; sub = `${c0.image}${rev ? ' · rev ' + rev : ''}`; }
        else if (k === 'sts') { const v = engine.stsView(d); ready = v.ready; desired = v.desired; okAll = v.ready === v.desired && v.total === v.desired; const n = (d.spec.volumeClaimTemplates || []).length ? engine.list('PersistentVolumeClaim').filter((c) => (d.spec.volumeClaimTemplates || []).some((t) => c.metadata.name.startsWith(`${t.metadata.name}-${d.metadata.name}-`))).length : 0; sub = `sts · ${c0.image}${n ? ` · PVC×${n}` : ''}`; }
        else { const v = engine.jobView(d); ready = v.succeeded; desired = v.completions; okAll = v.status === 'Complete'; sub = `job · ${v.status} · ${c0.image}`; }
        const hpa = k === 'deploy' && hpas.find((x) => x.spec.scaleTargetRef.name === d.metadata.name);
        const bh = hpa ? 66 : 48;
        const bad = k === 'job' && engine.jobView(d).status === 'Failed';
        App.rrect(ctx, 6, y, leftW - 12, bh, 9, 'rgba(50,108,229,0.10)', bad ? 'rgba(248,113,113,0.6)' : okAll ? 'rgba(50,108,229,0.45)' : 'rgba(251,191,36,0.55)');
        ctx.fillStyle = `hsl(${appHue((d.spec.template.metadata.labels || {}).app || d.metadata.name)},70%,62%)`;
        ctx.fillRect(6, y + 8, 3, bh - 16);
        ctx.fillStyle = '#e8eefc'; ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
        ctx.fillText(fit(ctx, `${rel ? '⛵ ' : ''}${d.metadata.name}`, leftW - 80), 16, y + 14);
        ctx.textAlign = 'right'; ctx.fillStyle = bad ? '#fca5a5' : okAll ? '#86efac' : '#fde68a'; ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.fillText(`${ready}/${desired}`, leftW - 14, y + 14); ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.fillText(fit(ctx, sub, leftW - 30), 16, y + 32);
        if (hpa) {
          const m = hpa.sim.m || {};
          const util = m.util === undefined ? null : m.util;
          ctx.fillStyle = '#c4b5fd'; ctx.fillText(fit(ctx, `HPA ${hpa.spec.minReplicas || 1}–${hpa.spec.maxReplicas} · CPU ${util === null ? '?' : util + '%'}/${m.target || '?'}%`, leftW - 30), 16, y + 50);
          // Thanh tải CPU so với ngưỡng
          if (util !== null) { const bw = leftW - 32, f = Math.min(1, util / Math.max(1, (m.target || 50) * 2)); App.rrect(ctx, 16, y + 58, bw, 4, 2, 'rgba(255,255,255,0.06)'); App.rrect(ctx, 16, y + 58, Math.max(3, bw * f), 4, 2, util > (m.target || 50) ? '#f87171' : '#a78bfa'); }
        }
        y += bh + 8;
      });
      if (items.length > maxItems) { ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px "Be Vietnam Pro"'; ctx.fillText(`+${items.length - maxItems} workload khác`, 10, y + 4); }
      if (!items.length) { ctx.fillStyle = '#64748b'; ctx.font = '11.5px "Be Vietnam Pro"'; ctx.fillText('Chưa có Deployment', 10, 40); }
    }

    const x0 = leftW ? leftW + 14 : 6, aw = w - x0 - 6;
    let ry = 8;
    // Hàng Ingress
    const ingPos = {};
    if (ings.length) {
      label('INGRESS (cổng vào từ bên ngoài, :80)', x0, ry + 4);
      ry += 14;
      const iw = Math.min(260, (aw - 8 * (ings.length - 1)) / ings.length);
      ings.forEach((ing, i) => {
        const ix = x0 + i * (iw + 8);
        App.rrect(ctx, ix, ry, iw, 26, 13, 'rgba(244,114,182,0.10)', 'rgba(244,114,182,0.5)');
        const hosts = (ing.spec.rules || []).map((r) => r.host || '*').join(', ');
        ctx.fillStyle = '#fbcfe8'; ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(fit(ctx, `${ing.metadata.name} · ${hosts}`, iw - 18), ix + 10, ry + 13);
        ingPos[ing.metadata.name] = { x: ix + iw / 2, y: ry + 26, ing };
      });
      ry += 40;
    }
    // Hàng Service
    const svcPos = {};
    label(narrow ? 'SERVICE' : 'SERVICE (địa chỉ ổn định, chia tải cho Pod sẵn sàng)', x0, ry + 4);
    ry += 14;
    if (svcs.length) {
      const sw = Math.min(230, (aw - 8 * (svcs.length - 1)) / svcs.length);
      svcs.slice(0, 6).forEach((s, i) => {
        const sx = x0 + i * (sw + 8);
        const eps = engine.endpoints(s).length;
        App.rrect(ctx, sx, ry, sw, 30, 15, 'rgba(45,212,191,0.10)', eps ? 'rgba(45,212,191,0.55)' : 'rgba(248,113,113,0.55)');
        ctx.fillStyle = '#ccfbf1'; ctx.font = '700 11.5px "JetBrains Mono", monospace';
        const np = s.spec.type === 'NodePort' ? ` :${s.spec.ports[0].nodePort}` : '';
        ctx.fillText(fit(ctx, `${s.metadata.name}${np}`, sw - 56), sx + 12, ry + 15);
        ctx.textAlign = 'right'; ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.fillStyle = eps ? '#5eead4' : '#fca5a5';
        ctx.fillText(`${eps} ep`, sx + sw - 10, ry + 15); ctx.textAlign = 'left';
        svcPos[s.metadata.name] = { x: sx + sw / 2, top: ry, y: ry + 30, s };
      });
      // Ingress → Service
      Object.values(ingPos).forEach((ip) => (ip.ing.spec.rules || []).forEach((r) => ((r.http || {}).paths || []).forEach((pp) => {
        const sp = svcPos[pp.backend && pp.backend.service && pp.backend.service.name];
        if (!sp) return;
        ctx.strokeStyle = 'rgba(244,114,182,0.45)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(ip.x, ip.y); ctx.bezierCurveTo(ip.x, ip.y + 10, sp.x, sp.top - 10, sp.x, sp.top); ctx.stroke();
      })));
    } else { ctx.fillStyle = '#64748b'; ctx.font = '11.5px "Be Vietnam Pro"'; ctx.fillText('Chưa có Service — thử kubectl expose', x0 + 2, ry + 14); }
    ry += 46;

    // Node: control-plane hẹp (chỉ chạy Pod hệ thống) + 2 worker
    const nodes = engine.list('Node');
    const cpW = narrow ? 0 : Math.min(120, aw * 0.16);
    const workers = nodes.filter((n) => n.sim.role !== 'control-plane');
    const ww = (aw - cpW - (cpW ? 10 : 0) - 10 * (workers.length - 1)) / workers.length;
    const nh = h - ry - 6;
    const podPos = {};
    if (cpW) {
      ctx.setLineDash([5, 4]); App.rrect(ctx, x0, ry, cpW, nh, 12, 'rgba(255,255,255,0.02)', 'rgba(148,163,184,0.3)'); ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8'; ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, 'control-plane', cpW - 14), x0 + 8, ry + 13);
      ctx.font = '10.5px "Be Vietnam Pro"'; ctx.fillStyle = '#64748b';
      ['apiserver', 'etcd', 'scheduler', 'controller', 'coredns ×2'].forEach((s, i) => ctx.fillText(fit(ctx, '· ' + s, cpW - 14), x0 + 8, ry + 32 + i * 16));
    }
    workers.forEach((n, wi) => {
      const nx = x0 + cpW + (cpW ? 10 : 0) + wi * (ww + 10);
      ctx.setLineDash([5, 4]); App.rrect(ctx, nx, ry, ww, nh, 12, 'rgba(50,108,229,0.04)', 'rgba(50,108,229,0.4)'); ctx.setLineDash([]);
      ctx.fillStyle = '#93c5fd'; ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillText(`node: ${n.metadata.name}`, nx + 8, ry + 13);
      const mine = pods.filter((p) => p.sim.node === n.metadata.name);
      const cols = ww > 330 ? 2 : 1, cw = (ww - 16 - (cols - 1) * 8) / cols, ch = 38;
      const maxRows = Math.max(1, Math.floor((nh - 28) / (ch + 6)));
      mine.slice(0, cols * maxRows).forEach((p, i) => {
        const v = engine.podView(p);
        const c = podCol(v);
        const px = nx + 8 + (i % cols) * (cw + 8), py = ry + 24 + Math.floor(i / cols) * (ch + 6);
        ctx.globalAlpha = c === 'gone' ? 0.55 : 1;
        App.rrect(ctx, px, py, cw, ch, 8, c === 'ok' ? 'rgba(52,211,153,0.08)' : c === 'bad' ? 'rgba(248,113,113,0.09)' : 'rgba(255,255,255,0.03)', K8S_COL[c] + '88');
        ctx.fillStyle = `hsl(${appHue(p.metadata.labels.app || p.metadata.labels.run || p.metadata.name)},70%,62%)`;
        ctx.fillRect(px, py + 6, 3, ch - 12);
        const pulse = c === 'ok' ? 3.2 + Math.sin(t / 320 + i) * 1.1 : 3.2;
        App.dot(ctx, px + 13, py + 12, pulse, K8S_COL[c]);
        ctx.fillStyle = '#f1f5f9'; ctx.font = '600 11px "JetBrains Mono", monospace';
        const hasPvc = (p.spec.volumes || []).some((x) => x.persistentVolumeClaim);
        ctx.fillText(fit(ctx, p.metadata.name, cw - (hasPvc ? 44 : 30)), px + 22, py + 12);
        if (hasPvc) cyl(px + cw - 16, py + 5, 10, 14, '#c084fc');
        ctx.fillStyle = K8S_COL[c]; ctx.font = '10.5px "JetBrains Mono", monospace';
        const tag = (p.spec.containers[0].image || '').split('/').pop();
        ctx.fillText(fit(ctx, `${v.status}${v.restarts ? ' ↻' + v.restarts : ''} · ${tag}`, cw - 16), px + 9, py + 28);
        ctx.globalAlpha = 1;
        podPos[p.metadata.name] = { x: px + cw / 2, y: py };
      });
      if (mine.length > cols * maxRows) { ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px "Be Vietnam Pro"'; ctx.fillText(`+${mine.length - cols * maxRows} Pod khác`, nx + 10, ry + nh - 10); }
    });
    if (!pods.length) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText('Chưa có Pod nào — thử kubectl run web --image=nginx', x0 + cpW + 20, ry + 44); }

    // Service → endpoint (chỉ Pod READY); có chấm sáng chạy dọc dây khi vừa có request đi qua
    const now = engine.now();
    const recent = engine.state.requests.filter((r) => r.t && now - r.t < 1500 && r.pod);
    Object.values(svcPos).forEach((sp) => engine.endpoints(sp.s).forEach((pd) => {
      const pp = podPos[pd.metadata.name];
      if (!pp) return;
      ctx.strokeStyle = 'rgba(45,212,191,0.28)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.bezierCurveTo(sp.x, sp.y + 24, pp.x, pp.y - 24, pp.x, pp.y); ctx.stroke();
      if (recent.some((r) => r.pod === pd.metadata.name && r.svc === sp.s.metadata.name)) {
        const k = (t % 900) / 900, u = 1 - k;
        const bx = u * u * u * sp.x + 3 * u * u * k * sp.x + 3 * u * k * k * pp.x + k * k * k * pp.x;
        const by = u * u * u * sp.y + 3 * u * u * k * (sp.y + 24) + 3 * u * k * k * (pp.y - 24) + k * k * k * pp.y;
        App.dot(ctx, bx, by, 3.5, '#5eead4');
      }
    }));
  };

  // ---------- Khung chung cho bài DevOps: engine + terminal + sơ đồ + nút đặt lại ----------
  // Trả về { engine, term, cv, editor }; lesson.state luôn trỏ tới engine hiện tại để lab tự kiểm tra
  // engine: 'docker' | 'kube' — chọn bộ mô phỏng; diagram: 'docker' | 'layers' | 'k8s'
  const LEGENDS = {
    docker: '<div class="dv-legend"><span style="--c:#34d399">Đang chạy</span><span style="--c:#64748b">Đã dừng (mã 0)</span><span style="--c:#f87171">Lỗi (mã ≠ 0)</span><span style="--c:#38bdf8">Image</span><span style="--c:#c084fc">Volume</span></div>',
    layers: '<div class="dv-legend"><span style="--c:#2dd4bf">Lấy từ cache</span><span style="--c:#fb923c">Build lại</span><span style="--c:#64748b">Lớp của image gốc</span></div>',
    k8s: '<div class="dv-legend"><span style="--c:#34d399">Running · sẵn sàng</span><span style="--c:#fbbf24">Running · chưa sẵn sàng</span><span style="--c:#38bdf8">Đang khởi tạo</span><span style="--c:#f87171">Lỗi</span><span style="--c:#64748b">Đang xóa / xong</span><span style="--c:#2dd4bf">Service</span><span style="--c:#f472b6">Ingress</span><span style="--c:#c084fc">Ổ đĩa PVC</span></div>',
  };
  App.dvSetup = function (sim, ctx, lesson, { files = {}, editFiles = null, chips = [], welcome = [], diagram = 'docker', engine: kind = 'docker', title, height = 300, cvHeight = 300 } = {}) {
    const top = App.h(`<div class="sim-top"><h2>${title || (kind === 'kube' ? '☸️ Cluster thực hành' : '🐳 Môi trường thực hành')}</h2><button class="btn small ghost" type="button" id="reset-env-${lesson.id}">↺ Đặt lại môi trường</button></div>`);
    sim.classList.add('dv-sim');
    sim.appendChild(top);
    const holder = { engine: null, term: null, editor: null };
    const cvBox = document.createElement('div');
    const cv = ctx.canvas(cvBox, { height: cvHeight });
    const termBox = document.createElement('div');
    const edBox = document.createElement('div');
    sim.appendChild(cvBox);
    if (editFiles) { const split = App.h('<div class="dv-split"></div>'); split.appendChild(edBox); split.appendChild(termBox); sim.appendChild(split); } else sim.appendChild(termBox);
    cvBox.appendChild(App.h(LEGENDS[diagram] || LEGENDS.docker));

    function boot() {
      if (holder.editor) holder.editor.destroy();
      edBox.innerHTML = ''; termBox.innerHTML = '';
      const opts = { seed: 7, files: JSON.parse(JSON.stringify(files)) };
      const engine = kind === 'kube' ? window.DevOpsSim.createKube(opts) : window.DevOpsSim.createDocker(opts);
      holder.engine = engine;
      lesson.state = engine;
      holder.term = App.terminal(termBox, { engine, chips, welcome, height, title: kind === 'kube' ? 'Terminal — máy có kubectl, nối tới cluster kind "lab"' : undefined });
      if (editFiles) holder.editor = App.fileEditor(edBox, { engine, files: editFiles });
    }
    boot();
    top.querySelector('button').addEventListener('click', () => { boot(); App.toast('Đã đặt lại môi trường lab về trạng thái ban đầu.'); });
    // Đồng hồ thật: container "sleep N" tự kết thúc, controller K8s tự hòa giải (tạo lại Pod, HPA...)
    ctx.interval(() => holder.engine.tick(), 1000);
    ctx.loop(() => {
      if (!cv.w) return;
      if (diagram === 'docker') App.dockerDiagram(cv, holder.engine, performance.now());
      else if (diagram === 'k8s') App.k8sDiagram(cv, holder.engine, performance.now());
      else App.layerDiagram(cv, holder.engine);
    });
    ctx.onCleanup(() => holder.editor && holder.editor.destroy());
    return holder;
  };
})();
