// Kiểm thử lõi mô phỏng Python: hiển thị giá trị, lỗi kiểu Python, cắt lát, broadcasting và bộ ghi bước.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/learning/pytrace.js');

test('repr hiển thị giá trị giống Python', () => {
  assert.equal(P.repr(3), '3');
  assert.equal(P.repr(P.float(2)), '2.0');
  assert.equal(P.repr(P.float(0.1 + 0.2)), '0.30000000000000004');
  assert.equal(P.repr(P.float(0.00001)), '1e-05');
  assert.equal(P.repr(P.float(1e16)), '1e+16');
  assert.equal(P.repr(P.float(NaN)), 'nan');
  assert.equal(P.repr(P.float(-Infinity)), '-inf');
  assert.equal(P.repr('An'), "'An'");
  assert.equal(P.repr("It's"), '"It\'s"');
  assert.equal(P.repr(true), 'True');
  assert.equal(P.repr(null), 'None');
  assert.equal(P.repr([1, 'a', [false]]), "[1, 'a', [False]]");
  assert.equal(P.repr(P.tuple([1, 2])), '(1, 2)');
  assert.equal(P.repr(P.tuple([1])), '(1,)');
  assert.equal(P.repr(new Set([3, 1])), '{1, 3}');
  assert.equal(P.repr(new Set()), 'set()');
  assert.equal(P.repr(new Map([['học', 2], ['ai', 1]])), "{'học': 2, 'ai': 1}");
  assert.equal(P.repr(P.nd([[0, 1], [2, 3]])), 'array([[0, 1], [2, 3]])');
  assert.equal(P.str('An'), 'An');
  assert.equal(P.str(P.float(1.5)), '1.5');
});

test('cắt lát và chỉ số theo quy tắc Python', () => {
  const ds = [3, 1, 4, 1, 5];
  assert.deepEqual(P.slice(ds, '1:3'), [1, 4]);
  assert.deepEqual(P.slice(ds, '::-1'), [5, 1, 4, 1, 3]);
  assert.deepEqual(P.slice(ds, '-2:'), [1, 5]);
  assert.deepEqual(P.slice(ds, '10:20'), []);
  assert.deepEqual(P.slice(ds, '::2'), [3, 4, 5]);
  assert.deepEqual(P.slice(ds, '3:0:-1'), [1, 4, 1]);
  assert.throws(() => P.slice(ds, '::0'), e => e.type === 'ValueError' && /slice step cannot be zero/.test(e.message));
  assert.throws(() => P.slice(ds, 'a:b'), e => e.type === 'TypeError');
  assert.equal(P.index(ds, -1), 5);
  assert.throws(() => P.index(ds, 5), e => e.type === 'IndexError' && e.message === 'list index out of range');
  assert.throws(() => P.index(ds, 1.5), e => e.type === 'TypeError');
});

test('broadcasting và matmul báo lỗi như NumPy', () => {
  assert.deepEqual(P.broadcastShape([3, 1], [1, 4]), [3, 4]);
  assert.deepEqual(P.broadcastShape([2, 3], [3]), [2, 3]);
  assert.deepEqual(P.broadcastShape([2, 3], [2, 3]), [2, 3]);
  assert.throws(() => P.broadcastShape([3, 2], [3]), e => e.type === 'ValueError' && e.message === 'operands could not be broadcast together with shapes (3,2) (3,) ');
  assert.deepEqual(P.matmulShape([20, 2], [2]), [20]);
  assert.deepEqual(P.matmulShape([2, 20], [20, 2]), [2, 2]);
  assert.throws(() => P.matmulShape([2, 20], [2]), e => e.type === 'ValueError' && /size 2 is different from 20/.test(e.message));
  assert.deepEqual(P.parseShape('3, 1'), [3, 1]);
  assert.deepEqual(P.parseShape('4'), [4]);
  assert.throws(() => P.parseShape('0,2'), e => e.type === 'InputError');
  assert.throws(() => P.parseShape('1,2,3,4'), e => e.type === 'InputError');
  const a = P.arange([2, 3]);
  assert.deepEqual(a, [[0, 1, 2], [3, 4, 5]]);
  assert.deepEqual(P.broadcastOp(a, [10, 20, 30], (x, y) => x + y), [[10, 21, 32], [13, 24, 35]]);
  assert.deepEqual(P.broadcastOp([[1], [2]], [[10, 20]], (x, y) => x * y), [[10, 20], [20, 40]]);
});

