/*
 * Bài K2 — Deployment & Service: tự phục hồi, cân bằng tải, rolling update và rollback.
 * Sơ đồ: cột trái là Deployment (mong muốn → thực tế), dây nối Service → các Pod sẵn sàng,
 * chấm sáng chạy dọc dây cho thấy request vừa được chia tới Pod nào.
 */
(function () {
  'use strict';
  const DEPLOY_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3                 # số bản sao mong muốn
  selector:
    matchLabels:
      app: web                # Deployment quản lý các Pod có nhãn này...
  template:                   # ...và tạo Pod mới theo khuôn này
    metadata:
      labels:
        app: web              # phải khớp selector ở trên
    spec:
      containers:
        - name: web
          image: vlab/web:1.0
          ports:
            - containerPort: 8080
`;
  const SVC_YAML = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web          # gửi traffic tới mọi Pod READY có nhãn app=web
  ports:
    - port: 80        # cổng của Service
      targetPort: 8080  # cổng container đang lắng nghe
`;
  const FILES = { 'deploy.yaml': DEPLOY_YAML, 'service.yaml': SVC_YAML };
  const hist = (e) => (e && e.state ? e.state.history : []);
  const dep = (e) => e && e.get && e.get('Deployment', 'web');

  const lesson = {
    id: 'k8s-deploy',
    course: 'devops',
    group: 'Kubernetes',
    icon: '🔁',
    navTitle: 'Deployment & Service',
    navSub: 'Tự phục hồi, chia tải, cập nhật',
    badge: 'DevOps · Bài 5',
    title: 'Deployment & Service: ứng dụng tự sống lại và cập nhật không gián đoạn',
    files: FILES,
    lead: 'Pod "trần" chết là mất. Deployment giữ đúng số bản sao bạn muốn, thay Pod hỏng và cập nhật phiên bản từng chút một. Service cho các Pod một địa chỉ cố định và chia đều request.',
    labs: [
      {
        id: 'apply', title: 'Triển khai 3 bản sao',
        desc: 'Áp dụng <code>deploy.yaml</code> và đợi Deployment <code>web</code> báo <code>3/3</code>. Xem thêm <code>kubectl get rs</code>: Deployment không tạo Pod trực tiếp mà qua một <b>ReplicaSet</b>.',
        hint: '<code>kubectl apply -f deploy.yaml</code> → <code>kubectl get deploy,rs,pods</code>.',
        check: (e) => { const d = dep(e); return d && e.depView(d).ready >= 3 ? { ok: true } : { ok: false, msg: 'Deployment web chưa có 3 Pod sẵn sàng.' }; },
      },
      {
        id: 'heal', title: 'Phá thử: xóa một Pod',
        desc: 'Xóa một Pod của Deployment (chọn tên bất kỳ trong <code>kubectl get pods</code>). Quan sát sơ đồ: Pod cũ chuyển xám (Terminating), ngay lập tức Pod mới với tên khác được tạo để quay về <code>3/3</code>.',
        hint: '<code>kubectl delete pod web-xxxxxxxxxx-yyyyy</code> (gõ <code>kubectl delete pod web-</code> rồi nhấn Tab để tự điền).',
        reflect: { q: 'Ai đã tạo Pod mới?', a: 'ReplicaSet controller trong control plane. Nó thấy "mong muốn 3, thực tế 2" và tạo thêm 1 Pod. Đây là vòng lặp hòa giải (reconcile loop) — trái tim của Kubernetes.' },
        check: (e) => {
          const d = dep(e);
          const del = hist(e).some((x) => x.ok && x.verb === 'delete' && x.meta && x.meta.kind === 'Pod' && (x.meta.owned || []).some((o) => o && o.startsWith('web-')));
          return del && d && e.depView(d).ready === e.depView(d).desired ? { ok: true } : { ok: false, msg: !del ? 'Chưa xóa Pod nào thuộc Deployment web.' : 'Đợi Deployment quay về đủ số Pod sẵn sàng.' };
        },
      },
      {
        id: 'svc', title: 'Service chia tải cho nhiều Pod',
        desc: 'Tạo Service <code>web</code> (dùng <code>service.yaml</code> hoặc <code>kubectl expose</code>). Sau đó mở một Pod tạm và gọi <code>wget -qO- web</code> nhiều lần: câu trả lời đến từ <b>các Pod khác nhau</b>.',
        hint: '<code>kubectl apply -f service.yaml</code> → <code>kubectl run tmp --image=busybox --rm -it -- sh</code> → trong Pod: <code>wget -qO- web</code> (lặp 4–5 lần) → <code>exit</code>. Hoặc từ máy host: <code>kubectl port-forward svc/web 8080:80</code> rồi <code>curl localhost:8080</code>.',
        reflect: { q: 'Vì sao không gọi thẳng IP của Pod?', a: 'IP của Pod đổi mỗi khi Pod được tạo lại. Service có IP và tên DNS cố định (web, web.default.svc.cluster.local) và tự cập nhật danh sách endpoint theo Pod READY.' },
        check: (e) => {
          const pods = new Set((e && e.state ? e.state.requests : []).filter((r) => r.svc === 'web' && r.code === 200).map((r) => r.pod));
          return pods.size >= 2 ? { ok: true } : { ok: false, msg: `Mới thấy request qua Service web tới ${pods.size} Pod. Cần ít nhất 2 Pod khác nhau.` };
        },
      },
      {
        id: 'rollout', title: 'Cập nhật, gặp bản lỗi và rollback',
        desc: 'Cập nhật image lên <code>vlab/web:2.0</code> và theo dõi rolling update. Rồi thử triển khai bản lỗi <code>vlab/web:broken</code>: rollout bị kẹt nhưng các Pod cũ <b>vẫn phục vụ</b>. Cuối cùng quay lại bản trước bằng <code>rollout undo</code>.',
        hint: '<code>kubectl set image deployment/web web=vlab/web:2.0</code> → <code>kubectl rollout status deployment/web</code> → <code>kubectl set image deployment/web web=vlab/web:broken</code> → <code>kubectl get pods</code> (thấy CrashLoopBackOff) → <code>kubectl rollout undo deployment/web</code> → <code>kubectl rollout history deployment/web</code>.',
        reflect: { q: 'Vì sao bản lỗi không làm sập cả ứng dụng?', a: 'Rolling update chỉ thay từng phần (maxUnavailable 25%). Pod mới không READY thì Deployment không xóa thêm Pod cũ, nên traffic vẫn chạy trên các Pod cũ khỏe mạnh.' },
        check: (e) => {
          const h = hist(e), d = dep(e);
          const broke = h.some((x) => x.ok && x.verb === 'set' && /broken/.test((x.meta && x.meta.image) || ''));
          const undo = h.some((x) => x.ok && x.verb === 'rollout' && x.meta && x.meta.sub === 'undo');
          const healthy = d && !/broken/.test(d.spec.template.spec.containers[0].image) && e.depView(d).updReady === e.depView(d).desired;
          return broke && undo && healthy ? { ok: true } : { ok: false, msg: !broke ? 'Chưa thử triển khai bản vlab/web:broken.' : !undo ? 'Chưa chạy kubectl rollout undo.' : 'Đợi rollback hoàn tất (mọi Pod mới đều READY).' };
        },
      },
    ],
    quiz: [
      { q: 'Quan hệ giữa Deployment, ReplicaSet và Pod là gì?', options: ['Ba tên gọi của cùng một thứ', 'Deployment quản lý ReplicaSet (mỗi phiên bản một RS); ReplicaSet giữ đủ số Pod', 'Pod quản lý Deployment', 'ReplicaSet quản lý Deployment'], answer: 1, explain: 'Mỗi lần đổi template, Deployment tạo RS mới và thu nhỏ RS cũ dần. RS cũ được giữ lại để rollback.' },
      { q: '<code>selector.matchLabels</code> không khớp <code>template.metadata.labels</code> thì sao?', options: ['Vẫn chạy bình thường', 'API server từ chối: selector does not match template labels', 'Pod được tạo nhưng không có nhãn', 'Deployment tự sửa nhãn'], answer: 1, explain: 'Nếu cho phép, Deployment sẽ tạo Pod mà chính nó không nhận ra và tạo mãi không dừng.' },
      { q: 'Service chọn Pod để gửi traffic dựa vào đâu?', options: ['Tên Pod', 'Nhãn (selector) và trạng thái READY', 'Node mà Pod đang chạy', 'Thứ tự tạo Pod'], answer: 1, explain: 'Endpoint = Pod khớp selector VÀ đang READY. Pod chưa sẵn sàng không nhận traffic.' },
      { q: 'Kiểu Service nào cho phép truy cập từ ngoài cluster qua cổng 30000–32767 trên mọi node?', options: ['ClusterIP', 'NodePort', 'Headless', 'ExternalName'], answer: 1, explain: 'ClusterIP (mặc định) chỉ dùng trong cluster. NodePort mở cổng trên mọi node. LoadBalancer xin IP công khai từ nhà cung cấp cloud.' },
      { q: 'Đang rolling update thì bản mới bị CrashLoopBackOff. Lệnh nào quay về bản trước?', options: ['kubectl delete deployment web', 'kubectl rollout undo deployment/web', 'kubectl restart web', 'kubectl apply -f old.yaml --force'], answer: 1, explain: 'rollout undo kích hoạt lại ReplicaSet của revision trước. Thêm --to-revision=N để chọn revision cụ thể.' },
      { q: '<code>maxSurge: 25%, maxUnavailable: 25%</code> với 4 replica nghĩa là gì?', options: ['Tối đa 25 Pod', 'Trong lúc cập nhật có thể có tối đa 5 Pod (thêm 1) và luôn còn ít nhất 3 Pod sẵn sàng', 'Cập nhật 25% mỗi phút', 'Chỉ cập nhật 1 Pod rồi dừng'], answer: 1, explain: 'maxSurge cho phép tạo thêm Pod vượt số mong muốn; maxUnavailable giới hạn số Pod được phép không sẵn sàng.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Deployment: khai báo "mong muốn", controller lo phần còn lại</h2>
        <p>Bạn không ra lệnh "tạo 3 Pod" mà khai báo <b>trạng thái mong muốn</b>: "luôn có 3 Pod chạy web:1.0". Controller liên tục so sánh với thực tế và sửa chênh lệch — Pod chết thì tạo mới, thừa thì xóa bớt.</p>
        <pre class="code"><code>Deployment web (replicas: 3, image: web:2.0)
  ├─ ReplicaSet web-7d9c… (rev 2, web:2.0) ── Pod ×3
  └─ ReplicaSet web-5f4b… (rev 1, web:1.0) ── Pod ×0  ← giữ lại để rollback</code></pre>
        <h3>Rolling update</h3>
        <p>Khi đổi image (hoặc bất kỳ trường nào trong <code>template</code>), Deployment tạo ReplicaSet mới, tăng dần Pod mới và giảm dần Pod cũ. Pod mới phải <b>READY</b> thì mới xóa tiếp Pod cũ, nên luôn có Pod phục vụ.</p>
        <ul>
          <li><code>kubectl set image deployment/web web=vlab/web:2.0</code> — đổi image nhanh (thực tế nên sửa YAML và <code>apply</code>).</li>
          <li><code>kubectl rollout status | history | undo deployment/web</code>.</li>
          <li><code>kubectl scale deployment web --replicas=5</code>.</li>
        </ul>
        <h3>Service: địa chỉ ổn định cho một nhóm Pod</h3>
        <p>Pod đến rồi đi, IP thay đổi liên tục. <b>Service</b> có IP ảo (ClusterIP) và tên DNS cố định, tự chia request cho các Pod khớp <code>selector</code> và đang READY.</p>
        <pre class="code"><code>          ┌──▶ Pod 10.244.1.12:8080
web:80 ───┼──▶ Pod 10.244.2.13:8080     (kube-proxy chia đều)
(10.96.x) └──▶ Pod 10.244.1.14:8080</code></pre>
        <ul>
          <li><b>ClusterIP</b> (mặc định): chỉ gọi được trong cluster — <code>http://web</code>, <code>web.default.svc.cluster.local</code>.</li>
          <li><b>NodePort</b>: mở thêm cổng 30000–32767 trên mọi node.</li>
          <li><b>LoadBalancer</b>: trên cloud, xin một IP công khai.</li>
        </ul>
        <div class="callout tip"><strong>Khi gỡ lỗi Service:</strong> <code>kubectl get endpoints web</code>. Nếu rỗng → selector không khớp nhãn Pod hoặc Pod chưa READY. Nếu có endpoint mà vẫn lỗi → kiểm tra <code>targetPort</code> có đúng cổng container lắng nghe.</div>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Trên cluster kind, thay <code>vlab/web</code> bằng một image có sẵn như <code>nginxdemos/hello</code> hoặc image bạn tự build ở bài D2 (nạp vào kind bằng <code>kind load docker-image myapp:v1 --name lab</code>). <code>kubectl port-forward svc/web 8080:80</code> rồi mở <code>http://localhost:8080</code>. Theo dõi rolling update trực tiếp bằng <code>kubectl get pods -w</code>.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>selector does not match template labels</code> — nhãn ở <code>selector.matchLabels</code> và <code>template.metadata.labels</code> phải giống nhau.</li>
            <li><code>field is immutable</code> khi apply — <code>spec.selector</code> của Deployment không sửa được; phải xóa và tạo lại.</li>
            <li>Service không có endpoint — sai nhãn, hoặc Pod chưa READY.</li>
            <li><code>connection refused</code> qua Service — <code>targetPort</code> khác cổng app lắng nghe.</li>
            <li><code>rollout status</code> báo <code>exceeded its progress deadline</code> — bản mới không lên được; xem Pod mới bằng <code>describe</code>/<code>logs</code> rồi <code>rollout undo</code>.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        engine: 'kube',
        diagram: 'k8s',
        title: '🔁 Deployment & Service',
        files: FILES,
        editFiles: ['deploy.yaml', 'service.yaml'],
        cvHeight: 360,
        height: 300,
        welcome: ['Cluster "lab" đang trống. File deploy.yaml và service.yaml ở khung bên cạnh.', 'Thử: kubectl apply -f deploy.yaml → kubectl get deploy,rs,pods'],
        chips: ['kubectl apply -f deploy.yaml', 'kubectl get deploy,rs,pods', 'kubectl apply -f service.yaml', 'kubectl get endpoints web', 'kubectl run tmp --image=busybox --rm -it -- sh', 'kubectl set image deployment/web web=vlab/web:2.0', 'kubectl rollout status deployment/web', 'kubectl rollout undo deployment/web'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
