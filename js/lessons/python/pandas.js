/* Bài 12 — Pandas và Matplotlib: đọc bảng, lọc, nhóm, xử lý dữ liệu thiếu. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const COLS = ['ten', 'lop', 'gio_hoc', 'diem'];
  const DATA = [['An', 'A', 2, 5.5], ['Bình', 'A', 4, 7.0], ['Chi', 'B', 5, NaN], ['Dũng', 'B', 1, 4.0], ['Hà', 'C', 6, 9.0], ['Khoa', 'C', 3, 6.5]];
  const isFloatCol = (c) => c === 'diem';
  // Định dạng cột số thực như pandas: cùng số chữ số thập phân, NaN viết là NaN
  function floatCells(values) {
    const dec = Math.max(1, ...values.filter(Number.isFinite).map((v) => { const s = String(v); return s.includes('.') ? s.split('.')[1].length : 0; }));
    return values.map((v) => (Number.isNaN(v) ? 'NaN' : v.toFixed(Math.min(dec, 6))));
  }
  function frameStr(cols, rows, index) {
    const cells = cols.map((c, k) => (isFloatCol(c) ? floatCells(rows.map((r) => r[k])) : rows.map((r) => String(r[k]))));
    const idx = index.map(String), wi = Math.max(...idx.map((s) => s.length), 0);
    const widths = cols.map((c, k) => Math.max(c.length, ...cells[k].map((s) => s.length)));
    const head = ' '.repeat(wi) + '  ' + cols.map((c, k) => c.padStart(widths[k])).join('  ');
    return [head, ...rows.map((_, r) => idx[r].padEnd(wi) + '  ' + cols.map((c, k) => cells[k][r].padStart(widths[k])).join('  '))];
  }
  function seriesStr(index, values, name, indexName) {
    const v = floatCells(values), wi = Math.max(...index.map((s) => String(s).length));
    return [...(indexName ? [indexName] : []), ...index.map((s, k) => String(s).padEnd(wi) + '    ' + v[k]), `Name: ${name}, dtype: float64`];
  }
  const exprs = {
    loc: (i) => `df[df["gio_hoc"] > ${Number.isFinite(i.nguong) ? P.repr(i.nguong) : '?'}]`,
    groupby: () => 'df.groupby("lop")["diem"].mean()',
    dropna: () => 'df.dropna()',
    fillna: () => 'df["diem"].fillna(df["diem"].mean())',
  };
  const lesson = P.lesson({
    id: 'py-pandas', icon: '🐼', group: 'Thư viện ML/DL', title: 'Pandas và Matplotlib', navTitle: 'Pandas và Matplotlib',
    lead: 'Đọc dữ liệu dạng bảng, lọc dòng, tính theo nhóm, xử lý giá trị thiếu và vẽ biểu đồ khám phá dữ liệu.',
    experiment: {
      defaults: { phep: 'loc', nguong: 3 },
      controls: [
        { key: 'phep', label: 'Thao tác trên DataFrame', type: 'select', options: [{ value: 'loc', label: 'Lọc dòng theo gio_hoc' }, { value: 'groupby', label: 'Điểm trung bình theo lớp (groupby)' }, { value: 'dropna', label: 'Bỏ dòng thiếu dữ liệu (dropna)' }, { value: 'fillna', label: 'Điền điểm thiếu bằng trung bình (fillna)' }] },
        { key: 'nguong', label: 'Ngưỡng gio_hoc khi lọc', type: 'number', step: 1 },
      ],
      code: (i) => ['import pandas as pd', 'df = pd.read_csv("hoc_tap.csv")', 'print(df.shape, df["diem"].isna().sum())', `ket_qua = ${(exprs[i.phep] || exprs.loc)(i)}`, 'print(ket_qua)'],
      run: (i) => P.execute((t) => {
        if (!exprs[i.phep]) throw P.inputError('Thao tác không hợp lệ.');
        const nguong = P.num(i.nguong, 'Ngưỡng', { min: -10, max: 20 });
        t.step(1, {});
        t.step(2, { df: P.raw('<DataFrame 6 dòng × 4 cột>') });
        t.step(3, { 'df.shape': P.tuple([6, 4]) });
        t.print(P.tuple([6, 4]), 1);
        t.step(4, {});
        let rows, nan, lines, table;
        if (i.phep === 'loc' || i.phep === 'dropna') {
          const keep = DATA.map((r, k) => [k, r]).filter(([, r]) => (i.phep === 'loc' ? r[2] > nguong : !Number.isNaN(r[3])));
          rows = keep.length; nan = keep.filter(([, r]) => Number.isNaN(r[3])).length;
          lines = rows ? frameStr(COLS, keep.map(([, r]) => r), keep.map(([k]) => k)) : [`Empty DataFrame`, `Columns: [${COLS.join(', ')}]`, 'Index: []'];
          table = { columns: ['index', ...COLS], rows: keep.map(([k, r]) => [k, ...r]) };
        } else if (i.phep === 'groupby') {
          const groups = ['A', 'B', 'C'].map((g) => { const v = DATA.filter((r) => r[1] === g && !Number.isNaN(r[3])).map((r) => r[3]); return [g, P.mean(v)]; });
          rows = 3; nan = 0;
          lines = seriesStr(groups.map((g) => g[0]), groups.map((g) => g[1]), 'diem', 'lop');
          table = { columns: ['lop', 'diem trung bình'], rows: groups.map(([g, m]) => [g, P.round(m, 4)]) };
        } else {
          const m = P.mean(DATA.filter((r) => !Number.isNaN(r[3])).map((r) => r[3]));
          const filled = DATA.map((r) => (Number.isNaN(r[3]) ? P.round(m, 10) : r[3]));
          rows = 6; nan = 0;
          lines = seriesStr(DATA.map((_, k) => k), filled, 'diem');
          table = { columns: ['index', 'diem sau fillna'], rows: filled.map((v, k) => [k, v]) };
        }
        t.step(5, { 'ket_qua': P.raw(`<${rows} dòng>`) });
        lines.forEach((l) => t.print(l));
        return { phep: i.phep, rows, nanCount: nan,
          visual: [{ type: 'table', title: 'df — dữ liệu gốc (ô NaN là dữ liệu thiếu)', columns: ['index', ...COLS], rows: DATA.map((r, k) => [k, ...r]) }, { type: 'table', title: 'ket_qua', ...table }] };
      }),
    },
    tasks: [
      { title: 'Lọc dòng bằng điều kiện', desc: 'Lọc học viên có gio_hoc lớn hơn ngưỡng. Số dòng còn lại là bao nhiêu?', hint: 'Chọn Lọc dòng, ngưỡng 3: còn Bình, Chi, Hà (3 dòng). Điều kiện tạo Series True/False dùng làm mặt nạ.', accept: (r) => !r.error && r.phep === 'loc' && r.rows > 0 && r.rows < 6 },
      { title: 'Tính trung bình theo nhóm', desc: 'Dùng groupby để có điểm trung bình mỗi lớp.', hint: 'Chọn groupby. Lớp B chỉ tính trên Dũng vì mean() bỏ qua NaN.', accept: (r) => !r.error && r.phep === 'groupby' && r.rows === 3 },
      { title: 'Bỏ dòng thiếu dữ liệu', desc: 'Dùng dropna để loại dòng có NaN. Mất bao nhiêu mẫu?', hint: 'Chọn dropna: còn 5 dòng. Với dữ liệu nhỏ, bỏ dòng có thể làm mất thông tin quý.', accept: (r) => !r.error && r.phep === 'dropna' && r.rows === 5 && r.nanCount === 0 },
      { title: 'Điền giá trị thiếu', desc: 'Dùng fillna với điểm trung bình để giữ đủ 6 dòng.', hint: 'Chọn fillna. Chi được điền 6.4 = trung bình 5 điểm còn lại. Trong ML, tính giá trị điền trên tập train.', accept: (r) => !r.error && r.phep === 'fillna' && r.rows === 6 && r.nanCount === 0 },
    ],
    quiz: [
      { q: 'df["diem"] trả về gì?', options: ['Series (một cột)', 'DataFrame', 'list'], answer: 0, explain: 'Một cặp ngoặc vuông với một tên cột trả Series; df[["diem"]] (hai cặp) trả DataFrame một cột.' },
      { q: 'df[df["gio_hoc"] > 3] hoạt động thế nào?', options: ['So sánh tạo Series True/False rồi dùng làm mặt nạ chọn dòng', 'Xóa cột', 'Sắp xếp'], answer: 0, explain: 'Giống mặt nạ boolean của NumPy. Kết hợp điều kiện bằng & và |, mỗi điều kiện đặt trong ngoặc.' },
      { q: 'df["diem"].mean() xử lý NaN thế nào?', options: ['Bỏ qua NaN', 'Trả NaN', 'Báo lỗi'], answer: 0, explain: 'Mặc định skipna=True. Vì vậy cần kiểm tra số giá trị thiếu bằng isna().sum() để biết trung bình tính trên bao nhiêu mẫu.' },
      { q: 'Vì sao trong ML nên tính giá trị điền (fillna) chỉ trên tập train?', options: ['Tránh rò rỉ thông tin từ tập test', 'Chạy nhanh hơn', 'Pandas yêu cầu'], answer: 0, explain: 'Dùng thông tin test khi chuẩn bị dữ liệu làm kết quả đánh giá lạc quan giả. Bài 13 sẽ gặp lại nguyên tắc này.' },
      { q: 'df.loc và df.iloc khác nhau thế nào?', options: ['loc theo nhãn, iloc theo vị trí số nguyên', 'Giống nhau', 'iloc chỉ chọn cột'], answer: 0, explain: 'Sau khi lọc, nhãn index có thể không liên tục (0, 1, 4); iloc[0] là dòng đầu, loc[0] là dòng có nhãn 0.' },
      { q: 'Matplotlib dùng để làm gì trong quy trình ML?', options: ['Vẽ biểu đồ khám phá dữ liệu và đường cong loss', 'Huấn luyện mô hình', 'Đọc CSV'], answer: 0, explain: 'plt.hist, plt.scatter, plt.plot giúp phát hiện ngoại lai, phân phối lệch, và theo dõi huấn luyện.' },
    ],
    study: {
      sections: [
        { title: 'DataFrame và Series', html: '<p>Pandas có hai cấu trúc chính: <b>Series</b> (một cột có nhãn) và <b>DataFrame</b> (bảng nhiều cột). <code>pd.read_csv("file.csv")</code> đọc file; <code>df.head()</code>, <code>df.info()</code>, <code>df.describe()</code> xem nhanh dữ liệu, kiểu cột và thống kê. <code>df.shape</code> cho (số dòng, số cột). Chọn cột bằng <code>df["diem"]</code>, nhiều cột bằng <code>df[["gio_hoc", "diem"]]</code>; chọn dòng theo nhãn <code>df.loc[...]</code>, theo vị trí <code>df.iloc[...]</code>.</p>' },
        { title: 'Lọc, nhóm và dữ liệu thiếu', html: '<p>Lọc bằng mặt nạ: <code>df[(df["gio_hoc"] &gt; 3) &amp; (df["lop"] == "A")]</code>. Tính theo nhóm: <code>df.groupby("lop")["diem"].mean()</code>. Giá trị thiếu hiển thị NaN; đếm bằng <code>df.isna().sum()</code>. Hai cách xử lý: <code>dropna()</code> bỏ dòng (mất mẫu) hoặc <code>fillna(gia_tri)</code> điền (thêm giả định). Chọn cách nào phụ thuộc lượng thiếu và lý do thiếu; ghi lại quyết định này.</p>' },
        { title: 'Vẽ biểu đồ với Matplotlib', html: '<p>Trước khi huấn luyện, hãy nhìn dữ liệu: <code>df["diem"].hist()</code> xem phân phối; <code>plt.scatter(df["gio_hoc"], df["diem"])</code> xem quan hệ giữa hai biến; <code>plt.plot(lich_su_loss)</code> theo dõi huấn luyện. Luôn ghi tên trục và đơn vị (<code>plt.xlabel</code>, <code>plt.ylabel</code>). Notebook bài này có ví dụ vẽ và lưu ảnh bằng <code>plt.savefig</code>. Mô phỏng web chỉ hiển thị bảng; biểu đồ thật vẽ trong notebook.</p>' },
      ],
      practice: {
        title: 'Thực hành: khám phá dữ liệu học tập', goal: 'Làm sạch và tóm tắt một bảng dữ liệu.',
        steps: ['Mở notebooks/12_pandas_matplotlib.ipynb (dữ liệu mẫu tạo ngay trong notebook).', 'Hoàn thành tom_tat(df) trả số dòng, số giá trị thiếu mỗi cột.', 'Hoàn thành diem_trung_binh_theo_lop(df) và dien_thieu(df_train, df_test) dùng trung bình của train.', 'Vẽ scatter gio_hoc–diem và histogram điểm, lưu ra file PNG.'],
        expected: 'dien_thieu điền cả train và test bằng cùng một giá trị tính từ train; ảnh PNG được tạo.',
        troubleshooting: ['SettingWithCopyWarning: dùng df = df.copy() trước khi sửa, hoặc df.loc[mask, "cot"] = ...', 'Biểu đồ không hiện khi chạy file .py: thêm plt.show() hoặc lưu bằng plt.savefig.'],
        downloads: P.notebookLinks('12_pandas_matplotlib'),
      },
      references: [
        { title: '10 minutes to pandas', url: 'https://pandas.pydata.org/docs/user_guide/10min.html', topic: 'Pandas', note: 'Tổng quan nhanh: tạo, chọn, lọc, nhóm, dữ liệu thiếu.', checked: '07/10/2026' },
        { title: 'Matplotlib: Quick start guide', url: 'https://matplotlib.org/stable/users/explain/quick_start.html', topic: 'Biểu đồ', note: 'Cách tạo figure, axes, vẽ và ghi nhãn biểu đồ.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
