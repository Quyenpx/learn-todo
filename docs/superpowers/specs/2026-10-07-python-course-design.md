# Thiết kế khóa "Python cho AI"

Ngày: 07/10/2026 · Trạng thái: người dùng đã duyệt phương án A và danh sách bài.

## Mục tiêu

Người chưa biết lập trình học Python đủ để theo khóa Học máy (ML) và Học sâu (DL, Deep Learning). Mỗi bài có mô phỏng trên web và notebook chạy trên máy.

**Tiêu chí thành công**

- Khóa thứ tư `python` trên nút chuyển khóa, tiến độ và thao tác xóa độc lập; thư viện tài liệu riêng.
- 14 bài và 1 bài tổng kết. Mỗi bài có ít nhất 4 nhiệm vụ chấm theo kết quả, 6 câu hỏi có giải thích, kiến thức, bài thực hành, 2 nguồn chính thức và link notebook.
- 15 notebook `.ipynb` sinh từ file nguồn `.py`. Bản lời giải chạy hết không lỗi; bản bài tập chưa làm thì `assert` thất bại.
- Toàn bộ kiểm thử Node và Python đạt; giao diện đọc được ở 1440, 768 và 390 điểm ảnh.

## Ràng buộc

- Giữ web tĩnh, script thường, mở trực tiếp `index.html`. Không thêm thư viện trình duyệt; không chạy Python thật trên web.
- Mô phỏng ghi rõ là mô hình JavaScript của đoạn mã minh họa, không phải trình thông dịch.
- Nội dung người học nhập chỉ hiển thị bằng `textContent`.
- Notebook tương thích Python 3.9; bài 1–9 chỉ dùng thư viện chuẩn.

## Kiến trúc

| Thành phần | Trách nhiệm |
|---|---|
| `js/learning/pytrace.js` | Hàm thuần dùng chung cho Node và trình duyệt: `Tracer` ghi bước (dòng, biến, đầu ra), `repr` theo cách Python hiển thị, lỗi kiểu Python, phép cắt lát, broadcasting, matmul, thống kê, `lesson()` chuẩn hóa bài. |
| `js/learning/pycourse-ui.js` | `App.renderPythonLesson`: ô điều khiển, khung mã có tô dòng, nút bước trước/tiếp/chạy hết, bảng biến, khung đầu ra, hình minh họa (lưới mảng, bảng, biểu đồ). |
| `js/lessons/python/*.js` | `home` và 15 bài. Mỗi bài khai báo `code(input)` trả danh sách dòng, `run(input)` trả `{trace, output, error, ...số đo}`, nhiệm vụ `accept(result)`, quiz, study. |
| `css/python.css` | Bảng màu xanh #3776ab / vàng #ffd43b và kiểu khung mã. |
| `examples/python/` | `src/*.py` nguồn, `build_notebooks.py`, `notebooks/` bài tập, `solutions/` lời giải, `requirements.txt`, `tests/`. |
| `docs/tutorials/python.html` | Cài Python, môi trường ảo, Jupyter, cách làm notebook. |

### Luồng dữ liệu

Người học sửa ô điều khiển → bấm Chạy → `run(input)` tạo kết quả và lưu vào `state.history` → khung mã hiển thị bước cuối, người học có thể lùi/tiến từng bước → nhiệm vụ đọc `history`.

### Lỗi

`run` không ném lỗi ra giao diện. Lỗi mô phỏng của Python trả `error: {type, message, line}`, đầu ra in dạng `Traceback` rút gọn. Đầu vào sai kiểu web (ô số rỗng) trả lỗi tiếng Việt. Vòng lặp giới hạn số bước để không treo trình duyệt.

## Danh sách bài

| # | id | Mô phỏng | 4 nhiệm vụ (loại trừ nhau) |
|---|---|---|---|
| 1 | py-setup | `input()` trả chuỗi, `int()`, `print(sep)` | Chạy được; đổi sep; `ValueError` khi tuổi không phải số; tuổi số tăng 1 |
| 2 | py-variables | Ép kiểu int/float/str/bool | int đúng; float; `bool("0")` là True; `int("3.5")` lỗi |
| 3 | py-conditions | Xếp loại theo điểm | Giỏi; Yếu; biên 6.5 là Khá; điểm ngoài 0–10 |
| 4 | py-loops | `while` giảm loss | Đạt ngưỡng; đứng yên chạm giới hạn; phân kỳ; không lặp lần nào |
| 5 | py-collections | Chỉ số âm, cắt lát, `IndexError` | Chỉ số âm; đảo ngược; lỗi chỉ số; lát 2 phần tử |
| 6 | py-functions | Hàm dự đoán và MSE | MSE bằng 0; MSE dương; quên `return`; danh sách rỗng |
| 7 | py-comprehension | Đếm từ bằng comprehension | Từ lặp; lọc độ dài; chuỗi rỗng; lọc chữ h |
| 8 | py-classes | Lớp `TapDuLieu`, lô dữ liệu | Lô cuối thiếu; lệch độ dài; chỉ số vượt; chia đều |
| 9 | py-files | `try/except/finally` đọc CSV | Thành công; không có file; dữ liệu sai; chỉ có tiêu đề |
| 10 | py-numpy | Broadcasting có lưới | Lưới ngoài; không tương thích; mảng 1 chiều; cùng shape |
| 11 | py-linalg | Gradient descent vector hóa | Hội tụ; phân kỳ; chưa đủ vòng; sai shape matmul |
| 12 | py-pandas | Lọc, groupby, dropna, fillna | Lọc; nhóm; bỏ dòng thiếu; điền trung bình |
| 13 | py-sklearn | Chia tập, chuẩn hóa, KNN | Đúng quy trình; rò rỉ dữ liệu; test_size sai; k quá lớn |
| 14 | py-pytorch | Autograd một nơ-ron | Loss giảm; quên `zero_grad`; lr quá lớn; thiếu `requires_grad` |
| 15 | py-capstone | Dữ liệu thiếu → huấn luyện → đánh giá | Bỏ dòng thiếu đạt; NaN lỗi; huấn luyện chưa đủ; điền thiếu đạt |

## Notebook

- Nguồn `examples/python/src/NN_ten.py` dùng `# %% [markdown]` và `# %%` để chia ô. Lời giải nằm giữa `# >>> LOI GIAI` và `# <<< LOI GIAI`.
- `build_notebooks.py` (thư viện chuẩn) sinh `notebooks/NN_ten.ipynb` (thay lời giải bằng `pass  # TODO`) và `solutions/NN_ten_loi_giai.ipynb`. Có chế độ `--check` báo notebook lỗi thời.
- `requirements.txt` cho bài 10–15: numpy, pandas, matplotlib, scikit-learn, torch.

## Kiểm thử

- Node `tests/python-trace.test.js`: `repr`, cắt lát, broadcasting, matmul, giới hạn vòng lặp.
- Node `tests/python-labs.test.js`: mỗi bài ≥4 lab, ≥6 quiz; chưa chạy thì chưa đạt; mỗi đầu vào gợi ý đạt đúng nhiệm vụ và không đạt nhiệm vụ kế; mỗi bài có study, 2 nguồn, link notebook tồn tại.
- Node tích hợp: 4 khóa, xóa độc lập, renderer không chèn HTML.
- Python `examples/python/tests/test_notebooks.py`: notebook khớp nguồn, JSON hợp lệ, lời giải chạy hết, bài tập chưa làm thất bại; bài thiếu thư viện được bỏ qua kèm lý do.
- Chrome: 1440/768/390, chạy bài, bước, lab, reset.
