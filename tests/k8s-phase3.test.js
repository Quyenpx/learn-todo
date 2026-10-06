// Kiểm thử phần mở rộng giai đoạn 3 của bộ mô phỏng Kubernetes: lưu trữ, StatefulSet, Job, probe khởi động chậm,
// Helm và RBAC. Chạy: node --test tests/k8s-phase3.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKube } = require('../js/devops/k8s-engine.js');
const HELM = require('../js/devops/helm.js');

const mk = (files = {}) => createKube({ seed: 7, files, now: () => 1_700_000_000_000 });
const run = (e, cmd) => { const r = e.exec(cmd); r.text = r.lines.map((l) => l.text).join('\n'); return r; };
const live = (e, pre) => e.list('Pod').filter((p) => !p.sim.deletedAt && p.metadata.name.startsWith(pre));

const PVC = 'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: redis-data\nspec:\n  accessModes: ["ReadWriteOnce"]\n  resources:\n    requests:\n      storage: 1Gi\n';
const redisDeploy = (withVol) => `apiVersion: apps/v1
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
${withVol ? '          volumeMounts:\n            - name: data\n              mountPath: /data\n      volumes:\n        - name: data\n          persistentVolumeClaim:\n            claimName: redis-data\n' : ''}`;
const STS = `apiVersion: v1
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
  serviceName: db
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
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
`;

test('PVC chờ Pod đầu tiên (WaitForFirstConsumer) rồi mới Bound', () => {
    const e = mk({ 'pvc.yaml': PVC, 'redis.yaml': redisDeploy(true) });
    run(e, 'kubectl apply -f pvc.yaml');
    assert.match(run(e, 'kubectl get pvc').text, /redis-data\s+Pending/);
    assert.match(run(e, 'kubectl describe pvc redis-data').text, /WaitForFirstConsumer/);
    run(e, 'kubectl apply -f redis.yaml');
    e.advance(4000);
    assert.match(run(e, 'kubectl get pvc').text, /redis-data\s+Bound\s+pvc-\S+\s+1Gi\s+RWO\s+standard/);
    assert.match(run(e, 'kubectl get pv').text, /Delete\s+Bound\s+default\/redis-data/);
});

test('Pod tham chiếu PVC chưa có → Pending, có PVC thì chạy', () => {
    const e = mk({ 'redis.yaml': redisDeploy(true), 'pvc.yaml': PVC });
    run(e, 'kubectl apply -f redis.yaml');
    e.advance(5000);
    const name = live(e, 'redis-')[0].metadata.name;
    assert.match(run(e, 'kubectl get pods').text, /0\/1\s+Pending/);
    assert.match(run(e, `kubectl describe pod ${name}`).text, /persistentvolumeclaim "redis-data" not found/);
    run(e, 'kubectl apply -f pvc.yaml');
    e.advance(5000);
    assert.match(run(e, 'kubectl get pods').text, /1\/1\s+Running/);
});

test('Redis: dữ liệu mất khi Pod mới thay Pod cũ nếu không có volume, còn nguyên nếu có PVC', () => {
    for (const withVol of [false, true]) {
        const e = mk({ 'pvc.yaml': PVC, 'redis.yaml': redisDeploy(withVol) });
        if (withVol) run(e, 'kubectl apply -f pvc.yaml');
        run(e, 'kubectl apply -f redis.yaml');
        e.advance(5000);
        const p1 = live(e, 'redis-')[0].metadata.name;
        assert.equal(run(e, `kubectl exec ${p1} -- redis-cli set ten Lan`).text, 'OK');
        run(e, `kubectl delete pod ${p1}`);
        e.advance(6000);
        const p2 = live(e, 'redis-')[0].metadata.name;
        assert.notEqual(p1, p2);
        assert.equal(run(e, `kubectl exec ${p2} -- redis-cli get ten`).text, withVol ? '"Lan"' : '(nil)');
    }
});

