/*
 * Dự án tổng kết khóa DevOps: nhận bàn giao manifest có lỗi, đưa hệ thống web + Redis lên namespace prod,
 * mở ra ngoài qua Ingress, chứng minh dữ liệu sống sót khi Redis khởi động lại và bật tự co giãn.
 * Lab chấm theo trạng thái cluster nên người học được tự chọn cách sửa.
 */
(function () {
    'use strict';
    const SHOP_YAML = `# Hệ thống "shop": web đếm lượt xem (vlab/counter, cổng 5000) + Redis lưu số đếm.
# Bàn giao từ đồng nghiệp — chạy chưa được. Triển khai vào namespace prod:
#   kubectl apply -f shop.yaml -n prod
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  REDIS_HOST: redis
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  clusterIP: None
  selector:
    app: redis
  ports:
    - port: 6379
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: shop-web
    spec:
      containers:
        - name: web
          image: vlab/counter:1.0
          ports:
            - containerPort: 5000
          envFrom:
            - configMapRef:
                name: web-config
          readinessProbe:
            httpGet:
              path: /healthz
              port: 5000
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
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
            backend:
              service:
                name: web
                port:
                  number: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
`;
    const FILES = { 'shop.yaml': SHOP_YAML };
    const NS = 'prod';
    const g = (e, k, n) => e && e.get && e.get(k, n, NS);
    const reqs = (e) => (e && e.state ? e.state.requests : []);
    const okHit = (r) => r.ingress && r.svc === 'web' && r.code === 200 && r.count > 0;

    const lesson = {
        id: 'devops-final',
        course: 'devops',
        group: 'Tổng kết',
        icon: '🎓',
        navTitle: 'Dự án tổng kết',
        navSub: 'Từ manifest lỗi tới production',
        badge: 'DevOps · Dự án tổng kết',
        title: 'Dự án tổng kết: đưa hệ thống "shop" lên production',
        files: FILES,
        lead: 'Đồng nghiệp bàn giao file shop.yaml cho hệ thống đếm lượt xem (web + Redis) rồi đi nghỉ phép. File có 5 lỗi. Nhiệm vụ của bạn: đưa hệ thống lên namespace prod, chạy ổn định, chịu được sự cố và tự co giãn — dùng mọi thứ đã học từ Docker tới Kubernetes.',
        labs: [
            {
                id: 'ns', title: 'Chuẩn bị namespace prod',
                desc: 'Tạo namespace <code>prod</code> và áp dụng <code>shop.yaml</code> vào đó. Sẽ có đối tượng tạo được, có đối tượng báo lỗi — ghi lại các lỗi để xử lý ở các bước sau.',
                hint: '<code>kubectl create namespace prod</code> → <code>kubectl config set-context --current --namespace=prod</code> (từ giờ không cần gõ <code>-n prod</code>; sơ đồ cũng chuyển sang prod) → <code>kubectl apply -f shop.yaml</code>.',
                check: (e) => (g(e, 'ConfigMap', 'web-config') ? { ok: true } : { ok: false, msg: 'Chưa có ConfigMap web-config trong namespace prod.' }),
            },
            {
                id: 'redis', title: 'Redis bền vững',
                desc: 'StatefulSet <code>redis</code> phải chạy <code>1/1</code> với PVC <code>data-redis-0</code> ở trạng thái <code>Bound</code>.',
                hint: 'Lỗi báo <code>volumeMounts[0].name: Not found: "redis-data"</code> — tên trong volumeMounts phải trùng tên trong <code>volumeClaimTemplates</code> (<code>data</code>). Sửa rồi apply lại; kiểm tra <code>kubectl get sts,pvc</code>.',
                check: (e) => { const s = g(e, 'StatefulSet', 'redis'); const c = g(e, 'PersistentVolumeClaim', 'data-redis-0'); return s && e.stsView(s).ready >= 1 && c && c.sim.pv ? { ok: true } : { ok: false, msg: !s ? 'Chưa có StatefulSet redis trong prod.' : 'Redis chưa sẵn sàng hoặc PVC data-redis-0 chưa Bound.' }; },
            },
            {
                id: 'web', title: 'Web: 3 bản sao sẵn sàng',
                desc: 'Deployment <code>web</code> chạy đủ <code>3/3</code> Pod sẵn sàng (readinessProbe đạt).',
                hint: 'Lỗi <code>selector does not match template labels</code>: nhãn trong <code>template.metadata.labels</code> phải khớp <code>selector.matchLabels</code> (và khớp selector của Service web). Đổi về <code>app: web</code>.',
                check: (e) => { const d = g(e, 'Deployment', 'web'); if (!d) return { ok: false, msg: 'Chưa có Deployment web trong prod.' }; const v = e.depView(d); return v.updReady >= 3 && v.updReady === v.desired ? { ok: true } : { ok: false, msg: `Deployment web: ${v.updReady}/${v.desired} Pod sẵn sàng.` }; },
            },
            {
                id: 'ingress', title: 'Mở cửa: http://shop.local',
                desc: '<code>curl shop.local</code> trả về <code>Xin chào! Trang này đã được xem N lần</code> — request đi qua Ingress → Service web → Pod web → Redis.',
                hint: 'Hai lỗi: Ingress thiếu <code>pathType: Prefix</code>; Service web trỏ <code>targetPort: 8080</code> trong khi app nghe cổng <b>5000</b> (Ingress trả <b>503</b>, <code>kubectl get endpoints web</code> có địa chỉ nhưng sai cổng). Sửa, apply, rồi <code>curl shop.local</code>.',
                check: (e) => (reqs(e).some(okHit) ? { ok: true } : { ok: false, msg: 'Chưa có request nào qua Ingress tới web trả về số đếm (mã 200).' }),
            },
            {
                id: 'resilience', title: 'Sự cố: Redis khởi động lại, số đếm không mất',
                desc: 'Giả lập sự cố: xóa Pod <code>redis-0</code>. Khi Redis quay lại, gọi <code>curl shop.local</code> — số đếm phải <b>tiếp tục tăng</b> từ con số cũ, không quay về 1.',
                hint: '<code>curl shop.local</code> vài lần (nhớ con số) → <code>kubectl delete pod redis-0</code> → <code>kubectl get pods -w</code> tới khi redis-0 Running → <code>curl shop.local</code>.',
                reflect: { q: 'Nếu Redis chạy bằng Deployment không có PVC thì sao?', a: 'Pod mới khởi động với /data trống → số đếm về 1. Dữ liệu chỉ sống sót vì nằm trên PV gắn với PVC data-redis-0, và StatefulSet gắn lại đúng PVC đó cho Pod redis-0 mới.' },
                check: (e) => {
                    const del = (e && e.state ? e.state.history : []).find((h) => h.ok && h.verb === 'delete' && h.meta && h.meta.kind === 'Pod' && (h.meta.names || []).includes('redis-0'));
                    if (!del) return { ok: false, msg: 'Chưa xóa Pod redis-0.' };
                    const before = Math.max(0, ...reqs(e).filter((r) => okHit(r) && r.t <= del.t).map((r) => r.count));
                    const after = reqs(e).some((r) => okHit(r) && r.t > del.t && r.count > before && before > 0);
                    return after ? { ok: true } : { ok: false, msg: before ? `Trước sự cố số đếm là ${before}. Gọi lại shop.local sau khi redis-0 chạy lại.` : 'Hãy gọi shop.local ít nhất một lần TRƯỚC khi xóa redis-0 để có con số so sánh.' };
                },
            },
            {
                id: 'hpa', title: 'Tự co giãn hoạt động',
                desc: 'HPA <code>web</code> phải đọc được % CPU (cột TARGETS không còn <code>&lt;unknown&gt;</code>).',
                hint: 'Lỗi thứ 5: container web thiếu <code>resources.requests.cpu</code>. Thêm <code>kubectl set resources deployment web --requests=cpu=100m</code> (hoặc sửa shop.yaml) rồi đợi ~15 giây: <code>kubectl get hpa</code>. Muốn thấy tăng Pod: chạy Pod tạo tải gọi <code>http://web</code>.',
                check: (e) => { const h = g(e, 'HorizontalPodAutoscaler', 'web'); const m = h && h.sim.m; return m && m.util !== undefined ? { ok: true } : { ok: false, msg: !h ? 'Chưa có HPA web trong prod.' : 'HPA web chưa tính được % CPU (TARGETS <unknown>).' }; },
            },
        ],
        quiz: [
            { q: 'Ingress trả <b>503</b>, <code>kubectl get endpoints web</code> có 3 địa chỉ <code>…:8080</code>, app nghe cổng 5000. Lỗi ở đâu?', options: ['Ingress sai host', 'targetPort của Service không khớp cổng container', 'Pod chưa READY', 'Thiếu Namespace'], answer: 1, explain: 'Endpoints có địa chỉ nghĩa là selector và readiness đều ổn; sai là ở cổng chuyển tiếp.' },
            { q: 'Thứ tự gỡ lỗi hợp lý khi Pod không chạy?', options: ['Xóa cluster tạo lại', 'kubectl get → describe (Events) → logs (--previous) → kiểm tra cấu hình liên quan (Service, PVC, ConfigMap)', 'Chỉ đọc logs', 'Restart node'], answer: 1, explain: 'STATUS cho biết "cái gì", Events cho biết "vì sao", logs cho biết app nói gì.' },
            { q: 'Vì sao image nên có tag cụ thể (<code>vlab/counter:1.0</code>) thay vì <code>latest</code> trên production?', options: ['latest chạy chậm hơn', 'Tag cố định giúp biết chính xác đang chạy gì, rollback được, và mọi node kéo cùng một bản', 'Kubernetes cấm latest', 'Tiết kiệm dung lượng'], answer: 1, explain: 'latest thay đổi theo thời gian — hai Pod có thể chạy hai phiên bản khác nhau mà bạn không biết.' },
            { q: 'Dockerfile tối ưu cache: đặt <code>COPY requirements.txt</code> + <code>RUN pip install</code> trước <code>COPY . .</code> vì sao?', options: ['Để image nhỏ hơn', 'Mã nguồn đổi thường xuyên; tách bước cài thư viện lên trước giúp lớp đó được lấy từ cache khi chỉ sửa code', 'Bắt buộc theo cú pháp', 'Để chạy nhanh lúc runtime'], answer: 1, explain: 'Một lớp thay đổi thì mọi lớp sau nó build lại (bài 2).' },
            { q: 'Muốn web gọi Redis bằng tên ổn định trong cùng namespace, dùng gì?', options: ['IP của Pod Redis', 'Service (ví dụ "redis") — DNS nội bộ redis.prod.svc.cluster.local', 'Địa chỉ node', 'File /etc/hosts trong image'], answer: 1, explain: 'IP Pod đổi mỗi lần tạo lại; tên Service thì không.' },
            { q: 'Mật khẩu database nên đưa vào Pod bằng cách nào?', options: ['Ghi thẳng trong image', 'Secret (env hoặc volume), quản lý ngoài Git bằng Sealed Secrets/External Secrets', 'ConfigMap', 'Tham số dòng lệnh trong YAML công khai'], answer: 1, explain: 'Image và Git có thể bị nhiều người đọc; Secret có RBAC riêng và có thể mã hóa ở etcd.' },
            { q: 'Cập nhật web lên phiên bản mới mà người dùng không thấy gián đoạn — Kubernetes dựa vào gì?', options: ['Xóa hết Pod rồi tạo lại', 'Rolling update của Deployment + readinessProbe: chỉ chuyển traffic sang Pod mới khi nó sẵn sàng', 'HPA', 'StatefulSet'], answer: 1, explain: 'Không có readinessProbe, Pod mới nhận traffic ngay khi container vừa chạy dù app chưa sẵn sàng.' },
            { q: 'Đóng gói toàn bộ shop.yaml thành một thứ cài được cho dev/staging/prod với cấu hình khác nhau — công cụ phù hợp?', options: ['docker compose', 'Helm chart với values riêng cho từng môi trường', 'kubectl run', 'Một Job'], answer: 1, explain: 'Hoặc Kustomize (overlay). Kết hợp GitOps (Argo CD/Flux) để cluster tự đồng bộ theo Git.' },
        ],
        render(root, ctx) {
            const devops = App.lessonsOf('devops').filter((l) => l.labs && l.id !== lesson.id && l.kind !== 'resources');
            const done = devops.filter((l) => App.lessonProgress(l) >= 0.999).length;
            const theory = `
        <h2>Đề bài</h2>
        <pre class="code"><code>                 http://shop.local
                        │  Ingress "shop" (nginx)
                        ▼
              Service "web" :80 ──▶ Pod web ×3 (vlab/counter :5000)
                                          │ REDIS_HOST=redis (ConfigMap)
                                          ▼
                    headless Service "redis" ──▶ redis-0 ──▶ PVC data-redis-0
              HPA "web": 3–10 Pod theo CPU 60%           (namespace: prod)</code></pre>
        <h3>Tiêu chí nghiệm thu</h3>
        <ol>
          <li>Mọi thứ nằm trong namespace <code>prod</code>.</li>
          <li>Redis chạy bằng StatefulSet, dữ liệu trên PVC.</li>
          <li>Web 3 bản sao, chỉ nhận traffic khi sẵn sàng.</li>
          <li><code>curl shop.local</code> trả về số đếm.</li>
          <li>Redis khởi động lại không làm mất số đếm.</li>
          <li>HPA đo được CPU.</li>
        </ol>
        <h3>Quy trình gỡ lỗi nên theo</h3>
        <pre class="code"><code>kubectl apply -f shop.yaml          # đọc kỹ từng dòng lỗi: tên trường, dòng nào
kubectl get all,pvc,ing             # cái gì chưa READY?
kubectl describe pod|sts|ing TÊN    # Events: vì sao?
kubectl logs TÊN [--previous]       # app nói gì?
kubectl get endpoints web           # Service có trỏ tới Pod nào, cổng nào?
curl -i shop.local                  # mã HTTP: 404 (Ingress), 503 (backend), 500 (app)</code></pre>
        <div class="callout tip"><strong>Mẹo:</strong> <code>kubectl config set-context --current --namespace=prod</code> để khỏi gõ <code>-n prod</code> — sơ đồ bên phải cũng chuyển sang hiển thị namespace prod.</div>
        <h3>Tiến độ khóa DevOps</h3>
        <p>Bạn đã hoàn thành trọn vẹn <b>${done}/${devops.length}</b> bài. ${done === devops.length ? 'Xuất sắc! 🎉' : 'Có thể quay lại các bài còn dang dở bất cứ lúc nào.'}</p>
        <details><summary>🚀 Bước tiếp theo sau khóa học</summary>
          <ul>
            <li><b>CI/CD</b>: GitHub Actions build image → đẩy lên registry → cập nhật tag trong Git.</li>
            <li><b>GitOps</b>: Argo CD/Flux tự đồng bộ cluster theo repo, rollback bằng git revert.</li>
            <li><b>Quan sát</b>: Prometheus + Grafana (metrics), Loki (log), OpenTelemetry (trace).</li>
            <li><b>Bảo mật</b>: NetworkPolicy, Pod Security Standards, quét image (Trivy), chữ ký image (cosign).</li>
            <li><b>Chứng chỉ</b>: CKAD (phát triển trên K8s) rồi CKA (vận hành cluster).</li>
          </ul>
        </details>`;
            const s = App.shell(root, lesson, theory);
            App.dvSetup(s.sim, ctx, lesson, {
                engine: 'kube', diagram: 'k8s',
                title: '🎓 Cluster "lab" — dự án shop',
                files: FILES, editFiles: ['shop.yaml'],
                cvHeight: 380, height: 320,
                welcome: ['Nhiệm vụ: đưa hệ thống trong shop.yaml lên namespace prod. File có 5 lỗi.', 'Bắt đầu: kubectl create namespace prod → kubectl config set-context --current --namespace=prod → kubectl apply -f shop.yaml'],
                chips: ['kubectl create namespace prod', 'kubectl config set-context --current --namespace=prod', 'kubectl apply -f shop.yaml', 'kubectl get all,pvc,ing', 'kubectl get endpoints web', 'curl -i shop.local', 'kubectl delete pod redis-0', 'kubectl get hpa'],
            });
            App.labUI(s.lab, lesson, ctx);
            App.quizUI(s.quiz, lesson);
        },
    };

    if (typeof module === 'object' && module.exports) module.exports = lesson;
    else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
