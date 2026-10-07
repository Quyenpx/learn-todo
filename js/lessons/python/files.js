/* Bài 9 — File, ngoại lệ, module: đọc CSV với try/except/finally. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  // Mô hình hóa csv.DictReader cho dữ liệu đơn giản (không hỗ trợ dấu ngoặc kép trong ô)
  function dictReader(text) {
    const lines = String(text).split(/\r?\n/);
    const header = lines[0] === undefined || lines[0] === '' ? null : lines[0].split(',');
    if (!header) return { header: [], rows: [] };
    const rows = lines.slice(1).filter((l) => l !== '').map((l) => {
      const cells = l.split(','), row = new Map();
      header.forEach((h, k) => row.set(h, k < cells.length ? cells[k] : null));
      return row;
    });
    return { header, rows };
  }
  const lesson = P.lesson({
    id: 'py-files', icon: '📄', group: 'Cấu trúc dữ liệu', title: 'File, ngoại lệ và module', navTitle: 'File và ngoại lệ',
    lead: 'Đọc file CSV, bắt lỗi bằng try/except/finally, dùng module và môi trường ảo để cài thư viện.',
    experiment: {
      defaults: { co_file: 'co', noi_dung: 'ten,diem\nAn,8\nBình,6.5\nChi,9' },
      controls: [
        { key: 'co_file', label: 'Trạng thái file diem.csv', type: 'select', options: [{ value: 'co', label: 'File tồn tại' }, { value: 'khong', label: 'Chưa tạo file' }] },
        { key: 'noi_dung', label: 'Nội dung diem.csv', type: 'textarea' },
      ],
      code: () => [
        'import csv',
        'try:',
        '    with open("diem.csv", encoding="utf-8") as f:',
        '        rows = list(csv.DictReader(f))',
        '    diem = [float(r["diem"]) for r in rows]',
        '    print("Trung bình:", sum(diem) / len(diem))',
        'except FileNotFoundError:',
        '    print("Không tìm thấy diem.csv")',
        'except (KeyError, ValueError) as e:',
        '    print("Dữ liệu lỗi:", repr(e))',
        'except ZeroDivisionError:',
        '    print("File chưa có dòng dữ liệu")',
        'finally:',
        '    print("Đã kết thúc")',
      ],
      run: (i) => P.execute((t) => {
        if (String(i.noi_dung).length > 1000) throw P.inputError('Nội dung file tối đa 1000 ký tự.');
        if (!['co', 'khong'].includes(i.co_file)) throw P.inputError('Trạng thái file không hợp lệ.');
        let nhanh = null, uncaught = null, rows = [], diem = [];
        t.step(1, {});
        t.step(2, {});
        t.step(3, {});
        const fin = () => { t.step(13, {}); t.step(14, {}); t.print('Đã kết thúc'); };
        if (i.co_file === 'khong') {
          t.step(7, { 'lỗi': P.raw("FileNotFoundError(2, 'No such file or directory')") });
          t.step(8, {}); t.print('Không tìm thấy diem.csv');
          nhanh = 'khong_file';
        } else {
          rows = dictReader(i.noi_dung).rows;
          t.step(4, { rows: rows.map((r) => new Map([...r.entries()])) });
          t.step(5, { rows: rows.map((r) => new Map([...r.entries()])) });
          try {
            diem = rows.map((r) => {
              if (!r.has('diem')) throw P.error('KeyError', "'diem'");
              const v = r.get('diem');
              if (v === null) throw P.error('TypeError', "float() argument must be a string or a real number, not 'NoneType'", 5);
              return P.pyFloat(v);
            });
            t.step(6, { diem: diem.map(P.float) });
            if (!diem.length) throw P.error('ZeroDivisionError', 'division by zero');
            t.print('Trung bình:', P.float(diem.reduce((s, x) => s + x, 0) / diem.length));
            nhanh = 'ok';
          } catch (e) {
            if (e.type === 'KeyError' || e.type === 'ValueError') {
              const reprE = e.type === 'KeyError' ? `KeyError(${e.message})` : `ValueError(${P.repr(e.message)})`;
              t.step(9, { e: P.raw(reprE) }); t.step(10, { e: P.raw(reprE) }); t.print('Dữ liệu lỗi:', reprE);
              nhanh = 'du_lieu';
            } else if (e.type === 'ZeroDivisionError') {
              t.step(11, {}); t.step(12, {}); t.print('File chưa có dòng dữ liệu');
              nhanh = 'rong';
            } else uncaught = e;
          }
        }
        fin();
        // Lỗi không có except phù hợp: finally vẫn chạy, sau đó lỗi tiếp tục lan ra ngoài
        if (uncaught) throw uncaught;
        return { nhanh, visual: rows.length ? { type: 'table', title: 'Các dòng csv.DictReader đọc được', columns: ['ten', 'diem'], rows: rows.map((r) => [r.get('ten') ?? '—', r.has('diem') ? (r.get('diem') ?? 'None') : '(thiếu cột)']) } : null };
      }),
    },
    tasks: [
      { title: 'Đọc file thành công', desc: 'Giữ file hợp lệ và xem chương trình tính điểm trung bình, rồi finally in “Đã kết thúc”.', hint: 'Giữ mặc định và chạy. finally luôn chạy dù thành công hay lỗi.', accept: (r) => !r.error && r.nhanh === 'ok' },
      { title: 'Xử lý file không tồn tại', desc: 'Chọn “Chưa tạo file” để nhánh FileNotFoundError chạy.', hint: 'Chọn Chưa tạo file. Chương trình không dừng đột ngột mà báo lỗi thân thiện.', accept: (r) => !r.error && r.nhanh === 'khong_file' },
      { title: 'Bắt dữ liệu sai', desc: 'Sửa một ô điểm thành chữ để float() báo ValueError và nhánh except thứ hai bắt lỗi.', hint: 'Đổi nội dung thành hai dòng: ten,diem rồi An,tám.', accept: (r) => !r.error && r.nhanh === 'du_lieu' },
      { title: 'File chỉ có tiêu đề', desc: 'Để file chỉ còn dòng tiêu đề. Danh sách điểm rỗng dẫn tới lỗi gì?', hint: 'Chỉ giữ dòng ten,diem. sum([]) / len([]) gây ZeroDivisionError.', accept: (r) => !r.error && r.nhanh === 'rong' },
    ],
    quiz: [
      { q: 'Vì sao nên dùng with open(...) as f?', options: ['File tự đóng khi ra khỏi khối, kể cả khi lỗi', 'Đọc nhanh hơn', 'Bắt buộc với CSV'], answer: 0, explain: 'with là trình quản lý ngữ cảnh: đảm bảo đóng file, tránh rò rỉ tài nguyên.' },
      { q: 'Khối finally chạy khi nào?', options: ['Chỉ khi có lỗi', 'Chỉ khi không lỗi', 'Luôn chạy'], answer: 2, explain: 'finally dùng để dọn dẹp như đóng kết nối, kể cả khi lỗi không được bắt và tiếp tục lan ra.' },
      { q: 'Vì sao không nên viết except: trống (bắt mọi lỗi)?', options: ['Che giấu lỗi lập trình thật như sai tên biến', 'Python cấm', 'Chạy chậm'], answer: 0, explain: 'Bắt đúng loại lỗi bạn biết cách xử lý, để lỗi khác vẫn hiện ra và được sửa.' },
      { q: 'Dòng "An" thiếu cột diem thì r["diem"] trong DictReader là gì?', options: ['Chuỗi rỗng', 'None', 'KeyError'], answer: 1, explain: 'DictReader điền None cho ô thiếu; float(None) gây TypeError, không thuộc nhánh (KeyError, ValueError) nên lan ra ngoài sau finally.' },
      { q: 'import numpy as np làm gì?', options: ['Nạp module numpy và đặt tên ngắn np', 'Cài numpy', 'Tạo file numpy'], answer: 0, explain: 'import chỉ nạp module đã cài. Cài bằng pip install numpy trong môi trường ảo.' },
      { q: 'Vì sao mỗi dự án nên có môi trường ảo riêng?', options: ['Tránh xung đột phiên bản thư viện giữa các dự án', 'Để Python nhanh hơn', 'Để không cần pip'], answer: 0, explain: 'requirements.txt cùng môi trường ảo giúp người khác cài đúng phiên bản và chạy lại kết quả.' },
    ],
    study: {
      sections: [
        { title: 'Đọc và ghi file', html: '<p><code>with open("diem.csv", encoding="utf-8") as f:</code> mở file và tự đóng khi ra khỏi khối. Luôn ghi rõ <code>encoding="utf-8"</code> để đọc đúng tiếng Việt trên mọi hệ điều hành. Chế độ <code>"r"</code> đọc, <code>"w"</code> ghi đè, <code>"a"</code> ghi thêm. Module <code>csv</code> đọc file bảng; <code>csv.DictReader</code> trả mỗi dòng thành dict theo tiêu đề cột. <code>pathlib.Path</code> giúp ghép đường dẫn độc lập hệ điều hành.</p>' },
        { title: 'Ngoại lệ: try, except, finally', html: '<p>Lỗi lúc chạy gọi là ngoại lệ (exception). <code>try:</code> bọc đoạn có thể lỗi; <code>except LoaiLoi:</code> xử lý loại lỗi cụ thể; có thể gom <code>except (KeyError, ValueError) as e:</code>; <code>finally:</code> luôn chạy để dọn dẹp. Tự báo lỗi bằng <code>raise ValueError("thông báo")</code>. Lỗi không có nhánh except phù hợp vẫn lan ra ngoài sau khi finally chạy — thử xóa một ô điểm (ví dụ dòng <code>An</code>) để thấy TypeError.</p>' },
        { title: 'Module, pip và môi trường ảo', html: '<p>Module là file Python chứa hàm, lớp; <code>import math</code> hoặc <code>from pathlib import Path</code> để dùng. Thư viện ngoài cài bằng <code>pip install ten_thu_vien</code>, nên cài trong môi trường ảo (<code>python -m venv .venv</code>) để mỗi dự án có bộ phiên bản riêng. Ghi danh sách bằng <code>requirements.txt</code> và cài lại bằng <code>pip install -r requirements.txt</code>. Từ bài 10, khóa dùng NumPy, Pandas, scikit-learn, PyTorch theo file <code>examples/python/requirements.txt</code>.</p>' },
      ],
      practice: {
        title: 'Thực hành: đọc CSV an toàn', goal: 'Đọc file, bắt đúng loại lỗi và chuẩn bị môi trường cho phần thư viện.',
        steps: ['Mở notebooks/09_file_ngoai_le.ipynb (notebook tự tạo file CSV mẫu trong thư mục tạm).', 'Hoàn thành doc_diem(duong_dan) trả list số thực, bỏ qua dòng lỗi và đếm số dòng bị bỏ.', 'Tạo môi trường ảo và cài thư viện: pip install -r examples/python/requirements.txt.', 'Chạy python -c "import numpy, pandas, sklearn, torch" để xác nhận cài đặt.'],
        expected: 'doc_diem trả [8.0, 6.5, 9.0] và 1 dòng lỗi với file mẫu; lệnh import cuối không báo lỗi.',
        troubleshooting: ['UnicodeDecodeError: thêm encoding="utf-8" khi mở file.', 'Cài torch lâu hoặc lỗi: làm theo lệnh cài bản CPU trên pytorch.org, phần còn lại của khóa vẫn chạy được.'],
        downloads: P.notebookLinks('09_file_ngoai_le'),
      },
      references: [
        { title: 'Errors and Exceptions (Python Tutorial)', url: 'https://docs.python.org/3/tutorial/errors.html', topic: 'Ngoại lệ', note: 'try/except/else/finally, raise và tự định nghĩa ngoại lệ.', checked: '07/10/2026' },
        { title: 'csv — CSV File Reading and Writing', url: 'https://docs.python.org/3/library/csv.html', topic: 'File CSV', note: 'DictReader, DictWriter và cách xử lý ô thiếu, dấu phân cách.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
