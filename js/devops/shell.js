/*
 * shell.js — Tiện ích dòng lệnh dùng chung cho các bộ mô phỏng Docker và Kubernetes:
 * tách token, đọc cờ, gợi ý Tab, định dạng bảng, kích thước và thời gian giống Docker CLI.
 * Không phụ thuộc giao diện để kiểm thử được bằng Node.js.
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else (root.DevOpsSim = root.DevOpsSim || {}).shell = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ShellError extends Error {
    constructor(msg) { super(msg); this.name = 'ShellError'; }
  }

  // Tách dòng lệnh thành token theo quy tắc của bash: nháy kép, nháy đơn và ký tự thoát "\"
  function tokenize(line) {
    const out = [];
    let cur = '', has = false, q = null;
    const s = String(line);
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q === "'") { if (c === "'") q = null; else cur += c; continue; }
      if (q === '"') {
        if (c === '"') q = null;
        else if (c === '\\' && (s[i + 1] === '"' || s[i + 1] === '\\')) cur += s[++i];
        else cur += c;
        continue;
      }
      if (c === '"' || c === "'") { q = c; has = true; continue; }
      if (c === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; continue; }
      if (/\s/.test(c)) { if (has) { out.push(cur); cur = ''; has = false; } continue; }
      cur += c; has = true;
    }
    if (q) throw new ShellError(`thiếu dấu nháy ${q === '"' ? 'kép' : 'đơn'} đóng`);
    if (has) out.push(cur);
    return out;
  }

  /*
   * Đọc cờ theo đặc tả: { bool:[], value:[], multi:[], alias:{ tên_dài: tên_chuẩn }, stopAfter }
   * stopAfter = n: sau n tham số vị trí thì phần còn lại là lệnh của container (như "docker run IMAGE CMD...").
   */
  function parseArgs(tokens, spec = {}) {
    const bool = new Set(spec.bool || []), value = new Set(spec.value || []), multi = new Set(spec.multi || []);
    const alias = spec.alias || {};
    const flags = {}, args = [];
    let rest = [];
    const setVal = (name, v) => {
      if (multi.has(name)) (flags[name] = flags[name] || []).push(v);
      else flags[name] = v;
    };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (spec.stopAfter !== undefined && args.length >= spec.stopAfter) { rest = tokens.slice(i); break; }
      if (t === '--') { args.push(...tokens.slice(i + 1)); break; }
      if (t.startsWith('--') && t.length > 2) {
        const eq = t.indexOf('=');
        const orig = eq > 0 ? t.slice(2, eq) : t.slice(2);
        const name = alias[orig] || orig;
        if (bool.has(name)) { flags[name] = eq > 0 ? t.slice(eq + 1) !== 'false' : true; continue; }
        if (value.has(name)) {
          const v = eq > 0 ? t.slice(eq + 1) : tokens[++i];
          if (v === undefined) return { flags, args, rest, error: `flag needs an argument: --${orig}` };
          setVal(name, v);
          continue;
        }
        return { flags, args, rest, error: `unknown flag: --${orig}` };
      }
      if (t.startsWith('-') && t.length > 1 && !/^-\d/.test(t)) {
        const chars = t.slice(1);
        for (let j = 0; j < chars.length; j++) {
          const c = chars[j], name = alias[c] || c;
          if (bool.has(name)) { flags[name] = true; continue; }
          if (value.has(name)) {
            const v = j + 1 < chars.length ? chars.slice(j + 1).replace(/^=/, '') : tokens[++i];
            if (v === undefined) return { flags, args, rest, error: `flag needs an argument: '${c}' in -${c}` };
            setVal(name, v);
            break;
          }
          return { flags, args, rest, error: `unknown shorthand flag: '${c}' in ${t}` };
        }
        continue;
      }
      args.push(t);
    }
    return { flags, args, rest };
  }

  // Gợi ý Tab: một kết quả thì điền luôn, nhiều kết quả thì điền phần chung và trả danh sách lựa chọn
  function completeWord(prefix, candidates) {
    const matches = [...new Set(candidates)].filter((c) => c.startsWith(prefix)).sort();
    if (!matches.length) return { value: prefix, options: [] };
    if (matches.length === 1) return { value: matches[0] + ' ', options: [] };
    let cp = matches[0];
    for (const m of matches) while (!m.startsWith(cp)) cp = cp.slice(0, -1);
    return { value: cp, options: matches };
  }

  // Căn cột giống Docker CLI: mỗi cột cách nhau 3 khoảng trắng
  function table(rows) {
    if (!rows.length) return [];
    const n = Math.max(...rows.map((r) => r.length));
    const w = [];
    for (let c = 0; c < n - 1; c++) w[c] = Math.max(...rows.map((r) => String(r[c] ?? '').length));
    return rows.map((r) => r.map((cell, c) => (c < n - 1 ? String(cell ?? '').padEnd(w[c] + 3) : String(cell ?? ''))).join('').replace(/\s+$/, ''));
  }

  // Kích thước theo hệ thập phân với 3 chữ số có nghĩa, giống "docker images"
  function fmtSize(bytes) {
    const units = ['B', 'kB', 'MB', 'GB', 'TB'];
    let v = Math.max(0, bytes), u = 0;
    while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
    return parseFloat(v.toPrecision(3)) + units[u];
  }

  // Thời lượng dạng chữ theo đúng quy tắc HumanDuration của Docker
  function duration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 1) return 'Less than a second';
    if (s === 1) return '1 second';
    if (s < 60) return `${s} seconds`;
    const m = Math.floor(ms / 60000);
    if (m === 1) return 'About a minute';
    if (m < 60) return `${m} minutes`;
    const h = Math.round(ms / 3600000);
    if (h === 1) return 'About an hour';
    if (h < 48) return `${h} hours`;
    if (h < 24 * 14) return `${Math.floor(h / 24)} days`;
    if (h < 24 * 60) return `${Math.floor(h / 24 / 7)} weeks`;
    if (h < 24 * 730) return `${Math.floor(h / 24 / 30)} months`;
    return `${Math.floor(h / 24 / 365)} years`;
  }
  const ago = (ms) => duration(ms) + ' ago';

  // Băm FNV-1a: tạo khóa cache và mã image ổn định, lặp lại được giữa các lần chạy
  function hash(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const hash64 = (str) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => hash(k + ':' + str)).join('');

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { tokenize, parseArgs, completeWord, table, fmtSize, duration, ago, hash, hash64, rng, ShellError };
});
