/* Bài 1 — Bắt đầu: chạy chương trình, print, input và f-string. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const lesson = P.lesson({
    id: 'py-setup', icon: '🚀', group: 'Nền tảng', title: 'Bắt đầu với Python', navTitle: 'Bắt đầu với Python',
    lead: 'Cài Python, chạy chương trình đầu tiên, đọc dữ liệu bằng input() và in kết quả bằng print().',
    experiment: {
      defaults: { ten: 'An', tuoi: '20', sep: ' ' },
      controls: [
        { key: 'ten', label: 'Người học gõ vào input("Tên: ")', type: 'text' },
        { key: 'tuoi', label: 'Người học gõ vào input("Tuổi: ")', type: 'text' },
        { key: 'sep', label: 'Tham số sep của print', type: 'select', options: [{ value: ' ', label: 'dấu cách " "' }, { value: '-', label: 'gạch ngang "-"' }, { value: ', ', label: 'dấu phẩy ", "' }] },
      ],
      code: (i) => [
        `ten = input("Tên: ")          # người học gõ: ${i.ten}`,
        `tuoi_text = input("Tuổi: ")   # người học gõ: ${i.tuoi}`,
        'tuoi = int(tuoi_text)         # input() luôn trả về chuỗi (str)',
        `print("Xin chào", ten, sep=${P.repr(i.sep)})`,
        'print(f"Năm sau {ten} {tuoi + 1} tuổi")',
      ],
      run: (i) => P.execute((t) => {
        const ten = String(i.ten), tuoiText = String(i.tuoi);
        if (ten.length > 40 || tuoiText.length > 40) throw P.inputError('Mỗi ô nhập tối đa 40 ký tự.');
        t.step(1, { ten });
        t.step(2, { ten, tuoi_text: tuoiText });
        t.step(3, { ten, tuoi_text: tuoiText });
        const tuoi = P.pyInt(tuoiText);
        const vars = { ten, tuoi_text: tuoiText, tuoi };
        t.step(4, vars);
        t.print('Xin chào', ten, { sep: i.sep });
        t.step(5, vars);
        t.print(`Năm sau ${ten} ${tuoi + 1} tuổi`);
        return { ten, sep: i.sep, tuoiMoi: tuoi + 1 };
      }),
    },
    tasks: [
      { title: 'Chạy chương trình đầu tiên', desc: 'Giữ tên An, tuổi 20 và bấm Chạy. Quan sát hai dòng đầu ra.', hint: 'Không cần sửa gì. Bấm ▶ Chạy, sau đó bấm ⏮ và Tiếp ▶ để xem từng dòng chạy.', accept: (r) => !r.error && r.ten === 'An' && r.sep === ' ' && r.output.length === 2 },
      { title: 'Đổi ký tự ngăn cách', desc: 'Đổi sep thành gạch ngang để print nối các giá trị bằng dấu "-".', hint: 'Chọn sep là gạch ngang "-" rồi chạy. Dòng đầu ra thứ nhất sẽ là Xin chào-An.', accept: (r) => !r.error && r.sep === '-' },
      { title: 'Gây lỗi ValueError có chủ đích', desc: 'Gõ tuổi bằng chữ. int() chỉ đổi được chuỗi chứa số nguyên.', hint: 'Gõ "hai mươi" vào ô tuổi rồi chạy. Đọc dòng cuối: ValueError: invalid literal for int()...', accept: (r) => !!r.error && r.error.type === 'ValueError' },
      { title: 'Chạy với thông tin của bạn', desc: 'Đổi sang tên khác An, nhập tuổi là số nguyên và giữ sep là dấu cách.', hint: 'Ví dụ tên Bình, tuổi 17. Dòng thứ hai sẽ là Năm sau Bình 18 tuổi.', accept: (r) => !r.error && r.ten.trim() !== '' && r.ten !== 'An' && r.sep === ' ' },
    ],
    quiz: [
      { q: 'input() trả về giá trị kiểu gì?', options: ['Luôn là chuỗi (str)', 'Số nếu người dùng gõ số', 'Kiểu do Python tự đoán'], answer: 0, explain: 'input() luôn trả str, kể cả khi người dùng gõ 20. Muốn tính toán phải đổi bằng int() hoặc float().' },
      { q: 'print("a", "b", sep="-") in ra gì?', options: ['a b', 'a-b', 'ab-'], answer: 1, explain: 'sep là chuỗi đặt giữa các giá trị. Mặc định sep là một dấu cách.' },
      { q: 'f"{ten} {tuoi + 1}" làm gì?', options: ['Chèn giá trị biểu thức vào chuỗi', 'Tạo chú thích', 'Định nghĩa hàm'], answer: 0, explain: 'f-string (chuỗi có tiền tố f) tính biểu thức trong dấu ngoặc nhọn rồi chèn kết quả vào chuỗi.' },
      { q: 'int("20.5") cho kết quả gì?', options: ['20', '21', 'ValueError'], answer: 2, explain: 'int() với chuỗi chỉ nhận số nguyên. Muốn đọc 20.5 hãy dùng float("20.5"), sau đó mới int() nếu cần cắt phần thập phân.' },
      { q: 'Dòng bắt đầu bằng # trong Python là gì?', options: ['Chú thích, Python bỏ qua khi chạy', 'Lệnh in', 'Lỗi cú pháp'], answer: 0, explain: 'Chú thích giúp người đọc hiểu ý định của mã. Viết lý do, không cần lặp lại điều mã đã nói.' },
      { q: 'Vì sao nên kiểm tra phiên bản bằng python --version trước khi học?', options: ['Một số cú pháp và thư viện yêu cầu phiên bản tối thiểu', 'Để Python chạy nhanh hơn', 'Để xóa phiên bản cũ'], answer: 0, explain: 'Notebook của khóa cần Python 3.9 trở lên. Máy có nhiều phiên bản dễ cài thư viện nhầm chỗ.' },
    ],
    study: {
      sections: [
        { title: 'Python là gì và vì sao dùng cho AI', html: '<p>Python là ngôn ngữ lập trình dễ đọc, có hệ sinh thái thư viện lớn cho dữ liệu và trí tuệ nhân tạo (AI): NumPy tính toán mảng, Pandas xử lý bảng, scikit-learn cho học máy (ML), PyTorch cho học sâu (DL). Bạn viết lệnh trong file <code>.py</code> hoặc trong notebook (sổ tay chạy từng ô mã), rồi trình thông dịch Python đọc và thực hiện từng dòng từ trên xuống.</p><p>Cài Python 3.9 trở lên từ python.org (Windows nhớ chọn “Add python.exe to PATH”). Mở terminal và gõ <code>python --version</code> để kiểm tra. Lệnh <code>python ten_file.py</code> chạy một file; lệnh <code>python</code> mở chế độ tương tác để thử nhanh.</p>' },
        { title: 'print, input và f-string', html: '<p><code>print(a, b)</code> in các giá trị cách nhau bằng <code>sep</code> (mặc định một dấu cách) và kết thúc bằng <code>end</code> (mặc định xuống dòng). <code>input("Tên: ")</code> hiện lời nhắc, chờ người dùng gõ rồi trả về <b>chuỗi</b>. Vì vậy <code>input()</code> + 1 gây lỗi: cần <code>int(...)</code> hoặc <code>float(...)</code> trước khi tính toán.</p><p>f-string như <code>f"Năm sau {ten} {tuoi + 1} tuổi"</code> chèn giá trị biểu thức vào chuỗi. Có thể định dạng số: <code>f"{0.12345:.2f}"</code> cho 0.12. Trong mô phỏng, bấm ◀ ▶ để thấy biến <code>tuoi_text</code> là chuỗi <code>\'20\'</code> còn <code>tuoi</code> là số 20.</p>' },
        { title: 'Đọc thông báo lỗi', html: '<p>Khi gặp lỗi, Python in <b>Traceback</b>: dòng gây lỗi và loại lỗi ở dòng cuối, ví dụ <code>ValueError: invalid literal for int() with base 10: \'hai mươi\'</code>. Hãy đọc dòng cuối trước: tên lỗi cho biết loại vấn đề, phần sau cho biết giá trị gây lỗi. Lỗi là thông tin, không phải thất bại; người làm AI đọc lỗi hằng ngày.</p><p>Thói quen tốt: chạy chương trình sau mỗi thay đổi nhỏ, đặt tên biến có nghĩa, và viết chú thích giải thích <i>lý do</i>. Mô phỏng ở đây chỉ mô hình hóa đoạn mã minh họa; hãy mở notebook để chạy Python thật trên máy.</p>' },
      ],
      practice: {
        title: 'Thực hành: chạy notebook đầu tiên', goal: 'Cài môi trường và chạy được notebook bài 1 trên máy.',
        steps: ['Cài Python 3.9+ và kiểm tra bằng python --version.', 'Tạo môi trường ảo: python -m venv .venv rồi kích hoạt (.venv\\Scripts\\activate trên Windows, source .venv/bin/activate trên macOS/Linux).', 'Cài Jupyter: pip install notebook, rồi chạy jupyter notebook trong thư mục examples/python.', 'Mở notebooks/01_bat_dau.ipynb, chạy từng ô bằng Shift+Enter và hoàn thành các ô BÀI TẬP cho tới khi mọi assert không báo lỗi.'],
        expected: 'Ô cuối in “Hoàn thành bài 1”. Nếu một assert sai, Python báo AssertionError kèm gợi ý.',
        troubleshooting: ['“python” không được nhận diện: cài lại và chọn Add to PATH, hoặc dùng lệnh py trên Windows.', 'pip cài vào sai Python: luôn kích hoạt .venv trước, hoặc gọi python -m pip install ...'],
        downloads: P.notebookLinks('01_bat_dau'),
      },
      references: [
        { title: 'Python Tutorial (tài liệu chính thức)', url: 'https://docs.python.org/3/tutorial/index.html', topic: 'Nhập môn Python', note: 'Đọc chương 3 “An Informal Introduction” để làm quen số, chuỗi, print.', checked: '07/10/2026' },
        { title: 'venv — Tạo môi trường ảo', url: 'https://docs.python.org/3/library/venv.html', topic: 'Môi trường', note: 'Cách tạo và kích hoạt môi trường ảo để cài thư viện tách biệt từng dự án.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
