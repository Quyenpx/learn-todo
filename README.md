# Visual Lab: học AI và DevOps trực quan

Đây là ứng dụng web tĩnh gồm **2 khóa học**. Mỗi khóa có menu và tiến độ riêng, chuyển qua lại bằng nút ở thanh bên:

- **AI / ML**: học Machine Learning và Deep Learning qua mô phỏng tương tác.
- **DevOps**: học Docker và Kubernetes bằng **terminal giả lập** chạy ngay trên trình duyệt, kèm sơ đồ động và lab tự chấm.

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
| DevOps | K1 | Kubernetes & Pod: cluster, node, kubectl, đọc Events |
| DevOps | K2 | Deployment & Service: tự phục hồi, chia tải, rolling update, rollback |
| DevOps | K3 | ConfigMap, Secret, readinessProbe, giới hạn tài nguyên (OOMKilled) |
| DevOps | K4 | Ingress (domain, path, rewrite-target) và HPA tự co giãn |
| DevOps | K5 | StatefulSet & lưu trữ: PVC, PV, StorageClass, headless Service, danh tính ổn định |
| DevOps | K6 | Helm (chart, values, upgrade, rollback, kho chart) và RBAC (Role, RoleBinding, `auth can-i`) |
| DevOps | K7 | Đưa model ML lên K8s: Job huấn luyện, startupProbe, canary, HPA |
| DevOps | Tổng kết | Dự án: sửa 5 lỗi trong manifest, đưa web + Redis lên namespace prod |

Đường dẫn có dạng `#/<khóa>/<bài>`, ví dụ `#/devops/dockerfile`. Đường dẫn cũ dạng `#/gradient` được tự chuyển sang dạng mới.

## Cấu trúc thư mục

```
index.html
css/style.css              Hệ thống thiết kế chung
css/devops.css             Giao diện khóa DevOps, terminal, trình sửa file
js/ml-math.js              Lõi toán ML
js/core.js                 Router, 2 khóa học, tiến độ, lab, trắc nghiệm
js/ui-devops.js            Terminal, trình sửa file, sơ đồ Docker và cluster Kubernetes
js/devops/                 Lõi mô phỏng (không đụng DOM, kiểm thử bằng Node)
  yaml-lite.js, shell.js, docker-registry.js, docker-build.js, docker-engine.js
  helm.js                  Helm 3: Go template (if/range/with/include, pipe), values, kho chart vlab
  k8s-engine.js            kubectl, controller (Deployment, StatefulSet, Job, HPA), PVC/PV, RBAC, Ingress
js/lessons/*.js            Bài khóa AI
js/lessons/devops/*.js     Bài khóa DevOps
tests/                     Kiểm thử
```

## Kiểm thử

```powershell
node --test tests/ml-math.test.js tests/devops-sim.test.js tests/devops-labs.test.js tests/k8s-sim.test.js tests/k8s-labs.test.js tests/k8s-phase3.test.js tests/k8s-labs-phase3.test.js
```

Trên Windows, truyền cả thư mục (`node --test tests/`) sẽ lỗi, nên cần liệt kê từng file.
