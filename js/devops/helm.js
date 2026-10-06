/*
 * helm.js — Lõi Helm mô phỏng: đọc chart từ hệ thống file ảo, trộn values (values.yaml, -f, --set)
 * và dựng manifest bằng tập con của Go template + Sprig (if/else/range/with/define/include, pipe, default, quote, toYaml, nindent...).
 * Lỗi được báo đúng định dạng của Helm 3 (parse error at (file:dòng), nil pointer evaluating...). Không đụng DOM.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./yaml-lite.js'));
    else { const ns = (root.DevOpsSim = root.DevOpsSim || {}); ns.helm = factory(ns.yaml); }
})(typeof self !== 'undefined' ? self : this, function (YAML) {
    'use strict';

    class HelmError extends Error {
        constructor(msg, file, line) { super(msg); this.name = 'HelmError'; this.file = file; this.line = line; }
    }

    // ---------- YAML và chuỗi kiểu Go ----------
    function yamlScalar(x) {
        if (x === null || x === undefined) return 'null';
        if (typeof x !== 'string') return String(x);
        if (x === '') return '""';
        const plain = /^[\w./@-][\w ./@:=-]*$/.test(x) && !/^(true|false|null|yes|no|on|off|~)$/i.test(x) && !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(x) && !/: |:$|\s$/.test(x);
        return plain ? x : JSON.stringify(x);
    }
    // Giống sigs.k8s.io/yaml mà Helm dùng: khóa sắp theo bảng chữ cái, mảng thẳng cột với khóa cha
    function toYaml(v, indent = 0) {
        const pad = ' '.repeat(indent), out = [];
        const isObj = (x) => x && typeof x === 'object';
        if (Array.isArray(v)) {
            if (!v.length) return [pad + '[]'];
            v.forEach((it) => {
                if (isObj(it) && !Array.isArray(it) && Object.keys(it).length) { const sub = toYaml(it, indent + 2); out.push(pad + '- ' + sub[0].trimStart(), ...sub.slice(1)); }
                else out.push(pad + '- ' + (isObj(it) ? (Array.isArray(it) ? '[]' : '{}') : yamlScalar(it)));
            });
            return out;
        }
        if (!isObj(v)) return [pad + yamlScalar(v)];
        const keys = Object.keys(v).sort();
        if (!keys.length) return [pad + '{}'];
        keys.forEach((k) => {
            const x = v[k];
            const key = /^[\w./-]+$/.test(k) ? k : JSON.stringify(k);
            if (typeof x === 'string' && x.includes('\n')) { out.push(`${pad}${key}: |`); x.replace(/\n$/, '').split('\n').forEach((l) => out.push(pad + '  ' + l)); }
            else if (isObj(x) && (Array.isArray(x) ? x.length : Object.keys(x).length)) { out.push(`${pad}${key}:`); out.push(...toYaml(x, Array.isArray(x) ? indent : indent + 2)); }
            else if (isObj(x)) out.push(`${pad}${key}: ${Array.isArray(x) ? '[]' : '{}'}`);
            else out.push(`${pad}${key}: ${yamlScalar(x)}`);
        });
        return out;
    }
    // In giá trị như fmt.Sprint của Go: map[a:1 b:2], [x y]
    function goString(v) {
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return '[' + v.map(goString).join(' ') + ']';
        if (typeof v === 'object') return 'map[' + Object.keys(v).sort().map((k) => `${k}:${goString(v[k])}`).join(' ') + ']';
        return String(v);
    }
    const truthy = (v) => !(v === undefined || v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));
    const indentStr = (n, s) => String(s).split('\n').map((l) => ' '.repeat(n) + l).join('\n');
    const b64 = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s).toString('base64'));
    const unb64 = (s) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString());

    // ---------- Hàm Sprig/Go template được hỗ trợ ----------
    const FUNCS = {
        default: (d, v) => (truthy(v) ? v : d),
        quote: (...a) => a.map((x) => JSON.stringify(goString(x))).join(' '),
        squote: (...a) => a.map((x) => `'${goString(x)}'`).join(' '),
        upper: (s) => goString(s).toUpperCase(),
        lower: (s) => goString(s).toLowerCase(),
        title: (s) => goString(s).replace(/\b\w/g, (c) => c.toUpperCase()),
        trim: (s) => goString(s).trim(),
        trunc: (n, s) => goString(s).slice(0, n),
        trimSuffix: (x, s) => { s = goString(s); return s.endsWith(x) ? s.slice(0, s.length - x.length) : s; },
        trimPrefix: (x, s) => { s = goString(s); return s.startsWith(x) ? s.slice(x.length) : s; },
        replace: (o, n, s) => goString(s).split(o).join(n),
        nindent: (n, s) => '\n' + indentStr(n, goString(s)),
        indent: (n, s) => indentStr(n, goString(s)),
        toYaml: (v) => (v === undefined || v === null ? 'null' : toYaml(v).join('\n')),
        toJson: (v) => JSON.stringify(v === undefined ? null : v),
        int: (v) => parseInt(v, 10) || 0,
        toString: (v) => goString(v),
        add: (...a) => a.reduce((s, x) => s + (+x || 0), 0),
        sub: (a, b) => (+a || 0) - (+b || 0),
        mul: (...a) => a.reduce((s, x) => s * (+x || 0), 1),
        div: (a, b) => Math.trunc((+a || 0) / (+b || 1)),
        b64enc: (s) => b64(goString(s)),
        b64dec: (s) => unb64(goString(s)),
        eq: (a, ...b) => b.some((x) => x === a || (typeof x !== 'object' && typeof a !== 'object' && String(x) === String(a) && typeof x === typeof a)),
        ne: (a, b) => a !== b,
        lt: (a, b) => a < b, gt: (a, b) => a > b, le: (a, b) => a <= b, ge: (a, b) => a >= b,
        and: (...a) => { for (const x of a) if (!truthy(x)) return x; return a[a.length - 1]; },
        or: (...a) => { for (const x of a) if (truthy(x)) return x; return a[a.length - 1]; },
        not: (a) => !truthy(a),
        empty: (a) => !truthy(a),
        contains: (x, s) => goString(s).includes(x),
        hasKey: (m, k) => !!m && Object.prototype.hasOwnProperty.call(m, k),
        list: (...a) => a,
        dict: (...a) => { const o = {}; for (let i = 0; i + 1 < a.length; i += 2) o[a[i]] = a[i + 1]; return o; },
        len: (v) => (v ? (typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : v.length) : 0),
        printf: (f, ...a) => { let i = 0; return goString(f).replace(/%[-+# 0]*\d*(?:\.\d+)?([sdvqf%])/g, (m, c) => (c === '%' ? '%' : c === 'q' ? JSON.stringify(goString(a[i++])) : goString(a[i++]))); },
        // Ba hàm cần ngữ cảnh (lỗi có vị trí, gọi template đã define) được xử lý riêng trong evalCmd
        required: null, fail: null, include: null, tpl: null,
    };
    const KEYWORDS = new Set(['true', 'false', 'nil']);

    // ---------- Lexer: tách văn bản và {{ action }}, xử lý dấu cắt khoảng trắng {{- và -}} ----------
    function lex(src, file) {
        const out = [];
        let i = 0, line = 1;
        const nl = (s) => (s.match(/\n/g) || []).length;
        while (i < src.length) {
            const j = src.indexOf('{{', i);
            if (j < 0) { out.push({ t: 'text', v: src.slice(i) }); break; }
            out.push({ t: 'text', v: src.slice(i, j) });
            line += nl(src.slice(i, j));
            const k = src.indexOf('}}', j + 2);
            if (k < 0) throw new HelmError(`parse error at (${file}:${line}): unclosed action`, file, line);
            let inner = src.slice(j + 2, k);
            const trimL = /^-\s/.test(inner), trimR = /\s-$/.test(inner);
            if (trimL) inner = inner.slice(1);
            if (trimR) inner = inner.slice(0, -1);
            inner = inner.trim();
            if (!/^\/\*[\s\S]*\*\/$/.test(inner)) out.push({ t: 'act', v: inner, line, trimL, trimR });
            else out.push({ t: 'act', v: '', line, trimL, trimR, comment: true });
            line += nl(src.slice(j, k + 2));
            i = k + 2;
        }
        for (let n = 0; n < out.length; n++) {
            const tk = out[n];
            if (tk.t !== 'act') continue;
            if (tk.trimL && out[n - 1] && out[n - 1].t === 'text') out[n - 1].v = out[n - 1].v.replace(/\s+$/, '');
            if (tk.trimR && out[n + 1] && out[n + 1].t === 'text') out[n + 1].v = out[n + 1].v.replace(/^\s+/, '');
        }
        return out.filter((tk) => !tk.comment);
    }

    // Tách theo ký tự phân cách ở cấp ngoài cùng (bỏ qua trong nháy và ngoặc)
    function splitTop(s, isSep) {
        const out = [];
        let cur = '', q = null, depth = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (q) { cur += c; if (c === '\\' && q === '"') { cur += s[++i] || ''; continue; } if (c === q) q = null; continue; }
            if (c === '"' || c === '`' || c === "'") { q = c; cur += c; continue; }
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (depth === 0 && isSep(c)) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
            cur += c;
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    }
    const pipes = (s) => splitTop(s, (c) => c === '|');
    const words = (s) => splitTop(s, (c) => /\s/.test(c));

    // Kiểm tra lúc parse: tên hàm không tồn tại là lỗi ngay cả khi nhánh if không chạy (giống Go template)
    function checkFuncs(expr, file, line, defines) {
        const m = expr.match(/^\$[\w]*\s*:?=\s*([\s\S]*)$/);
        const body = m ? m[1] : expr;
        pipes(body).forEach((cmd) => {
            const w = words(cmd);
            w.forEach((x, i) => {
                if (x.startsWith('(') && x.endsWith(')')) checkFuncs(x.slice(1, -1), file, line, defines);
                else if (/^[A-Za-z_]\w*$/.test(x) && !KEYWORDS.has(x) && !(x in FUNCS)) throw new HelmError(`parse error at (${file}:${line}): function "${x}" not defined`, file, line);
                else if (i === 0 && /^[A-Za-z_]\w*$/.test(x)) { /* hàm hợp lệ */ }
            });
        });
    }

    // ---------- Parser: dựng cây if/range/with/define ----------
    function parse(tokens, file, defines) {
        let pos = 0;
        const kw = (tk) => tk.v.split(/\s+/)[0];
        function block(ends) {
            const nodes = [];
            while (pos < tokens.length) {
                const tk = tokens[pos];
                if (tk.t === 'text') { if (tk.v) nodes.push(tk); pos++; continue; }
                const k = kw(tk);
                if (ends.includes(k)) return { nodes, end: tk };
                pos++;
                if (k === 'if') nodes.push(parseIf(tk.v.slice(2).trim(), tk.line));
                else if (k === 'range' || k === 'with') {
                    const expr = tk.v.slice(k.length).trim();
                    checkFuncs(expr.replace(/^(\$\w*\s*,\s*)?\$\w*\s*:=\s*/, ''), file, tk.line, defines);
                    const a = block(['else', 'end']);
                    if (!a.end) throw new HelmError(`parse error at (${file}:${tk.line}): unexpected EOF`, file, tk.line);
                    pos++;
                    let els = null;
                    if (kw(a.end) === 'else') { const b = block(['end']); if (!b.end) throw new HelmError(`parse error at (${file}:${tk.line}): unexpected EOF`, file, tk.line); pos++; els = b.nodes; }
                    nodes.push({ t: k, expr, body: a.nodes, els, line: tk.line });
                } else if (k === 'define') {
                    const name = (tk.v.match(/^define\s+"([^"]+)"/) || [])[1];
                    const a = block(['end']);
                    if (!a.end) throw new HelmError(`parse error at (${file}:${tk.line}): unexpected EOF`, file, tk.line);
                    pos++;
                    if (name) defines[name] = { nodes: a.nodes, file };
                } else if (k === 'end' || k === 'else') throw new HelmError(`parse error at (${file}:${tk.line}): unexpected {{${k}}}`, file, tk.line);
                else if (k === 'template') nodes.push({ t: 'act', v: 'include ' + tk.v.slice(8).trim(), line: tk.line });
                else { checkFuncs(tk.v, file, tk.line, defines); nodes.push(tk); }
            }
            return { nodes, end: null };
        }
        function parseIf(cond, line) {
            checkFuncs(cond, file, line, defines);
            const a = block(['else', 'end']);
            if (!a.end) throw new HelmError(`parse error at (${file}:${line}): unexpected EOF`, file, line);
            pos++;
            if (kw(a.end) === 'end') return { t: 'if', cond, then: a.nodes, els: null, line };
            const m = a.end.v.match(/^else\s+if\s+([\s\S]+)$/);
            if (m) return { t: 'if', cond, then: a.nodes, els: [parseIf(m[1], a.end.line)], line };
            const b = block(['end']);
            if (!b.end) throw new HelmError(`parse error at (${file}:${line}): unexpected EOF`, file, line);
            pos++;
            return { t: 'if', cond, then: a.nodes, els: b.nodes, line };
        }
        const r = block([]);
        return r.nodes;
    }

    // ---------- Thực thi ----------
    function exec(nodes, ctx) {
        let out = '';
        for (const n of nodes) {
            if (n.t === 'text') out += n.v;
            else if (n.t === 'act') {
                const m = n.v.match(/^(\$\w*)\s*:?=\s*([\s\S]*)$/);
                if (m) { ctx.vars[m[1]] = pipeline(m[2], ctx, n.line); continue; }
                if (!n.v) continue;
                out += goString(pipeline(n.v, ctx, n.line));
            } else if (n.t === 'if') out += truthy(pipeline(n.cond, ctx, n.line)) ? exec(n.then, ctx) : n.els ? exec(n.els, ctx) : '';
            else if (n.t === 'with') {
                const v = pipeline(n.expr, ctx, n.line);
                out += truthy(v) ? exec(n.body, Object.assign({}, ctx, { dot: v })) : n.els ? exec(n.els, ctx) : '';
            } else if (n.t === 'range') {
                const m = n.expr.match(/^(?:(\$\w*)\s*,\s*)?(\$\w*)\s*:=\s*([\s\S]+)$/);
                const coll = pipeline(m ? m[3] : n.expr, ctx, n.line);
                const items = Array.isArray(coll) ? coll.map((v, i) => [i, v]) : coll && typeof coll === 'object' ? Object.keys(coll).sort().map((k) => [k, coll[k]]) : typeof coll === 'number' ? Array.from({ length: coll }, (_, i) => [i, i]) : [];
                if (!items.length) { if (n.els) out += exec(n.els, ctx); continue; }
                items.forEach(([k, v]) => {
                    const c2 = Object.assign({}, ctx, { dot: v, vars: Object.assign({}, ctx.vars) });
                    if (m) { if (m[1]) { c2.vars[m[1]] = k; c2.vars[m[2]] = v; } else c2.vars[m[2]] = v; }
                    out += exec(n.body, c2);
                });
            }
        }
        return out;
    }
    function pipeline(expr, ctx, line) {
        let val, has = false;
        for (const cmd of pipes(expr)) { val = evalCmd(words(cmd), ctx, line, has ? [val] : [], expr); has = true; }
        return val;
    }
    function evalCmd(w, ctx, line, piped, whole) {
        const name = w[0];
        if (/^[A-Za-z_]\w*$/.test(name) && !KEYWORDS.has(name)) {
            const args = w.slice(1).map((a) => evalArg(a, ctx, line)).concat(piped);
            if (name === 'required') { if (!truthy(args[1])) throw new HelmError(`execution error at (${ctx.file}:${line}): ${goString(args[0])}`, ctx.file, line); return args[1]; }
            if (name === 'fail') throw new HelmError(`execution error at (${ctx.file}:${line}): ${goString(args[0])}`, ctx.file, line);
            if (name === 'include') { const d = ctx.defines[args[0]]; if (!d) throw new HelmError(`template: ${ctx.file}:${line}: error calling include: template: no template "${args[0]}" associated with template "gotpl"`, ctx.file, line); return exec(d.nodes, Object.assign({}, ctx, { dot: args[1], vars: {} })); }
            if (name === 'tpl') return render1(goString(args[0]), ctx.file, Object.assign({}, ctx, { dot: args[1] }));
            if (name === 'default' && args.length < 2) return args[0];
            return FUNCS[name](...args);
        }
        if (w.length > 1 || piped.length) throw new HelmError(`template: ${ctx.file}:${line}: executing "${ctx.file}" at <${w[0]}>: can't give argument to non-function ${w[0]}`, ctx.file, line);
        return evalArg(name, ctx, line);
    }
    function evalArg(a, ctx, line) {
        if (a.startsWith('(') && a.endsWith(')')) return pipeline(a.slice(1, -1), ctx, line);
        if (a[0] === '"') return JSON.parse(a);
        if (a[0] === '`') return a.slice(1, -1);
        if (/^-?\d+$/.test(a)) return parseInt(a, 10);
        if (/^-?\d*\.\d+$/.test(a)) return parseFloat(a);
        if (a === 'true') return true;
        if (a === 'false') return false;
        if (a === 'nil') return null;
        if (a === '.') return ctx.dot;
        let base, path;
        if (a.startsWith('$')) { const m = a.match(/^(\$\w*)(.*)$/); base = m[1] === '$' ? ctx.root : ctx.vars[m[1]]; path = m[2]; if (m[1] !== '$' && !(m[1] in ctx.vars)) throw new HelmError(`parse error at (${ctx.file}:${line}): undefined variable "${m[1]}"`, ctx.file, line); }
        else if (a.startsWith('.')) { base = ctx.dot; path = a; }
        else throw new HelmError(`parse error at (${ctx.file}:${line}): unexpected "${a}" in command`, ctx.file, line);
        const keys = path.split('.').filter(Boolean);
        let v = base;
        for (let i = 0; i < keys.length; i++) {
            if (v === undefined || v === null) throw new HelmError(`template: ${ctx.file}:${line}: executing "${ctx.file}" at <${a}>: nil pointer evaluating interface {}.${keys[i]}`, ctx.file, line);
            v = typeof v === 'object' ? v[keys[i]] : undefined;
        }
        return v;
    }
    function render1(src, file, ctx) {
        const nodes = parse(lex(src, file), file, ctx.defines);
        return exec(nodes, Object.assign({}, ctx, { file, vars: {} }));
    }

    // ---------- Values ----------
    const isMap = (x) => x && typeof x === 'object' && !Array.isArray(x);
    function deepMerge(base, over) {
        const out = isMap(base) ? JSON.parse(JSON.stringify(base)) : {};
        Object.entries(over || {}).forEach(([k, v]) => { out[k] = isMap(v) && isMap(out[k]) ? deepMerge(out[k], v) : v === null ? undefined : JSON.parse(JSON.stringify(v)); if (out[k] === undefined) delete out[k]; });
        return out;
    }
    // --set a.b=1,c=x: chỉ số nguyên, true/false/null được đổi kiểu (giống strvals của Helm); "2.0" vẫn là chuỗi
    function parseSet(str, asString) {
        const out = {};
        const parts = splitTop(String(str), (c) => c === ',');
        for (const p of parts) {
            const i = p.indexOf('=');
            if (i <= 0) throw new HelmError(`failed parsing --set data: key "${p}" has no value`);
            const key = p.slice(0, i), raw = p.slice(i + 1);
            let val = raw;
            if (!asString) { if (raw === 'true') val = true; else if (raw === 'false') val = false; else if (raw === 'null') val = null; else if (/^(0|-?[1-9]\d*)$/.test(raw)) val = parseInt(raw, 10); }
            const path = key.split('.');
            let o = out;
            path.forEach((k, j) => {
                const am = k.match(/^(.+)\[(\d+)\]$/);
                if (am) { o[am[1]] = o[am[1]] || []; if (j === path.length - 1) o[am[1]][+am[2]] = val; else o = o[am[1]][+am[2]] = o[am[1]][+am[2]] || {}; return; }
                if (j === path.length - 1) o[k] = val; else o = o[k] = isMap(o[k]) ? o[k] : {};
            });
        }
        return out;
    }

    // ---------- Chart ----------
    function loadChart(files, ref) {
        const dir = String(ref).replace(/^\.\//, '').replace(/\/+$/, '');
        const keys = Object.keys(files).filter((k) => k.startsWith(dir + '/'));
        if (!keys.length) return { error: `path "${ref}" not found` };
        const cy = files[dir + '/Chart.yaml'];
        if (typeof cy !== 'string') return { error: `Chart.yaml file is missing` };
        let meta, values;
        try { meta = YAML.parse(cy) || {}; } catch (e) { return { error: `cannot load Chart.yaml: error converting YAML to JSON: ${e.message}` }; }
        if (!meta.name) return { error: 'validation: chart.metadata.name is required' };
        if (!meta.version) return { error: 'validation: chart.metadata.version is required' };
        const vt = files[dir + '/values.yaml'] || '';
        try { values = YAML.parse(vt) || {}; } catch (e) { return { error: `cannot load values.yaml: error converting YAML to JSON: ${e.message}`, file: dir + '/values.yaml', line: e.line }; }
        const templates = {};
        keys.filter((k) => k.startsWith(dir + '/templates/')).forEach((k) => (templates[k] = files[k]));
        return { name: String(meta.name), version: String(meta.version), appVersion: meta.appVersion === undefined ? '' : String(meta.appVersion), description: meta.description || '', dir, values, valuesText: vt, templates };
    }

    // Thứ tự cài của Helm (InstallOrder) để Namespace/ConfigMap có trước Deployment...
    const ORDER = ['Namespace', 'ServiceAccount', 'Secret', 'ConfigMap', 'StorageClass', 'PersistentVolume', 'PersistentVolumeClaim', 'ClusterRole', 'ClusterRoleBinding', 'Role', 'RoleBinding', 'Service', 'Pod', 'ReplicaSet', 'Deployment', 'HorizontalPodAutoscaler', 'StatefulSet', 'Job', 'Ingress'];
    const rank = (k) => { const i = ORDER.indexOf(k); return i < 0 ? ORDER.length : i; };

    // Dựng toàn bộ chart → { manifests:[{ source, doc }], notes } hoặc ném HelmError
    function render(chart, { values, release }) {
        const top = {
            Values: values,
            Release: Object.assign({ Service: 'Helm', IsInstall: release.Revision === 1, IsUpgrade: release.Revision > 1 }, release),
            Chart: { Name: chart.name, Version: chart.version, AppVersion: chart.appVersion, Description: chart.description },
            Capabilities: { KubeVersion: { Version: 'v1.31.0', Major: '1', Minor: '31' } },
        };
        const defines = {};
        const parsed = Object.keys(chart.templates).sort().map((f) => ({ f, nodes: parse(lex(chart.templates[f], f), f, defines) }));
        const manifests = [];
        let notes = '';
        parsed.forEach(({ f, nodes }) => {
            const base = f.split('/').pop();
            if (base.startsWith('_')) return;
            const ctx = { root: top, dot: Object.assign({}, top, { Template: { Name: f, BasePath: chart.dir + '/templates' } }), vars: {}, file: f, defines };
            ctx.root = ctx.dot;
            const text = exec(nodes, ctx);
            if (base === 'NOTES.txt') { notes = text; return; }
            if (!/\.ya?ml$/.test(base)) return;
            let docs;
            try { docs = YAML.parseAll(text); } catch (e) { throw new HelmError(`YAML parse error on ${f}: error converting YAML to JSON: ${e.message}`, f, e.line); }
            docs.filter((d) => d && typeof d === 'object').forEach((d) => {
                if (!d.kind || !d.apiVersion) throw new HelmError(`unable to build kubernetes objects from release manifest: error validating "": error validating data: ${!d.apiVersion ? 'apiVersion' : 'kind'} not set`, f);
                manifests.push({ source: f, doc: d });
            });
        });
        manifests.sort((a, b) => rank(a.doc.kind) - rank(b.doc.kind));
        return { manifests, notes };
    }
    // Văn bản manifest như "helm template" / "helm get manifest"
    function manifestText(manifests) {
        return manifests.map((m) => `---\n# Source: ${m.source}\n${toYaml(m.doc).join('\n')}`).join('\n');
    }

    // ---------- Kho chart trực tuyến (mô phỏng, không cần Internet) ----------
    const REDIS_CHART = {
        'Chart.yaml': 'apiVersion: v2\nname: redis\ndescription: Redis chạy dạng StatefulSet, có ổ đĩa bền vững\ntype: application\nversion: 1.2.0\nappVersion: "7.4.1"\n',
        'values.yaml': '# Giá trị mặc định của chart vlab/redis\nimage:\n  repository: redis\n  tag: "7"\nreplicaCount: 1\npersistence:\n  enabled: true\n  size: 1Gi\n  storageClass: ""\nresources: {}\n',
        'templates/_helpers.tpl': '{{- define "redis.labels" -}}\napp.kubernetes.io/name: redis\napp.kubernetes.io/instance: {{ .Release.Name }}\n{{- end }}\n',
        'templates/service.yaml': 'apiVersion: v1\nkind: Service\nmetadata:\n  name: {{ .Release.Name }}-redis-headless\n  labels:\n    {{- include "redis.labels" . | nindent 4 }}\nspec:\n  clusterIP: None\n  selector:\n    {{- include "redis.labels" . | nindent 4 }}\n  ports:\n    - name: redis\n      port: 6379\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: {{ .Release.Name }}-redis\n  labels:\n    {{- include "redis.labels" . | nindent 4 }}\nspec:\n  selector:\n    {{- include "redis.labels" . | nindent 4 }}\n  ports:\n    - name: redis\n      port: 6379\n      targetPort: 6379\n',
        'templates/statefulset.yaml': 'apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: {{ .Release.Name }}-redis\n  labels:\n    {{- include "redis.labels" . | nindent 4 }}\nspec:\n  serviceName: {{ .Release.Name }}-redis-headless\n  replicas: {{ .Values.replicaCount }}\n  selector:\n    matchLabels:\n      {{- include "redis.labels" . | nindent 6 }}\n  template:\n    metadata:\n      labels:\n        {{- include "redis.labels" . | nindent 8 }}\n    spec:\n      containers:\n        - name: redis\n          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"\n          ports:\n            - name: redis\n              containerPort: 6379\n          {{- with .Values.resources }}\n          resources:\n            {{- toYaml . | nindent 12 }}\n          {{- end }}\n          {{- if .Values.persistence.enabled }}\n          volumeMounts:\n            - name: data\n              mountPath: /data\n          {{- end }}\n  {{- if .Values.persistence.enabled }}\n  volumeClaimTemplates:\n    - metadata:\n        name: data\n      spec:\n        accessModes: ["ReadWriteOnce"]\n        {{- if .Values.persistence.storageClass }}\n        storageClassName: {{ .Values.persistence.storageClass | quote }}\n        {{- end }}\n        resources:\n          requests:\n            storage: {{ .Values.persistence.size }}\n  {{- end }}\n',
        'templates/NOTES.txt': 'Redis đã sẵn sàng trong cluster tại: {{ .Release.Name }}-redis.{{ .Release.Namespace }}.svc.cluster.local:6379\nThử: kubectl exec {{ .Release.Name }}-redis-0 -- redis-cli ping\n{{- if not .Values.persistence.enabled }}\nCẢNH BÁO: persistence.enabled=false — dữ liệu sẽ mất khi Pod bị xóa.\n{{- end }}\n',
    };
    const REPOS = {
        vlab: { url: 'https://charts.vlab.dev', charts: { redis: REDIS_CHART } },
    };
    // Kho có thật ngoài đời — lab chạy offline nên chỉ nhận diện để báo lỗi rõ ràng
    const KNOWN_ONLINE = { bitnami: 'https://charts.bitnami.com/bitnami', 'ingress-nginx': 'https://kubernetes.github.io/ingress-nginx', 'prometheus-community': 'https://prometheus-community.github.io/helm-charts' };
    function repoChart(repo, name) {
        const r = REPOS[repo];
        const c = r && r.charts[name];
        if (!c) return null;
        const files = {};
        Object.entries(c).forEach(([k, v]) => (files[`${name}/${k}`] = v));
        return loadChart(files, name);
    }
    // Chart mẫu như "helm create" (rút gọn): Deployment + Service + NOTES cho ứng dụng vlab/web
    function scaffold(name) {
        const sel = `      app.kubernetes.io/name: {{ .Chart.Name }}\n      app.kubernetes.io/instance: {{ .Release.Name }}\n`;
        return {
            'Chart.yaml': `apiVersion: v2\nname: ${name}\ndescription: Ứng dụng web mẫu của Visual Lab\ntype: application\nversion: 0.1.0\nappVersion: "1.0"\n`,
            'values.yaml': '# Giá trị mặc định — ghi đè bằng --set khóa=giá_trị hoặc -f file.yaml\nreplicaCount: 2\nimage:\n  repository: vlab/web\n  tag: ""   # để trống thì dùng appVersion trong Chart.yaml\nmessage: "Xin chào từ Helm"\nservice:\n  type: ClusterIP\n  port: 80\nresources:\n  requests:\n    cpu: 50m\n',
            'templates/deployment.yaml': `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ .Release.Name }}-{{ .Chart.Name }}\n  labels:\n    app.kubernetes.io/name: {{ .Chart.Name }}\n    app.kubernetes.io/instance: {{ .Release.Name }}\n    app.kubernetes.io/managed-by: {{ .Release.Service }}\nspec:\n  replicas: {{ .Values.replicaCount }}\n  selector:\n    matchLabels:\n${sel.replace(/^ {6}/gm, '      ')}  template:\n    metadata:\n      labels:\n${sel.replace(/^ {6}/gm, '        ')}    spec:\n      containers:\n        - name: web\n          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"\n          ports:\n            - containerPort: 8080\n          env:\n            - name: MESSAGE\n              value: {{ .Values.message | quote }}\n          {{- with .Values.resources }}\n          resources:\n            {{- toYaml . | nindent 12 }}\n          {{- end }}\n`,
            'templates/service.yaml': `apiVersion: v1\nkind: Service\nmetadata:\n  name: {{ .Release.Name }}-{{ .Chart.Name }}\n  labels:\n    app.kubernetes.io/name: {{ .Chart.Name }}\n    app.kubernetes.io/instance: {{ .Release.Name }}\nspec:\n  type: {{ .Values.service.type }}\n  selector:\n${sel.replace(/^ {6}/gm, '    ')}  ports:\n    - port: {{ .Values.service.port }}\n      targetPort: 8080\n`,
            'templates/NOTES.txt': 'Đã cài {{ .Chart.Name }} với tên release "{{ .Release.Name }}" (revision {{ .Release.Revision }}).\nThử truy cập:\n  kubectl port-forward svc/{{ .Release.Name }}-{{ .Chart.Name }} 8080:{{ .Values.service.port }}\n  curl localhost:8080\n',
        };
    }

    return { HelmError, toYaml: (v) => toYaml(v).join('\n'), goString, parseSet, deepMerge, loadChart, render, manifestText, REPOS, KNOWN_ONLINE, repoChart, scaffold, renderString: (src, file, top) => render1(src, file, { root: top, dot: top, vars: {}, defines: {} }) };
});
