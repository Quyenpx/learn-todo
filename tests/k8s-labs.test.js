/*
 * Kiểm thử hàm check() của các lab Kubernetes K1–K4: làm đúng theo gợi ý thì đạt,
 * chưa làm hoặc làm dở thì chưa đạt. Dùng file mẫu của chính bài học (lesson.files).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKube } = require('../js/devops/k8s-engine.js');
const basics = require('../js/lessons/devops/k8s-basics.js');
const deploy = require('../js/lessons/devops/k8s-deploy.js');
const config = require('../js/lessons/devops/k8s-config.js');
const ingress = require('../js/lessons/devops/k8s-ingress.js');

const mk = (files) => createKube({ seed: 7, files: JSON.parse(JSON.stringify(files)), now: () => 1_700_000_000_000 });
const run = (e, cmds) => cmds.forEach((c) => e.exec(c));
const okOf = (lesson, id, e) => lesson.labs.find((l) => l.id === id).check(e).ok;
const podsOf = (e, pre) => e.list('Pod').filter((p) => !p.sim.deletedAt && p.metadata.name.startsWith(pre));

test('lab K1: nodes, run, sửa pod.yaml, exec rồi xóa Pod trần', () => {
    const e = mk(basics.files);
    ['nodes', 'run', 'fix', 'exec-delete'].forEach((id) => assert.equal(okOf(basics, id, e), false, id));
    assert.equal(okOf(basics, 'fix', {}), false, 'không được lỗi khi chưa có engine');
    run(e, ['kubectl get nodes']);
    assert.equal(okOf(basics, 'nodes', e), true);
    run(e, ['kubectl run web --image=nginx']);
    assert.equal(okOf(basics, 'run', e), false, 'đang kéo image thì chưa đạt');
    e.advance(5000);
    assert.equal(okOf(basics, 'run', e), true);
    run(e, ['kubectl apply -f pod.yaml']);
    e.advance(15000);
    assert.equal(okOf(basics, 'fix', e), false, 'tag 1.277 không tồn tại');
    e.setFile('pod.yaml', e.files['pod.yaml'].replace('nginx:1.277', 'nginx:1.27'));
    run(e, ['kubectl delete pod web-pod', 'kubectl apply -f pod.yaml']);
    e.advance(8000);
    assert.equal(okOf(basics, 'fix', e), true);
    assert.equal(okOf(basics, 'exec-delete', e), false, 'đã xóa web-pod nhưng chưa exec');
    run(e, ['kubectl exec web -- hostname', 'kubectl delete pod web']);
});

test('lab K2: apply, tự phục hồi, Service chia tải, rollout và undo', () => {
    const e = mk(deploy.files);
    run(e, ['kubectl apply -f deploy.yaml']);
    assert.equal(okOf(deploy, 'apply', e), false);
    e.advance(8000);
    assert.equal(okOf(deploy, 'apply', e), true);
    assert.equal(okOf(deploy, 'heal', e), false);
    run(e, [`kubectl delete pod ${podsOf(e, 'web-')[0].metadata.name}`]);
    e.advance(8000);
    assert.equal(okOf(deploy, 'heal', e), true);
    run(e, ['kubectl apply -f service.yaml', 'kubectl run tmp --image=busybox --rm -it -- sh']);
    assert.equal(okOf(deploy, 'svc', e), false);
    run(e, ['wget -qO- web', 'wget -qO- web', 'wget -qO- web', 'wget -qO- web', 'wget -qO- web', 'exit']);
    assert.equal(okOf(deploy, 'svc', e), true);
    run(e, ['kubectl set image deployment/web web=vlab/web:2.0', 'kubectl rollout status deployment/web', 'kubectl set image deployment/web web=vlab/web:broken']);
    e.advance(10000);
    assert.equal(okOf(deploy, 'rollout', e), false, 'chưa undo');
    run(e, ['kubectl rollout undo deployment/web', 'kubectl rollout status deployment/web']);
    e.advance(5000);
    assert.equal(okOf(deploy, 'rollout', e), true);
});

test('lab K3: ConfigMap, Secret, readinessProbe và OOMKilled', () => {
    const e = mk(config.files);
    run(e, ['kubectl apply -f deploy.yaml']);
    e.advance(5000);
    assert.equal(okOf(config, 'configmap', e), false, 'thiếu ConfigMap → CreateContainerConfigError');
    run(e, ['kubectl apply -f config.yaml']);
    e.advance(8000);
    assert.equal(okOf(config, 'configmap', e), false, 'chưa gọi thử app');
    run(e, ['kubectl port-forward deployment/web 8080:8080', 'curl localhost:8080']);
    assert.equal(okOf(config, 'configmap', e), true);

    run(e, ['kubectl apply -f secret.yaml']);
    assert.equal(okOf(config, 'secret', e), false, 'Pod chưa nhận biến từ Secret');
    const ENV = '          env:\n            - name: DB_PASSWORD\n              valueFrom:\n                secretKeyRef:\n                  name: db-secret\n                  key: DB_PASSWORD\n';
    e.setFile('deploy.yaml', e.files['deploy.yaml'] + ENV);
    run(e, ['kubectl apply -f deploy.yaml']);
    e.advance(15000);
    assert.equal(okOf(config, 'secret', e), true);

    const probe = (p) => `          readinessProbe:\n            httpGet:\n              path: ${p}\n              port: 8080\n            periodSeconds: 5\n`;
    const withSecret = e.files['deploy.yaml'];
    e.setFile('deploy.yaml', withSecret + probe('/health'));
    run(e, ['kubectl apply -f deploy.yaml']);
    e.advance(20000);
    assert.equal(okOf(config, 'probe', e), false, 'sai đường dẫn probe');
    e.setFile('deploy.yaml', withSecret + probe('/healthz'));
    run(e, ['kubectl apply -f deploy.yaml']);
    e.advance(20000);
    assert.equal(okOf(config, 'probe', e), true);

    run(e, ['kubectl apply -f cache.yaml']);
    e.advance(30000);
    assert.equal(okOf(config, 'oom', e), false, 'limits 64Mi bị OOMKilled');
    e.setFile('cache.yaml', e.files['cache.yaml'].replace(/memory: 64Mi/g, 'memory: 256Mi'));
    run(e, ['kubectl apply -f cache.yaml']);
    e.advance(30000);
    assert.equal(okOf(config, 'oom', e), true);
});

test('lab K4: hai app, Ingress theo domain, /api có rewrite, HPA tăng Pod', () => {
    const e = mk(ingress.files);
    run(e, ['kubectl apply -f apps.yaml']);
    assert.equal(okOf(ingress, 'apps', e), false);
    e.advance(8000);
    assert.equal(okOf(ingress, 'apps', e), true);
    run(e, ['kubectl apply -f ingress.yaml', 'curl other.local/']);
    assert.equal(okOf(ingress, 'ingress', e), false, '404 không tính');
    run(e, ['curl shop.local/']);
    assert.equal(okOf(ingress, 'ingress', e), true);
    run(e, ['curl shop.local/api/version']);
    assert.equal(okOf(ingress, 'api-path', e), false, 'chưa có nhánh /api tới Service api');
    e.setFile('ingress.yaml', e.files['ingress.yaml'] + `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
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
`);
    run(e, ['kubectl apply -f ingress.yaml', 'curl shop.local/api/version']);
    assert.equal(okOf(ingress, 'api-path', e), true);
    run(e, ['kubectl set resources deployment api --requests=cpu=100m', 'kubectl autoscale deployment api --cpu-percent=50 --min=1 --max=5']);
    e.advance(20000);
    assert.equal(okOf(ingress, 'hpa', e), false, 'chưa có tải');
    run(e, ['kubectl run load --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://api; done"']);
    e.advance(90000);
    assert.equal(okOf(ingress, 'hpa', e), true);
});

test('bài K1–K4: đủ 4 lab, 6 câu hỏi, đáp án hợp lệ', () => {
    [basics, deploy, config, ingress].forEach((l) => {
        assert.equal(l.course, 'devops');
        assert.equal(l.labs.length, 4, l.id);
        assert.equal(l.quiz.length, 6, l.id);
        l.quiz.forEach((q) => assert.ok(q.answer >= 0 && q.answer < q.options.length, q.q));
    });
});
