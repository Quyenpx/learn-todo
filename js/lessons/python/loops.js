/* Bài 4 — Vòng lặp: while, for, range, break; mô hình hóa vòng lặp giảm loss. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const show = (v) => (Number.isFinite(v) ? P.repr(v) : '?');
  const lesson = P.lesson({
    id: 'py-loops', icon: '🔁', group: 'Nền tảng', title: 'Vòng lặp', navTitle: 'Vòng lặp',
    lead: 'Lặp với for và while, biết khi nào vòng lặp dừng, tránh lặp vô hạn — nền tảng của vòng huấn luyện.',
    experiment: {
      defaults: { nguong: 0.01, he_so: 0.5, toi_da: 20 },
      controls: [
        { key: 'nguong', label: 'nguong — dừng khi loss nhỏ hơn hoặc bằng', type: 'number', step: 0.01 },
        { key: 'he_so', label: 'he_so — loss nhân với số này mỗi vòng', type: 'number', step: 0.1 },
        { key: 'toi_da', label: 'toi_da — số vòng tối đa (1–50)', type: 'number', step: 1 },
      ],
      code: (i) => [
        'loss = 1.0',
        'buoc = 0',
        `while loss > ${show(i.nguong)} and buoc < ${show(i.toi_da)}:`,
        `    loss = loss * ${show(i.he_so)}`,
        '    buoc += 1',
        'print(buoc, round(loss, 4))',
      ],
      run: (i) => P.execute((t) => {
        const nguong = P.num(i.nguong, 'nguong', { min: 0, max: 10 });
        const heSo = P.num(i.he_so, 'he_so', { min: 0, max: 3 });
        const toiDa = P.num(i.toi_da, 'toi_da', { min: 1, max: 50, integer: true });
        let loss = 1, buoc = 0;
        const history = [loss];
        t.step(1, { loss: P.float(loss) });
        t.step(2, { loss: P.float(loss), buoc });
        for (;;) {
          const cond = loss > nguong && buoc < toiDa;
          t.step(3, { loss: P.float(loss), buoc, 'điều kiện': cond });
          if (!cond) break;
          loss *= heSo;
          t.step(4, { loss: P.float(loss), buoc });
          buoc += 1;
          history.push(loss);
          t.step(5, { loss: P.float(loss), buoc });
        }
        t.step(6, { loss: P.float(loss), buoc });
        t.print(buoc, P.float(P.round(loss, 4)));
        let lyDo;
        if (buoc === 0) lyDo = 'khong_lap';
        else if (loss <= nguong) lyDo = 'dat_nguong';
        else if (heSo === 1) lyDo = 'dung_yen';
        else if (heSo > 1) lyDo = 'phan_ky';
        else lyDo = 'het_luot';
        return { buoc, loss, ly_do: lyDo, visual: { type: 'chart', title: 'loss sau mỗi vòng', xlabel: 'vòng', ylabel: 'loss', series: [{ label: 'loss', data: history, color: '#ffd43b', dots: true }] } };
      }),
    },
    tasks: [
      { title: 'Dừng vì đạt ngưỡng', desc: 'Giữ he_so nhỏ hơn 1 để loss giảm dần cho tới khi không còn lớn hơn nguong.', hint: 'Giữ mặc định 0.01 / 0.5 / 20. Sau 7 vòng loss = 0.0078 nên điều kiện sai và vòng lặp dừng.', accept: (r) => !r.error && r.ly_do === 'dat_nguong' },
      { title: 'Ngăn lặp vô hạn', desc: 'Đặt he_so = 1 để loss không đổi. Điều gì giúp vòng lặp vẫn dừng?', hint: 'Đặt he_so là 1. Nếu thiếu điều kiện buoc < toi_da, vòng while sẽ chạy mãi.', accept: (r) => !r.error && r.ly_do === 'dung_yen' },
      { title: 'Quan sát phân kỳ', desc: 'Đặt he_so lớn hơn 1 để loss tăng sau mỗi vòng.', hint: 'Đặt he_so là 1.5. Trong huấn luyện thật, learning rate quá lớn cũng làm loss tăng như vậy.', accept: (r) => !r.error && r.ly_do === 'phan_ky' },
      { title: 'Vòng lặp không chạy lần nào', desc: 'Chọn nguong để điều kiện sai ngay từ đầu.', hint: 'Đặt nguong là 1. Vì 1.0 > 1 sai, thân vòng lặp chạy 0 lần.', accept: (r) => !r.error && r.ly_do === 'khong_lap' },
    ],
    quiz: [
      { q: 'range(1, 5) sinh ra những số nào?', options: ['1, 2, 3, 4, 5', '1, 2, 3, 4', '0, 1, 2, 3, 4'], answer: 1, explain: 'range(start, stop) gồm start nhưng không gồm stop. range(5) là 0..4.' },
      { q: 'Khi nào dùng while thay vì for?', options: ['Khi biết trước số lần lặp', 'Khi lặp tới lúc một điều kiện thay đổi', 'Không bao giờ'], answer: 1, explain: 'for duyệt qua dãy có sẵn; while lặp theo điều kiện, ví dụ huấn luyện tới khi loss đủ nhỏ.' },
      { q: 'break làm gì?', options: ['Bỏ qua phần còn lại của vòng hiện tại', 'Thoát hẳn vòng lặp', 'Dừng chương trình'], answer: 1, explain: 'break thoát vòng lặp gần nhất; continue bỏ qua phần còn lại và sang vòng kế.' },
      { q: 'Vì sao nên thêm giới hạn số vòng cho while?', options: ['Để tránh lặp vô hạn khi điều kiện không bao giờ sai', 'Để chạy nhanh hơn', 'Python bắt buộc'], answer: 0, explain: 'Huấn luyện thực tế luôn có số epoch tối đa hoặc dừng sớm, phòng trường hợp không hội tụ.' },
      { q: 'for i, x in enumerate(["a", "b"]) cho các cặp nào?', options: ['(0, "a"), (1, "b")', '("a", 0), ("b", 1)', '(1, "a"), (2, "b")'], answer: 0, explain: 'enumerate trả cặp (chỉ số, phần tử), bắt đầu từ 0, giúp không phải tự đếm.' },
      { q: 'Trong ML, một epoch là gì?', options: ['Một lần duyệt hết tập huấn luyện', 'Một lần dự đoán', 'Một tham số'], answer: 0, explain: 'Vòng lặp ngoài cùng của huấn luyện thường là for epoch in range(so_epoch).' },
    ],
    study: {
      sections: [
        { title: 'for duyệt qua một dãy', html: '<p><code>for x in ds:</code> lần lượt gán từng phần tử của danh sách, chuỗi hoặc <code>range</code> cho biến <code>x</code>. <code>range(n)</code> sinh 0, 1, …, n−1; <code>range(a, b, buoc)</code> đi từ a tới trước b. <code>enumerate(ds)</code> cho cả chỉ số và phần tử; <code>zip(xs, ys)</code> đi song song hai dãy, rất hay dùng để ghép đặc trưng với nhãn.</p>' },
        { title: 'while lặp theo điều kiện', html: '<p><code>while dieu_kien:</code> kiểm tra điều kiện trước mỗi vòng; khi điều kiện sai, vòng lặp dừng. Nếu không có gì trong thân vòng lặp làm điều kiện thay đổi, chương trình lặp vô hạn. Luôn có một bộ đếm hoặc giới hạn như <code>buoc &lt; toi_da</code>. <code>break</code> thoát vòng lặp ngay; <code>continue</code> bỏ qua phần còn lại của vòng hiện tại.</p>' },
        { title: 'Vòng lặp trong huấn luyện mô hình', html: '<p>Huấn luyện là vòng lặp: mỗi epoch dự đoán, đo loss, tính gradient, cập nhật tham số. Mô phỏng thay bước cập nhật bằng phép nhân <code>loss * he_so</code> để bạn thấy ba kết cục: hội tụ (he_so &lt; 1), đứng yên (= 1) và phân kỳ (&gt; 1). Dừng theo ngưỡng giống “dừng sớm” (early stopping); giới hạn số vòng giống số epoch tối đa. Khi làm với NumPy, ưu tiên phép toán trên cả mảng thay vì vòng lặp Python từng phần tử vì nhanh hơn nhiều.</p>' },
      ],
      practice: {
        title: 'Thực hành: viết vòng huấn luyện giả lập', goal: 'Dùng for, while, break đúng chỗ.',
        steps: ['Mở notebooks/04_vong_lap.ipynb.', 'Hoàn thành hàm tong_binh_phuong(n) bằng for.', 'Hoàn thành hàm so_vong_hoi_tu(he_so, nguong, toi_da) bằng while có giới hạn.', 'Chạy ô kiểm tra, gồm trường hợp he_so = 1 phải trả toi_da thay vì treo.'],
        expected: 'Mọi assert đạt trong vài giây; không ô nào chạy mãi.',
        troubleshooting: ['Ô chạy không dừng: bấm nút Interrupt (■) của Jupyter rồi kiểm tra điều kiện while.', 'Sai lệch 1 đơn vị: nhớ range không gồm giá trị stop.'],
        downloads: P.notebookLinks('04_vong_lap'),
      },
      references: [
        { title: 'for Statements và range() (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/controlflow.html#for-statements', topic: 'Vòng lặp', note: 'Cách for duyệt dãy, range, break, continue và else của vòng lặp.', checked: '07/10/2026' },
        { title: 'Looping Techniques', url: 'https://docs.python.org/3/tutorial/datastructures.html#looping-techniques', topic: 'enumerate, zip', note: 'Các mẫu lặp gọn với enumerate, zip, sorted, reversed.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
