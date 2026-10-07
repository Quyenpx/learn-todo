# Thiết kế mở rộng Visual Lab: AI tạo sinh và thực hành thực tế

## Mục tiêu và phạm vi đã được xác nhận

Người dùng đã đồng ý ngày 07/10/2026 và yêu cầu thực hiện: thêm khóa AI tạo sinh 10 bài, bổ sung kiến thức và thực hành còn thiếu của hai khóa hiện có, thêm tài liệu tham khảo chi tiết, thiết thực. Đối tượng là người học từ nhập môn đến xây dựng ứng dụng. Ưu tiên ứng dụng thực tế, giải thích nền tảng và cung cấp hướng học nâng cao.

Điều chỉnh từ người dùng: đây là dự án cá nhân, không cần nội dung quá chi tiết. Ưu tiên chức năng ổn định và kiến thức chính xác; bài mới khoảng 5–10 phút đọc, supplements cô đọng, tài liệu ngoài dẫn người học đi sâu. Không thêm hệ thống tài khoản, dịch vụ bên ngoài hay quy trình triển khai phức tạp. Sau bàn giao người dùng sẽ đẩy mã lên Git.

## Ràng buộc chung

- Giữ ứng dụng web tĩnh, script thường, mở được index.html; không thêm thư viện chạy trên trình duyệt hay yêu cầu khóa truy cập dịch vụ.
- Giao diện, chú thích và tài liệu bằng tiếng Việt; giải thích thuật ngữ và từ viết tắt khi xuất hiện lần đầu.
- Giữ đường dẫn cũ, khóa lưu tiến độ mlviz-progress-v1 và vlab-last-course. Tiến độ và thao tác xóa độc lập giữa ba khóa.
- Phân biệt rõ mô phỏng nguyên lý với mô hình thật: không gọi bộ tách từ minh họa là tokenizer chính xác, véc-tơ từ khóa là embedding học được, câu trả lời trích xuất là văn bản do mô hình lớn sinh ra.
- Không nhận hay lưu khóa truy cập dịch vụ trong ứng dụng. Ví dụ thực hành cơ bản chạy cục bộ, không có chi phí dịch vụ.
- Mỗi bài mới có ít nhất 4 nhiệm vụ thực hành được kiểm tra theo kết quả và 6 câu hỏi có giải thích; thao tác sửa tham số rồi chạy phải tạo kết quả thực tế, không chỉ đánh dấu hộp kiểm.
- Mỗi bài chuyên môn cũ có kiến thức mở rộng, một bài thực hành hướng dẫn với đầu vào/bước làm/kết quả/lỗi thường gặp, và ít nhất 2 nguồn chính thức có mô tả mục đích đọc.
- Mỗi nguồn ghi tên, URL HTTPS, chủ đề, mục đích đọc và ngày đối chiếu 07/10/2026. Không sao chép dài từ nguồn.
- Giao diện đọc được ở 1440, 768 và 390 điểm ảnh; nội dung người học nhập hiển thị bằng textContent.

## Nội dung khóa AI tạo sinh

Khóa có id genai, trang chủ genai-home và các bài genai-foundations, genai-prompting, genai-transformer, genai-embeddings, genai-rag, genai-tools, genai-evaluation, genai-finetuning, genai-multimodal, genai-capstone.

