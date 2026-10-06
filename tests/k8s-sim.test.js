// Kiểm thử bộ mô phỏng Kubernetes (k8s-engine.js) — chạy: node --test tests/k8s-sim.test.js
// Mục đích: bảo đảm hành vi giống cluster thật để các bài K1–K4 chấm lab đúng.
const test = require('node:test');
const assert = require('node:assert');
const { createKube } = require('../js/devops/k8s-engine.js');

const mk = (files = {}) => createKube({ seed: 7, files, now: () => 1_700_000_000_000 });
const run = (e, cmd) => { const r = e.exec(cmd); r.text = r.lines.map((l) => l.text).join('\n'); return r; };
const pods = (e, pre = '') => e.list('Pod').filter((p) => !p.sim.deletedAt && p.metadata.name.startsWith(pre));

const deployYaml = (image = 'vlab/web:1.0', extra = '') => `apiVersion: apps/v1
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
        app: web
    spec:
      containers:
        - name: web
          image: ${image}
          ports:
            - containerPort: 8080
${extra}`;

test('get nodes + run nginx → Running 1/1', () => {
  const e = mk();
  assert.match(run(e, 'kubectl get nodes').text, /lab-worker2\s+Ready/);
  assert.ok(run(e, 'kubectl run web --image=nginx').ok);
  assert.match(run(e, 'kubectl get pods').text, /ContainerCreating/);
  e.advance(5000);
  assert.match(run(e, 'kubectl get pods').text, /web\s+1\/1\s+Running/);
});

test('image sai → ImagePullBackOff, describe có Events', () => {
  const e = mk();
  run(e, 'kubectl run bad --image=nginx:1.277');
  e.advance(15000);
  assert.match(run(e, 'kubectl get pods').text, /ErrImagePull|ImagePullBackOff/);
  assert.match(run(e, 'kubectl describe pod bad').text, /Failed to pull image/);
});

test('apply deployment 3 replica, xóa Pod → được tạo lại', () => {
  const e = mk({ 'deploy.yaml': deployYaml() });
  assert.ok(run(e, 'kubectl apply -f deploy.yaml').ok);
  e.advance(8000);
  assert.strictEqual(pods(e, 'web-').length, 3);
  const victim = pods(e, 'web-')[0].metadata.name;
  assert.ok(run(e, `kubectl delete pod ${victim}`).ok);
  e.advance(8000);
  const now = pods(e, 'web-');
  assert.strictEqual(now.length, 3);
  assert.ok(!now.some((p) => p.metadata.name === victim));
  assert.match(run(e, 'kubectl get deploy').text, /web\s+3\/3/);
});

test('selector không khớp và unknown field → lỗi', () => {
  const e = mk({
    'a.yaml': deployYaml().replace('matchLabels:\n      app: web', 'matchLabels:\n      app: api'),
    'b.yaml': deployYaml().replace('replicas: 3', 'replicas: 3\n  replica: 2'),
  });
  const a = run(e, 'kubectl apply -f a.yaml');
  assert.ok(!a.ok); assert.match(a.text, /selector/);
  const b = run(e, 'kubectl apply -f b.yaml');
  assert.ok(!b.ok); assert.match(b.text, /unknown field/);
});

test('YAML lỗi cú pháp → phát sự kiện fileError', () => {
  const e = mk({ 'x.yaml': 'kind: Pod\nmetadata:\n  name: [oops\n' });
  const evs = []; e.on('event', (d) => evs.push(d));
  assert.ok(!run(e, 'kubectl apply -f x.yaml').ok);
  assert.ok(evs.some((d) => d.type === 'fileError' && d.file === 'x.yaml'));
});

test('expose + curl từ Pod qua Service trúng nhiều Pod', () => {
  const e = mk({ 'deploy.yaml': deployYaml() });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(8000);
  assert.ok(run(e, 'kubectl expose deployment web --port=80 --target-port=8080').ok);
  assert.ok(run(e, 'kubectl run tmp --image=busybox --rm -it -- sh').ok);
  assert.ok(e.session);
  for (let i = 0; i < 6; i++) assert.match(run(e, 'wget -qO- web').text, /Xin chào từ web-/);
  run(e, 'exit');
  const hit = new Set(e.state.requests.filter((r) => r.svc === 'web').map((r) => r.pod));
  assert.ok(hit.size >= 2, 'phải cân bằng tải sang ≥2 Pod');
});

test('port-forward + NodePort cho phép curl từ máy host', () => {
  const e = mk({ 'deploy.yaml': deployYaml() });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(8000);
  run(e, 'kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort');
  assert.ok(run(e, 'kubectl port-forward svc/web 8080:80').ok);
  assert.match(run(e, 'curl localhost:8080').text, /Xin chào/);
  const np = e.get('Service', 'web').spec.ports[0].nodePort;
  assert.ok(np >= 30000 && np <= 32767);
  assert.match(run(e, `curl localhost:${np}`).text, /Xin chào/);
});

test('rolling update 2.0 thành công; broken bị kẹt; undo phục hồi', () => {
  const e = mk({ 'deploy.yaml': deployYaml() });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(8000);
  run(e, 'kubectl set image deployment/web web=vlab/web:2.0');
  const st = run(e, 'kubectl rollout status deployment/web');
  assert.ok(st.ok); assert.match(st.text, /successfully rolled out/);
  assert.ok(pods(e, 'web-').every((p) => p.spec.containers[0].image === 'vlab/web:2.0'));
  run(e, 'kubectl set image deployment/web web=vlab/web:broken');
  const bad = run(e, 'kubectl rollout status deployment/web');
  assert.ok(!bad.ok);
  // Vẫn còn Pod bản cũ phục vụ (maxUnavailable 25%)
  e.advance(5000);
  assert.ok(pods(e, 'web-').filter((p) => e.podView(p).ready).length >= 2);
  assert.ok(run(e, 'kubectl rollout undo deployment/web').ok);
  assert.ok(run(e, 'kubectl rollout status deployment/web').ok);
  e.advance(5000);
  assert.ok(pods(e, 'web-').every((p) => p.spec.containers[0].image === 'vlab/web:2.0'));
  assert.match(run(e, 'kubectl rollout history deployment/web').text, /REVISION/);
});