test('StatefulSet: tạo lần lượt db-0 → db-2, mỗi Pod một PVC, DNS riêng qua headless Service', () => {
    const e = mk({ 'sts.yaml': STS });
    run(e, 'kubectl apply -f sts.yaml');
    assert.deepEqual(live(e, 'db-').map((p) => p.metadata.name), ['db-0'], 'chỉ db-0 được tạo trước');
    e.advance(15000);
    assert.match(run(e, 'kubectl get sts').text, /db\s+3\/3/);
    assert.equal((run(e, 'kubectl get pvc').text.match(/data-db-\d\s+Bound/g) || []).length, 3);
    run(e, 'kubectl exec db-1 -- redis-cli set k v1');
    assert.equal(run(e, 'kubectl exec db-0 -- redis-cli -h db-1.db get k').text, '"v1"');
    assert.equal((run(e, 'kubectl exec db-0 -- nslookup db').text.match(/Address: 10\.244/g) || []).length, 3);
    assert.match(run(e, 'kubectl exec db-0 -- nslookup db-2.db').text, /db-2\.db\.default\.svc\.cluster\.local/);
});

test('StatefulSet: xóa db-1 → tạo lại đúng tên, cùng node, cùng dữ liệu; thu nhỏ vẫn giữ PVC', () => {
    const e = mk({ 'sts.yaml': STS });
    run(e, 'kubectl apply -f sts.yaml');
    e.advance(15000);
    run(e, 'kubectl exec db-1 -- redis-cli set k v1');
    const before = e.get('Pod', 'db-1');
    run(e, 'kubectl delete pod db-1');
    e.advance(8000);
    const after = e.get('Pod', 'db-1');
    assert.ok(after && after.metadata.uid !== before.metadata.uid);
    assert.equal(after.sim.node, before.sim.node);
    assert.equal(run(e, 'kubectl exec db-1 -- redis-cli get k').text, '"v1"');
    run(e, 'kubectl scale sts db --replicas=1');
    e.advance(15000);
    assert.deepEqual(live(e, 'db-').map((p) => p.metadata.name), ['db-0']);
    assert.equal((run(e, 'kubectl get pvc').text.match(/data-db-\d/g) || []).length, 3);
    assert.ok(!run(e, 'kubectl apply -f sts.yaml'.replace('sts.yaml', 'sts.yaml')).text.includes('Forbidden'));
});

test('PVC đang dùng bị xóa → Terminating tới khi không còn Pod dùng', () => {
    const e = mk({ 'pvc.yaml': PVC, 'redis.yaml': redisDeploy(true) });
    run(e, 'kubectl apply -f pvc.yaml');
    run(e, 'kubectl apply -f redis.yaml');
    e.advance(5000);
    run(e, 'kubectl delete pvc redis-data');
    assert.match(run(e, 'kubectl get pvc').text, /redis-data\s+Terminating/);
    run(e, 'kubectl delete deploy redis');
    e.advance(4000);
    assert.match(run(e, 'kubectl get pvc').text, /No resources found/);
    assert.match(run(e, 'kubectl get pv').text, /No resources found/);
});

const JOB = (lr) => `apiVersion: batch/v1
kind: Job
metadata:
  name: train
spec:
  backoffLimit: 1
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: trainer
          image: vlab/trainer:1.0
          env:
            - name: LEARNING_RATE
              value: "${lr}"
`;

test('Job: learning rate quá lớn → loss NaN, thử lại tới backoffLimit rồi Failed', () => {
    const e = mk({ 'job.yaml': JOB(5) });
    run(e, 'kubectl apply -f job.yaml');
    e.advance(45000);
    assert.match(run(e, 'kubectl get jobs').text, /train\s+Failed\s+0\/1/);
    assert.equal(live(e, 'train-').length, 2);
    assert.match(run(e, 'kubectl logs job/train').text, /loss=nan[\s\S]*ValueError/);
    assert.match(run(e, 'kubectl describe job train').text, /BackoffLimitExceeded/);
    const w = run(e, 'kubectl wait --for=condition=complete job/train --timeout=5s');
    assert.ok(!w.ok);
});

