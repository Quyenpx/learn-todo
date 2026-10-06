/*
 * Kiểm thử hàm check() của các bài giai đoạn 3 (K5–K7 và dự án tổng kết): làm theo gợi ý thì đạt,
 * chưa làm hoặc làm sai thì chưa đạt. Dùng chính file mẫu của bài (lesson.files).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKube } = require('../js/devops/k8s-engine.js');
const stateful = require('../js/lessons/devops/k8s-stateful.js');
const helmL = require('../js/lessons/devops/k8s-helm.js');
const ml = require('../js/lessons/devops/k8s-ml.js');
const final = require('../js/lessons/devops/devops-final.js');

const mk = (files) => createKube({ seed: 7, files: JSON.parse(JSON.stringify(files)), now: () => 1_700_000_000_000 });
const run = (e, cmds) => cmds.forEach((c) => e.exec(c));
const out = (e, c) => e.exec(c).lines.map((l) => l.text).join('\n');
const okOf = (lesson, id, e) => lesson.labs.find((l) => l.id === id).check(e).ok;
const fix = (e, f, from, to) => e.setFile(f, e.files[f].replace(from, to));

test('lab K5: dữ liệu mất theo Pod, PVC giữ dữ liệu, StatefulSet và danh tính ổn định', () => {
    const e = mk(stateful.files);
    ['ephemeral', 'pvc', 'sts', 'identity'].forEach((id) => assert.equal(okOf(stateful, id, e), false, id));
    assert.equal(okOf(stateful, 'sts', {}), false);
    run(e, ['kubectl apply -f redis.yaml']);
    e.advance(5000);
    run(e, ['kubectl exec deploy/redis -- redis-cli set ten Lan', 'kubectl delete pod -l app=redis']);
    e.advance(6000);
    run(e, ['kubectl exec deploy/redis -- redis-cli get ten']);
    assert.equal(okOf(stateful, 'ephemeral', e), true);
    assert.equal(okOf(stateful, 'pvc', e), false);

    run(e, ['kubectl apply -f pvc.yaml']);
    assert.match(out(e, 'kubectl get pvc'), /redis-data\s+Pending/);
    // Bỏ comment 7 dòng volumeMounts/volumes như hướng dẫn của lab
    e.setFile('redis.yaml', e.files['redis.yaml'].split('\n').map((l) => (/#\s*(volumeMounts:|- name: data|mountPath: \/data|volumes:|persistentVolumeClaim:|claimName: redis-data)/.test(l) ? l.replace('# ', '') : l)).join('\n'));
    assert.ok(e.exec('kubectl apply -f redis.yaml').ok, e.files['redis.yaml']);
    e.advance(8000);
    assert.match(out(e, 'kubectl get pvc'), /redis-data\s+Bound/);
    run(e, ['kubectl exec deploy/redis -- redis-cli set ten Lan', 'kubectl delete pod -l app=redis']);
    e.advance(6000);
    assert.equal(out(e, 'kubectl exec deploy/redis -- redis-cli get ten'), '"Lan"');
    assert.equal(okOf(stateful, 'pvc', e), true);

    run(e, ['kubectl apply -f statefulset.yaml']);
    assert.equal(okOf(stateful, 'sts', e), false, 'Pod tạo lần lượt, chưa đủ ngay');
    e.advance(15000);
    assert.equal(okOf(stateful, 'sts', e), true);
    run(e, ['kubectl exec db-1 -- redis-cli set vaitro replica', 'kubectl delete pod db-1']);
    e.advance(8000);
    assert.equal(okOf(stateful, 'identity', e), false);
    run(e, ['kubectl exec db-1 -- redis-cli get vaitro']);
    assert.equal(okOf(stateful, 'identity', e), true);
});

test('lab K6: helm install, upgrade + rollback, chart redis 2Gi, RBAC sửa lỗi "pod"', () => {
    const e = mk(helmL.files);
    ['install', 'upgrade', 'repo', 'rbac'].forEach((id) => assert.equal(okOf(helmL, id, e), false, id));
    run(e, ['helm template shop ./webapp', 'helm install shop ./webapp']);
    assert.equal(okOf(helmL, 'install', e), false, 'Pod chưa sẵn sàng');
    e.advance(6000);
    assert.equal(okOf(helmL, 'install', e), true);
    run(e, ['helm upgrade shop ./webapp -f values-prod.yaml']);
    e.advance(15000);
    assert.equal(e.get('Deployment', 'shop-webapp').spec.template.spec.containers[0].image, 'vlab/web:2.0');
    assert.equal(okOf(helmL, 'upgrade', e), false, 'chưa rollback');
    run(e, ['helm rollback shop 1']);
    e.advance(15000);
    assert.equal(okOf(helmL, 'upgrade', e), true);

    run(e, ['helm repo add vlab https://charts.vlab.dev', 'helm install cache vlab/redis']);
    e.advance(8000);
    assert.equal(okOf(helmL, 'repo', e), false, 'mặc định 1Gi');
    run(e, ['helm uninstall cache', 'kubectl delete pvc data-cache-redis-0', 'helm install cache vlab/redis --set persistence.size=2Gi']);
    e.advance(8000);
    assert.equal(okOf(helmL, 'repo', e), true);

    const AS = '--as=system:serviceaccount:default:viewer';
    run(e, ['kubectl apply -f rbac.yaml', `kubectl auth can-i list pods ${AS}`]);
    assert.equal(out(e, `kubectl auth can-i list pods ${AS}`), 'no', 'resources: ["pod"] sai số ít');
    assert.equal(okOf(helmL, 'rbac', e), false);
    fix(e, 'rbac.yaml', '["pod"]', '["pods"]');
    run(e, ['kubectl apply -f rbac.yaml', `kubectl auth can-i list pods ${AS}`]);
    assert.equal(okOf(helmL, 'rbac', e), true);
});

test('lab K7: Job huấn luyện, startupProbe, canary v1+v2, HPA', () => {
    const e = mk(ml.files);
    ['train', 'serve', 'canary', 'scale'].forEach((id) => assert.equal(okOf(ml, id, e), false, id));
    run(e, ['kubectl apply -f train-job.yaml']);
    e.advance(45000);
    assert.match(out(e, 'kubectl get jobs'), /train\s+Failed/);
    assert.equal(okOf(ml, 'train', e), false);
    fix(e, 'train-job.yaml', 'value: "5"', 'value: "0.1"');
    assert.ok(!e.exec('kubectl apply -f train-job.yaml').ok, 'Job bất biến');
    run(e, ['kubectl delete job train', 'kubectl apply -f train-job.yaml', 'kubectl wait --for=condition=complete job/train --timeout=60s']);
    assert.equal(okOf(ml, 'train', e), true);

    run(e, ['kubectl apply -f model.yaml']);
    e.advance(40000);
    assert.match(out(e, 'kubectl get pods -l app=model'), /CrashLoopBackOff|Error/);
    assert.equal(okOf(ml, 'serve', e), false);
    fix(e, 'model.yaml', '          livenessProbe:', '          startupProbe:\n            httpGet:\n              path: /healthz\n              port: 8000\n            periodSeconds: 5\n            failureThreshold: 12\n          livenessProbe:');
    run(e, ['kubectl apply -f model.yaml', 'kubectl rollout status deployment/model']);
    e.advance(25000);
    assert.equal(okOf(ml, 'serve', e), true);

    run(e, ['kubectl apply -f canary.yaml']);
    e.advance(25000);
    run(e, ['kubectl port-forward svc/model 8080:80']);
    for (let i = 0; i < 6; i++) run(e, ['curl -X POST localhost:8080/predict -d {"features":[5.1,3.5,1.4,0.2]}']);
    assert.equal(okOf(ml, 'canary', e), true);

    run(e, ['kubectl autoscale deployment model --cpu-percent=50 --min=2 --max=6']);
    e.advance(20000);
    assert.equal(okOf(ml, 'scale', e), false);
    run(e, ['kubectl run load --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://model/predict; done"']);
    e.advance(60000);
    assert.equal(okOf(ml, 'scale', e), true);
});

test('dự án tổng kết: sửa 5 lỗi, Ingress trả số đếm, Redis khởi động lại không mất dữ liệu, HPA đo được', () => {
    const e = mk(final.files);
    final.labs.forEach((l) => assert.equal(l.check(e).ok, false, l.id));
    assert.match(out(e, 'kubectl apply -f shop.yaml -n prod'), /namespaces "prod" not found/);
    run(e, ['kubectl create namespace prod', 'kubectl config set-context --current --namespace=prod']);
    const first = out(e, 'kubectl apply -f shop.yaml');
    assert.match(first, /volumeMounts\[0\]\.name: Not found: "redis-data"/);
    assert.match(first, /selector` does not match template `labels`/);
    assert.match(first, /pathType: Required value/);
    assert.equal(okOf(final, 'ns', e), true);

    fix(e, 'shop.yaml', '- name: redis-data', '- name: data');
    fix(e, 'shop.yaml', 'app: shop-web', 'app: web');
    fix(e, 'shop.yaml', '          - path: /\n', '          - path: /\n            pathType: Prefix\n');
    run(e, ['kubectl apply -f shop.yaml']);
    e.advance(12000);
    assert.equal(okOf(final, 'redis', e), true);
    assert.equal(okOf(final, 'web', e), true);
    assert.match(out(e, 'curl shop.local'), /503/);
    assert.equal(okOf(final, 'ingress', e), false);
    fix(e, 'shop.yaml', 'targetPort: 8080', 'targetPort: 5000');
    run(e, ['kubectl apply -f shop.yaml']);
    assert.match(out(e, 'curl shop.local'), /xem 1 lần/);
    run(e, ['curl shop.local', 'curl shop.local']);
    assert.equal(okOf(final, 'ingress', e), true);

    assert.equal(okOf(final, 'resilience', e), false);
    run(e, ['kubectl delete pod redis-0']);
    e.advance(8000);
    assert.match(out(e, 'curl shop.local'), /xem 4 lần/);
    assert.equal(okOf(final, 'resilience', e), true);

    e.advance(20000);
    assert.match(out(e, 'kubectl get hpa'), /<unknown>/);
    assert.equal(okOf(final, 'hpa', e), false);
    run(e, ['kubectl set resources deployment web --requests=cpu=100m']);
    e.advance(30000);
    assert.equal(okOf(final, 'hpa', e), true);
});

test('bài giai đoạn 3: đủ lab và câu hỏi, đáp án hợp lệ', () => {
    [stateful, helmL, ml, final].forEach((l) => {
        assert.equal(l.course, 'devops');
        assert.ok(l.labs.length >= 4, l.id);
        assert.ok(l.quiz.length >= 6, l.id);
        l.quiz.forEach((q) => assert.ok(q.answer >= 0 && q.answer < q.options.length, q.q));
    });
});