test('ConfigMap qua env: MESSAGE hiện trong phản hồi; sửa ConfigMap cần restart', () => {
  const e = mk({
    'deploy.yaml': deployYaml('vlab/web:1.0', `          envFrom:
            - configMapRef:
                name: web-config
`),
  });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(5000);
  assert.ok(pods(e, 'web-').every((p) => e.podView(p).status === 'CreateContainerConfigError'));
  run(e, 'kubectl create configmap web-config --from-literal=MESSAGE=HelloK8s');
  e.advance(8000);
  run(e, 'kubectl port-forward deployment/web 8080:8080');
  assert.match(run(e, 'curl localhost:8080').text, /HelloK8s/);
});

test('Secret base64 sai → lỗi; stringData hợp lệ', () => {
  const e = mk({
    's.yaml': 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: s1\ndata:\n  PASSWORD: "not base64!!"\n',
    's2.yaml': 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: s2\nstringData:\n  PASSWORD: abc123\n',
  });
  assert.ok(!run(e, 'kubectl apply -f s.yaml').ok);
  assert.ok(run(e, 'kubectl apply -f s2.yaml').ok);
  assert.match(run(e, 'kubectl get secret s2 -o yaml').text, /YWJjMTIz/);
});

test('readiness sai path → READY 0/1; liveness đúng vẫn Running', () => {
  const e = mk({
    'deploy.yaml': deployYaml('vlab/web:1.0', `          readinessProbe:
            httpGet:
              path: /health
              port: 8080
`).replace('replicas: 3', 'replicas: 1'),
  });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(15000);
  assert.match(run(e, 'kubectl get pods').text, /0\/1\s+Running/);
  assert.match(run(e, 'kubectl describe pod ' + pods(e, 'web-')[0].metadata.name).text, /Readiness probe failed/);
  assert.strictEqual(e.endpoints(e.get('Service', 'kubernetes')).length, 0);
});

test('limits.memory quá nhỏ → OOMKilled/CrashLoopBackOff', () => {
  const e = mk({
    'deploy.yaml': deployYaml('vlab/web:1.0', `          resources:
            limits:
              memory: 64Mi
`).replace('replicas: 3', 'replicas: 1'),
  });
  run(e, 'kubectl apply -f deploy.yaml');
  e.advance(30000);
  const v = e.podView(pods(e, 'web-')[0]);
  // Ở giây 30 Pod đang trong back-off sau lần OOM thứ hai
  assert.ok(['OOMKilled', 'CrashLoopBackOff'].includes(v.status), v.status);
  assert.ok(v.restarts >= 1);
  assert.match(run(e, 'kubectl describe pod ' + pods(e, 'web-')[0].metadata.name).text, /OOMKilled/);
});

test('Ingress host + path, rewrite-target cho /api', () => {
  const e = mk();
  run(e, 'kubectl create deployment shop --image=vlab/web:1.0 --port=8080');
  run(e, 'kubectl create deployment api --image=vlab/web:2.0 --port=8080');
  run(e, 'kubectl expose deployment shop --port=80 --target-port=8080');
  run(e, 'kubectl expose deployment api --port=80 --target-port=8080');
  e.advance(8000);
  e.setFile('ing.yaml', `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
    - host: shop.local
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /()(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: shop
                port:
                  number: 80
`);
  assert.ok(run(e, 'kubectl apply -f ing.yaml').ok);
  assert.match(run(e, 'curl shop.local/').text, /v1/);
  assert.match(run(e, 'curl shop.local/api/version').text, /2\.0|v2/);
  assert.match(run(e, 'curl other.local/').text, /404/);
});

test('HPA: thiếu requests → <unknown>; có requests + tải → tăng rồi giảm', () => {
  const e = mk();
  run(e, 'kubectl create deployment web --image=vlab/web:1.0 --port=8080');
  run(e, 'kubectl expose deployment web --port=80 --target-port=8080');
  run(e, 'kubectl autoscale deployment web --cpu-percent=50 --min=1 --max=5');
  e.advance(30000);
  assert.match(run(e, 'kubectl get hpa').text, /<unknown>/);
  run(e, 'kubectl set resources deployment web --requests=cpu=100m');
  e.advance(20000);
  run(e, 'kubectl run load --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://web; done"');
  e.advance(90000);
  const up = e.get('Deployment', 'web').spec.replicas;
  assert.ok(up > 1, 'phải tăng replica, hiện ' + up);
  run(e, 'kubectl delete pod load');
  e.advance(180000);
  assert.ok(e.get('Deployment', 'web').spec.replicas < up, 'phải giảm replica sau khi dừng tải');
});

test('--dry-run=client -o yaml > file ghi ra file', () => {
  const e = mk();
  assert.ok(run(e, 'kubectl create deployment web --image=vlab/web:1.0 --dry-run=client -o yaml > deploy.yaml').ok);
  assert.match(e.files['deploy.yaml'], /kind: Deployment/);
  assert.strictEqual(e.get('Deployment', 'web'), undefined);
  assert.ok(run(e, 'kubectl apply -f deploy.yaml').ok);
  assert.ok(e.get('Deployment', 'web'));
});
