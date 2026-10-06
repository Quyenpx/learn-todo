# Visual Lab: học AI và DevOps trực quan

Đây là ứng dụng web tĩnh gồm **2 khóa học**. Mỗi khóa có menu và tiến độ riêng, chuyển qua lại bằng nút ở thanh bên:

- **AI / ML**: học Machine Learning và Deep Learning qua mô phỏng tương tác.
- **DevOps**: học Docker (sau này thêm Kubernetes) bằng **terminal giả lập** chạy ngay trên trình duyệt, kèm sơ đồ động và lab tự chấm.

## Cách chạy

Nhấp đúp vào file `index.html`, hoặc chạy máy chủ cục bộ:

```powershell
python -m http.server 5500
# rồi mở http://localhost:5500
```

## Nội dung

| Khóa | Bài | Chủ đề |
|---|---|---|
| AI | 1–5 + tổng kết | Gradient Descent, Overfitting, K-Means, Nơ-ron & Backprop, Mạng nơ-ron |
| DevOps | D1 | Docker cơ bản: image, container, cổng, log, exec |
| DevOps | D2 | Dockerfile & build: cache theo lớp, .dockerignore, image slim, multi-stage |
| DevOps | D3 | Compose, volume, network |
| DevOps | K1–K7 + tổng kết | Kubernetes (sắp ra mắt) |

Đường dẫn có dạng `#/<khóa>/<bài>`, ví dụ `#/devops/dockerfile`. Đường dẫn cũ dạng `#/gradient` được tự chuyển sang dạng mới.

## Cấu trúc thư mục

```
index.html
css/style.css              Hệ thống thiết kế chung
css/devops.css             Giao diện khóa DevOps, terminal, trình sửa file
js/ml-math.js              Lõi toán ML
js/core.js                 Router, 2 khóa học, tiến độ, lab, trắc nghiệm
js/ui-devops.js            Terminal, trình sửa file, sơ đồ Docker
js/devops/                 Lõi mô phỏng (không đụng DOM, kiểm thử bằng Node)
  yaml-lite.js, shell.js, docker-registry.js, docker-build.js, docker-engine.js
js/lessons/*.js            Bài khóa AI
js/lessons/devops/*.js     Bài khóa DevOps
tests/                     Kiểm thử
```

## Kiểm thử

```powershell
node --test tests/ml-math.test.js tests/devops-sim.test.js tests/devops-labs.test.js
```
