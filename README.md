# ML Visual Lab: học Machine Learning và Deep Learning trực quan

Ứng dụng web dùng để học Machine Learning và Deep Learning qua **mô phỏng tương tác**. Mỗi bài gồm 4 phần: lý thuyết, mô phỏng, bài lab tự kiểm tra và trắc nghiệm.

## Cách chạy

**Cách 1 (đơn giản nhất):** nhấp đúp vào file `index.html` để mở bằng trình duyệt. Không cần cài đặt gì.

**Cách 2 (dùng máy chủ cục bộ):**

```powershell
python -m http.server 5500
# rồi mở http://localhost:5500
```

> Cần có Internet để tải font chữ Google Fonts. Khi không có mạng, ứng dụng vẫn chạy bình thường với font hệ thống.

## Nội dung

| Bài | Chủ đề | Mô phỏng chính |
|---|---|---|
| 1 | Gradient Descent | Đường hồi quy tự khớp dữ liệu, bản đồ Loss có quỹ đạo, ảnh hưởng của learning rate |
| 2 | Overfitting | Kéo bậc đa thức, đường cong lỗi chữ U, regularization, thêm dữ liệu |
| 3 | K-Means | Chạy từng bước gán điểm và cập nhật tâm, phương pháp khuỷu tay, khởi tạo tệ |
| 4 | Nơ-ron & Backprop | Đồ thị tính toán có hoạt ảnh, chain rule bằng số cụ thể, gradient biến mất |
| 5 | Mạng nơ-ron | Huấn luyện thời gian thực, ranh giới phân loại, đặc trưng từng nơ-ron |
| Tổng kết | Kiểm tra tổng hợp | 10 câu hỏi tình huống, bảng tiến độ |

Tiến độ (lab và điểm trắc nghiệm) được lưu trong `localStorage` của trình duyệt.

## Cấu trúc thư mục

```
index.html            Trang chính
css/style.css         Hệ thống thiết kế (màu, kiểu chữ, thành phần, responsive)
js/ml-math.js         Lõi toán học: hồi quy, đa thức, nơ-ron, MLP, K-Means (không phụ thuộc giao diện)
js/core.js            Router, lưu tiến độ, canvas, biểu đồ, lab, trắc nghiệm
js/lessons/*.js       Từng bài học
tests/ml-math.test.js Kiểm thử lõi toán học
```

## Kiểm thử

```powershell
node --test tests/ml-math.test.js
```

Bộ kiểm thử xác nhận: số liệu tính tay trong tài liệu (Gradient Descent, Backpropagation), gradient của MLP khớp với sai phân hữu hạn, mô hình phân kỳ khi learning rate lớn, hiện tượng overfitting, mạng không lớp ẩn không giải được bài vòng tròn, và K-Means có điểm khuỷu tay đúng.

## Thêm bài học mới

Tạo file `js/lessons/ten-bai.js`, gọi `App.register({ id, title, labs, quiz, render })`, rồi thêm thẻ `<script>` vào `index.html`. Tham khảo `js/lessons/kmeans.js` làm mẫu.
