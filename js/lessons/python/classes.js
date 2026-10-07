/* Bài 8 — Lớp và đối tượng: __init__, phương thức đặc biệt, generator chia lô dữ liệu. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const n = (v) => (Number.isFinite(v) ? String(v) : '?');
  const lesson = P.lesson({
    id: 'py-classes', icon: '🏗️', group: 'Cấu trúc dữ liệu', title: 'Lớp và đối tượng', navTitle: 'Lớp và đối tượng',
    lead: 'Tự viết lớp TapDuLieu giống Dataset của PyTorch: lưu dữ liệu, kiểm tra hợp lệ, lấy mẫu theo chỉ số và chia lô.',
    experiment: {
      defaults: { n: 10, so_nhan: 10, bs: 4, chi_so: 0 },
      controls: [
        { key: 'n', label: 'Số mẫu xs (1–30)', type: 'number', step: 1 },
        { key: 'so_nhan', label: 'Số nhãn ys (0–30)', type: 'number', step: 1 },
        { key: 'bs', label: 'Kích thước lô (1–10)', type: 'number', step: 1 },
        { key: 'chi_so', label: 'Chỉ số mẫu cần lấy ds[...]', type: 'number', step: 1 },
      ],
      code: (i) => [
        'class TapDuLieu:',
        '    def __init__(self, xs, ys):',
        '        if len(xs) != len(ys):',
        '            raise ValueError("xs và ys phải cùng độ dài")',
        '        self.xs, self.ys = xs, ys',
        '    def __len__(self):',
        '        return len(self.xs)',
        '    def __getitem__(self, i):',
        '        return self.xs[i], self.ys[i]',
        '    def cac_lo(self, kich_thuoc):',
        '        for i in range(0, len(self), kich_thuoc):',
        '            yield self.xs[i:i + kich_thuoc]',
        '',
        `ds = TapDuLieu(list(range(${n(i.n)})), [x * 2 for x in range(${n(i.so_nhan)})])`,
        `print(len(ds), ds[${n(i.chi_so)}])`,
        `print(list(ds.cac_lo(${n(i.bs)})))`,
      ],
      run: (i) => P.execute((t) => {
        const soMau = P.num(i.n, 'Số mẫu', { min: 1, max: 30, integer: true });
        const soNhan = P.num(i.so_nhan, 'Số nhãn', { min: 0, max: 30, integer: true });
        const bs = P.num(i.bs, 'Kích thước lô', { min: 1, max: 10, integer: true });
        const chiSo = P.num(i.chi_so, 'Chỉ số', { min: -40, max: 40, integer: true });
        const xs = Array.from({ length: soMau }, (_, k) => k), ys = Array.from({ length: soNhan }, (_, k) => k * 2);
        const self = P.raw('<TapDuLieu>');
        t.step(14, {});
        t.step(3, { self, 'len(xs)': xs.length, 'len(ys)': ys.length });
        if (xs.length !== ys.length) throw P.error('ValueError', 'xs và ys phải cùng độ dài', 4);
        t.step(5, { self, xs, ys });
        t.step(15, { ds: self });
        t.step(7, { self, 'len(self.xs)': xs.length });
        t.step(9, { self, i: chiSo });
        const mau = P.tuple([P.index(xs, chiSo), P.index(ys, chiSo)]);
        t.step(15, { ds: self, ['ds[' + chiSo + ']']: mau });
        t.print(xs.length, mau);
        t.step(16, { ds: self });
        const lo = [];
        for (let k = 0; k < xs.length; k += bs) {
          t.step(11, { i: k, kich_thuoc: bs });
          lo.push(xs.slice(k, k + bs));
          t.step(12, { i: k, 'lô': lo[lo.length - 1] });
        }
        t.step(16, { 'các lô': lo });
        t.print(lo);
        return { so_lo: lo.length, lo_cuoi: lo[lo.length - 1].length, bs, visual: { type: 'table', title: 'Các lô dữ liệu', columns: ['lô', 'chỉ số mẫu', 'kích thước'], rows: lo.map((b, k) => [k, P.repr(b), b.length]) } };
      }),
    },
    tasks: [
      { title: 'Lô cuối bị thiếu', desc: 'Chọn số mẫu không chia hết cho kích thước lô. Lô cuối có bao nhiêu mẫu?', hint: '10 mẫu, lô 4: được [0..3], [4..7], [8, 9]. Lô cuối chỉ có 2 mẫu.', accept: (r) => !r.error && r.so_lo > 1 && r.lo_cuoi < r.bs },
      { title: 'Chặn dữ liệu lệch', desc: 'Cho số nhãn khác số mẫu để __init__ báo lỗi ngay khi tạo đối tượng.', hint: 'Đặt số nhãn là 8 trong khi số mẫu là 10. Báo lỗi sớm tốt hơn huấn luyện với dữ liệu sai.', accept: (r) => !!r.error && r.error.type === 'ValueError' && r.error.message.includes('cùng độ dài') },
      { title: 'Lấy mẫu vượt chỉ số', desc: 'Truy cập ds[i] với i vượt quá số mẫu.', hint: 'Đặt chỉ số 12 với 10 mẫu. __getitem__ chuyển tiếp lỗi IndexError của list.', accept: (r) => !!r.error && r.error.type === 'IndexError' },
      { title: 'Chia lô đều', desc: 'Chọn số mẫu và nhãn chia hết cho kích thước lô để mọi lô đủ mẫu.', hint: 'Đặt số mẫu 8, số nhãn 8, lô 4: được 2 lô, mỗi lô 4 mẫu.', accept: (r) => !r.error && r.so_lo > 1 && r.lo_cuoi === r.bs },
    ],
    quiz: [
      { q: '__init__ được gọi khi nào?', options: ['Khi tạo đối tượng mới', 'Khi xóa đối tượng', 'Khi in đối tượng'], answer: 0, explain: 'TapDuLieu(xs, ys) tạo đối tượng rồi gọi __init__ để khởi tạo thuộc tính.' },
      { q: 'self trong phương thức là gì?', options: ['Đối tượng đang gọi phương thức', 'Tên lớp', 'Biến toàn cục'], answer: 0, explain: 'ds.cac_lo(4) tương đương TapDuLieu.cac_lo(ds, 4); self chính là ds.' },
      { q: 'Định nghĩa __len__ giúp gì?', options: ['Dùng được len(ds)', 'Tăng tốc', 'Bắt buộc với mọi lớp'], answer: 0, explain: 'Phương thức đặc biệt (dunder) cho đối tượng hoạt động với cú pháp có sẵn: len(), ds[i], vòng for.' },
      { q: 'Hàm có yield khác hàm có return thế nào?', options: ['Trả về từng giá trị khi được yêu cầu (generator)', 'Chạy nhanh gấp đôi', 'Không khác'], answer: 0, explain: 'Generator không tạo cả danh sách trong bộ nhớ; DataLoader dùng ý tưởng này để đọc từng lô.' },
      { q: 'Vì sao kiểm tra len(xs) == len(ys) ngay trong __init__?', options: ['Để lỗi lộ ra sớm, gần nguyên nhân', 'Để chạy nhanh', 'Python yêu cầu'], answer: 0, explain: 'Nếu để tới lúc huấn luyện mới lỗi, rất khó truy ra dữ liệu lệch từ đâu.' },
      { q: 'class Con(Cha): nghĩa là gì?', options: ['Con kế thừa thuộc tính và phương thức của Cha', 'Con chứa một biến tên Cha', 'Lỗi cú pháp'], answer: 0, explain: 'Trong PyTorch, bạn viết class MoHinh(nn.Module) để kế thừa khả năng quản lý tham số.' },
    ],
    study: {
      sections: [
        { title: 'Lớp, đối tượng và thuộc tính', html: '<p>Lớp (class) là bản thiết kế; đối tượng là một thể hiện cụ thể. <code>__init__(self, ...)</code> chạy khi tạo đối tượng và gán thuộc tính như <code>self.xs = xs</code>. Phương thức là hàm định nghĩa trong lớp, tham số đầu luôn là <code>self</code>. Lớp gom dữ liệu và thao tác liên quan vào một chỗ, giúp code lớn dễ quản lý.</p>' },
        { title: 'Phương thức đặc biệt và generator', html: '<p>Phương thức có hai dấu gạch dưới hai bên (dunder) cho đối tượng dùng được cú pháp có sẵn: <code>__len__</code> cho <code>len(ds)</code>, <code>__getitem__</code> cho <code>ds[i]</code>, <code>__repr__</code> cho cách in. Hàm có <code>yield</code> là generator: mỗi lần được hỏi mới tính phần tử tiếp theo, tiết kiệm bộ nhớ khi dữ liệu lớn. <code>list(gen)</code> lấy hết các phần tử.</p>' },
        { title: 'Liên hệ với PyTorch', html: '<p>PyTorch yêu cầu lớp Dataset có <code>__len__</code> và <code>__getitem__</code>, đúng như TapDuLieu. DataLoader sau đó chia lô, xáo trộn và đọc song song. Mô hình được viết thành lớp kế thừa <code>nn.Module</code>, khai báo lớp con trong <code>__init__</code> và phép tính trong <code>forward</code>. Hiểu lớp giúp bạn đọc được mã của mọi dự án học sâu. Lô cuối nhỏ hơn là bình thường; DataLoader có tùy chọn <code>drop_last=True</code> để bỏ lô thiếu.</p>' },
      ],
      practice: {
        title: 'Thực hành: lớp tập dữ liệu và mô hình', goal: 'Viết lớp có kiểm tra hợp lệ và phương thức đặc biệt.',
        steps: ['Mở notebooks/08_lop_doi_tuong.ipynb.', 'Hoàn thành TapDuLieu với __init__, __len__, __getitem__, cac_lo.', 'Hoàn thành lớp MoHinhTuyenTinh có phương thức du_doan và cap_nhat.', 'Chạy ô kiểm tra.'],
        expected: 'len(TapDuLieu([1,2,3],[2,4,6])) bằng 3; tạo với độ dài lệch báo ValueError.',
        troubleshooting: ['TypeError: missing 1 required positional argument: kiểm tra đã thêm self làm tham số đầu.', 'AttributeError: kiểm tra đã gán self.ten_thuoc_tinh trong __init__.'],
        downloads: P.notebookLinks('08_lop_doi_tuong'),
      },
      references: [
        { title: 'Classes (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/classes.html', topic: 'Lớp', note: 'Lớp, thuộc tính, kế thừa, generator và iterator theo tài liệu chính thức.', checked: '07/10/2026' },
        { title: 'PyTorch: Datasets & DataLoaders', url: 'https://pytorch.org/tutorials/beginner/basics/data_tutorial.html', topic: 'Dataset', note: 'Xem lớp Dataset tự viết với __len__ và __getitem__ trong PyTorch thật.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
