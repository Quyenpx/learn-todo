# Visual Lab: học AI, DevOps và AI tạo sinh

Ứng dụng web tĩnh tiếng Việt với **3 khóa**, mô phỏng tương tác, nhiệm vụ tự chấm, trắc nghiệm và thư viện nguồn chính thức. Mỗi khóa có tiến độ riêng, lưu trong trình duyệt; chuyển khóa bằng thanh bên.

| Khóa | Số bài chuyên môn | Nội dung |
|---|---|---|
| AI / ML (trí tuệ nhân tạo / học máy) | 7 + bài tổng kết | Gradient, overfit, K-Means, nơ-ron, mạng nơ-ron, dữ liệu/tiền xử lý, đánh giá |
| DevOps (phát triển và vận hành) | 12 + dự án tổng kết | Docker, Dockerfile, Compose; Kubernetes, Deployment/Service, cấu hình, Ingress lịch sử/HPA, lưu trữ, Helm/quyền, phục vụ mô hình; pipeline và quan sát |
| AI tạo sinh | 10, gồm tổng kết | Nền tảng, câu lệnh, Transformer, biểu diễn văn bản, RAG, công cụ, đánh giá/bảo mật, tinh chỉnh, đa phương thức/vận hành, trợ lý chính sách |

Trang chủ và thư viện không tính vào số bài. RAG là Retrieval-Augmented Generation (sinh tăng cường truy xuất); HPA là Horizontal Pod Autoscaler (bộ tự co giãn ngang).

## Mở ứng dụng

Nhấp đúp `index.html`, hoặc mở cửa sổ PowerShell tại gốc dự án:

```powershell
python -m http.server 5500 --bind 127.0.0.1
# Mở http://127.0.0.1:5500; Ctrl+C để dừng
```

Không cần cài phụ thuộc để dùng web. Đường dẫn ví dụ: `#/ai/ai-data`, `#/devops/dockerfile`, `#/genai/genai-rag`. Đường dẫn cũ như `#/gradient` vẫn được hỗ trợ. Tiến độ cũ vẫn dùng khóa `mlviz-progress-v1`; xóa tiến độ một khóa không ảnh hưởng khóa khác.

## Thực hành trên máy

Ba hướng dẫn đọc được trực tiếp hoặc từ nhóm “Thực hành trong dự án” trong thư viện:

- [Học máy](docs/tutorials/ml.html): Python 3.9+, chia train/validation/test, scaler chỉ fit train, chọn hồi quy bằng validation và đánh giá test cuối.
- [AI tạo sinh](docs/tutorials/genai.html): Python 3.9+, truy xuất từ khóa tiếng Việt, trích đoạn có nguồn, từ chối khi thiếu chứng cứ. Hướng mô hình thật dùng môi trường Python 3.10+ riêng, cần mạng/RAM/đĩa; chưa kiểm thử tải/chạy mô hình.
- [DevOps](docs/tutorials/devops.html): Docker/Compose đóng gói chính web này; Kubernetes tùy chọn cần cluster thử riêng và image sẵn trên node. Có lệnh kiểm tra, chạy và dừng tài nguyên.

```powershell
python examples/ml/workflow.py
python examples/genai/rag.py --question "Đổi trả sản phẩm trong bao lâu?"
docker compose -p visual-lab-practice -f examples/devops/compose.yaml config
docker compose -p visual-lab-practice -f examples/devops/compose.yaml up --build -d
# Mở http://127.0.0.1:8080; dừng đúng dự án vừa tạo:
docker compose -p visual-lab-practice -f examples/devops/compose.yaml down
```

Docker cần Engine/Desktop đang chạy; build lần đầu cần tải base image. Web và ví dụ cơ bản không gọi mô hình hoặc dịch vụ trả phí.

## Kiểm thử

Cần Node.js có trình chạy kiểm thử tích hợp và Python 3.9+. Trên Windows, dùng mảng tên file thay cho wildcard hoặc truyền cả thư mục:

```powershell
$taskTests = @(Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object { $_.FullName })
node --test @taskTests
python -m unittest discover -s examples/tests -v
```

Bộ Node kiểm tra lõi mô phỏng, nội dung, lab, chia validation/test và tích hợp ba khóa. Bộ Python kiểm tra truy xuất/từ chối/input, chia tập, scaler train, hồi quy, lựa chọn validation, số đo và chạy chương trình thực.

## Phạm vi và cấu trúc

- `js/core.js`, `js/lessons/`: điều hướng, tiến độ và bài học; `js/lessons/genai/` chứa khóa mới.
- `js/devops/`, `js/ml-math.js`, `js/learning/`: phép tính và terminal mô phỏng; `js/content/legacy.js` chứa nội dung bổ sung.
- `css/`: giao diện chung; `tests/`: kiểm thử Node; `examples/`: Python, dữ liệu tổng hợp và manifest; `docs/tutorials/`: hướng dẫn máy thật.

Terminal DevOps trên trình duyệt chỉ mô phỏng lệnh trong phạm vi bài, không chạy Docker hay Kubernetes thật. Mô phỏng AI tạo sinh dùng phép tính/từ khóa, không có tokenizer chính xác, embedding học được, huấn luyện hay mô hình ngôn ngữ chạy trong trình duyệt. Dữ liệu và số đo mẫu không đại diện chất lượng sản xuất. Test của bài overfit chỉ mở sau thao tác đánh giá cuối; quyết định chọn cấu hình dùng validation. Lab Ingress giữ cơ chế lịch sử; môi trường mới nên theo nguồn Gateway API/controller hiện hành.

Ứng dụng không có backend, tài khoản hay nơi nhập khóa truy cập dịch vụ. Máy chủ Python trong hướng dẫn phục vụ học cục bộ; chưa có cấu hình triển khai công khai hoặc kiểm thử cluster thật. Người dùng tự quản lý Git và đẩy mã sau khi xem thay đổi.
