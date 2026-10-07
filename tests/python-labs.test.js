// Kiểm thử 15 bài khóa Python: chấm lab theo kết quả, nội dung đủ chuẩn, link notebook tồn tại, renderer không chèn HTML.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Mỗi bài: 4 đầu vào theo gợi ý, đầu vào thứ i phải đạt nhiệm vụ i và không đạt nhiệm vụ i+1
const fixtures = {
  setup: [{}, { sep: '-' }, { tuoi: 'hai mươi' }, { ten: 'Bình', tuoi: '17' }],
  variables: [{ gia_tri: '42', kieu: 'int' }, { gia_tri: '3.5', kieu: 'float' }, { gia_tri: '0', kieu: 'bool' }, { gia_tri: '3.5', kieu: 'int' }],
  conditions: [{ diem: 9 }, { diem: 3 }, { diem: 6.5 }, { diem: 11 }],
  loops: [{}, { he_so: 1 }, { he_so: 1.5 }, { nguong: 1 }],
  collections: [{}, { lat: '::-1' }, { chi_so: 10 }, { lat: ':2', chi_so: 0 }],
  functions: [{ w: 2, b: 0 }, { w: 1.5, b: 1 }, { co_return: 'khong' }, { xs: '' }],
  comprehension: [{ loc: 'all' }, { loc: 'len3' }, { cau: '   ', loc: 'all' }, { loc: 'h' }],
  classes: [{ n: 10, so_nhan: 10, bs: 4 }, { so_nhan: 8 }, { chi_so: 12 }, { n: 8, so_nhan: 8, bs: 4 }],
  files: [{}, { co_file: 'khong' }, { noi_dung: 'ten,diem\nAn,tám' }, { noi_dung: 'ten,diem' }],
  numpy: [{}, { shape_a: '3,2', shape_b: '3' }, { shape_a: '2,3', shape_b: '3' }, { shape_a: '2,3', shape_b: '2,3' }],
  linalg: [{}, { lr: 1.2 }, { so_vong: 3 }, { dang_X: 't' }],
  pandas: [{ phep: 'loc', nguong: 3 }, { phep: 'groupby' }, { phep: 'dropna' }, { phep: 'fillna' }],
  sklearn: [{}, { chuan_hoa: 'all' }, { test_size: 1 }, { k: 50 }],
  pytorch: [{}, { zero_grad: 'khong' }, { lr: 0.3 }, { requires_grad: 'khong' }],
  capstone: [{}, { xu_ly: 'none' }, { nguong: 0.9 }, { xu_ly: 'fill' }],
};
const notebooks = ['01_bat_dau', '02_bien_kieu_du_lieu', '03_dieu_kien', '04_vong_lap', '05_cau_truc_du_lieu', '06_ham', '07_comprehension_chuoi', '08_lop_doi_tuong', '09_file_ngoai_le', '10_numpy_co_ban', '11_numpy_dai_so', '12_pandas_matplotlib', '13_scikit_learn', '14_pytorch', '15_du_an_tong_ket'];
const load = (name) => require(path.join(__dirname, `../js/lessons/python/${name}.js`));