test('Job: template bất biến; xóa rồi tạo lại với lr hợp lý → Complete', () => {
    const e = mk({ 'job.yaml': JOB(5) });
    run(e, 'kubectl apply -f job.yaml');
    e.setFile('job.yaml', JOB(0.1));
    const r = run(e, 'kubectl apply -f job.yaml');
    assert.ok(!r.ok); assert.match(r.text, /field is immutable/);
    run(e, 'kubectl delete job train');
    run(e, 'kubectl apply -f job.yaml');
    assert.ok(run(e, 'kubectl wait --for=condition=complete job/train --timeout=60s').ok);
    assert.match(run(e, 'kubectl get jobs').text, /train\s+Complete\s+1\/1/);
    assert.match(run(e, 'kubectl logs job/train').text, /Saved model to \/models\/model\.pkl/);
    assert.match(run(e, 'kubectl get job train -o yaml').text, /restartPolicy: Never/);
});

test('Job thiếu restartPolicy hợp lệ → lỗi giống API server', () => {
    const e = mk({ 'j.yaml': JOB(0.1).replace('      restartPolicy: Never\n', '') });
    const r = run(e, 'kubectl apply -f j.yaml');
    assert.ok(!r.ok); assert.match(r.text, /restartPolicy: Required value/);
});

const MODEL = (probes) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: model
spec:
  replicas: 1
  selector:
    matchLabels:
      app: model
  template:
    metadata:
      labels:
        app: model
    spec:
      containers:
        - name: model
          image: vlab/model:1.0
          ports:
            - containerPort: 8000
