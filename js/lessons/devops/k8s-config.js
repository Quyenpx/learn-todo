/*
 * Bài K3 — ConfigMap, Secret, Probe và giới hạn tài nguyên.
 * Mục tiêu: tách cấu hình khỏi image, đưa mật khẩu vào Secret, dùng readinessProbe để chặn traffic
 * tới Pod chưa sẵn sàng, và nhận diện OOMKilled khi đặt limits.memory quá thấp.
 */
(function () {
  'use strict';
  const CONFIG_YAML = `apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  MESSAGE: "Chào mừng tới Visual Lab"
  APP_COLOR: teal
`;
  // Deployment tham chiếu ConfigMap: nếu apply trước khi có ConfigMap sẽ gặp CreateContainerConfigError
  const DEPLOY_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: vlab/web:1.0
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: web-config
`;
  const SECRET_YAML = `apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:              # viết chữ thường, API server tự mã hóa base64 vào data
  DB_PASSWORD: s3cr3t-Pa55
`;
  // cache.yaml cố ý đặt limits.memory 64Mi trong khi app cần ~90Mi → OOMKilled
  const CACHE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cache
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
        - name: cache
          image: vlab/web:1.0
          resources:
            requests:
              memory: 64Mi
              cpu: 50m
            limits:
              memory: 64Mi
`;
  const FILES = { 'config.yaml': CONFIG_YAML, 'deploy.yaml': DEPLOY_YAML, 'secret.yaml': SECRET_YAML, 'cache.yaml': CACHE_YAML };
  const dep = (e, n) => e && e.get && e.get('Deployment', n);
  const live = (e, app) => (e && e.list ? e.list('Pod').filter((p) => !p.sim.deletedAt && p.metadata.labels.app === app) : []);
  const allReady = (e, n) => { const d = dep(e, n); if (!d) return false; const v = e.depView(d); return v.updReady === v.desired && v.total === v.desired; };
  const mib = (s) => { const m = String(s || '').match(/^(\d+(?:\.\d+)?)(Mi|Gi|M|G)?$/); if (!m) return 0; const n = +m[1]; return m[2] === 'Gi' ? n * 1024 : m[2] === 'G' ? n * 953.7 : m[2] === 'M' ? n * 0.9537 : m[2] === 'Mi' ? n : n / 1048576; };

  const lesson = {
    id: 'k8s-config',
    course: 'devops',
    group: 'Kubernetes',
    icon: '🔐',
    navTitle: 'ConfigMap, Secret, Probe',
    navSub: 'Cấu hình, bí mật, sức khỏe',
    badge: 'DevOps · Bài 6',
    title: 'ConfigMap, Secret & Probe: cấu hình tách rời, ứng dụng biết tự báo ốm',
    files: FILES,
    lead: 'Cùng một image phải chạy được ở môi trường dev, staging, production — chỉ khác cấu hình. Bài này đưa cấu hình vào ConfigMap, mật khẩu vào Secret, dạy Kubernetes cách hỏi "app còn khỏe không?" và đặt giới hạn tài nguyên.',
    labs: [
      {
        id: 'configmap', title: 'Cấu hình qua ConfigMap',
        desc: 'Thử áp dụng <code>deploy.yaml</code> <b>trước</b>: Pod báo <code>CreateContainerConfigError</code> vì chưa có ConfigMap. Sau đó áp dụng <code>config.yaml</code>, Pod tự khởi động. Gọi app để thấy dòng <code>MESSAGE</code>.',
        hint: '<code>kubectl apply -f deploy.yaml</code> → <code>kubectl get pods</code> → <code>kubectl apply -f config.yaml</code> → <code>kubectl port-forward deployment/web 8080:8080</code> → <code>curl localhost:8080</code>.',
        reflect: { q: 'Sửa MESSAGE trong ConfigMap rồi apply, Pod đang chạy có đổi theo không?', a: 'Không. Biến môi trường chỉ được đọc lúc container khởi động. Cần kubectl rollout restart deployment/web để tạo Pod mới. (ConfigMap mount dạng volume thì file tự cập nhật sau ít phút.)' },
        check: (e) => {
          const ok = allReady(e, 'web') && live(e, 'web').every((p) => p.sim.env && p.sim.env.MESSAGE);
          const seen = e && e.state && e.state.requests.some((r) => r.code === 200 && r.pod && r.pod.startsWith('web-'));
          return ok && seen ? { ok: true } : { ok: false, msg: !ok ? 'Deployment web chưa chạy đủ Pod có biến MESSAGE từ ConfigMap.' : 'Hãy gọi thử app (port-forward + curl) để thấy MESSAGE.' };
        },
      },
      {
        id: 'secret', title: 'Mật khẩu qua Secret',
        desc: 'Tạo Secret <code>db-secret</code> và đưa khóa <code>DB_PASSWORD</code> vào container <code>web</code> dưới dạng biến môi trường. App sẽ in mật khẩu đã được che (<code>********</code>).',
        hint: 'Tạo Secret: <code>kubectl apply -f secret.yaml</code> (hoặc <code>kubectl create secret generic db-secret --from-literal=DB_PASSWORD=s3cr3t</code>). Rồi thêm vào container trong <code>deploy.yaml</code>:<pre class="code">          env:\n            - name: DB_PASSWORD\n              valueFrom:\n                secretKeyRef:\n                  name: db-secret\n                  key: DB_PASSWORD</pre>và <code>kubectl apply -f deploy.yaml</code>. Xem lại: <code>kubectl get secret db-secret -o yaml</code>.',
        reflect: { q: 'Secret có thật sự "bí mật" không?', a: 'Mặc định chỉ là base64 (ai đọc được Secret là giải mã được). Cần bật mã hóa etcd, phân quyền RBAC chặt và không commit Secret vào Git (dùng Sealed Secrets, External Secrets hoặc Vault).' },
        check: (e) => {
          const s = e && e.get && e.get('Secret', 'db-secret');
          const ok = s && allReady(e, 'web') && live(e, 'web').every((p) => p.sim.env && Object.keys(p.sim.env).some((k) => /PASSWORD/.test(k)));
          return ok ? { ok: true } : { ok: false, msg: !s ? 'Chưa có Secret db-secret.' : 'Các Pod web chưa nhận biến mật khẩu từ Secret (hoặc đang cập nhật).' };
        },
      },
      {
        id: 'probe', title: 'readinessProbe: chỉ nhận traffic khi sẵn sàng',
        desc: 'Thêm <code>readinessProbe</code> kiểu <code>httpGet</code> cổng 8080 vào container web. Thử đường dẫn <code>/health</code> trước: Pod chạy nhưng READY <code>0/1</code>, Service mất endpoint. Tìm đường dẫn đúng (gợi ý: thử <code>curl</code> vài đường dẫn) và sửa.',
        hint: 'Thêm vào container:<pre class="code">          readinessProbe:\n            httpGet:\n              path: /health\n              port: 8080\n            periodSeconds: 5</pre><code>kubectl describe pod …</code> sẽ thấy <code>Readiness probe failed: HTTP probe failed with statuscode: 404</code>. App này dùng <code>/healthz</code> → sửa và apply lại.',
        reflect: { q: 'Khác nhau giữa readiness và liveness?', a: 'readiness hỏng → Pod bị gỡ khỏi Service (không nhận traffic) nhưng không bị giết. liveness hỏng → kubelet giết và khởi động lại container. Đặt liveness sai sẽ khiến app bị restart liên tục.' },
        check: (e) => {
          const d = dep(e, 'web');
          const rp = d && d.spec.template.spec.containers[0].readinessProbe;
          const ok = rp && rp.httpGet && rp.httpGet.path === '/healthz' && allReady(e, 'web');
          return ok ? { ok: true } : { ok: false, msg: !rp ? 'Container web chưa có readinessProbe.' : 'readinessProbe chưa đúng đường dẫn hoặc Pod chưa READY.' };
        },
      },
      {
        id: 'oom', title: 'OOMKilled: giới hạn bộ nhớ quá thấp',
        desc: 'Áp dụng <code>cache.yaml</code>. Pod <code>cache</code> chạy vài giây rồi bị giết, <code>RESTARTS</code> tăng dần và chuyển <code>CrashLoopBackOff</code>. Dùng <code>describe</code> tìm lý do, rồi tăng <code>limits.memory</code> lên <code>256Mi</code>.',
        hint: '<code>kubectl apply -f cache.yaml</code> → <code>kubectl get pods -w</code> → <code>kubectl describe pod cache-…</code> (phần <code>Last State: Terminated, Reason: OOMKilled, Exit Code: 137</code>) → sửa <code>memory: 256Mi</code> ở limits (và requests nếu muốn) → apply lại.',
        reflect: { q: 'requests và limits khác nhau thế nào?', a: 'requests là phần được đặt chỗ — scheduler dùng để chọn node. limits là trần cứng: vượt CPU thì bị bóp chậm, vượt RAM thì bị kernel giết (OOMKilled, exit 137).' },
        check: (e) => {
          const d = dep(e, 'cache');
          const lim = d && ((d.spec.template.spec.containers[0].resources || {}).limits || {}).memory;
          const ok = d && mib(lim) >= 128 && allReady(e, 'cache');
          return ok ? { ok: true } : { ok: false, msg: !d ? 'Chưa có Deployment cache.' : mib(lim) < 128 ? `limits.memory hiện là ${lim || 'trống'} — vẫn quá thấp.` : 'Đợi Pod cache mới chạy ổn định (READY).' };
        },
      },
    ],
    quiz: [
      { q: 'Vì sao không nên "nướng" cấu hình (URL database, cờ tính năng) vào image?', options: ['Image sẽ quá lớn', 'Mỗi môi trường phải build image riêng; đổi cấu hình phải build lại. Tách ra ConfigMap thì một image dùng cho mọi môi trường', 'Docker cấm điều này', 'Kubernetes không đọc được'], answer: 1, explain: 'Nguyên tắc 12-factor: cấu hình nằm ở môi trường, không nằm trong code/image.' },
      { q: 'Trong Secret, trường <code>data</code> khác <code>stringData</code> ở điểm nào?', options: ['Giống nhau', 'data phải là chuỗi base64; stringData nhận chữ thường và được API server tự mã hóa vào data', 'stringData được mã hóa mạnh hơn', 'data chỉ dùng cho file'], answer: 1, explain: 'Giá trị không phải base64 hợp lệ trong data sẽ bị từ chối khi apply.' },
      { q: 'Pod <code>Running</code> nhưng READY <code>0/1</code>. Khả năng cao nhất là gì?', options: ['Image sai', 'readinessProbe đang thất bại', 'Node hết ổ đĩa', 'Service bị xóa'], answer: 1, explain: 'Container đã chạy (Running) nhưng chưa vượt qua readiness → bị gỡ khỏi endpoint của Service.' },
      { q: 'Container kết thúc với <code>Exit Code: 137, Reason: OOMKilled</code>. Cần làm gì?', options: ['Tăng CPU', 'Tăng limits.memory hoặc giảm lượng bộ nhớ app dùng', 'Đổi image tag', 'Xóa Service'], answer: 1, explain: '137 = 128 + 9 (SIGKILL). Kernel giết tiến trình vì vượt giới hạn bộ nhớ của cgroup.' },
      { q: 'Đã sửa giá trị trong ConfigMap (dùng qua <code>envFrom</code>). Làm sao để Pod nhận giá trị mới?', options: ['Không cần làm gì, tự cập nhật ngay', 'kubectl rollout restart deployment/web', 'kubectl delete configmap', 'Khởi động lại node'], answer: 1, explain: 'Biến môi trường được đọc một lần lúc khởi động container. Rollout restart tạo Pod mới đọc giá trị mới.' },
      { q: 'livenessProbe đặt sai đường dẫn (luôn 404) sẽ gây ra gì?', options: ['Không ảnh hưởng', 'Kubelet liên tục giết và khởi động lại container → CrashLoopBackOff', 'Pod chỉ bị gỡ khỏi Service', 'Deployment bị xóa'], answer: 1, explain: 'Liveness thất bại = "app đã chết" theo kubelet. Vì vậy liveness nên đơn giản và thận trọng hơn readiness.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Tách cấu hình khỏi image</h2>
        <p>Image nên giống hệt nhau ở mọi môi trường; thứ khác nhau (địa chỉ database, mức log, cờ tính năng) đưa vào từ bên ngoài. Kubernetes có hai đối tượng cho việc này:</p>
        <ul>
          <li><b>ConfigMap</b> — cấu hình thông thường, dạng khóa/giá trị hoặc cả file.</li>
          <li><b>Secret</b> — dữ liệu nhạy cảm (mật khẩu, token, chứng chỉ). Lưu dạng base64, có thể bật mã hóa trong etcd và phân quyền riêng.</li>
        </ul>
        <pre class="code"><code>containers:
  - name: web
    envFrom:                       # nạp MỌI khóa của ConfigMap thành biến môi trường
      - configMapRef: { name: web-config }
    env:
      - name: DB_PASSWORD          # nạp MỘT khóa của Secret
        valueFrom:
          secretKeyRef: { name: db-secret, key: DB_PASSWORD }
    volumeMounts:                  # hoặc mount thành file
      - { name: cfg, mountPath: /etc/app }
volumes:
  - name: cfg
    configMap: { name: web-config }</code></pre>
        <h3>Probe — Kubernetes hỏi thăm sức khỏe app</h3>
        <ul>
          <li><b>readinessProbe</b>: "đã sẵn sàng nhận request chưa?" Thất bại → gỡ khỏi Service, không giết.</li>
          <li><b>livenessProbe</b>: "còn sống không?" Thất bại liên tục → kubelet khởi động lại container.</li>
          <li><b>startupProbe</b>: cho app khởi động chậm thêm thời gian trước khi liveness bắt đầu kiểm tra.</li>
        </ul>
        <pre class="code"><code>readinessProbe:
  httpGet: { path: /healthz, port: 8080 }
  initialDelaySeconds: 3
  periodSeconds: 5
  failureThreshold: 3</code></pre>
        <h3>requests & limits</h3>
        <p><code>requests</code> là phần tài nguyên được <b>đặt chỗ</b> (scheduler dựa vào đó để chọn node; HPA dùng để tính % CPU). <code>limits</code> là <b>trần cứng</b>: vượt CPU bị bóp chậm, vượt bộ nhớ bị giết với lý do <code>OOMKilled</code>.</p>
        <div class="callout tip"><strong>Đơn vị:</strong> CPU tính bằng lõi — <code>500m</code> = nửa lõi. Bộ nhớ dùng <code>Mi</code>/<code>Gi</code> (lũy thừa 2): <code>128Mi</code> ≈ 134 MB.</div>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Tạo nhanh từ file có sẵn: <code>kubectl create configmap web-config --from-env-file=.env</code>, <code>kubectl create secret generic db-secret --from-literal=DB_PASSWORD=…</code>. Giải mã để kiểm tra: <code>kubectl get secret db-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 -d</code>. Xem bộ nhớ thực tế bằng <code>kubectl top pod</code> (cần cài metrics-server trên kind).</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>CreateContainerConfigError: configmap "…" not found</code> — tạo ConfigMap/Secret trước, hoặc đánh dấu <code>optional: true</code>.</li>
            <li><code>FailedMount</code> — volume tham chiếu ConfigMap/Secret chưa tồn tại.</li>
            <li><code>illegal base64 data</code> — giá trị trong <code>data</code> của Secret không phải base64; dùng <code>stringData</code>.</li>
            <li>READY <code>0/1</code> mãi — sai <code>path</code>/<code>port</code> của readinessProbe.</li>
            <li><code>OOMKilled</code> (exit 137) — tăng <code>limits.memory</code> hoặc tối ưu bộ nhớ app.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        engine: 'kube',
        diagram: 'k8s',
        title: '🔐 Cấu hình & sức khỏe ứng dụng',
        files: FILES,
        editFiles: ['deploy.yaml', 'config.yaml', 'secret.yaml', 'cache.yaml'],
        cvHeight: 340,
        height: 300,
        welcome: ['Có sẵn 4 file: deploy.yaml, config.yaml, secret.yaml, cache.yaml.', 'Thử: kubectl apply -f deploy.yaml → kubectl get pods (sẽ thấy lỗi cấu hình)'],
        chips: ['kubectl apply -f deploy.yaml', 'kubectl apply -f config.yaml', 'kubectl get pods', 'kubectl port-forward deployment/web 8080:8080', 'curl localhost:8080', 'kubectl apply -f secret.yaml', 'kubectl apply -f cache.yaml', 'kubectl get events'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
