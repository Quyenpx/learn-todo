/*
 * Kiểm thử lõi tính toán bằng trình chạy test có sẵn của Node.js (node --test).
 * Mục đích: đảm bảo các mô phỏng trên giao diện hiển thị đúng kết quả toán học.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/ml-math.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} không xấp xỉ ${b}`);

test('Gradient Descent tính tay khớp với tài liệu (y = 2x)', () => {
  const pts = [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }];
  // Mô hình chỉ có w (b cố định 0) nên tự tính gradient theo w
  const g = M.linearGradients(pts, 0, 0);
  close(g.dw, -18.667);
  const w1 = 0 - 0.1 * g.dw;
  close(w1, 1.867);
  const g2 = M.linearGradients(pts, w1, 0);
  close(w1 - 0.1 * g2.dw, 1.991);
});

test('Gradient Descent hội tụ về nghiệm bình phương tối thiểu', () => {
  const r = M.mulberry32(3);
  const pts = Array.from({ length: 30 }, () => { const x = r() * 2; return { x, y: 1.5 * x + 0.5 + M.gaussian(r) * 0.3 }; });
  const opt = M.linearOptimum(pts);
  let w = -1, b = 3;
  for (let i = 0; i < 500; i++) ({ w, b } = M.linearStep(pts, w, b, 0.3));
  close(w, opt.w, 1e-3);
  close(b, opt.b, 1e-3);
});

test('Learning rate quá lớn làm Gradient Descent phân kỳ', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ x: (i / 19) * 2, y: i / 10 }));
  let s = { w: 0, b: 0, loss: 0 };
  for (let i = 0; i < 100; i++) s = M.linearStep(pts, s.w, s.b, 0.6);
  assert.ok(!(s.loss < 1e3), 'loss phải tăng vọt khi lr = 0.6');
});

test('polyFit khôi phục đúng đa thức không nhiễu', () => {
  const xs = [-1, -0.5, 0, 0.5, 1, 0.25];
  const ys = xs.map((x) => 1 - 2 * x + 3 * x * x);
  const c = M.polyFit(xs, ys, 2);
  close(c[0], 1, 1e-6); close(c[1], -2, 1e-6); close(c[2], 3, 1e-6);
  close(M.polyEval(c, 2), 1 - 4 + 12, 1e-5);
});

test('Bậc đa thức cao gây overfitting: lỗi train giảm, lỗi test tăng', () => {
  const r = M.mulberry32(7);
  const f = (x) => Math.sin(Math.PI * x * 0.9) * 0.8 + 0.2 * x;
  const mk = (n) => Array.from({ length: n }, () => { const x = r() * 2 - 1; return [x, f(x) + M.gaussian(r) * 0.2]; });
  const train = mk(12), testSet = mk(200);
  const err = (deg) => {
    const c = M.polyFit(train.map((p) => p[0]), train.map((p) => p[1]), deg);
    const e = (set) => M.mse(set.map((p) => M.polyEval(c, p[0])), set.map((p) => p[1]));
    return { train: e(train), test: e(testSet) };
  };
  const good = err(3), over = err(11);
  assert.ok(over.train < good.train, 'lỗi train của bậc 11 phải nhỏ hơn');
  assert.ok(over.test > good.test, 'lỗi test của bậc 11 phải lớn hơn');
});

test('Backpropagation một nơ-ron khớp ví dụ tính tay', () => {
  const r = M.neuronBackward({ x: 2, w: 0.5, b: 0, y: 1, activation: 'sigmoid' });
  close(r.a, 0.7311, 1e-4);
  close(r.loss, 0.0723, 1e-4);
  close(r.dL_dw, -0.2115, 1e-4);
  close(0.5 - 0.5 * r.dL_dw, 0.6058, 1e-4);
});

test('Gradient của MLP khớp với gradient tính bằng sai phân hữu hạn', () => {
  const net = new M.MLP([2, 3, 1], 'tanh', 5);
  const X = [[0.3, -0.7]], Y = [1];
  const lossOf = (n) => { const p = n.predict(X[0]); return -Math.log(p); };
  const h = 1e-5, w0 = net.W[0][1][0];
  net.W[0][1][0] = w0 + h; const lp = lossOf(net);
  net.W[0][1][0] = w0 - h; const lm = lossOf(net);
  net.W[0][1][0] = w0;
  const numeric = (lp - lm) / (2 * h);
  // lr = 1 trên 1 mẫu: độ thay đổi trọng số đúng bằng gradient giải tích
  net.trainBatch(X, Y, 1);
  const analytic = w0 - net.W[0][1][0];
  close(analytic, numeric, 1e-6);
});

const trainUntil = (type, sizes, act, lr, epochs, seed = 11) => {
  const data = M.makeDataset(type, 200, 0.03, seed);
  const X = data.map((d) => d.x), Y = data.map((d) => d.y);
  const net = new M.MLP(sizes, act, 3);
  for (let e = 0; e < epochs; e++) net.trainBatch(X, Y, lr);
  return net.accuracy(X, Y);
};

test('Không có lớp ẩn thì không giải được bài vòng tròn', () => {
  assert.ok(trainUntil('circle', [2, 1], 'tanh', 0.3, 400) < 0.8);
});

test('Có lớp ẩn thì giải được vòng tròn và XOR', () => {
  assert.ok(trainUntil('circle', [2, 6, 1], 'tanh', 0.3, 1500) >= 0.95, 'circle');
  assert.ok(trainUntil('xor', [2, 6, 1], 'tanh', 0.3, 1500) >= 0.95, 'xor');
});

test('Thử thách xoắn ốc giải được trong số epoch hợp lý', () => {
  const acc = trainUntil('spiral', [2, 8, 8, 1], 'tanh', 0.3, 6000);
  console.log('  độ chính xác xoắn ốc:', acc);
  assert.ok(acc >= 0.9);
});

test('K-Means tìm lại đúng số cụm và inertia giảm khi k tăng', () => {
  const { points } = M.makeBlobs(4, 40, 0.08, 2);
  const inertias = [1, 2, 3, 4, 5, 6].map((k) => M.kmeansRun(points, k, 1).inertia);
  for (let i = 1; i < inertias.length; i++) assert.ok(inertias[i] <= inertias[i - 1] + 1e-9);
  // "Khuỷu tay": mức giảm từ 3→4 lớn hơn nhiều so với 4→5
  assert.ok(inertias[2] - inertias[3] > 3 * (inertias[3] - inertias[4]));
});