test('int() và float() chuyển chuỗi theo quy tắc Python', () => {
  assert.equal(P.pyInt(' 20 '), 20);
  assert.equal(P.pyInt('-7'), -7);
  assert.equal(P.pyInt('1_000'), 1000);
  assert.throws(() => P.pyInt('3.5'), e => e.type === 'ValueError' && e.message === "invalid literal for int() with base 10: '3.5'");
  assert.throws(() => P.pyInt(''), e => e.message === "invalid literal for int() with base 10: ''");
  assert.equal(P.pyFloat(' 3.5 '), 3.5);
  assert.equal(P.pyFloat('1e3'), 1000);
  assert.equal(P.pyFloat('.5'), 0.5);
  assert.ok(Number.isNaN(P.pyFloat('nan')));
  assert.equal(P.pyFloat('-inf'), -Infinity);
  assert.throws(() => P.pyFloat('tám'), e => e.type === 'ValueError' && e.message === "could not convert string to float: 'tám'");
});

test('ndStr in mảng số nguyên như print của NumPy', () => {
  assert.equal(P.ndStr([1, 2, 3]), '[1 2 3]');
  assert.equal(P.ndStr([[0, 10], [1, 11]]), '[[ 0 10]\n [ 1 11]]');
  assert.equal(P.ndStr([[[0, 1]], [[2, 3]]]), '[[[0 1]]\n\n [[2 3]]]');
});

test('bộ ghi bước lưu ảnh chụp biến, đầu ra và lỗi theo dòng', () => {
  const r = P.execute(t => {
    const ds = [1];
    t.step(1, { ds });
    ds.push(2);
    t.step(2, { ds });
    t.print('Tổng', P.float(3), { sep: '-' });
    throw P.error('ZeroDivisionError', 'division by zero');
  }, { line: 3 });
  assert.equal(r.trace.length, 3);
  assert.equal(r.trace[0].vars.ds, '[1]', 'ảnh chụp không bị thay đổi về sau');
  assert.equal(r.trace[1].vars.ds, '[1, 2]');
  assert.deepEqual(r.output, ['Tổng-3.0', 'Traceback (most recent call last):', '  Dòng 3', 'ZeroDivisionError: division by zero']);
  assert.deepEqual(r.error, { type: 'ZeroDivisionError', message: 'division by zero', line: 3 });
  assert.equal(r.trace[2].line, 3);
  assert.equal(r.trace[2].error, true);
});

test('bộ ghi bước giới hạn số bước và chuyển lỗi đầu vào thành thông báo tiếng Việt', () => {
  const r = P.execute(t => { for (let i = 0; i < 1000; i++) t.step(1, { i }); return { done: true }; }, { limit: 50 });
  assert.equal(r.trace.length, 50);
  assert.equal(r.truncated, true);
  assert.equal(r.done, true);
  const bad = P.execute(() => { throw P.inputError('Ô số không được để trống.'); });
  assert.equal(bad.error.type, 'InputError');
  assert.equal(bad.inputError, 'Ô số không được để trống.');
  const crash = P.execute(() => { throw new Error('lỗi lập trình'); });
  assert.equal(crash.error.type, 'SimulationError');
});

test('lesson chuẩn hóa bài Python và nhiệm vụ chỉ đọc lịch sử đã chạy', () => {
  const lesson = P.lesson({ id: 'py-x', title: 'Thử', lead: 'Mô tả', group: 'Nền tảng',
    experiment: { defaults: { n: 1 }, controls: [{ key: 'n', label: 'n', type: 'number' }], code: i => ['n = ' + i.n], run: i => P.execute(t => { t.step(1, { n: i.n }); return { n: i.n }; }) },
    tasks: [{ title: 'n bằng 2', desc: 'Đặt n = 2', hint: 'Nhập 2', accept: r => r.n === 2 }], quiz: [], study: {} });
  assert.equal(lesson.course, 'python');
  assert.equal(lesson.group, 'Nền tảng');
  assert.equal(lesson.labs[0].check({ history: [] }).ok, false);
  assert.equal(lesson.labs[0].check({ history: [{ result: lesson.experiment.run({ n: 2 }) }] }).ok, true);
  assert.equal(lesson.labs[0].check({ history: [{ result: { error: { type: 'X' } } }] }).ok, false);
  assert.deepEqual(lesson.experiment.code({ n: 3 }), ['n = 3']);
  const thrown = P.lesson({ id: 'py-y', title: 'T', lead: 'L', experiment: { defaults: {}, controls: [], code: () => [], run: () => { throw new Error('x'); } }, tasks: [], quiz: [], study: {} });
  assert.equal(thrown.experiment.run({}).error.type, 'SimulationError');
});
