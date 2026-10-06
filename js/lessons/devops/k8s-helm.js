/*
 * Bài K6 — Helm & RBAC: đóng gói manifest thành chart có tham số (values), quản lý vòng đời release
 * (install → upgrade → rollback → uninstall), và phân quyền "ít nhất có thể" bằng Role/RoleBinding.
 */
(function () {
    'use strict';
    const HELM = typeof module === 'object' && module.exports ? require('../../devops/helm.js') : window.DevOpsSim.helm;
    const CHART = {};
    Object.entries(HELM.scaffold('webapp')).forEach(([k, v]) => (CHART['webapp/' + k] = v));
    const VALUES_PROD = `# Values cho môi trường production — dùng: helm upgrade shop ./webapp -f values-prod.yaml
replicaCount: 3
image:
  tag: "2.0"     # để trong nháy: không có nháy thì YAML hiểu 2.0 là số 2
message: "Bản production"
`;
    // rbac.yaml cố ý viết sai "pod" (phải là số nhiều "pods") — apply vẫn thành công nhưng quyền không có hiệu lực
    const RBAC_YAML = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: viewer
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]          # "" = nhóm API lõi (pods, services, configmaps...)
    resources: ["pod"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: viewer-read-pods
subjects:
  - kind: ServiceAccount
    name: viewer
    namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
`;
    const FILES = Object.assign({}, CHART, { 'values-prod.yaml': VALUES_PROD, 'rbac.yaml': RBAC_YAML });
    const rels = (e) => (e && e.state && e.state.releases) || [];
    const last = (r) => r.revisions[r.revisions.length - 1];
    const VIEWER = 'system:serviceaccount:default:viewer';
    const depReady = (e, n) => { const d = e.get('Deployment', n); if (!d) return false; const v = e.depView(d); return v.updReady === v.desired && v.total === v.desired; };

    const lesson = {
        id: 'k8s-helm',
        course: 'devops',
        group: 'Kubernetes',
        icon: '⛵',
        navTitle: 'Helm & RBAC',
        navSub: 'Đóng gói chart, phân quyền',
        badge: 'DevOps · Bài 9',
        title: 'Helm & RBAC: cài cả ứng dụng bằng một lệnh, cấp quyền vừa đủ',
        files: FILES,
        lead: 'Một ứng dụng thật có hàng chục file YAML gần giống nhau cho dev, staging, production. Helm biến chúng thành một chart có tham số, cài/nâng cấp/quay lui bằng một lệnh. Đi kèm là câu hỏi "ai được làm gì trong cluster" — RBAC.',
        labs: [
            {
                id: 'install', title: 'Cài chart đầu tiên',
                desc: 'Xem cấu trúc chart <code>webapp/</code> (Chart.yaml, values.yaml, templates/). Dùng <code>helm template</code> để xem YAML được dựng ra, rồi cài với tên release <code>shop</code>.',
                hint: '<code>ls</code> → <code>cat webapp/values.yaml</code> → <code>helm template shop ./webapp</code> → <code>helm install shop ./webapp</code> → <code>helm list</code> → <code>kubectl get deploy,svc</code>. Thử gọi: <code>kubectl port-forward svc/shop-webapp 8080:80</code> rồi <code>curl localhost:8080</code>.',
                check: (e) => { const r = rels(e).find((x) => last(x).chart.startsWith('webapp-') && last(x).status === 'deployed'); return r && depReady(e, `${r.name}-webapp`) ? { ok: true } : { ok: false, msg: !r ? 'Chưa có release nào của chart webapp ở trạng thái deployed.' : `Deployment ${r.name}-webapp chưa sẵn sàng.` }; },
            },
            {
                id: 'upgrade', title: 'Nâng cấp bằng values, rồi quay lui',
                desc: 'Nâng cấp release lên image <code>2.0</code> với 3 bản sao (dùng <code>--set</code> hoặc file <code>values-prod.yaml</code>). Xem <code>helm history</code>. Giả sử bản mới có lỗi: <b>quay lui</b> về revision 1 bằng một lệnh.',
                hint: '<code>helm upgrade shop ./webapp --set replicaCount=3 --set image.tag=2.0</code> (hoặc <code>-f values-prod.yaml</code>) → <code>helm history shop</code> → <code>helm get values shop</code> → <code>helm rollback shop 1</code> → <code>helm history shop</code>.',
                reflect: { q: 'Rollback có xóa revision 2 không?', a: 'Không. Helm tạo revision MỚI (3) có nội dung giống revision 1, mô tả "Rollback to 1". Lịch sử chỉ tăng, nhờ vậy luôn biết ai đã đổi gì, khi nào — và có thể rollback tiếp về 2 nếu cần.' },
                check: (e) => {
                    const r = rels(e).find((x) => last(x).chart.startsWith('webapp-') && x.revisions.some((v) => v.desc === 'Upgrade complete') && x.revisions.some((v) => /^Rollback to/.test(v.desc)));
                    return r && depReady(e, `${r.name}-webapp`) ? { ok: true } : { ok: false, msg: !r ? 'Cần ít nhất một lần helm upgrade và một lần helm rollback trên release webapp.' : 'Đợi Deployment sau khi rollback sẵn sàng.' };
                },
            },
            {
                id: 'repo', title: 'Chart từ kho: Redis có ổ đĩa 2Gi',
                desc: 'Thêm kho chart <code>vlab</code>, tìm chart redis, xem các tham số, rồi cài với ổ đĩa <b>2Gi</b>. Chart này dựng sẵn StatefulSet + headless Service + PVC như bài trước — bạn không phải viết dòng YAML nào.',
                hint: '<code>helm repo add vlab https://charts.vlab.dev</code> → <code>helm search repo redis</code> → <code>helm show values vlab/redis</code> → <code>helm install cache vlab/redis --set persistence.size=2Gi</code> → <code>kubectl get sts,pvc</code>.',
                reflect: { q: 'helm uninstall cache có xóa dữ liệu Redis không?', a: 'Không xóa PVC sinh từ volumeClaimTemplates (chúng không nằm trong manifest của release). Đó là cố ý để tránh mất dữ liệu; muốn xóa hẳn thì kubectl delete pvc.' },
                check: (e) => {
                    const r = rels(e).find((x) => last(x).chart === 'redis-1.2.0' && last(x).status === 'deployed');
                    const s = r && e.get('StatefulSet', `${r.name}-redis`, r.ns);
                    const pvc = r && e.get('PersistentVolumeClaim', `data-${r.name}-redis-0`, r.ns);
                    const ok = s && e.stsView(s).ready >= 1 && pvc && pvc.sim.pv && String(pvc.spec.resources.requests.storage) === '2Gi';
                    return ok ? { ok: true } : { ok: false, msg: !r ? 'Chưa có release nào của chart vlab/redis.' : !pvc || String(pvc.spec.resources.requests.storage) !== '2Gi' ? 'PVC của Redis chưa phải 2Gi (dùng --set persistence.size=2Gi khi cài).' : 'Đợi StatefulSet Redis sẵn sàng và PVC Bound.' };
                },
            },
            {
                id: 'rbac', title: 'RBAC: tài khoản chỉ được xem Pod',
                desc: 'File <code>rbac.yaml</code> tạo ServiceAccount <code>viewer</code> với quyền đọc Pod — nhưng có <b>một lỗi</b> khiến quyền không có tác dụng (apply vẫn báo thành công!). Dùng <code>kubectl auth can-i</code> để phát hiện, sửa, và xác nhận: <code>viewer</code> được <b>list pods</b> nhưng <b>không</b> được <b>delete pods</b>.',
                hint: '<code>kubectl apply -f rbac.yaml</code> → <code>kubectl auth can-i list pods --as=system:serviceaccount:default:viewer</code> (no?!) → <code>kubectl describe role pod-reader</code> → tên resource phải là số nhiều <code>pods</code> → sửa, apply lại → <code>kubectl get pods --as=system:serviceaccount:default:viewer</code> → <code>kubectl delete pod ... --as=...</code> bị Forbidden.',
                reflect: { q: 'Vì sao RBAC không báo lỗi khi viết sai "pod"?', a: 'Role chỉ là danh sách cho phép; API server không kiểm tra tên resource có tồn tại (có thể là CRD cài sau). Vì vậy luôn kiểm chứng bằng kubectl auth can-i --as=... thay vì tin vào "created".' },
                check: (e) => {
                    if (!e || !e.authz) return { ok: false, msg: 'Chưa có cluster.' };
                    const list = e.authz(VIEWER, 'list', 'pods', '', 'default'), del = e.authz(VIEWER, 'delete', 'pods', '', 'default');
                    const tried = (e.state.history || []).some((h) => h.meta && h.meta.canI && h.meta.as === VIEWER);
                    return list && !del && tried ? { ok: true } : { ok: false, msg: !list ? 'viewer vẫn chưa list được pods.' : del ? 'viewer đang có quyền delete pods — quá rộng!' : 'Hãy kiểm chứng bằng kubectl auth can-i ... --as=system:serviceaccount:default:viewer.' };
                },
            },
        ],
        quiz: [
            { q: 'Helm chart gồm những phần chính nào?', options: ['Chỉ một file YAML lớn', 'Chart.yaml (tên, phiên bản), values.yaml (tham số mặc định), templates/ (manifest có chỗ trống {{ }})', 'Một image Docker', 'Một namespace'], answer: 1, explain: 'helm install = trộn values vào templates → được manifest → apply lên cluster, đánh dấu thành một release có số revision.' },
            { q: 'Lệnh nào xem YAML mà chart sẽ tạo ra MÀ KHÔNG cài gì lên cluster?', options: ['helm install --force', 'helm template TÊN ./chart (hoặc helm install --dry-run)', 'helm rollback', 'kubectl apply -k'], answer: 1, explain: 'Luôn xem trước kết quả dựng template, nhất là khi sửa toYaml/nindent — sai thụt lề là YAML hỏng.' },
            { q: 'Đang có release với <code>--set replicaCount=3</code>. Bạn chạy <code>helm upgrade shop ./webapp --set message=Hi</code>. replicaCount còn là 3?', options: ['Còn, Helm luôn giữ values cũ', 'Không — khi truyền values mới, Helm dùng values mặc định + values mới; muốn giữ cũ phải thêm --reuse-values hoặc dùng file values cố định', 'Lỗi', 'replicaCount thành 0'], answer: 1, explain: 'Cách an toàn: lưu values vào file (values-prod.yaml) trong Git và luôn upgrade bằng -f file đó.' },
            { q: '<code>helm rollback shop 1</code> làm gì?', options: ['Xóa revision 2 trở đi', 'Tạo revision mới với nội dung của revision 1 và áp lên cluster', 'Gỡ release', 'Chỉ đổi số hiển thị'], answer: 1, explain: 'Lịch sử revision chỉ tăng. helm history cho thấy "Rollback to 1".' },
            { q: 'Role và ClusterRole khác nhau thế nào?', options: ['Giống nhau', 'Role có hiệu lực trong một namespace; ClusterRole định nghĩa quyền dùng cho toàn cluster hoặc tài nguyên không thuộc namespace (node, PV...) — có thể gắn vào namespace qua RoleBinding', 'ClusterRole chỉ cho admin', 'Role chỉ cho Pod'], answer: 1, explain: 'RoleBinding gắn Role/ClusterRole cho ai đó TRONG một namespace; ClusterRoleBinding gắn ClusterRole cho toàn cluster.' },
            { q: 'Cách nhanh nhất kiểm tra một ServiceAccount có quyền xóa Pod không?', options: ['Thử xóa Pod production', 'kubectl auth can-i delete pods --as=system:serviceaccount:NS:TÊN', 'Đọc etcd', 'helm status'], answer: 1, explain: 'can-i trả yes/no mà không làm gì thật. Thêm --list để xem toàn bộ quyền.' },
        ],
        render(root, ctx) {
            const theory = `
        <h2>Helm: trình quản lý gói cho Kubernetes</h2>
        <p>Cùng một ứng dụng nhưng dev cần 1 replica, production cần 3 replica và image khác. Copy YAML ra nhiều bản là con đường dẫn tới sai sót. <b>Helm</b> gom YAML thành <b>chart</b> với chỗ trống <code>{{ }}</code> được điền từ <b>values</b>.</p>
        <pre class="code"><code>webapp/
├── Chart.yaml          # name, version (của chart), appVersion (của app)
├── values.yaml         # tham số mặc định
└── templates/
    ├── deployment.yaml # replicas: {{ .Values.replicaCount }}
    ├── service.yaml
    └── NOTES.txt       # lời nhắn in ra sau khi cài</code></pre>
        <h3>Template trong 1 phút</h3>
        <ul>
          <li><code>{{ .Values.image.tag }}</code>, <code>{{ .Release.Name }}</code>, <code>{{ .Chart.AppVersion }}</code> — lấy giá trị.</li>
          <li><code>{{ .Values.tag | default .Chart.AppVersion }}</code>, <code>| quote</code>, <code>| upper</code> — ống dẫn (pipe) qua hàm.</li>
          <li><code>{{- if .Values.persistence.enabled }} … {{- end }}</code>, <code>{{- range … }}</code>; dấu <code>-</code> cắt khoảng trắng thừa.</li>
          <li><code>{{- toYaml .Values.resources | nindent 12 }}</code> — chèn cả khối YAML, thụt đúng 12 dấu cách.</li>
        </ul>
        <h3>Vòng đời release</h3>
        <pre class="code"><code>helm install shop ./webapp                 # revision 1
helm upgrade shop ./webapp -f values-prod.yaml   # revision 2
helm rollback shop 1                       # revision 3 = nội dung của 1
helm uninstall shop                        # xóa mọi thứ release đã tạo</code></pre>
        <p>Helm lưu từng revision trong Secret <code>sh.helm.release.v1.shop.vN</code> (xem bằng <code>kubectl get secrets</code>). Chart dùng chung nằm ở kho (repository) — tìm trên <a href="https://artifacthub.io" target="_blank" rel="noopener">Artifact Hub</a>.</p>
        <h2>RBAC: ai được làm gì</h2>
        <p>Mỗi request tới API server được <b>xác thực</b> (bạn là ai: User, Group, hay <b>ServiceAccount</b> của Pod) rồi <b>phân quyền</b> theo RBAC:</p>
        <pre class="code"><code>Role "pod-reader" (namespace default)        RoleBinding "viewer-read-pods"
  apiGroups: [""]                     ◀──roleRef──   subjects:
  resources: ["pods"]                                  - ServiceAccount viewer
  verbs: ["get", "list", "watch"]</code></pre>
        <ul>
          <li><b>Role</b> / <b>ClusterRole</b>: danh sách quyền (verbs × resources × apiGroups). Không có "deny" — chỉ cộng dồn quyền cho phép.</li>
          <li><b>RoleBinding</b> / <b>ClusterRoleBinding</b>: gắn quyền cho chủ thể.</li>
          <li>ClusterRole có sẵn: <code>view</code>, <code>edit</code>, <code>admin</code>, <code>cluster-admin</code>.</li>
          <li>Nguyên tắc <b>quyền tối thiểu</b>: CI/CD chỉ cần <code>edit</code> trong namespace của nó, không cần <code>cluster-admin</code>.</li>
        </ul>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Cài Helm: <code>winget install Helm.Helm</code> (Windows), <code>brew install helm</code> (macOS). Kho thật: <code>helm repo add bitnami https://charts.bitnami.com/bitnami</code>, <code>helm install my-redis bitnami/redis</code>.</p>
          <pre class="code"><code>helm create webapp            # sinh chart mẫu đầy đủ (_helpers.tpl, ingress, hpa...)
helm lint ./webapp
helm upgrade --install shop ./webapp -f values-prod.yaml --wait
kubectl auth can-i --list --as=system:serviceaccount:default:viewer</code></pre>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>cannot re-use a name that is still in use</code> — release đã có; dùng <code>helm upgrade</code> (hoặc <code>upgrade --install</code>).</li>
            <li><code>nil pointer evaluating interface {}.port</code> — template đọc <code>.Values.svc.port</code> nhưng values không có khóa <code>svc</code>.</li>
            <li><code>error converting YAML to JSON</code> sau khi dựng — thụt lề sai quanh <code>toYaml</code>/<code>nindent</code>; xem lại bằng <code>helm template</code>.</li>
            <li><code>UPGRADE FAILED: "shop" has no deployed releases</code> — sai tên release hoặc sai namespace (<code>-n</code>).</li>
            <li><code>Error from server (Forbidden): pods is forbidden: User "…" cannot list resource "pods"</code> — thiếu Role/RoleBinding, hoặc viết sai tên resource (<code>pod</code> thay vì <code>pods</code>), hoặc RoleBinding ở namespace khác.</li>
          </ul>
        </details>`;
            const s = App.shell(root, lesson, theory);
            App.dvSetup(s.sim, ctx, lesson, {
                engine: 'kube', diagram: 'k8s',
                title: '⛵ Cluster "lab" — Helm 3 & RBAC',
                files: FILES, editFiles: ['webapp/values.yaml', 'webapp/templates/deployment.yaml', 'values-prod.yaml', 'rbac.yaml'],
                cvHeight: 340, height: 300,
                welcome: ['Máy lab có kubectl và helm v3. Chart mẫu nằm ở thư mục ./webapp.', 'Thử: helm template shop ./webapp → helm install shop ./webapp'],
                chips: ['helm template shop ./webapp', 'helm install shop ./webapp', 'helm list', 'helm upgrade shop ./webapp --set replicaCount=3 --set image.tag=2.0', 'helm history shop', 'helm rollback shop 1', 'helm repo add vlab https://charts.vlab.dev', 'helm install cache vlab/redis --set persistence.size=2Gi', 'kubectl apply -f rbac.yaml', 'kubectl auth can-i list pods --as=system:serviceaccount:default:viewer'],
            });
            App.labUI(s.lab, lesson, ctx);
            App.quizUI(s.quiz, lesson);
        },
    };

    if (typeof module === 'object' && module.exports) module.exports = lesson;
    else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