${probes}`;
const LIVE = '          livenessProbe:\n            httpGet:\n              path: /healthz\n              port: 8000\n            initialDelaySeconds: 3\n            periodSeconds: 3\n            failureThreshold: 2\n';
const STARTUP = '          startupProbe:\n            httpGet:\n              path: /healthz\n              port: 8000\n            periodSeconds: 5\n            failureThreshold: 6\n';

test('Model nạp chậm: liveness quá gắt → bị giết lặp lại; thêm startupProbe → chạy ổn', () => {
    const bad = mk({ 'm.yaml': MODEL(LIVE) });
    run(bad, 'kubectl apply -f m.yaml');
    bad.advance(40000);
    const v = bad.podView(live(bad, 'model-')[0]);
    assert.ok(v.restarts >= 1 && !v.ready, v.status);
    assert.match(run(bad, 'kubectl describe pod ' + live(bad, 'model-')[0].metadata.name).text, /Liveness probe failed[\s\S]*failed liveness probe, will be restarted/);
    const ok = mk({ 'm.yaml': MODEL(STARTUP + LIVE) });
    run(ok, 'kubectl apply -f m.yaml');
    ok.advance(40000);
    const v2 = ok.podView(live(ok, 'model-')[0]);
    assert.equal(v2.restarts, 0); assert.ok(v2.ready);
});

test('Model v2 cần file do Job huấn luyện ghi vào PVC; có file thì tự chạy lại', () => {
    const e = mk({
        'all.yaml': PVC.replace('redis-data', 'models') + '---\n' + MODEL('          volumeMounts:\n            - name: models\n              mountPath: /models\n      volumes:\n        - name: models\n          persistentVolumeClaim:\n            claimName: models\n').replace('vlab/model:1.0', 'vlab/model:2.0'),
        'job.yaml': JOB(0.1).replace('              value: "0.1"\n', '              value: "0.1"\n          volumeMounts:\n            - name: models\n              mountPath: /models\n      volumes:\n        - name: models\n          persistentVolumeClaim:\n            claimName: models\n'),
    });
    run(e, 'kubectl apply -f all.yaml');
    e.advance(8000);
    assert.match(run(e, 'kubectl logs deploy/model').text, /FileNotFoundError/);
    run(e, 'kubectl apply -f job.yaml');
    run(e, 'kubectl wait --for=condition=complete job/train --timeout=60s');
    e.advance(25000);
    assert.ok(e.podView(live(e, 'model-')[0]).ready);
    run(e, 'kubectl port-forward deploy/model 8080:8000');
    assert.match(run(e, 'curl -X POST localhost:8080/predict -d {"x":[5.1,3.5,1.4,0.2]}').text, /"model": "v2"/);
});

test('Ứng dụng đếm lượt xem dùng Redis qua tên Service', () => {
    const e = mk();
    run(e, 'kubectl create deployment web --image=vlab/counter:1.0 --port=5000');
    run(e, 'kubectl expose deploy web --port=80 --target-port=5000');
    e.advance(5000);
    run(e, 'kubectl port-forward svc/web 9090:80');
    assert.match(run(e, 'curl localhost:9090').text, /ConnectionError/);
    run(e, 'kubectl run redis --image=redis:7 --labels=app=redis');
    run(e, 'kubectl expose pod redis --port=6379');
    e.advance(4000);
    assert.match(run(e, 'curl localhost:9090').text, /xem 1 lần/);
    assert.match(run(e, 'curl localhost:9090').text, /xem 2 lần/);
    assert.equal(e.state.requests.filter((r) => r.count).pop().count, 2);
});

test('Helm template: values, default, quote, toYaml, if/range/include và lỗi đúng định dạng', () => {
    const top = { Values: { a: { b: 2 }, s: '', l: ['x', 'y'], m: { k: 1 } }, Release: { Name: 'r' } };
    assert.equal(HELM.renderString('{{ .Values.s | default "z" | quote }}', 't', top), '"z"');
    assert.equal(HELM.renderString('{{- range .Values.l }}[{{ . | upper }}]{{- end }}', 't', top), '[X][Y]');
    assert.equal(HELM.renderString('m:{{ toYaml .Values.m | nindent 2 }}', 't', top), 'm:\n  k: 1');
    assert.equal(HELM.renderString('{{ if gt .Values.a.b 1 }}big{{ else }}small{{ end }}', 't', top), 'big');
    assert.throws(() => HELM.renderString('{{ .Values.x.y }}', 'f.yaml', top), /nil pointer evaluating interface \{\}\.y/);
    assert.throws(() => HELM.renderString('{{ toYml .Values.m }}', 'f.yaml', top), /parse error at \(f\.yaml:1\): function "toYml" not defined/);
    assert.deepEqual(HELM.parseSet('a.b=1,c=true,d=2.0,e=x'), { a: { b: 1 }, c: true, d: '2.0', e: 'x' });
});

const chartFiles = () => { const f = {}; Object.entries(HELM.scaffold('webapp')).forEach(([k, v]) => (f['webapp/' + k] = v)); return f; };

test('helm install → upgrade --set → history → rollback; upgrade không truyền values thì dùng lại', () => {
    const e = mk(chartFiles());
    assert.match(run(e, 'helm install shop ./webapp').text, /STATUS: deployed[\s\S]*REVISION: 1/);
    e.advance(6000);
    assert.match(run(e, 'kubectl get deploy shop-webapp').text, /2\/2/);
    assert.match(run(e, 'kubectl get secrets').text, /sh\.helm\.release\.v1\.shop\.v1\s+helm\.sh\/release\.v1/);
    assert.match(run(e, 'helm upgrade shop ./webapp --set replicaCount=3 --set image.tag=2.0').text, /has been upgraded/);
    e.advance(15000);
    assert.equal(e.get('Deployment', 'shop-webapp').spec.template.spec.containers[0].image, 'vlab/web:2.0');
    run(e, 'helm upgrade shop ./webapp');
    assert.equal(e.get('Deployment', 'shop-webapp').spec.replicas, 3, 'không truyền values mới → giữ values cũ');
    run(e, 'helm upgrade shop ./webapp --set message=Hi');
    assert.equal(e.get('Deployment', 'shop-webapp').spec.replicas, 2, 'truyền values mới → values cũ bị thay thế');
    assert.match(run(e, 'helm rollback shop 2').text, /Rollback was a success/);
    assert.match(run(e, 'helm history shop').text, /5\s+.*deployed\s+webapp-0\.1\.0\s+1\.0\s+Rollback to 2/);
    assert.equal(e.get('Deployment', 'shop-webapp').spec.replicas, 3);
    assert.match(run(e, 'helm list').text, /shop\s+default\s+5\s+.*deployed\s+webapp-0\.1\.0/);
    assert.match(run(e, 'helm install shop ./webapp').text, /cannot re-use a name/);
});

test('helm: kho vlab, chart redis tạo StatefulSet + PVC; uninstall giữ PVC; lỗi template báo dòng', () => {
    const e = mk(chartFiles());
    assert.match(run(e, 'helm install cache vlab/redis').text, /repo vlab not found/);
    assert.ok(!run(e, 'helm repo add bitnami https://charts.bitnami.com/bitnami').ok);
    assert.match(run(e, 'helm repo add vlab https://charts.vlab.dev').text, /has been added/);
    assert.match(run(e, 'helm search repo redis').text, /vlab\/redis\s+1\.2\.0\s+7\.4\.1/);
    run(e, 'helm install cache vlab/redis --set persistence.size=2Gi');
    e.advance(8000);
    assert.match(run(e, 'kubectl get sts').text, /cache-redis\s+1\/1/);
    assert.match(run(e, 'kubectl get pvc').text, /data-cache-redis-0\s+Bound\s+\S+\s+2Gi/);
    const u = run(e, 'helm uninstall cache');
    assert.match(u.text, /release "cache" uninstalled[\s\S]*PVC vẫn còn/);
    assert.match(run(e, 'kubectl get pvc').text, /data-cache-redis-0/);
    e.setFile('webapp/templates/service.yaml', e.files['webapp/templates/service.yaml'].replace('.Values.service.port', '.Values.svc.port'));
    const t = run(e, 'helm install bad ./webapp');
    assert.ok(!t.ok); assert.match(t.text, /INSTALLATION FAILED: template: webapp\/templates\/service\.yaml:14/);
    assert.equal(e.get('Deployment', 'bad-webapp'), undefined, 'lỗi thì không áp dụng gì');
});

test('RBAC: ServiceAccount chưa có quyền → Forbidden; Role + RoleBinding → chỉ được đọc', () => {
    const e = mk();
    const AS = '--as=system:serviceaccount:default:viewer';
    run(e, 'kubectl create serviceaccount viewer');
    const f = run(e, `kubectl get pods ${AS}`);
    assert.ok(!f.ok); assert.match(f.text, /pods is forbidden: User "system:serviceaccount:default:viewer" cannot list resource "pods" in API group "" in the namespace "default"/);
    assert.match(run(e, 'kubectl create role pod-reader --verb=get,list,watch --resource=pods').text, /role\.rbac\.authorization\.k8s\.io\/pod-reader created/);
    run(e, 'kubectl create rolebinding read-pods --role=pod-reader --serviceaccount=default:viewer');
    assert.equal(run(e, `kubectl auth can-i list pods ${AS}`).text, 'yes');
    assert.equal(run(e, `kubectl auth can-i delete pods ${AS}`).text, 'no');
    assert.equal(run(e, `kubectl auth can-i list pods ${AS} -n kube-system`).text, 'no', 'Role chỉ có hiệu lực trong namespace của nó');
    assert.ok(run(e, `kubectl get pods ${AS}`).ok);
    assert.match(run(e, `kubectl delete pod x ${AS}`).text, /pods "x" is forbidden: User .* cannot delete resource "pods"/);
    assert.match(run(e, `kubectl get deploy ${AS}`).text, /deployments\.apps is forbidden|deployments is forbidden/);
    assert.match(run(e, 'kubectl create role x --verb=gett --resource=pods').text, /invalid verb: 'gett'/);
    run(e, 'kubectl create clusterrolebinding v --clusterrole=view --serviceaccount=default:viewer');
    assert.equal(run(e, `kubectl auth can-i list deployments ${AS} -n kube-system`).text, 'yes');
});

test('Ống dẫn | grep, | base64 -d', () => {
    const e = mk();
    run(e, 'kubectl create secret generic s --from-literal=PASS=abc123');
    assert.equal(run(e, "kubectl get secret s -o jsonpath='{.data.PASS}' | base64 -d").text, 'abc123');
    assert.equal(run(e, 'kubectl get nodes | grep worker2').text.split('\n').length, 1);
});
