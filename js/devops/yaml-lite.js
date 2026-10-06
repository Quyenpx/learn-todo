/*
 * yaml-lite.js — Bộ đọc YAML rút gọn, đủ cho docker-compose.yml và manifest Kubernetes.
 * Không dùng thư viện ngoài để ứng dụng vẫn chạy khi mở trực tiếp file index.html.
 * Hỗ trợ: map/list lồng nhau theo thụt lề, "- key: value", inline [a, b] và {a: 1},
 * chuỗi có nháy, số, true/false/null, comment, khối "|" và ">", nhiều tài liệu cách nhau bởi "---".
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else (root.DevOpsSim = root.DevOpsSim || {}).yaml = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Lỗi có số dòng để terminal và khung soạn thảo tô sáng đúng vị trí
  class YamlError extends Error {
    constructor(line, msg) {
      super(`yaml: line ${line}: ${msg}`);
      this.name = 'YamlError';
      this.line = line;
      this.reason = msg;
    }
  }

  // Bỏ comment nhưng không đụng tới ký tự # nằm trong dấu nháy
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    }
    return s;
  }

  // Tìm dấu ":" phân tách key và value (phải theo sau bởi khoảng trắng hoặc cuối dòng, nằm ngoài nháy)
  function findColon(s) {
    let q = null, depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0 && (i === s.length - 1 || s[i + 1] === ' ')) return i;
    }
    return -1;
  }

  function splitTopLevel(s, line) {
    const out = [];
    let q = null, depth = 0, cur = '';
    for (const c of s) {
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      if (c === '[' || c === '{') depth++;
      if (c === ']' || c === '}') depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (q || depth !== 0) throw new YamlError(line, 'thiếu dấu đóng ngoặc hoặc dấu nháy');
    if (cur.trim()) out.push(cur);
    return out.map((x) => x.trim());
  }

  function scalar(raw, line) {
    const s = raw.trim();
    if (s === '') return null;
    if (s[0] === '"') {
      if (s.length < 2 || s[s.length - 1] !== '"') throw new YamlError(line, 'thiếu dấu nháy kép đóng');
      return s.slice(1, -1).replace(/\\(["\\nt])/g, (m, c) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[c]);
    }
    if (s[0] === "'") {
      if (s.length < 2 || s[s.length - 1] !== "'") throw new YamlError(line, 'thiếu dấu nháy đơn đóng');
      return s.slice(1, -1).replace(/''/g, "'");
    }
    if (s[0] === '[') {
      if (s[s.length - 1] !== ']') throw new YamlError(line, 'thiếu dấu "]"');
      return splitTopLevel(s.slice(1, -1), line).map((x) => scalar(x, line));
    }
    if (s[0] === '{') {
      if (s[s.length - 1] !== '}') throw new YamlError(line, 'thiếu dấu "}"');
      const obj = {};
      splitTopLevel(s.slice(1, -1), line).forEach((pair) => {
        const k = findColon(pair);
        if (k < 0) throw new YamlError(line, `cặp "${pair}" thiếu dấu ":"`);
        obj[scalar(pair.slice(0, k), line)] = scalar(pair.slice(k + 1), line);
      });
      return obj;
    }
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  // Chuẩn bị danh sách dòng có nghĩa: { indent, text, raw, line }
  function prepare(text) {
    const docs = [[]];
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach((raw, idx) => {
      const line = idx + 1;
      const lead = raw.match(/^[ \t]*/)[0];
      if (lead.includes('\t') && raw.trim()) throw new YamlError(line, 'không được dùng phím Tab để thụt lề, hãy dùng dấu cách');
      const body = stripComment(raw).replace(/\s+$/, '');
      if (raw.trim() === '---') { docs.push([]); return; }
      if (raw.trim() === '...') return;
      docs[docs.length - 1].push({ indent: lead.length, text: body.trim(), raw, line, blank: !body.trim() });
    });
    return docs;
  }

  function Parser(lines) {
    this.all = lines; // giữ cả dòng trống cho khối "|"
    this.lines = lines.filter((l) => !l.blank);
    this.i = 0;
  }

  Parser.prototype.peek = function () { return this.lines[this.i]; };

  Parser.prototype.block = function (indent) {
    const l = this.peek();
    if (!l) return null;
    return isSeqItem(l.text) ? this.seq(indent) : this.map(indent);
  };

  function isSeqItem(t) { return t === '-' || t.startsWith('- '); }

  Parser.prototype.blockScalar = function (parentIndent, style, startLine) {
    // Lấy nguyên văn các dòng thụt sâu hơn dòng cha, kể cả dòng trống ở giữa
    const startIdx = this.all.findIndex((x) => x.line === startLine) + 1;
    const body = [];
    let base = null;
    for (let k = startIdx; k < this.all.length; k++) {
      const l = this.all[k];
      if (!l.raw.trim()) { body.push(''); continue; }
      if (l.indent <= parentIndent) break;
      if (base === null) base = l.indent;
      body.push(l.raw.slice(Math.min(base, l.indent)));
    }
    while (body.length && body[body.length - 1] === '') body.pop();
    while (this.peek() && this.peek().indent > parentIndent) this.i++;
    const keep = style.includes('-') ? '' : '\n';
    return (style[0] === '>' ? body.join(' ').replace(/ {2,}/g, ' ') : body.join('\n')) + keep;
  };

  Parser.prototype.valueAfterKey = function (indent, rest, l) {
    if (/^[|>][-+]?$/.test(rest)) return this.blockScalar(indent, rest, l.line);
    if (rest !== '') return scalar(rest, l.line);
    const nx = this.peek();
    if (nx && nx.indent > indent) return this.block(nx.indent);
    if (nx && nx.indent === indent && isSeqItem(nx.text)) return this.seq(indent); // list ngang hàng key (kiểu compose)
    return null;
  };

  Parser.prototype.map = function (indent) {
    const obj = {};
    while (this.i < this.lines.length) {
      const l = this.peek();
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlError(l.line, 'thụt lề không hợp lệ (không khớp với các dòng phía trên)');
      if (isSeqItem(l.text)) break;
      const c = findColon(l.text);
      if (c < 0) throw new YamlError(l.line, `thiếu dấu ":" sau tên khóa "${l.text}"`);
      const key = String(scalar(l.text.slice(0, c), l.line));
      this.i++;
      obj[key] = this.valueAfterKey(indent, l.text.slice(c + 1).trim(), l);
    }
    return obj;
  };

  Parser.prototype.seq = function (indent) {
    const arr = [];
    while (this.i < this.lines.length) {
      const l = this.peek();
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlError(l.line, 'thụt lề không hợp lệ trong danh sách');
      if (!isSeqItem(l.text)) break;
      const rest = l.text.slice(1).trimStart();
      if (rest === '') {
        this.i++;
        const nx = this.peek();
        arr.push(nx && nx.indent > indent ? this.block(nx.indent) : null);
      } else if (findColon(rest) >= 0 && !/^["'[{]/.test(rest)) {
        // "- key: value": biến dòng hiện tại thành dòng đầu của một map thụt sâu hơn
        const offset = l.text.length - rest.length;
        this.lines[this.i] = Object.assign({}, l, { indent: indent + offset, text: rest });
        arr.push(this.map(indent + offset));
      } else {
        this.i++;
        arr.push(scalar(rest, l.line));
      }
    }
    return arr;
  };

  function parseDoc(lines) {
    const p = new Parser(lines);
    if (!p.lines.length) return null;
    const first = p.peek();
    if (first.indent !== 0) throw new YamlError(first.line, 'dòng đầu tiên không được thụt lề');
    // Tài liệu chỉ có một giá trị đơn
    if (p.lines.length === 1 && !isSeqItem(first.text) && findColon(first.text) < 0) return scalar(first.text, first.line);
    const v = p.block(0);
    if (p.i < p.lines.length) {
      const l = p.peek();
      throw new YamlError(l.line, 'thụt lề không hợp lệ hoặc trộn lẫn danh sách và khóa');
    }
    return v;
  }

  function parseAll(text) {
    return prepare(text).map(parseDoc).filter((d, i, a) => d !== null || a.length === 1);
  }

  function parse(text) {
    const docs = parseAll(text);
    return docs.length ? docs[0] : null;
  }

  return { parse, parseAll, YamlError };
});
