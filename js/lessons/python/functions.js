/* Bài 6 — Hàm: tham số, giá trị mặc định, return, phạm vi biến; viết hàm dự đoán và MSE. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const lesson = P.lesson({
    id: 'py-functions', icon: '🧩', group: 'Cấu trúc dữ liệu', title: 'Hàm', navTitle: 'Hàm',
    lead: 'Đóng gói phép tính thành hàm có tham số và return; tự viết hàm dự đoán tuyến tính và sai số MSE.',
    experiment: {
      defaults: { xs: '1, 2, 3', w: 1.5, b: 0, co_return: 'co' },
      controls: [
        { key: 'xs', label: 'Dữ liệu xs (nhãn thật ys = 2 * x)', type: 'text' },
        { key: 'w', label: 'Trọng số w', type: 'number', step: 0.5 },
        { key: 'b', label: 'Hệ số tự do b', type: 'number', step: 0.5 },
        { key: 'co_return', label: 'Thân hàm du_doan', type: 'select', options: [{ value: 'co', label: 'Có return' }, { value: 'khong', label: 'Quên return' }] },
      ],
      code: (i) => {
        let xs;
        try { xs = P.repr(P.parseList(i.xs, 'xs', { max: 10 })); } catch (e) { xs = '[?]'; }
        const n = (v) => (Number.isFinite(v) ? P.repr(v) : '?');
        return [
          'def du_doan(x, w, b=0.0):',
          i.co_return === 'khong' ? '    w * x + b          # quên return nên hàm trả về None' : '    return w * x + b',
          '',
          'def mse(ys, ys_hat):',
          '    tong = 0',
          '    for y, yh in zip(ys, ys_hat):',
          '        tong += (y - yh) ** 2',
          '    return tong / len(ys)',
          '',
          `xs = ${xs}`,
          'ys = [2 * x for x in xs]',
          `ys_hat = [du_doan(x, w=${n(i.w)}, b=${n(i.b)}) for x in xs]`,
          'print(ys_hat)',
          'print(mse(ys, ys_hat))',
        ];
      },
      run: (i) => P.execute((t) => {
        const xs = P.parseList(i.xs, 'xs', { max: 10 });
        const w = P.num(i.w, 'w', { min: -100, max: 100 }), b = P.num(i.b, 'b', { min: -100, max: 100 });
        const allInt = xs.every(Number.isInteger) && Number.isInteger(w) && Number.isInteger(b);
        const num = (v) => (v === null ? null : allInt ? v : P.float(v));
        const ys = xs.map((x) => 2 * x);
        t.step(10, { xs });
        t.step(11, { xs, ys });
        const ysHat = xs.map((x) => { t.step(2, { x, w, b }); return i.co_return === 'khong' ? null : w * x + b; });
        t.step(12, { xs, ys, ys_hat: ysHat.map(num) });
        t.step(13, { ys_hat: ysHat.map(num) });
        t.print(ysHat.map(num));
        t.step(14, { ys, ys_hat: ysHat.map(num) });
        let tong = 0;
        t.step(5, { tong });
        for (let k = 0; k < ys.length; k++) {
          const y = ys[k], yh = ysHat[k];
          t.step(6, { y, yh: num(yh), tong: k ? num(tong) : tong });
          if (yh === null) throw P.error('TypeError', `unsupported operand type(s) for -: '${Number.isInteger(y) && xs.every(Number.isInteger) ? 'int' : 'float'}' and 'NoneType'`, 7);
          tong += (y - yh) ** 2;
          t.step(7, { y, yh: num(yh), tong: num(tong) });
        }
        t.step(8, { tong: ys.length ? num(tong) : tong, 'len(ys)': ys.length });
        if (!ys.length) throw P.error('ZeroDivisionError', 'division by zero', 8);
        const mse = tong / ys.length;
        t.step(14, { ys, ys_hat: ysHat.map(num), 'mse(...)': P.float(mse) });
        t.print(P.float(mse));
        return { mse, ys, ys_hat: ysHat, visual: { type: 'table', title: 'So sánh nhãn thật và dự đoán', columns: ['x', 'y thật', 'y dự đoán', '(y − ŷ)²'], rows: xs.map((x, k) => [x, ys[k], P.round(ysHat[k], 4), P.round((ys[k] - ysHat[k]) ** 2, 4)]) } };
      }),
    },
    tasks: [
      { title: 'Tìm tham số hoàn hảo', desc: 'Chọn w và b để dự đoán trùng nhãn thật ys = 2 * x, tức MSE bằng 0.', hint: 'Đặt w = 2 và b = 0.', accept: (r) => !r.error && r.mse === 0 },
      { title: 'Đo sai số khác 0', desc: 'Chọn tham số lệch để MSE dương. Bảng bên dưới cho thấy đóng góp của từng mẫu.', hint: 'Đặt w = 1.5, b = 1. Mẫu càng lệch thì bình phương sai số càng lớn.', accept: (r) => !r.error && r.mse > 0 },
      { title: 'Thấy hậu quả của quên return', desc: 'Chọn “Quên return”. Hàm vẫn chạy nhưng trả None, lỗi xuất hiện ở chỗ khác.', hint: 'Chọn Quên return rồi chạy. Lỗi TypeError ở dòng 7 vì y − None không tính được.', accept: (r) => !!r.error && r.error.type === 'TypeError' && r.error.message.includes('NoneType') },
      { title: 'Danh sách rỗng', desc: 'Xóa hết dữ liệu xs. Hàm mse chia cho len(ys) bằng 0.', hint: 'Xóa trống ô xs. Hàm tốt nên kiểm tra đầu vào rỗng và báo lỗi rõ ràng trước khi chia.', accept: (r) => !!r.error && r.error.type === 'ZeroDivisionError' },
    ],
    quiz: [
      { q: 'Hàm không có lệnh return trả về gì?', options: ['0', 'None', 'Lỗi ngay khi gọi'], answer: 1, explain: 'Hàm thiếu return trả None. Lỗi chỉ lộ ra khi dùng giá trị đó, như phép trừ ở dòng 7.' },
      { q: 'Trong def du_doan(x, w, b=0.0), b=0.0 nghĩa là gì?', options: ['b bắt buộc', 'b có giá trị mặc định 0.0 nếu không truyền', 'b luôn bằng 0'], answer: 1, explain: 'Tham số có giá trị mặc định có thể bỏ qua khi gọi: du_doan(3, 2) dùng b = 0.0.' },
      { q: 'Gọi du_doan(x=3, w=2) dùng kiểu truyền tham số nào?', options: ['Theo vị trí', 'Theo tên (keyword)', 'Không hợp lệ'], answer: 1, explain: 'Truyền theo tên làm lời gọi dễ đọc và không phụ thuộc thứ tự; thư viện ML dùng rất nhiều, ví dụ test_size=0.2.' },
      { q: 'Biến tong tạo trong hàm mse có dùng được bên ngoài hàm không?', options: ['Có', 'Không, nó là biến cục bộ', 'Chỉ khi hàm đã chạy'], answer: 1, explain: 'Biến tạo trong hàm thuộc phạm vi cục bộ. Muốn dùng kết quả, hãy return nó.' },
      { q: 'Vì sao không nên dùng def f(ds=[]) làm giá trị mặc định?', options: ['List mặc định được tạo một lần và dùng chung giữa các lần gọi', 'Python cấm', 'Chạy chậm'], answer: 0, explain: 'Giá trị mặc định tính một lần lúc định nghĩa hàm. Dùng ds=None rồi tạo list mới trong thân hàm.' },
      { q: 'MSE (Mean Squared Error) tính thế nào?', options: ['Trung bình bình phương sai lệch giữa nhãn và dự đoán', 'Tổng nhãn', 'Số mẫu sai'], answer: 0, explain: 'MSE = (1/n)·Σ(y − ŷ)². Bình phương làm sai số lớn bị phạt nặng; đơn vị là bình phương đơn vị nhãn.' },
    ],
    study: {
      sections: [
        { title: 'Định nghĩa và gọi hàm', html: '<p><code>def ten_ham(tham_so):</code> định nghĩa hàm; thân hàm thụt lề. <code>return gia_tri</code> trả kết quả và kết thúc hàm. Gọi hàm bằng <code>ten_ham(doi_so)</code>. Hàm giúp đặt tên cho một phép tính, tái sử dụng và kiểm thử riêng. Mỗi hàm nên làm một việc rõ ràng, ví dụ <code>du_doan</code> chỉ dự đoán, <code>mse</code> chỉ đo sai số.</p>' },
        { title: 'Tham số, giá trị mặc định, phạm vi', html: '<p>Tham số có thể truyền theo vị trí <code>du_doan(3, 2)</code> hoặc theo tên <code>du_doan(x=3, w=2)</code>. Giá trị mặc định <code>b=0.0</code> cho phép bỏ qua tham số. Biến tạo trong hàm là <b>cục bộ</b>, biến mất khi hàm kết thúc. <code>lambda x: 2 * x</code> tạo hàm ngắn một biểu thức, hay dùng làm khóa sắp xếp: <code>sorted(ds, key=lambda p: p[1])</code>. Viết docstring (chuỗi mô tả ngay dưới def) để người khác biết hàm nhận gì, trả gì.</p>' },
        { title: 'Hàm trong học máy', html: '<p>Mô hình tuyến tính một biến là hàm <code>y_hat = w * x + b</code>; hàm mất mát MSE đo mức lệch trung bình. Huấn luyện là tìm w, b làm MSE nhỏ nhất. Trong mô phỏng, đặt w = 2, b = 0 làm MSE bằng 0 vì dữ liệu sinh từ y = 2x không nhiễu. Hai lỗi kinh điển: quên return (lỗi lộ ra ở nơi khác) và chia cho độ dài danh sách rỗng. Thư viện thật kiểm tra đầu vào sớm và báo lỗi rõ; hàm của bạn cũng nên làm vậy.</p>' },
      ],
      practice: {
        title: 'Thực hành: hàm dự đoán và hàm mất mát', goal: 'Viết hàm có kiểm tra đầu vào và kiểm thử.',
        steps: ['Mở notebooks/06_ham.ipynb.', 'Hoàn thành du_doan(x, w, b=0.0).', 'Hoàn thành mse(ys, ys_hat): báo ValueError khi hai danh sách rỗng hoặc khác độ dài.', 'Hoàn thành mae(ys, ys_hat) và so sánh với mse trên dữ liệu có một điểm ngoại lai.'],
        expected: 'mse([2, 4], [2, 4]) bằng 0.0; mse([], []) báo ValueError có thông báo tiếng Việt.',
        troubleshooting: ['TypeError với NoneType: kiểm tra hàm có return chưa.', 'Kết quả số thực lệch rất nhỏ: so sánh bằng math.isclose.'],
        downloads: P.notebookLinks('06_ham'),
      },
      references: [
        { title: 'Defining Functions (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/controlflow.html#defining-functions', topic: 'Hàm', note: 'Cú pháp def, giá trị mặc định, tham số theo tên, lambda và docstring.', checked: '07/10/2026' },
        { title: 'scikit-learn: mean_squared_error', url: 'https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_squared_error.html', topic: 'Hàm mất mát', note: 'So sánh hàm tự viết với hàm MSE của thư viện thực tế.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
