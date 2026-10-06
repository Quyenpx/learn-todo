/*
 * Bài K5 — StatefulSet & lưu trữ: vì sao dữ liệu trong container biến mất, PersistentVolumeClaim/PV/StorageClass,
 * và StatefulSet cho ứng dụng có trạng thái (tên ổn định, ổ đĩa riêng cho từng Pod, DNS qua headless Service).
 * Sơ đồ: Pod gắn PVC có biểu tượng ổ đĩa tím; cột trái hiện StatefulSet kèm số PVC.
 */
(function () {
    'use strict';
    const REDIS_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
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
          # Lab 2: gắn PVC vào thư mục dữ liệu /data của Redis
          # volumeMounts:
          #   - name: data
          #     mountPath: /data
      # volumes:
      #   - name: data
      #     persistentVolumeClaim:
      #       claimName: redis-data
`;
    const PVC_YAML = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
spec:
  accessModes: ["ReadWriteOnce"]   # một node đọc/ghi tại một thời điểm
  resources:
    requests:
      storage: 1Gi
  # storageClassName bỏ trống → dùng StorageClass mặc định "standard"
`;
    const STS_YAML = `# Headless Service (clusterIP: None): không có IP ảo, DNS trả thẳng IP từng Pod
apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None
  selector:
    app: db
  ports:
    - port: 6379
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db          # Pod có tên miền db-0.db, db-1.db...
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: redis
          image: redis:7
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:     # mỗi Pod một PVC riêng: data-db-0, data-db-1...
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
`;
    const FILES = { 'redis.yaml': REDIS_YAML, 'pvc.yaml': PVC_YAML, 'statefulset.yaml': STS_YAML };
    const hist = (e) => (e && e.state ? e.state.history : []);
    const redisOps = (e, op) => hist(e).map((h, i) => Object.assign({ i }, h.meta || {})).filter((m) => m.redis === op);
    // Có lần ghi khóa K ở Pod A rồi lần đọc K ở Pod B khác (Pod mới thay thế) với kết quả mong muốn
    const readAfterReplace = (e, prefix, found, store) => {
        const sets = redisOps(e, 'set').filter((m) => m.pod.startsWith(prefix) && (!store || m.store === store));
        return redisOps(e, 'get').some((g) => g.pod.startsWith(prefix) && g.found === found && sets.some((s) => s.i < g.i && s.key === g.key && s.podUid !== g.podUid));
    };

    const lesson = {
        id: 'k8s-stateful',
        course: 'devops',
        group: 'Kubernetes',
        icon: '🗄️',
        navTitle: 'StatefulSet & lưu trữ',
        navSub: 'PVC, PV, dữ liệu bền vững',
        badge: 'DevOps · Bài 8',
        title: 'StatefulSet & lưu trữ: để dữ liệu sống lâu hơn Pod',
        files: FILES,
        lead: 'Pod là thứ dùng một lần: chết là mất, kéo theo mọi thứ ghi trong container. Bài này dùng PersistentVolumeClaim để giữ dữ liệu, rồi StatefulSet để chạy cơ sở dữ liệu nhiều bản sao — mỗi bản có tên, địa chỉ và ổ đĩa riêng không đổi.',
        labs: [
            {
                id: 'ephemeral', title: 'Thấy tận mắt: dữ liệu mất theo Pod',
                desc: 'Triển khai <code>redis.yaml</code> (chưa có volume). Ghi một khóa vào Redis, <b>xóa Pod</b> để Deployment tạo Pod mới, rồi đọc lại khóa đó: kết quả là <code>(nil)</code>.',
                hint: '<code>kubectl apply -f redis.yaml</code> → <code>kubectl exec deploy/redis -- redis-cli set ten Lan</code> → <code>kubectl delete pod -l app=redis</code> → đợi Pod mới <code>Running</code> (<code>kubectl get pods</code>) → <code>kubectl exec deploy/redis -- redis-cli get ten</code>.',
                reflect: { q: 'Vì sao dữ liệu mất dù Deployment đã tạo lại Pod?', a: 'Pod mới là một container mới tinh từ image. Mọi thứ ghi vào lớp ghi của container cũ (kể cả /data của Redis) bị xóa cùng Pod cũ. Deployment chỉ đảm bảo "đủ số Pod", không đảm bảo "giữ dữ liệu".' },
                check: (e) => (readAfterReplace(e, 'redis-', false, 'container') ? { ok: true } : { ok: false, msg: 'Chưa thấy cảnh: ghi khóa ở Pod redis cũ → Pod bị thay → đọc ở Pod mới ra (nil).' }),
            },
            {
                id: 'pvc', title: 'Giữ dữ liệu bằng PersistentVolumeClaim',
                desc: 'Áp dụng <code>pvc.yaml</code> và xem PVC ở trạng thái <code>Pending</code> (chờ Pod đầu tiên dùng). Bỏ comment phần <code>volumeMounts</code>/<code>volumes</code> trong <code>redis.yaml</code>, apply lại. Lặp lại thí nghiệm ở lab 1: lần này khóa vẫn còn.',
                hint: '<code>kubectl apply -f pvc.yaml</code> → <code>kubectl get pvc</code> (Pending, xem <code>kubectl describe pvc redis-data</code>) → sửa <code>redis.yaml</code> (bỏ dấu <code>#</code> ở 7 dòng cuối, giữ đúng thụt lề) → <code>kubectl apply -f redis.yaml</code> → <code>kubectl get pvc,pv</code> (Bound) → set → <code>kubectl delete pod -l app=redis</code> → get.',
                reflect: { q: 'Vì sao PVC "Pending" cho tới khi có Pod?', a: 'StorageClass "standard" của kind dùng volumeBindingMode: WaitForFirstConsumer — ổ đĩa local-path nằm trên một node cụ thể, nên phải đợi scheduler chọn node cho Pod rồi mới tạo PV ở đúng node đó. Trên cloud thường là ổ mạng nên có thể cấp ngay (Immediate).' },
                check: (e) => (readAfterReplace(e, 'redis-', true, 'pvc') ? { ok: true } : { ok: false, msg: 'Chưa thấy: ghi khóa vào Redis có PVC → Pod bị thay → Pod mới đọc lại được khóa.' }),
            },
            {
                id: 'sts', title: 'StatefulSet 3 bản sao, mỗi bản một ổ đĩa',
                desc: 'Áp dụng <code>statefulset.yaml</code>. Quan sát Pod được tạo <b>lần lượt</b> <code>db-0</code> → <code>db-1</code> → <code>db-2</code> (Pod sau chỉ được tạo khi Pod trước sẵn sàng) và 3 PVC <code>data-db-0..2</code> tự sinh.',
                hint: '<code>kubectl apply -f statefulset.yaml</code> → gõ <code>kubectl get pods</code> vài lần → <code>kubectl get sts,pvc</code>.',
                check: (e) => {
                    const s = e && e.get && e.get('StatefulSet', 'db');
                    const v = s && e.stsView(s);
                    const bound = s ? e.list('PersistentVolumeClaim').filter((c) => /^data-db-\d+$/.test(c.metadata.name) && c.sim.pv).length : 0;
                    return v && v.ready >= 3 && bound >= 3 ? { ok: true } : { ok: false, msg: !s ? 'Chưa có StatefulSet db.' : `StatefulSet db: ${v.ready}/${v.desired} sẵn sàng, ${bound} PVC Bound — cần 3/3 và 3 PVC.` };
                },
            },
            {
                id: 'identity', title: 'Danh tính ổn định: xóa db-1, nó quay lại y nguyên',
                desc: 'Ghi một khóa vào <code>db-1</code>, xóa Pod <code>db-1</code>. StatefulSet tạo lại Pod <b>cùng tên</b>, trên <b>cùng node</b>, gắn lại <b>đúng PVC</b> <code>data-db-1</code> — đọc khóa vẫn còn. Thử thêm: từ <code>db-0</code> gọi sang <code>db-1</code> bằng tên miền riêng.',
                hint: '<code>kubectl exec db-1 -- redis-cli set vaitro replica</code> → <code>kubectl delete pod db-1</code> → <code>kubectl get pods -o wide</code> → <code>kubectl exec db-1 -- redis-cli get vaitro</code>. DNS: <code>kubectl exec db-0 -- redis-cli -h db-1.db get vaitro</code>, <code>kubectl exec db-0 -- nslookup db</code>.',
                reflect: { q: 'Khi nào dùng StatefulSet thay vì Deployment?', a: 'Khi mỗi bản sao có "danh tính": cần tên/địa chỉ ổn định (cụm database, Kafka, Elasticsearch có leader/follower) và ổ đĩa riêng gắn chặt với bản sao đó. Ứng dụng web không lưu trạng thái thì dùng Deployment — đơn giản và cập nhật nhanh hơn.' },
                check: (e) => (redisOps(e, 'get').some((g) => /^db-\d+$/.test(g.pod) && g.found && redisOps(e, 'set').some((s) => s.i < g.i && s.pod === g.pod && s.podUid !== g.podUid && s.key === g.key)) ? { ok: true } : { ok: false, msg: 'Chưa thấy: ghi khóa vào db-N → xóa Pod db-N → Pod db-N mới (cùng tên) đọc lại được khóa.' }),
            },
        ],
        quiz: [
            { q: 'Redis chạy trong Deployment không có volume. Pod bị xóa và tạo lại. Dữ liệu ra sao?', options: ['Còn nguyên vì Deployment tự sao lưu', 'Mất, vì Pod mới là container mới; lớp ghi của container cũ bị xóa', 'Còn một nửa', 'Được chuyển sang node khác'], answer: 1, explain: 'Muốn dữ liệu sống lâu hơn Pod phải đưa nó ra ngoài container: PersistentVolume (qua PVC) hoặc dịch vụ lưu trữ bên ngoài.' },
            { q: 'Quan hệ giữa PersistentVolumeClaim (PVC), PersistentVolume (PV) và StorageClass là gì?', options: ['Ba tên của cùng một thứ', 'PVC là "đơn xin" dung lượng; StorageClass mô tả cách cấp; PV là ổ đĩa thật được cấp (thường tự động) và gắn với PVC', 'PV xin dung lượng từ PVC', 'StorageClass là một loại Pod'], answer: 1, explain: 'Ứng dụng chỉ cần nói "tôi cần 1Gi, ReadWriteOnce". Provisioner của StorageClass tạo PV phù hợp và bind với PVC (dynamic provisioning).' },
            { q: 'PVC báo <code>Pending</code> và describe ghi <code>waiting for first consumer to be created before binding</code>. Điều này nghĩa là gì?', options: ['Lỗi nghiêm trọng, phải xóa PVC', 'Bình thường với volumeBindingMode WaitForFirstConsumer: PV chỉ được tạo khi có Pod dùng PVC (để chọn đúng node)', 'Hết dung lượng', 'Sai accessModes'], answer: 1, explain: 'Tạo Pod dùng PVC là PVC chuyển sang Bound. Nếu Pending kèm "storageclass not found" thì mới là lỗi.' },
            { q: 'StatefulSet <code>db</code> có 3 bản sao. Điều nào ĐÚNG?', options: ['Pod có tên ngẫu nhiên như Deployment', 'Pod tên db-0, db-1, db-2; tạo theo thứ tự; mỗi Pod một PVC riêng từ volumeClaimTemplates; xóa Pod thì Pod mới cùng tên, cùng PVC', 'Ba Pod dùng chung một PVC', 'Xóa StatefulSet sẽ xóa luôn PVC'], answer: 1, explain: 'PVC từ volumeClaimTemplates được giữ lại kể cả khi xóa hoặc thu nhỏ StatefulSet — để không mất dữ liệu ngoài ý muốn.' },
            { q: 'Vì sao StatefulSet cần một Service <b>headless</b> (<code>clusterIP: None</code>)?', options: ['Để tiết kiệm IP', 'Để mỗi Pod có tên miền riêng ổn định (db-0.db.default.svc.cluster.local) — các bản sao gọi đích danh nhau', 'Để chặn truy cập', 'Bắt buộc với mọi Pod'], answer: 1, explain: 'Service thường cân bằng tải ngẫu nhiên. Với database, client thường cần gọi đúng leader (db-0) hoặc đúng replica.' },
            { q: 'Chạy production, cơ sở dữ liệu nên đặt ở đâu?', options: ['Luôn chạy trong Pod không volume', 'Tùy: dịch vụ DB được quản lý (RDS, Cloud SQL) cho nhẹ đầu; hoặc StatefulSet + Operator (CloudNativePG...) + sao lưu định kỳ nếu tự vận hành', 'Trong ConfigMap', 'Trong image Docker'], answer: 1, explain: 'StatefulSet giải quyết danh tính và ổ đĩa, nhưng sao lưu, nâng cấp, failover vẫn là việc của bạn hoặc của Operator.' },
        ],
        render(root, ctx) {
            const theory = `
        <h2>Vấn đề: Pod là "vật dùng một lần"</h2>
        <p>Mỗi container có một <b>lớp ghi</b> riêng. Pod bị xóa, bị đuổi khỏi node hay được Deployment thay thế là lớp ghi đó biến mất. Với web không lưu trạng thái thì không sao; với database thì là thảm họa.</p>
        <h3>Ba loại "ổ đĩa" thường gặp</h3>
        <ul>
          <li><b>emptyDir</b>: thư mục tạm sống cùng Pod (chia sẻ giữa các container trong Pod). Pod mất → mất.</li>
          <li><b>configMap / secret</b>: file cấu hình chỉ đọc (bài 6).</li>
          <li><b>persistentVolumeClaim</b>: ổ đĩa bền vững, sống độc lập với Pod.</li>
        </ul>
        <h3>PVC → StorageClass → PV</h3>
        <pre class="code"><code>Pod ──volumes──▶ PVC "redis-data" (xin 1Gi, RWO)
                      │  StorageClass "standard" (provisioner local-path)
                      ▼
                 PV pvc-4f2a… (1Gi, nằm ở /var/local-path-provisioner trên node lab-worker)</code></pre>
        <ul>
          <li><b>accessModes</b>: <code>ReadWriteOnce</code> (RWO, một node), <code>ReadOnlyMany</code>, <code>ReadWriteMany</code> (RWX, cần NFS/CephFS...).</li>
          <li><b>reclaimPolicy</b>: <code>Delete</code> (xóa PVC là xóa luôn dữ liệu) hoặc <code>Retain</code> (giữ PV để khôi phục tay).</li>
          <li><b>volumeBindingMode</b>: <code>WaitForFirstConsumer</code> — chờ có Pod mới cấp, để ổ đĩa nằm cùng node/zone với Pod.</li>
        </ul>
        <h3>StatefulSet: dành cho ứng dụng có danh tính</h3>
        <div class="table-scroll"><table class="compare"><thead><tr><th></th><th>Deployment</th><th>StatefulSet</th></tr></thead><tbody>
          <tr><td>Tên Pod</td><td>web-7d9c…-x4kz (ngẫu nhiên)</td><td>db-0, db-1, db-2 (cố định)</td></tr>
          <tr><td>Thứ tự</td><td>Tạo/xóa cùng lúc</td><td>Tạo 0→N, xóa N→0, từng Pod một</td></tr>
          <tr><td>Ổ đĩa</td><td>Dùng chung (nếu có)</td><td>Mỗi Pod một PVC riêng (volumeClaimTemplates)</td></tr>
          <tr><td>Địa chỉ</td><td>Qua Service (ngẫu nhiên Pod)</td><td>Thêm DNS riêng: db-0.db (headless Service)</td></tr>
        </tbody></table></div>
        <div class="callout tip"><strong>Ghi nhớ:</strong> xóa hay thu nhỏ StatefulSet <b>không</b> xóa PVC. Muốn giải phóng dung lượng phải <code>kubectl delete pvc</code> — một lớp bảo vệ dữ liệu có chủ đích.</div>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>kind và minikube có sẵn StorageClass mặc định (<code>kubectl get sc</code>). Trên cloud, StorageClass dùng CSI driver (AWS EBS gp3, GCE PD, Azure Disk) — PV là ổ mạng, có thể <code>allowVolumeExpansion: true</code> để tăng dung lượng.</p>
          <pre class="code"><code>kubectl apply -f statefulset.yaml
kubectl get pods -w            # thấy db-0, db-1, db-2 lần lượt Running
kubectl exec db-0 -- redis-cli ping
kubectl delete sts db          # PVC vẫn còn: kubectl get pvc</code></pre>
          <p>Database thật nên có sao lưu: snapshot ổ đĩa (VolumeSnapshot), hoặc dùng Operator như CloudNativePG, Redis Operator.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li>PVC <code>Pending</code> mãi + <code>storageclass "fast" not found</code> — sai tên StorageClass.</li>
            <li>Pod <code>Pending</code>: <code>persistentvolumeclaim "x" not found</code> — quên tạo PVC hoặc sai <code>claimName</code>.</li>
            <li><code>volumeMounts[0].name: Not found</code> — tên trong volumeMounts không khớp volumes/volumeClaimTemplates.</li>
            <li><code>Multi-Attach error ... Volume is already used by pod</code> — ổ RWO bị Pod ở node khác giành; Deployment nhiều replica dùng chung PVC RWO là thiết kế sai.</li>
            <li><code>updates to statefulset spec for fields other than ... are forbidden</code> — volumeClaimTemplates, serviceName không sửa được; xóa StatefulSet (PVC vẫn giữ) rồi tạo lại.</li>
          </ul>
        </details>`;
            const s = App.shell(root, lesson, theory);
            App.dvSetup(s.sim, ctx, lesson, {
                engine: 'kube', diagram: 'k8s',
                title: '🗄️ Cluster "lab" — lưu trữ bền vững',
                files: FILES, editFiles: ['redis.yaml', 'pvc.yaml', 'statefulset.yaml'],
                cvHeight: 360, height: 300,
                welcome: ['Cluster kind "lab" có sẵn StorageClass "standard" (local-path, WaitForFirstConsumer).', 'Thử: kubectl get sc → kubectl apply -f redis.yaml'],
                chips: ['kubectl apply -f redis.yaml', 'kubectl exec deploy/redis -- redis-cli set ten Lan', 'kubectl delete pod -l app=redis', 'kubectl exec deploy/redis -- redis-cli get ten', 'kubectl apply -f pvc.yaml', 'kubectl get pvc,pv', 'kubectl apply -f statefulset.yaml', 'kubectl get sts,pods,pvc', 'kubectl delete pod db-1', 'kubectl exec db-0 -- nslookup db'],
            });
            App.labUI(s.lab, lesson, ctx);
            App.quizUI(s.quiz, lesson);
        },
    };

    if (typeof module === 'object' && module.exports) module.exports = lesson;
    else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
