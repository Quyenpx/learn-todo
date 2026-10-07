/* Bài 5 — Cấu trúc dữ liệu: list, tuple, dict, set; chỉ số âm và cắt lát. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const parse = (text) => P.parseList(text, 'Danh sách ds', { max: 12 });
  const lesson = P.lesson({
    id: 'py-collections', icon: '📦', group: 'Cấu trúc dữ liệu', title: 'List, tuple, dict, set', navTitle: 'List, tuple, dict, set',
    lead: 'Lưu nhiều giá trị: chỉ số bắt đầu từ 0, chỉ số âm, cắt lát, và khi nào chọn tuple, dict, set.',
    experiment: {
      defaults: { ds: '3, 1, 4, 1, 5', chi_so: -1, lat: '1:3' },
      controls: [
        { key: 'ds', label: 'Phần tử của ds (cách nhau bằng dấu phẩy)', type: 'text' },
        { key: 'chi_so', label: 'Chỉ số dùng trong ds[...]', type: 'number', step: 1 },
        { key: 'lat', label: 'Lát cắt dùng trong ds[...], ví dụ 1:3 hoặc ::-1', type: 'text' },
      ],
      code: (i) => {
        let ds;
        try { ds = P.repr(parse(i.ds)); } catch (e) { ds = '[?]'; }
        return [`ds = ${ds}`, `print(ds[${Number.isFinite(i.chi_so) ? i.chi_so : '?'}])`, `print(ds[${String(i.lat).trim()}])`, 'print(len(ds), sorted(ds), set(ds))'];
      },
      run: (i) => P.execute((t) => {
        const ds = parse(i.ds);
        const chiSo = P.num(i.chi_so, 'Chỉ số', { min: -50, max: 50, integer: true });
        if (String(i.lat).length > 20) throw P.inputError('Lát cắt tối đa 20 ký tự.');
        t.step(1, { ds });
        t.step(2, { ds });
        const phanTu = P.index(ds, chiSo);
        t.print(phanTu);
        t.step(3, { ds, ['ds[' + chiSo + ']']: phanTu });
        const lat = P.slice(ds, i.lat);
        t.print(lat);
        t.step(4, { ds, ['ds[' + String(i.lat).trim() + ']']: lat });
        t.print(ds.length, [...ds].sort((a, b) => a - b), new Set(ds));
        return { ds, chi_so: chiSo, lat, visual: { type: 'table', title: 'Chỉ số dương và âm của ds', columns: ['phần tử', 'chỉ số dương', 'chỉ số âm'], rows: ds.map((v, k) => [P.repr(v), k, k - ds.length]) } };
      }),
    },
    tasks: [
      { title: 'Lấy phần tử cuối bằng chỉ số âm', desc: 'Dùng chỉ số âm để lấy phần tử từ cuối danh sách, không cần biết độ dài.', hint: 'Giữ chỉ số -1. Bảng bên dưới cho thấy -1 trỏ tới phần tử cuối.', accept: (r) => !r.error && r.chi_so < 0 },
      { title: 'Đảo ngược danh sách', desc: 'Dùng lát cắt với bước âm để có danh sách theo thứ tự ngược.', hint: 'Nhập lát cắt ::-1 (bỏ trống đầu và cuối, bước -1).', accept: (r) => !r.error && r.ds.length > 1 && JSON.stringify(r.lat) === JSON.stringify([...r.ds].reverse()) },
      { title: 'Gây IndexError', desc: 'Truy cập chỉ số không tồn tại. Cắt lát vượt biên thì sao, có lỗi không?', hint: 'Đặt chỉ số 10. Sau đó thử lát cắt 10:20: lát cắt không lỗi mà trả danh sách rỗng.', accept: (r) => !!r.error && r.error.type === 'IndexError' },
      { title: 'Lấy 2 phần tử đầu', desc: 'Viết lát cắt lấy đúng 2 phần tử đầu tiên, dùng chỉ số 0 cho ô chỉ số.', hint: 'Nhập lát cắt :2 và chỉ số 0. Lát cắt a:b gồm a nhưng không gồm b.', accept: (r) => !r.error && r.lat.length === 2 && JSON.stringify(r.lat) === JSON.stringify(r.ds.slice(0, 2)) },
    ],
    quiz: [
      { q: 'ds = [10, 20, 30]; ds[1] là gì?', options: ['10', '20', '30'], answer: 1, explain: 'Chỉ số bắt đầu từ 0, nên ds[1] là phần tử thứ hai.' },
      { q: 'ds[1:3] với ds = [3, 1, 4, 1, 5] cho gì?', options: ['[1, 4]', '[1, 4, 1]', '[3, 1, 4]'], answer: 0, explain: 'Lát cắt a:b gồm chỉ số a tới b−1. Độ dài kết quả là b − a.' },
      { q: 'Khác biệt chính của tuple so với list?', options: ['Tuple không sửa được sau khi tạo', 'Tuple chỉ chứa số', 'Tuple nhanh gấp 100 lần'], answer: 0, explain: 'Tuple bất biến, hợp với dữ liệu cố định như shape (3, 4). List sửa được: append, sửa phần tử.' },
      { q: 'Muốn tra điểm theo tên học viên, dùng cấu trúc nào?', options: ['list', 'dict', 'set'], answer: 1, explain: 'dict ánh xạ khóa → giá trị, tra cứu nhanh: diem["An"]. Dùng .get("An", 0) để có giá trị mặc định khi thiếu khóa.' },
      { q: 'set([1, 1, 2]) cho gì?', options: ['{1, 1, 2}', '{1, 2}', '[1, 2]'], answer: 1, explain: 'set loại phần tử trùng, hữu ích để lấy danh sách nhãn khác nhau trong tập dữ liệu.' },
      { q: 'b = a; b.append(9) với a là list. a có đổi không?', options: ['Không', 'Có, vì a và b cùng trỏ một list', 'Lỗi'], answer: 1, explain: 'Gán chỉ tạo thêm tên cho cùng đối tượng. Muốn bản sao độc lập dùng a.copy() hoặc list(a).' },
    ],
    study: {
      sections: [
        { title: 'list: dãy có thứ tự, sửa được', html: '<p><code>ds = [3, 1, 4]</code> tạo danh sách. Chỉ số bắt đầu từ 0; chỉ số âm đếm từ cuối (<code>ds[-1]</code> là phần tử cuối). <code>len(ds)</code> cho độ dài; <code>ds.append(x)</code> thêm vào cuối; <code>sorted(ds)</code> trả bản đã sắp xếp mà không sửa ds. Truy cập chỉ số không tồn tại gây <code>IndexError</code>.</p>' },
        { title: 'Cắt lát start:stop:step', html: '<p><code>ds[a:b]</code> lấy từ chỉ số a tới trước b; bỏ trống a nghĩa là từ đầu, bỏ trống b là tới cuối. <code>ds[::2]</code> lấy cách một phần tử; <code>ds[::-1]</code> đảo ngược. Khác với truy cập một chỉ số, lát cắt vượt biên không lỗi mà trả danh sách ngắn hơn hoặc rỗng. Cùng cú pháp này dùng cho chuỗi, mảng NumPy (<code>X[:, 0]</code> lấy cột đầu) và tensor PyTorch.</p>' },
        { title: 'tuple, dict, set', html: '<p><b>tuple</b> <code>(3, 4)</code> giống list nhưng bất biến; shape của mảng NumPy là tuple. <b>dict</b> <code>{"An": 8, "Bình": 6.5}</code> ánh xạ khóa sang giá trị, dùng cho cấu hình mô hình và bảng tra nhãn: <code>nhan = {0: "mèo", 1: "chó"}</code>. <b>set</b> chứa phần tử không trùng, kiểm tra thành viên rất nhanh. Lưu ý: gán <code>b = a</code> không sao chép; hai tên cùng trỏ một đối tượng.</p>' },
      ],
      practice: {
        title: 'Thực hành: thống kê nhãn', goal: 'Dùng list, dict, set để mô tả tập nhãn.',
        steps: ['Mở notebooks/05_cau_truc_du_lieu.ipynb.', 'Hoàn thành chia_train_test(ds, ti_le) bằng cắt lát.', 'Hoàn thành dem_nhan(nhan) trả dict đếm số lần mỗi nhãn.', 'Chạy ô kiểm tra.'],
        expected: 'dem_nhan(["mèo", "chó", "mèo"]) trả {"mèo": 2, "chó": 1}.',
        troubleshooting: ['KeyError khi đếm: dùng d.get(k, 0) + 1 hoặc collections.Counter.', 'Danh sách bị sửa ngoài ý muốn: kiểm tra có gán b = a thay vì sao chép không.'],
        downloads: P.notebookLinks('05_cau_truc_du_lieu'),
      },
      references: [
        { title: 'Data Structures (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/datastructures.html', topic: 'list, tuple, dict, set', note: 'Phương thức của list, tuple, set, dict và cách lặp qua chúng.', checked: '07/10/2026' },
        { title: 'Common Sequence Operations', url: 'https://docs.python.org/3/library/stdtypes.html#common-sequence-operations', topic: 'Cắt lát', note: 'Quy tắc chỉ số âm và lát cắt s[i:j:k] chính thức.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