Object.keys(fixtures).forEach((name, n) => test(`bài Python ${name}: lab chấm đúng theo kết quả và nội dung đủ chuẩn`, () => {
  const file = path.join(__dirname, `../js/lessons/python/${name}.js`);
  assert.ok(fs.existsSync(file), 'bài học phải tồn tại');
  const l = load(name);
  assert.equal(l.id, 'py-' + name);
  assert.equal(l.course, 'python');
  assert.ok(l.labs.length >= 4, 'ít nhất 4 nhiệm vụ');
  assert.ok(l.quiz.length >= 6, 'ít nhất 6 câu hỏi');
  l.quiz.forEach((q) => { assert.ok(q.options[q.answer], 'đáp án hợp lệ'); assert.ok(q.explain.length > 20, 'có giải thích'); });
  const empty = { history: [] };
  l.labs.forEach((t) => assert.equal(t.check(empty).ok, false, 'chưa chạy thì chưa đạt'));
  const all = { history: [] };
  fixtures[name].forEach((input, i) => {
    const full = { ...l.experiment.defaults, ...input };
    const r = l.experiment.run(full);
    assert.ok(r && Array.isArray(r.trace) && Array.isArray(r.output), 'kết quả có trace và output');
    assert.notEqual(r.error && r.error.type, 'SimulationError', `mô phỏng không được lỗi nội bộ: ${r.error && r.error.message}`);
    assert.equal(r.inputError, undefined, `đầu vào gợi ý hợp lệ: ${r.inputError}`);
    const lines = l.experiment.code(full);
    assert.ok(Array.isArray(lines) && lines.every((x) => typeof x === 'string'), 'code trả danh sách dòng');
    r.trace.forEach((s) => assert.ok(s.line >= 1 && s.line <= lines.length, `dòng ${s.line} nằm trong đoạn mã (${lines.length} dòng)`));
    assert.ok(r.trace.length > 0, 'có ít nhất một bước');
    const one = { history: [{ input: full, result: r }] };
    assert.equal(l.labs[i].check(one).ok, true, `đầu vào gợi ý đạt nhiệm vụ ${i + 1}`);
    assert.equal(l.labs[(i + 1) % 4].check(one).ok, false, `kết quả nhiệm vụ ${i + 1} không chấm nhầm nhiệm vụ ${((i + 1) % 4) + 1}`);
    all.history.push({ input: full, result: r });
  });
  l.labs.forEach((t) => assert.equal(t.check(all).ok, true));
  // Kiến thức, thực hành và nguồn chính thức
  assert.ok(l.study.sections.length >= 3, 'ít nhất 3 phần kiến thức');
  const p = l.study.practice;
  assert.ok(p && p.steps.length >= 3 && p.expected && p.troubleshooting, 'bài thực hành có bước, kết quả, xử lý lỗi');
  const nb = notebooks[n];
  assert.deepEqual(p.downloads.map((d) => d.href), [`examples/python/notebooks/${nb}.ipynb`, `examples/python/solutions/${nb}_loi_giai.ipynb`]);
  p.downloads.forEach((d) => assert.ok(fs.existsSync(path.join(__dirname, '..', d.href)), `file ${d.href} tồn tại`));
  assert.ok(l.study.references.length >= 2);
  l.study.references.forEach((r) => { assert.match(r.url, /^https:\/\//); assert.ok(r.note && r.topic && r.checked); });
}));

test('đầu vào sai trả thông báo tiếng Việt, không lỗi nội bộ', () => {
  const cases = { conditions: { diem: NaN }, loops: { toi_da: 0 }, numpy: { shape_a: 'x' }, functions: { xs: '1, a' }, sklearn: { k: 2.5 } };
  Object.entries(cases).forEach(([name, input]) => {
    const l = load(name);
    const r = l.experiment.run({ ...l.experiment.defaults, ...input });
    assert.ok(r.inputError, `${name} báo lỗi đầu vào`);
    l.labs.forEach((t) => assert.equal(t.check({ history: [{ result: r }] }).ok, false));
  });
});

test('trang tổng quan liệt kê đủ bài và index nạp đúng thứ tự', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const order = ['js/learning/pytrace.js', 'js/learning/pycourse-ui.js', 'js/lessons/python/home.js', ...Object.keys(fixtures).map((n) => `js/lessons/python/${n}.js`)];
  let last = -1;
  order.forEach((src) => { const at = html.indexOf(`src="${src}"`); assert.ok(at > last, `${src} được nạp đúng thứ tự`); last = at; });
  assert.ok(html.indexOf('src="js/core.js"') < html.indexOf('src="js/learning/pytrace.js"'));
  assert.ok(fs.existsSync(path.join(__dirname, '../css/python.css')));
  assert.ok(html.includes('href="css/python.css"'));
});

test('renderer Python giữ đầu vào HTML dưới dạng văn bản và chỉ ghi lịch sử khi chạy', () => {
  const storage = {};
  const c = vm.createContext({ window: {}, localStorage: { getItem: (k) => storage[k], setItem: (k, v) => (storage[k] = v) }, console });
  vm.runInContext(fs.readFileSync('js/core.js', 'utf8'), c);
  c.App = c.window.App;
  vm.runInContext(fs.readFileSync('js/learning/pycourse-ui.js', 'utf8'), c);
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this._t = ''; this.style = {}; this.classList = { toggle() {} }; this.attrs = {}; }
    get textContent() { return this._t; }
    set textContent(v) { this._t = v; this.children = []; }
    appendChild(n) { this.children.push(n); return n; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    setAttribute(k, v) { this.attrs[k] = v; }
  }
  c.document = { createElement: (tag) => new Element(tag) };
  const sim = new Element('div');
  c.App.shell = () => ({ sim, lab: null, quiz: null });
  c.App.labUI = () => {}; c.App.quizUI = () => {};
  const P = require('../js/learning/pytrace.js');
  const lesson = P.lesson({ id: 'py-unsafe', title: 'T', lead: 'L', experiment: {
    defaults: { ten: '<img src=x onerror=alert(1)>' }, controls: [{ key: 'ten', label: 'Tên', type: 'text' }],
    code: (i) => ['ten = ' + P.repr(i.ten), 'print(ten)'],
    run: (i) => P.execute((t) => { t.step(1, { ten: i.ten }); t.step(2, { ten: i.ten }); t.print(i.ten); return { ten: i.ten }; }),
  }, tasks: [], quiz: [], study: {} });
  c.App.renderPythonLesson({}, { canvas() {} }, lesson);
  const all = (n) => [n, ...n.children.flatMap(all)];
  assert.equal(lesson.state.history.length, 0);
  assert.ok(all(sim).some((n) => n.tagName === 'code' && n.textContent.includes('<img src=x')), 'khung mã hiện đầu vào dạng chữ');
  all(sim).find((n) => n.tagName === 'button' && n.textContent.includes('Chạy')).listeners.click();
  assert.equal(lesson.state.history.length, 1);
  const out = all(sim).find((n) => n.tagName === 'pre');
  assert.equal(out.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(all(sim).some((n) => n.tagName === 'img'), false);
  const vars = all(sim).filter((n) => n.tagName === 'dd').map((n) => n.textContent);
  assert.deepEqual(vars, ["'<img src=x onerror=alert(1)>'"]);
  all(sim).find((n) => n.tagName === 'button' && n.textContent.includes('Trước')).listeners.click();
  assert.equal(all(sim).find((n) => n.tagName === 'pre').textContent, '(chưa có đầu ra ở bước này)', 'lùi một bước thì ẩn print chưa chạy');
  all(sim).find((n) => n.tagName === 'button' && n.textContent.includes('Đặt lại')).listeners.click();
  assert.equal(lesson.state.history.length, 0);
});
