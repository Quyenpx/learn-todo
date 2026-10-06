/*
 * Bài K4 — Ingress & tự co giãn (HPA).
 * Mục tiêu: định tuyến nhiều app sau một cổng 80 theo domain/đường dẫn, hiểu rewrite-target,
 * và để HorizontalPodAutoscaler tăng/giảm số Pod theo % CPU so với requests.
 */
(function () {
  'use strict';
  const APPS_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
        - name: shop
          image: vlab/web:1.0
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: vlab/web:2.0
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
`;
  // Ingress khởi đầu chỉ có "/" → shop; người học tự thêm nhánh /api
  const ING_YAML = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop
                port:
                  number: 80
`;
  const FILES = { 'apps.yaml': APPS_YAML, 'ingress.yaml': ING_YAML };
  const reqs = (e) => (e && e.state ? e.state.requests : []);
  const ready = (e, n) => { const d = e && e.get && e.get('Deployment', n); if (!d) return false; const v = e.depView(d); return v.ready >= v.desired && v.desired > 0; };

  const lesson = {
    id: 'k8s-ingress',
    course: 'devops',
    group: 'Kubernetes',
    icon: '🌐',
    navTitle: 'Ingress & tự co giãn',
    navSub: 'Định tuyến domain, HPA',
    badge: 'DevOps · Bài 7',
    title: 'Ingress & HPA: một cổng vào cho nhiều app, số Pod tự theo tải',
    files: FILES,
    lead: 'Mỗi Service một NodePort thì vừa xấu vừa khó nhớ. Ingress gom mọi thứ về cổng 80 và định tuyến theo domain/đường dẫn. Khi lượng truy cập tăng, HorizontalPodAutoscaler tự thêm Pod và bớt đi khi tải giảm.',
    labs: [
      {
        id: 'apps', title: 'Triển khai hai app: shop và api',
        desc: '<code>apps.yaml</code> chứa 4 đối tượng (2 Deployment + 2 Service) ngăn cách bởi <code>---</code>. Áp dụng một lần và đợi cả hai Deployment sẵn sàng.',
        hint: '<code>kubectl apply -f apps.yaml</code> → <code>kubectl get deploy,svc</code>.',
        check: (e) => (ready(e, 'shop') && ready(e, 'api') ? { ok: true } : { ok: false, msg: 'Deployment shop và api chưa cùng sẵn sàng.' }),
      },
      {
        id: 'ingress', title: 'Vào shop qua domain shop.local',
        desc: 'Áp dụng <code>ingress.yaml</code> rồi <code>curl shop.local/</code>. Request đi: máy bạn → Ingress controller (nginx, cổng 80) → Service shop → một Pod shop.',
        hint: '<code>kubectl apply -f ingress.yaml</code> → <code>kubectl get ingress</code> → <code>curl shop.local/</code>. (Trong lab, mọi domain <code>*.local</code> đã trỏ về 127.0.0.1 như khi bạn sửa file hosts.) Thử <code>curl other.local/</code> để thấy 404 của nginx.',
        check: (e) => (reqs(e).some((r) => r.ingress && r.svc === 'shop' && r.code === 200) ? { ok: true } : { ok: false, msg: 'Chưa có request nào đi qua Ingress tới shop thành công.' }),
      },
      {
        id: 'api-path', title: 'Thêm đường dẫn /api (cần rewrite)',
        desc: 'Cho <code>shop.local/api/…</code> đi vào Service <code>api</code>. Thêm path <code>/api</code> rồi <code>curl shop.local/api/version</code>: bạn sẽ nhận <b>404</b> vì app api không biết đường dẫn <code>/api/version</code>. Dùng annotation <code>rewrite-target</code> để cắt tiền tố <code>/api</code> trước khi chuyển vào app.',
        hint: 'Cách gọn nhất: tạo thêm một Ingress riêng cho api (thêm vào cuối <code>ingress.yaml</code>):<pre class="code">---\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: api\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /$2\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: shop.local\n      http:\n        paths:\n          - path: /api(/|$)(.*)\n            pathType: ImplementationSpecific\n            backend:\n              service:\n                name: api\n                port:\n                  number: 80</pre><code>/api/version</code> khớp regex, nhóm <code>$2</code> = <code>version</code> → app nhận <code>/version</code>.',
        reflect: { q: 'Vì sao tách Ingress api riêng thay vì thêm vào Ingress shop?', a: 'Annotation áp dụng cho cả Ingress. Nếu đặt rewrite-target /$2 vào Ingress shop thì nhánh "/" cũng bị viết lại theo. Tách riêng giúp mỗi nhóm đường dẫn có quy tắc của mình.' },
        check: (e) => (reqs(e).some((r) => r.ingress && r.svc === 'api' && r.code === 200 && /^\/api/.test(r.path || '')) ? { ok: true } : { ok: false, msg: 'Chưa có request shop.local/api/... nào tới Service api với mã 200.' }),
      },
      {
        id: 'hpa', title: 'Tự co giãn theo CPU',
        desc: 'Bật HPA cho Deployment <code>api</code> (CPU mục tiêu 50%, từ 1 đến 5 Pod). HPA cần <code>requests.cpu</code> mới tính được %. Sau đó chạy một Pod tạo tải gọi liên tục vào <code>api</code> và xem số Pod tăng (HPA kiểm tra mỗi 15 giây).',
        hint: '<code>kubectl set resources deployment api --requests=cpu=100m</code> → <code>kubectl autoscale deployment api --cpu-percent=50 --min=1 --max=5</code> → <code>kubectl get hpa</code> (TARGETS hết <code>&lt;unknown&gt;</code>) → <code>kubectl run load --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://api; done"</code> → đợi 15–30 giây rồi <code>kubectl get hpa,pods</code>. Xong thì <code>kubectl delete pod load</code> và quan sát số Pod giảm dần.',
        reflect: { q: 'Vì sao giảm Pod chậm hơn tăng?', a: 'HPA có cửa sổ ổn định khi thu nhỏ (mặc định 5 phút, lab rút còn 30 giây) để tránh dao động: tải vừa giảm đã xóa Pod, tải tăng lại thì phải tạo lại — tốn thời gian khởi động.' },
        check: (e) => {
          const h = e && e.list && e.list('HorizontalPodAutoscaler').find((x) => x.spec.scaleTargetRef.name === 'api');
          const d = e && e.get && e.get('Deployment', 'api');
          const ok = h && d && (d.spec.replicas || 1) > (h.spec.minReplicas || 1);
          return ok ? { ok: true } : { ok: false, msg: !h ? 'Chưa có HPA cho Deployment api.' : 'HPA chưa tăng số Pod của api. Kiểm tra requests.cpu và Pod tạo tải, rồi đợi thêm.' };
        },
      },
    ],
    quiz: [
      { q: 'Ingress khác Service kiểu NodePort ở điểm nào?', options: ['Giống nhau', 'Ingress là quy tắc định tuyến HTTP (domain/đường dẫn) chạy trên một Ingress controller, gom nhiều Service sau một cổng 80/443', 'Ingress chỉ dùng cho TCP', 'Ingress thay thế Deployment'], answer: 1, explain: 'NodePort mở mỗi Service một cổng cao. Ingress đứng trước, đọc Host và path của request để chọn Service.' },
      { q: 'Tạo Ingress nhưng không có Ingress controller nào trong cluster thì sao?', options: ['Kubernetes tự cài nginx', 'Ingress được lưu nhưng không có gì xử lý — không truy cập được', 'API server từ chối', 'Service tự đổi thành NodePort'], answer: 1, explain: 'Ingress chỉ là cấu hình. Cần cài controller (ingress-nginx, Traefik, HAProxy...) và chọn đúng ingressClassName.' },
      { q: 'Vì sao cần <code>rewrite-target</code> khi định tuyến <code>/api</code> tới một app?', options: ['Để tăng tốc', 'App chỉ biết đường dẫn của nó (/version), không biết tiền tố /api mà Ingress dùng để phân luồng', 'Để bật HTTPS', 'Bắt buộc với mọi Ingress'], answer: 1, explain: 'Không rewrite, app nhận /api/version và trả 404.' },
      { q: 'HPA hiển thị <code>cpu: &lt;unknown&gt;/50%</code>. Nguyên nhân thường gặp?', options: ['Pod quá nhiều', 'Container thiếu resources.requests.cpu hoặc chưa có metrics-server', 'Ingress lỗi', 'Image sai'], answer: 1, explain: '% CPU = mức dùng thực tế / requests.cpu. Không có requests thì không có mẫu số.' },
      { q: 'CPU trung bình 150%, mục tiêu 50%, đang có 2 Pod. HPA muốn bao nhiêu Pod?', options: ['2', '3', '6', '150'], answer: 2, explain: 'desired = ceil(2 × 150/50) = 6 (bị giới hạn bởi maxReplicas).' },
      { q: 'Đang dùng HPA cho Deployment, bạn chạy <code>kubectl scale --replicas=10</code>. Điều gì xảy ra?', options: ['Giữ 10 Pod mãi', 'HPA ghi đè lại số replica ở lần đồng bộ tiếp theo theo tải thực tế', 'HPA bị xóa', 'Deployment bị khóa'], answer: 1, explain: 'HPA sở hữu trường replicas. Muốn đổi khoảng, hãy sửa minReplicas/maxReplicas của HPA.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Ingress: một cổng vào, nhiều ứng dụng</h2>
        <p><b>Ingress</b> là bộ quy tắc HTTP: "request có Host <code>shop.local</code> và đường dẫn <code>/api</code> thì gửi tới Service <code>api</code>". Quy tắc được thực thi bởi một <b>Ingress controller</b> — thực chất là một nginx (hoặc Traefik...) chạy trong cluster, lắng nghe cổng 80/443.</p>
        <pre class="code"><code>                      ┌─ Host: shop.local, /      ─▶ Service shop ─▶ Pod shop ×2
curl ─▶ :80 ingress ──┤
       -nginx         └─ Host: shop.local, /api/* ─▶ Service api  ─▶ Pod api</code></pre>
        <ul>
          <li><code>pathType: Prefix</code> — khớp theo tiền tố từng đoạn (<code>/api</code> khớp <code>/api/x</code>, không khớp <code>/apix</code>).</li>
          <li><code>pathType: Exact</code> — khớp nguyên văn.</li>
          <li><code>ImplementationSpecific</code> — do controller quyết định; với ingress-nginx cho phép regex.</li>
        </ul>
        <div class="callout tip"><strong>HTTPS:</strong> thêm khối <code>tls</code> trỏ tới Secret chứa chứng chỉ; kết hợp cert-manager để tự xin chứng chỉ Let's Encrypt.</div>
        <h3>HorizontalPodAutoscaler (HPA)</h3>
        <p>HPA định kỳ (15 giây) đọc CPU từ metrics-server và tính:</p>
        <pre class="code"><code>số Pod mong muốn = ceil( số Pod hiện tại × CPU hiện tại / CPU mục tiêu )</code></pre>
        <p>"CPU hiện tại" tính theo <b>% của requests.cpu</b>, nên container bắt buộc khai báo <code>resources.requests.cpu</code>.</p>
        <pre class="code"><code>apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 50 }</code></pre>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Với kind, tạo cluster có ánh xạ cổng 80 (<code>extraPortMappings</code> trên node control-plane, kèm nhãn <code>ingress-ready=true</code>), rồi cài controller: <code>kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml</code>. Thêm <code>127.0.0.1 shop.local</code> vào file hosts. HPA cần metrics-server: cài từ <code>github.com/kubernetes-sigs/metrics-server</code> và thêm cờ <code>--kubelet-insecure-tls</code> trên kind.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li>404 từ nginx — Host hoặc path không khớp quy tắc nào (kiểm tra <code>kubectl describe ingress</code>).</li>
            <li>503 Service Temporarily Unavailable — Service backend không có endpoint (Pod chưa READY, sai selector).</li>
            <li>Ingress không có ADDRESS — chưa cài controller hoặc sai <code>ingressClassName</code>.</li>
            <li><code>pathType: Required value</code> — networking.k8s.io/v1 bắt buộc khai báo pathType.</li>
            <li>HPA <code>&lt;unknown&gt;</code> — thiếu requests.cpu hoặc metrics-server.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        engine: 'kube',
        diagram: 'k8s',
        title: '🌐 Ingress & tự co giãn',
        files: FILES,
        editFiles: ['apps.yaml', 'ingress.yaml'],
        cvHeight: 400,
        height: 300,
        welcome: ['Có sẵn apps.yaml (shop + api) và ingress.yaml. Ingress controller nginx đã được cài trong cluster.', 'Thử: kubectl apply -f apps.yaml → kubectl apply -f ingress.yaml → curl shop.local/'],
        chips: ['kubectl apply -f apps.yaml', 'kubectl apply -f ingress.yaml', 'kubectl get ingress', 'curl shop.local/', 'curl shop.local/api/version', 'kubectl set resources deployment api --requests=cpu=100m', 'kubectl autoscale deployment api --cpu-percent=50 --min=1 --max=5', 'kubectl get hpa,pods'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
