# Kế hoạch triển khai mở rộng kiến thức Visual Lab

> **Dành cho tác nhân thực hiện:** Dùng superpowers:subagent-driven-development để thực hiện lần lượt; người dùng đã xác nhận phạm vi và yêu cầu thực hiện toàn bộ. Không yêu cầu lại xác nhận giữa các nhiệm vụ.

**Mục tiêu:** Thêm khóa AI tạo sinh, hoàn thiện kiến thức thực tế hai khóa cũ và tài liệu tham khảo.

**Kiến trúc:** Giữ ứng dụng web tĩnh. Tách mô phỏng thuần, nội dung theo bài và renderer dùng chung. Tích hợp nguồn/thực hành vào điều hướng hiện có.

**Công nghệ:** HTML, CSS, JavaScript thuần, Node test runner, Python thư viện chuẩn.

**Thiết kế:** docs/superpowers/specs/2026-10-07-genai-curriculum-design.md

## Ràng buộc chung

- Giữ ứng dụng web tĩnh, script thường, mở được index.html; không thêm thư viện chạy trên trình duyệt hay yêu cầu khóa truy cập dịch vụ.
- Giao diện, chú thích và tài liệu bằng tiếng Việt; giải thích thuật ngữ và từ viết tắt khi xuất hiện lần đầu.
- Giữ đường dẫn cũ, khóa lưu tiến độ mlviz-progress-v1 và vlab-last-course. Tiến độ và thao tác xóa độc lập giữa ba khóa.
- Phân biệt rõ mô phỏng nguyên lý với mô hình thật.
- Mỗi bài mới có ít nhất 4 nhiệm vụ thực hành được kiểm tra theo kết quả và 6 câu hỏi có giải thích.
- Mỗi bài chuyên môn cũ có kiến thức mở rộng, một bài thực hành hướng dẫn và ít nhất 2 nguồn chính thức có mô tả mục đích đọc.
- Giao diện đọc được ở 1440, 768 và 390 điểm ảnh; nội dung người học nhập hiển thị bằng textContent.

## Các tình huống cần rà soát

1. Câu hỏi/văn bản rỗng: trả phản hồi giải thích, không chia cho 0 hay vượt giới hạn.
2. Input có HTML hoặc JSON sai: không chèn HTML và không làm hỏng trang.
3. Tham số overlap >= chunk size: báo lỗi hoặc giới hạn an toàn, không lặp vô hạn.
4. Chuyển khóa/xóa tiến độ: giữ dữ liệu khóa khác và dọn timer của bài cũ.
5. Không tìm thấy tài liệu: hiển thị trạng thái rỗng và từ chối trả lời nếu thiếu chứng cứ.

### Nhiệm vụ 1: Nền tảng học mở rộng và khóa AI tạo sinh

**File:** Tạo js/learning/experiments.js, ui.js, css/learning.css, js/lessons/genai/{home,foundations,prompting,transformer,embeddings,rag,tools,evaluation,finetuning,multimodal,capstone}.js; sửa index.html, js/core.js, js/lessons/home.js, final.js; kiểm thử tests/genai-math.test.js, genai-labs.test.js, learning-integration.test.js.

**Giao diện:** Theo mục Kiến trúc trong thiết kế. Sản phẩm chính: App.renderExperimentLesson, App.studyUI, App.registerResourcePages, lesson.experiment/lesson.study và LearningMath. Thư viện nguồn đọc cả study của bài mới và LearningContent.supplements của nhiệm vụ 2.

