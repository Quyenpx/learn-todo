/*
 * Bài K1 — Kubernetes & Pod: cluster gồm những gì, kubectl nói chuyện với API server ra sao,
 * Pod là đơn vị nhỏ nhất và vì sao Pod "trần" không tự hồi sinh.
 * Sơ đồ vẽ các node của cluster kind và Pod đặt trên từng node, tô màu theo trạng thái.
 */
(function () {
  'use strict';
  // pod.yaml cố ý ghi sai tag image (1.277) để người học tự đọc Events và sửa
  const POD_YAML = `apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  labels:
    app: web
spec:
  containers:
    - name: nginx
      image: nginx:1.277
      ports:
        - containerPort: 80
`;
  const FILES = { 'pod.yaml': POD_YAML };
  const userPods = (e) => (e && e.list ? e.list('Pod').filter((p) => !p.sim.system && !p.sim.deletedAt) : []);
  const hist = (e) => (e && e.state ? e.state.history : []);

  const lesson = {
    id: 'k8s-basics',
    course: 'devops',
    group: 'Kubernetes',
    icon: '☸️',
    navTitle: 'Kubernetes & Pod',
    navSub: 'Cluster, node, kubectl',
    badge: 'DevOps · Bài 4',
    title: 'Kubernetes & Pod: từ một container đến cả cụm máy',
    files: FILES,
    lead: 'Docker chạy container trên một máy. Khi có hàng chục máy và hàng trăm container, cần một "nhạc trưởng" quyết định chạy ở đâu, theo dõi và sửa khi hỏng. Đó là Kubernetes. Bài này làm quen cluster, kubectl và Pod.',
    labs: [
      {
        id: 'nodes', title: 'Chào cluster: xem các node',
        desc: 'Liệt kê các node của cluster. Bạn sẽ thấy 1 node <b>control-plane</b> (bộ não) và 2 node <b>worker</b> (nơi chạy ứng dụng).',
        hint: '<code>kubectl get nodes</code> (thêm <code>-o wide</code> để xem IP, phiên bản container runtime).',
        check: (e) => (hist(e).some((h) => h.ok && h.verb === 'get' && /\bget\s+(nodes?|no)\b/.test(h.cmd)) ? { ok: true } : { ok: false, msg: 'Chưa thấy lệnh kubectl get nodes thành công.' }),
      },
      {
        id: 'run', title: 'Chạy Pod đầu tiên bằng lệnh',
        desc: 'Tạo một Pod chạy <code>nginx</code> bằng <code>kubectl run</code>, đợi đến khi cột READY là <code>1/1</code> và STATUS là <code>Running</code>. Quan sát Pod được đặt lên node worker nào trên sơ đồ.',
        hint: '<code>kubectl run web --image=nginx</code> rồi <code>kubectl get pods -o wide</code> vài lần (mất ~2 giây để kéo image).',
        check: (e) => (userPods(e).some((p) => p.sim.img && p.sim.img.kind === 'nginx' && !p.metadata.ownerKind && e.podView(p).ready) ? { ok: true } : { ok: false, msg: 'Chưa có Pod nginx nào ở trạng thái Running 1/1.' }),
      },
      {
        id: 'fix', title: 'Đọc Events và sửa pod.yaml',
        desc: 'File <code>pod.yaml</code> có một lỗi. Hãy <code>kubectl apply -f pod.yaml</code>, xem Pod <code>web-pod</code> bị <b>ErrImagePull / ImagePullBackOff</b>, dùng <code>kubectl describe pod web-pod</code> đọc phần Events để tìm nguyên nhân, sửa file rồi áp dụng lại.',
        hint: 'Tag <code>nginx:1.277</code> không tồn tại → sửa thành <code>nginx:1.27</code>. Pod không cho đổi phần lớn spec khi đang chạy, nên an toàn nhất là <code>kubectl delete pod web-pod</code> rồi <code>kubectl apply -f pod.yaml</code>. (Riêng trường image thì apply lại vẫn được.)',
        reflect: { q: 'Vì sao nên đọc Events trước khi đoán?', a: 'STATUS chỉ nói "cái gì" (ImagePullBackOff), còn Events nói "vì sao" (not found, unauthorized, hết dung lượng...). Mỗi nguyên nhân có cách sửa khác nhau.' },
        check: (e) => { const p = e && e.get && e.get('Pod', 'web-pod'); return p && !p.sim.deletedAt && e.podView(p).ready ? { ok: true } : { ok: false, msg: 'Pod web-pod chưa ở trạng thái Running 1/1.' }; },
      },
      {
        id: 'exec-delete', title: 'Vào trong Pod, rồi xóa Pod',
        desc: 'Chạy một lệnh bên trong Pod (ví dụ xem biến môi trường hoặc tên máy), sau đó <b>xóa</b> một Pod bạn tự tạo và kiểm tra lại: Pod "trần" biến mất luôn, không ai tạo lại.',
        hint: '<code>kubectl exec web -- hostname</code> hoặc <code>kubectl exec -it web -- sh</code> (gõ <code>exit</code> để ra). Rồi <code>kubectl delete pod web</code> và <code>kubectl get pods</code>.',
        reflect: { q: 'Vậy làm sao để ứng dụng tự sống lại khi Pod chết?', a: 'Không tạo Pod trực tiếp mà để một controller (Deployment → ReplicaSet) quản lý. Controller liên tục so sánh "mong muốn" với "thực tế" và tạo Pod mới khi thiếu — chủ đề của bài sau.' },
        check: (e) => {
          const h = hist(e);
          const exec = h.some((x) => x.ok && (x.verb === 'exec' || x.kind === 'pod-exec'));
          const del = h.some((x) => x.ok && x.verb === 'delete' && x.meta && x.meta.kind === 'Pod' && (x.meta.owned || []).some((o) => !o));
          return exec && del ? { ok: true } : { ok: false, msg: !exec ? 'Chưa chạy được lệnh nào bên trong Pod (kubectl exec).' : 'Chưa xóa Pod tự tạo nào (kubectl delete pod TÊN).' };
        },
      },
    ],
    quiz: [
      { q: 'Thành phần nào là "cửa ngõ" duy nhất mà kubectl và mọi thành phần khác nói chuyện cùng?', options: ['etcd', 'kube-apiserver', 'kubelet', 'kube-proxy'], answer: 1, explain: 'Mọi thao tác đi qua API server. API server ghi trạng thái vào etcd; scheduler, controller, kubelet đều theo dõi API server.' },
      { q: 'Pod là gì?', options: ['Một máy ảo', 'Đơn vị triển khai nhỏ nhất: một hoặc vài container dùng chung mạng (IP) và volume', 'Một image Docker', 'Một node trong cluster'], answer: 1, explain: 'Các container trong cùng Pod chia sẻ IP và có thể gọi nhau qua localhost. Thường mỗi Pod chỉ chạy 1 container chính.' },
      { q: 'Ai quyết định Pod mới chạy trên node nào?', options: ['kubelet', 'kube-scheduler', 'Người dùng phải chỉ định', 'etcd'], answer: 1, explain: 'Scheduler chọn node phù hợp (đủ CPU/RAM, không bị taint...). Sau đó kubelet trên node đó kéo image và chạy container.' },
      { q: 'Pod báo <code>ImagePullBackOff</code>. Lệnh nào giúp tìm nguyên nhân nhanh nhất?', options: ['kubectl logs POD', 'kubectl describe pod POD (xem Events)', 'kubectl delete pod POD', 'kubectl get nodes'], answer: 1, explain: 'Container chưa từng chạy nên logs trống. Events trong describe cho biết image không tồn tại, sai tên registry hay thiếu quyền.' },
      { q: 'Bạn xóa một Pod tạo bằng <code>kubectl run</code>. Điều gì xảy ra?', options: ['Kubernetes tự tạo lại ngay', 'Pod mất hẳn — không có controller nào quản lý nó', 'Node bị khởi động lại', 'Pod chuyển sang node khác'], answer: 1, explain: 'Pod "trần" không có chủ. Muốn tự phục hồi phải dùng Deployment/ReplicaSet.' },
      { q: 'Vì sao file YAML được ưa dùng hơn chuỗi lệnh kubectl run/create?', options: ['YAML chạy nhanh hơn', 'Khai báo trạng thái mong muốn, lưu vào Git, review và áp dụng lặp lại được (declarative)', 'kubectl run không hoạt động trên cluster thật', 'YAML không cần API server'], answer: 1, explain: 'kubectl apply -f là cách khai báo: "tôi muốn thế này". Chạy lại nhiều lần cho cùng kết quả, dễ theo dõi thay đổi.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Vì sao cần Kubernetes?</h2>
        <p>Với Docker, bạn tự gõ <code>docker run</code> trên từng máy. Khi một máy chết, container trên đó chết theo và không ai khởi động lại ở máy khác. Khi lượng truy cập tăng, bạn phải tự chạy thêm container. <b>Kubernetes (K8s)</b> làm những việc đó tự động: bạn chỉ khai báo <i>"tôi muốn 3 bản sao của web:2.0"</i>, nó tự lo đặt ở đâu, theo dõi và sửa.</p>
        <h3>Cấu trúc một cluster</h3>
        <ul>
          <li><b>Control plane</b> (bộ não): <code>kube-apiserver</code> (cửa ngõ, mọi lệnh đi qua đây), <code>etcd</code> (cơ sở dữ liệu lưu trạng thái), <code>kube-scheduler</code> (chọn node cho Pod), <code>kube-controller-manager</code> (các vòng lặp "mong muốn ↔ thực tế").</li>
          <li><b>Worker node</b>: <code>kubelet</code> (nhận lệnh, chạy container qua containerd), <code>kube-proxy</code> (định tuyến mạng cho Service).</li>
        </ul>
        <pre class="code"><code>kubectl ──HTTPS──▶ kube-apiserver ──▶ etcd
                        ▲   ▲
          scheduler ────┘   └──── kubelet (mỗi node) ──▶ containerd ──▶ container</code></pre>
        <h3>Pod — đơn vị nhỏ nhất</h3>
        <p>K8s không chạy container trực tiếp mà bọc trong <b>Pod</b>. Một Pod có một IP riêng; các container trong Pod dùng chung IP và volume. Pod là thứ "dùng một lần": chết là mất, Pod mới sẽ có tên và IP khác.</p>
        <pre class="code"><code>apiVersion: v1          # nhóm API
kind: Pod               # loại đối tượng
metadata:
  name: web-pod
  labels: { app: web }  # nhãn — dùng để chọn nhóm đối tượng
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports: [{ containerPort: 80 }]</code></pre>
        <h3>Bộ lệnh kubectl cần nhớ</h3>
        <ul>
          <li><code>kubectl get pods -o wide</code> — danh sách, kèm IP và node.</li>
          <li><code>kubectl describe pod TÊN</code> — chi tiết + <b>Events</b> (đọc đầu tiên khi có lỗi).</li>
          <li><code>kubectl logs TÊN</code> — output của container; <code>--previous</code> để xem lần chạy trước khi bị restart.</li>
          <li><code>kubectl exec -it TÊN -- sh</code> — mở shell trong container.</li>
          <li><code>kubectl apply -f file.yaml</code> / <code>kubectl delete -f file.yaml</code>.</li>
        </ul>
        <div class="callout tip"><strong>Mẹo:</strong> <code>kubectl explain pod.spec.containers</code> cho biết các trường hợp lệ; <code>kubectl run web --image=nginx --dry-run=client -o yaml &gt; pod.yaml</code> sinh sẵn file YAML mẫu.</div>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Cài <a href="https://kind.sigs.k8s.io/" target="_blank" rel="noopener">kind</a> (Kubernetes chạy trong Docker) và kubectl, rồi tạo cluster 3 node giống lab này:</p>
          <pre class="code"><code># kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lab
nodes:
  - role: control-plane
  - role: worker
  - role: worker</code></pre>
          <p><code>kind create cluster --config kind-config.yaml</code> → <code>kubectl get nodes</code>. Xóa cluster: <code>kind delete cluster --name lab</code>. Có thể dùng minikube hoặc Docker Desktop (bật Kubernetes) thay thế.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>ErrImagePull / ImagePullBackOff</code> — sai tên/tag image, registry riêng chưa có <code>imagePullSecrets</code>.</li>
            <li><code>CrashLoopBackOff</code> — container chạy rồi thoát liên tục; xem <code>kubectl logs TÊN --previous</code>.</li>
            <li><code>Pending</code> mãi — không node nào đủ tài nguyên; xem Events của describe.</li>
            <li><code>error: you must specify at least one command for the container</code> — lệnh <code>kubectl exec</code> thiếu dấu <code>--</code> trước lệnh.</li>
            <li><code>The connection to the server localhost:8080 was refused</code> — kubectl chưa có kubeconfig/cluster chưa chạy.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        engine: 'kube',
        diagram: 'k8s',
        title: '☸️ Cluster "lab" (kind · 3 node)',
        files: FILES,
        editFiles: ['pod.yaml'],
        cvHeight: 330,
        height: 300,
        welcome: ['Bạn đang ở máy có kubectl, đã kết nối tới cluster kind tên "lab".', 'Thử: kubectl get nodes → kubectl run web --image=nginx → kubectl get pods -o wide'],
        chips: ['kubectl get nodes', 'kubectl run web --image=nginx', 'kubectl get pods -o wide', 'kubectl apply -f pod.yaml', 'kubectl describe pod web-pod', 'kubectl exec web -- hostname', 'kubectl delete pod web', 'kubectl get pods -A'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
