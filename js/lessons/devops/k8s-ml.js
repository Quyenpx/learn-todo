/*
 * Bài K7 — Đưa model ML lên Kubernetes: huấn luyện bằng Job (ghi model vào PVC), phục vụ bằng Deployment
 * với startupProbe cho model nạp chậm, canary model mới cho một phần lưu lượng, và HPA co giãn theo tải dự đoán.
 * Nối với khóa AI: learning rate quá lớn làm loss phân kỳ (NaN) — đúng như bài Gradient Descent.
 */
(function () {
    'use strict';
    const TRAIN_YAML = `# Ổ đĩa chứa model đã huấn luyện (Job ghi, model server đọc)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: models
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: batch/v1
kind: Job
metadata:
  name: train
spec:
  backoffLimit: 1            # thử lại tối đa 1 lần rồi báo Failed
  template:
    spec:
      restartPolicy: Never   # Job bắt buộc Never hoặc OnFailure
      containers:
        - name: trainer
          image: vlab/trainer:1.0
          env:
            - name: LEARNING_RATE
              value: "5"
            - name: EPOCHS
              value: "5"
          volumeMounts:
            - name: models
              mountPath: /models
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: models
`;
    // Liveness quá gắt: giết container sau ~6 giây, trong khi model cần ~15 giây để nạp
    const MODEL_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: model
spec:
  replicas: 2
  selector:
    matchLabels:
      app: model
      track: stable
  template:
    metadata:
      labels:
        app: model
        track: stable
    spec:
      containers:
        - name: model
          image: vlab/model:1.0
          ports:
            - containerPort: 8000
          resources:
            requests:
              cpu: 200m
              memory: 384Mi
            limits:
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8000
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8000
            initialDelaySeconds: 3
            periodSeconds: 3
            failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: model
spec:
  selector:
    app: model          # chọn cả stable lẫn canary
  ports:
    - port: 80
      targetPort: 8000
`;
    const CANARY_YAML = `# Canary: 1 Pod chạy model v2 (đọc /models/model.pkl do Job huấn luyện ghi ra)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: model-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: model
      track: canary
  template:
    metadata:
      labels:
        app: model
        track: canary
    spec:
      containers:
        - name: model
          image: vlab/model:2.0
          ports:
            - containerPort: 8000
          startupProbe:
            httpGet:
              path: /healthz
              port: 8000
            periodSeconds: 5
            failureThreshold: 12
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8000
          volumeMounts:
            - name: models
              mountPath: /models
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: models
`;
    const FILES = { 'train-job.yaml': TRAIN_YAML, 'model.yaml': MODEL_YAML, 'canary.yaml': CANARY_YAML };
    const modelFile = (e) => { const c = e && e.get && e.get('PersistentVolumeClaim', 'models'); const pv = c && c.sim.pv && e.get('PersistentVolume', c.sim.pv); return pv && pv.sim.data.files['/models/model.pkl']; };

    const lesson = {
        id: 'k8s-ml',
        course: 'devops',
        group: 'Kubernetes',
        icon: '🤖',
        navTitle: 'Đưa model ML lên K8s',
        navSub: 'Job huấn luyện, canary, HPA',
        badge: 'DevOps · Bài 10',
        title: 'Đưa model ML lên Kubernetes: huấn luyện, phục vụ, thử nghiệm và co giãn',
        files: FILES,
        lead: 'Bài cuối nối hai khóa học: huấn luyện model bằng Job (và gặp lại "learning rate quá lớn"), lưu model vào ổ đĩa bền vững, phục vụ API dự đoán, tung model mới cho một phần người dùng trước (canary), rồi để HPA tăng giảm số Pod theo lưu lượng.',
        labs: [
            {
                id: 'train', title: 'Huấn luyện bằng Job — và sửa learning rate',
                desc: 'Áp dụng <code>train-job.yaml</code>. Job thất bại: đọc log để thấy <b>loss = NaN</b>. Sửa <code>LEARNING_RATE</code> về giá trị hợp lý (ví dụ <code>0.1</code>). Template của Job không sửa được — xóa Job rồi tạo lại, đợi <code>Complete</code>. File <code>/models/model.pkl</code> được ghi vào PVC <code>models</code>.',
                hint: '<code>kubectl apply -f train-job.yaml</code> → <code>kubectl get jobs,pods</code> → <code>kubectl logs job/train</code> → sửa <code>value: "0.1"</code> → <code>kubectl delete job train</code> → <code>kubectl apply -f train-job.yaml</code> → <code>kubectl wait --for=condition=complete job/train --timeout=60s</code> → <code>kubectl logs job/train</code>.',
                reflect: { q: 'Vì sao learning rate 5 làm loss thành NaN?', a: 'Bước cập nhật quá lớn nên mỗi lần đi lại "vượt qua" đáy và văng xa hơn — loss tăng theo cấp số nhân tới vô cực (NaN). Bạn đã thấy hiện tượng này ở bài Gradient Descent của khóa AI. Job báo Failed sau backoffLimit lần thử: thử lại vô ích khi lỗi nằm ở cấu hình.' },
                check: (e) => { const j = e && e.get && e.get('Job', 'train'); const ok = j && e.jobView(j).status === 'Complete' && modelFile(e); return ok ? { ok: true } : { ok: false, msg: !j ? 'Chưa có Job train.' : e.jobView(j).status === 'Failed' ? 'Job train đã Failed — đọc log, sửa LEARNING_RATE, xóa Job rồi tạo lại.' : !modelFile(e) ? 'Job chưa ghi /models/model.pkl vào PVC models.' : 'Đợi Job hoàn tất.' }; },
            },
            {
                id: 'serve', title: 'Phục vụ model: đừng giết app đang nạp',
                desc: 'Áp dụng <code>model.yaml</code>. Model cần ~15 giây để nạp vào RAM, nhưng livenessProbe giết container sau ~6 giây → <code>CrashLoopBackOff</code> mãi. Đọc Events, rồi thêm <b>startupProbe</b> (hoặc tăng <code>initialDelaySeconds</code>) để cả 2 Pod chạy ổn định.',
                hint: '<code>kubectl apply -f model.yaml</code> → <code>kubectl get pods -w</code> → <code>kubectl describe pod model-…</code> (Liveness probe failed: connection refused, Killing). Thêm vào container (ngang hàng livenessProbe):<pre class="code">          startupProbe:\n            httpGet:\n              path: /healthz\n              port: 8000\n            periodSeconds: 5\n            failureThreshold: 12</pre>→ <code>kubectl apply -f model.yaml</code> → <code>kubectl rollout status deployment/model</code>.',
                reflect: { q: 'startupProbe khác gì tăng initialDelaySeconds?', a: 'startupProbe cho tối đa failureThreshold × periodSeconds (ở đây 60 giây) để app khởi động, và kết thúc ngay khi app sẵn sàng. Sau đó liveness mới bắt đầu canh với nhịp nhanh. initialDelaySeconds lớn thì lúc nào cũng phải chờ đủ, và nếu một ngày model nạp lâu hơn vẫn bị giết.' },
                check: (e) => {
                    const d = e && e.get && e.get('Deployment', 'model');
                    if (!d) return { ok: false, msg: 'Chưa có Deployment model.' };
                    const v = e.depView(d);
                    const stable = v.nw && e.list('Pod').filter((p) => !p.sim.deletedAt && p.metadata.ownerName === v.nw.metadata.name).every((p) => e.podView(p).restarts === 0);
                    return v.updReady === v.desired && v.desired >= 2 && v.total === v.desired && stable ? { ok: true } : { ok: false, msg: 'Deployment model chưa có đủ Pod sẵn sàng mà không bị khởi động lại.' };
                },
            },
            {
                id: 'canary', title: 'Canary: model v2 nhận một phần lưu lượng',
                desc: 'Áp dụng <code>canary.yaml</code>: 1 Pod <code>vlab/model:2.0</code> đọc model vừa huấn luyện từ PVC. Service <code>model</code> chọn theo nhãn <code>app: model</code> nên chia request cho cả 2 bản stable lẫn bản canary. Gửi nhiều request <code>/predict</code> và thấy câu trả lời từ <b>cả v1 và v2</b>.',
                hint: '<code>kubectl apply -f canary.yaml</code> → đợi Pod canary Running 1/1 → <code>kubectl port-forward svc/model 8080:80</code> → <code>curl -X POST localhost:8080/predict -d \'{"features":[5.1,3.5,1.4,0.2]}\'</code> (lặp 4–6 lần, xem trường "model").',
                reflect: { q: 'Bao nhiêu phần trăm request tới canary? Muốn chính xác 5% thì sao?', a: 'Với Service thường, tỉ lệ ≈ số Pod canary / tổng số Pod (1/3 ≈ 33%). Muốn chia theo % chính xác, độc lập số Pod, dùng Ingress canary (nginx canary-weight), Gateway API, hoặc service mesh (Istio, Linkerd).' },
                check: (e) => {
                    const rs = (e && e.state ? e.state.requests : []).filter((r) => r.svc === 'model' && r.code === 200 && r.pod);
                    const v2 = rs.some((r) => r.pod.startsWith('model-canary-')), v1 = rs.some((r) => !r.pod.startsWith('model-canary-'));
                    return v1 && v2 ? { ok: true } : { ok: false, msg: !rs.length ? 'Chưa có request thành công nào qua Service model.' : !v2 ? 'Chưa có request nào tới Pod canary (v2). Kiểm tra Pod canary đã READY chưa.' : 'Chưa có request nào tới Pod stable (v1).' };
                },
            },
            {
                id: 'scale', title: 'Co giãn theo lưu lượng dự đoán',
                desc: 'Bật HPA cho Deployment <code>model</code> (CPU mục tiêu 50%, 2–6 Pod). Chạy một Pod tạo tải gọi liên tục vào <code>/predict</code> và xem HPA tăng số Pod. (Pod model mới cần ~15 giây để nạp — đó là lý do HPA nên có minReplicas đủ dùng.)',
                hint: '<code>kubectl autoscale deployment model --cpu-percent=50 --min=2 --max=6</code> → <code>kubectl run load --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://model/predict; done"</code> → đợi 15–30 giây → <code>kubectl get hpa,pods</code>. Xong: <code>kubectl delete pod load</code>.',
                check: (e) => {
                    const h = e && e.list && e.list('HorizontalPodAutoscaler').find((x) => x.spec.scaleTargetRef.name === 'model');
                    const d = e && e.get && e.get('Deployment', 'model');
                    return h && d && (d.spec.replicas || 1) > (h.spec.minReplicas || 1) ? { ok: true } : { ok: false, msg: !h ? 'Chưa có HPA cho Deployment model.' : 'HPA chưa tăng số Pod — có Pod tạo tải chưa? Đợi thêm 15–30 giây.' };
                },
            },
        ],
        quiz: [
            { q: 'Vì sao dùng <b>Job</b> (không phải Deployment) để huấn luyện model?', options: ['Job chạy nhanh hơn', 'Huấn luyện là việc có điểm kết thúc: Job chạy tới khi thành công, thử lại có giới hạn (backoffLimit) và giữ lại trạng thái Complete/Failed', 'Deployment không chạy được Python', 'Job không cần image'], answer: 1, explain: 'Deployment sẽ khởi động lại container vừa train xong — chạy lại vô tận. Huấn luyện định kỳ thì dùng CronJob.' },
            { q: 'Job huấn luyện báo Failed, log có <code>loss=nan</code>. Nguyên nhân hợp lý nhất?', options: ['Thiếu RAM', 'Learning rate quá lớn làm Gradient Descent phân kỳ', 'Sai tên image', 'Thiếu Service'], answer: 1, explain: 'Thử lại không giúp gì vì lỗi nằm ở cấu hình. Sửa siêu tham số rồi chạy Job mới.' },
            { q: 'Model nạp mất 30 giây. Cấu hình probe nào hợp lý?', options: ['livenessProbe initialDelaySeconds: 0, failureThreshold: 1', 'startupProbe cho đủ thời gian nạp (vd periodSeconds 5 × failureThreshold 12), sau đó livenessProbe và readinessProbe như bình thường', 'Bỏ hết probe', 'Chỉ readinessProbe với timeout 30 phút'], answer: 1, explain: 'Liveness quá gắt sẽ giết container trước khi nó kịp sẵn sàng → CrashLoopBackOff vĩnh viễn.' },
            { q: 'Model đã huấn luyện nên được đưa tới model server bằng cách nào?', options: ['Chép tay vào từng Pod', 'Lưu ở nơi bền vững (PVC, object storage như S3/MinIO, model registry) và để server đọc khi khởi động; hoặc đóng gói vào image có version', 'Để trong ConfigMap', 'Gửi qua email'], answer: 1, explain: 'ConfigMap giới hạn 1MiB và không dành cho file nhị phân lớn. Gắn version cho model để rollback được.' },
            { q: 'Triển khai canary bằng 2 Deployment chung nhãn <code>app: model</code> sau một Service. 1 Pod canary, 2 Pod stable. Tỉ lệ request tới canary xấp xỉ?', options: ['50%', '≈33% (1/3 số Pod)', '100%', '0%'], answer: 1, explain: 'kube-proxy chia đều theo Pod. Muốn tỉ lệ chính xác cần Ingress canary-weight hoặc service mesh.' },
            { q: 'HPA theo CPU cho model server. Điều kiện nào BẮT BUỘC?', options: ['Container có resources.requests.cpu (và cluster có metrics-server)', 'Image phải có GPU', 'Service kiểu LoadBalancer', 'Phải dùng StatefulSet'], answer: 0, explain: '% CPU = mức dùng / requests.cpu. Với GPU hoặc hàng đợi request, dùng custom metrics (Prometheus Adapter, KEDA).' },
        ],
        render(root, ctx) {
            const theory = `
        <h2>Vòng đời một model trên Kubernetes</h2>
        <pre class="code"><code>   Job "train"                PVC "models"              Deployment "model" (+ canary)
 ┌──────────────┐   ghi    ┌──────────────┐   đọc     ┌──────────────────────────┐
 │ trainer      │ ───────▶ │ model.pkl    │ ───────▶  │ model-server :8000       │ ◀── Service ◀── người dùng
 │ (chạy 1 lần) │          │ (bền vững)   │           │ /predict  /healthz       │      ▲
 └──────────────┘          └──────────────┘           └──────────────────────────┘      │ HPA co giãn</code></pre>
        <h3>1. Huấn luyện: Job</h3>
        <p><b>Job</b> chạy Pod tới khi thành công. <code>restartPolicy: Never</code> (lỗi → tạo Pod mới) hoặc <code>OnFailure</code> (khởi động lại container); <code>backoffLimit</code> giới hạn số lần thử. Huấn luyện định kỳ dùng <b>CronJob</b>. Template của Job bất biến — muốn đổi siêu tham số thì tạo Job mới (thường kèm tên phiên bản: <code>train-v2</code>).</p>
        <h3>2. Lưu model</h3>
        <p>Pod chết là mất file, nên model phải ra ổ đĩa bền vững (bài 8) hoặc object storage (S3, MinIO, GCS) / model registry (MLflow). Ghi kèm phiên bản và chỉ số (accuracy) để so sánh và quay lui.</p>
        <h3>3. Phục vụ: Deployment + Service</h3>
        <ul>
          <li><b>RAM</b>: model nằm trọn trong bộ nhớ → đặt <code>requests/limits.memory</code> đủ lớn (thiếu là OOMKilled — bài 6). GPU: <code>resources.limits: nvidia.com/gpu: 1</code>.</li>
          <li><b>Khởi động chậm</b>: dùng <code>startupProbe</code> để liveness không giết app đang nạp model.</li>
          <li><b>readinessProbe</b>: chỉ nhận request khi model đã nạp xong.</li>
        </ul>
        <h3>4. Thử model mới an toàn: canary</h3>
        <p>Chạy song song bản mới với ít Pod, cùng nhãn để Service chia một phần lưu lượng. Theo dõi lỗi, độ trễ, chất lượng dự đoán; ổn thì nâng dần, có vấn đề thì xóa canary là xong.</p>
        <h3>5. Co giãn</h3>
        <p>HPA tăng/giảm số Pod theo CPU (cần <code>requests.cpu</code>). Vì Pod model khởi động chậm, đặt <code>minReplicas</code> đủ gánh tải thường ngày. Tải theo hàng đợi/GPU dùng KEDA hoặc custom metrics.</p>
        <div class="callout tip"><strong>Công cụ chuyên dụng:</strong> KServe, Seldon Core, Ray Serve, BentoML đóng gói sẵn các mẫu trên (canary, autoscale về 0, batching...). Kubeflow / Argo Workflows điều phối pipeline huấn luyện nhiều bước.</div>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <pre class="code"><code># app.py (FastAPI) nạp model.pkl bằng joblib và phục vụ POST /predict
docker build -t model-server:1.0 .
kind load docker-image model-server:1.0 --name lab   # đưa image vào cluster kind
kubectl apply -f train-job.yaml -f model.yaml
kubectl wait --for=condition=complete job/train --timeout=300s
kubectl port-forward svc/model 8080:80
curl -X POST localhost:8080/predict -H "Content-Type: application/json" -d '{"features":[5.1,3.5,1.4,0.2]}'</code></pre>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>CrashLoopBackOff</code> + Events <code>Liveness probe failed: connection refused</code> — model chưa nạp xong đã bị giết; thêm startupProbe.</li>
            <li><code>OOMKilled</code> — limits.memory nhỏ hơn kích thước model + dữ liệu tạm.</li>
            <li><code>FileNotFoundError: /models/model.pkl</code> — Job chưa chạy xong, ghi sai đường dẫn, hoặc server không gắn đúng PVC.</li>
            <li><code>The Job "train" is invalid: spec.template: field is immutable</code> — xóa Job cũ rồi tạo lại.</li>
            <li>Pod canary <code>Pending</code> với PVC RWO — ổ đĩa đang gắn ở node khác; dùng RWX hoặc object storage khi nhiều node cùng đọc.</li>
          </ul>
        </details>`;
            const s = App.shell(root, lesson, theory);
            App.dvSetup(s.sim, ctx, lesson, {
                engine: 'kube', diagram: 'k8s',
                title: '🤖 Cluster "lab" — ML trên Kubernetes',
                files: FILES, editFiles: ['train-job.yaml', 'model.yaml', 'canary.yaml'],
                cvHeight: 380, height: 300,
                welcome: ['Image có sẵn: vlab/trainer:1.0 (huấn luyện iris), vlab/model:1.0 và 2.0 (model server :8000).', 'Thử: kubectl apply -f train-job.yaml → kubectl logs job/train'],
                chips: ['kubectl apply -f train-job.yaml', 'kubectl get jobs,pods', 'kubectl logs job/train', 'kubectl delete job train', 'kubectl wait --for=condition=complete job/train --timeout=60s', 'kubectl apply -f model.yaml', 'kubectl describe pod -l app=model', 'kubectl apply -f canary.yaml', 'kubectl port-forward svc/model 8080:80', 'curl -X POST localhost:8080/predict', 'kubectl autoscale deployment model --cpu-percent=50 --min=2 --max=6'],
            });
            App.labUI(s.lab, lesson, ctx);
            App.quizUI(s.quiz, lesson);
        },
    };

    if (typeof module === 'object' && module.exports) module.exports = lesson;
    else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
