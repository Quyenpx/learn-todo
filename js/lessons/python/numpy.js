/* Bài 10 — NumPy: mảng, shape, broadcasting và vector hóa. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const make = (shape, scale) => {
    const size = shape.reduce((s, x) => s * x, 1);
    const base = `np.arange(${size})${shape.length > 1 ? `.reshape(${shape.join(', ')})` : ''}`;
    return scale === 1 ? base : `${base} * ${scale}`;
  };
  const tryShape = (text) => { try { return P.parseShape(text); } catch (e) { return null; } };
  const size = (s) => s.reduce((a, x) => a * x, 1);
  const lesson = P.lesson({
    id: 'py-numpy', icon: '🔢', group: 'Thư viện ML/DL', title: 'NumPy: mảng và broadcasting', navTitle: 'NumPy cơ bản',
    lead: 'Làm việc với mảng nhiều chiều: shape, chỉ số, phép toán trên cả mảng và quy tắc broadcasting.',
    experiment: {
      defaults: { shape_a: '3,1', shape_b: '1,4', phep: '+' },
      controls: [
        { key: 'shape_a', label: 'Shape của a (1–3 chiều, mỗi chiều 1–6)', type: 'text' },
        { key: 'shape_b', label: 'Shape của b', type: 'text' },
        { key: 'phep', label: 'Phép toán', type: 'select', options: [{ value: '+', label: 'a + b' }, { value: '*', label: 'a * b' }] },
      ],
      code: (i) => {
        const sa = tryShape(i.shape_a), sb = tryShape(i.shape_b);
        return [
          'import numpy as np',
          `a = ${sa ? make(sa, 1) : '?'}`,
          `b = ${sb ? make(sb, 10) : '?'}`,
          `c = a ${i.phep === '*' ? '*' : '+'} b`,
          'print(a.shape, b.shape, c.shape)',
          'print(c)',
        ];
      },
      run: (i) => P.execute((t) => {
        const sa = P.parseShape(i.shape_a), sb = P.parseShape(i.shape_b);
        if (!['+', '*'].includes(i.phep)) throw P.inputError('Phép toán không hợp lệ.');
        const a = P.arange(sa), b = P.arange(sb, 10);
        t.step(1, {});
        t.step(2, { a: P.nd(a), 'a.shape': P.tuple(sa) });
        t.step(3, { 'a.shape': P.tuple(sa), b: P.nd(b), 'b.shape': P.tuple(sb) });
        t.step(4, { 'a.shape': P.tuple(sa), 'b.shape': P.tuple(sb) });
        const sc = P.broadcastShape(sa, sb);
        const c = P.broadcastOp(a, b, i.phep === '*' ? (x, y) => x * y : (x, y) => x + y);
        t.step(5, { 'a.shape': P.tuple(sa), 'b.shape': P.tuple(sb), 'c.shape': P.tuple(sc) });
        t.print(P.tuple(sa), P.tuple(sb), P.tuple(sc));
        t.step(6, { c: P.nd(c) });
        t.print(P.ndStr(c));
        return { shapeA: sa, shapeB: sb, shapeC: sc,
          visual: [{ type: 'grid', title: `a ${P.shapeText(sa)}`, data: a }, { type: 'grid', title: `b ${P.shapeText(sb)}`, data: b }, { type: 'grid', title: `c = a ${i.phep} b ${P.shapeText(sc)}`, data: c }] };
      }),
    },
    tasks: [
      { title: 'Tạo lưới bằng broadcasting', desc: 'Kết hợp cột (3, 1) với hàng (1, 4) để được bảng (3, 4) mà không cần vòng lặp.', hint: 'Giữ a là 3,1 và b là 1,4. Mỗi chiều bằng 1 được “kéo giãn” cho khớp chiều kia.', accept: (r) => !r.error && r.shapeA.length === 2 && r.shapeB.length === 2 && r.shapeA.join() !== r.shapeB.join() && size(r.shapeC) > Math.max(size(r.shapeA), size(r.shapeB)) },
      { title: 'Gặp lỗi shape không tương thích', desc: 'Chọn hai shape mà chiều cuối khác nhau và không chiều nào bằng 1.', hint: 'Đặt a là 3,2 và b là 3. So từ phải sang: 2 và 3 khác nhau nên NumPy báo ValueError.', accept: (r) => !!r.error && r.error.type === 'ValueError' },
      { title: 'Cộng một hàng vào mọi dòng', desc: 'Cộng mảng 2 chiều với mảng 1 chiều có độ dài bằng số cột.', hint: 'Đặt a là 2,3 và b là 3. b được dùng lại cho từng dòng của a, giống cộng bias vào mọi mẫu.', accept: (r) => !r.error && r.shapeA.length === 2 && r.shapeB.length === 1 },
      { title: 'Phép toán từng phần tử', desc: 'Dùng hai mảng cùng shape: phép toán áp lên từng cặp phần tử cùng vị trí.', hint: 'Đặt cả a và b là 2,3.', accept: (r) => !r.error && r.shapeA.join() === r.shapeB.join() },
    ],
    quiz: [
      { q: 'np.zeros((2, 3)).shape là gì?', options: ['(3, 2)', '(2, 3)', '6'], answer: 1, explain: 'shape là tuple số phần tử theo từng chiều: 2 dòng, 3 cột.' },
      { q: 'Quy tắc broadcasting so sánh chiều theo hướng nào?', options: ['Từ trái sang phải', 'Từ phải sang trái', 'Ngẫu nhiên'], answer: 1, explain: 'Căn phải hai shape; mỗi cặp chiều phải bằng nhau hoặc một bên bằng 1. Chiều thiếu xem như 1.' },
      { q: 'X có shape (100, 3), mu = X.mean(axis=0) có shape gì?', options: ['(100,)', '(3,)', '(1,)'], answer: 1, explain: 'axis=0 gộp theo dòng, còn lại một giá trị mỗi cột. X - mu chuẩn hóa từng cột nhờ broadcasting.' },
      { q: 'X[:, 0] lấy gì?', options: ['Dòng đầu tiên', 'Cột đầu tiên', 'Phần tử đầu'], answer: 1, explain: 'Dấu : nghĩa là lấy mọi dòng; 0 là cột đầu. X[0] hoặc X[0, :] là dòng đầu.' },
      { q: 'Vì sao nên viết a * 2 thay vì vòng for nhân từng phần tử?', options: ['Vector hóa chạy bằng mã C tối ưu, nhanh hơn nhiều lần', 'Vòng for sai kết quả', 'Không có khác biệt'], answer: 0, explain: 'Phép toán trên cả mảng tránh chi phí vòng lặp Python; với hàng triệu phần tử khác biệt rất lớn.' },
      { q: 'X[X > 0] làm gì?', options: ['Lọc các phần tử dương bằng mặt nạ boolean', 'Đếm phần tử dương', 'Lỗi'], answer: 0, explain: 'X > 0 tạo mảng True/False cùng shape; dùng làm chỉ số để chọn phần tử thỏa điều kiện.' },
    ],
    study: {
      sections: [
        { title: 'Mảng NumPy và shape', html: '<p>NumPy cung cấp <code>ndarray</code>: mảng nhiều chiều cùng kiểu, lưu liên tục trong bộ nhớ. Tạo bằng <code>np.array([[1, 2], [3, 4]])</code>, <code>np.zeros((2, 3))</code>, <code>np.arange(6).reshape(2, 3)</code>. <code>a.shape</code> cho kích thước từng chiều, <code>a.ndim</code> số chiều, <code>a.dtype</code> kiểu phần tử. Trong ML, dữ liệu thường là ma trận X shape (số mẫu, số đặc trưng) và vector nhãn y shape (số mẫu,).</p>' },
        { title: 'Chỉ số, cắt lát và mặt nạ', html: '<p><code>X[i, j]</code> lấy một phần tử; <code>X[:, 0]</code> lấy cột đầu; <code>X[:10]</code> lấy 10 dòng đầu. Mặt nạ boolean <code>X[y == 1]</code> chọn các mẫu có nhãn 1. Lưu ý: cắt lát NumPy trả <b>view</b> (cùng bộ nhớ), sửa view là sửa mảng gốc; dùng <code>.copy()</code> khi cần bản riêng.</p>' },
        { title: 'Broadcasting và vector hóa', html: '<p>Phép toán giữa hai mảng khác shape vẫn chạy nếu, khi căn phải, mỗi cặp chiều bằng nhau hoặc một bên bằng 1; chiều bằng 1 được dùng lại cho khớp. Ví dụ chuẩn hóa <code>(X - X.mean(axis=0)) / X.std(axis=0)</code>: (100, 3) với (3,). Shape không khớp gây <code>ValueError: operands could not be broadcast together</code>. Mô phỏng vẽ lưới a, b, c để bạn thấy giá trị được dùng lại. Viết phép toán trên cả mảng (vector hóa) thay vòng lặp giúp chương trình nhanh hơn nhiều lần.</p>' },
      ],
      practice: {
        title: 'Thực hành: chuẩn hóa dữ liệu bằng NumPy', goal: 'Dùng shape, axis và broadcasting đúng.',
        steps: ['Cài thư viện theo examples/python/requirements.txt và mở notebooks/10_numpy_co_ban.ipynb.', 'Hoàn thành chuan_hoa(X) trả mảng có trung bình 0, độ lệch chuẩn 1 theo từng cột.', 'Hoàn thành khoang_cach(X, diem) tính khoảng cách Euclid từ mọi dòng tới một điểm, không dùng vòng for.', 'So sánh thời gian vòng for và vector hóa với 100 000 phần tử.'],
        expected: 'chuan_hoa(X).mean(axis=0) xấp xỉ [0, 0]; phiên bản vector hóa nhanh hơn rõ rệt.',
        troubleshooting: ['ValueError broadcast: in X.shape và shape của toán hạng kia, căn phải để so.', 'Chia cho 0 khi cột hằng số: thay độ lệch chuẩn 0 bằng 1.'],
        downloads: P.notebookLinks('10_numpy_co_ban'),
      },
      references: [
        { title: 'NumPy: the absolute basics for beginners', url: 'https://numpy.org/doc/stable/user/absolute_beginners.html', topic: 'NumPy', note: 'Tạo mảng, shape, chỉ số, phép toán cơ bản cho người mới.', checked: '07/10/2026' },
        { title: 'NumPy: Broadcasting', url: 'https://numpy.org/doc/stable/user/basics.broadcasting.html', topic: 'Broadcasting', note: 'Quy tắc broadcasting chính thức kèm hình minh họa.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
