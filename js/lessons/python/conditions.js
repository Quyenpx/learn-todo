/* Bài 3 — Câu lệnh điều kiện: if/elif/else, so sánh và toán tử logic. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const lesson = P.lesson({
    id: 'py-conditions', icon: '🔀', group: 'Nền tảng', title: 'Câu lệnh điều kiện', navTitle: 'Câu lệnh điều kiện',
    lead: 'Rẽ nhánh bằng if, elif, else; hiểu thứ tự kiểm tra, điều kiện biên và toán tử and/or/not.',
    experiment: {
      defaults: { diem: 7 },
      controls: [{ key: 'diem', label: 'Giá trị diem (thang 10)', type: 'number', step: 0.1 }],
      code: (i) => [
        `diem = ${Number.isFinite(i.diem) ? P.repr(i.diem) : '?'}`,
        'if diem < 0 or diem > 10:',
        '    print("Điểm không hợp lệ")',
        'elif diem >= 8:',
        '    print("Giỏi")',
        'elif diem >= 6.5:',
        '    print("Khá")',
        'elif diem >= 5:',
        '    print("Trung bình")',
        'else:',
        '    print("Yếu")',
      ],
      run: (i) => P.execute((t) => {
        const diem = P.num(i.diem, 'Điểm', { min: -100, max: 100 });
        t.step(1, { diem });
        const invalid = diem < 0 || diem > 10;
        t.step(2, { diem, 'diem < 0 or diem > 10': invalid });
        const say = (line, text) => { t.step(line, { diem }); t.print(text); return { xep_loai: text, diem }; };
        if (invalid) return say(3, 'Điểm không hợp lệ');
        t.step(4, { diem, 'diem >= 8': diem >= 8 });
        if (diem >= 8) return say(5, 'Giỏi');
        t.step(6, { diem, 'diem >= 6.5': diem >= 6.5 });
        if (diem >= 6.5) return say(7, 'Khá');
        t.step(8, { diem, 'diem >= 5': diem >= 5 });
        if (diem >= 5) return say(9, 'Trung bình');
        t.step(10, { diem });
        return say(11, 'Yếu');
      }),
    },
    tasks: [
      { title: 'Đạt loại Giỏi', desc: 'Chọn điểm để chương trình in Giỏi. Đếm xem Python kiểm tra bao nhiêu điều kiện.', hint: 'Nhập 9. Điều kiện ở dòng 2 sai, dòng 4 đúng nên Python không xét các nhánh sau.', accept: (r) => !r.error && r.xep_loai === 'Giỏi' },
      { title: 'Đi tới nhánh else', desc: 'Chọn điểm hợp lệ để mọi điều kiện đều sai và nhánh else chạy.', hint: 'Nhập 3 rồi đi từng bước để thấy Python xét lần lượt dòng 2, 4, 6, 8 rồi tới else.', accept: (r) => !r.error && r.xep_loai === 'Yếu' },
      { title: 'Kiểm tra điểm biên 6.5', desc: 'Nhập đúng 6.5. Toán tử >= có tính cả giá trị bằng không?', hint: 'Nhập 6.5. Vì dùng >=, 6.5 thuộc loại Khá.', accept: (r) => !r.error && r.xep_loai === 'Khá' && r.diem === 6.5 },
      { title: 'Chặn dữ liệu sai', desc: 'Nhập điểm ngoài thang 0–10 để nhánh kiểm tra hợp lệ chạy trước.', hint: 'Nhập 11 hoặc -1. Kiểm tra dữ liệu sai nên đặt đầu tiên.', accept: (r) => !r.error && r.xep_loai === 'Điểm không hợp lệ' },
    ],
    quiz: [
      { q: 'Khi nhiều nhánh elif cùng đúng, nhánh nào chạy?', options: ['Tất cả', 'Nhánh đúng đầu tiên', 'Nhánh cuối cùng'], answer: 1, explain: 'Python xét từ trên xuống và dừng ở nhánh đúng đầu tiên. Vì vậy thứ tự điều kiện quan trọng: điều kiện chặt đặt trước.' },
      { q: 'Nếu đổi thứ tự, đặt "elif diem >= 5" trước "elif diem >= 8", điểm 9 được xếp loại gì?', options: ['Giỏi', 'Trung bình', 'Lỗi'], answer: 1, explain: '9 >= 5 đúng trước nên chương trình in Trung bình. Đây là lỗi logic, Python không báo lỗi.' },
      { q: 'Python dùng gì để xác định khối lệnh thuộc if?', options: ['Dấu ngoặc nhọn', 'Thụt lề (thường 4 dấu cách)', 'Từ khóa end'], answer: 1, explain: 'Thụt lề là cú pháp bắt buộc. Trộn tab và dấu cách dễ gây IndentationError.' },
      { q: '"x > 0 and y > 0" đúng khi nào?', options: ['Một trong hai đúng', 'Cả hai đúng', 'Cả hai sai'], answer: 1, explain: 'and cần cả hai đúng; or cần ít nhất một đúng; not đảo giá trị.' },
      { q: 'So sánh bằng trong Python viết thế nào?', options: ['=', '==', '==='], answer: 1, explain: '= là phép gán, == là so sánh bằng. Viết "if x = 5" gây SyntaxError.' },
      { q: 'Trong ML, câu lệnh if thường dùng để làm gì?', options: ['Đổi xác suất thành nhãn theo ngưỡng, kiểm tra dữ liệu đầu vào', 'Thay thế huấn luyện', 'Tăng tốc GPU'], answer: 0, explain: 'Ví dụ: if xac_suat >= 0.5: nhan = 1. Kiểm tra dữ liệu sớm giúp lỗi lộ ra trước khi huấn luyện lâu.' },
    ],
    study: {
      sections: [
        { title: 'Cấu trúc if, elif, else', html: '<p>Câu lệnh <code>if dieu_kien:</code> chạy khối thụt lề bên dưới khi điều kiện đúng. <code>elif</code> (else if) kiểm tra tiếp khi các điều kiện trước đều sai; <code>else</code> chạy khi không nhánh nào đúng. Python xét từ trên xuống và <b>chỉ chạy nhánh đúng đầu tiên</b>. Trong mô phỏng, bảng biến hiện từng điều kiện cùng giá trị True/False khi Python xét tới.</p>' },
        { title: 'So sánh và logic', html: '<p>Các phép so sánh: <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code>. Python cho phép viết gọn <code>0 &lt;= diem &lt;= 10</code>. Kết hợp điều kiện bằng <code>and</code>, <code>or</code>, <code>not</code>. Python đánh giá ngắn mạch: với <code>a or b</code>, nếu a đúng thì không tính b, nên có thể viết <code>if ds and ds[0] &gt; 0</code> mà không lỗi khi danh sách rỗng.</p>' },
        { title: 'Kiểm tra biên và dữ liệu sai', html: '<p>Lỗi phổ biến nằm ở biên: dùng <code>&gt;</code> thay vì <code>&gt;=</code> làm 6.5 rơi sang loại khác. Hãy thử giá trị ngay tại biên và hai bên biên. Đặt kiểm tra dữ liệu không hợp lệ lên đầu để các nhánh sau chỉ xử lý dữ liệu đúng. Trong ML, cách này xuất hiện khi đổi xác suất thành nhãn theo ngưỡng, hoặc khi chặn ảnh rỗng, nhãn ngoài danh sách trước khi huấn luyện.</p>' },
      ],
      practice: {
        title: 'Thực hành: hàm xếp loại có kiểm thử', goal: 'Viết điều kiện đúng ở mọi biên.',
        steps: ['Mở notebooks/03_dieu_kien.ipynb.', 'Hoàn thành hàm xep_loai(diem) theo bảng trong notebook.', 'Hoàn thành hàm nhan_tu_xac_suat(p, nguong=0.5) trả 1 hoặc 0.', 'Chạy ô kiểm tra gồm các giá trị biên 5, 6.5, 8, 0, 10 và giá trị sai.'],
        expected: 'Mọi assert đạt; xep_loai(6.5) trả "Khá", xep_loai(11) trả "Điểm không hợp lệ".',
        troubleshooting: ['IndentationError: kiểm tra mọi khối cùng mức thụt lề 4 dấu cách.', 'Kết quả sai ở biên: xem lại >= hay >.'],
        downloads: P.notebookLinks('03_dieu_kien'),
      },
      references: [
        { title: 'if Statements (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/controlflow.html#if-statements', topic: 'Điều kiện', note: 'Cú pháp if/elif/else chính thức kèm ví dụ ngắn.', checked: '07/10/2026' },
        { title: 'Boolean operations', url: 'https://docs.python.org/3/reference/expressions.html#boolean-operations', topic: 'Toán tử logic', note: 'Quy tắc and/or/not và đánh giá ngắn mạch.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
