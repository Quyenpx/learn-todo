/* Bài 11 — NumPy đại số tuyến tính: ma trận, phép nhân @, tự viết gradient descent vector hóa. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const N = 20;
  // Dữ liệu cố định: y = 2 + 3x + nhiễu; nhiễu sinh bằng bộ sinh có seed nên khác giá trị NumPy thật
  const data = (() => {
    const rand = P.rng(7), x = [], y = [];
    for (let k = 0; k < N; k++) {
      const xi = -1 + (2 * k) / (N - 1);
      const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
      x.push(xi); y.push(2 + 3 * xi + 0.2 * g);
    }
    // Nghiệm bình phương tối thiểu để đo khoảng cách tới điểm tối ưu
    const sx = x.reduce((s, v) => s + v, 0), sxx = x.reduce((s, v) => s + v * v, 0), sy = y.reduce((s, v) => s + v, 0), sxy = x.reduce((s, v, k) => s + v * y[k], 0);
    const det = N * sxx - sx * sx;
    return { x, y, best: [(sxx * sy - sx * sxy) / det, (N * sxy - sx * sy) / det] };
  })();
  const mse = (w) => data.x.reduce((s, xi, k) => s + (w[0] + w[1] * xi - data.y[k]) ** 2, 0) / N;
  const fmt = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf') : Math.abs(v) >= 1e8 ? v.toExponential(3).replace(/e([+-])(\d)$/, 'e$10$2') : Number.isInteger(P.round(v, 4)) ? P.round(v, 4) + '.' : String(P.round(v, 4)));
  const ndFloat = (w) => '[' + w.map(fmt).join(' ') + ']';
  const lesson = P.lesson({
    id: 'py-linalg', icon: '📐', group: 'Thư viện ML/DL', title: 'NumPy: đại số tuyến tính', navTitle: 'NumPy đại số tuyến tính',
    lead: 'Biểu diễn hồi quy tuyến tính bằng ma trận, nhân ma trận với @ và tự viết gradient descent không vòng lặp từng mẫu.',
    experiment: {
      defaults: { lr: 0.1, so_vong: 100, dang_X: 'n2' },
      controls: [
        { key: 'lr', label: 'Tốc độ học lr', type: 'number', step: 0.05 },
        { key: 'so_vong', label: 'Số vòng (0–500)', type: 'number', step: 1 },
        { key: 'dang_X', label: 'Cách tạo X', type: 'select', options: [{ value: 'n2', label: 'X shape (20, 2) — đúng' }, { value: 't', label: 'Lỡ chuyển vị: X shape (2, 20)' }] },
      ],
      code: (i) => [
        'import numpy as np',
        'x = np.linspace(-1, 1, 20)',
        'y = 2 + 3 * x + 0.2 * nhieu          # nhiễu cố định của mô phỏng',
        i.dang_X === 't' ? 'X = np.c_[np.ones(20), x].T         # lỡ chuyển vị: shape (2, 20)' : 'X = np.c_[np.ones(20), x]           # cột 1 cho hệ số tự do; shape (20, 2)',
        'w = np.zeros(2)',
        `for vong in range(${Number.isFinite(i.so_vong) ? i.so_vong : '?'}):`,
        '    y_hat = X @ w',
        '    grad = 2 / 20 * X.T @ (y_hat - y)',
        `    w = w - ${Number.isFinite(i.lr) ? P.repr(i.lr) : '?'} * grad`,
        'print(np.round(w, 4), round(float(np.mean((X @ w - y) ** 2)), 4))',
      ],
      run: (i) => P.execute((t) => {
        const lr = P.num(i.lr, 'lr', { min: 0.001, max: 5 });
        const soVong = P.num(i.so_vong, 'Số vòng', { min: 0, max: 500, integer: true });
        if (!['n2', 't'].includes(i.dang_X)) throw P.inputError('Cách tạo X không hợp lệ.');
        const shapeX = i.dang_X === 't' ? [2, N] : [N, 2];
        let w = [0, 0];
        const loss0 = mse(w), history = [loss0];
        t.step(1, {});
        t.step(2, { 'x.shape': P.tuple([N]) });
        t.step(3, { 'y.shape': P.tuple([N]) });
        t.step(4, { 'X.shape': P.tuple(shapeX) });
        t.step(5, { w: P.nd(w, { float: true }) });
        for (let v = 0; v < soVong; v++) {
          const show = v < 2 || v === soVong - 1;
          if (show) t.step(6, { vong: v, w: P.raw('array(' + ndFloat(w) + ')') });
          if (show) t.step(7, { 'X.shape': P.tuple(shapeX), 'w.shape': P.tuple([2]) });
          P.matmulShape(shapeX, [2]);
          const res = data.x.map((xi, k) => w[0] + w[1] * xi - data.y[k]);
          const grad = [(2 / N) * res.reduce((s, r) => s + r, 0), (2 / N) * res.reduce((s, r, k) => s + r * data.x[k], 0)];
          if (show) t.step(8, { grad: P.raw('array(' + ndFloat(grad) + ')') });
          w = [w[0] - lr * grad[0], w[1] - lr * grad[1]];
          history.push(mse(w));
          if (show) t.step(9, { vong: v, w: P.raw('array(' + ndFloat(w) + ')'), loss: P.float(P.round(history[history.length - 1], 6)) });
        }
        const loss = mse(w);
        t.step(10, { w: P.raw('array(' + ndFloat(w) + ')') });
        t.print(ndFloat(w), Number.isFinite(loss) ? P.float(P.round(loss, 4)) : P.float(loss));
        const dist = Math.hypot(w[0] - data.best[0], w[1] - data.best[1]);
        return { loss0, loss, dist, w,
          visual: { type: 'chart', title: 'MSE theo vòng (trục log)', xlabel: 'vòng', ylabel: 'MSE', logY: true, series: [{ label: 'MSE', data: history.map((v) => (Number.isFinite(v) ? Math.min(v, 1e12) : 1e12)), color: '#ffd43b' }] } };
      }, { limit: 60 }),
    },
    tasks: [
      { title: 'Huấn luyện tới hội tụ', desc: 'Với lr và số vòng phù hợp, w tiến sát nghiệm tối ưu (gần [2, 3]).', hint: 'Giữ lr = 0.1, 100 vòng. w ≈ [2, 3] và MSE gần mức nhiễu.', accept: (r) => !r.error && r.dist < 0.01 },
      { title: 'Làm thuật toán phân kỳ', desc: 'Tăng lr quá lớn để MSE tăng thay vì giảm.', hint: 'Đặt lr = 1.2. Bước nhảy vượt qua điểm tối ưu, mỗi vòng xa hơn.', accept: (r) => !r.error && (!Number.isFinite(r.loss) || r.loss > r.loss0) },
      { title: 'Dừng quá sớm', desc: 'Giảm số vòng để MSE đã giảm nhưng w còn xa nghiệm tối ưu.', hint: 'Đặt 3 vòng. Biểu đồ cho thấy MSE đang giảm thì bị cắt ngang.', accept: (r) => !r.error && r.loss < r.loss0 && r.dist > 0.1 },
      { title: 'Bắt lỗi shape khi nhân ma trận', desc: 'Chọn X bị chuyển vị. Phép X @ w cần số cột của X bằng độ dài w.', hint: 'Chọn “Lỡ chuyển vị”. (2, 20) @ (2,) không khớp vì 20 ≠ 2.', accept: (r) => !!r.error && r.error.type === 'ValueError' && r.error.message.includes('matmul') },
    ],
    quiz: [
      { q: 'A shape (20, 2), w shape (2,). A @ w có shape gì?', options: ['(2,)', '(20,)', '(20, 2)'], answer: 1, explain: 'Nhân ma trận (n, k) @ (k,) cho (n,): mỗi dòng của A nhân vô hướng với w.' },
      { q: 'A * B khác A @ B thế nào?', options: ['* nhân từng phần tử, @ nhân ma trận', 'Giống nhau', '@ chỉ dùng cho số'], answer: 0, explain: '* áp dụng broadcasting từng phần tử; @ tính tổng tích theo hàng-cột.' },
      { q: 'Vì sao thêm cột toàn số 1 vào X?', options: ['Để hệ số tự do b trở thành một phần của w', 'Để tăng số mẫu', 'Để tránh chia cho 0'], answer: 0, explain: 'X = [1, x] khiến y_hat = w0·1 + w1·x, gộp b vào phép nhân ma trận.' },
      { q: 'Công thức gradient của MSE theo w là gì?', options: ['(2/n)·Xᵀ(Xw − y)', 'Xw − y', 'yᵀy'], answer: 0, explain: 'Đạo hàm của (1/n)||Xw − y||² theo w là (2/n)·Xᵀ(Xw − y). Một dòng NumPy tính cho mọi mẫu.' },
      { q: 'lr quá lớn gây ra gì?', options: ['Hội tụ nhanh hơn mãi', 'Có thể vượt qua điểm tối ưu và phân kỳ', 'Không ảnh hưởng'], answer: 1, explain: 'Bước quá dài nhảy qua lại quanh đáy và ngày càng xa. Hãy thử lr theo thang 0.001, 0.01, 0.1.' },
      { q: 'Lỗi “matmul: ... mismatch in its core dimension” thường do đâu?', options: ['Shape hai toán hạng không khớp, ví dụ quên chuyển vị hoặc chuyển vị thừa', 'Thiếu RAM', 'Sai phiên bản Python'], answer: 0, explain: 'In shape của từng toán hạng trước phép nhân là cách gỡ lỗi nhanh nhất.' },
    ],
    study: {
      sections: [
        { title: 'Viết mô hình bằng ma trận', html: '<p>Với n mẫu và một đặc trưng, ghép ma trận <code>X = np.c_[np.ones(n), x]</code> shape (n, 2) và vector tham số <code>w</code> shape (2,). Dự đoán cho mọi mẫu: <code>y_hat = X @ w</code>. Toán tử <code>@</code> là nhân ma trận; <code>*</code> là nhân từng phần tử. <code>X.T</code> là ma trận chuyển vị. Quy tắc shape: (n, k) @ (k, m) cho (n, m); số ở giữa phải bằng nhau.</p>' },
        { title: 'Gradient descent vector hóa', html: '<p>MSE = mean((Xw − y)²). Gradient theo w là <code>2 / n * X.T @ (X @ w - y)</code>. Mỗi vòng cập nhật <code>w = w - lr * grad</code>. Không có vòng lặp qua từng mẫu: NumPy tính trên cả ma trận. Mô phỏng ghi lại hai vòng đầu và vòng cuối (để khung bước gọn), vẽ MSE theo vòng trên trục log, và so w với nghiệm tối ưu tính bằng công thức đóng.</p>' },
        { title: 'Gỡ lỗi shape và chọn lr', html: '<p>Phần lớn lỗi khi viết mô hình là lỗi shape. Thói quen tốt: <code>print(X.shape, w.shape)</code> trước phép nhân, và <code>assert y_hat.shape == y.shape</code>. Cẩn thận broadcasting ngầm: y shape (n, 1) trừ y_hat shape (n,) cho ma trận (n, n), không báo lỗi nhưng sai. Với lr: quá nhỏ hội tụ chậm, quá lớn phân kỳ. Chuẩn hóa đặc trưng giúp dùng lr lớn hơn mà vẫn ổn định.</p>' },
      ],
      practice: {
        title: 'Thực hành: hồi quy tuyến tính bằng NumPy', goal: 'Tự cài gradient descent và đối chiếu nghiệm đóng.',
        steps: ['Mở notebooks/11_numpy_dai_so.ipynb.', 'Hoàn thành gradient(X, y, w) và huan_luyen(X, y, lr, so_vong) trả w và lịch sử loss.', 'So sánh với nghiệm np.linalg.lstsq(X, y, rcond=None).', 'Thử bẫy shape: tạo y shape (n, 1) và quan sát ma trận (n, n) xuất hiện.'],
        expected: 'w từ gradient descent sai khác nghiệm lstsq dưới 1e-3; loss giảm đơn điệu với lr = 0.1.',
        troubleshooting: ['Loss tăng tới inf: giảm lr.', 'Kết quả sai mà không lỗi: in shape của y và y_hat, dùng y.ravel() để về 1 chiều.'],
        downloads: P.notebookLinks('11_numpy_dai_so'),
      },
      references: [
        { title: 'numpy.matmul', url: 'https://numpy.org/doc/stable/reference/generated/numpy.matmul.html', topic: 'Nhân ma trận', note: 'Quy tắc shape của @ với mảng 1 chiều, 2 chiều và nhiều chiều.', checked: '07/10/2026' },
        { title: 'numpy.linalg.lstsq', url: 'https://numpy.org/doc/stable/reference/generated/numpy.linalg.lstsq.html', topic: 'Bình phương tối thiểu', note: 'Nghiệm đóng dùng để kiểm tra kết quả gradient descent.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
