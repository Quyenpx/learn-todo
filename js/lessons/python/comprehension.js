/* Bài 7 — List/dict comprehension và xử lý chuỗi: tiền xử lý văn bản đơn giản. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const strip = (w) => w.replace(/^[.,!?]+|[.,!?]+$/g, '');
  const filters = {
    all: { line: 'tu = [w.strip(".,!?") for w in tokens]', keep: () => true },
    len3: { line: 'tu = [w.strip(".,!?") for w in tokens if len(w.strip(".,!?")) > 3]', keep: (w) => [...strip(w)].length > 3 },
    h: { line: 'tu = [w.strip(".,!?") for w in tokens if w.startswith("h")]', keep: (w) => w.startsWith('h') },
  };
  const lesson = P.lesson({
    id: 'py-comprehension', icon: '✂️', group: 'Cấu trúc dữ liệu', title: 'Comprehension và chuỗi', navTitle: 'Comprehension và chuỗi',
    lead: 'Viết vòng lặp tạo danh sách trong một dòng, lọc theo điều kiện, và tiền xử lý văn bản bằng phương thức chuỗi.',
    experiment: {
      defaults: { cau: 'Học máy cần dữ liệu, học sâu cần nhiều dữ liệu hơn.', loc: 'all' },
      controls: [
        { key: 'cau', label: 'Câu văn đầu vào', type: 'textarea' },
        { key: 'loc', label: 'Điều kiện lọc trong comprehension', type: 'select', options: [{ value: 'all', label: 'Giữ mọi từ' }, { value: 'len3', label: 'Chỉ giữ từ dài hơn 3 ký tự' }, { value: 'h', label: 'Chỉ giữ từ bắt đầu bằng "h"' }] },
      ],
      code: (i) => [
        `cau = ${P.repr(String(i.cau))}`,
        'tokens = cau.lower().split()',
        (filters[i.loc] || filters.all).line,
        'dem = {w: tu.count(w) for w in tu}',
        'print(len(tokens), len(tu))',
        'print(dem)',
      ],
      run: (i) => P.execute((t) => {
        const cau = String(i.cau);
        if (cau.length > 300) throw P.inputError('Câu văn tối đa 300 ký tự.');
        const f = filters[i.loc];
        if (!f) throw P.inputError('Điều kiện lọc không hợp lệ.');
        t.step(1, { cau });
        const tokens = cau.toLowerCase().split(/\s+/).filter(Boolean);
        t.step(2, { tokens });
        const tu = tokens.filter(f.keep).map(strip);
        t.step(3, { tokens, tu });
        const dem = new Map();
        tu.forEach((w) => dem.set(w, (dem.get(w) || 0) + 1));
        t.step(4, { tu, dem });
        t.step(5, { tu, dem });
        t.print(tokens.length, tu.length);
        t.step(6, { dem });
        t.print(dem);
        const counts = [...dem.values()];
        return { loc: i.loc, total: tokens.length, kept: tu.length, maxCount: counts.length ? Math.max(...counts) : 0,
          visual: { type: 'table', title: 'Từ sau khi lọc và số lần xuất hiện', columns: ['từ', 'số lần'], rows: [...dem.entries()] } };
      }),
    },
    tasks: [
      { title: 'Tìm từ lặp lại', desc: 'Giữ mọi từ và tìm từ xuất hiện ít nhất 2 lần trong câu.', hint: 'Giữ câu mặc định và điều kiện “Giữ mọi từ”. Nhờ lower() và strip(), “Học” và “học” được đếm chung.', accept: (r) => !r.error && r.loc === 'all' && r.maxCount >= 2 },
      { title: 'Lọc bằng điều kiện if', desc: 'Thêm điều kiện để comprehension chỉ giữ từ dài hơn 3 ký tự.', hint: 'Chọn “Chỉ giữ từ dài hơn 3 ký tự” và so sánh len(tokens) với len(tu).', accept: (r) => !r.error && r.loc === 'len3' && r.kept < r.total },
      { title: 'Xử lý văn bản rỗng', desc: 'Chạy với câu chỉ gồm khoảng trắng. split() trả về gì?', hint: 'Xóa câu, gõ vài dấu cách rồi chạy. split() không đối số bỏ qua mọi khoảng trắng nên trả list rỗng.', accept: (r) => !r.error && r.total === 0 },
      { title: 'Lọc theo chữ cái đầu', desc: 'Giữ các từ bắt đầu bằng chữ h.', hint: 'Chọn “Chỉ giữ từ bắt đầu bằng h”. startswith kiểm tra trên token đã viết thường.', accept: (r) => !r.error && r.loc === 'h' && r.kept > 0 },
    ],
    quiz: [
      { q: '[x * 2 for x in range(3)] cho gì?', options: ['[0, 2, 4]', '[2, 4, 6]', '[0, 1, 2]'], answer: 0, explain: 'Comprehension áp biểu thức x * 2 cho từng x trong 0, 1, 2.' },
      { q: '[x for x in ds if x > 0] làm gì?', options: ['Giữ phần tử dương', 'Đổi dấu phần tử', 'Đếm phần tử'], answer: 0, explain: 'Phần if ở cuối là bộ lọc; chỉ phần tử thỏa điều kiện được đưa vào danh sách mới.' },
      { q: '"  Học Máy ".strip().lower() cho gì?', options: ['"học máy"', '"  học máy "', '"HỌC MÁY"'], answer: 0, explain: 'strip() bỏ khoảng trắng hai đầu, lower() đổi chữ thường. Các phương thức chuỗi trả chuỗi mới, không sửa chuỗi cũ.' },
      { q: '"a,b,c".split(",") trả gì?', options: ['["a", "b", "c"]', '"abc"', '("a", "b", "c")'], answer: 0, explain: 'split(sep) tách chuỗi thành list theo ký tự phân cách; ", ".join(ds) làm ngược lại.' },
      { q: '{w: len(w) for w in ["ai", "ml"]} tạo gì?', options: ['{"ai": 2, "ml": 2}', '[2, 2]', '{2, 2}'], answer: 0, explain: 'Dict comprehension tạo cặp khóa: giá trị. Set comprehension dùng {x for x in ...} không có dấu hai chấm.' },
      { q: 'Vì sao cần lower() và bỏ dấu câu trước khi đếm từ?', options: ['Để “Học” và “học,” được xem là cùng một từ', 'Để chạy nhanh hơn', 'Python yêu cầu'], answer: 0, explain: 'Chuẩn hóa văn bản giảm số từ khác nhau giả. Nhưng đừng xóa thông tin quan trọng như dấu tiếng Việt nếu bài toán cần.' },
    ],
    study: {
      sections: [
        { title: 'List comprehension', html: '<p><code>[bieu_thuc for x in day if dieu_kien]</code> tạo list mới trong một dòng, tương đương vòng for + append. Ví dụ <code>[x ** 2 for x in range(5)]</code>. Thêm <code>if</code> ở cuối để lọc. Comprehension ngắn gọn khi logic đơn giản; nếu cần nhiều nhánh, viết vòng for thường cho dễ đọc. Tương tự có dict comprehension <code>{k: v for ...}</code> và set comprehension <code>{x for ...}</code>.</p>' },
        { title: 'Phương thức chuỗi hay dùng', html: '<p><code>lower()</code>, <code>upper()</code> đổi hoa thường; <code>strip()</code> bỏ khoảng trắng (hoặc ký tự chỉ định) hai đầu; <code>split()</code> tách thành list, không đối số thì tách theo mọi khoảng trắng; <code>"-".join(ds)</code> nối list chuỗi; <code>replace(a, b)</code> thay thế; <code>startswith</code>, <code>endswith</code>, <code>in</code> kiểm tra. Chuỗi là bất biến: mọi phương thức trả chuỗi mới.</p>' },
        { title: 'Tiền xử lý văn bản cho mô hình', html: '<p>Trước khi đưa văn bản vào mô hình, thường chuẩn hóa chữ thường, bỏ dấu câu, tách từ (token) rồi đếm hoặc đổi thành số. Mô phỏng tách theo khoảng trắng, đủ để minh họa nhưng chưa phải bộ tách từ tiếng Việt thật (“học máy” là một từ ghép). Mô hình ngôn ngữ hiện đại dùng bộ tách token học từ dữ liệu. Comprehension rất hợp cho các bước biến đổi từng phần tử như vậy.</p>' },
      ],
      practice: {
        title: 'Thực hành: làm sạch và đếm từ', goal: 'Dùng comprehension và phương thức chuỗi để tiền xử lý.',
        steps: ['Mở notebooks/07_comprehension_chuoi.ipynb.', 'Hoàn thành lam_sach(cau) trả list từ đã viết thường, bỏ dấu câu.', 'Hoàn thành dem_tu(tu) bằng dict comprehension hoặc collections.Counter.', 'Hoàn thành tu_pho_bien(cau, k) trả k từ xuất hiện nhiều nhất.'],
        expected: 'lam_sach("Học, học nữa!") trả ["học", "học", "nữa"].',
        troubleshooting: ['Còn dấu câu dính vào từ: kiểm tra strip với đúng tập ký tự.', 'Thứ tự từ cùng tần suất khác mong đợi: sắp xếp thêm theo từ để ổn định.'],
        downloads: P.notebookLinks('07_comprehension_chuoi'),
      },
      references: [
        { title: 'List Comprehensions (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions', topic: 'Comprehension', note: 'Cú pháp chính thức, comprehension lồng nhau và dict/set comprehension.', checked: '07/10/2026' },
        { title: 'String Methods', url: 'https://docs.python.org/3/library/stdtypes.html#string-methods', topic: 'Chuỗi', note: 'Danh sách đầy đủ phương thức của str như split, strip, join, replace.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