1. Nền tảng: mô hình ngôn ngữ lớn, sinh token tiếp theo, huấn luyện trước/điều chỉnh/suy luận, giới hạn ngữ cảnh và thông tin sai. Thực hành ngân sách ngữ cảnh, chọn tác vụ và kiểm tra dữ kiện.
2. Câu lệnh: mục tiêu, ngữ cảnh, ví dụ, ràng buộc đầu ra, cấu trúc JSON và kiểm tra dữ liệu. Thực hành trích xuất thông tin từ phiếu hỗ trợ với bộ kiểm tra minh họa rõ giới hạn.
3. Transformer: token, biểu diễn vị trí, attention Q/K/V và mặt nạ nhân quả; phân phối xác suất, temperature, top-p và độ lặp lại. Thực hành tính trọng số, quan sát phân phối và tránh tràn ngữ cảnh.
4. Biểu diễn văn bản: véc-tơ, cosine, chuẩn hóa, so sánh tìm kiếm từ khóa/ngữ nghĩa, giới hạn tiếng Việt. Mô phỏng dùng véc-tơ từ khóa minh họa, thực hành thật dẫn Sentence Transformers.
5. RAG (sinh tăng cường truy xuất): nạp/chia tài liệu, overlap, truy xuất, xếp hạng lại, dựng ngữ cảnh, nguồn và từ chối khi thiếu chứng cứ. Lab dùng bộ tài liệu tiếng Việt và đánh giá tài liệu được lấy.
6. Công cụ: mô hình đề xuất lời gọi, chương trình kiểm tra rồi thực thi; schema, quyền tối thiểu, vòng lặp, lỗi và hành động cần xác nhận. Lab bộ thực thi calculator/lookup cục bộ với tham số sai và quyền bị từ chối.
7. Đánh giá/bảo mật: tập kiểm thử giữ riêng, chất lượng truy xuất/câu trả lời/JSON, chi phí, độ trễ; prompt injection, thông tin cá nhân, đầu ra không tin cậy. Lab tính số đo trên dữ liệu cố định, so sánh cấu hình và rào kiểm tra công cụ.
8. Tinh chỉnh: phân biệt prompt/RAG/fine-tuning, dữ liệu messages, chia tập, LoRA (thích nghi hạng thấp), bộ nhớ và lượng tử hóa. Lab kiểm tra dữ liệu và tính tham số LoRA; không tuyên bố đã huấn luyện mô hình thật.
9. Đa phương thức/vận hành: mô hình thị giác-ngôn ngữ, nhận dạng lời nói, diffusion; chất lượng đầu vào, quyền sử dụng, chi phí, timeout, retry, cache và giới hạn tải. Lab tính ngân sách và độ trễ trên số liệu minh họa có đơn vị.
10. Tổng kết: trợ lý hỏi đáp chính sách có nguồn, câu hỏi không trả lời được, công cụ, bộ đánh giá và ngân sách. Lab kiểm tra cấu hình end-to-end trên dữ liệu cục bộ.

Mỗi bài giải thích nguyên lý, tình huống sử dụng, quy trình cụ thể, ví dụ có đầu vào/đầu ra, lỗi thường gặp và bài thực hành ngoài trình duyệt. Các mô phỏng toán học dùng kết quả tính, có xử lý đầu vào rỗng/sai.

## Cải thiện nội dung hiện có

- Khóa AI thêm ai-data (chia dữ liệu, tiền xử lý, rò rỉ) và ai-evaluation (ma trận nhầm lẫn, precision/recall/F1, chọn ngưỡng, kiểm định chéo) trước final; cập nhật trang chủ và tổng kết theo số bài thực tế.
- Bài overfit: tách train/validation/test độc lập; mọi quyết định chọn bậc và nhiệm vụ điều chỉnh dùng validation. Test chỉ phục vụ đánh giá cuối sau thao tác rõ ràng. Giữ nguyên id nhiệm vụ cũ.
- Khóa DevOps thêm devops-cicd (pipeline kiểm tra/build/triển khai/rollback, phiên bản image, GitOps) và devops-observability (metrics/log/trace, tỷ lệ lỗi, độ trễ, tài nguyên và quy trình xử lý sự cố) trước devops-final. Mô phỏng quy trình/số đo riêng, không mở rộng giả kubectl để tuyên bố hỗ trợ lệnh chưa có.
- Mở rộng 16 bài chuyên môn hiện có: gradient, overfit, kmeans, neuron, playground và 11 bài DevOps. Bổ sung scaling, batch/optimizer, đánh giá độc lập; non-root, build secrets, healthcheck, least privilege, backup/restore, tải và an toàn triển khai.
- Thay hướng dẫn cài Ingress NGINX trên máy thật bằng hướng dẫn Gateway API/controller đang được duy trì. Lab Ingress hiện có được ghi là mô phỏng lịch sử với annotation phụ thuộc controller.

## Kiến trúc và giao diện giữa các nhiệm vụ