- [x] Viết và chạy kiểm thử thất bại cho softmax/temperature, cosine, chunk/retrieval, schema/tool validation, số đo/LoRA/chi phí; kết quả kỳ vọng tính tay và đầu vào sai.
- [x] Thực hiện mô phỏng thuần và renderer dùng chung. Kiểm thử không có nhiệm vụ đạt nếu chưa chạy và input HTML không trở thành HTML kết quả.
- [x] Viết 10 bài đủ nội dung như thiết kế; mỗi bài có >=4 lab và >=6 câu hỏi; kiểm thử làm theo gợi ý đạt và phương án sai chưa đạt.
- [x] Tích hợp ba khóa, library, kiểu hiển thị; cập nhật trang chủ/tổng kết tránh đếm library như bài chuyên môn.
- [x] Chạy toàn bộ tests/*.test.js bằng danh sách file PowerShell; tự rà soát và ghi báo cáo.

### Nhiệm vụ 2: Hoàn thiện học máy và DevOps

**File:** Tạo js/learning/workflows.js, js/content/legacy.js, js/lessons/ai-data.js, ai-evaluation.js, js/lessons/devops/devops-cicd.js, devops-observability.js; sửa overfit.js, các home/final liên quan, hướng dẫn máy thật k8s-ingress.js, index.html; kiểm thử tests/workflows.test.js, legacy-content.test.js, overfit-validation.test.js.

**Giao diện:** Dùng App.renderExperimentLesson và schema study/experiment của nhiệm vụ 1; gộp LearningContent.supplements. Bài mới được đăng ký trước bài tổng kết tương ứng. Các bài cũ thêm study ở renderer chung, không sao chép UI.

- [x] Viết kiểm thử thất bại cho tách dữ liệu/scaler, ma trận nhầm lẫn/F1, pipeline gate/rollback, số đo vận hành và ranh giới validation/test.
- [x] Thực hiện 4 bài mới, mỗi bài >=4 lab và >=6 quiz, với phép tính/quy trình thật trong phạm vi mô phỏng.
- [x] Bổ sung study cho 16 bài chuyên môn cũ, mỗi bài có ít nhất 2 nguồn chính thức và bài thực hành đủ bước/kết quả/lỗi.
- [x] Sửa overfit để test chỉ đánh giá cuối, cập nhật hướng dẫn Ingress NGINX/Gateway API và số bài trên các trang tổng quan/tổng kết.
- [x] Chạy các tests mới và toàn bộ tests/*.test.js; ghi báo cáo và giao diện thực tế để nhiệm vụ 3 dùng.

### Nhiệm vụ 3: Thực hành trên máy thật và bàn giao

**File:** Tạo examples/{genai,ml,devops}/ và docs/tutorials/; sửa README.md; bổ sung kiểm thử Python trong examples/tests/ và link download trong study nếu cần.

**Giao diện:** Dùng đường dẫn tải file/đọc hướng dẫn hiện có trong lesson.study.practice.download. Các ví dụ dùng stdlib cho đường học cơ bản; phần mô hình thật là hướng dẫn riêng có điều kiện môi trường rõ ràng.

- [x] Viết kiểm thử thất bại cho chương trình RAG cục bộ (có/không chứng cứ, input sai) và ML (chia tập, scaler chỉ fit train, metrics) trước khi viết chương trình.
- [x] Tạo chương trình Python, dữ liệu mẫu tiếng Việt, manifest Docker/Compose/Kubernetes và hướng dẫn ML/GenAI/DevOps đủ bước. Lệnh tự kiểm tra không cần dịch vụ ngoài.
- [x] Gắn ví dụ vào bài tương ứng và library; README ghi 3 khóa, số bài hiện có, cách chạy, toàn bộ lệnh kiểm thử, giới hạn mô phỏng.
- [x] Chạy chương trình ví dụ/kiểm thử Python và toàn bộ tests/*.test.js; rà soát link nội bộ và ghi báo cáo.

## Kiểm tra cuối

- [x] Rà soát độc lập toàn bộ thay đổi và giải quyết lỗi quan trọng.
- [x] Kiểm tra trình duyệt ở 1440/768/390, các luồng học, library, tiến độ và reset.
- [x] Chạy lại bộ kiểm thử sau lần sửa cuối; bàn giao với kết quả thực tế và giới hạn còn lại.
