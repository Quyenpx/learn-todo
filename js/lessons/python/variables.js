/* Bài 2 — Biến và kiểu dữ liệu: int, float, str, bool và phép ép kiểu. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const types = { int: "<class 'int'>", float: "<class 'float'>", str: "<class 'str'>", bool: "<class 'bool'>" };
  const lesson = P.lesson({
    id: 'py-variables', icon: '🔤', group: 'Nền tảng', title: 'Biến và kiểu dữ liệu', navTitle: 'Biến và kiểu dữ liệu',
    lead: 'Hiểu biến là tên gắn với giá trị, phân biệt int, float, str, bool và đổi kiểu an toàn.',
    experiment: {
      defaults: { gia_tri: '42', kieu: 'int' },
      controls: [
        { key: 'gia_tri', label: 'Chuỗi gán cho x', type: 'text' },
        { key: 'kieu', label: 'Đổi sang kiểu', type: 'select', options: [{ value: 'int', label: 'int() — số nguyên' }, { value: 'float', label: 'float() — số thực' }, { value: 'str', label: 'str() — chuỗi' }, { value: 'bool', label: 'bool() — đúng/sai' }] },
      ],
      code: (i) => [
        `x = ${P.repr(String(i.gia_tri))}`,
        `y = ${i.kieu}(x)`,
        'print(type(x), type(y))',
        'print(y)',
      ],
      run: (i) => P.execute((t) => {
        const x = String(i.gia_tri);
        if (x.length > 40) throw P.inputError('Chuỗi tối đa 40 ký tự.');
        if (!types[i.kieu]) throw P.inputError('Kiểu đổi không hợp lệ.');
        t.step(1, { x });
        t.step(2, { x });
        let value, shown;
        if (i.kieu === 'int') { value = P.pyInt(x); shown = value; }
        if (i.kieu === 'float') { value = P.pyFloat(x); shown = P.float(value); }
        if (i.kieu === 'str') { value = x; shown = x; }
        if (i.kieu === 'bool') { value = x !== ''; shown = value; }
        t.step(3, { x, y: shown });
        t.print(P.raw(types.str), P.raw(types[i.kieu]));
        t.step(4, { x, y: shown });
        t.print(shown);
        return { kieu: i.kieu, raw: x, value };
      }),
    },
    tasks: [
      { title: 'Đổi chuỗi thành số nguyên', desc: 'Đổi chuỗi "42" thành int và xem type thay đổi từ str sang int.', hint: 'Giữ x = "42", chọn int() rồi chạy.', accept: (r) => !r.error && r.kieu === 'int' },
      { title: 'Đọc số thực', desc: 'Đổi một chuỗi có phần thập phân thành float.', hint: 'Nhập 3.5 và chọn float().', accept: (r) => !r.error && r.kieu === 'float' && Number.isFinite(r.value) && !Number.isInteger(r.value) },
      { title: 'Bất ngờ với bool("0")', desc: 'Đổi chuỗi "0" sang bool. Dự đoán trước khi chạy: True hay False?', hint: 'Nhập 0, chọn bool(). Chuỗi không rỗng luôn là True, kể cả "0".', accept: (r) => !r.error && r.kieu === 'bool' && r.value === true && r.raw.trim() === '0' },
      { title: 'Tìm giới hạn của int()', desc: 'Cho int() một chuỗi có dấu chấm thập phân và đọc lỗi.', hint: 'Nhập 3.5 và chọn int(). Muốn làm tròn, dùng int(float("3.5")) hoặc round().', accept: (r) => !!r.error && r.error.type === 'ValueError' && r.error.message.includes('int()') },
    ],
    quiz: [
      { q: 'Sau x = 5 rồi x = "năm", điều gì xảy ra?', options: ['Lỗi vì x đã là số', 'x trỏ sang giá trị chuỗi mới', 'x giữ cả hai giá trị'], answer: 1, explain: 'Python có kiểu động: biến chỉ là tên gắn với giá trị. Gán lại thì tên trỏ sang giá trị mới, kiểu đi theo giá trị.' },
      { q: '0.1 + 0.2 == 0.3 cho kết quả gì?', options: ['True', 'False', 'Lỗi'], answer: 1, explain: 'Số thực lưu ở dạng nhị phân nên 0.1 + 0.2 là 0.30000000000000004. So sánh số thực nên dùng math.isclose(a, b).' },
      { q: 'bool("") và bool("False") lần lượt là gì?', options: ['False, False', 'False, True', 'True, False'], answer: 1, explain: 'Chỉ chuỗi rỗng là False. Chuỗi "False" có nội dung nên là True; muốn đọc chữ “False” phải tự so sánh chuỗi.' },
      { q: 'int(3.9) trả về gì?', options: ['4', '3', 'ValueError'], answer: 1, explain: 'int() với số thực cắt bỏ phần thập phân (về phía 0), không làm tròn. round(3.9) mới cho 4.' },
      { q: 'Tên biến nào hợp lệ và dễ đọc theo quy ước Python?', options: ['so_mau_huan_luyen', '2mau', 'số-mẫu'], answer: 0, explain: 'Tên biến không bắt đầu bằng chữ số, không chứa dấu gạch ngang; quy ước PEP 8 dùng chữ thường nối bằng gạch dưới.' },
      { q: 'Vì sao trong ML hay gặp lỗi kiểu dữ liệu khi đọc file CSV?', options: ['Cột số bị đọc thành chuỗi nếu có ô lỗi hoặc ký tự lạ', 'CSV không chứa số', 'Python không đọc được số'], answer: 0, explain: 'Một ô “không rõ” làm cả cột thành chuỗi. Kiểm tra kiểu và đổi kiểu rõ ràng trước khi tính toán.' },
    ],
    study: {
      sections: [
        { title: 'Biến là tên gắn với giá trị', html: '<p>Lệnh <code>so_mau = 100</code> tạo giá trị 100 và gắn tên <code>so_mau</code> vào nó. Python có <b>kiểu động</b>: không khai báo kiểu trước, kiểu thuộc về giá trị. Hàm <code>type(x)</code> cho biết kiểu hiện tại. Bốn kiểu cơ bản: <code>int</code> (số nguyên, không giới hạn độ lớn), <code>float</code> (số thực dấu phẩy động), <code>str</code> (chuỗi ký tự, viết trong nháy đơn hoặc kép) và <code>bool</code> (<code>True</code>/<code>False</code>). Giá trị đặc biệt <code>None</code> nghĩa là “không có giá trị”.</p>' },
        { title: 'Phép toán và ép kiểu', html: '<p><code>7 / 2</code> luôn cho float 3.5; <code>7 // 2</code> chia lấy phần nguyên 3; <code>7 % 2</code> lấy dư 1; <code>2 ** 10</code> là lũy thừa. Cộng int với float cho float. Cộng chuỗi với số gây <code>TypeError</code>; phải đổi kiểu rõ ràng: <code>int("42")</code>, <code>float("3.5")</code>, <code>str(42)</code>. <code>int("3.5")</code> lỗi vì int() chỉ nhận chuỗi số nguyên. <code>bool(x)</code> là False với 0, 0.0, chuỗi rỗng, danh sách rỗng và None; còn lại là True.</p>' },
        { title: 'Số thực và độ chính xác trong ML', html: '<p>Máy tính lưu số thực ở hệ nhị phân nên có sai số nhỏ: <code>0.1 + 0.2</code> là <code>0.30000000000000004</code>. Khi so sánh kết quả huấn luyện, dùng <code>math.isclose(a, b, rel_tol=1e-9)</code> hoặc so sánh với dung sai. NumPy và PyTorch mặc định dùng float64 hoặc float32; float32 tiết kiệm bộ nhớ nhưng kém chính xác hơn. Hiểu kiểu dữ liệu giúp tránh lỗi khó thấy như cột nhãn bị đọc thành chuỗi.</p>' },
      ],
      practice: {
        title: 'Thực hành: kiểu dữ liệu trong notebook', goal: 'Đổi kiểu an toàn và kiểm tra bằng assert.',
        steps: ['Mở notebooks/02_bien_kieu_du_lieu.ipynb.', 'Chạy ô ví dụ, dự đoán kết quả trước mỗi ô rồi so sánh.', 'Hoàn thành hàm doc_so(chuoi) trả float hoặc None khi chuỗi không phải số.', 'Chạy ô kiểm tra cho tới khi không còn AssertionError.'],
        expected: 'doc_so("3.5") trả 3.5, doc_so("abc") trả None, ô cuối in “Hoàn thành bài 2”.',
        troubleshooting: ['Nếu nhận ValueError chưa bắt: bọc phép đổi kiểu bằng try/except ValueError (xem trước ở bài 9).', 'Nếu assert so sánh số thực sai lệch rất nhỏ: dùng math.isclose.'],
        downloads: P.notebookLinks('02_bien_kieu_du_lieu'),
      },
      references: [
        { title: 'Built-in Types (tài liệu chính thức)', url: 'https://docs.python.org/3/library/stdtypes.html', topic: 'Kiểu dữ liệu', note: 'Tra cứu phép toán của int, float, str, bool và quy tắc giá trị đúng/sai.', checked: '07/10/2026' },
        { title: 'Floating Point Arithmetic: Issues and Limitations', url: 'https://docs.python.org/3/tutorial/floatingpoint.html', topic: 'Số thực', note: 'Giải thích vì sao 0.1 + 0.2 không bằng 0.3 và cách so sánh đúng.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
