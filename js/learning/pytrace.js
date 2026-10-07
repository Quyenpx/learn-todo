/*
 * pytrace.js — Lõi mô phỏng Python cho khóa "Python cho AI".
 * Đây KHÔNG phải trình thông dịch: mỗi bài tự viết hàm JavaScript mô hình hóa đoạn mã minh họa,
 * còn file này cung cấp phần dùng chung để kết quả hiển thị giống Python (repr, lỗi, cắt lát, broadcasting).
 * Dùng được cả trong Node (kiểm thử) và trình duyệt (script thường, gắn vào window.PyTrace).
 */
(function (root) {
  'use strict';
  const P = {};

  // ---------- Kiểu giá trị đặc biệt của Python mà JavaScript không phân biệt ----------
  // JavaScript không tách 2 và 2.0; bọc số thực nguyên để hiển thị "2.0" như Python.
  P.float = (v) => ({ __py: 'float', v: Number(v) });
  P.tuple = (items) => ({ __py: 'tuple', items });
  P.nd = (data, opts = {}) => ({ __py: 'nd', data, float: !!opts.float });
  P.raw = (text) => ({ __py: 'raw', text: String(text) }); // hiển thị nguyên văn, ví dụ <class 'int'>
  const isPy = (v, kind) => v && typeof v === 'object' && v.__py === kind;
  P.valueOf = (v) => (isPy(v, 'float') ? v.v : v);

  function floatRepr(x) {
    if (Number.isNaN(x)) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (Object.is(x, -0)) return '-0.0';
    const a = Math.abs(x);
    // Python chuyển sang dạng mũ khi |x| >= 1e16 hoặc |x| < 1e-4; số mũ luôn có ít nhất 2 chữ số
    if (x !== 0 && (a >= 1e16 || a < 1e-4)) {
      return x.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
    }
    return Number.isInteger(x) ? x.toFixed(1) : String(x);
  }
  function strRepr(s) {
    const q = s.includes("'") && !s.includes('"') ? '"' : "'";
    const body = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    return q + (q === "'" ? body.replace(/'/g, "\\'") : body) + q;
  }
  function numRepr(n, asFloat) { return Number.isInteger(n) && !asFloat ? String(n) : floatRepr(n); }

  P.repr = function repr(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return numRepr(v, false);
    if (typeof v === 'string') return strRepr(v);
    if (isPy(v, 'float')) return floatRepr(v.v);
    if (isPy(v, 'raw')) return v.text;
    if (isPy(v, 'tuple')) return v.items.length === 1 ? `(${repr(v.items[0])},)` : `(${v.items.map(repr).join(', ')})`;
    if (isPy(v, 'nd')) {
      const inner = (d) => (Array.isArray(d) ? `[${d.map(inner).join(', ')}]` : typeof d === 'number' ? numRepr(d, v.float) : repr(d));
      return `array(${inner(v.data)})`;
    }
    if (Array.isArray(v)) return `[${v.map(repr).join(', ')}]`;
    if (v instanceof Map) return `{${[...v.entries()].map(([k, x]) => `${repr(k)}: ${repr(x)}`).join(', ')}}`;
    if (v instanceof Set) {
      if (!v.size) return 'set()';
      const items = [...v];
      if (items.every((x) => typeof x === 'number')) items.sort((a, b) => a - b);
      return `{${items.map(repr).join(', ')}}`;
    }
    if (typeof v === 'object' && v.__repr) return v.__repr;
    return String(v);
  };
  // str(): chuỗi in nguyên văn, giá trị khác dùng repr (đúng với cách print hoạt động)
  P.str = (v) => (typeof v === 'string' ? v : P.repr(v));

  // ---------- Lỗi theo kiểu Python ----------
  class PyError extends Error {
    constructor(type, message, line) { super(message); this.type = type; this.line = line; }
  }
  P.PyError = PyError;
  P.error = (type, message, line) => new PyError(type, message, line);
  // Lỗi do ô nhập trên web (không phải lỗi Python) — hiển thị tiếng Việt, không in Traceback
  P.inputError = (message) => new PyError('InputError', message);

  P.num = function (value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) throw P.inputError(`${label} phải là số.`);
    if (integer && !Number.isInteger(n)) throw P.inputError(`${label} phải là số nguyên.`);
    if (n < min || n > max) throw P.inputError(`${label} phải nằm trong khoảng ${min} đến ${max}.`);
    return n;
  };
  P.parseList = function (text, label = 'Danh sách', { max = 30 } = {}) {
    const parts = String(text == null ? '' : text).split(',').map((s) => s.trim()).filter((s) => s !== '');
    if (parts.length > max) throw P.inputError(`${label} tối đa ${max} phần tử.`);
    return parts.map((s) => {
      const n = Number(s);
      if (!Number.isFinite(n)) throw P.inputError(`${label} chỉ gồm số, cách nhau bằng dấu phẩy (phần tử sai: "${s}").`);
      return n;
    });
  };

  // ---------- Chuyển chuỗi thành số đúng như int()/float() của Python ----------
  P.pyInt = function (s) {
    const t = String(s).trim();
    if (!/^[+-]?\d+(_\d+)*$/.test(t)) throw P.error('ValueError', `invalid literal for int() with base 10: ${strRepr(String(s))}`);
    return Number(t.replace(/_/g, ''));
  };
  P.pyFloat = function (s) {
    const t = String(s).trim().replace(/_/g, '');
    if (/^[+-]?(inf|infinity)$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
    if (/^[+-]?nan$/i.test(t)) return NaN;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) throw P.error('ValueError', `could not convert string to float: ${strRepr(String(s))}`);
    return Number(t);
  };
  // In mảng số nguyên theo cách print(np.array(...)): canh phải theo phần tử dài nhất
  P.ndStr = function (data) {
    const flat = [];
    const walk = (d) => (Array.isArray(d) ? d.forEach(walk) : flat.push(String(d)));
    walk(data);
    const w = Math.max(...flat.map((x) => x.length));
    const ndim = P.shapeOf(data).length;
    const fmt = (d, depth) => {
      if (!Array.isArray(d[0])) return '[' + d.map((x) => String(x).padStart(w)).join(' ') + ']';
      const sep = '\n'.repeat(ndim - depth - 1) + ' '.repeat(depth + 1);
      return '[' + d.map((x) => fmt(x, depth + 1)).join(sep) + ']';
    };
    return fmt(data, 0);
  };

  // ---------- Danh sách: chỉ số và cắt lát theo đúng quy tắc của Python ----------
  P.index = function (list, i) {
    if (typeof i !== 'number' || !Number.isInteger(i)) throw P.error('TypeError', `list indices must be integers or slices, not ${typeof i === 'number' ? 'float' : 'str'}`);
    const k = i < 0 ? i + list.length : i;
    if (k < 0 || k >= list.length) throw P.error('IndexError', 'list index out of range');
    return list[k];
  };
  P.slice = function (list, text) {
    const raw = String(text).trim();
    if (!raw.includes(':')) throw P.inputError('Lát cắt cần có dấu hai chấm, ví dụ 1:3 hoặc ::-1.');
    const parts = raw.split(':');
    if (parts.length > 3) throw P.error('SyntaxError', 'invalid syntax');
    const vals = parts.map((p) => {
      const s = p.trim();
      if (s === '') return null;
      if (!/^-?\d+$/.test(s)) throw P.error('TypeError', 'slice indices must be integers or None or have an __index__ method');
      return Number(s);
    });
    const n = list.length;
    const step = vals[2] == null ? 1 : vals[2];
    if (step === 0) throw P.error('ValueError', 'slice step cannot be zero');
    // Thuật toán chuẩn hóa chỉ số giống PySlice_AdjustIndices của CPython
    const adjust = (v, def, lo, hi) => {
      if (v == null) return def;
      let x = v < 0 ? v + n : v;
      if (x < lo) x = lo;
      if (x > hi) x = hi;
      return x;
    };
    const start = step > 0 ? adjust(vals[0], 0, 0, n) : adjust(vals[0], n - 1, -1, n - 1);
    const stop = step > 0 ? adjust(vals[1], n, 0, n) : adjust(vals[1], -1, -1, n - 1);
    const out = [];
    if (step > 0) for (let i = start; i < stop; i += step) out.push(list[i]);
    else for (let i = start; i > stop; i += step) out.push(list[i]);
    return out;
  };

  // ---------- NumPy thu nhỏ: shape, broadcasting, matmul ----------
  const shapeText = (s) => `(${s.join(',')}${s.length === 1 ? ',' : ''})`;
  P.shapeText = shapeText;
  P.parseShape = function (text, { maxDim = 6, maxNdim = 3 } = {}) {
    const parts = String(text == null ? '' : text).split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length || parts.length > maxNdim) throw P.inputError(`Shape cần từ 1 đến ${maxNdim} chiều, ví dụ 3,1.`);
    return parts.map((s) => {
      if (!/^\d+$/.test(s) || Number(s) < 1 || Number(s) > maxDim) throw P.inputError(`Mỗi chiều là số nguyên từ 1 đến ${maxDim}.`);
      return Number(s);
    });
  };
  P.shapeOf = (a) => (Array.isArray(a) ? [a.length, ...P.shapeOf(a[0])] : []);
  P.broadcastShape = function (a, b) {
    const n = Math.max(a.length, b.length), out = [];
    for (let i = 0; i < n; i++) {
      const x = a[a.length - n + i] ?? 1, y = b[b.length - n + i] ?? 1;
      if (x !== y && x !== 1 && y !== 1) throw P.error('ValueError', `operands could not be broadcast together with shapes ${shapeText(a)} ${shapeText(b)} `);
      out.push(Math.max(x, y));
    }
    return out;
  };
  P.matmulShape = function (a, b) {
    if (!a.length || !b.length) throw P.error('ValueError', 'matmul: Input operand does not have enough dimensions');
    const k = a[a.length - 1], kb = b.length === 1 ? b[0] : b[b.length - 2];
    if (k !== kb) throw P.error('ValueError', `matmul: Input operand 1 has a mismatch in its core dimension 0, with gufunc signature (n?,k),(k,m?)->(n?,m?) (size ${kb} is different from ${k})`);
    return [...a.slice(0, -1), ...(b.length === 1 ? [] : [b[b.length - 1]])];
  };
  P.arange = function (shape, scale = 1) {
    let c = 0;
    const build = (d) => (d === shape.length ? c++ * scale : Array.from({ length: shape[d] }, () => build(d + 1)));
    return build(0);
  };
  P.broadcastOp = function (a, b, fn) {
    const sa = P.shapeOf(a), sb = P.shapeOf(b), so = P.broadcastShape(sa, sb);
    const pick = (arr, shape, idx) => {
      let v = arr;
      const off = so.length - shape.length;
      for (let d = 0; d < shape.length; d++) v = v[shape[d] === 1 ? 0 : idx[off + d]];
      return v;
    };
    const build = (d, idx) => (d === so.length ? fn(pick(a, sa, idx), pick(b, sb, idx)) : Array.from({ length: so[d] }, (_, i) => build(d + 1, [...idx, i])));
    return build(0, []);
  };

  // ---------- Thống kê nhỏ dùng trong nhiều bài ----------
  P.mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  P.round = (x, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);
  // Bộ sinh số giả ngẫu nhiên có seed để dữ liệu mẫu luôn giống nhau giữa các lần chạy
  P.rng = function (seed = 42) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  };

  // ---------- Bộ ghi bước: dòng đang chạy, ảnh chụp biến, đầu ra ----------
  function tracer(limit) {
    const t = { trace: [], output: [], truncated: false, lastLine: null, lastVars: {}, pending: false };
    t.step = function (line, vars = {}) {
      t.lastLine = line;
      const snap = {};
      Object.keys(vars).forEach((k) => (snap[k] = P.repr(vars[k])));
      t.lastVars = snap;
      if (t.trace.length >= limit) { t.truncated = true; return; }
      t.trace.push({ line, vars: snap, out: t.output.length });
    };
    t.print = function (...args) {
      let opts = {};
      const last = args[args.length - 1];
      if (last && typeof last === 'object' && last.constructor === Object && ('sep' in last || 'end' in last)) opts = args.pop();
      const sep = opts.sep === undefined ? ' ' : opts.sep, end = opts.end === undefined ? '\n' : opts.end;
      const text = args.map(P.str).join(sep);
      if (t.output.length >= limit) { t.truncated = true; return; }
      if (t.pending && t.output.length) t.output[t.output.length - 1] += text;
      else t.output.push(text);
      t.pending = end !== '\n';
      if (t.trace.length) t.trace[t.trace.length - 1].out = t.output.length;
    };
    return t;
  }
  P.execute = function (fn, { limit = 200, line = null } = {}) {
    const t = tracer(limit);
    try {
      const extra = fn(t) || {};
      return { ...extra, trace: t.trace, output: t.output, error: null, truncated: t.truncated };
    } catch (e) {
      if (e instanceof PyError && e.type === 'InputError') {
        return { trace: t.trace, output: t.output, error: { type: 'InputError', message: e.message }, inputError: e.message, truncated: t.truncated };
      }
      if (e instanceof PyError) {
        const where = e.line ?? line ?? t.lastLine;
        t.output.push('Traceback (most recent call last):', `  Dòng ${where}`, `${e.type}: ${e.message}`);
        t.trace.push({ line: where, vars: t.lastVars, out: t.output.length, error: true });
        return { ...(e.partial || {}), trace: t.trace, output: t.output, error: { type: e.type, message: e.message, line: where }, truncated: t.truncated };
      }
      return { trace: t.trace, output: t.output, error: { type: 'SimulationError', message: e.message }, truncated: t.truncated };
    }
  };

  // Mỗi bài có một notebook bài tập và một bản lời giải sinh từ cùng file nguồn
  P.notebookLinks = (slug) => [
    { label: 'Tải notebook bài tập', href: `examples/python/notebooks/${slug}.ipynb` },
    { label: 'Xem notebook lời giải', href: `examples/python/solutions/${slug}_loi_giai.ipynb` },
  ];

  // ---------- Chuẩn hóa một bài học của khóa Python ----------
  P.lesson = function (config) {
    const lesson = {
      ...config,
      course: 'python',
      group: config.group || 'Python',
      icon: config.icon || '🐍',
      navTitle: config.navTitle || config.title,
      navSub: config.navSub || 'Đọc, chạy từng dòng, làm lab',
      badge: 'Python cho AI · ' + (config.badgeTail || 'Mô phỏng từng dòng'),
      cardText: config.lead,
    };
    const run = config.experiment.run;
    lesson.experiment = {
      ...config.experiment,
      run(input) {
        try {
          const r = run(input);
          return r && typeof r === 'object' ? r : { trace: [], output: [], error: { type: 'SimulationError', message: 'Mô phỏng không trả kết quả.' } };
        } catch (e) {
          return { trace: [], output: [], error: { type: 'SimulationError', message: e.message } };
        }
      },
    };
    lesson.labs = (config.tasks || []).map((task, i) => ({
      id: 'task-' + (i + 1), title: task.title, desc: task.desc, hint: task.hint, reflect: task.reflect,
      check(s) {
        const ok = !!s && Array.isArray(s.history) && s.history.some((entry) => {
          try { return !!(entry && entry.result && task.accept(entry.result)); } catch (e) { return false; }
        });
        return { ok, msg: 'Chưa đạt. Đọc gợi ý, sửa đầu vào rồi bấm Chạy và xem dòng cuối của đầu ra.' };
      },
    }));
    lesson.render = (rootEl, ctx) => globalThis.App.renderPythonLesson(rootEl, ctx, lesson);
    return lesson;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else root.PyTrace = P;
})(typeof window !== 'undefined' ? window : globalThis);
