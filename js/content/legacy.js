/* Kiến thức bổ sung cô đọng; renderer chung chọn theo id bài học. */
(function(root){'use strict';
  const supplements={};
  const ref=(title,url,topic,note)=>({title,url,topic,note,checked:'07/10/2026'});
  const pitfalls=ref('scikit-learn: lỗi thường gặp','https://scikit-learn.org/stable/common_pitfalls.html','Quy trình học máy','Kiểm tra rò rỉ và giữ tiền xử lý nhất quán.');
  const scaling=ref('scikit-learn: tiền xử lý','https://scikit-learn.org/stable/modules/preprocessing.html','Chuẩn hóa','Đọc StandardScaler và tác động của thang đo.');
  const validation=ref('scikit-learn: kiểm định chéo','https://scikit-learn.org/stable/modules/cross_validation.html','Đánh giá độc lập','Chọn cách chia và giữ test cho đánh giá cuối.');
  const optimize=ref('PyTorch: tối ưu tham số','https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html','Huấn luyện','Đọc zero_grad, backward và optimizer.step.');
  const autograd=ref('PyTorch: đạo hàm tự động','https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html','Lan truyền ngược','Theo dõi đồ thị tính và tích lũy gradient.');
  const dockerBuild=ref('Docker: thực hành build','https://docs.docker.com/build/building/best-practices/','Image','Đọc cache, multi-stage, USER và phiên bản base image.');
  const secretBuild=ref('Docker: build secrets','https://docs.docker.com/build/building/secrets/','Bí mật build','Dùng secret mount tạm; tránh ARG/ENV cho bí mật.');
  const storage=ref('Docker: volume','https://docs.docker.com/engine/storage/volumes/','Dữ liệu bền vững','Đọc vòng đời volume, backup và restore.');
  const pods=ref('Kubernetes: an toàn Pod','https://kubernetes.io/docs/concepts/security/pod-security-standards/','Quyền tối thiểu','Đọc chuẩn Restricted, non-root và capability.');
  const probes=ref('Kubernetes: probes','https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/','Sức khỏe ứng dụng','Phân biệt startup, readiness và liveness.');
  const observe=ref('Kubernetes: quan sát','https://kubernetes.io/docs/concepts/cluster-administration/observability/','Vận hành','Kết hợp số đo, nhật ký và dấu vết yêu cầu.');
  const secrets=ref('Kubernetes: quản lý Secret','https://kubernetes.io/docs/concepts/security/secrets-good-practices/','Cấu hình bí mật','Đọc mã hóa khi lưu trữ và giới hạn quyền truy cập.');
  const gateway=ref('Gateway API: bắt đầu','https://gateway-api.sigs.k8s.io/guides/getting-started/introduction/','Định tuyến hiện hành','Cần định nghĩa tài nguyên tùy chỉnh (CRD) và controller tương thích.');
  const retirement=ref('Kubernetes: Ingress NGINX ngừng bảo trì','https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/','Chuyển đổi controller','Đọc thông báo ngừng bảo trì tháng 3/2026 và hướng chuyển đổi.');
  function add(id,title,html,goal,steps,expected,troubleshooting,references){const sentences=html.split('. ');const body=sentences.length>2?'<p>'+sentences.slice(0,2).join('. ')+'.</p><p>'+sentences.slice(2).join('. ')+'</p>':'<p>'+html+'</p>';supplements[id]={sections:[{title,html:body}],practice:{title:'Thực hành bổ sung: '+title,goal,steps,expected,troubleshooting},references};}
  add('gradient','Thang đo và bước học',
    'Đặc trưng có thang đo rất khác nhau tạo bề mặt mất mát khó tối ưu. Chuẩn hóa thường giúp chọn learning rate (tốc độ học) dễ hơn; chỉ học thống kê trên train. Full-batch dùng toàn bộ mẫu mỗi bước, mini-batch dùng nhóm nhỏ nên gradient dao động nhưng tiết kiệm bộ nhớ. Adam điều chỉnh bước theo lịch sử gradient; không bảo đảm luôn tốt hơn mọi optimizer (bộ tối ưu).',
    'So sánh bước học ổn định và bước học gây dao động trên cùng dữ liệu.',
    ['Trong mô phỏng: giữ nguyên dữ liệu, chạy với tốc độ học nhỏ và ghi loss (mất mát).','Đặt lại tham số, tăng tốc độ học rồi chạy cùng số bước; quan sát dao động hoặc phân kỳ.','Trên máy thật: chuẩn hóa đặc trưng bằng Pipeline của scikit-learn, so sánh hội tụ với dữ liệu chưa chuẩn hóa.'],
    'Bước quá lớn có thể làm loss tăng; chuẩn hóa phải dùng cùng scaler train cho dữ liệu mới.',
    ['Loss không giảm: kiểm tra bước học và thang đo trước khi tăng số vòng.','Mô phỏng dùng toàn bộ tập mỗi bước; mini-batch/Adam là phần thực hành ngoài trình duyệt.'],[scaling,optimize]);
  add('overfit','Train, validation và test độc lập',
    'Train học trọng số, validation chọn bậc và λ, test đánh giá cuối. Xem test nhiều lần để sửa cấu hình cũng là rò rỉ lựa chọn. Đường cong validation chỉ gợi ý trên một cách chia, nên kết luận cần số mẫu và biến động. Early stopping (dừng sớm) chọn thời điểm bằng validation. Regularization (điều chuẩn) hạn chế hệ số lớn; nhiều dữ liệu chỉ hữu ích nếu phù hợp mục tiêu dự đoán.',
    'Chọn cấu hình không đọc test và đánh giá một lần sau lựa chọn.',
    ['Trong mô phỏng: tìm bậc tốt nhất bằng đường validation, giữ λ=0.','Thử bậc cao rồi tăng λ; ghi train và validation.','Giữ cấu hình đã chọn, bấm “Đánh giá test cuối”.','Nếu thay cấu hình, ghi đây là thử nghiệm mới; không dùng số test cũ để tối ưu.'],
    'Chấm lab chỉ dựa validation; nút cuối mới hiển thị lỗi test và thay cấu hình sẽ xóa kết quả đó.',
    ['Validation thấp nhưng test cao: dữ liệu ít hoặc lựa chọn quá nhiều cấu hình trên cùng validation.','Đừng chọn bậc từ số test cuối; dùng kiểm định chéo khi cần.'],[pitfalls,validation]);
  add('kmeans','Scaling, khởi tạo và chọn số cụm',
    'K-Means tối ưu tổng bình phương khoảng cách tới tâm (inertia), nên đặc trưng có đơn vị lớn có thể chi phối. Chuẩn hóa có chủ đích và chạy nhiều lần khởi tạo. Inertia tối ưu không tăng khi k tăng, nhưng các lần chạy riêng có thể rơi vào nghiệm cục bộ nên không luôn đơn điệu. Silhouette so sánh độ gần trong cụm với cụm khác; cần ít nhất hai cụm và không phải mọi mẫu một cụm riêng.',
    'Không chọn k chỉ từ một lần chạy hoặc một số inertia thấp.',
    ['Trong mô phỏng: cố định dữ liệu, so sánh k=2 và k=3 rồi ghi hình cụm/inertia.','Chạy lại khởi tạo nếu bài hỗ trợ, quan sát tâm có đổi không.','Trên máy thật: dùng KMeans với random_state và nhiều n_init, so sánh dữ liệu đã chuẩn hóa và silhouette.'],
    'Tâm và inertia phụ thuộc khởi tạo; số cụm cần khớp ý nghĩa nghiệp vụ.',
    ['Cụm bị kéo theo cột lớn: xem lại đơn vị và scaler.','Không coi giảm inertia khi tăng k là bằng chứng có thêm nhóm thật.'],[ref('scikit-learn: K-Means','https://scikit-learn.org/stable/modules/clustering.html#k-means','Phân cụm','Đọc nghiệm cục bộ, n_init và đánh giá silhouette.'),scaling]);
  add('neuron','Gradient và cập nhật là hai bước',
    'Lan truyền ngược tính gradient; optimizer.step cập nhật trọng số. Trong PyTorch, gradient được cộng dồn nên cần zero_grad trước bước mới khi không chủ đích tích lũy. Hàm kích hoạt bão hòa có gradient nhỏ. Một nơ-ron chỉ minh họa chain rule (quy tắc đạo hàm hàm hợp), không thay mô hình nhiều lớp.',
    'Kiểm tra dấu và độ lớn gradient trước khi cập nhật.',
    ['Trong mô phỏng: thay x, w và quan sát z, đầu ra và loss.','Chọn sigmoid ở vùng bão hòa, so sánh gradient với vùng gần 0.','Trên máy thật: thực hiện optimizer.zero_grad → loss.backward → optimizer.step theo hướng dẫn PyTorch.'],
    'backward tạo gradient, còn step mới đổi tham số; gradient sigmoid nhỏ khi bão hòa.',
    ['Gradient tăng qua bước: kiểm tra zero_grad hoặc chủ đích tích lũy.','Đầu ra không đổi nhiều: xem z có vào vùng bão hòa không.'],[autograd,optimize]);
  add('playground','Huấn luyện, suy luận và đánh giá',
    'model.train và model.eval đổi hành vi lớp như Dropout/BatchNorm; eval không tự tắt tính gradient. torch.no_grad dùng cho suy luận không xây đồ thị gradient. Giữ validation riêng để chọn kiến trúc; báo chất lượng trên test sau cùng. Accuracy cao trên tập mất cân bằng không đủ: xem recall/F1 của lớp quan trọng.',
    'Phân biệt mô hình đủ năng lực với mô hình tổng quát hóa tốt.',
    ['Trong mô phỏng: chạy XOR không lớp ẩn rồi thêm lớp ẩn phi tuyến.','Ghi loss, ranh giới và độ chính xác; tăng độ sâu không đồng nghĩa tốt hơn.','Trên máy thật: giữ tập test riêng; chuyển model.eval và no_grad khi đo, fit scaler chỉ trên train.'],
    'Lớp ẩn phi tuyến có thể giải XOR; kết quả train chưa chứng minh chất lượng trên dữ liệu mới.',
    ['Kết quả không tái lập: ghi seed và cấu hình.','Kết quả test thấp: kiểm tra phân phối, rò rỉ và cách chọn mô hình.'],[optimize,validation]);
  add('docker-basics','Container và quyền tối thiểu',
    'Container chia sẻ nhân máy chủ; không phải máy ảo độc lập. Image là mẫu, container là tiến trình với lớp ghi riêng. Chạy non-root (người dùng không có quyền quản trị), chỉ cấp capability cần thiết, giới hạn tài nguyên và cổng. Các cờ bảo mật là bước trên máy thật; terminal mô phỏng chỉ hỗ trợ phạm vi bài.',
    'Kiểm tra ứng dụng trước khi công bố cổng.',
    ['Trong mô phỏng: chạy container theo gợi ý bài, xem docker ps và docker logs.','Gọi cổng đã ánh xạ, đối chiếu cổng máy chủ với cổng container.','Trên máy thật: chạy image đã kiểm tra với USER non-root, chỉ công bố cổng cần thiết và giới hạn tài nguyên.'],
    'Ứng dụng phản hồi đúng cổng; cấu hình trên máy thật không cấp quyền vượt nhu cầu.',
    ['Không truy cập được: kiểm tra ánh xạ và ứng dụng lắng nghe địa chỉ nào.','Không gõ các cờ bảo mật mới vào terminal giả lập nếu chưa có trong gợi ý hỗ trợ.'],[ref('Docker: chạy container','https://docs.docker.com/engine/containers/run/','Vòng đời và quyền','Đọc publish port, user và giới hạn tài nguyên.'),dockerBuild]);
  add('dockerfile','Cache, multi-stage và bí mật build',
    'COPY tệp phụ thuộc trước mã nguồn để tái sử dụng cache. Multi-stage (build nhiều giai đoạn) chỉ mang artifact cần chạy sang image cuối. Đặt USER non-root và kiểm tra quyền tệp. ARG/ENV không phù hợp chứa mật khẩu: có thể xuất hiện trong metadata hoặc lớp image. BuildKit secret mount cung cấp bí mật tạm thời, lệnh build vẫn phải tránh ghi bí mật vào artifact/log.',
    'Đóng gói có thể tái lập mà không lưu bí mật vào image.',
    ['Trong mô phỏng: build Dockerfile bài có sẵn và ghi các lớp cache.','Sửa mã nguồn rồi build lại; kiểm tra bước cài phụ thuộc còn dùng cache.','Trên máy thật: thêm USER phù hợp, tách build/runtime; nếu cần secret dùng BuildKit mount theo nguồn, không ARG/ENV.'],
    'Sửa mã không buộc cài lại mọi thư viện khi lớp phụ thuộc không đổi; image cuối chỉ chứa tệp cần chạy.',
    ['Permission denied với non-root: chỉnh owner và quyền ở bước build.','Image lớn: xem lớp COPY và công cụ build có lọt vào runtime không.'],[dockerBuild,secretBuild]);
  add('docker-compose','Sẵn sàng dịch vụ và dữ liệu',
    'Thứ tự khởi động không bảo đảm database đã sẵn sàng. Trên máy thật dùng healthcheck và depends_on condition: service_healthy khi phù hợp, ứng dụng vẫn cần retry có giới hạn vì phụ thuộc có thể lỗi sau khi chạy. Volume giữ dữ liệu qua vòng đời container, nhưng không thay backup; thử restore mới xác nhận bản sao dùng được.',
    'Xác nhận kết nối và dữ liệu sau khi container khởi động lại.',
    ['Trong mô phỏng: chạy Compose web + Redis theo bài, gọi web và ghi bộ đếm.','Tạo lại container theo hướng dẫn bài; kiểm tra volume giữ dữ liệu.','Trên máy thật: thêm healthcheck, điều kiện service_healthy và retry giới hạn.','Sao lưu volume/database rồi thử khôi phục vào môi trường riêng.'],
    'Dữ liệu còn sau tạo lại container khi gắn đúng volume; readiness và restore phải kiểm chứng trên máy thật.',
    ['Connection refused: kiểm tra tên dịch vụ, cổng nội bộ và readiness.','down -v xóa volume; đừng dùng khi cần giữ dữ liệu.'],[ref('Docker Compose: thứ tự khởi động','https://docs.docker.com/compose/how-tos/startup-order/','Readiness','Đọc service_healthy và healthcheck; không coi thứ tự là sẵn sàng.'),storage]);
  add('k8s-basics','Pod an toàn và tài nguyên',
    'Pod Running chỉ nói tiến trình đã chạy; readiness mới thể hiện khả năng nhận lưu lượng. requests dùng cho lập lịch, limits giới hạn tiêu thụ; thiếu bộ nhớ có thể bị OOMKilled (bị dừng vì thiếu bộ nhớ). Trên cluster thật áp dụng securityContext phù hợp, non-root, giảm capability và ServiceAccount (tài khoản dịch vụ) chỉ có quyền cần thiết.',
    'Tìm nguyên nhân Pod chưa phục vụ được yêu cầu.',
    ['Trong mô phỏng: tạo Pod theo bài rồi xem trạng thái và log.','Cố ý chọn image sai theo gợi ý bài, xem lỗi kéo image.','Trên máy thật: xem describe/events và thêm requests/limits, securityContext theo chuẩn Restricted; không đưa các trường mới vào lab nếu không hỗ trợ.'],
    'Phân biệt lỗi image, tiến trình và readiness; quyền/tài nguyên được khai báo rõ ở máy thật.',
    ['Pending: xem tài nguyên và lịch trình.','Running nhưng không truy cập: xem readiness, cổng và Service.'],[pods,probes]);
  add('k8s-deploy','Rolling update và khôi phục',
    'Deployment duy trì trạng thái mong muốn. Rolling update thay Pod từng phần, readiness tránh gửi lưu lượng tới Pod chưa sẵn sàng. Dùng phiên bản image cố định; rollback code không tự hoàn tác dữ liệu. Khi GitOps quản lý, sửa nguồn mong muốn trong Git để tránh controller đồng bộ lại bản lỗi.',
    'Kiểm tra rollout thay vì chỉ apply thành công.',
    ['Trong mô phỏng: triển khai và gọi Service theo bài.','Đổi image theo gợi ý, quan sát Pod cũ/mới và rollout status.','Thử bản lỗi và rollback bằng lệnh đã được bài hỗ trợ.','Trên máy thật: dùng digest, readiness và theo dõi số đo người dùng sau rollout.'],
    'Phiên bản mới chỉ phục vụ khi sẵn sàng; sau rollback cần xác nhận lưu lượng hết lỗi.',
    ['Rollout kẹt: xem readiness và image.','Rollback chưa sửa dữ liệu: cần kế hoạch migration tương thích riêng.'],[ref('Kubernetes: Deployment','https://kubernetes.io/docs/concepts/workloads/controllers/deployment/','Triển khai','Đọc strategy, rollout và revision.'),probes]);
  add('k8s-config','Secret và ba loại probe',
    'Base64 là mã hóa biểu diễn, không bảo mật Secret. Trên cluster thật cần mã hóa khi lưu trữ và quyền đọc tối thiểu; tránh commit/log secret. ConfigMap/Secret qua biến môi trường không tự cập nhật tiến trình đang chạy. Startup probe cho phép khởi động chậm; readiness quyết định nhận lưu lượng; liveness quyết định khởi động lại. Liveness phụ thuộc database đang lỗi có thể gây vòng restart.',
    'Phân biệt lỗi cấu hình với lỗi sức khỏe.',
    ['Trong mô phỏng: áp dụng ConfigMap/Secret và probe theo bài, xem Pod READY.','Sửa cấu hình bằng manifest hỗ trợ, tạo lại Pod khi dùng biến môi trường.','Trên máy thật: kiểm tra quyền Secret và chọn probe không gây restart khi phụ thuộc tạm lỗi.'],
    'Cấu hình mới có hiệu lực sau tạo lại tiến trình khi dùng biến môi trường; readiness lỗi gỡ Pod khỏi lưu lượng.',
    ['Secret không an toàn chỉ vì base64: kiểm tra mã hóa lưu trữ và quyền.','Restart liên tục: xem liveness quá nhạy hoặc kiểm tra sai phụ thuộc.'],[secrets,probes]);
  add('k8s-ingress','Gateway API và mô phỏng lịch sử',
    'Ingress NGINX đã ngừng bảo trì tháng 3/2026. Lab hiện có là mô phỏng lịch sử, annotation rewrite-target phụ thuộc controller và không thể chuyển nguyên trạng sang Gateway API. Trên máy thật mới dùng Gateway API với controller đang duy trì như Envoy Gateway. Cần cả CRD và controller; GatewayClass chọn triển khai, Gateway tạo listener, HTTPRoute nối đường dẫn tới Service. HPA (bộ tự co giãn ngang) cần số đo và requests đúng.',
    'Giữ lab lịch sử để học định tuyến; dùng tài liệu Gateway API cho cluster thật.',
    ['Trong mô phỏng lịch sử: làm lab shop/api và annotation rewrite theo gợi ý bài.','Trên máy thật: mở Envoy Gateway Quickstart, cài phiên bản controller tương thích và Gateway API CRD theo hướng dẫn đó.','Tạo GatewayClass/Gateway/HTTPRoute, kiểm tra Accepted và ResolvedRefs, thử request theo Host.','Cài metrics-server phù hợp cluster thật và khai báo requests.cpu trước khi thử HPA.'],
    'Lab lịch sử định tuyến đúng shop/api; máy thật dùng controller hiện hành, không cài ingress-nginx.',
    ['HTTPRoute chưa Accepted/ResolvedRefs: kiểm tra parentRefs, namespace và backend.','Không có Gateway address: xem controller và cách công bố Service; HPA unknown cần metrics/requests.'],[retirement,gateway,ref('Envoy Gateway: Quickstart','https://gateway.envoyproxy.io/docs/tasks/quickstart/','Controller hiện hành','Làm theo cài đặt, GatewayClass và thử HTTPRoute trên máy thật.')]);
  add('k8s-stateful','Lưu trữ không thay backup',
    'StatefulSet giữ danh tính và volume theo replica; không tự bảo đảm tính nhất quán database hay bản sao dự phòng. PersistentVolumeClaim (yêu cầu volume bền vững, PVC) giữ dữ liệu nhưng có thể mất do xóa volume, chính sách reclaim hoặc sự cố lưu trữ. Backup cần nhất quán với database, lưu ngoài cùng miền lỗi và thử restore. Thời gian khôi phục và lượng dữ liệu có thể mất là tiêu chí cần đo.',
    'Kiểm chứng lưu bền vững và khôi phục là hai việc riêng.',
    ['Trong mô phỏng: ghi dữ liệu Redis rồi xóa Pod theo bài.','Đợi Pod tái tạo và đọc lại bộ đếm.','Trên máy thật: tạo backup bằng công cụ database, restore vào namespace hoặc môi trường riêng.','So sánh dữ liệu và ghi thời gian khôi phục; không thử phá dữ liệu đang dùng.'],
    'Dữ liệu còn sau restart nếu PVC gắn đúng; restore cần bằng chứng riêng ngoài mô phỏng.',
    ['PVC Pending: xem StorageClass và chế độ truy cập.','Backup có tệp nhưng restore thất bại: kiểm tra phiên bản và tính nhất quán.'],[ref('Kubernetes: StatefulSet','https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/','Danh tính và lưu trữ','Đọc vòng đời volume và thứ tự Pod.'),ref('Kubernetes: Persistent Volume','https://kubernetes.io/docs/concepts/storage/persistent-volumes/','Lưu bền vững','Đọc PVC, StorageClass và reclaim policy.')]);
  add('k8s-helm','Kiểm tra chart và quyền tối thiểu',
    'Helm thay giá trị vào template rồi quản lý release (bản cài đặt). Giá trị sai vẫn có thể tạo YAML hợp lệ nhưng ứng dụng lỗi; trên máy thật chạy lint/template trước khi install. RBAC (kiểm soát truy cập theo vai trò) cấp quyền theo verb/resource/namespace; tránh cluster-admin cho ứng dụng. RoleBinding trong namespace giảm phạm vi hơn ClusterRoleBinding.',
    'Xem tài nguyên được tạo và kiểm tra quyền cần thiết.',
    ['Trong mô phỏng: cài chart theo gợi ý, đổi values và xem Deployment.','Dùng lệnh RBAC đã hỗ trợ trong bài để kiểm tra quyền tài khoản.','Trên máy thật: helm lint và helm template, đọc manifest trước upgrade; thử kubectl auth can-i với danh tính/namespace phù hợp.'],
    'Values đổi manifest đúng mục tiêu; tài khoản được phép việc cần làm và bị từ chối việc ngoài phạm vi.',
    ['Template đúng nhưng app lỗi: kiểm tra values, Secret và readiness.','Forbidden: xác định đúng RoleBinding và namespace, không cấp cluster-admin để bỏ lỗi.'],[ref('Helm: chart','https://helm.sh/docs/topics/charts/','Đóng gói','Đọc cấu trúc chart, values và template.'),ref('Kubernetes: RBAC','https://kubernetes.io/docs/reference/access-authn-authz/rbac/','Phân quyền','Đọc Role, RoleBinding và quyền tối thiểu.')]);
  add('k8s-ml','Phiên bản mô hình và chất lượng phục vụ',
    'Phiên bản phục vụ gồm model, scaler, schema đầu vào và image; thiếu một phần có thể tạo dự đoán sai dù HTTP 200. Readiness chỉ đạt sau nạp model. Giới hạn kích thước đầu vào, timeout và tài nguyên, theo dõi độ trễ/lỗi cùng biến động dữ liệu. CPU không phản ánh mọi nút thắt suy luận; batch và hàng đợi cần số đo riêng.',
    'Kiểm tra hợp đồng đầu vào/đầu ra và nạp mô hình trước nhận tải.',
    ['Trong mô phỏng: triển khai API dự đoán theo bài và gửi đầu vào mẫu.','Thử trường hợp lỗi đã hỗ trợ, xem request/log và HPA.','Trên máy thật: lưu model cùng scaler/schema, thêm readiness sau nạp model và kiểm tra đầu vào sai.','Đo độ trễ theo tải trước khi chọn replica hoặc batch.'],
    'Đầu vào hợp lệ có kết quả đúng schema; đầu vào sai bị từ chối và Pod chưa nạp model chưa nhận lưu lượng.',
    ['Dự đoán lệch nhưng HTTP 200: xem phiên bản model/scaler và thứ tự cột.','CPU thấp mà chậm: xem hàng đợi, bộ nhớ hoặc dịch vụ phụ thuộc.'],[probes,observe,pitfalls]);
  add('devops-final','Bàn giao và kiểm chứng vận hành',
    'Một hệ thống đã apply chưa phải hoàn tất. Bàn giao cần phiên bản, cấu hình, cách rollback, backup/restore và số đo xác nhận. Lab dùng Ingress lịch sử; môi trường thật mới chuyển sang Gateway API/controller hiện hành. Thử sự cố ở môi trường riêng, ghi bằng chứng dữ liệu sống sót qua restart và khôi phục từ backup.',
    'Lập bảng kiểm chứng để người khác có thể vận hành lại.',
    ['Trong mô phỏng: hoàn thành triển khai, định tuyến, lưu dữ liệu và HPA theo gợi ý bài.','Ghi manifest cuối, request thành công và dữ liệu trước/sau restart.','Trên máy thật: kiểm tra pipeline gate và rollback, dùng Gateway API và thử restore riêng.','Ghi phiên bản, số đo lỗi/độ trễ, giới hạn mô phỏng và bước xử lý sự cố.'],
    'Có bằng chứng chức năng và dữ liệu, không chỉ Pod Running; thực hành thật có kế hoạch khôi phục.',
    ['Lab đạt không chứng minh bảo mật sản xuất: xem quyền, secret và controller thật.','Rollback manifest không hoàn tác database: dùng kế hoạch đã thử restore.'],[gateway,observe,storage]);
  // Gắn file trong kho riêng với nguồn đọc sâu bên ngoài.
  [{id:'overfit',download:'examples/ml/workflow.py',guide:'ml',label:'Quy trình train/validation/test trên máy'},{id:'dockerfile',download:'examples/devops/Dockerfile',guide:'devops',label:'Đóng gói chính Visual Lab'},{id:'docker-compose',download:'examples/devops/compose.yaml',guide:'devops',label:'Chạy web bằng Compose'},{id:'k8s-deploy',download:'examples/devops/kubernetes.yaml',guide:'devops',label:'Manifest cho cluster thử riêng'}].forEach(p=>{supplements[p.id].practice.download=p.download;supplements[p.id].sections.push({title:'Thực hành trên máy',html:`<p><a href="docs/tutorials/${p.guide}.html">${p.label}</a>: điều kiện, lệnh chạy, kết quả và giới hạn.</p>`});});
  const content={supplements};if(typeof module!=='undefined'&&module.exports)module.exports=content;else {root.LearningContent=root.LearningContent||{};root.LearningContent.supplements={...(root.LearningContent.supplements||{}),...supplements};}
})(typeof window!=='undefined'?window:globalThis);