- js/learning/experiments.js: đối tượng LearningMath xuất cả Node và trình duyệt, toán/mô phỏng AI tạo sinh; không truy cập DOM.
- js/learning/ui.js: App.renderExperimentLesson(root, ctx, lesson), App.studyUI(root, lesson), App.registerResourcePages(). Mẫu bài vẫn dùng App.shell/labUI/quizUI.
- lesson.experiment = { defaults, controls, run(input) }; controls gồm key,label,type (select/range/text/textarea/number), options hoặc min/max/step. run trả đối tượng JSON kết quả và các số đo; renderer dùng textContent. lesson.state = { input, result, history }; chỉ thêm history sau bấm chạy.
- lesson.study = { sections: [{title,html}], practice: {title,goal,steps,expected,troubleshooting,code?,download?}, references: [{title,url,topic,note,checked}] }.
- window.LearningContent = { supplements: {} }. File nội dung cũ xuất đối tượng tương ứng qua module.exports; trên trình duyệt gộp supplements. App.studyUI chọn lesson.study hoặc LearningContent.supplements[lesson.id]. Core.navigate gọi studyUI sau lesson.render.
- Thư viện chung đăng ký một trang kind:'resources' cho mỗi khóa, id <course>-resources. Tìm theo tên/mục đích/chủ đề và lọc theo khóa; có trạng thái không có kết quả. Trang thư viện không tính vào tiến độ. Trang chủ/tổng kết lọc kind:'resources'.
- js/lessons/genai/ chứa trang chủ và 10 bài; chia nội dung theo bài để dễ sửa, xuất Node cho kiểm thử nhiệm vụ.
- css/learning.css: bảng kết quả, vùng soạn thảo, tài liệu, màu khóa mới và nút chuyển ba khóa; không thay hệ thống thiết kế chung.
- Nhiệm vụ 2 bổ sung js/learning/workflows.js cho tính số đo ML/DevOps, js/content/legacy.js, js/lessons/ai-data.js, ai-evaluation.js, devops/devops-cicd.js và devops-observability.js.
- examples/ có chương trình Python thư viện chuẩn minh họa RAG cục bộ và quy trình ML, dữ liệu mẫu, manifest Docker/Compose/Kubernetes; docs/tutorials/ có hướng dẫn đủ bước và giới hạn.

## Nguồn chính thức đã đối chiếu

- https://huggingface.co/learn/llm-course/chapter1/4
- https://huggingface.co/docs/transformers/main_classes/text_generation
- https://huggingface.co/docs/transformers/chat_templating
- https://huggingface.co/learn/cookbook/en/advanced_rag
- https://huggingface.co/learn/cookbook/en/rag_evaluation
- https://huggingface.co/learn/agents-course/unit1/tools
- https://huggingface.co/docs/peft/main/en/conceptual_guides/lora
- https://huggingface.co/learn/diffusion-course/unit1/1
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- https://scikit-learn.org/stable/common_pitfalls.html
- https://scikit-learn.org/stable/modules/model_evaluation.html
- https://docs.docker.com/build/building/best-practices/
- https://docs.docker.com/build/building/secrets/
- https://kubernetes.io/docs/concepts/cluster-administration/observability/
- https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/
- https://gateway-api.sigs.k8s.io/guides/getting-started/introduction/

## Tiêu chí nghiệm thu

Các bài mới có thể truy cập từ trang chủ/menu, làm đủ nhiệm vụ bằng hướng dẫn, trạng thái ban đầu chưa đạt. Ba khóa lưu/xóa độc lập; mọi link file nội bộ tồn tại. Toàn bộ 81 kiểm thử cũ vẫn đạt, thêm kiểm thử cho các phép tính và các nhiệm vụ mới. Kiểm thử overfit chứng minh thay đổi test không ảnh hưởng lựa chọn validation. Kiểm tra giao diện ba kích thước và thao tác thực tế: sửa input, chạy, reset, chấm, quiz, tìm tài liệu, điều hướng cũ. Chạy chương trình ví dụ Python và kiểm thử hành vi. README mô tả đúng phạm vi và lệnh chạy.
