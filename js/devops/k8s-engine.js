/*
 * k8s-engine.js — Bộ mô phỏng cluster Kubernetes (kind, 1 control-plane + 2 worker) chạy trên trình duyệt.
 * Mục đích: người học gõ kubectl như thật và thấy controller tự hồi phục Pod, rolling update, Service cân bằng tải,
 * ConfigMap/Secret, probe, Ingress, HPA... Trạng thái Pod được TÍNH TỪ THỜI GIAN (tạo lúc nào, crash bao nhiêu lần)
 * nên kết quả lặp lại được trong kiểm thử. Không đụng DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./shell.js'), require('./docker-registry.js'), require('./yaml-lite.js'), require('./helm.js'));
  else { const ns = (root.DevOpsSim = root.DevOpsSim || {}); ns.createKube = factory(ns.shell, ns.registry, ns.yaml, ns.helm).createKube; }
})(typeof self !== 'undefined' ? self : this, function (SH, REG, YAML, HELM) {
  'use strict';

  const ALPHA = 'bcdfghjklmnpqrstvwxz2456789';
  const KINDS = {
    pod: 'Pod', pods: 'Pod', po: 'Pod', deployment: 'Deployment', deployments: 'Deployment', deploy: 'Deployment', replicaset: 'ReplicaSet', replicasets: 'ReplicaSet', rs: 'ReplicaSet', service: 'Service', services: 'Service', svc: 'Service', configmap: 'ConfigMap', configmaps: 'ConfigMap', cm: 'ConfigMap', secret: 'Secret', secrets: 'Secret', ingress: 'Ingress', ingresses: 'Ingress', ing: 'Ingress', hpa: 'HorizontalPodAutoscaler', horizontalpodautoscaler: 'HorizontalPodAutoscaler', horizontalpodautoscalers: 'HorizontalPodAutoscaler', node: 'Node', nodes: 'Node', no: 'Node', namespace: 'Namespace', namespaces: 'Namespace', ns: 'Namespace', event: 'Event', events: 'Event', ev: 'Event', endpoints: 'Endpoints', ep: 'Endpoints',
    statefulset: 'StatefulSet', statefulsets: 'StatefulSet', sts: 'StatefulSet', job: 'Job', jobs: 'Job', persistentvolumeclaim: 'PersistentVolumeClaim', persistentvolumeclaims: 'PersistentVolumeClaim', pvc: 'PersistentVolumeClaim', persistentvolume: 'PersistentVolume', persistentvolumes: 'PersistentVolume', pv: 'PersistentVolume', storageclass: 'StorageClass', storageclasses: 'StorageClass', sc: 'StorageClass',
    serviceaccount: 'ServiceAccount', serviceaccounts: 'ServiceAccount', sa: 'ServiceAccount', role: 'Role', roles: 'Role', rolebinding: 'RoleBinding', rolebindings: 'RoleBinding', clusterrole: 'ClusterRole', clusterroles: 'ClusterRole', clusterrolebinding: 'ClusterRoleBinding', clusterrolebindings: 'ClusterRoleBinding'
  };
  const RBAC = 'rbac.authorization.k8s.io/v1';
  const API = { Pod: ['v1'], Service: ['v1'], ConfigMap: ['v1'], Secret: ['v1'], Namespace: ['v1'], Deployment: ['apps/v1'], ReplicaSet: ['apps/v1'], Ingress: ['networking.k8s.io/v1'], HorizontalPodAutoscaler: ['autoscaling/v2', 'autoscaling/v1'], StatefulSet: ['apps/v1'], Job: ['batch/v1'], PersistentVolumeClaim: ['v1'], PersistentVolume: ['v1'], StorageClass: ['storage.k8s.io/v1'], ServiceAccount: ['v1'], Role: [RBAC], RoleBinding: [RBAC], ClusterRole: [RBAC], ClusterRoleBinding: [RBAC] };
  const GROUP = { Pod: '', Service: '', ConfigMap: '', Secret: '', Namespace: '', Node: '', Endpoints: '', Deployment: '.apps', ReplicaSet: '.apps', Ingress: '.networking.k8s.io', HorizontalPodAutoscaler: '.autoscaling', StatefulSet: '.apps', Job: '.batch', PersistentVolumeClaim: '', PersistentVolume: '', StorageClass: '.storage.k8s.io', ServiceAccount: '', Role: '.rbac.authorization.k8s.io', RoleBinding: '.rbac.authorization.k8s.io', ClusterRole: '.rbac.authorization.k8s.io', ClusterRoleBinding: '.rbac.authorization.k8s.io' };
  const PLURAL = { Pod: 'pods', Service: 'services', ConfigMap: 'configmaps', Secret: 'secrets', Namespace: 'namespaces', Node: 'nodes', Deployment: 'deployments.apps', ReplicaSet: 'replicasets.apps', Ingress: 'ingresses.networking.k8s.io', HorizontalPodAutoscaler: 'horizontalpodautoscalers.autoscaling', Endpoints: 'endpoints', StatefulSet: 'statefulsets.apps', Job: 'jobs.batch', PersistentVolumeClaim: 'persistentvolumeclaims', PersistentVolume: 'persistentvolumes', StorageClass: 'storageclasses.storage.k8s.io', ServiceAccount: 'serviceaccounts', Role: 'roles.rbac.authorization.k8s.io', RoleBinding: 'rolebindings.rbac.authorization.k8s.io', ClusterRole: 'clusterroles.rbac.authorization.k8s.io', ClusterRoleBinding: 'clusterrolebindings.rbac.authorization.k8s.io' };
  const typeName = (k) => k.toLowerCase() + GROUP[k];
  const namespaced = (k) => !['Node', 'Namespace', 'PersistentVolume', 'StorageClass', 'ClusterRole', 'ClusterRoleBinding'].includes(k);
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => ((o[key] = x[key]), o), {}) : x));
  const VERBS = ['get', 'describe', 'run', 'create', 'apply', 'delete', 'logs', 'exec', 'expose', 'scale', 'set', 'rollout', 'autoscale', 'port-forward', 'top', 'label', 'annotate', 'config', 'cluster-info', 'version', 'api-resources', 'explain', 'edit', 'auth', 'wait'];
  const ACCESS = { ReadWriteOnce: 'RWO', ReadOnlyMany: 'ROX', ReadWriteMany: 'RWX', ReadWriteOncePod: 'RWOP' };

  // ---------- Lược đồ trường hợp lệ (để báo "unknown field" giống kubectl strict decoding) ----------
  const ANY = 1;
  const PROBE = { httpGet: { path: ANY, port: ANY, scheme: ANY, httpHeaders: ANY }, tcpSocket: { port: ANY }, exec: { command: ANY }, grpc: ANY, initialDelaySeconds: ANY, periodSeconds: ANY, timeoutSeconds: ANY, failureThreshold: ANY, successThreshold: ANY };
  const CTR = { name: ANY, image: ANY, imagePullPolicy: ANY, command: ANY, args: ANY, workingDir: ANY, ports: [{ containerPort: ANY, name: ANY, protocol: ANY, hostPort: ANY }], env: [{ name: ANY, value: ANY, valueFrom: { configMapKeyRef: { name: ANY, key: ANY, optional: ANY }, secretKeyRef: { name: ANY, key: ANY, optional: ANY }, fieldRef: { fieldPath: ANY }, resourceFieldRef: ANY } }], envFrom: [{ configMapRef: { name: ANY, optional: ANY }, secretRef: { name: ANY, optional: ANY }, prefix: ANY }], resources: { requests: { cpu: ANY, memory: ANY }, limits: { cpu: ANY, memory: ANY } }, readinessProbe: PROBE, livenessProbe: PROBE, startupProbe: PROBE, volumeMounts: [{ name: ANY, mountPath: ANY, readOnly: ANY, subPath: ANY }], securityContext: ANY, lifecycle: ANY, stdin: ANY, tty: ANY };
  const META = { name: ANY, namespace: ANY, labels: ANY, annotations: ANY, generateName: ANY };
  const PODSPEC = { containers: [CTR], initContainers: [CTR], volumes: [{ name: ANY, configMap: { name: ANY, items: ANY, defaultMode: ANY }, secret: { secretName: ANY, items: ANY, defaultMode: ANY }, emptyDir: ANY, persistentVolumeClaim: { claimName: ANY, readOnly: ANY }, hostPath: ANY }], restartPolicy: ANY, nodeSelector: ANY, nodeName: ANY, serviceAccountName: ANY, serviceAccount: ANY, automountServiceAccountToken: ANY, terminationGracePeriodSeconds: ANY, affinity: ANY, tolerations: ANY, securityContext: ANY, imagePullSecrets: ANY, hostname: ANY, subdomain: ANY, dnsPolicy: ANY };
  const PVCSPEC = { accessModes: ANY, resources: { requests: { storage: ANY }, limits: ANY }, storageClassName: ANY, volumeMode: ANY, volumeName: ANY, selector: ANY };
  const RULES = [{ apiGroups: ANY, resources: ANY, verbs: ANY, resourceNames: ANY, nonResourceURLs: ANY }];
  const BINDING = { apiVersion: ANY, kind: ANY, metadata: META, roleRef: { apiGroup: ANY, kind: ANY, name: ANY }, subjects: [{ kind: ANY, name: ANY, namespace: ANY, apiGroup: ANY }] };
  const SCHEMA = {
    Pod: { apiVersion: ANY, kind: ANY, metadata: META, spec: PODSPEC },
    Deployment: { apiVersion: ANY, kind: ANY, metadata: META, spec: { replicas: ANY, selector: { matchLabels: ANY, matchExpressions: ANY }, template: { metadata: META, spec: PODSPEC }, strategy: ANY, revisionHistoryLimit: ANY, minReadySeconds: ANY, progressDeadlineSeconds: ANY, paused: ANY } },
    Service: { apiVersion: ANY, kind: ANY, metadata: META, spec: { type: ANY, selector: ANY, ports: [{ port: ANY, targetPort: ANY, nodePort: ANY, protocol: ANY, name: ANY }], clusterIP: ANY, sessionAffinity: ANY, externalTrafficPolicy: ANY } },
    ConfigMap: { apiVersion: ANY, kind: ANY, metadata: META, data: ANY, binaryData: ANY, immutable: ANY },
    Secret: { apiVersion: ANY, kind: ANY, metadata: META, data: ANY, stringData: ANY, type: ANY, immutable: ANY },
    Namespace: { apiVersion: ANY, kind: ANY, metadata: META, spec: ANY },
    Ingress: { apiVersion: ANY, kind: ANY, metadata: META, spec: { ingressClassName: ANY, defaultBackend: ANY, tls: ANY, rules: [{ host: ANY, http: { paths: [{ path: ANY, pathType: ANY, backend: { service: { name: ANY, port: { number: ANY, name: ANY } } } }] } }] } },
    HorizontalPodAutoscaler: { apiVersion: ANY, kind: ANY, metadata: META, spec: { scaleTargetRef: { apiVersion: ANY, kind: ANY, name: ANY }, minReplicas: ANY, maxReplicas: ANY, targetCPUUtilizationPercentage: ANY, metrics: ANY, behavior: ANY } },
    StatefulSet: { apiVersion: ANY, kind: ANY, metadata: META, spec: { replicas: ANY, selector: { matchLabels: ANY, matchExpressions: ANY }, serviceName: ANY, template: { metadata: META, spec: PODSPEC }, volumeClaimTemplates: [{ apiVersion: ANY, kind: ANY, metadata: META, spec: PVCSPEC }], podManagementPolicy: ANY, updateStrategy: ANY, persistentVolumeClaimRetentionPolicy: ANY, minReadySeconds: ANY, revisionHistoryLimit: ANY, ordinals: ANY } },
    Job: { apiVersion: ANY, kind: ANY, metadata: META, spec: { template: { metadata: META, spec: PODSPEC }, backoffLimit: ANY, completions: ANY, parallelism: ANY, activeDeadlineSeconds: ANY, ttlSecondsAfterFinished: ANY, selector: ANY, manualSelector: ANY, completionMode: ANY, suspend: ANY, podFailurePolicy: ANY } },
    PersistentVolumeClaim: { apiVersion: ANY, kind: ANY, metadata: META, spec: PVCSPEC },
    PersistentVolume: { apiVersion: ANY, kind: ANY, metadata: META, spec: ANY },
    StorageClass: { apiVersion: ANY, kind: ANY, metadata: META, provisioner: ANY, reclaimPolicy: ANY, volumeBindingMode: ANY, allowVolumeExpansion: ANY, parameters: ANY, mountOptions: ANY },
    ServiceAccount: { apiVersion: ANY, kind: ANY, metadata: META, secrets: ANY, imagePullSecrets: ANY, automountServiceAccountToken: ANY },
    Role: { apiVersion: ANY, kind: ANY, metadata: META, rules: RULES },
    ClusterRole: { apiVersion: ANY, kind: ANY, metadata: META, rules: RULES, aggregationRule: ANY },
    RoleBinding: BINDING,
    ClusterRoleBinding: BINDING,
  };
  SCHEMA.Service.spec.publishNotReadyAddresses = ANY;
  function unknownField(v, sch, path) {
    if (sch === ANY || v === null || typeof v !== 'object') return null;
    if (Array.isArray(sch)) { if (!Array.isArray(v)) return null; for (let i = 0; i < v.length; i++) { const r = unknownField(v[i], sch[0], `${path}[${i}]`); if (r) return r; } return null; }
    if (Array.isArray(v)) return null;
    for (const k of Object.keys(v)) {
      if (!(k in sch)) return path ? `${path}.${k}` : k;
      const r = unknownField(v[k], sch[k], path ? `${path}.${k}` : k);
      if (r) return r;
    }
    return null;
  }

  // ---------- Tiện ích ----------
  function qty(s) {
    if (s === undefined || s === null || s === '') return null;
    const m = String(s).match(/^([\d.]+)(m|Ki|Mi|Gi|K|M|G)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return { m: n / 1000, Ki: n * 1024, Mi: n * 1048576, Gi: n * 1073741824, K: n * 1e3, M: n * 1e6, G: n * 1e9 }[m[2]] ?? n;
  }
  function age(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 120) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 10) return `${m}m${s % 60 ? (s % 60) + 's' : ''}`;
    if (m < 180) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 8) return `${h}h${m % 60 ? (m % 60) + 'm' : ''}`;
    if (h < 48) return h + 'h';
    const d = Math.floor(h / 24);
    return d < 8 && h % 24 ? `${d}d${h % 24}h` : d + 'd';
  }
  const b64 = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s).toString('base64'));
  const unb64 = (s) => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 === 1) { const i = [...s].findIndex((c) => !/[A-Za-z0-9+/=]/.test(c)); throw new Error(`illegal base64 data at input byte ${i < 0 ? s.length : i}`); } return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString(); };
  function parseSelector(str) {
    return String(str).split(',').filter(Boolean).map((x) => {
      let m = x.match(/^([\w./-]+)\s*!=\s*(.*)$/); if (m) return { k: m[1], op: '!=', v: m[2] };
      m = x.match(/^([\w./-]+)\s*==?\s*(.*)$/); if (m) return { k: m[1], op: '=', v: m[2] };
      return { k: x.replace(/^!/, ''), op: x.startsWith('!') ? '!' : 'exists' };
    });
  }
  const matchSel = (labels, sel) => sel.every((r) => (r.op === '=' ? labels[r.k] === r.v : r.op === '!=' ? labels[r.k] !== r.v : r.op === '!' ? !(r.k in labels) : r.k in labels));
  const matchLabels = (labels, ml) => !!ml && Object.keys(ml).length > 0 && Object.entries(ml).every(([k, v]) => (labels || {})[k] === String(v));
  const fmtLabels = (l) => (l && Object.keys(l).length ? Object.entries(l).map(([k, v]) => `${k}=${v}`).join(',') : '<none>');
  const goMap = (o) => 'map[string]string{' + Object.entries(o || {}).map(([k, v]) => `"${k}":"${v}"`).join(', ') + '}';
  const NGINX_PAGE = REG.NGINX_HTML;

  // Xuất YAML theo phong cách kubectl (mảng thẳng cột với khóa cha)
  function toYaml(v, indent = 0) {
    const pad = ' '.repeat(indent), out = [];
    const sc = (x) => {
      if (x === null || x === undefined) return 'null';
      if (typeof x === 'string') return x !== '' && /^[\w./:@-][\w ./:@=-]*$/.test(x) && !/^(true|false|null|yes|no|on|off|[\d.]+)$/i.test(x) && !/: /.test(x) ? x : JSON.stringify(x);
      return String(x);
    };
    const isObj = (x) => x && typeof x === 'object';
    if (Array.isArray(v)) {
      v.forEach((it) => {
        if (isObj(it) && !Array.isArray(it) && Object.keys(it).length) { const sub = toYaml(it, indent + 2); out.push(pad + '- ' + sub[0].trimStart()); out.push(...sub.slice(1)); }
        else out.push(pad + '- ' + (isObj(it) ? '{}' : sc(it)));
      });
      return out;
    }
    Object.keys(v).forEach((k) => {
      const x = v[k];
      if (x === undefined) return;
      const key = /^[\w./-]+$/.test(k) ? k : JSON.stringify(k);
      if (typeof x === 'string' && x.includes('\n')) { out.push(`${pad}${key}: |`); x.replace(/\n$/, '').split('\n').forEach((l) => out.push(pad + '  ' + l)); }
      else if (isObj(x) && (Array.isArray(x) ? x.length : Object.keys(x).length)) { out.push(`${pad}${key}:`); out.push(...toYaml(x, Array.isArray(x) ? indent : indent + 2)); }
      else if (isObj(x)) out.push(`${pad}${key}: ${Array.isArray(x) ? '[]' : '{}'}`);
      else out.push(`${pad}${key}: ${sc(x)}`);
    });
    return out;
  }

  // Ảnh có sẵn trong cluster mô phỏng; vlab/web là app web nhỏ trả về tên Pod để thấy cân bằng tải
  function imgInfo(ref) {
    const r = String(ref || '');
    let repo = r, tag = 'latest';
    const c = r.lastIndexOf(':');
    if (c > r.lastIndexOf('/')) { repo = r.slice(0, c); tag = r.slice(c + 1); }
    repo = repo.replace(/^docker\.io\//, '').replace(/^library\//, '');
    if (repo === 'vlab/web') {
      const T = { '1.0': 'v1', '2.0': 'v2', latest: 'v2', broken: 'broken' };
      return T[tag] ? { kind: 'web', ver: T[tag], ref: `${repo}:${tag}`, repo, tag } : null;
    }
    if (repo === 'vlab/model') { const V = { '1.0': 'v1', '2.0': 'v2', latest: 'v2' }; return V[tag] ? { kind: 'model', ver: V[tag], ref: `${repo}:${tag}`, repo, tag } : null; }
    if (repo === 'vlab/trainer') return tag === '1.0' || tag === 'latest' ? { kind: 'trainer', ver: 'v1', ref: `${repo}:${tag}`, repo, tag } : null;
    const res = REG.resolve(r);
    if (res.error) return null;
    return { kind: res.def.kind, ref: `${res.repo}:${res.tag}`, repo: res.repo, tag: res.tag, version: res.def.version };
  }
  const fullImage = (ref) => { const i = imgInfo(ref); const r = i ? i.ref : ref; return 'docker.io/' + (r.includes('/') ? r : 'library/' + r) + (/:[^/]*$/.test(r) ? '' : ':latest'); };

  // ======================================================================
  function createKube(opts = {}) {
    const realNow = opts.now || (() => Date.now());
    let skew = 0; // thời gian "nhảy" khi lệnh cần chờ (rollout status) — mô phỏng việc đợi
    const T = () => realNow() + skew;
    const rand = SH.rng(opts.seed || 1);
    const initialFiles = Object.assign({}, opts.files || {});
    let files = Object.assign({}, initialFiles);
    const listeners = {};
    const on = (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); return () => off(e, fn); };
    const off = (e, fn) => { listeners[e] = (listeners[e] || []).filter((f) => f !== fn); };
    const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

    const state = { objs: [], events: [], history: [], requests: [], forwards: [], ns: 'default', releases: [], repos: {} };
    let OUT = [], CLEAR = false, cur = {}, session = null;
    const p = (text, cls = '') => String(text).split('\n').forEach((t) => OUT.push({ text: t, cls }));
    const err = (t) => p(t, 'err');
    const hint = (t) => p('💡 ' + t, 'hint');
    let uidN = 0, ipN = 10, svcN = 20, npN = 30080;
    const uid = () => SH.hash64('uid' + uidN++).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5');
    const rnd = (n) => Array.from({ length: n }, () => ALPHA[Math.floor(rand() * ALPHA.length)]).join('');

    // ---------- Kho đối tượng ----------
    const get = (kind, name, ns = state.ns) => state.objs.find((o) => o.kind === kind && o.metadata.name === name && (!namespaced(kind) || o.metadata.namespace === ns));
    const list = (kind, ns = state.ns) => state.objs.filter((o) => o.kind === kind && (ns === null || !namespaced(kind) || o.metadata.namespace === ns));
    function add(kind, meta, body) {
      const o = Object.assign({ kind, apiVersion: (API[kind] || ['v1'])[0], metadata: Object.assign({ namespace: namespaced(kind) ? state.ns : undefined, labels: {}, annotations: {}, uid: uid(), created: T(), generation: 1 }, meta), sim: {} }, body);
      if (!namespaced(kind)) delete o.metadata.namespace;
      state.objs.push(o);
      return o;
    }
    const removeObj = (o) => { const i = state.objs.indexOf(o); if (i >= 0) state.objs.splice(i, 1); };
    const event = (o, type, reason, msg, from) => state.events.push({ t: T(), type, reason, msg, from, kind: o.kind, name: o.metadata.name, ns: o.metadata.namespace });

    // ---------- Khởi tạo cluster kind ----------
    const t0 = T() - 3 * 86400000;
    const NODES = [{ name: 'lab-control-plane', role: 'control-plane', ip: '172.18.0.2' }, { name: 'lab-worker', role: '<none>', ip: '172.18.0.3' }, { name: 'lab-worker2', role: '<none>', ip: '172.18.0.4' }];
    NODES.forEach((n, i) => add('Node', { name: n.name, created: t0, labels: { 'kubernetes.io/hostname': n.name } }, { spec: {}, sim: { role: n.role, ip: n.ip, idx: i } }));
    ['default', 'kube-system', 'kube-public', 'kube-node-lease', 'ingress-nginx'].forEach((n) => add('Namespace', { name: n, created: t0 }, { spec: {} }));
    // Mỗi namespace có sẵn ServiceAccount "default" (do controller tạo, giống cluster thật)
    const nsDefaults = (n, at = T()) => { if (!get('ServiceAccount', 'default', n)) add('ServiceAccount', { name: 'default', namespace: n, created: at }, {}); };
    list('Namespace').forEach((n) => nsDefaults(n.metadata.name, t0));
    // kind dùng local-path-provisioner: ổ đĩa nằm trên một node, chỉ cấp khi có Pod đầu tiên dùng (WaitForFirstConsumer)
    add('StorageClass', { name: 'standard', created: t0, annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } }, { provisioner: 'rancher.io/local-path', reclaimPolicy: 'Delete', volumeBindingMode: 'WaitForFirstConsumer', allowVolumeExpansion: false });
    const ALLRES = ['pods', 'services', 'endpoints', 'configmaps', 'persistentvolumeclaims', 'serviceaccounts', 'deployments', 'replicasets', 'statefulsets', 'jobs', 'ingresses', 'horizontalpodautoscalers'];
    const GROUPS = ['', 'apps', 'batch', 'networking.k8s.io', 'autoscaling'];
    [['cluster-admin', [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }]],
    ['admin', [{ apiGroups: GROUPS, resources: [...ALLRES, 'secrets', 'pods/log', 'pods/exec', 'pods/portforward', 'deployments/scale', 'statefulsets/scale'], verbs: ['*'] }, { apiGroups: ['rbac.authorization.k8s.io'], resources: ['roles', 'rolebindings'], verbs: ['*'] }]],
    ['edit', [{ apiGroups: GROUPS, resources: [...ALLRES, 'secrets', 'pods/log', 'pods/exec', 'pods/portforward', 'deployments/scale', 'statefulsets/scale'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] }]],
    ['view', [{ apiGroups: GROUPS, resources: [...ALLRES, 'pods/log'], verbs: ['get', 'list', 'watch'] }]],
    ].forEach(([name, rules]) => add('ClusterRole', { name, created: t0, labels: { 'kubernetes.io/bootstrapping': 'rbac-defaults' } }, { rules }));
    add('ClusterRoleBinding', { name: 'cluster-admin', created: t0 }, { roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' }, subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'Group', name: 'system:masters' }] });
    add('Service', { name: 'kubernetes', namespace: 'default', created: t0, labels: { component: 'apiserver' } }, { spec: { type: 'ClusterIP', clusterIP: '10.96.0.1', ports: [{ port: 443, targetPort: 6443, protocol: 'TCP', name: 'https' }] } });
    const sysPod = (name, ns, node, image) => add('Pod', { name, namespace: ns, created: t0 }, { spec: { containers: [{ name: name.split('-')[0], image }], nodeName: node }, sim: { system: true, node, ip: node === 'lab-control-plane' ? '172.18.0.2' : '10.244.0.' + ipN++ } });
    [['coredns-7c65d6cfc9-x4kzq', 'lab-control-plane'], ['coredns-7c65d6cfc9-r8p2m', 'lab-control-plane'], ['etcd-lab-control-plane', 'lab-control-plane'], ['kube-apiserver-lab-control-plane', 'lab-control-plane'], ['kube-controller-manager-lab-control-plane', 'lab-control-plane'], ['kube-scheduler-lab-control-plane', 'lab-control-plane'], ['kube-proxy-9wq4d', 'lab-control-plane'], ['kube-proxy-tl2zv', 'lab-worker'], ['kube-proxy-hx7nb', 'lab-worker2'], ['metrics-server-5b4fc487-qm8sd', 'lab-worker']].forEach(([n, node]) => sysPod(n, 'kube-system', node, 'registry.k8s.io/' + n.split('-')[0]));
    sysPod('ingress-nginx-controller-6b9f7c8d5-pz4lw', 'ingress-nginx', 'lab-control-plane', 'registry.k8s.io/ingress-nginx/controller:v1.11.2');
    add('Service', { name: 'kube-dns', namespace: 'kube-system', created: t0 }, { spec: { type: 'ClusterIP', clusterIP: '10.96.0.10', ports: [{ port: 53, protocol: 'UDP', name: 'dns' }] } });
    add('Service', { name: 'ingress-nginx-controller', namespace: 'ingress-nginx', created: t0 }, { spec: { type: 'NodePort', clusterIP: '10.96.84.17', ports: [{ port: 80, targetPort: 80, nodePort: 80, protocol: 'TCP', name: 'http' }] } });

    // ---------- Pod: tạo và lập lịch ----------
    function schedule(pin) {
      if (pin) return get('Node', pin);
      const workers = list('Node').filter((n) => n.sim.role !== 'control-plane');
      const count = (n) => list('Pod', null).filter((p) => p.sim.node === n.metadata.name && !p.sim.system).length;
      return workers.sort((a, b) => count(a) - count(b) || a.sim.idx - b.sim.idx)[0];
    }
    const claimsOf = (spec) => (spec.volumes || []).filter((v) => v.persistentVolumeClaim).map((v) => v.persistentVolumeClaim.claimName);
    function createPod(tpl, ns, owner, name, extra) {
      const spec = clone(tpl.spec);
      if (extra) extra(spec);
      // Ổ đĩa local-path gắn với một node: Pod dùng PVC đã cấp phải chạy đúng node đó
      const pinned = claimsOf(spec).map((c) => get('PersistentVolumeClaim', c, ns)).find((c) => c && c.sim.node);
      const node = schedule(pinned && pinned.sim.node);
      const pod = add('Pod', { name: name || `${owner.metadata.name}-${rnd(5)}`, namespace: ns, labels: clone((tpl.metadata && tpl.metadata.labels) || {}), annotations: clone((tpl.metadata && tpl.metadata.annotations) || {}) }, { spec });
      if (owner) { pod.metadata.ownerKind = owner.kind; pod.metadata.ownerName = owner.metadata.name; }
      pod.sim = { node: node.metadata.name, ip: `10.244.${node.sim.idx}.${ipN++}`, img: imgInfo(pod.spec.containers[0].image), reqLog: [], data: { files: {}, redis: {} }, vols: {} };
      return pod;
    }
    const live = (p) => !p.sim.deletedAt;
    // kubectl delete thật chờ Pod biến mất rồi mới trả về, nên tạo lại cùng tên ngay sau đó phải thành Pod mới
    const reapPod = (kind, name, ns) => { const o = kind === 'Pod' && get('Pod', name, ns); if (o && o.sim.deletedAt) removeObj(o); };
    const ownedPods = (rs) => list('Pod', rs.metadata.namespace).filter((p) => p.metadata.ownerKind === 'ReplicaSet' && p.metadata.ownerName === rs.metadata.name);

    // ---------- Lưu trữ: PVC (bền vững, nằm trên PV), emptyDir (sống theo Pod), lớp ghi của container ----------
    function mountAt(pod, path) {
      const ms = ((pod.spec.containers[0] || {}).volumeMounts || []).slice().sort((a, b) => b.mountPath.length - a.mountPath.length);
      for (const m of ms) {
        const base = m.mountPath.replace(/\/$/, '');
        if (path === base || path.startsWith(base + '/')) { const vol = (pod.spec.volumes || []).find((v) => v.name === m.name); if (vol) return { m, vol, base }; }
      }
      return null;
    }
    function storeFor(pod, path) {
      const mt = mountAt(pod, path);
      if (mt && mt.vol.persistentVolumeClaim) {
        const pvc = get('PersistentVolumeClaim', mt.vol.persistentVolumeClaim.claimName, pod.metadata.namespace);
        const pv = pvc && pvc.sim.pv && get('PersistentVolume', pvc.sim.pv);
        if (pv) return { store: pv.sim.data, kind: 'pvc', name: pvc.metadata.name, base: mt.base };
      }
      if (mt && mt.vol.emptyDir) { pod.sim.vols[mt.m.name] = pod.sim.vols[mt.m.name] || { files: {}, redis: {} }; return { store: pod.sim.vols[mt.m.name], kind: 'emptyDir', base: mt.base }; }
      if (mt && (mt.vol.configMap || mt.vol.secret)) return { store: null, kind: 'ro', base: mt.base };
      return { store: pod.sim.data, kind: 'container' };
    }
    const redisStore = (pod) => (storeFor(pod, '/data').store || pod.sim.data).redis;
    const fileExists = (pod, path) => { const s = storeFor(pod, path).store; return !!(s && s.files[path] !== undefined); };
    const readFile = (pod, path) => { const s = storeFor(pod, path).store; return s ? s.files[path] : undefined; };

    // ---------- Pod: hành vi theo image + lệnh ----------
    function behaviour(pod) {
      const ctr = pod.spec.containers[0], info = pod.sim.img, env = pod.sim.env || {};
      const cmd = [...(ctr.command || []), ...(ctr.args || [])].join(' ');
      let b;
      switch (info.kind) {
        case 'nginx': b = { mode: 'serve', port: 80, paths: ['/', '/index.html'], mem: 9, ready: 1, shell: 'bash' }; break;
        case 'web': b = info.ver === 'broken' ? { mode: 'crash', code: 2, reason: 'Error', run: 2, logs: ['vlab/web v3 starting...', 'panic: runtime error: invalid memory address or nil pointer dereference', '[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x6b2c1f]'], shell: 'sh' } : { mode: 'serve', port: 8080, paths: ['/', '/healthz', '/version'], mem: 90, ready: 3, shell: 'sh' }; break;
        case 'model':
          // Model v2 đọc file do Job huấn luyện ghi vào PVC; thiếu file thì tiến trình thoát ngay
          if (info.ver === 'v2' && !fileExists(pod, '/models/model.pkl')) b = { mode: 'crash', code: 1, reason: 'Error', run: 2, shell: 'sh', recheck: '/models/model.pkl', logs: ['model-server v2 starting...', 'Loading model from /models/model.pkl', "FileNotFoundError: [Errno 2] No such file or directory: '/models/model.pkl'"] };
          else b = { mode: 'serve', port: 8000, paths: ['/', '/healthz', '/predict'], mem: 300, ready: 15, shell: 'sh' };
          break;
        case 'trainer': {
          // Gradient descent thu nhỏ: learning rate quá lớn → loss phân kỳ (giống bài Gradient Descent của khóa AI)
          const lr = parseFloat(env.LEARNING_RATE === undefined ? '0.05' : env.LEARNING_RATE), ep = Math.max(1, Math.min(30, parseInt(env.EPOCHS || '5', 10) || 5));
          const outPath = env.MODEL_PATH || '/models/model.pkl';
          const logs = ['Loading dataset iris.csv: 150 rows, 4 features, 3 classes', `Training logistic regression: epochs=${ep} learning_rate=${env.LEARNING_RATE === undefined ? '0.05' : env.LEARNING_RATE}`];
          let loss = 1.0986, bad = !(lr > 0);
          for (let e = 1; e <= ep && !bad; e++) {
            loss = lr > 1 ? loss * (1 + lr) * 3 : 0.06 + (loss - 0.06) * Math.exp(-lr * 9);
            if (!isFinite(loss) || loss > 1e4) { logs.push(`epoch ${e}/${ep}  loss=nan`); bad = true; break; }
            logs.push(`epoch ${e}/${ep}  loss=${loss.toFixed(4)}  accuracy=${Math.max(0.33, Math.min(0.98, 1 - loss / 1.3)).toFixed(3)}`);
          }
          const acc = Math.max(0.33, Math.min(0.98, 1 - loss / 1.3));
          if (bad) b = { mode: 'crash', code: 1, reason: 'Error', run: 3, shell: 'sh', logs: [...logs, 'ValueError: loss is NaN — training diverged (learning rate too high?)'] };
          else b = { mode: 'complete', run: 2 + ep * 0.8, shell: 'sh', logs: [...logs, `Saved model to ${outPath} (accuracy=${acc.toFixed(3)})`], save: { path: outPath, content: JSON.stringify({ model: 'iris-logreg', version: 'v2', accuracy: +acc.toFixed(3), learning_rate: lr, epochs: ep }) } };
          break;
        }
        case 'redis': b = { mode: 'serve', port: 6379, tcp: true, paths: [], mem: 4, ready: 1, shell: 'bash' }; break;
        case 'counter': b = { mode: 'serve', port: 5000, paths: ['/', '/healthz'], mem: 40, ready: 2, shell: 'bash' }; break;
        case 'postgres': b = env.POSTGRES_PASSWORD ? { mode: 'serve', port: 5432, tcp: true, paths: [], mem: 30, ready: 3, shell: 'bash' } : { mode: 'crash', code: 1, reason: 'Error', run: 1, shell: 'bash', logs: ['Error: Database is uninitialized and superuser password is not specified.', '       You must specify POSTGRES_PASSWORD to a non-empty value for the', '       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".'] }; break;
        case 'hello': b = { mode: 'complete', logs: ['', 'Hello from Docker!', 'This message shows that your installation appears to be working correctly.'], shell: null }; break;
        default: {
          const shell = info.kind === 'shell' ? 'sh' : 'bash';
          if (/while\s+true|sleep\s+(infinity|\d{3,})|tail\s+-f/.test(cmd) || (/^(sh|\/bin\/sh|bash)$/.test(cmd.trim()) && ctr.stdin)) {
            const lm = cmd.match(/(?:wget|curl)\s+(?:-\S+\s+)*(?:https?:\/\/)?([\w.-]+)(?::(\d+))?/);
            b = { mode: 'sleep', mem: 1, shell, load: lm ? { host: lm[1], port: lm[2] ? +lm[2] : 80 } : null };
          } else {
            const echo = [...cmd.matchAll(/echo\s+(["']?)(.*?)\1(?:;|&&|$)/g)].map((m) => m[2]);
            b = { mode: 'complete', logs: echo, shell, run: /sleep\s+(\d+)/.test(cmd) ? +cmd.match(/sleep\s+(\d+)/)[1] : 0.5 };
          }
        }
      }
      // Vượt giới hạn bộ nhớ → kernel giết tiến trình (OOMKilled)
      const lim = qty(ctr.resources && ctr.resources.limits && ctr.resources.limits.memory);
      if (b.mode === 'serve' && lim && lim < b.mem * 1048576) Object.assign(b, { mode: 'crash', code: 137, reason: 'OOMKilled', run: 4, logs: ['loading cache into memory...'] });
      return b;
    }
    function probeCheck(pr, b, pod) {
      if (!pr) return { ok: true };
      const ctr = pod.spec.containers[0];
      const named = (port) => (typeof port === 'string' ? ((ctr.ports || []).find((x) => x.name === port) || {}).containerPort : port);
      if (pr.httpGet) {
        const port = named(pr.httpGet.port), path = pr.httpGet.path || '/';
        if (+port !== b.port) return { ok: false, msg: `Get "http://${pod.sim.ip}:${port}${path}": dial tcp ${pod.sim.ip}:${port}: connect: connection refused` };
        if (b.tcp) return { ok: false, msg: `Get "http://${pod.sim.ip}:${port}${path}": net/http: HTTP/1.x transport connection broken: malformed HTTP response` };
        if (!b.paths.includes(path)) return { ok: false, msg: 'HTTP probe failed with statuscode: 404' };
        return { ok: true };
      }
      if (pr.tcpSocket) return +named(pr.tcpSocket.port) === b.port ? { ok: true } : { ok: false, msg: `dial tcp ${pod.sim.ip}:${named(pr.tcpSocket.port)}: connect: connection refused` };
      return { ok: true };
    }
    // Biến môi trường được "chụp" lúc container khởi động: đổi ConfigMap sau đó không ảnh hưởng Pod đang chạy
    function resolveEnv(pod) {
      const ctr = pod.spec.containers[0], ns = pod.metadata.namespace, env = {};
      for (const ef of ctr.envFrom || []) {
        if (ef.configMapRef) { const cm = get('ConfigMap', ef.configMapRef.name, ns); if (!cm) { if (ef.configMapRef.optional) continue; return { error: `configmap "${ef.configMapRef.name}" not found` }; } Object.entries(cm.data || {}).forEach(([k, v]) => (env[(ef.prefix || '') + k] = String(v))); }
        if (ef.secretRef) { const s = get('Secret', ef.secretRef.name, ns); if (!s) { if (ef.secretRef.optional) continue; return { error: `secret "${ef.secretRef.name}" not found` }; } Object.entries(s.data || {}).forEach(([k, v]) => (env[(ef.prefix || '') + k] = unb64(v))); }
      }
      for (const e of ctr.env || []) {
        if (e.valueFrom && e.valueFrom.configMapKeyRef) {
          const r = e.valueFrom.configMapKeyRef, cm = get('ConfigMap', r.name, ns);
          if (!cm) { if (r.optional) continue; return { error: `configmap "${r.name}" not found` }; }
          if (!(cm.data || {}).hasOwnProperty(r.key)) { if (r.optional) continue; return { error: `couldn't find key ${r.key} in ConfigMap ${ns}/${r.name}` }; }
          env[e.name] = String(cm.data[r.key]);
        } else if (e.valueFrom && e.valueFrom.secretKeyRef) {
          const r = e.valueFrom.secretKeyRef, s = get('Secret', r.name, ns);
          if (!s) { if (r.optional) continue; return { error: `secret "${r.name}" not found` }; }
          if (!(s.data || {}).hasOwnProperty(r.key)) { if (r.optional) continue; return { error: `couldn't find key ${r.key} in Secret ${ns}/${r.name}` }; }
          env[e.name] = unb64(s.data[r.key]);
        } else if (e.valueFrom && e.valueFrom.fieldRef) {
          const f = e.valueFrom.fieldRef.fieldPath;
          env[e.name] = f === 'metadata.name' ? pod.metadata.name : f === 'metadata.namespace' ? ns : f === 'status.podIP' ? pod.sim.ip : f === 'spec.nodeName' ? pod.sim.node : '';
        } else env[e.name] = e.value === undefined || e.value === null ? '' : String(e.value);
      }
      return { env };
    }
    function volumeError(pod) {
      for (const v of pod.spec.volumes || []) {
        if (v.configMap && !get('ConfigMap', v.configMap.name, pod.metadata.namespace)) return `MountVolume.SetUp failed for volume "${v.name}" : configmap "${v.configMap.name}" not found`;
        if (v.secret && !get('Secret', v.secret.secretName, pod.metadata.namespace)) return `MountVolume.SetUp failed for volume "${v.name}" : secret "${v.secret.secretName}" not found`;
      }
      return null;
    }
    // Chu kỳ crash → chờ (back-off 10s, 20s, 40s... tối đa 300s) → khởi động lại
    function cycle(start, runFor, t) {
      let s = start, back = 10000, restarts = 0;
      for (let k = 0; k < 500; k++) {
        const crash = s + runFor;
        if (t < crash) return { phase: 'run', restarts, curStart: s, lastCrash: k ? s - back / 2 : null };
        if (t < crash + back) return { phase: t < crash + 1500 ? 'term' : 'backoff', restarts, curStart: s, crashAt: crash, lastCrash: crash };
        restarts++; s = crash + back; back = Math.min(back * 2, 300000);
      }
      return { phase: 'backoff', restarts, curStart: s };
    }

    // Trạng thái Pod tại thời điểm hiện tại (tính hoàn toàn từ dòng thời gian)
    function podView(pod) {
      const t = T(), sim = pod.sim, ctr = pod.spec.containers[0] || {};
      let c = pod.metadata.created;
      const v = { status: 'Pending', ready: false, restarts: 0, running: false, phase: 'Pending', events: [], state: 'Waiting', reason: '', last: null, beh: null, startedAt: null, cpu: 0, mem: 0 };
      const ev = (type, reason, at, msg, from = 'kubelet') => { if (at <= t) v.events.push({ type, reason, at, msg, from }); };
      const done = () => { if (sim.deletedAt) { v.status = 'Terminating'; v.ready = false; } return v; };
      if (sim.system) return Object.assign(v, { status: 'Running', ready: true, running: true, phase: 'Running', state: 'Running', cpu: 0.003, mem: 20 });
      // Pod dùng PVC: scheduler chờ PVC tồn tại và được cấp ổ đĩa (WaitForFirstConsumer → cấp ngay trên node của Pod)
      const claims = claimsOf(pod.spec);
      if (claims.length && !sim.pvcOk) {
        const objs = claims.map((n) => ({ n, o: get('PersistentVolumeClaim', n, pod.metadata.namespace) }));
        objs.forEach((x) => { if (x.o && !x.o.sim.pv && !x.o.sim.deleting) bindPVC(x.o, sim.node); });
        const bad = objs.find((x) => !x.o || !x.o.sim.pv);
        if (bad) {
          sim.pvcWait = true;
          ev('Warning', 'FailedScheduling', c, `0/3 nodes are available: ${!bad.o ? `persistentvolumeclaim "${bad.n}" not found` : 'pod has unbound immediate PersistentVolumeClaims'}. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.`, 'default-scheduler');
          return done();
        }
        sim.pvcOk = sim.pvcWait ? t : c;
        const pin = objs.find((x) => x.o.sim.node);
        if (pin) sim.node = pin.o.sim.node;
      }
      if (sim.pvcOk) c = Math.max(c, sim.pvcOk);
      ev('Normal', 'Scheduled', c, `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${sim.node}`, 'default-scheduler');
      const vErr = volumeError(pod);
      if (vErr && !sim.envOk) { sim.cfgErr = true; v.status = 'ContainerCreating'; v.reason = 'ContainerCreating'; ev('Warning', 'FailedMount', c + 1000, vErr); return done(); }
      const image = ctr.image;
      ev('Normal', 'Pulling', c + 300, `Pulling image "${image}"`);
      if (!sim.img) {
        const el = t - c;
        if (el < 2000) { v.status = 'ContainerCreating'; return done(); }
        const k = Math.floor((el - 2000) / 10000) % 2;
        v.status = k === 0 ? 'ErrImagePull' : 'ImagePullBackOff'; v.reason = v.status;
        ev('Warning', 'Failed', c + 2000, `Failed to pull image "${image}": rpc error: code = NotFound desc = failed to pull and unpack image "${fullImage(image)}": failed to resolve reference "${fullImage(image)}": ${fullImage(image).replace('docker.io/', 'docker.io/')}: not found`);
        ev('Warning', 'Failed', c + 2000, 'Error: ErrImagePull');
        ev('Normal', 'BackOff', c + 12000, `Back-off pulling image "${image}"`);
        ev('Warning', 'Failed', c + 12000, 'Error: ImagePullBackOff');
        return done();
      }
      if (t - c < 2000) { v.status = 'ContainerCreating'; return done(); }
      ev('Normal', 'Pulled', c + 1800, `Successfully pulled image "${image}" in 1.4s (1.4s including waiting). Image size: 72187413 bytes.`);
      if (!sim.envOk) {
        const r = resolveEnv(pod);
        if (r.error) { sim.cfgErr = true; v.status = 'CreateContainerConfigError'; v.reason = v.status; ev('Warning', 'Failed', c + 2000, 'Error: ' + r.error); return done(); }
        // Trạng thái tính lười: nếu chưa từng lỗi thì container đã chạy từ lúc tạo+2s,
        // còn nếu từng lỗi cấu hình thì kubelet chỉ khởi động lại khi lỗi vừa được sửa (bây giờ)
        sim.envOk = sim.cfgErr ? Math.max(t, c + 2000) : c + 2000; sim.env = r.env;
      }
      const start = sim.envOk;
      ev('Normal', 'Created', start, `Created container: ${ctr.name}`);
      ev('Normal', 'Started', start, `Started container ${ctr.name}`);
      const b = (v.beh = sim.beh || (sim.beh = behaviour(pod)));
      // File model vừa xuất hiện (Job huấn luyện xong): lần khởi động lại kế tiếp sẽ thành công
      if (b.recheck && fileExists(pod, b.recheck)) { sim.beh = null; sim.envOk = t; return podView(pod); }
      const policy = pod.spec.restartPolicy || 'Always';
      const live = ctr.livenessProbe, liveRes = b.mode === 'serve' ? probeCheck(live, b, pod) : { ok: true };
      let runFor = null, reason = b.reason, code = b.code, kill = null;
      if (b.mode === 'crash') runFor = b.run * 1000;
      if (b.mode === 'complete') { runFor = (b.run || 0.5) * 1000; reason = 'Completed'; code = 0; }
      // App khởi động chậm (nạp model): probe hỏng liên tiếp trước khi app sẵn sàng thì kubelet giết container
      const boot = (b.ready || 0) * 1000;
      const killAfter = (pr) => ((pr.initialDelaySeconds || 0) + (pr.periodSeconds || 10) * ((pr.failureThreshold || 3) - 1)) * 1000;
      const refused = (pr) => { const port = (pr.httpGet || pr.tcpSocket || {}).port; return `Get "http://${sim.ip}:${port}${(pr.httpGet && pr.httpGet.path) || ''}": dial tcp ${sim.ip}:${port}: connect: connection refused`; };
      const sp = ctr.startupProbe;
      if (b.mode === 'serve') {
        if (sp) { const sr = probeCheck(sp, b, pod); if (!sr.ok || killAfter(sp) < boot) kill = { which: 'Startup', at: killAfter(sp), first: (sp.initialDelaySeconds || 0) * 1000, msg: sr.ok ? refused(sp) : sr.msg }; }
        else if (live && liveRes.ok && killAfter(live) < boot) kill = { which: 'Liveness', at: killAfter(live), first: (live.initialDelaySeconds || 0) * 1000, msg: refused(live) };
        if (!kill && live && !liveRes.ok) { const pd = (live.periodSeconds || 10) * 1000; kill = { which: 'Liveness', at: (sp ? boot : 0) + (live.initialDelaySeconds || 0) * 1000 + pd * (live.failureThreshold || 3), first: (sp ? boot : 0) + (live.initialDelaySeconds || 0) * 1000, msg: liveRes.msg }; }
        if (kill) { runFor = kill.at; reason = 'Error'; code = 137; }
      }
      v.mem = b.mem || 1;
      if (runFor === null) {
        Object.assign(v, { status: 'Running', running: true, phase: 'Running', state: 'Running', startedAt: start });
      } else if (b.mode === 'complete' && policy !== 'Always') {
        if (t < start + runFor) Object.assign(v, { status: 'Running', running: true, phase: 'Running', state: 'Running', startedAt: start });
        else {
          Object.assign(v, { status: 'Completed', phase: 'Succeeded', state: 'Terminated', reason: 'Completed', exitCode: 0, startedAt: start, finishedAt: start + runFor });
          if (b.save && !sim.saved) { const st = storeFor(pod, b.save.path).store; if (st) st.files[b.save.path] = b.save.content; sim.saved = true; }
        }
        return done();
      } else if (policy === 'Never') {
        // restartPolicy Never (Job): container lỗi thì Pod dừng hẳn ở trạng thái Error, controller của Job sẽ tạo Pod mới
        if (t < start + runFor) Object.assign(v, { status: 'Running', running: true, phase: 'Running', state: 'Running', startedAt: start });
        else Object.assign(v, { status: reason === 'OOMKilled' ? 'OOMKilled' : 'Error', phase: 'Failed', state: 'Terminated', reason, exitCode: code, startedAt: start, finishedAt: start + runFor });
        return done();
      } else {
        const cy = cycle(start, runFor, t);
        v.restarts = cy.restarts;
        v.startedAt = cy.curStart;
        if (cy.restarts > 0 || cy.phase !== 'run') v.last = { reason, code, finishedAt: cy.phase === 'run' ? cy.curStart - 10000 : cy.crashAt };
        if (cy.phase === 'run') Object.assign(v, { status: 'Running', running: true, phase: 'Running', state: 'Running' });
        else if (cy.phase === 'term') Object.assign(v, { status: reason, phase: 'Running', state: 'Terminated', reason });
        else Object.assign(v, { status: 'CrashLoopBackOff', phase: 'Running', state: 'Waiting', reason: 'CrashLoopBackOff' });
        if (kill) {
          ev('Warning', 'Unhealthy', start + kill.first + 1000, `${kill.which} probe failed: ${kill.msg}`);
          if (cy.crashAt) ev('Normal', 'Killing', cy.crashAt, `Container ${ctr.name} failed ${kill.which.toLowerCase()} probe, will be restarted`);
        }
        if (cy.restarts > 0 || cy.phase === 'backoff') ev('Warning', 'BackOff', (cy.crashAt || cy.curStart) + 1500, `Back-off restarting failed container ${ctr.name} in pod ${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})`);
      }
      // Sẵn sàng nhận traffic khi app khởi động xong VÀ readiness probe đạt
      if (v.running && (b.mode === 'serve' || b.mode === 'sleep')) {
        const rp = ctr.readinessProbe, res = b.mode === 'serve' ? probeCheck(rp, b, pod) : { ok: true };
        const at = v.startedAt + Math.max((b.ready || 0) * 1000, rp ? (rp.initialDelaySeconds || 0) * 1000 : 0);
        if (res.ok) v.ready = t >= at;
        else ev('Warning', 'Unhealthy', at + 1000, `Readiness probe failed: ${res.msg}`);
        v.readyProbeErr = res.ok ? null : res.msg;
      } else if (v.running && b.mode !== 'serve') v.ready = true;
      if (v.running) v.cpu = 0.001;
      return done();
    }

    // ---------- Controller: ReplicaSet, Deployment, HPA ----------
    const tplHash = (tpl) => { const h = SH.hash(JSON.stringify(tpl)) + SH.hash('x' + JSON.stringify(tpl)); return [...h].map((ch) => ALPHA[parseInt(ch, 16) % ALPHA.length]).join('').slice(0, 10); };
    const rsOf = (d) => list('ReplicaSet', d.metadata.namespace).filter((r) => r.metadata.ownerName === d.metadata.name);
    const rev = (o) => +(o.metadata.annotations['deployment.kubernetes.io/revision'] || 0);
    function syncRS(rs) {
      const pods = ownedPods(rs).filter(live);
      const want = rs.spec.replicas;
      if (pods.length < want) {
        for (let i = pods.length; i < want; i++) { const pd = createPod(rs.spec.template, rs.metadata.namespace, rs); event(rs, 'Normal', 'SuccessfulCreate', `Created pod: ${pd.metadata.name}`, 'replicaset-controller'); }
      } else if (pods.length > want) {
        // Ưu tiên xóa Pod chưa sẵn sàng, sau đó Pod mới nhất (giống controller thật)
        pods.map((pd) => ({ pd, v: podView(pd) })).sort((a, b) => a.v.ready - b.v.ready || b.pd.metadata.created - a.pd.metadata.created).slice(0, pods.length - want).forEach(({ pd }) => { pd.sim.deletedAt = T(); event(rs, 'Normal', 'SuccessfulDelete', `Deleted pod: ${pd.metadata.name}`, 'replicaset-controller'); });
      }
    }
    function syncDeployment(d) {
      const tpl = d.spec.template, hash = tplHash(tpl);
      const all = rsOf(d);
      let nw = all.find((r) => r.metadata.labels['pod-template-hash'] === hash);
      const maxRev = Math.max(0, ...all.map(rev));
      if (!nw) {
        const t2 = clone(tpl);
        t2.metadata = t2.metadata || {}; t2.metadata.labels = Object.assign({}, t2.metadata.labels, { 'pod-template-hash': hash });
        nw = add('ReplicaSet', { name: `${d.metadata.name}-${hash}`, namespace: d.metadata.namespace, labels: Object.assign({}, t2.metadata.labels), ownerKind: 'Deployment', ownerName: d.metadata.name, annotations: { 'deployment.kubernetes.io/revision': String(maxRev + 1) } }, { spec: { replicas: 0, selector: { matchLabels: Object.assign({}, d.spec.selector.matchLabels, { 'pod-template-hash': hash }) }, template: t2 } });
        if (d.metadata.annotations['kubernetes.io/change-cause']) nw.metadata.annotations['kubernetes.io/change-cause'] = d.metadata.annotations['kubernetes.io/change-cause'];
        d.metadata.annotations['deployment.kubernetes.io/revision'] = String(maxRev + 1);
      } else if (rev(nw) < maxRev && nw.spec.replicas === 0 && all.some((r) => r !== nw && r.spec.replicas > 0)) {
        nw.metadata.annotations['deployment.kubernetes.io/revision'] = String(maxRev + 1); // rollback tái dùng ReplicaSet cũ
        d.metadata.annotations['deployment.kubernetes.io/revision'] = String(maxRev + 1);
      }
      const desired = d.spec.replicas ?? 1;
      const old = all.filter((r) => r !== nw);
      const setRep = (r, n) => { if (r.spec.replicas === n) return; event(d, 'Normal', n > r.spec.replicas ? 'ScalingReplicaSet' : 'ScalingReplicaSet', `Scaled ${n > r.spec.replicas ? 'up' : 'down'} replica set ${r.metadata.name} from ${r.spec.replicas} to ${n}`, 'deployment-controller'); r.spec.replicas = n; };
      if (!old.some((r) => r.spec.replicas > 0)) setRep(nw, desired);
      else {
        // RollingUpdate: maxSurge 25% (làm tròn lên), maxUnavailable 25% (làm tròn xuống)
        let surge = Math.ceil(desired * 0.25), unav = Math.floor(desired * 0.25);
        if (!surge && !unav) surge = 1;
        const total = all.reduce((s, r) => s + r.spec.replicas, 0);
        if (nw.spec.replicas < desired && total < desired + surge) setRep(nw, Math.min(desired, nw.spec.replicas + desired + surge - total));
        const readyAll = all.reduce((s, r) => s + ownedPods(r).filter((pd) => live(pd) && podView(pd).ready).length, 0);
        let canRemove = readyAll - (desired - unav);
        old.sort((a, b) => rev(a) - rev(b)).forEach((r) => {
          // Pod cũ không sẵn sàng thì gỡ ngay, không tính vào giới hạn
          const notReady = ownedPods(r).filter((pd) => live(pd) && !podView(pd).ready).length;
          const take = Math.min(r.spec.replicas, Math.max(0, canRemove) + notReady);
          if (take > 0) { setRep(r, r.spec.replicas - take); canRemove -= Math.max(0, take - notReady); }
        });
      }
    }
    // Tải CPU mô phỏng: Pod "load-generator" chạy vòng lặp wget vào một Service
    function cpuOf(pod) {
      let demand = 0;
      list('Pod', null).forEach((lg) => {
        // podView phải chạy trước: nó mới là nơi tính (lười) sim.beh của Pod tạo tải
        const v = live(lg) && !lg.sim.system && podView(lg).running && lg.sim.beh && lg.sim.beh.load ? lg.sim.beh.load : null;
        if (!v) return;
        const svc = resolveSvc(v.host, lg.metadata.namespace);
        if (!svc || !matchLabels(pod.labels || pod.metadata.labels, svc.spec.selector)) return;
        const eps = endpoints(svc).length || 1;
        demand += 0.6 / eps;
      });
      return 0.001 + demand;
    }
    function hpaMetrics(h) {
      const d = get(h.spec.scaleTargetRef.kind === 'Deployment' ? 'Deployment' : h.spec.scaleTargetRef.kind, h.spec.scaleTargetRef.name, h.metadata.namespace);
      const target = h.spec.targetCPUUtilizationPercentage || ((h.spec.metrics || []).map((m) => m.resource && m.resource.target && m.resource.target.averageUtilization).find(Boolean)) || 80;
      if (!d) return { target, err: `deployments/scale.apps "${h.spec.scaleTargetRef.name}" not found` };
      const req = qty(((d.spec.template.spec.containers[0].resources || {}).requests || {}).cpu);
      const pods = list('Pod', d.metadata.namespace).filter((pd) => live(pd) && matchLabels(pd.metadata.labels, d.spec.selector.matchLabels));
      if (!req) return { d, target, err: `failed to get cpu utilization: missing request for cpu in container ${d.spec.template.spec.containers[0].name} of Pod ${(pods[0] || { metadata: { name: '?' } }).metadata.name}` };
      const ready = pods.filter((pd) => podView(pd).ready);
      if (!ready.length) return { d, target, err: 'no metrics returned from resource metrics API' };
      const util = Math.round((ready.reduce((s, pd) => s + cpuOf(pd), 0) / ready.length / req) * 100);
      return { d, target, util, pods: ready.length };
    }
    function syncHPA(h) {
      const t = T();
      if (h.sim.last && t - h.sim.last < 15000) return;
      h.sim.last = t;
      const m = hpaMetrics(h);
      h.sim.m = m;
      if (m.err) { if (m.d) event(h, 'Warning', 'FailedGetResourceMetric', m.err, 'horizontal-pod-autoscaler'); return; }
      const curR = m.d.spec.replicas ?? 1, min = h.spec.minReplicas || 1, max = h.spec.maxReplicas;
      let want = Math.abs(m.util / m.target - 1) <= 0.1 ? curR : Math.ceil(curR * (m.util / m.target));
      want = Math.max(min, Math.min(max, want, Math.max(4, curR * 2)));
      h.sim.recs = (h.sim.recs || []).filter((r) => t - r.t < 30000).concat([{ t, want }]);
      // Giảm Pod chậm (cửa sổ ổn định rút gọn còn 30 giây thay vì 5 phút) để tránh dao động
      if (want < curR) want = Math.max(...h.sim.recs.map((r) => r.want));
      if (want !== curR) {
        event(h, 'Normal', 'SuccessfulRescale', `New size: ${want}; reason: ${want > curR ? 'cpu resource utilization (percentage of request) above target' : 'All metrics below target'}`, 'horizontal-pod-autoscaler');
        m.d.spec.replicas = want;
      }
    }
    // ---------- Lưu trữ: PVC → PV cấp động theo StorageClass ----------
    const defaultSC = () => list('StorageClass').find((s) => (s.metadata.annotations || {})['storageclass.kubernetes.io/is-default-class'] === 'true');
    const scOf = (pvc) => (pvc.spec.storageClassName ? get('StorageClass', pvc.spec.storageClassName) : defaultSC());
    const pvcStatus = (pvc) => (pvc.sim.deleting ? 'Terminating' : pvc.sim.pv ? 'Bound' : 'Pending');
    const pvcUsers = (pvc) => list('Pod', pvc.metadata.namespace).filter((pd) => live(pd) && claimsOf(pd.spec).includes(pvc.metadata.name));
    function bindPVC(pvc, node) {
      const sc = scOf(pvc);
      if (!sc || pvc.sim.pv) return false;
      const name = 'pvc-' + pvc.metadata.uid;
      const pv = add('PersistentVolume', { name, annotations: { 'pv.kubernetes.io/provisioned-by': sc.provisioner } }, {
        spec: { capacity: { storage: String(((pvc.spec.resources || {}).requests || {}).storage) }, accessModes: clone(pvc.spec.accessModes), persistentVolumeReclaimPolicy: sc.reclaimPolicy || 'Delete', storageClassName: sc.metadata.name, volumeMode: 'Filesystem', claimRef: { kind: 'PersistentVolumeClaim', namespace: pvc.metadata.namespace, name: pvc.metadata.name, uid: pvc.metadata.uid }, hostPath: { path: `/var/local-path-provisioner/${name}_${pvc.metadata.namespace}_${pvc.metadata.name}`, type: 'DirectoryOrCreate' } },
      });
      pv.sim = { data: { files: {}, redis: {} }, node };
      Object.assign(pvc.sim, { pv: name, node, boundAt: T() });
      event(pvc, 'Normal', 'ExternalProvisioning', `Waiting for a volume to be created either by the external provisioner '${sc.provisioner}' or manually by the system administrator.`, 'persistentvolume-controller');
      event(pvc, 'Normal', 'ProvisioningSucceeded', `Successfully provisioned volume ${name}`, `${sc.provisioner}_local-path-provisioner-7d4d9bdcc5-x2wqp`);
      return true;
    }
    function removePVC(pvc) {
      const pv = pvc.sim.pv && get('PersistentVolume', pvc.sim.pv);
      if (pv) { if (pv.spec.persistentVolumeReclaimPolicy === 'Delete') removeObj(pv); else pv.sim.released = true; }
      removeObj(pvc);
    }
    function syncPVC(pvc) {
      if (pvc.sim.deleting) { if (!pvcUsers(pvc).length) removePVC(pvc); return; }
      if (pvc.sim.pv) return;
      const sc = scOf(pvc);
      if (!sc) { if (!pvc.sim.warned) { pvc.sim.warned = true; event(pvc, 'Warning', 'ProvisioningFailed', `storageclass.storage.k8s.io "${pvc.spec.storageClassName}" not found`, 'persistentvolume-controller'); } return; }
      if (sc.volumeBindingMode !== 'WaitForFirstConsumer') { bindPVC(pvc, null); return; }
      const user = pvcUsers(pvc)[0];
      if (user) bindPVC(pvc, user.sim.node);
      else if (!pvc.sim.waitEv) { pvc.sim.waitEv = true; event(pvc, 'Normal', 'WaitForFirstConsumer', 'waiting for first consumer to be created before binding', 'persistentvolume-controller'); }
    }

    // ---------- StatefulSet: tên ổn định (db-0, db-1...), tạo/xóa theo thứ tự, mỗi Pod một PVC riêng ----------
    const stsPods = (s) => list('Pod', s.metadata.namespace).filter((pd) => pd.metadata.ownerKind === 'StatefulSet' && pd.metadata.ownerName === s.metadata.name);
    const ordOf = (s, pd) => +pd.metadata.name.slice(s.metadata.name.length + 1);
    function stsView(s) {
      const pods = stsPods(s).filter(live), hash = tplHash(s.spec.template);
      return { desired: s.spec.replicas ?? 1, total: pods.length, ready: pods.filter((pd) => podView(pd).ready).length, updated: pods.filter((pd) => pd.sim.tplHash === hash).length };
    }
    function syncSTS(s) {
      const ns = s.metadata.namespace, name = s.metadata.name, want = s.spec.replicas ?? 1, hash = tplHash(s.spec.template);
      const parallel = s.spec.podManagementPolicy === 'Parallel';
      const pods = stsPods(s), byOrd = {};
      pods.forEach((pd) => (byOrd[ordOf(s, pd)] = pd));
      for (let i = 0; i < want; i++) {
        const pd = byOrd[i];
        if (pd) { if (!parallel && (pd.sim.deletedAt || !podView(pd).ready)) return; continue; }
        const pname = `${name}-${i}`;
        (s.spec.volumeClaimTemplates || []).forEach((vct) => {
          const cn = `${vct.metadata.name}-${pname}`;
          if (get('PersistentVolumeClaim', cn, ns)) return;
          const pvc = add('PersistentVolumeClaim', { name: cn, namespace: ns, labels: clone(s.spec.selector.matchLabels || {}) }, { spec: Object.assign({ volumeMode: 'Filesystem' }, clone(vct.spec)) });
          if (!pvc.spec.storageClassName && defaultSC()) pvc.spec.storageClassName = defaultSC().metadata.name;
          event(s, 'Normal', 'SuccessfulCreate', `create Claim ${cn} Pod ${pname} in StatefulSet ${name} success`, 'statefulset-controller');
        });
        const p = createPod(s.spec.template, ns, s, pname, (spec) => {
          spec.hostname = pname;
          if (s.spec.serviceName) spec.subdomain = s.spec.serviceName;
          spec.volumes = spec.volumes || [];
          (s.spec.volumeClaimTemplates || []).forEach((vct) => { if (!spec.volumes.some((v) => v.name === vct.metadata.name)) spec.volumes.push({ name: vct.metadata.name, persistentVolumeClaim: { claimName: `${vct.metadata.name}-${pname}` } }); });
        });
        Object.assign(p.metadata.labels, { 'statefulset.kubernetes.io/pod-name': pname, 'apps.kubernetes.io/pod-index': String(i), 'controller-revision-hash': `${name}-${hash}` });
        p.sim.tplHash = hash;
        event(s, 'Normal', 'SuccessfulCreate', `create Pod ${pname} in StatefulSet ${name} successful`, 'statefulset-controller');
        if (!parallel) return;
      }
      // Thu nhỏ: xóa Pod có số thứ tự lớn nhất trước, từng Pod một; PVC được giữ lại
      const extra = pods.filter((pd) => live(pd) && ordOf(s, pd) >= want).sort((a, b) => ordOf(s, b) - ordOf(s, a));
      const busy = pods.some((pd) => pd.sim.deletedAt);
      const del = (pd) => { pd.sim.deletedAt = T(); event(s, 'Normal', 'SuccessfulDelete', `delete Pod ${pd.metadata.name} in StatefulSet ${name} successful`, 'statefulset-controller'); };
      if (extra.length) { if (parallel) extra.forEach(del); else if (!busy) del(extra[0]); return; }
      // Cập nhật cuốn chiếu theo thứ tự ngược (db-2 → db-1 → db-0), chỉ khi mọi Pod đang sẵn sàng
      const cur = pods.filter(live);
      if (!busy && cur.length === want && cur.every((pd) => podView(pd).ready)) {
        const old = cur.filter((pd) => pd.sim.tplHash !== hash).sort((a, b) => ordOf(s, b) - ordOf(s, a))[0];
        if (old) del(old);
      }
    }

    // ---------- Job: chạy Pod tới khi đủ số lần thành công, thử lại có giới hạn (backoffLimit) ----------
    const jobPods = (j) => list('Pod', j.metadata.namespace).filter((pd) => pd.metadata.ownerKind === 'Job' && pd.metadata.ownerName === j.metadata.name);
    function jobView(j) {
      const vs = jobPods(j).filter(live).map((pd) => ({ pd, v: podView(pd) }));
      const succeeded = vs.filter((x) => x.v.phase === 'Succeeded').length;
      const failed = vs.filter((x) => x.v.phase === 'Failed').length + vs.reduce((s, x) => s + x.v.restarts, 0);
      const active = vs.filter((x) => x.v.phase !== 'Succeeded' && x.v.phase !== 'Failed').length;
      const lastFail = Math.max(0, ...vs.filter((x) => x.v.phase === 'Failed').map((x) => x.v.finishedAt || 0));
      return { vs, succeeded, failed, active, lastFail, ready: vs.filter((x) => x.v.ready).length, completions: j.spec.completions ?? 1, status: j.sim.done ? j.sim.done.status : 'Running' };
    }
    function syncJob(j) {
      if (j.sim.done || j.spec.suspend) return;
      const v = jobView(j), back = j.spec.backoffLimit ?? 6, par = j.spec.parallelism ?? 1;
      if (v.succeeded >= v.completions) { j.sim.done = { status: 'Complete', at: T() }; event(j, 'Normal', 'Completed', 'Job completed', 'job-controller'); return; }
      if (v.failed > back) {
        j.sim.done = { status: 'Failed', at: T() };
        v.vs.filter((x) => x.v.phase !== 'Failed' && x.v.phase !== 'Succeeded').forEach((x) => (x.pd.sim.deletedAt = T()));
        event(j, 'Warning', 'BackoffLimitExceeded', 'Job has reached the specified backoff limit', 'job-controller');
        return;
      }
      const need = Math.min(par, v.completions - v.succeeded) - v.active;
      if (need <= 0) return;
      // Chờ lũy thừa giữa các lần thử lại: 10s, 20s, 40s...
      if (v.failed > 0 && T() < v.lastFail + 10000 * Math.pow(2, Math.max(0, v.failed - 1))) return;
      for (let i = 0; i < need; i++) { const pd = createPod(j.spec.template, j.metadata.namespace, j); event(j, 'Normal', 'SuccessfulCreate', `Created pod: ${pd.metadata.name}`, 'job-controller'); }
    }

    function reconcile() {
      for (let pass = 0; pass < 3; pass++) {
        state.objs.filter((o) => o.kind === 'Pod' && o.sim.deletedAt && T() - o.sim.deletedAt >= 2000).forEach(removeObj);
        list('HorizontalPodAutoscaler', null).forEach(syncHPA);
        list('Deployment', null).forEach(syncDeployment);
        list('ReplicaSet', null).forEach(syncRS);
        list('StatefulSet', null).forEach(syncSTS);
        list('Job', null).forEach(syncJob);
        list('PersistentVolumeClaim', null).forEach(syncPVC);
      }
      // Vòng sync của kubelet: quan sát mọi Pod để trạng thái tính lười (envOk...) cập nhật đúng thời điểm
      list('Pod', null).forEach((pd) => { if (live(pd) && !pd.sim.system) podView(pd); });
    }

    // ---------- Mạng: Service, DNS, Ingress, HTTP ----------
    const endpoints = (svc) => list('Pod', svc.metadata.namespace).filter((pd) => live(pd) && matchLabels(pd.metadata.labels, svc.spec.selector) && podView(pd).ready);
    function resolveSvc(host, ns) {
      const parts = host.split('.');
      if (parts.length === 1) return get('Service', host, ns);
      if (parts.length === 2 || /\.svc(\.cluster\.local)?$/.test(host)) return get('Service', parts[0], parts[1]);
      return null;
    }
    // DNS riêng từng Pod của StatefulSet: db-0.db (.default.svc.cluster.local) — chỉ có khi Service là headless
    function resolvePodHost(host, ns) {
      const m = String(host).match(/^([\w-]+)\.([\w-]+)(?:\.([\w-]+))?(?:\.svc(?:\.cluster\.local)?)?$/);
      if (!m) return null;
      const n2 = m[3] || ns, svc = get('Service', m[2], n2);
      if (!svc || svc.spec.clusterIP !== 'None') return null;
      return list('Pod', n2).find((pd) => live(pd) && pd.spec.hostname === m[1] && pd.spec.subdomain === m[2]) || null;
    }
    // Tìm Pod Redis mà một Pod khác gọi tới qua tên (Service thường, headless hoặc tên riêng của Pod)
    function redisTarget(host, ns) {
      const pd = resolvePodHost(host, ns);
      if (pd) return podView(pd).running && pd.sim.img && pd.sim.img.kind === 'redis' ? { pod: pd } : { err: 'Connection refused', code: 111 };
      const svc = resolveSvc(host, ns);
      if (!svc) return { err: 'Name or service not known', code: -2 };
      const ep = endpoints(svc).find((x) => x.sim.img && x.sim.img.kind === 'redis');
      return ep ? { pod: ep } : { err: 'Connection refused', code: 111 };
    }
    function servePod(pod, port, path, method, from) {
      const v = podView(pod);
      if (!v.running) return { code: 0, err: `Failed to connect to ${pod.sim.ip} port ${port} after 1 ms: Couldn't connect to server` };
      const b = v.beh;
      if (!b || b.mode !== 'serve' || +port !== b.port) return { code: 0, err: `Failed to connect to ${pod.sim.ip} port ${port} after 0 ms: Couldn't connect to server`, refused: true };
      if (b.tcp) return { code: 0, err: 'Received HTTP/0.9 when not allowed' };
      const env = pod.sim.env || {};
      let code = 200, body, count;
      const pth = path.split('?')[0];
      if (!b.paths.includes(pth)) { code = 404; body = pod.sim.img.kind === 'nginx' ? '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx/1.27.2</center>\n</body>\n</html>' : '404 page not found'; }
      else if (pod.sim.img.kind === 'nginx') body = NGINX_PAGE;
      else if (pth === '/healthz') body = 'ok';
      else if (pth === '/version') body = pod.sim.img.ver;
      else if (pod.sim.img.kind === 'model') {
        const meta = pod.sim.img.ver === 'v2' ? (() => { try { return JSON.parse(readFile(pod, '/models/model.pkl') || '{}'); } catch (e) { return {}; } })() : { accuracy: 0.81 };
        const conf = pod.sim.img.ver === 'v2' ? Math.min(0.99, (meta.accuracy || 0.9) + 0.02) : 0.78;
        body = pth === '/predict' ? `{"prediction": "setosa", "confidence": ${conf.toFixed(2)}, "model": "${pod.sim.img.ver}", "pod": "${pod.metadata.name}"}` : `{"service": "model-api", "model": "${pod.sim.img.ver}", "accuracy": ${meta.accuracy || 0.81}, "pod": "${pod.metadata.name}"}`;
      } else if (pod.sim.img.kind === 'counter') {
        // Ứng dụng đếm lượt xem: mỗi request tăng khóa "hits" trong Redis (tên lấy từ REDIS_HOST)
        const host = env.REDIS_HOST || 'redis', rt = redisTarget(host, pod.metadata.namespace);
        if (!rt.pod) { code = 500; body = `redis.exceptions.ConnectionError: Error ${rt.code} connecting to ${host}:6379. ${rt.err}.`; }
        else { const st = redisStore(rt.pod); const n = (parseInt(st.hits || '0', 10) || 0) + 1; st.hits = String(n); count = n; body = `Xin chào! Trang này đã được xem ${n} lần. (pod ${pod.metadata.name})`; }
      }
      else {
        body = `Xin chào từ ${pod.metadata.name} (vlab/web ${pod.sim.img.ver})`;
        if (env.MESSAGE) body += `\nMESSAGE: ${env.MESSAGE}`;
        if (env.APP_COLOR) body += `\nAPP_COLOR: ${env.APP_COLOR}`;
        Object.keys(env).filter((k) => /PASSWORD|TOKEN|SECRET|KEY/.test(k)).forEach((k) => (body += `\n${k}: ${'*'.repeat(Math.min(8, env[k].length))} (đã nhận ${env[k].length} ký tự)`));
      }
      pod.sim.reqLog.push({ t: T(), path: pth, code, from, method: method || 'GET' });
      return { code, body, pod: pod.metadata.name, count };
    }
    function viaService(svc, port, path, from) {
      const sp = (svc.spec.ports || []).find((x) => +x.port === +port);
      if (!sp) return { code: 0, err: `Failed to connect to ${svc.metadata.name} port ${port} after 1003 ms: Couldn't connect to server`, svc };
      const eps = endpoints(svc);
      if (!eps.length) return { code: 0, err: `Failed to connect to ${svc.metadata.name} port ${port} after 2 ms: Couldn't connect to server`, svc, noEndpoints: true };
      svc.sim.rr = ((svc.sim.rr || 0) + 1) % eps.length;
      const pod = eps[svc.sim.rr];
      const tp = typeof sp.targetPort === 'string' ? ((pod.spec.containers[0].ports || []).find((x) => x.name === sp.targetPort) || {}).containerPort : (sp.targetPort || sp.port);
      const r = servePod(pod, tp, path, 'GET', from);
      return Object.assign(r, { svc });
    }
    function viaIngress(host, path) {
      const ings = list('Ingress', null).filter((i) => !i.spec.ingressClassName || i.spec.ingressClassName === 'nginx');
      let best = null;
      ings.forEach((ing) => (ing.spec.rules || []).forEach((rule) => {
        if (rule.host && rule.host !== host) return;
        ((rule.http || {}).paths || []).forEach((pp) => {
          const pre = pp.path || '/';
          // ingress-nginx coi path là regex khi có ký tự regex hoặc bật use-regex (mẫu chuẩn để dùng rewrite-target /$2)
          const ann = ing.metadata.annotations || {};
          const isRe = /[()$*[\]|?+]/.test(pre) || ann['nginx.ingress.kubernetes.io/use-regex'] === 'true';
          let ok, groups = null;
          if (isRe) { try { const mm = path.match(new RegExp('^' + pre, 'i')); ok = !!mm; groups = mm; } catch (e) { ok = false; } }
          else ok = pp.pathType === 'Exact' ? path === pre : path === pre || path.startsWith(pre.replace(/\/$/, '') + '/') || pre === '/';
          // Ưu tiên path dài hơn (giống nginx), rule có host ưu tiên hơn rule không host
          if (ok && (!best || pre.length > best.pre.length || (rule.host && !best.host))) best = { ing, pp, pre, host: rule.host, groups };
        });
      }));
      const nginx404 = '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>';
      if (!best) return { code: 404, body: nginx404, ingress: null };
      const be = best.pp.backend.service, svc = get('Service', be.name, best.ing.metadata.namespace);
      const fail503 = { code: 503, body: '<html>\n<head><title>503 Service Temporarily Unavailable</title></head>\n<body>\n<center><h1>503 Service Temporarily Unavailable</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>', ingress: best.ing.metadata.name };
      if (!svc) return fail503;
      const port = be.port.number || ((svc.spec.ports || []).find((x) => x.name === be.port.name) || {}).port;
      // rewrite-target: đổi đường dẫn trước khi chuyển vào app (app chỉ biết "/", "/version"...)
      const rw = best.ing.metadata.annotations && best.ing.metadata.annotations['nginx.ingress.kubernetes.io/rewrite-target'];
      let fwd = path;
      if (rw && best.groups) fwd = rw.replace(/\$(\d)/g, (_, n) => best.groups[+n] || '');
      else if (rw) fwd = rw.includes('$') ? '/' + (path.slice(best.pre.replace(/\/$/, '').length).replace(/^\//, '')) : rw;
      fwd = '/' + fwd.replace(/^\/+/, '');
      const r = viaService(svc, port, fwd, 'ingress');
      if (r.code === 0) return Object.assign(fail503, { svc });
      return Object.assign(r, { ingress: best.ing.metadata.name, fwd });
    }
    // Gọi HTTP từ máy host (localhost → port-forward / NodePort / Ingress) hoặc từ trong một Pod
    function http(url, fromPod, headers = {}) {
      const m = String(url).match(/^(?:(https?):\/\/)?([^/:\s]+)(?::(\d+))?(\/.*)?$/);
      if (!m) return { code: 0, err: `URL rejected: Malformed input to a URL function`, exit: 3 };
      const host = m[2], port = m[3] ? +m[3] : 80, path = m[4] || '/';
      const H = headers.host || host;
      if (fromPod) {
        const ns = fromPod.metadata.namespace;
        const ph = resolvePodHost(host, ns);
        if (ph) return servePod(ph, port, path, 'GET', fromPod.metadata.name);
        const svc = resolveSvc(host, ns) || list('Service', null).find((s) => s.spec.clusterIP === host);
        if (svc) return viaService(svc, port, path, fromPod.metadata.name);
        const pod = list('Pod', null).find((pd) => pd.sim.ip === host && live(pd));
        if (pod) return servePod(pod, port, path, 'GET', fromPod.metadata.name);
        if (host === 'localhost' || host === '127.0.0.1') return servePod(fromPod, port, path, 'GET', 'localhost');
        if (/^[\w-]+$/.test(host) && list('Service', null).some((s) => s.metadata.name === host)) return { code: 0, err: `Could not resolve host: ${host}`, exit: 6, otherNs: list('Service', null).find((s) => s.metadata.name === host).metadata.namespace };
        return { code: 0, err: `Could not resolve host: ${host}`, exit: 6 };
      }
      if (host === 'localhost' || host === '127.0.0.1') {
        const fw = state.forwards.find((f) => f.local === port);
        if (fw) {
          const o = get(fw.kind, fw.name, fw.ns);
          if (!o) return { code: 0, err: `Failed to connect to localhost port ${port} after 0 ms: Couldn't connect to server` };
          if (fw.kind === 'Service') return Object.assign(viaService(o, fw.remote, path, 'port-forward'), { via: 'forward' });
          const pod = fw.kind === 'Pod' ? o : list('Pod', fw.ns).find((pd) => live(pd) && matchLabels(pd.metadata.labels, o.spec.selector.matchLabels) && podView(pd).running);
          return pod ? Object.assign(servePod(pod, fw.remote, path, 'GET', 'port-forward'), { via: 'forward' }) : { code: 0, err: 'error: unable to forward port because pod is not running' };
        }
        const np = list('Service', null).find((s) => (s.spec.ports || []).some((x) => +x.nodePort === port) && s.metadata.namespace !== 'ingress-nginx');
        if (np) return Object.assign(viaService(np, np.spec.ports.find((x) => +x.nodePort === port).port, path, 'nodeport'), { via: 'nodeport' });
        if (port === 80) return Object.assign(viaIngress(H === 'localhost' || H === '127.0.0.1' ? '' : H, path), { via: 'ingress' });
        return { code: 0, err: `Failed to connect to localhost port ${port} after 0 ms: Couldn't connect to server`, exit: 7 };
      }
      // Tên miền như shop.local: giả định /etc/hosts đã trỏ về 127.0.0.1 (Ingress controller của kind)
      if (/\.(local|test|example|lab)$/.test(host) && port === 80) return Object.assign(viaIngress(H, path), { via: 'ingress' });
      if (resolveSvc(host, state.ns)) return { code: 0, err: `Could not resolve host: ${host}`, exit: 6, clusterOnly: true };
      return { code: 0, err: `Could not resolve host: ${host}`, exit: 6 };
    }

    // ---------- Định dạng xuất ----------
    function podRow(pd, wide, showNs) {
      const v = podView(pd);
      const restarts = v.restarts ? `${v.restarts}${v.last && v.last.finishedAt ? ` (${age(T() - v.last.finishedAt)} ago)` : ''}` : '0';
      const r = [pd.metadata.name, `${v.ready ? 1 : 0}/1`, v.status, restarts, age(T() - pd.metadata.created)];
      if (showNs) r.unshift(pd.metadata.namespace);
      if (wide) r.push(v.status === 'Pending' ? '<none>' : pd.sim.ip, pd.sim.node, '<none>', '<none>');
      return r;
    }
    function depView(d) {
      const rss = rsOf(d), hash = tplHash(d.spec.template);
      const pods = rss.flatMap((r) => ownedPods(r).filter(live));
      const nw = rss.find((r) => r.metadata.labels['pod-template-hash'] === hash);
      const updated = nw ? ownedPods(nw).filter(live).length : 0;
      const ready = pods.filter((pd) => podView(pd).ready).length;
      const updReady = nw ? ownedPods(nw).filter((pd) => live(pd) && podView(pd).ready).length : 0;
      return { desired: d.spec.replicas ?? 1, total: pods.length, updated, ready, available: ready, updReady, nw, old: rss.filter((r) => r !== nw) };
    }
    function svcPorts(s) { return (s.spec.ports || []).map((x) => `${x.port}${x.nodePort && s.spec.type !== 'ClusterIP' ? ':' + x.nodePort : ''}/${x.protocol || 'TCP'}`).join(',') || '<none>'; }
    function hpaTargets(h) { const m = h.sim.m || hpaMetrics(h); return `cpu: ${m.util === undefined ? '<unknown>' : m.util + '%'}/${m.target}%`; }
    function rowsFor(kind, objs, o) {
      const showNs = o.all, wide = o.wide, A = (x) => age(T() - x.metadata.created);
      const ns = (x, r) => (showNs ? [x.metadata.namespace, ...r] : r);
      const head = (h) => (showNs ? ['NAMESPACE', ...h] : h);
      if (kind === 'Pod') return [head(['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', ...(wide ? ['IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'] : [])]), ...objs.map((x) => podRow(x, wide, showNs))];
      if (kind === 'Deployment') return [head(['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE', ...(wide ? ['CONTAINERS', 'IMAGES', 'SELECTOR'] : [])]), ...objs.map((d) => { const v = depView(d); const c = d.spec.template.spec.containers; return ns(d, [d.metadata.name, `${v.ready}/${v.desired}`, v.updated, v.available, A(d), ...(wide ? [c.map((x) => x.name).join(','), c.map((x) => x.image).join(','), fmtLabels(d.spec.selector.matchLabels)] : [])]); })];
      if (kind === 'ReplicaSet') return [head(['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE', ...(wide ? ['CONTAINERS', 'IMAGES'] : [])]), ...objs.map((r) => { const ps = ownedPods(r).filter(live); return ns(r, [r.metadata.name, r.spec.replicas, ps.length, ps.filter((pd) => podView(pd).ready).length, A(r), ...(wide ? [r.spec.template.spec.containers[0].name, r.spec.template.spec.containers[0].image] : [])]); })];
      if (kind === 'Service') return [head(['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE', ...(wide ? ['SELECTOR'] : [])]), ...objs.map((s) => ns(s, [s.metadata.name, s.spec.type || 'ClusterIP', s.spec.clusterIP, s.spec.type === 'LoadBalancer' ? '<pending>' : '<none>', svcPorts(s), A(s), ...(wide ? [fmtLabels(s.spec.selector)] : [])]))];
      if (kind === 'Node') return [['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', ...(wide ? ['INTERNAL-IP', 'EXTERNAL-IP', 'OS-IMAGE', 'KERNEL-VERSION', 'CONTAINER-RUNTIME'] : [])], ...objs.map((n) => [n.metadata.name, 'Ready', n.sim.role, A(n), 'v1.31.0', ...(wide ? [n.sim.ip, '<none>', 'Debian GNU/Linux 12 (bookworm)', '6.6.32-linuxkit', 'containerd://1.7.18'] : [])])];
      if (kind === 'Namespace') return [['NAME', 'STATUS', 'AGE'], ...objs.map((n) => [n.metadata.name, 'Active', A(n)])];
      if (kind === 'ConfigMap') return [head(['NAME', 'DATA', 'AGE']), ...objs.map((c) => ns(c, [c.metadata.name, Object.keys(c.data || {}).length, A(c)]))];
      if (kind === 'Secret') return [head(['NAME', 'TYPE', 'DATA', 'AGE']), ...objs.map((c) => ns(c, [c.metadata.name, c.type || 'Opaque', Object.keys(c.data || {}).length, A(c)]))];
      if (kind === 'Ingress') return [head(['NAME', 'CLASS', 'HOSTS', 'ADDRESS', 'PORTS', 'AGE']), ...objs.map((i) => ns(i, [i.metadata.name, i.spec.ingressClassName || '<none>', (i.spec.rules || []).map((r) => r.host || '*').join(',') || '*', 'localhost', '80', A(i)]))];
      if (kind === 'HorizontalPodAutoscaler') return [head(['NAME', 'REFERENCE', 'TARGETS', 'MINPODS', 'MAXPODS', 'REPLICAS', 'AGE']), ...objs.map((h) => { const d = get('Deployment', h.spec.scaleTargetRef.name, h.metadata.namespace); return ns(h, [h.metadata.name, `${h.spec.scaleTargetRef.kind}/${h.spec.scaleTargetRef.name}`, hpaTargets(h), h.spec.minReplicas || 1, h.spec.maxReplicas, d ? d.spec.replicas : 0, A(h)]); })];
      if (kind === 'Endpoints') return [head(['NAME', 'ENDPOINTS', 'AGE']), ...objs.map((s) => ns(s, [s.metadata.name, s.metadata.name === 'kubernetes' ? '172.18.0.2:6443' : (endpoints(s).map((pd) => `${pd.sim.ip}:${(s.spec.ports[0] || {}).targetPort || (s.spec.ports[0] || {}).port}`).join(',') || '<none>'), A(s)]))];
      if (kind === 'StatefulSet') return [head(['NAME', 'READY', 'AGE', ...(wide ? ['CONTAINERS', 'IMAGES'] : [])]), ...objs.map((s) => { const v = stsView(s); const c = s.spec.template.spec.containers; return ns(s, [s.metadata.name, `${v.ready}/${v.desired}`, A(s), ...(wide ? [c.map((x) => x.name).join(','), c.map((x) => x.image).join(',')] : [])]); })];
      if (kind === 'Job') return [head(['NAME', 'STATUS', 'COMPLETIONS', 'DURATION', 'AGE']), ...objs.map((j) => { const v = jobView(j); return ns(j, [j.metadata.name, v.status, `${v.succeeded}/${v.completions}`, age((j.sim.done ? j.sim.done.at : T()) - j.metadata.created), A(j)]); })];
      if (kind === 'PersistentVolumeClaim') return [head(['NAME', 'STATUS', 'VOLUME', 'CAPACITY', 'ACCESS MODES', 'STORAGECLASS', 'VOLUMEATTRIBUTESCLASS', 'AGE']), ...objs.map((c) => ns(c, [c.metadata.name, pvcStatus(c), c.sim.pv || '', c.sim.pv ? c.spec.resources.requests.storage : '', c.sim.pv ? (c.spec.accessModes || []).map((m) => ACCESS[m] || m).join(',') : '', c.spec.storageClassName || '<unset>', '<unset>', A(c)]))];
      if (kind === 'PersistentVolume') return [['NAME', 'CAPACITY', 'ACCESS MODES', 'RECLAIM POLICY', 'STATUS', 'CLAIM', 'STORAGECLASS', 'VOLUMEATTRIBUTESCLASS', 'REASON', 'AGE'], ...objs.map((v) => [v.metadata.name, v.spec.capacity.storage, (v.spec.accessModes || []).map((m) => ACCESS[m] || m).join(','), v.spec.persistentVolumeReclaimPolicy, v.sim.released ? 'Released' : 'Bound', `${v.spec.claimRef.namespace}/${v.spec.claimRef.name}`, v.spec.storageClassName, '<unset>', '', A(v)])];
      if (kind === 'StorageClass') return [['NAME', 'PROVISIONER', 'RECLAIMPOLICY', 'VOLUMEBINDINGMODE', 'ALLOWVOLUMEEXPANSION', 'AGE'], ...objs.map((s) => [s.metadata.name + ((s.metadata.annotations || {})['storageclass.kubernetes.io/is-default-class'] === 'true' ? ' (default)' : ''), s.provisioner, s.reclaimPolicy || 'Delete', s.volumeBindingMode || 'Immediate', String(!!s.allowVolumeExpansion), A(s)])];
      if (kind === 'ServiceAccount') return [head(['NAME', 'SECRETS', 'AGE']), ...objs.map((s) => ns(s, [s.metadata.name, 0, A(s)]))];
      if (kind === 'Role' || kind === 'ClusterRole') return [head(['NAME', 'CREATED AT']), ...objs.map((r) => ns(r, [r.metadata.name, new Date(r.metadata.created).toISOString().replace(/\.\d+Z$/, 'Z')]))];
      if (kind === 'RoleBinding' || kind === 'ClusterRoleBinding') return [head(['NAME', 'ROLE', 'AGE', ...(wide ? ['USERS', 'GROUPS', 'SERVICEACCOUNTS'] : [])]), ...objs.map((b) => { const sb = b.subjects || []; const of = (k) => sb.filter((s) => s.kind === k).map((s) => (k === 'ServiceAccount' ? `${s.namespace || b.metadata.namespace}/${s.name}` : s.name)).join(', '); return ns(b, [b.metadata.name, `${b.roleRef.kind}/${b.roleRef.name}`, A(b), ...(wide ? [of('User'), of('Group'), of('ServiceAccount')] : [])]); })];
      return [];
    }
    // Đối tượng "sạch" để xuất -o yaml/json (thêm status tính từ mô phỏng)
    function exportObj(o) {
      const meta = { name: o.metadata.name, namespace: o.metadata.namespace, labels: Object.keys(o.metadata.labels || {}).length ? o.metadata.labels : undefined, annotations: Object.keys(o.metadata.annotations || {}).length ? o.metadata.annotations : undefined, uid: o.metadata.uid, creationTimestamp: new Date(o.metadata.created).toISOString().replace(/\.\d+Z$/, 'Z') };
      if (o.metadata.ownerKind) meta.ownerReferences = [{ apiVersion: o.metadata.ownerKind === 'ReplicaSet' ? 'apps/v1' : 'apps/v1', kind: o.metadata.ownerKind, name: o.metadata.ownerName, controller: true }];
      const r = { apiVersion: o.apiVersion, kind: o.kind, metadata: meta };
      if (o.spec) r.spec = clone(o.spec);
      if (o.data) r.data = clone(o.data);
      if (o.type) r.type = o.type;
      ['rules', 'roleRef', 'subjects', 'provisioner', 'reclaimPolicy', 'volumeBindingMode', 'allowVolumeExpansion'].forEach((k) => { if (o[k] !== undefined) r[k] = clone(o[k]); });
      if (o.kind === 'PersistentVolumeClaim') r.status = o.sim.pv ? { phase: 'Bound', accessModes: clone(o.spec.accessModes), capacity: { storage: o.spec.resources.requests.storage } } : { phase: 'Pending' };
      if (o.kind === 'PersistentVolume') r.status = { phase: o.sim.released ? 'Released' : 'Bound' };
      if (o.kind === 'StatefulSet') { const v = stsView(o); r.status = { replicas: v.total, readyReplicas: v.ready, updatedReplicas: v.updated }; }
      if (o.kind === 'Job') { const v = jobView(o); r.status = { active: v.active || undefined, succeeded: v.succeeded || undefined, failed: v.failed || undefined }; }
      if (o.kind === 'Pod') { const v = podView(o); r.status = { phase: v.phase, hostIP: (get('Node', o.sim.node) || { sim: {} }).sim.ip, podIP: o.sim.ip, containerStatuses: [{ name: o.spec.containers[0].name, image: o.spec.containers[0].image, ready: v.ready, restartCount: v.restarts, state: { [v.state.toLowerCase()]: v.reason ? { reason: v.reason } : {} } }] }; }
      if (o.kind === 'Deployment') { const v = depView(o); r.status = { replicas: v.total, updatedReplicas: v.updated, readyReplicas: v.ready, availableReplicas: v.available }; }
      if (o.kind === 'Service') r.status = { loadBalancer: {} };
      return r;
    }
    function jsonPath(obj, expr) {
      const m = String(expr).replace(/^'|'$/g, '').match(/^\{(.*)\}$/);
      if (!m) return null;
      const path = m[1].replace(/^\./, '');
      const walk = (v, parts) => {
        if (!parts.length) return [v];
        const [hd, ...tl] = parts;
        const am = hd.match(/^([\w-]*)\[(\*|\d+)\]$/);
        if (am) { const arr = am[1] ? (v || {})[am[1]] : v; if (!Array.isArray(arr)) return []; return (am[2] === '*' ? arr : [arr[+am[2]]]).flatMap((x) => walk(x, tl)); }
        return v && typeof v === 'object' && hd in v ? walk(v[hd], tl) : [];
      };
      const parts = path.match(/(?:\\\.|[^.])+/g) || [];
      return walk(obj, parts.map((x) => x.replace(/\\\./g, '.'))).map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
    }

    // ---------- Áp dụng manifest ----------
    function validate(doc, src) {
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { err: `error: error validating "${src}": error validating data: invalid object to validate` };
      if (!doc.kind) return { err: `error: error validating "${src}": error validating data: kind not set; if you choose to ignore these errors, turn validation off with --validate=false` };
      if (!doc.apiVersion) return { err: `error: error validating "${src}": error validating data: apiVersion not set; if you choose to ignore these errors, turn validation off with --validate=false` };
      if (!API[doc.kind]) return { err: `error: resource mapping not found for name: "${(doc.metadata || {}).name || ''}" namespace: "" from "${src}": no matches for kind "${doc.kind}" in version "${doc.apiVersion}"\nensure CRDs are installed first`, hint: `Kind "${doc.kind}" không tồn tại. Viết hoa đúng: Pod, Deployment, Service, ConfigMap, Secret, Ingress, HorizontalPodAutoscaler.` };
      if (!API[doc.kind].includes(doc.apiVersion)) return { err: `error: resource mapping not found for name: "${(doc.metadata || {}).name || ''}" namespace: "" from "${src}": no matches for kind "${doc.kind}" in version "${doc.apiVersion}"\nensure CRDs are installed first`, hint: `${doc.kind} dùng apiVersion: ${API[doc.kind][0]}` };
      const name = doc.metadata && doc.metadata.name;
      if (!name) return { err: `error: error when retrieving current configuration of:\nResource: "${PLURAL[doc.kind]}", GroupVersionKind: "${doc.apiVersion}, Kind=${doc.kind}"\nName: "", Namespace: "${state.ns}"\nfrom server for: "${src}": resource name may not be empty`, hint: 'Thiếu metadata.name.' };
      const uf = unknownField(doc, SCHEMA[doc.kind], '');
      if (uf) return { err: `Error from server (BadRequest): error when creating "${src}": ${doc.kind} in version "${doc.apiVersion.split('/').pop()}" cannot be handled as a ${doc.kind}: strict decoding error: unknown field "${uf}"`, hint: `Trường "${uf}" không có trong ${doc.kind}. Kiểm tra chính tả và thụt lề (trường có thể đang nằm sai cấp).` };
      if (!/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name) || name.length > 63) return { err: `The ${doc.kind} "${name}" is invalid: metadata.name: Invalid value: "${name}": a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')`, hint: 'Tên chỉ gồm chữ thường, số và dấu "-".' };
      const pre = `The ${doc.kind} "${name}" is invalid: `;
      const WORKLOAD = ['Deployment', 'StatefulSet', 'Job'];
      const podSpec = doc.kind === 'Pod' ? doc.spec : WORKLOAD.includes(doc.kind) ? doc.spec && doc.spec.template && doc.spec.template.spec : null;
      if (doc.kind === 'Pod' || WORKLOAD.includes(doc.kind)) {
        if (doc.kind === 'Deployment' || doc.kind === 'StatefulSet') {
          if (!doc.spec || !doc.spec.selector) return { err: pre + 'spec.selector: Required value', hint: `${doc.kind} cần spec.selector.matchLabels khớp với nhãn của template.` };
          const tl = (doc.spec.template && doc.spec.template.metadata && doc.spec.template.metadata.labels) || {};
          if (!matchLabels(tl, doc.spec.selector.matchLabels)) return { err: pre + `spec.template.metadata.labels: Invalid value: ${goMap(tl)}: \`selector\` does not match template \`labels\``, hint: `spec.selector.matchLabels phải là tập con của spec.template.metadata.labels — đó là cách ${doc.kind} nhận ra Pod của mình.` };
        }
        if (doc.kind === 'Job') {
          const rp = podSpec && podSpec.restartPolicy;
          if (!rp) return { err: pre + 'spec.template.spec.restartPolicy: Required value: valid values: "OnFailure", "Never"', hint: 'Job cần restartPolicy: Never (tạo Pod mới khi lỗi) hoặc OnFailure (khởi động lại container trong cùng Pod).' };
          if (rp !== 'Never' && rp !== 'OnFailure') return { err: pre + `spec.template.spec.restartPolicy: Unsupported value: "${rp}": supported values: "OnFailure", "Never"`, hint: 'Job phải kết thúc nên không dùng restartPolicy: Always.' };
        }
        const sp = doc.kind === 'Pod' ? 'spec' : 'spec.template.spec';
        if (!podSpec || !Array.isArray(podSpec.containers) || !podSpec.containers.length) return { err: pre + `${sp}.containers: Required value` };
        for (let i = 0; i < podSpec.containers.length; i++) {
          const c = podSpec.containers[i];
          if (!c.name) return { err: pre + `${sp}.containers[${i}].name: Required value` };
          if (!c.image) return { err: pre + `${sp}.containers[${i}].image: Required value` };
          for (const k of ['requests', 'limits']) for (const r of ['cpu', 'memory']) { const q = c.resources && c.resources[k] && c.resources[k][r]; if (q !== undefined && qty(q) === null) return { err: pre + `${sp}.containers[${i}].resources.${k}[${r}]: Invalid value: "${q}": must match the regex ^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$`, hint: 'Đơn vị hợp lệ: cpu "250m" hoặc "1"; memory "128Mi", "1Gi".' }; }
          for (const m of c.volumeMounts || []) if (!(podSpec.volumes || []).some((x) => x.name === m.name) && !(doc.kind === 'StatefulSet' && (doc.spec.volumeClaimTemplates || []).some((t) => t.metadata && t.metadata.name === m.name))) return { err: pre + `${sp}.containers[${i}].volumeMounts[0].name: Not found: "${m.name}"`, hint: `volumeMounts "${m.name}" phải trùng tên một mục trong ${sp}.volumes${doc.kind === 'StatefulSet' ? ' hoặc volumeClaimTemplates' : ''}.` };
        }
      }
      const pvcSpecErr = (s, path) => {
        if (!s || !s.accessModes || !s.accessModes.length) return { err: pre + `${path}.accessModes: Required value`, hint: 'Thêm accessModes: ["ReadWriteOnce"].' };
        const st = s.resources && s.resources.requests && s.resources.requests.storage;
        if (!st) return { err: pre + `${path}.resources[storage]: Required value`, hint: 'Thêm resources.requests.storage, ví dụ 1Gi.' };
        if (qty(st) === null) return { err: pre + `${path}.resources.requests[storage]: Invalid value: "${st}": quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'`, hint: 'Dung lượng dạng 1Gi, 500Mi.' };
        return null;
      };
      if (doc.kind === 'PersistentVolumeClaim') { const e = pvcSpecErr(doc.spec, 'spec'); if (e) return e; }
      if (doc.kind === 'StatefulSet') for (let i = 0; i < (doc.spec.volumeClaimTemplates || []).length; i++) { const t = doc.spec.volumeClaimTemplates[i]; if (!t.metadata || !t.metadata.name) return { err: pre + `spec.volumeClaimTemplates[${i}].metadata.name: Required value` }; const e = pvcSpecErr(t.spec, `spec.volumeClaimTemplates[${i}].spec`); if (e) return e; }
      if (doc.kind === 'Role' || doc.kind === 'ClusterRole') for (let i = 0; i < (doc.rules || []).length; i++) if (!(doc.rules[i].verbs || []).length) return { err: pre + `rules[${i}].verbs: Required value: verbs must contain at least one value` };
      if ((doc.kind === 'RoleBinding' || doc.kind === 'ClusterRoleBinding') && (!doc.roleRef || !doc.roleRef.name || !doc.roleRef.kind)) return { err: pre + 'roleRef.name: Required value', hint: 'roleRef cần kind (Role hoặc ClusterRole), name và apiGroup: rbac.authorization.k8s.io.' };
      if (doc.kind === 'ClusterRoleBinding' && doc.roleRef.kind !== 'ClusterRole') return { err: pre + `roleRef.kind: Unsupported value: "${doc.roleRef.kind}": supported values: "ClusterRole"` };
      if (doc.kind === 'Service') {
        if (!doc.spec || !Array.isArray(doc.spec.ports) || !doc.spec.ports.length) return { err: pre + 'spec.ports: Required value' };
        for (const x of doc.spec.ports) if (x.nodePort !== undefined && (x.nodePort < 30000 || x.nodePort > 32767)) return { err: pre + `spec.ports[0].nodePort: Invalid value: ${x.nodePort}: provided port is not in the valid range. The range of valid ports is 30000-32767` };
      }
      if (doc.kind === 'Secret' && doc.data) { for (const [k, v] of Object.entries(doc.data)) { try { unb64(String(v)); } catch (e) { return { err: `Error from server (BadRequest): error when creating "${src}": Secret in version "v1" cannot be handled as a Secret: ${e.message}`, hint: `Giá trị trong "data" phải mã hóa base64 (khóa "${k}"). Muốn ghi chữ thường thì dùng "stringData".` }; } } }
      if (doc.kind === 'Ingress') {
        for (const r of (doc.spec && doc.spec.rules) || []) for (const pp of ((r.http || {}).paths || [])) if (!pp.pathType) return { err: pre + 'spec.rules[0].http.paths[0].pathType: Required value: pathType must be specified', hint: 'Thêm pathType: Prefix (hoặc Exact).' };
      }
      return { ok: true };
    }
    function applyDoc(doc, src, verb = 'apply') {
      const v = validate(doc, src);
      if (v.err) { err(v.err); if (v.hint) hint(v.hint); return false; }
      const ns = doc.metadata.namespace || state.ns;
      if (namespaced(doc.kind) && !get('Namespace', ns)) { err(`Error from server (NotFound): error when creating "${src}": namespaces "${ns}" not found`); return false; }
      reapPod(doc.kind, doc.metadata.name, ns);
      const exist = get(doc.kind, doc.metadata.name, ns);
      const label = `${typeName(doc.kind)}/${doc.metadata.name}`;
      const body = clone(doc);
      if (doc.kind === 'Secret') { body.data = Object.assign({}, body.data); Object.entries(body.stringData || {}).forEach(([k, val]) => (body.data[k] = b64(String(val)))); delete body.stringData; body.type = body.type || 'Opaque'; }
      if (doc.kind === 'ConfigMap') { body.data = Object.fromEntries(Object.entries(body.data || {}).map(([k, val]) => [k, String(val)])); }
      const TOP = ['rules', 'roleRef', 'subjects', 'provisioner', 'reclaimPolicy', 'volumeBindingMode', 'allowVolumeExpansion', 'parameters'];
      const snap = (o) => JSON.stringify([o.spec, o.data, o.metadata.labels, ...TOP.map((k) => o[k])]);
      if (exist) {
        if (verb === 'create') { err(`Error from server (AlreadyExists): error when creating "${src}": ${PLURAL[doc.kind]} "${doc.metadata.name}" already exists`); hint('Dùng kubectl apply -f để cập nhật đối tượng đã có.'); return false; }
        const before = snap(exist);
        if (doc.kind === 'Job') {
          // Template của Job bất biến: muốn chạy cấu hình mới phải xóa Job cũ
          if (JSON.stringify(body.spec.template) !== exist.sim.tplSrc) { err(`The Job "${doc.metadata.name}" is invalid: spec.template: Invalid value: core.PodTemplateSpec{...}: field is immutable`); hint(`Không sửa được Job đã tạo. Xóa rồi tạo lại: kubectl delete job ${doc.metadata.name} && kubectl apply -f ${src || 'FILE'}`); return false; }
          p(`${label} unchanged`);
          return true;
        }
        if (doc.kind === 'PersistentVolumeClaim') {
          const s0 = JSON.stringify(Object.assign({}, exist.spec, { resources: null, storageClassName: null, volumeMode: null })), s1 = JSON.stringify(Object.assign({}, exist.spec, body.spec, { resources: null, storageClassName: null, volumeMode: null }));
          if (s0 !== s1 || (body.spec.storageClassName && body.spec.storageClassName !== exist.spec.storageClassName)) { err(`The PersistentVolumeClaim "${doc.metadata.name}" is invalid: spec: Forbidden: spec is immutable after creation except resources.requests and volumeAttributesClassName for bound claims`); hint('Muốn đổi accessModes hay storageClassName phải tạo PVC mới (và chuyển dữ liệu).'); return false; }
          if (String(body.spec.resources.requests.storage) !== String(exist.spec.resources.requests.storage)) { const sc = scOf(exist); if (!sc || !sc.allowVolumeExpansion) { err(`Error from server (Forbidden): error when applying patch to "${src}": persistentvolumeclaims "${doc.metadata.name}" is forbidden: only dynamically provisioned pvc can be resized and the storageclass that provisions the pvc must support resize`); hint(`StorageClass "${exist.spec.storageClassName}" có allowVolumeExpansion: false nên không tăng dung lượng được.`); return false; } exist.spec.resources = body.spec.resources; }
          p(`${label} ${before === snap(exist) ? 'unchanged' : 'configured'}`);
          return true;
        }
        if (doc.kind === 'Pod') {
          const strip = (s) => { const c = clone(s); (c.containers || []).forEach((x) => delete x.image); return JSON.stringify(c); };
          if (strip(exist.spec) !== strip(body.spec)) { err(`The Pod "${doc.metadata.name}" is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\`,\`spec.initContainers[*].image\`,\`spec.activeDeadlineSeconds\`,\`spec.tolerations\` (only additions to existing tolerations),\`spec.terminationGracePeriodSeconds\` (allow it to be set to 1 if it was previously negative)`); hint('Pod gần như bất biến. Xóa rồi tạo lại (kubectl delete pod ... rồi apply), hoặc tốt hơn: dùng Deployment.'); return false; }
          if (exist.spec.containers[0].image !== body.spec.containers[0].image) { exist.spec = body.spec; exist.sim.img = imgInfo(body.spec.containers[0].image); exist.sim.beh = null; exist.sim.envOk = null; exist.metadata.created = T() - 0; }
        }
        if ((doc.kind === 'Deployment' || doc.kind === 'StatefulSet') && JSON.stringify(exist.spec.selector) !== JSON.stringify(body.spec.selector)) { err(`The ${doc.kind} "${doc.metadata.name}" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:${goMap(body.spec.selector.matchLabels)}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable`); hint(`Selector của ${doc.kind} không đổi được sau khi tạo. Xóa ${doc.kind} rồi tạo lại.`); return false; }
        if (doc.kind === 'StatefulSet') {
          const fixed = (s) => canon(Object.assign({}, s, { replicas: null, template: null, updateStrategy: null, persistentVolumeClaimRetentionPolicy: null, minReadySeconds: null, ordinals: null }));
          if (fixed(exist.spec) !== fixed(body.spec)) { err(`The StatefulSet "${doc.metadata.name}" is invalid: spec: Forbidden: updates to statefulset spec for fields other than 'replicas', 'ordinals', 'template', 'updateStrategy', 'persistentVolumeClaimRetentionPolicy' and 'minReadySeconds' are forbidden`); hint('volumeClaimTemplates, serviceName... không sửa được. Xóa StatefulSet (PVC vẫn giữ) rồi tạo lại: kubectl delete sts ' + doc.metadata.name); return false; }
          if (body.spec.replicas === undefined) body.spec.replicas = 1;
        }
        if (doc.kind === 'Service') { body.spec.clusterIP = exist.spec.clusterIP; (body.spec.ports || []).forEach((x, i) => { if (body.spec.type && body.spec.type !== 'ClusterIP' && !x.nodePort) x.nodePort = ((exist.spec.ports || [])[i] || {}).nodePort || npN++; }); }
        if (doc.kind !== 'Pod') { exist.spec = body.spec; if (body.data) exist.data = body.data; TOP.forEach((k) => { if (body[k] !== undefined) exist[k] = body[k]; }); }
        exist.metadata.labels = body.metadata.labels || {};
        exist.metadata.annotations = Object.assign({}, exist.metadata.annotations, body.metadata.annotations || {});
        p(`${label} ${before === snap(exist) ? 'unchanged' : 'configured'}`);
        return true;
      }
      const extra = {};
      TOP.forEach((k) => { if (body[k] !== undefined) extra[k] = body[k]; });
      const o = add(doc.kind, { name: doc.metadata.name, namespace: ns, labels: body.metadata.labels || {}, annotations: body.metadata.annotations || {} }, Object.assign({ spec: body.spec, data: body.data, type: body.type }, extra));
      if (doc.kind === 'Pod') { removeObj(o); createPod({ metadata: { labels: o.metadata.labels, annotations: o.metadata.annotations }, spec: o.spec }, ns, null, o.metadata.name); }
      if (doc.kind === 'Service') {
        o.spec.type = o.spec.type || 'ClusterIP';
        o.spec.clusterIP = doc.spec.clusterIP === 'None' ? 'None' : `10.96.${100 + Math.floor(svcN / 250)}.${svcN++ % 250 + 1}`;
        o.spec.ports.forEach((x) => { x.protocol = x.protocol || 'TCP'; if (x.targetPort === undefined) x.targetPort = x.port; if (o.spec.type !== 'ClusterIP' && !x.nodePort) x.nodePort = npN++; });
      }
      if ((doc.kind === 'Deployment' || doc.kind === 'StatefulSet') && o.spec.replicas === undefined) o.spec.replicas = 1;
      if (doc.kind === 'Namespace') nsDefaults(o.metadata.name);
      if (doc.kind === 'PersistentVolumeClaim') { o.spec.volumeMode = o.spec.volumeMode || 'Filesystem'; if (!o.spec.storageClassName && defaultSC()) o.spec.storageClassName = defaultSC().metadata.name; }
      if (doc.kind === 'Job') {
        // Controller tự gắn nhãn nhận diện Pod của Job (controller-uid, job-name)
        o.sim.tplSrc = JSON.stringify(doc.spec.template);
        const lb = { 'batch.kubernetes.io/controller-uid': o.metadata.uid, 'batch.kubernetes.io/job-name': o.metadata.name, 'controller-uid': o.metadata.uid, 'job-name': o.metadata.name };
        o.spec.selector = { matchLabels: { 'batch.kubernetes.io/controller-uid': o.metadata.uid } };
        o.spec.template.metadata = o.spec.template.metadata || {};
        o.spec.template.metadata.labels = Object.assign({}, o.spec.template.metadata.labels, lb);
        o.spec.backoffLimit = o.spec.backoffLimit ?? 6; o.spec.completions = o.spec.completions ?? 1; o.spec.parallelism = o.spec.parallelism ?? 1;
      }
      p(`${label} created`);
      return true;
    }
    function applyFile(name, verb) {
      const key = String(name).replace(/^\.\//, '');
      if (typeof files[key] !== 'string') { err(`error: the path "${name}" does not exist`); hint(`Không có file "${name}" trong thư mục lab. Gõ ls để xem danh sách file.`); return false; }
      let docs;
      try { docs = YAML.parseAll(files[key]).filter((d) => d !== null && d !== undefined); }
      catch (e) { err(`error: error parsing ${name}: error converting YAML to JSON: ${e.message}`); hint(`YAML sai ở dòng ${e.line}. Thường do thụt lề không đều (chỉ dùng dấu cách) hoặc thiếu dấu ":".`); emit('event', { type: 'fileError', file: key, line: e.line }); return false; }
      if (!docs.length) { err(`error: no objects passed to ${verb}`); return false; }
      let ok = true;
      docs.forEach((d) => { if (!applyDoc(d, name, verb)) ok = false; });
      return ok;
    }

    // ---------- Shell bên trong Pod ----------
    function podFile(pod, path) {
      for (const vm of pod.spec.containers[0].volumeMounts || []) {
        const vol = (pod.spec.volumes || []).find((x) => x.name === vm.name);
        if (!vol) continue;
        const base = vm.mountPath.replace(/\/$/, '');
        const src = vol.configMap ? get('ConfigMap', vol.configMap.name, pod.metadata.namespace) : vol.secret ? get('Secret', vol.secret.secretName, pod.metadata.namespace) : null;
        if (!src) continue;
        const data = vol.secret ? Object.fromEntries(Object.entries(src.data || {}).map(([k, v]) => [k, unb64(v)])) : src.data || {};
        if (path === base) return { dir: Object.keys(data) };
        if (path.startsWith(base + '/') && data.hasOwnProperty(path.slice(base.length + 1))) return { content: data[path.slice(base.length + 1)] };
      }
      const st = storeFor(pod, path), p0 = path.replace(/\/$/, '');
      if (st.store) {
        if (st.store.files[path] !== undefined) return { content: st.store.files[path] };
        const kids = Object.keys(st.store.files).filter((f) => f.startsWith(p0 + '/')).map((f) => f.slice(p0.length + 1).split('/')[0]);
        const isRedisDir = pod.sim.img && pod.sim.img.kind === 'redis' && p0 === '/data';
        if (isRedisDir && Object.keys(st.store.redis).length) kids.push('dump.rdb');
        if (kids.length || st.base === p0 || isRedisDir) return { dir: [...new Set(kids)].sort() };
      }
      if (path === '/etc/hostname') return { content: pod.metadata.name };
      if (path === '/etc/resolv.conf') return { content: `search ${pod.metadata.namespace}.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.96.0.10\noptions ndots:5` };
      if (pod.sim.img.kind === 'nginx' && path === '/usr/share/nginx/html/index.html') return { content: NGINX_PAGE };
      return null;
    }
    function podCmd(pod, tok) {
      const out = [], v = podView(pod), env = Object.assign({ HOSTNAME: pod.metadata.name, KUBERNETES_SERVICE_HOST: '10.96.0.1', KUBERNETES_SERVICE_PORT: '443', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }, pod.sim.env || {});
      // Kubernetes tự thêm biến <SERVICE>_SERVICE_HOST cho các Service có sẵn lúc Pod khởi động
      list('Service', pod.metadata.namespace).filter((s) => s.metadata.created <= (v.startedAt || T())).forEach((s) => { const k = s.metadata.name.toUpperCase().replace(/-/g, '_'); env[`${k}_SERVICE_HOST`] = s.spec.clusterIP; env[`${k}_SERVICE_PORT`] = String(s.spec.ports[0].port); });
      const sh = (v.beh && v.beh.shell) || 'sh';
      const cmd = (tok[0] || '').split('/').pop(), a = tok.slice(1);
      const has = (c) => ({ bash: sh === 'bash', sh: !!sh, ash: sh === 'sh' }[c]);
      if (!cmd) return { lines: out, code: 0 };
      // Chuyển hướng "> file" / ">> file" bên trong container: ghi vào đúng nơi lưu (PVC, emptyDir hay lớp ghi của container)
      const gi = tok.findIndex((x) => x === '>' || x === '>>');
      if (gi >= 0) {
        const target = tok[gi + 1];
        if (!target) return { lines: [{ text: `${sh}: syntax error: unexpected newline`, cls: 'err' }], code: 2 };
        const r = podCmd(pod, tok.slice(0, gi));
        if (r.code) return r;
        const st = storeFor(pod, target);
        if (!st.store) return { lines: [{ text: `${sh}: can't create ${target}: Read-only file system`, cls: 'err' }], code: 1 };
        const text = r.lines.map((l) => l.text).join('\n') + '\n';
        st.store.files[target] = tok[gi] === '>>' ? (st.store.files[target] || '') + text : text;
        return { lines: [], code: 0, meta: { wrote: target, store: st.kind } };
      }
      if (['sh', 'bash', 'ash'].includes(cmd) && !has(cmd)) return { lines: [{ text: `OCI runtime exec failed: exec failed: unable to start container process: exec: "${tok[0]}": executable file not found in $PATH: unknown`, cls: 'err' }], code: 126, hintText: `Image này không có ${cmd}. Thử sh thay thế.` };
      if (['env', 'printenv'].includes(cmd)) { (a[0] ? [a[0]] : Object.keys(env).sort()).forEach((k) => { if (env[k] !== undefined) out.push({ text: a[0] ? env[k] : `${k}=${env[k]}` }); }); return { lines: out, code: a[0] && env[a[0]] === undefined ? 1 : 0 }; }
      if (cmd === 'hostname') return { lines: [{ text: pod.metadata.name }], code: 0 };
      if (cmd === 'echo') return { lines: [{ text: a.join(' ').replace(/\$\{?(\w+)\}?/g, (m, k) => env[k] || '') }], code: 0 };
      if (cmd === 'cat') { const f = podFile(pod, a[0] || ''); if (!f || f.dir) return { lines: [{ text: `cat: ${a[0]}: ${f && f.dir ? 'Is a directory' : 'No such file or directory'}`, cls: 'err' }], code: 1 }; f.content.split('\n').forEach((l) => out.push({ text: l })); return { lines: out, code: 0 }; }
      if (cmd === 'ls') { const f = podFile(pod, (a.filter((x) => !x.startsWith('-'))[0] || '/').replace(/\/$/, '') || '/'); if (f && f.dir) return { lines: [{ text: f.dir.join('  ') }], code: 0 }; if (f) return { lines: [{ text: a[0] }], code: 0 }; return { lines: [{ text: 'bin  dev  etc  home  lib  proc  root  run  sys  tmp  usr  var' }], code: 0 }; }
      if (cmd === 'nslookup' || cmd === 'host' || cmd === 'dig') {
        const name = a[0] || '', ns = pod.metadata.namespace;
        const ph = resolvePodHost(name, ns);
        const svc = !ph && resolveSvc(name, ns);
        out.push({ text: 'Server:\t\t10.96.0.10' }, { text: 'Address:\t10.96.0.10:53' }, { text: '' });
        const nx = () => { out.push({ text: `** server can't find ${name}.${ns}.svc.cluster.local: NXDOMAIN`, cls: 'err' }); return { lines: out, code: 1, meta: { dns: name, ok: false } }; };
        if (ph) { out.push({ text: `Name:\t${ph.spec.hostname}.${ph.spec.subdomain}.${ph.metadata.namespace}.svc.cluster.local` }, { text: `Address: ${ph.sim.ip}` }); return { lines: out, code: 0, meta: { dns: name, pod: ph.metadata.name, ok: true } }; }
        if (!svc) return nx();
        const fq = `${svc.metadata.name}.${svc.metadata.namespace}.svc.cluster.local`;
        if (svc.spec.clusterIP === 'None') {
          // Headless: DNS trả về thẳng IP của từng Pod sẵn sàng thay vì một IP ảo
          const eps = endpoints(svc);
          if (!eps.length) return nx();
          eps.forEach((pd) => out.push({ text: `Name:\t${fq}` }, { text: `Address: ${pd.sim.ip}` }));
          return { lines: out, code: 0, meta: { dns: name, headless: true, ok: true } };
        }
        out.push({ text: `Name:\t${fq}` }, { text: `Address: ${svc.spec.clusterIP}` });
        return { lines: out, code: 0, meta: { dns: name, ok: true } };
      }
      if (cmd === 'curl' || cmd === 'wget') {
        const url = a.filter((x) => !x.startsWith('-') && x !== '-O-' && x !== '-')[0];
        if (!url) return { lines: [{ text: `${cmd}: missing URL`, cls: 'err' }], code: 2 };
        if (cmd === 'curl' && !['nginx', 'web', 'model'].includes(pod.sim.img.kind) && pod.sim.img.kind !== 'shell') return { lines: [{ text: `sh: curl: not found`, cls: 'err' }], code: 127 };
        const r = http(url, pod);
        state.requests.push({ t: T(), from: pod.metadata.name, url, code: r.code, pod: r.pod, svc: r.svc && r.svc.metadata.name, count: r.count });
        if (r.code === 0) return { lines: [{ text: cmd === 'wget' ? `wget: ${r.exit === 6 ? 'bad address' : "can't connect to remote host"} '${url.replace(/^https?:\/\//, '').split(/[/:]/)[0]}'` : `curl: (${r.exit || 7}) ${r.err}`, cls: 'err' }], code: 1, hintText: r.otherNs ? `Service "${url}" nằm ở namespace "${r.otherNs}". Gọi bằng ${url}.${r.otherNs} (hoặc ${url}.${r.otherNs}.svc.cluster.local).` : r.noEndpoints ? 'Service không có Pod nào sẵn sàng (endpoints rỗng). Kiểm tra selector và trạng thái READY của Pod.' : null, meta: { code: 0 } };
        if (cmd === 'wget' && r.code >= 400) return { lines: [{ text: `wget: server returned error: HTTP/1.1 ${r.code} ${{ 404: 'Not Found', 500: 'Internal Server Error', 503: 'Service Unavailable' }[r.code] || 'Error'}`, cls: 'err' }], code: 1 };
        r.body.split('\n').forEach((l) => out.push({ text: l }));
        return { lines: out, code: r.code < 400 || cmd === 'curl' ? 0 : 22, meta: { code: r.code, pod: r.pod } };
      }
      if (cmd === 'ps') return { lines: [{ text: 'PID   USER     TIME  COMMAND' }, { text: `    1 root      0:00 ${pod.spec.containers[0].command ? pod.spec.containers[0].command.join(' ') : pod.sim.img.kind}` }], code: 0 };
      if (cmd === 'sleep' || cmd === 'true') return { lines: [], code: 0 };
      if (cmd === 'redis-cli') {
        if (pod.sim.img.kind !== 'redis') return { lines: [{ text: `${sh}: redis-cli: not found`, cls: 'err' }], code: 127 };
        const args = a.slice();
        let target = pod;
        const hi = args.indexOf('-h');
        if (hi >= 0) {
          const h = args[hi + 1] || '';
          args.splice(hi, 2);
          const rt = redisTarget(h, pod.metadata.namespace);
          if (!rt.pod) return { lines: [{ text: `Could not connect to Redis at ${h}:6379: ${rt.err}`, cls: 'err' }], code: 1 };
          target = rt.pod;
        }
        const pi = args.indexOf('-p');
        if (pi >= 0) args.splice(pi, 2);
        const st = redisStore(target), op = (args[0] || '').toLowerCase(), k = args[1];
        const meta = { redis: op, key: k, pod: target.metadata.name, podUid: target.metadata.uid, store: storeFor(target, '/data').kind };
        const R = (text, extra) => ({ lines: [{ text }], code: 0, meta: Object.assign(meta, extra || {}) });
        const argErr = () => ({ lines: [{ text: `(error) ERR wrong number of arguments for '${op}' command`, cls: 'err' }], code: 0 });
        switch (op) {
          case '': return { lines: [{ text: '(mô phỏng) Chế độ tương tác chưa hỗ trợ — gõ lệnh trực tiếp, ví dụ: redis-cli set ten Lan', cls: 'hint' }], code: 0 };
          case 'ping': return R('PONG');
          case 'set': if (args.length < 3) return argErr(); st[k] = args.slice(2).join(' '); return R('OK');
          case 'get': if (args.length !== 2) return argErr(); return st[k] === undefined ? R('(nil)', { found: false }) : R(`"${st[k]}"`, { found: true, value: st[k] });
          case 'incr': { if (args.length !== 2) return argErr(); const n = (parseInt(st[k] || '0', 10) || 0) + 1; st[k] = String(n); return R(`(integer) ${n}`); }
          case 'del': { const n = args.slice(1).filter((x) => x in st).length; args.slice(1).forEach((x) => delete st[x]); return R(`(integer) ${n}`); }
          case 'keys': { const re = new RegExp('^' + (k || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); const ks = Object.keys(st).filter((x) => re.test(x)).sort(); return { lines: ks.length ? ks.map((x, i) => ({ text: `${i + 1}) "${x}"` })) : [{ text: '(empty array)' }], code: 0, meta }; }
          case 'dbsize': return R(`(integer) ${Object.keys(st).length}`);
          case 'flushall': case 'flushdb': Object.keys(st).forEach((x) => delete st[x]); return R('OK');
          case 'save': return R('OK');
          case 'bgsave': return R('Background saving started');
          default: return { lines: [{ text: `(error) ERR unknown command '${args[0]}', with args beginning with: ${args.slice(1).map((x) => `'${x}' `).join('')}`, cls: 'err' }], code: 0 };
        }
      }
      return { lines: [{ text: `${sh || 'sh'}: ${cmd}: not found`, cls: 'err' }], code: 127 };
    }

    // ---------- kubectl ----------
    const COMMON = { value: ['n', 'o', 'l', 'f'], bool: ['A', 'w', 'show-labels'], multi: [], alias: { namespace: 'n', output: 'o', selector: 'l', filename: 'f', 'all-namespaces': 'A', watch: 'w' } };
    const spec = (extra = {}) => ({ value: [...COMMON.value, ...(extra.value || [])], bool: [...COMMON.bool, ...(extra.bool || [])], multi: [...(extra.multi || [])], alias: Object.assign({}, COMMON.alias, extra.alias || {}) });
    function parse(tokens, sp) {
      const a = SH.parseArgs(tokens, sp);
      if (a.error) { err(`error: ${a.error}`); p("See 'kubectl --help' for usage."); return null; }
      return a;
    }
    function nsOf(a) {
      const ns = a.flags.n || state.ns;
      if (!get('Namespace', ns)) { return { ns, missing: true }; }
      return { ns };
    }
    // "deploy/web", "deployment web", "pod web" → { kind, name }
    function resRef(args) {
      if (!args.length) return { err: 'error: you must specify the type of resource to get. ' };
      if (args[0].includes('/')) { const [k, n] = args[0].split('/'); return KINDS[k.toLowerCase().split('.')[0]] ? { kind: KINDS[k.toLowerCase().split('.')[0]], name: n, rest: args.slice(1) } : { badType: k }; }
      const k = KINDS[args[0].toLowerCase().split('.')[0]];
      if (!k) return { badType: args[0] };
      return { kind: k, name: args[1], names: args.slice(1), rest: args.slice(2) };
    }
    const notFound = (kind, name) => err(`Error from server (NotFound): ${PLURAL[kind]} "${name}" not found`);
    const badType = (t) => { err(`error: the server doesn't have a resource type "${t}"`); const best = Object.keys(KINDS).find((k) => k.startsWith(t.slice(0, 3).toLowerCase())); if (best) hint(`Có phải ý bạn là "${best}"? Xem danh sách: kubectl api-resources`); };

    function cmdGet(rest) {
      const a = parse(rest, spec({ bool: ['no-headers'] })); if (!a) return false;
      const { ns, missing } = nsOf(a);
      if (!a.args.length) { err('You must specify the type of resource to get. Use "kubectl api-resources" for a complete list of supported resources.'); return false; }
      if (a.flags.w) hint('(mô phỏng) Chế độ -w không giữ terminal; trạng thái tự cập nhật theo thời gian thật — gõ lại lệnh để xem mới nhất, hoặc nhìn sơ đồ.');
      let types = a.args[0].toLowerCase().split(',');
      const isAll = types.includes('all'), multi = types.length > 1;
      types = types.flatMap((t) => (t === 'all' ? ['pods', 'services', 'deployments', 'replicasets', 'statefulsets', 'jobs', 'hpa'] : [t]));
      const out = (rows) => SH.table(a.flags['no-headers'] ? rows.slice(1) : rows).forEach((l, i) => p(l, i === 0 && !a.flags['no-headers'] ? 'head' : ''));
      const sel = a.flags.l ? parseSelector(a.flags.l) : null;
      let any = false;
      for (let ti = 0; ti < types.length; ti++) {
        const tp = types[ti].split('/');
        const kind = KINDS[tp[0].split('.')[0]];
        if (!kind) { badType(types[ti]); return false; }
        const name = tp[1] || (types.length === 1 ? a.args[1] : undefined);
        if (kind === 'Event') {
          const evs = allEvents(a.flags.A ? null : ns).sort((x, y) => x.at - y.at);
          if (!evs.length) { p(`No resources found in ${ns} namespace.`); return true; }
          out([['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'], ...evs.slice(-40).map((e) => [age(T() - e.at), e.type, e.reason, `${e.kind.toLowerCase()}/${e.name}`, e.msg])]);
          return true;
        }
        if (missing && namespaced(kind) && !a.flags.A) { if (!isAll && !multi) { p(`No resources found in ${ns} namespace.`); return true; } continue; }
        let objs = kind === 'Endpoints' ? list('Service', a.flags.A ? null : ns) : list(kind, a.flags.A ? null : ns);
        if (kind === 'Pod') objs = objs.filter((x) => a.flags.A || !x.sim.system || x.metadata.namespace !== 'default');
        if (sel) objs = objs.filter((x) => matchSel(x.metadata.labels || {}, sel));
        objs = objs.slice().sort((x, y) => (x.metadata.namespace || '').localeCompare(y.metadata.namespace || '') || x.metadata.name.localeCompare(y.metadata.name));
        if (name) {
          const names = types.length === 1 ? a.args.slice(1) : [name];
          const found = names.map((nm) => objs.find((x) => x.metadata.name === nm));
          const miss = names.filter((nm, i) => !found[i]);
          if (miss.length && !found.some(Boolean)) { miss.forEach((nm) => notFound(kind === 'Endpoints' ? 'Endpoints' : kind, nm)); if (kind === 'Pod' && list('Deployment', ns).some((d) => d.metadata.name === name)) hint(`"${name}" là tên Deployment; tên Pod có thêm hậu tố ngẫu nhiên. Dùng kubectl get pods để xem tên đầy đủ.`); return false; }
          objs = found.filter(Boolean);
        }
        if (!objs.length) { if (!isAll && !multi) { p(a.flags.A || !namespaced(kind) ? 'No resources found' : `No resources found in ${ns} namespace.`); return true; } continue; }
        const fmt = a.flags.o || '';
        if (fmt === 'yaml' || fmt === 'json') {
          const items = objs.map(exportObj);
          const v = items.length === 1 && name ? items[0] : { apiVersion: 'v1', kind: 'List', items };
          if (fmt === 'json') JSON.stringify(v, null, 2).split('\n').forEach((l) => p(l)); else toYaml(v).forEach((l) => p(l));
          return true;
        }
        if (fmt.startsWith('jsonpath')) {
          const expr = fmt.slice(fmt.indexOf('=') + 1);
          const items = objs.map(exportObj);
          const r = jsonPath(items.length === 1 && name ? items[0] : { items }, expr);
          if (r === null) { err(`error: error parsing jsonpath ${expr}, unrecognized character in action`); return false; }
          p(r);
          return true;
        }
        if (fmt === 'name') { objs.forEach((x) => p(`${typeName(kind)}/${x.metadata.name}`)); return true; }
        let rows = rowsFor(kind, objs, { all: !!a.flags.A && namespaced(kind), wide: fmt === 'wide' });
        if (isAll || multi) rows = [rows[0], ...rows.slice(1).map((r) => { const i = a.flags.A && namespaced(kind) ? 1 : 0; r = r.slice(); r[i] = `${typeName(kind)}/${r[i]}`; return r; })];
        if (a.flags['show-labels']) rows = rows.map((r, i) => [...r, i === 0 ? 'LABELS' : fmtLabels(objs[i - 1].metadata.labels)]);
        if (any) p('');
        out(rows);
        any = true;
      }
      if (!any) p(`No resources found in ${ns} namespace.`);
      return true;
    }
    function allEvents(ns) {
      const evs = state.events.filter((e) => ns === null || e.ns === ns).map((e) => Object.assign({ at: e.t }, e));
      list('Pod', ns).filter((pd) => !pd.sim.system).forEach((pd) => podView(pd).events.forEach((e) => evs.push(Object.assign({ kind: 'Pod', name: pd.metadata.name, ns: pd.metadata.namespace }, e))));
      return evs;
    }
    function evTable(evs) {
      if (!evs.length) return ['Events:              <none>'];
      return ['Events:', ...SH.table([['Type', 'Reason', 'Age', 'From', 'Message'], ['----', '------', '----', '----', '-------'], ...evs.sort((x, y) => x.at - y.at).map((e) => [e.type, e.reason, age(T() - e.at), e.from, e.msg])]).map((l) => '  ' + l)];
    }
    function describePod(pd) {
      const v = podView(pd), c = pd.spec.containers[0], L = [];
      const kv = (k, val) => L.push(`${(k + ':').padEnd(21)}${val}`);
      kv('Name', pd.metadata.name); kv('Namespace', pd.metadata.namespace); kv('Priority', 0); kv('Service Account', 'default');
      kv('Node', `${pd.sim.node}/${(get('Node', pd.sim.node) || { sim: {} }).sim.ip}`); kv('Start Time', new Date(pd.metadata.created).toUTCString().replace('GMT', '+0000'));
      kv('Labels', Object.entries(pd.metadata.labels || {}).map(([k, x]) => `${k}=${x}`).join('\n                     ') || '<none>');
      kv('Annotations', '<none>'); kv('Status', v.status === 'Terminating' ? 'Terminating (lasts 2s)' : v.phase); kv('IP', pd.sim.ip);
      if (pd.metadata.ownerKind) kv('Controlled By', `${pd.metadata.ownerKind}/${pd.metadata.ownerName}`);
      L.push('Containers:', `  ${c.name}:`, `    Container ID:   ${v.running ? 'containerd://' + SH.hash64(pd.metadata.uid).slice(0, 24) : ''}`, `    Image:          ${c.image}`, `    Port:           ${(c.ports || []).map((x) => x.containerPort + '/TCP').join(', ') || '<none>'}`);
      if (c.command) L.push(`    Command:\n      ${c.command.join('\n      ')}`);
      if (c.args) L.push(`    Args:\n      ${c.args.join('\n      ')}`);
      L.push(`    State:          ${v.state}`);
      if (v.reason && v.state !== 'Running') L.push(`      Reason:       ${v.reason}`);
      if (v.state === 'Running') L.push(`      Started:      ${new Date(v.startedAt).toUTCString().replace('GMT', '+0000')}`);
      if (v.last) L.push('    Last State:     Terminated', `      Reason:       ${v.last.reason}`, `      Exit Code:    ${v.last.code}`);
      L.push(`    Ready:          ${v.ready ? 'True' : 'False'}`, `    Restart Count:  ${v.restarts}`);
      const res = c.resources || {};
      if (res.limits) L.push('    Limits:', ...Object.entries(res.limits).map(([k, x]) => `      ${k}:  ${x}`));
      if (res.requests) L.push('    Requests:', ...Object.entries(res.requests).map(([k, x]) => `      ${k}:  ${x}`));
      const pr = (n, x) => x && L.push(`    ${n}:${' '.repeat(Math.max(1, 16 - n.length))}${x.httpGet ? `http-get http://:${x.httpGet.port}${x.httpGet.path || '/'}` : x.tcpSocket ? `tcp-socket :${x.tcpSocket.port}` : 'exec'} delay=${x.initialDelaySeconds || 0}s timeout=${x.timeoutSeconds || 1}s period=${x.periodSeconds || 10}s #success=1 #failure=${x.failureThreshold || 3}`);
      pr('Liveness', c.livenessProbe); pr('Readiness', c.readinessProbe);
      L.push('    Environment:');
      if (!(c.env || []).length && !(c.envFrom || []).length) L.push('      <none>');
      (c.envFrom || []).forEach((e) => L.push(`      ${e.configMapRef ? 'ConfigMap  ' + e.configMapRef.name : 'Secret  ' + e.secretRef.name}  ${e.configMapRef ? 'ConfigMap' : 'Secret'}  Optional: false`));
      (c.env || []).forEach((e) => L.push(`      ${e.name}:  ${e.value !== undefined ? e.value : e.valueFrom.configMapKeyRef ? `<set to the key '${e.valueFrom.configMapKeyRef.key}' of config map '${e.valueFrom.configMapKeyRef.name}'>  Optional: false` : e.valueFrom.secretKeyRef ? `<set to the key '${e.valueFrom.secretKeyRef.key}' in secret '${e.valueFrom.secretKeyRef.name}'>  Optional: false` : '(v1:' + (e.valueFrom.fieldRef || {}).fieldPath + ')'}`));
      L.push('    Mounts:', ...(c.volumeMounts || []).map((m) => `      ${m.mountPath} from ${m.name} (ro)`), '      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access (ro)');
      L.push('Conditions:', '  Type                        Status', `  PodReadyToStartContainers   ${v.status === 'ContainerCreating' ? 'False' : 'True'}`, `  Initialized                 True`, `  Ready                       ${v.ready ? 'True' : 'False'}`, `  ContainersReady             ${v.ready ? 'True' : 'False'}`, '  PodScheduled                True');
      if ((pd.spec.volumes || []).length) { L.push('Volumes:'); pd.spec.volumes.forEach((x) => L.push(`  ${x.name}:`, `    Type:      ${x.configMap ? 'ConfigMap (a volume populated by a ConfigMap)' : x.secret ? 'Secret (a volume populated by a Secret)' : 'EmptyDir'}`, ...(x.configMap ? [`    Name:      ${x.configMap.name}`] : x.secret ? [`    SecretName:  ${x.secret.secretName}`] : []))); }
      L.push('QoS Class:                   ' + (res.limits && res.requests ? 'Burstable' : res.limits ? 'Guaranteed' : 'BestEffort'));
      L.push(...evTable(v.events));
      return L;
    }
    function describeDeploy(d) {
      const v = depView(d), c = d.spec.template.spec.containers[0], L = [];
      const kv = (k, val) => L.push(`${(k + ':').padEnd(24)}${val}`);
      kv('Name', d.metadata.name); kv('Namespace', d.metadata.namespace); kv('CreationTimestamp', new Date(d.metadata.created).toUTCString());
      kv('Labels', fmtLabels(d.metadata.labels)); kv('Annotations', `deployment.kubernetes.io/revision: ${d.metadata.annotations['deployment.kubernetes.io/revision'] || 1}`);
      kv('Selector', fmtLabels(d.spec.selector.matchLabels)); kv('Replicas', `${v.desired} desired | ${v.updated} updated | ${v.total} total | ${v.available} available | ${Math.max(0, v.total - v.available)} unavailable`);
      kv('StrategyType', 'RollingUpdate'); kv('MinReadySeconds', 0); kv('RollingUpdateStrategy', '25% max unavailable, 25% max surge');
      L.push('Pod Template:', `  Labels:  ${fmtLabels(d.spec.template.metadata.labels)}`, '  Containers:', `   ${c.name}:`, `    Image:      ${c.image}`, `    Port:       ${(c.ports || []).map((x) => x.containerPort + '/TCP').join(', ') || '<none>'}`);
      if (c.resources) L.push(`    Requests:   ${JSON.stringify((c.resources || {}).requests || {})}`, `    Limits:     ${JSON.stringify((c.resources || {}).limits || {})}`);
      L.push(`    Environment:  ${(c.env || []).length ? '' : '<none>'}`, ...(c.env || []).map((e) => `      ${e.name}:  ${e.value !== undefined ? e.value : '<từ ConfigMap/Secret>'}`));
      L.push('Conditions:', '  Type           Status  Reason', '  ----           ------  ------', `  Available      ${v.available >= v.desired - Math.floor(v.desired * 0.25) ? 'True ' : 'False'}   ${v.available >= v.desired - Math.floor(v.desired * 0.25) ? 'MinimumReplicasAvailable' : 'MinimumReplicasUnavailable'}`, `  Progressing    True    ${v.updated === v.desired && v.total === v.desired ? 'NewReplicaSetAvailable' : 'ReplicaSetUpdated'}`);
      kv('OldReplicaSets', v.old.filter((r) => r.spec.replicas > 0).map((r) => `${r.metadata.name} (${ownedPods(r).filter(live).length}/${r.spec.replicas} replicas created)`).join(', ') || '<none>');
      kv('NewReplicaSet', v.nw ? `${v.nw.metadata.name} (${ownedPods(v.nw).filter(live).length}/${v.nw.spec.replicas} replicas created)` : '<none>');
      L.push(...evTable(state.events.filter((e) => e.kind === 'Deployment' && e.name === d.metadata.name && e.ns === d.metadata.namespace).map((e) => Object.assign({ at: e.t }, e))));
      return L;
    }
    function describeSvc(s) {
      const eps = endpoints(s), L = [];
      const kv = (k, val) => L.push(`${(k + ':').padEnd(25)}${val}`);
      kv('Name', s.metadata.name); kv('Namespace', s.metadata.namespace); kv('Labels', fmtLabels(s.metadata.labels)); kv('Selector', fmtLabels(s.spec.selector)); kv('Type', s.spec.type || 'ClusterIP');
      kv('IP Family Policy', 'SingleStack'); kv('IP Families', 'IPv4'); kv('IP', s.spec.clusterIP); kv('IPs', s.spec.clusterIP);
      (s.spec.ports || []).forEach((x) => { kv('Port', `${x.name || '<unset>'}  ${x.port}/${x.protocol || 'TCP'}`); kv('TargetPort', `${x.targetPort}/${x.protocol || 'TCP'}`); if (x.nodePort && s.spec.type !== 'ClusterIP') kv('NodePort', `${x.name || '<unset>'}  ${x.nodePort}/TCP`); kv('Endpoints', s.metadata.name === 'kubernetes' ? '172.18.0.2:6443' : eps.map((pd) => `${pd.sim.ip}:${x.targetPort}`).join(',') || ''); });
      kv('Session Affinity', 'None'); L.push('Events:                   <none>');
      return L;
    }
    const evOf = (o) => state.events.filter((e) => e.kind === o.kind && e.name === o.metadata.name && e.ns === o.metadata.namespace).map((e) => Object.assign({ at: e.t }, e));
    function describeMore(kind, o) {
      const L = [], kv = (k, val, w = 14) => L.push(`${(k + ':').padEnd(w)}${val}`);
      const ann = (x) => Object.entries(x.metadata.annotations || {}).map(([k, v]) => `${k}: ${v}`).join('\n' + ' '.repeat(14)) || '<none>';
      if (kind === 'StatefulSet') {
        const v = stsView(o), c = o.spec.template.spec.containers[0], pods = stsPods(o).filter(live).map((pd) => podView(pd));
        kv('Name', o.metadata.name, 20); kv('Namespace', o.metadata.namespace, 20); kv('CreationTimestamp', new Date(o.metadata.created).toUTCString(), 20); kv('Selector', fmtLabels(o.spec.selector.matchLabels), 20); kv('Labels', fmtLabels(o.metadata.labels), 20);
        kv('Replicas', `${v.desired} desired | ${v.total} total`, 20); kv('Update Strategy', 'RollingUpdate', 20); L.push('  Partition:        0');
        kv('Pods Status', `${pods.filter((x) => x.running).length} Running / ${pods.filter((x) => !x.running && x.phase !== 'Failed').length} Waiting / 0 Succeeded / ${pods.filter((x) => x.phase === 'Failed').length} Failed`, 20);
        L.push('Pod Template:', `  Labels:  ${fmtLabels(o.spec.template.metadata.labels)}`, '  Containers:', `   ${c.name}:`, `    Image:        ${c.image}`, `    Port:         ${(c.ports || []).map((x) => x.containerPort + '/TCP').join(', ') || '<none>'}`, '    Mounts:', ...((c.volumeMounts || []).map((m) => `      ${m.mountPath} from ${m.name} (rw)`).concat((c.volumeMounts || []).length ? [] : ['      <none>'])));
        L.push('Volume Claims:');
        if (!(o.spec.volumeClaimTemplates || []).length) L.push('  <none>');
        (o.spec.volumeClaimTemplates || []).forEach((t) => L.push(`  Name:          ${t.metadata.name}`, `  StorageClass:  ${t.spec.storageClassName || ''}`, `  Labels:        <none>`, `  Annotations:   <none>`, `  Capacity:      ${t.spec.resources.requests.storage}`, `  Access Modes:  [${(t.spec.accessModes || []).join(' ')}]`));
        L.push(...evTable(evOf(o)));
        return L;
      }
      if (kind === 'PersistentVolumeClaim') {
        kv('Name', o.metadata.name); kv('Namespace', o.metadata.namespace); kv('StorageClass', o.spec.storageClassName || ''); kv('Status', pvcStatus(o)); kv('Volume', o.sim.pv || ''); kv('Labels', fmtLabels(o.metadata.labels));
        kv('Annotations', o.sim.pv ? `pv.kubernetes.io/bind-completed: yes\n              volume.kubernetes.io/selected-node: ${o.sim.node || ''}` : '<none>'); kv('Finalizers', '[kubernetes.io/pvc-protection]');
        kv('Capacity', o.sim.pv ? o.spec.resources.requests.storage : ''); kv('Access Modes', o.sim.pv ? (o.spec.accessModes || []).map((m) => ACCESS[m] || m).join(',') : ''); kv('VolumeMode', o.spec.volumeMode || 'Filesystem');
        kv('Used By', pvcUsers(o).map((pd) => pd.metadata.name).join('\n              ') || '<none>');
        L.push(...evTable(evOf(o)));
        return L;
      }
      if (kind === 'PersistentVolume') {
        const s = o.spec;
        kv('Name', o.metadata.name, 18); kv('Labels', '<none>', 18); kv('Annotations', ann(o), 18); kv('Finalizers', '[kubernetes.io/pv-protection]', 18); kv('StorageClass', s.storageClassName, 18); kv('Status', o.sim.released ? 'Released' : 'Bound', 18); kv('Claim', `${s.claimRef.namespace}/${s.claimRef.name}`, 18);
        kv('Reclaim Policy', s.persistentVolumeReclaimPolicy, 18); kv('Access Modes', (s.accessModes || []).map((m) => ACCESS[m] || m).join(','), 18); kv('VolumeMode', 'Filesystem', 18); kv('Capacity', s.capacity.storage, 18);
        L.push('Node Affinity:', '  Required Terms:', `    Term 0:        kubernetes.io/hostname in [${o.sim.node || '?'}]`, 'Message:', 'Source:', '    Type:          HostPath (bare host directory volume)', `    Path:          ${s.hostPath.path}`, 'Events:            <none>');
        return L;
      }
      if (kind === 'Job') {
        const v = jobView(o), c = o.spec.template.spec.containers[0];
        kv('Name', o.metadata.name, 18); kv('Namespace', o.metadata.namespace, 18); kv('Selector', fmtLabels(o.spec.selector.matchLabels), 18); kv('Labels', fmtLabels(o.metadata.labels), 18);
        kv('Parallelism', o.spec.parallelism, 18); kv('Completions', o.spec.completions, 18); kv('Completion Mode', 'NonIndexed', 18); kv('Suspend', 'false', 18); kv('Backoff Limit', o.spec.backoffLimit, 18);
        kv('Start Time', new Date(o.metadata.created).toUTCString(), 18);
        if (o.sim.done && o.sim.done.status === 'Complete') { kv('Completed At', new Date(o.sim.done.at).toUTCString(), 18); kv('Duration', age(o.sim.done.at - o.metadata.created), 18); }
        kv('Pods Statuses', `${v.active} Active (${v.ready} Ready) / ${v.succeeded} Succeeded / ${v.vs.filter((x) => x.v.phase === 'Failed').length} Failed`, 18);
        L.push('Pod Template:', `  Labels:  job-name=${o.metadata.name}`, '  Containers:', `   ${c.name}:`, `    Image:      ${c.image}`, `    Environment:${(c.env || []).length ? '' : '  <none>'}`, ...(c.env || []).map((e) => `      ${e.name}:  ${e.value !== undefined ? e.value : '<từ ConfigMap/Secret>'}`), `  Restart Policy:  ${o.spec.template.spec.restartPolicy}`);
        L.push(...evTable(evOf(o)));
        return L;
      }
      if (kind === 'Role' || kind === 'ClusterRole') {
        kv('Name', o.metadata.name); kv('Labels', fmtLabels(o.metadata.labels)); kv('Annotations', '<none>');
        L.push('PolicyRule:', ...SH.table([['Resources', 'Non-Resource URLs', 'Resource Names', 'Verbs'], ['---------', '-----------------', '--------------', '-----'], ...(o.rules || []).flatMap((r) => (r.resources || []).map((res) => [(r.apiGroups || ['']).filter(Boolean).length ? `${res}.${r.apiGroups.filter(Boolean)[0]}` : res, '[]', `[${(r.resourceNames || []).join(' ')}]`, `[${(r.verbs || []).join(' ')}]`]))]).map((l) => '  ' + l));
        return L;
      }
      if (kind === 'RoleBinding' || kind === 'ClusterRoleBinding') {
        kv('Name', o.metadata.name); kv('Labels', fmtLabels(o.metadata.labels)); kv('Annotations', '<none>');
        L.push('Role:', `  Kind:  ${o.roleRef.kind}`, `  Name:  ${o.roleRef.name}`, 'Subjects:', ...SH.table([['Kind', 'Name', 'Namespace'], ['----', '----', '---------'], ...(o.subjects || []).map((s) => [s.kind, s.name, s.kind === 'ServiceAccount' ? s.namespace || o.metadata.namespace : ''])]).map((l) => '  ' + l));
        return L;
      }
      if (kind === 'ServiceAccount') {
        kv('Name', o.metadata.name, 21); kv('Namespace', o.metadata.namespace, 21); kv('Labels', fmtLabels(o.metadata.labels), 21); kv('Annotations', '<none>', 21); kv('Image pull secrets', '<none>', 21); kv('Mountable secrets', '<none>', 21); kv('Tokens', '<none>', 21); kv('Events', '<none>', 21);
        return L;
      }
      if (kind === 'StorageClass') {
        kv('Name', o.metadata.name, 22); kv('IsDefaultClass', (o.metadata.annotations || {})['storageclass.kubernetes.io/is-default-class'] === 'true' ? 'Yes' : 'No', 22); kv('Annotations', ann(o), 22); kv('Provisioner', o.provisioner, 22); kv('Parameters', '<none>', 22); kv('AllowVolumeExpansion', o.allowVolumeExpansion ? 'True' : '<unset>', 22); kv('MountOptions', '<none>', 22); kv('ReclaimPolicy', o.reclaimPolicy || 'Delete', 22); kv('VolumeBindingMode', o.volumeBindingMode || 'Immediate', 22); kv('Events', '<none>', 22);
        return L;
      }
      return null;
    }
    function cmdDescribe(rest) {
      const a = parse(rest, spec()); if (!a) return false;
      const { ns } = nsOf(a);
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      if (r.err) { err('error: Required resource not specified.'); return false; }
      let objs = r.name ? [get(r.kind, r.name, ns)] : list(r.kind, ns).filter((x) => !x.sim.system && (!a.flags.l || matchSel(x.metadata.labels || {}, parseSelector(a.flags.l))));
      if (r.name && !objs[0]) {
        // kubectl describe cho phép tiền tố tên (describe pod web → các pod web-xxxx)
        objs = list(r.kind, ns).filter((x) => x.metadata.name.startsWith(r.name));
        if (!objs.length) { notFound(r.kind, r.name); return false; }
      }
      objs.forEach((o, i) => {
        if (i) p('\n');
        let L;
        if (r.kind === 'Pod') L = describePod(o);
        else if (r.kind === 'Deployment') L = describeDeploy(o);
        else if (r.kind === 'Service') L = describeSvc(o);
        else if (r.kind === 'Node') { const pods = list('Pod', null).filter((pd) => pd.sim.node === o.metadata.name && live(pd)); L = [`Name:               ${o.metadata.name}`, `Roles:              ${o.sim.role}`, `Labels:             kubernetes.io/hostname=${o.metadata.name}`, ...(o.sim.role === 'control-plane' ? ['Taints:             node-role.kubernetes.io/control-plane:NoSchedule'] : ['Taints:             <none>']), 'Conditions:', '  Type             Status  Reason', '  MemoryPressure   False   KubeletHasSufficientMemory', '  Ready            True    KubeletReady', `Addresses:\n  InternalIP:  ${o.sim.ip}`, 'Capacity:\n  cpu:     4\n  memory:  8026628Ki\n  pods:    110', `Non-terminated Pods:          (${pods.length} in total)`, ...SH.table([['  Namespace', 'Name', 'CPU Requests'], ...pods.map((pd) => ['  ' + pd.metadata.namespace, pd.metadata.name, ((pd.spec.containers[0].resources || {}).requests || {}).cpu || '0 (0%)'])])]; }
        else if (r.kind === 'HorizontalPodAutoscaler') { const m = o.sim.m || hpaMetrics(o); L = [`Name:                                                  ${o.metadata.name}`, `Namespace:                                             ${o.metadata.namespace}`, `Reference:                                             ${o.spec.scaleTargetRef.kind}/${o.spec.scaleTargetRef.name}`, `Metrics:                                               ( current / target )`, `  resource cpu on pods  (as a percentage of request):  ${m.util === undefined ? '<unknown>' : m.util + '%'} / ${m.target}%`, `Min replicas:                                          ${o.spec.minReplicas || 1}`, `Max replicas:                                          ${o.spec.maxReplicas}`, ...(m.err ? ['Conditions:', `  ScalingActive  False   FailedGetResourceMetric  the HPA was unable to compute the replica count: ${m.err}`] : []), ...evTable(state.events.filter((e) => e.kind === 'HorizontalPodAutoscaler' && e.name === o.metadata.name).map((e) => Object.assign({ at: e.t }, e)))]; }
        else if (r.kind === 'Ingress') { L = [`Name:             ${o.metadata.name}`, `Namespace:        ${o.metadata.namespace}`, 'Address:          localhost', `Ingress Class:    ${o.spec.ingressClassName || '<none>'}`, 'Rules:', '  Host        Path  Backends', '  ----        ----  --------', ...(o.spec.rules || []).flatMap((ru) => ((ru.http || {}).paths || []).map((pp) => { const s = get('Service', pp.backend.service.name, o.metadata.namespace); return `  ${(ru.host || '*').padEnd(12)}${(pp.path || '/').padEnd(6)}${pp.backend.service.name}:${pp.backend.service.port.number || pp.backend.service.port.name} (${s ? endpoints(s).map((pd) => pd.sim.ip + ':' + (s.spec.ports[0].targetPort)).join(',') || '<none>' : `<error: services "${pp.backend.service.name}" not found>`})`; })), `Annotations:      ${Object.entries(o.metadata.annotations || {}).map(([k, x]) => `${k}: ${x}`).join('\n                  ') || '<none>'}`, 'Events:           <none>']; }
        else if (r.kind === 'ConfigMap' || r.kind === 'Secret') { L = [`Name:         ${o.metadata.name}`, `Namespace:    ${o.metadata.namespace}`, `Labels:       ${fmtLabels(o.metadata.labels)}`, '', ...(r.kind === 'Secret' ? [`Type:  ${o.type || 'Opaque'}`, '', 'Data', '====', ...Object.entries(o.data || {}).map(([k, x]) => `${k}:  ${unb64(x).length} bytes`)] : ['Data', '====', ...Object.entries(o.data || {}).flatMap(([k, x]) => [`${k}:`, '----', String(x), ''])]), '', 'Events:  <none>']; }
        else if ((L = describeMore(r.kind, o))) { /* đã dựng ở describeMore */ }
        else L = toYaml(exportObj(o));
        L.forEach((l) => p(l));
      });
      return true;
    }
    function ctrName(image) { const i = String(image).split('/').pop().split(':')[0].split('@')[0]; return i.replace(/[^a-z0-9-]/g, '-') || 'app'; }
    function outputOrCreate(a, doc) {
      if (a.flags['dry-run']) {
        if (a.flags.o === 'yaml') { toYaml(doc).forEach((l) => p(l)); return true; }
        if (a.flags.o === 'json') { JSON.stringify(doc, null, 2).split('\n').forEach((l) => p(l)); return true; }
        p(`${typeName(doc.kind)}/${doc.metadata.name} created (dry run)`); return true;
      }
      const saved = OUT.length;
      const ok = applyDoc(doc, '', 'create');
      if (ok && OUT.length > saved) OUT[OUT.length - 1].text = OUT[OUT.length - 1].text.replace(/ (configured|unchanged)$/, ' created');
      return ok;
    }
    function literals(a) {
      const data = {};
      for (const l of a.flags['from-literal'] || []) { const i = l.indexOf('='); if (i <= 0) { err(`error: invalid literal source ${l}, expected key=value`); return null; } data[l.slice(0, i)] = l.slice(i + 1); }
      for (const f of a.flags['from-file'] || []) { const [k, path] = f.includes('=') ? f.split('=') : [f.split('/').pop(), f]; if (typeof files[path] !== 'string') { err(`error: error reading ${path}: no such file or directory`); return null; } data[k] = files[path]; }
      for (const f of a.flags['from-env-file'] ? [a.flags['from-env-file']] : []) { if (typeof files[f] !== 'string') { err(`error: open ${f}: no such file or directory`); return null; } files[f].split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).forEach((l) => { const i = l.indexOf('='); data[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); }
      return data;
    }
    function cmdCreate(rest) {
      const a = parse(rest, spec({ value: ['image', 'replicas', 'port', 'dry-run', 'from-env-file', 'type', 'class', 'role', 'clusterrole'], multi: ['from-literal', 'from-file', 'rule', 'verb', 'resource', 'resource-name', 'serviceaccount', 'user', 'group'], bool: ['save-config'] })); if (!a) return false;
      const { ns, missing } = nsOf(a);
      if (a.flags.f) return applyFile(a.flags.f, 'create');
      const what = (a.args[0] || '').toLowerCase(), name = a.args[1];
      if (missing && what !== 'namespace' && what !== 'ns') { err(`error: failed to create ${what}: namespaces "${ns}" not found`); return false; }
      if (what === 'deployment' || what === 'deploy') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        if (!a.flags.image) { err('error: required flag(s) "image" not set'); return false; }
        const c = { name: ctrName(a.flags.image), image: a.flags.image };
        if (a.flags.port) c.ports = [{ containerPort: +a.flags.port }];
        c.resources = {};
        return outputOrCreate(a, { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name, namespace: a.flags.n, labels: { app: name } }, spec: { replicas: a.flags.replicas ? +a.flags.replicas : 1, selector: { matchLabels: { app: name } }, template: { metadata: { labels: { app: name } }, spec: { containers: [c] } } } });
      }
      if (what === 'configmap' || what === 'cm') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        const data = literals(a); if (!data) return false;
        return outputOrCreate(a, { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name, namespace: a.flags.n }, data });
      }
      if (what === 'secret') {
        if (a.args[1] !== 'generic' && a.args[1] !== 'tls' && a.args[1] !== 'docker-registry') { err('error: unknown command "' + (a.args[1] || '') + '"'); hint('Cú pháp: kubectl create secret generic TÊN --from-literal=khóa=giá-trị'); return false; }
        const nm = a.args[2]; if (!nm) { err('error: exactly one NAME is required, got 0'); return false; }
        const data = literals(a); if (!data) return false;
        return outputOrCreate(a, { apiVersion: 'v1', kind: 'Secret', metadata: { name: nm, namespace: a.flags.n }, type: 'Opaque', data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, b64(v)])) });
      }
      if (what === 'namespace' || what === 'ns') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        if (get('Namespace', name)) { err(`Error from server (AlreadyExists): namespaces "${name}" already exists`); return false; }
        add('Namespace', { name }, { spec: {} }); p(`namespace/${name} created`); return true;
      }
      if (what === 'ingress' || what === 'ing') {
        const rules = {};
        for (const r of a.flags.rule || []) { const m = r.match(/^([^/]*)(\/[^=]*)?=([\w-]+):(\w+)$/); if (!m) { err(`error: rule ${r} is invalid and should be in format host/path=svcname:svcport[,tls[=secret]]`); return false; } (rules[m[1]] = rules[m[1]] || []).push({ path: (m[2] || '/').replace(/\*$/, ''), pathType: (m[2] || '').endsWith('*') ? 'Prefix' : 'Exact', backend: { service: { name: m[3], port: /^\d+$/.test(m[4]) ? { number: +m[4] } : { name: m[4] } } } }); }
        return outputOrCreate(a, { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata: { name, namespace: a.flags.n }, spec: { ingressClassName: a.flags.class, rules: Object.entries(rules).map(([h, paths]) => ({ host: h || undefined, http: { paths } })) } });
      }
      if (what === 'serviceaccount' || what === 'sa') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        return outputOrCreate(a, { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name, namespace: a.flags.n } });
      }
      if (what === 'role' || what === 'clusterrole') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        const verbs = (a.flags.verb || []).flatMap((x) => x.split(',')).filter(Boolean);
        if (!verbs.length) { err('error: at least one verb must be specified'); hint('Ví dụ: --verb=get,list,watch'); return false; }
        const OK = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', 'deletecollection', 'use', 'bind', 'escalate', 'impersonate', '*'];
        const bad = verbs.find((x) => !OK.includes(x));
        if (bad) { err(`error: invalid verb: '${bad}'`); hint(`Verb hợp lệ: ${OK.slice(0, 8).join(', ')}`); return false; }
        const res = (a.flags.resource || []).flatMap((x) => x.split(',')).filter(Boolean);
        if (!res.length) { err('error: at least one resource must be specified'); hint('Ví dụ: --resource=pods hay --resource=deployments.apps'); return false; }
        const byGroup = {};
        for (const r0 of res) {
          const [base, sub] = r0.split('/');
          let group = '', plural = base;
          if (base !== '*') {
            const kind = KINDS[base.split('.')[0].toLowerCase()];
            if (!kind) { err(`error: the server doesn't have a resource type "${base}"`); return false; }
            group = (GROUP[kind] || '').replace(/^\./, ''); plural = PLURAL[kind].split('.')[0];
          }
          (byGroup[group] = byGroup[group] || []).push(plural + (sub ? '/' + sub : ''));
        }
        const rules = Object.entries(byGroup).map(([g, rs]) => Object.assign({ apiGroups: [g], resources: rs, verbs }, a.flags['resource-name'] ? { resourceNames: a.flags['resource-name'] } : {}));
        return outputOrCreate(a, { apiVersion: RBAC, kind: what === 'role' ? 'Role' : 'ClusterRole', metadata: { name, namespace: what === 'role' ? a.flags.n : undefined }, rules });
      }
      if (what === 'rolebinding' || what === 'clusterrolebinding') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        const cluster = what === 'clusterrolebinding';
        if (cluster ? !a.flags.clusterrole : !!a.flags.role === !!a.flags.clusterrole) { err(cluster ? 'error: required flag(s) "clusterrole" not set' : 'error: exactly one of clusterrole or role must be specified'); return false; }
        const subjects = [];
        for (const s of a.flags.serviceaccount || []) { const m = s.match(/^([\w-]+):([\w-]+)$/); if (!m) { err(`error: serviceaccount must be <namespace>:<name>`); hint(`Ví dụ: --serviceaccount=${state.ns}:${s}`); return false; } subjects.push({ kind: 'ServiceAccount', name: m[2], namespace: m[1] }); }
        (a.flags.user || []).forEach((u) => subjects.push({ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: u }));
        (a.flags.group || []).forEach((g) => subjects.push({ apiGroup: 'rbac.authorization.k8s.io', kind: 'Group', name: g }));
        return outputOrCreate(a, { apiVersion: RBAC, kind: cluster ? 'ClusterRoleBinding' : 'RoleBinding', metadata: { name, namespace: cluster ? undefined : a.flags.n }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: a.flags.role ? 'Role' : 'ClusterRole', name: a.flags.role || a.flags.clusterrole }, subjects });
      }
      if (what === 'job') {
        if (!name) { err('error: exactly one NAME is required, got 0'); return false; }
        if (!a.flags.image) { err('error: required flag(s) "image" not set'); return false; }
        const c = { name, image: a.flags.image };
        if (a.args.length > 2) c.command = a.args.slice(2);
        return outputOrCreate(a, { apiVersion: 'batch/v1', kind: 'Job', metadata: { name, namespace: a.flags.n }, spec: { template: { spec: { containers: [c], restartPolicy: 'Never' } } } });
      }
      if (what === 'service' || what === 'svc') { err('(mô phỏng) dùng kubectl expose deployment TÊN --port=... hoặc viết file service.yaml rồi apply.'); return false; }
      err(`error: unknown command "${what}" for "kubectl create"`); hint('Hỗ trợ: create deployment | configmap | secret generic | namespace | ingress | job | serviceaccount | role | rolebinding | clusterrole | clusterrolebinding | -f FILE');
      return false;
    }
    function cmdRun(rest) {
      const dash = rest.indexOf('--');
      const tail = dash >= 0 ? rest.slice(dash + 1) : [];
      const a = parse(dash >= 0 ? rest.slice(0, dash) : rest, spec({ value: ['image', 'port', 'restart', 'labels', 'dry-run', 'requests', 'limits'], multi: ['env'], bool: ['i', 't', 'rm', 'command', 'stdin', 'tty', 'expose'], alias: { stdin: 'i', tty: 't' } })); if (!a) return false;
      const { ns, missing } = nsOf(a);
      const name = a.args[0];
      if (!name) { err('error: NAME is required for run'); hint('Cú pháp: kubectl run TÊN --image=IMAGE'); return false; }
      if (!a.flags.image) { err('error: required flag(s) "image" not set'); return false; }
      if (missing) { err(`Error from server (NotFound): namespaces "${ns}" not found`); return false; }
      const labels = a.flags.labels ? Object.fromEntries(a.flags.labels.split(',').map((x) => x.split('='))) : { run: name };
      const c = { name, image: a.flags.image };
      if (a.flags.port) c.ports = [{ containerPort: +a.flags.port }];
      if (a.flags.env) c.env = a.flags.env.map((e) => { const i = e.indexOf('='); return { name: e.slice(0, i), value: e.slice(i + 1) }; });
      if (tail.length) { if (a.flags.command) c.command = tail; else c.args = tail; }
      if (a.flags.i) { c.stdin = true; if (a.flags.t) c.tty = true; }
      if (a.flags.requests) c.resources = { requests: Object.fromEntries(a.flags.requests.split(',').map((x) => x.split('='))) };
      const doc = { apiVersion: 'v1', kind: 'Pod', metadata: { name, namespace: a.flags.n, labels }, spec: { containers: [c], restartPolicy: a.flags.restart || 'Always' } };
      if (a.flags['dry-run']) return outputOrCreate(a, doc);
      reapPod('Pod', name, ns);
      if (get('Pod', name, ns)) { err(`Error from server (AlreadyExists): pods "${name}" already exists`); return false; }
      const v = validate(doc, '');
      if (v.err) { err(v.err); return false; }
      const pod = createPod({ metadata: { labels }, spec: doc.spec }, ns, null, name);
      // --rm -it: mở shell ngay (bỏ qua thời gian tải image cho trải nghiệm liền mạch)
      if (a.flags.i && a.flags.t) {
        pod.metadata.created = T() - 3000;
        const pv = podView(pod);
        if (!pv.running) { p(`pod/${name} created`); err(`error: timed out waiting for the condition`); hint(`Pod không chạy được (trạng thái ${pv.status}). Kiểm tra lại image.`); return false; }
        p("If you don't see a command prompt, try pressing enter.");
        session = { pod: pod.metadata.name, ns, rm: !!a.flags.rm, viaRun: true };
        cur.meta = { pod: name, session: true };
        return true;
      }
      p(`pod/${name} created`);
      return true;
    }
    function cmdApply(rest, verb = 'apply') {
      const a = parse(rest, spec({ bool: ['R', 'recursive', 'prune'], value: ['dry-run'], multi: ['f'] })); if (!a) return false;
      if (a.flags.n && !get('Namespace', a.flags.n)) { err(`Error from server (NotFound): namespaces "${a.flags.n}" not found`); return false; }
      const fl = [].concat(a.flags.f || []);
      if (!fl.length) { err('error: must specify one of -f and -k'); hint(`Cú pháp: kubectl ${verb} -f ten-file.yaml`); return false; }
      const old = state.ns; if (a.flags.n) state.ns = a.flags.n;
      let ok = true;
      fl.forEach((f) => { if (/^https?:/.test(f)) { err(`error: unable to read URL "${f}" (mô phỏng không có Internet)`); ok = false; return; } if (!applyFile(f, verb)) ok = false; });
      state.ns = old;
      cur.meta = { files: fl };
      return ok;
    }
    function cmdDelete(rest) {
      const a = parse(rest, spec({ bool: ['all', 'now', 'force', 'wait'], value: ['grace-period'] })); if (!a) return false;
      const { ns } = nsOf(a);
      if (a.flags.f) {
        const key = a.flags.f.replace(/^\.\//, '');
        if (typeof files[key] !== 'string') { err(`error: the path "${a.flags.f}" does not exist`); return false; }
        let docs; try { docs = YAML.parseAll(files[key]).filter(Boolean); } catch (e) { err(`error: ${e.message}`); return false; }
        let ok = true;
        docs.forEach((d) => { const o = d.kind && d.metadata && get(d.kind, d.metadata.name, d.metadata.namespace || ns); if (!o) { err(`Error from server (NotFound): error when deleting "${a.flags.f}": ${PLURAL[d.kind] || d.kind} "${(d.metadata || {}).name}" not found`); ok = false; return; } deleteObj(o); p(`${typeName(o.kind)} "${o.metadata.name}" deleted`); });
        return ok;
      }
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      if (r.err) { err('error: You must provide one or more resources by argument or filename.'); return false; }
      let targets = [];
      if (a.flags.all) targets = list(r.kind, ns).filter((x) => !x.sim.system && !(x.kind === 'Service' && x.metadata.name === 'kubernetes'));
      else if (a.flags.l) targets = list(r.kind, ns).filter((x) => matchSel(x.metadata.labels || {}, parseSelector(a.flags.l)));
      else {
        const names = a.args[0].includes('/') ? [r.name, ...a.args.slice(1).map((x) => x.split('/').pop())] : r.names;
        if (!names.length || !names[0]) { err('error: resource(s) were provided, but no name was specified'); return false; }
        for (const nm of names) { const o = get(r.kind, nm, ns); if (!o) { notFound(r.kind, nm); return false; } targets.push(o); }
      }
      if (!targets.length) { p('No resources found'); return true; }
      targets.forEach((o) => { deleteObj(o); p(`${typeName(o.kind)} "${o.metadata.name}" deleted`); });
      cur.meta = { kind: r.kind, names: targets.map((o) => o.metadata.name), owned: targets.map((o) => o.metadata.ownerName || null) };
      return true;
    }
    function deleteObj(o) {
      if (o.kind === 'Pod') { o.sim.deletedAt = T(); state.forwards = state.forwards.filter((f) => !(f.kind === 'Pod' && f.name === o.metadata.name)); return; }
      if (o.kind === 'Deployment') rsOf(o).forEach(deleteObj);
      if (o.kind === 'ReplicaSet') ownedPods(o).forEach((pd) => { if (!pd.sim.deletedAt) pd.sim.deletedAt = T(); });
      // Xóa StatefulSet KHÔNG xóa PVC sinh từ volumeClaimTemplates (dữ liệu được giữ lại)
      if (o.kind === 'StatefulSet') stsPods(o).forEach((pd) => { if (!pd.sim.deletedAt) pd.sim.deletedAt = T(); });
      if (o.kind === 'Job') jobPods(o).forEach((pd) => { if (!pd.sim.deletedAt) pd.sim.deletedAt = T(); });
      // PVC đang được Pod dùng: finalizer pvc-protection giữ lại ở trạng thái Terminating
      if (o.kind === 'PersistentVolumeClaim') { if (pvcUsers(o).length) { o.sim.deleting = T(); return; } removePVC(o); return; }
      if (o.kind === 'Namespace') state.objs.filter((x) => x.metadata.namespace === o.metadata.name).forEach(deleteObj);
      state.forwards = state.forwards.filter((f) => !(f.kind === o.kind && f.name === o.metadata.name));
      removeObj(o);
    }
    function findPodArg(arg, ns) {
      if (arg.includes('/')) {
        const [k, n] = arg.split('/'); const kind = KINDS[k.toLowerCase()];
        if (kind === 'Pod') return get('Pod', n, ns);
        const o = kind && get(kind, n, ns);
        if (!o) return { notFound: kind || k, name: n };
        const sel = o.spec.selector && (o.spec.selector.matchLabels || o.spec.selector);
        const pods = list('Pod', ns).filter((pd) => live(pd) && matchLabels(pd.metadata.labels, sel));
        return pods.find((pd) => podView(pd).running) || pods[0] || { noPods: true, kind, name: n };
      }
      return get('Pod', arg, ns);
    }
    function podLogs(pd, previous) {
      const v = podView(pd), b = v.beh, L = [];
      if (!b) return null;
      const ts = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19).replace(/-/g, '/');
      const k = pd.sim.img.kind;
      if (b.mode === 'serve') {
        if (k === 'nginx') L.push('/docker-entrypoint.sh: Configuration complete; ready for start up', `${ts(v.startedAt)} [notice] 1#1: nginx/1.27.2`, `${ts(v.startedAt)} [notice] 1#1: start worker processes`);
        else if (k === 'web' || k === 'model') L.push(`${ts(v.startedAt)} ${pd.sim.img.repo} ${pd.sim.img.ver} listening on :${b.port}`, ...Object.entries(pd.sim.env || {}).filter(([x]) => !/PASSWORD|TOKEN|SECRET|KEY/.test(x)).map(([x, y]) => `${ts(v.startedAt)} config ${x}=${y}`));
        else if (k === 'redis') L.push(`1:M ${ts(v.startedAt)} * Ready to accept connections tcp`);
        else L.push(`${ts(v.startedAt)} started`);
        pd.sim.reqLog.filter((r) => r.t >= v.startedAt).forEach((r) => L.push(k === 'nginx' ? `10.244.0.1 - - [${new Date(r.t).toUTCString().slice(5, 25)} +0000] "GET ${r.path} HTTP/1.1" ${r.code} 615 "-" "${r.from === 'kubelet' ? 'kube-probe/1.31' : 'curl/8.5.0'}"` : `${ts(r.t)} GET ${r.path} ${r.code} from=${r.from}`));
        if (v.last && previous) return [`${ts(v.startedAt)} ...`, 'Killed'];
        if (b.mode === 'serve' && ((pd.spec.containers[0].livenessProbe && !probeCheck(pd.spec.containers[0].livenessProbe, b, pd).ok) || v.readyProbeErr)) L.push(`${ts(T())} GET ${(pd.spec.containers[0].readinessProbe || pd.spec.containers[0].livenessProbe).httpGet ? (pd.spec.containers[0].readinessProbe || pd.spec.containers[0].livenessProbe).httpGet.path : '/'} 404 from=kube-probe/1.31`);
      } else {
        // Job đang chạy: log hiện dần theo thời gian (mỗi epoch một dòng)
        const logs = b.logs || [];
        const total = (b.run || 0.5) * 1000;
        const n = v.running && v.startedAt ? Math.max(Math.min(2, logs.length), Math.floor(((T() - v.startedAt) / total) * logs.length)) : logs.length;
        L.push(...logs.slice(0, n));
      }
      return L;
    }
    function cmdLogs(rest) {
      const a = parse(rest, { value: ['n', 'c', 'tail', 'since', 'l'], bool: ['f', 'p', 'previous', 'timestamps', 'all-containers'], alias: { namespace: 'n', container: 'c', follow: 'f', selector: 'l' } }); if (!a) return false;
      const { ns } = nsOf(a);
      let pods;
      if (a.flags.l) pods = list('Pod', ns).filter((pd) => live(pd) && matchSel(pd.metadata.labels, parseSelector(a.flags.l)));
      else {
        if (!a.args[0]) { err('error: expected \'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]\'.'); return false; }
        const pd = findPodArg(a.args[0], ns);
        if (!pd) { notFound('Pod', a.args[0]); if (get('Deployment', a.args[0], ns)) hint(`Muốn xem log của Deployment, dùng: kubectl logs deploy/${a.args[0]}`); return false; }
        if (pd.notFound) { notFound(pd.notFound, pd.name); return false; }
        if (pd.noPods) { err(`error: ${pd.kind.toLowerCase()} "${pd.name}" has no pods`); return false; }
        pods = [pd];
      }
      cur.meta = { pods: pods.map((x) => x.metadata.name) };
      for (const pd of pods) {
        const v = podView(pd);
        const cname = pd.spec.containers[0].name;
        if (!v.beh || v.status === 'ContainerCreating' || /ImagePull|ErrImage|CreateContainerConfig/.test(v.status)) {
          err(`Error from server (BadRequest): container "${cname}" in pod "${pd.metadata.name}" is waiting to start: ${/ImagePull|ErrImage/.test(v.status) ? 'trying and failing to pull image' : v.status === 'CreateContainerConfigError' ? 'CreateContainerConfigError' : 'ContainerCreating'}`);
          if (/ImagePull|ErrImage/.test(v.status)) hint('Container chưa từng chạy nên chưa có log. Dùng kubectl describe pod để xem lý do tải image thất bại.');
          return false;
        }
        if ((a.flags.p || a.flags.previous) && !v.last) { err(`Error from server (BadRequest): previous terminated container "${cname}" in pod "${pd.metadata.name}" not found`); return false; }
        let L = podLogs(pd, a.flags.p || a.flags.previous) || [];
        if (a.flags.tail) L = L.slice(-+a.flags.tail);
        L.forEach((l) => p(pods.length > 1 ? `[pod/${pd.metadata.name}/${cname}] ${l}` : l));
      }
      if (a.flags.f) hint('(mô phỏng) -f không giữ terminal; gõ lại lệnh để xem log mới.');
      return true;
    }
    function cmdExec(rest) {
      const dash = rest.indexOf('--');
      const a = parse(dash >= 0 ? rest.slice(0, dash) : rest, { value: ['n', 'c'], bool: ['i', 't', 'q'], alias: { namespace: 'n', container: 'c', stdin: 'i', tty: 't' } }); if (!a) return false;
      const { ns } = nsOf(a);
      if (dash < 0) {
        if (a.args.length > 1) { err('error: exec [POD] [COMMAND] is not supported anymore. Use exec [POD] -- [COMMAND] instead'); hint(`Thêm "--" trước lệnh: kubectl exec ${a.args[0]} -- ${a.args.slice(1).join(' ')}`); return false; }
        err('error: you must specify at least one command for the container'); return false;
      }
      const tok = rest.slice(dash + 1);
      if (!a.args[0]) { err('error: pod, type/name or --filename must be specified'); return false; }
      const pd = findPodArg(a.args[0], ns);
      if (!pd) { notFound('Pod', a.args[0]); return false; }
      if (pd.notFound || pd.noPods) { err(`Error from server (NotFound): ${pd.kind || pd.notFound} "${pd.name}" has no running pods`); return false; }
      const v = podView(pd);
      if (v.phase === 'Succeeded') { err('error: cannot exec into a container in a completed pod; current phase is Succeeded'); return false; }
      if (!v.running) { err(`error: unable to upgrade connection: container not found ("${pd.spec.containers[0].name}")`); hint(`Pod đang ở trạng thái ${v.status}, container chưa chạy nên không exec được.`); return false; }
      cur.meta = { pod: pd.metadata.name, cmd: tok[0] };
      if (['sh', 'bash', 'ash', '/bin/sh', '/bin/bash'].includes(tok[0]) && tok.length === 1) {
        const r = podCmd(pd, tok);
        if (r.code) { r.lines.forEach((l) => p(l.text, l.cls)); p(`command terminated with exit code ${r.code}`, 'err'); if (r.hintText) hint(r.hintText); return false; }
        if (!a.flags.i) return true;
        session = { pod: pd.metadata.name, ns };
        cur.meta.session = true;
        return true;
      }
      const shC = ['sh', 'bash', '/bin/sh'].includes(tok[0]) && tok[1] === '-c' ? SH.tokenize(tok.slice(2).join(' ')) : tok;
      const r = podCmd(pd, shC);
      r.lines.forEach((l) => p(l.text, l.cls));
      Object.assign(cur.meta, r.meta || {}, { cmd: shC[0] });
      if (r.code) { p(`command terminated with exit code ${r.code}`, 'err'); if (r.hintText) hint(r.hintText); return false; }
      return true;
    }
    function cmdExpose(rest) {
      const a = parse(rest, spec({ value: ['port', 'target-port', 'type', 'name', 'protocol', 'dry-run', 'selector'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      if (!r.name) { err('error: You must provide one or more resources by argument or filename.'); return false; }
      const o = get(r.kind, r.name, ns);
      if (!o) { notFound(r.kind, r.name); return false; }
      const selector = a.flags.selector ? Object.fromEntries(a.flags.selector.split(',').map((x) => x.split('='))) : r.kind === 'Pod' ? clone(o.metadata.labels) : clone(o.spec.selector.matchLabels || o.spec.selector);
      let port = a.flags.port;
      const cport = r.kind === 'Pod' ? ((o.spec.containers[0].ports || [])[0] || {}).containerPort : o.spec && o.spec.template ? ((o.spec.template.spec.containers[0].ports || [])[0] || {}).containerPort : null;
      if (!port) port = cport;
      if (!port) { err(`error: couldn't find port via --port flag or introspection`); hint('Thêm --port=80 (cổng của Service) và --target-port=CỔNG_APP nếu khác nhau.'); return false; }
      const type = a.flags.type || 'ClusterIP';
      if (!['ClusterIP', 'NodePort', 'LoadBalancer'].includes(type)) { err(`error: invalid service type "${type}"`); return false; }
      const doc = { apiVersion: 'v1', kind: 'Service', metadata: { name: a.flags.name || r.name, namespace: a.flags.n, labels: clone(o.metadata.labels) }, spec: { type, selector, ports: [{ port: +port, protocol: 'TCP', targetPort: a.flags['target-port'] ? (/^\d+$/.test(a.flags['target-port']) ? +a.flags['target-port'] : a.flags['target-port']) : +port }] } };
      if (a.flags['dry-run']) return outputOrCreate(a, doc);
      if (get('Service', doc.metadata.name, ns)) { err(`Error from server (AlreadyExists): services "${doc.metadata.name}" already exists`); return false; }
      const saved = OUT.length;
      if (!applyDoc(doc, '', 'create')) return false;
      OUT.length = saved;
      p(`service/${doc.metadata.name} exposed`);
      if (type === 'LoadBalancer') hint('Cluster kind không có bộ cấp IP ngoài nên EXTERNAL-IP sẽ là <pending>. Dùng NodePort hoặc port-forward để truy cập.');
      return true;
    }
    function cmdScale(rest) {
      const a = parse(rest, spec({ value: ['replicas', 'current-replicas'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      if (a.flags.replicas === undefined) { err('error: required flag(s) "replicas" not set'); return false; }
      const n = +a.flags.replicas;
      if (!(n >= 0)) { err(`error: invalid argument "${a.flags.replicas}" for "--replicas" flag: strconv.ParseInt: parsing "${a.flags.replicas}": invalid syntax`); return false; }
      if (!['Deployment', 'ReplicaSet', 'StatefulSet'].includes(r.kind)) { err(`error: no objects passed to scale`); hint('Chỉ scale được Deployment, StatefulSet (hoặc ReplicaSet). Pod đơn lẻ không scale được.'); return false; }
      const o = get(r.kind, r.name, ns);
      if (!o) { notFound(r.kind, r.name); return false; }
      o.spec.replicas = n;
      cur.meta = { name: r.name, replicas: n };
      p(`${typeName(r.kind)}/${r.name} scaled`);
      if (list('HorizontalPodAutoscaler', ns).some((h) => h.spec.scaleTargetRef.name === r.name)) hint('Deployment này đang được HPA quản lý — HPA sẽ ghi đè số replica ở lần đồng bộ kế tiếp.');
      return true;
    }
    function cmdSet(rest) {
      const a = parse(rest, spec({ bool: ['record'], value: ['requests', 'limits', 'c'], alias: { containers: 'c' } })); if (!a) return false;
      const { ns } = nsOf(a);
      const sub = a.args[0];
      if (!['image', 'env', 'resources'].includes(sub)) { err(`error: unknown command "${sub || ''}" for "kubectl set"`); hint('Hỗ trợ: kubectl set image deployment/TÊN CONTAINER=IMAGE; kubectl set env deployment/TÊN KEY=VALUE; kubectl set resources deployment/TÊN --requests=cpu=100m'); return false; }
      const r = resRef(a.args.slice(1));
      if (r.badType) { badType(r.badType); return false; }
      const o = r.name && get(r.kind, r.name, ns);
      if (!o) { notFound(r.kind || 'Deployment', r.name || ''); return false; }
      const pairs = (a.args[1].includes('/') ? a.args.slice(2) : a.args.slice(3));
      const ctrs = r.kind === 'Pod' ? o.spec.containers : o.spec.template.spec.containers;
      if (sub === 'resources') {
        if (r.kind === 'Pod') { err(`The Pod "${r.name}" is invalid: spec: Forbidden: pod updates may not change fields other than ...`); hint('Pod không cho sửa resources khi đang chạy — hãy sửa ở Deployment.'); return false; }
        if (!a.flags.requests && !a.flags.limits) { err('error: you must specify an update to requests or limits (in the form of --requests/--limits)'); return false; }
        // "cpu=100m,memory=128Mi" → { cpu:'100m', memory:'128Mi' }
        const kv = (s) => Object.fromEntries(String(s).split(',').map((x) => x.split('=')).filter((x) => x.length === 2));
        ctrs.forEach((c) => {
          c.resources = c.resources || {};
          if (a.flags.requests) c.resources.requests = Object.assign(c.resources.requests || {}, kv(a.flags.requests));
          if (a.flags.limits) c.resources.limits = Object.assign(c.resources.limits || {}, kv(a.flags.limits));
        });
        cur.meta = { name: r.name, requests: a.flags.requests, limits: a.flags.limits };
        p(`${typeName(r.kind)}/${r.name} resource requirements updated`);
        return true;
      }
      if (sub === 'image') {
        for (const pr of pairs) {
          const [cn, img] = pr.split('=');
          const targets = cn === '*' ? ctrs : ctrs.filter((c) => c.name === cn);
          if (!targets.length) { err(`error: unable to find container named "${cn}"`); hint(`Tên container hiện có: ${ctrs.map((c) => c.name).join(', ')}. Cú pháp: kubectl set image deployment/${r.name} ${ctrs[0].name}=IMAGE`); return false; }
          targets.forEach((c) => (c.image = img));
          if (r.kind === 'Pod') { o.sim.img = imgInfo(img); o.sim.beh = null; o.sim.envOk = null; o.metadata.created = T(); }
        }
        cur.meta = { name: r.name, image: pairs.join(',') };
        p(`${typeName(r.kind)}/${r.name} image updated`);
        return true;
      }
      pairs.forEach((pr) => { const i = pr.indexOf('='); const c = ctrs[0]; c.env = (c.env || []).filter((e) => e.name !== (i > 0 ? pr.slice(0, i) : pr.replace(/-$/, ''))); if (i > 0) c.env.push({ name: pr.slice(0, i), value: pr.slice(i + 1) }); });
      p(`${typeName(r.kind)}/${r.name} env updated`);
      return true;
    }
    function rolloutMsg(d) {
      const v = depView(d);
      if (v.updated < v.desired) return `Waiting for deployment "${d.metadata.name}" rollout to finish: ${v.updated} out of ${v.desired} new replicas have been updated...`;
      if (v.total > v.updated) return `Waiting for deployment "${d.metadata.name}" rollout to finish: ${v.total - v.updated} old replicas are pending termination...`;
      if (v.updReady < v.updated) return `Waiting for deployment "${d.metadata.name}" rollout to finish: ${v.updReady} of ${v.updated} updated replicas are available...`;
      return null;
    }
    function cmdRollout(rest) {
      const a = parse(rest, spec({ value: ['to-revision', 'revision', 'timeout'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const sub = a.args[0];
      if (!['status', 'history', 'undo', 'restart', 'pause', 'resume'].includes(sub)) { err(`error: unknown command "${sub || ''}" for "kubectl rollout"`); hint('Hỗ trợ: status | history | undo | restart'); return false; }
      const r = resRef(a.args.slice(1));
      if (r.badType) { badType(r.badType); return false; }
      if (r.kind === 'StatefulSet') {
        const s = get('StatefulSet', r.name, ns);
        if (!s) { notFound('StatefulSet', r.name); return false; }
        cur.meta = { sub, name: s.metadata.name, kind: 'StatefulSet' };
        if (sub === 'restart') {
          s.spec.template.metadata = s.spec.template.metadata || {};
          s.spec.template.metadata.annotations = Object.assign({}, s.spec.template.metadata.annotations, { 'kubectl.kubernetes.io/restartedAt': new Date(T()).toISOString() });
          p(`statefulset.apps/${s.metadata.name} restarted`);
          return true;
        }
        if (sub !== 'status') { err(`error: (mô phỏng) rollout ${sub} cho StatefulSet chưa được hỗ trợ`); return false; }
        let last = null;
        for (let i = 0; i < 180; i++) {
          reconcile();
          const v = stsView(s);
          if (v.ready === v.desired && v.updated === v.desired && v.total === v.desired) { p(`partitioned roll out complete: ${v.desired} new pods have been updated...`, 'ok'); cur.meta.ok = true; return true; }
          const m = v.updated < v.desired ? `Waiting for partitioned roll out to finish: ${v.updated} out of ${v.desired} new pods have been updated...` : `Waiting for ${v.desired - v.ready} pods to be ready...`;
          if (m !== last) { p(m); last = m; }
          skew += 1000;
        }
        err('error: timed out waiting for the condition');
        hint('Pod của StatefulSet được tạo lần lượt: Pod trước chưa READY thì Pod sau chưa được tạo. Xem kubectl get pods và describe Pod đang kẹt.');
        return false;
      }
      if (r.kind !== 'Deployment') { err(`error: no rollbacker has been implemented for "${r.kind}"`); return false; }
      const d = get('Deployment', r.name, ns);
      if (!d) { notFound('Deployment', r.name); return false; }
      cur.meta = { sub, name: d.metadata.name };
      if (sub === 'status') {
        // "Chờ" bằng cách cho đồng hồ mô phỏng chạy tới khi xong hoặc hết hạn tiến triển
        let last = null;
        const deadline = (d.spec.progressDeadlineSeconds || 600) * 1000;
        const startSkew = skew;
        for (let i = 0; i < 180; i++) {
          reconcile();
          const m = rolloutMsg(d);
          if (!m) { p(`deployment "${d.metadata.name}" successfully rolled out`, 'ok'); cur.meta.ok = true; return true; }
          if (m !== last) { p(m); last = m; }
          skew += 1000;
        }
        skew = startSkew + deadline; reconcile();
        err(`error: deployment "${d.metadata.name}" exceeded its progress deadline`);
        hint('Rollout bị kẹt: Pod mới không sẵn sàng (xem kubectl get pods và describe pod). Pod cũ vẫn phục vụ nên người dùng chưa bị ảnh hưởng. Quay lại bản trước: kubectl rollout undo deployment/' + d.metadata.name);
        return false;
      }
      if (sub === 'history') {
        const rss = rsOf(d).sort((x, y) => rev(x) - rev(y));
        if (a.flags.revision) { const x = rss.find((y) => rev(y) === +a.flags.revision); if (!x) { err(`error: unable to find the specified revision`); return false; } p(`deployment.apps/${d.metadata.name} with revision #${a.flags.revision}`); p('Pod Template:'); p(`  Labels:\t${fmtLabels(x.spec.template.metadata.labels)}`); p('  Containers:'); x.spec.template.spec.containers.forEach((c) => { p(`   ${c.name}:`); p(`    Image:\t${c.image}`); }); return true; }
        p(`deployment.apps/${d.metadata.name} `);
        SH.table([['REVISION', 'CHANGE-CAUSE'], ...rss.map((x) => [rev(x), x.metadata.annotations['kubernetes.io/change-cause'] || '<none>'])]).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
        return true;
      }
      if (sub === 'undo') {
        const rss = rsOf(d).sort((x, y) => rev(y) - rev(x));
        const curRev = rev(rss[0] || { metadata: { annotations: {} } });
        const target = a.flags['to-revision'] ? rss.find((x) => rev(x) === +a.flags['to-revision']) : rss.find((x) => rev(x) < curRev);
        if (!target) { err(a.flags['to-revision'] ? `error: unable to find specified revision ${a.flags['to-revision']} in history` : 'error: no rollout history found for deployment "' + d.metadata.name + '"'); return false; }
        const tpl = clone(target.spec.template);
        delete tpl.metadata.labels['pod-template-hash'];
        d.spec.template = tpl;
        p(`deployment.apps/${d.metadata.name} rolled back`);
        return true;
      }
      if (sub === 'restart') {
        d.spec.template.metadata = d.spec.template.metadata || {};
        d.spec.template.metadata.annotations = Object.assign({}, d.spec.template.metadata.annotations, { 'kubectl.kubernetes.io/restartedAt': new Date(T()).toISOString() });
        p(`deployment.apps/${d.metadata.name} restarted`);
        return true;
      }
      p(`deployment.apps/${d.metadata.name} ${sub}d`);
      return true;
    }
    function cmdAutoscale(rest) {
      const a = parse(rest, spec({ value: ['min', 'max', 'cpu-percent', 'name', 'dry-run'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      if (!a.flags.max) { err('error: required flag(s) "max" not set'); return false; }
      const d = get(r.kind, r.name, ns);
      if (!d) { notFound(r.kind, r.name); return false; }
      const doc = { apiVersion: 'autoscaling/v2', kind: 'HorizontalPodAutoscaler', metadata: { name: a.flags.name || r.name, namespace: a.flags.n }, spec: { scaleTargetRef: { apiVersion: 'apps/v1', kind: r.kind, name: r.name }, minReplicas: +(a.flags.min || 1), maxReplicas: +a.flags.max, metrics: [{ type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: +(a.flags['cpu-percent'] || 80) } } }] } };
      if (a.flags['dry-run']) return outputOrCreate(a, doc);
      if (get('HorizontalPodAutoscaler', doc.metadata.name, ns)) { err(`Error from server (AlreadyExists): horizontalpodautoscalers.autoscaling "${doc.metadata.name}" already exists`); return false; }
      const saved = OUT.length;
      if (!applyDoc(doc, '', 'create')) return false;
      OUT.length = saved;
      p(`horizontalpodautoscaler.autoscaling/${doc.metadata.name} autoscaled`);
      if (!qty(((d.spec.template.spec.containers[0].resources || {}).requests || {}).cpu)) hint('Container chưa khai báo resources.requests.cpu → HPA không tính được % CPU (TARGETS sẽ là <unknown>). Thêm requests.cpu vào Deployment.');
      return true;
    }
    function cmdPortForward(rest) {
      const a = parse(rest, { value: ['n', 'address'], alias: { namespace: 'n' } }); if (!a) return false;
      const { ns } = nsOf(a);
      if (a.args.length < 2) { err('error: TYPE/NAME and list of ports are required for port-forward'); hint('Cú pháp: kubectl port-forward svc/web 8080:80'); return false; }
      const ref = a.args[0].includes('/') ? a.args[0] : 'pod/' + a.args[0];
      const [k, n] = ref.split('/');
      const kind = KINDS[k.toLowerCase()];
      const o = kind && get(kind, n, ns);
      if (!o) { notFound(kind || 'Pod', n); return false; }
      const pts = a.args[1].split(':');
      const local = +pts[0], remote = +(pts[1] || pts[0]);
      if (state.forwards.some((f) => f.local === local)) { err(`Unable to listen on port ${local}: Listeners failed to create with the following errors: [unable to create listener: Error listen tcp4 127.0.0.1:${local}: bind: address already in use]`); hint('Cổng đã được forward trước đó — dùng cổng khác.'); return false; }
      if (kind === 'Service' && !o.spec.ports.some((x) => +x.port === remote)) { err(`error: Service ${n} does not have a service port ${remote}`); hint(`Service này có cổng: ${o.spec.ports.map((x) => x.port).join(', ')}`); return false; }
      if (kind === 'Pod' && !podView(o).running) { err(`error: unable to forward port because pod is not running. Current status=${podView(o).phase}`); return false; }
      state.forwards.push({ local, remote, kind, name: n, ns });
      p(`Forwarding from 127.0.0.1:${local} -> ${kind === 'Service' ? (o.spec.ports.find((x) => +x.port === remote).targetPort) : remote}`);
      p(`Forwarding from [::1]:${local} -> ${kind === 'Service' ? (o.spec.ports.find((x) => +x.port === remote).targetPort) : remote}`);
      hint(`(mô phỏng) Lệnh chạy nền thay vì giữ terminal. Giờ gõ: curl localhost:${local}`);
      cur.meta = { local, remote, kind, name: n };
      return true;
    }
    function cmdTop(rest) {
      const a = parse(rest, spec({ bool: ['containers'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const what = (a.args[0] || '').toLowerCase();
      if (what.startsWith('no')) { SH.table([['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)'], ...list('Node').map((n) => { const pods = list('Pod', null).filter((pd) => pd.sim.node === n.metadata.name && live(pd)); const cpu = pods.reduce((s, pd) => s + (podView(pd).running ? cpuOf(pd) : 0), n.sim.role === 'control-plane' ? 0.18 : 0.04); const mem = pods.reduce((s, pd) => s + podView(pd).mem, n.sim.role === 'control-plane' ? 620 : 210); return [n.metadata.name, Math.round(cpu * 1000) + 'm', Math.round(cpu * 25) + '%', Math.round(mem) + 'Mi', Math.round(mem / 78) + '%']; })]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
      if (what.startsWith('po')) {
        const pods = list('Pod', a.flags.A ? null : ns).filter((pd) => live(pd) && podView(pd).running && (a.flags.A || !pd.sim.system));
        if (!pods.length) { p(`No resources found in ${ns} namespace.`); return true; }
        SH.table([['NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...pods.map((pd) => [pd.metadata.name, Math.max(1, Math.round(cpuOf(pd) * 1000)) + 'm', podView(pd).mem + 'Mi'])]).forEach((l, i) => p(l, i ? '' : 'head'));
        return true;
      }
      err('error: unknown command "' + what + '" for "kubectl top"'); hint('kubectl top pods | kubectl top nodes'); return false;
    }
    function cmdLabel(rest, annotate) {
      const a = parse(rest, spec({ bool: ['overwrite'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      const o = r.name && get(r.kind, r.name, ns);
      if (!o) { notFound(r.kind || 'Pod', r.name || ''); return false; }
      const pairs = a.args[0].includes('/') ? a.args.slice(1) : a.args.slice(2);
      const tgt = annotate ? o.metadata.annotations : o.metadata.labels;
      for (const pr of pairs) {
        if (pr.endsWith('-')) { delete tgt[pr.slice(0, -1)]; continue; }
        const i = pr.indexOf('=');
        const k = pr.slice(0, i), v = pr.slice(i + 1);
        if (k in tgt && tgt[k] !== v && !a.flags.overwrite) { err(`error: '${k}' already has a value (${tgt[k]}), and --overwrite is false`); return false; }
        tgt[k] = v;
      }
      p(`${typeName(r.kind)}/${r.name} ${annotate ? 'annotated' : 'labeled'}`);
      return true;
    }
    function cmdConfig(rest) {
      const sub = rest[0];
      if (sub === 'current-context') { p('kind-lab'); return true; }
      if (sub === 'get-contexts') { SH.table([['CURRENT', 'NAME', 'CLUSTER', 'AUTHINFO', 'NAMESPACE'], ['*', 'kind-lab', 'kind-lab', 'kind-lab', state.ns === 'default' ? '' : state.ns]]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
      if (sub === 'set-context') {
        const m = rest.join(' ').match(/--namespace[= ](\S+)/);
        if (!m) { err('error: you must specify a non-empty context name or --current'); return false; }
        state.ns = m[1]; p('Context "kind-lab" modified.');
        if (!get('Namespace', m[1])) hint(`Namespace "${m[1]}" chưa tồn tại. Tạo bằng: kubectl create namespace ${m[1]}`);
        return true;
      }
      if (sub === 'view') { ['apiVersion: v1', 'clusters:', '- cluster:', '    certificate-authority-data: DATA+OMITTED', '    server: https://127.0.0.1:6443', '  name: kind-lab', 'contexts:', '- context:', '    cluster: kind-lab', `    namespace: ${state.ns}`, '    user: kind-lab', '  name: kind-lab', 'current-context: kind-lab', 'kind: Config'].forEach((l) => p(l)); return true; }
      err(`error: unknown command "${sub || ''}" for "kubectl config"`); return false;
    }
    // ---------- RBAC: ai được làm gì (kubectl --as=..., kubectl auth can-i) ----------
    const resInfo = (kind) => ({ resource: PLURAL[kind].split('.')[0], group: (GROUP[kind] || '').replace(/^\./, '') });
    function whoIs(user, groups = []) {
      const m = String(user).match(/^system:serviceaccount:([\w-]+):([\w-]+)$/);
      return { user, sa: m ? { ns: m[1], name: m[2] } : null, groups: [...groups, 'system:authenticated', ...(m ? ['system:serviceaccounts', 'system:serviceaccounts:' + m[1]] : [])] };
    }
    const subjMatch = (s, who, bns) => (s.kind === 'ServiceAccount' ? !!who.sa && s.name === who.sa.name && (s.namespace || bns) === who.sa.ns : s.kind === 'User' ? s.name === who.user : s.kind === 'Group' ? who.groups.includes(s.name) : false);
    function rulesFor(who, ns) {
      const out = [];
      list('ClusterRoleBinding').forEach((b) => { if ((b.subjects || []).some((s) => subjMatch(s, who))) { const r = get('ClusterRole', b.roleRef.name); if (r) out.push(...(r.rules || [])); } });
      if (ns) list('RoleBinding', ns).forEach((b) => { if ((b.subjects || []).some((s) => subjMatch(s, who, ns))) { const r = b.roleRef.kind === 'ClusterRole' ? get('ClusterRole', b.roleRef.name) : get('Role', b.roleRef.name, ns); if (r) out.push(...(r.rules || [])); } });
      return out;
    }
    const hasAny = (arr, x) => (arr || []).includes('*') || (arr || []).includes(x);
    const can = (who, verb, resource, group, ns, name) => rulesFor(who, ns).some((r) => hasAny(r.verbs, verb) && hasAny(r.apiGroups, group) && hasAny(r.resources, resource) && (!(r.resourceNames || []).length || (name && r.resourceNames.includes(name))));
    // Suy ra quyền cần có từ một lệnh kubectl (đủ cho các lệnh phổ biến)
    function permsFor(verb, rest) {
      const dash = rest.indexOf('--');
      const toks = dash >= 0 ? rest.slice(0, dash) : rest;
      let ns = state.ns, all = false;
      const pos = [], fl = [];
      const VAL = /^(-o|-l|-c|--output|--selector|--image|--replicas|--port|--type|--container|--target-port|--tail|--for|--timeout|--requests|--limits|--name|--from-literal|--role|--clusterrole|--verb|--resource|--serviceaccount|--min|--max|--cpu-percent)$/;
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === '-n' || t === '--namespace') { ns = toks[++i]; continue; }
        if (t.startsWith('--namespace=')) { ns = t.slice(12); continue; }
        if (t === '-A' || t === '--all-namespaces') { all = true; continue; }
        if (t === '-f' || t === '--filename') { fl.push(toks[++i]); continue; }
        if (t.startsWith('--filename=') || t.startsWith('-f=')) { fl.push(t.split('=')[1]); continue; }
        if (VAL.test(t)) { i++; continue; }
        if (t.startsWith('-')) continue;
        pos.push(t);
      }
      const P = (v, kind, name, sub) => (kind ? [Object.assign({ verb: v, name, sub, ns: namespaced(kind) && !all ? ns : null }, resInfo(kind))] : []);
      const ref = (i = 0) => { const x = pos[i] || ''; if (x.includes('/')) { const [k, n] = x.split('/'); return { kind: KINDS[k.toLowerCase().split('.')[0]], name: n }; } return { kind: KINDS[x.toLowerCase().split('.')[0]], name: pos[i + 1] }; };
      const fromFiles = (v) => fl.flatMap((f) => { try { return YAML.parseAll(files[String(f).replace(/^\.\//, '')] || '').filter((d) => d && d.kind && KINDS[d.kind.toLowerCase()]).flatMap((d) => P(v || (get(d.kind, (d.metadata || {}).name, (d.metadata || {}).namespace || ns) ? 'patch' : 'create'), d.kind, (d.metadata || {}).name)); } catch (e) { return []; } });
      switch (verb) {
        case 'get': case 'describe': { if (fl.length) return fromFiles('get'); const r = ref(); return pos[0] && !pos[0].includes('/') && pos[0].includes(',') ? pos[0].split(',').flatMap((t) => P('list', KINDS[t.toLowerCase()])) : P(r.name ? 'get' : 'list', r.kind, r.name); }
        case 'delete': { if (fl.length) return fromFiles('delete'); const r = ref(); return P(r.name ? 'delete' : 'deletecollection', r.kind, r.name); }
        case 'logs': return P('get', 'Pod', pos[0] && !pos[0].includes('/') ? pos[0] : undefined, 'log');
        case 'exec': return P('create', 'Pod', pos[0], 'exec');
        case 'port-forward': return P('create', 'Pod', undefined, 'portforward');
        case 'run': return P('create', 'Pod');
        case 'apply': return fromFiles();
        case 'create': { if (fl.length) return fromFiles('create'); const m = { deployment: 'Deployment', deploy: 'Deployment', configmap: 'ConfigMap', cm: 'ConfigMap', secret: 'Secret', namespace: 'Namespace', ns: 'Namespace', serviceaccount: 'ServiceAccount', sa: 'ServiceAccount', role: 'Role', rolebinding: 'RoleBinding', clusterrole: 'ClusterRole', clusterrolebinding: 'ClusterRoleBinding', job: 'Job', ingress: 'Ingress' }; return P('create', m[(pos[0] || '').toLowerCase()]); }
        case 'scale': { const r = ref(); return P('patch', r.kind, r.name, 'scale'); }
        case 'set': { const r = ref(1); return P('patch', r.kind, r.name); }
        case 'label': case 'annotate': case 'edit': { const r = ref(); return P('patch', r.kind, r.name); }
        case 'rollout': { const r = ref(1); return P(['status', 'history'].includes(pos[0]) ? 'get' : 'patch', r.kind, r.name); }
        case 'expose': return P('create', 'Service');
        case 'autoscale': return P('create', 'HorizontalPodAutoscaler');
        case 'wait': { const r = ref(); return P(r.name ? 'get' : 'list', r.kind, r.name); }
        default: return [];
      }
    }
    function forbidden(pm, who) {
      const res = pm.resource + (pm.sub ? '/' + pm.sub : '');
      err(`Error from server (Forbidden): ${pm.resource}${pm.name && !['create', 'list'].includes(pm.verb) ? ` "${pm.name}"` : ''} is forbidden: User "${who.user}" cannot ${pm.verb} resource "${res}" in API group "${pm.group}" ${pm.ns ? `in the namespace "${pm.ns}"` : 'at the cluster scope'}`);
      hint(`Danh tính này chưa được cấp quyền "${pm.verb}" trên "${res}". Cần một Role/ClusterRole chứa quyền đó và một RoleBinding gắn nó cho ${who.sa ? `ServiceAccount ${who.sa.ns}:${who.sa.name}` : `user ${who.user}`}. Kiểm tra nhanh: kubectl auth can-i ${pm.verb} ${res} --as=${who.user}`);
    }
    function cmdAuth(rest, who) {
      const sub = rest[0];
      if (sub === 'whoami') { SH.table([['ATTRIBUTE', 'VALUE'], ['Username', who ? who.user : 'kubernetes-admin'], ['Groups', `[${who ? who.groups.join(' ') : 'kubeadm:cluster-admins system:authenticated'}]`]]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
      if (sub !== 'can-i') { err(`error: unknown command "${sub || ''}" for "kubectl auth"`); hint('Dùng: kubectl auth can-i VERB RESOURCE [--as=...] hoặc kubectl auth can-i --list --as=...'); return false; }
      const a = parse(rest.slice(1), spec({ bool: ['list', 'q', 'quiet'], value: ['subresource'] })); if (!a) return false;
      const ns = a.flags.A ? null : a.flags.n || state.ns;
      const whoX = who || { user: 'kubernetes-admin', groups: ['system:masters'], admin: true };
      if (a.flags.list) {
        const rules = whoX.admin ? [{ apiGroups: ['*'], resources: ['*.*'], verbs: ['*'] }] : rulesFor(whoX, ns);
        const rows = rules.flatMap((r) => (r.resources || []).map((res) => [(r.apiGroups || ['']).filter(Boolean).length && !res.includes('.') ? `${res}.${r.apiGroups.filter(Boolean).join(',')}` : res, '[]', `[${(r.resourceNames || []).join(' ')}]`, `[${(r.verbs || []).join(' ')}]`]));
        SH.table([['Resources', 'Non-Resource URLs', 'Resource Names', 'Verbs'], ...rows, ['selfsubjectreviews.authentication.k8s.io', '[]', '[]', '[create]']]).forEach((l, i) => p(l, i ? '' : 'head'));
        cur.meta = { canI: true, list: true, as: who && who.user };
        return true;
      }
      const [verb, resArg] = a.args;
      if (!verb || !resArg) { err('error: you must specify two arguments: verb resource or a non-resource URL'); hint('Ví dụ: kubectl auth can-i list pods --as=system:serviceaccount:default:viewer'); return false; }
      let [rb, name] = resArg.split('/');
      let subr = a.flags.subresource;
      const kind = KINDS[rb.toLowerCase().split('.')[0]];
      if (!kind) { p(`Warning: the server doesn't have a resource type '${rb}'`, 'hint'); p('no'); cur.meta = { canI: true, verb, resource: rb, as: who && who.user, allowed: false }; return true; }
      if (['log', 'exec', 'portforward', 'scale'].includes(name)) { subr = name; name = undefined; }
      const ri = resInfo(kind), res = ri.resource + (subr ? '/' + subr : '');
      const ok = whoX.admin || can(whoX, verb, res, ri.group, namespaced(kind) ? ns : null, name);
      if (!a.flags.q && !a.flags.quiet) p(ok ? 'yes' : 'no', ok ? 'ok' : '');
      cur.meta = { canI: true, verb, resource: res, as: who && who.user, allowed: ok, ns };
      return true;
    }
    // kubectl wait: cho đồng hồ mô phỏng chạy tới khi điều kiện đạt hoặc hết thời gian chờ
    function cmdWait(rest) {
      const a = parse(rest, spec({ value: ['for', 'timeout'], bool: ['all'] })); if (!a) return false;
      const { ns } = nsOf(a);
      const cond = String(a.flags.for || '');
      if (!cond) { err('error: --for must be specified'); hint('Ví dụ: kubectl wait --for=condition=complete job/train --timeout=120s'); return false; }
      const r = resRef(a.args);
      if (r.badType) { badType(r.badType); return false; }
      let objs = r.name ? [get(r.kind, r.name, ns)] : a.flags.l ? list(r.kind, ns).filter((x) => matchSel(x.metadata.labels || {}, parseSelector(a.flags.l))) : a.flags.all ? list(r.kind, ns) : [];
      if (r.name && !objs[0]) { notFound(r.kind, r.name); return false; }
      objs = objs.filter((o) => !(o.sim && o.sim.system));
      if (!objs.length) { err('error: no matching resources found'); return false; }
      const tm = String(a.flags.timeout || '30s').match(/^(\d+)(s|m)?$/);
      const limit = tm ? +tm[1] * (tm[2] === 'm' ? 60 : 1) : 30;
      const c = cond.replace(/^condition=/i, '').toLowerCase();
      const met = (o) => {
        if (cond === 'delete') return !state.objs.includes(o) || (o.kind === 'Pod' && o.sim.deletedAt);
        if (o.kind === 'Pod') return c === 'ready' ? podView(o).ready : c === 'podscheduled' || c === 'initialized';
        if (o.kind === 'Job') { const s = jobView(o).status; return c === 'complete' ? s === 'Complete' : c === 'failed' ? s === 'Failed' : false; }
        if (o.kind === 'Deployment') { const v = depView(o); return c === 'available' ? v.available >= v.desired : c === 'progressing'; }
        if (o.kind === 'StatefulSet') { const v = stsView(o); return v.ready >= v.desired; }
        return false;
      };
      const name = (o) => `${typeName(o.kind)}/${o.metadata.name}`;
      for (let s = 0; s <= limit; s++) {
        reconcile();
        if (objs.every(met)) { objs.forEach((o) => p(`${name(o)} condition met`, 'ok')); cur.meta = { for: cond, ok: true, names: objs.map((o) => o.metadata.name) }; return true; }
        skew += 1000;
      }
      const miss = objs.find((o) => !met(o));
      err(`error: timed out waiting for the condition on ${PLURAL[miss.kind].split('.')[0]}/${miss.metadata.name}`);
      if (miss.kind === 'Job' && jobView(miss).status === 'Failed') hint(`Job ${miss.metadata.name} đã thất bại (vượt backoffLimit) nên sẽ không bao giờ "complete". Xem log: kubectl logs job/${miss.metadata.name}`);
      return false;
    }

    // ---------- Helm 3 (mô phỏng) ----------
    const goDate = (t) => { const d = new Date(t), D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${D[d.getUTCDay()]} ${M[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`; };
    const helmTime = (t) => new Date(t).toISOString().replace('T', ' ').replace(/\.(\d{3})Z$/, '.$1000 +0000 UTC');
    const findRel = (name, ns) => state.releases.find((r) => r.name === name && r.ns === ns);
    const lastRev = (rel) => rel.revisions[rel.revisions.length - 1];
    function helmChart(ref) {
      const dir = String(ref || '').replace(/^\.\//, '').replace(/\/+$/, '');
      if (/^[\w-]+\/[\w.-]+$/.test(dir) && !Object.keys(files).some((k) => k.startsWith(dir + '/'))) {
        const [repo, name] = dir.split('/');
        if (!state.repos[repo]) return { error: `repo ${repo} not found`, hintText: `Chưa thêm kho "${repo}". Chạy: helm repo add ${repo} ${(HELM.REPOS[repo] || {}).url || 'URL'}` };
        return HELM.repoChart(repo, name) || { error: `chart "${name}" not found in ${repo} index. (try 'helm repo update'): no chart name found` };
      }
      if (!dir) return { error: 'must either provide a name or specify --generate-name' };
      return HELM.loadChart(files, dir);
    }
    function helmValues(a, chart, prev) {
      let user = {};
      for (const f of [].concat(a.flags.f || [])) { const k = String(f).replace(/^\.\//, ''); if (typeof files[k] !== 'string') throw new HELM.HelmError(`open ${f}: no such file or directory`); user = HELM.deepMerge(user, YAML.parse(files[k]) || {}); }
      for (const s of [].concat(a.flags.set || [])) user = HELM.deepMerge(user, HELM.parseSet(s));
      for (const s of [].concat(a.flags['set-string'] || [])) user = HELM.deepMerge(user, HELM.parseSet(s, true));
      const given = Object.keys(user).length > 0;
      // helm upgrade không truyền values mới → dùng lại values của lần trước (trừ khi --reset-values)
      if (prev && (a.flags['reuse-values'] || (!given && !a.flags['reset-values']))) user = HELM.deepMerge(prev, user);
      return { user, all: HELM.deepMerge(chart.values, user) };
    }
    function helmRender(rel, chart, values, rev) {
      try { return HELM.render(chart, { values: values.all, release: { Name: rel.name, Namespace: rel.ns, Revision: rev } }); }
      catch (e) { if (e.file) emit('event', { type: 'fileError', file: e.file, line: e.line }); return { error: e.message }; }
    }
    // Áp manifest của một revision: kiểm tra hết trước khi áp (không để lại nửa vời), rồi xóa đối tượng không còn trong chart
    function helmApply(rel, manifests, prevManifests) {
      const old = state.ns; state.ns = rel.ns;
      try {
        for (const m of manifests) {
          const v = validate(m.doc, m.source);
          if (v.err) return { error: v.err.replace(/^Error from server \(\w+\): (error when creating "[^"]*": )?/, '') };
          const ex = get(m.doc.kind, m.doc.metadata.name, m.doc.metadata.namespace || rel.ns);
          if (ex && (ex.metadata.annotations || {})['meta.helm.sh/release-name'] !== rel.name) return { error: `Unable to continue with install: ${m.doc.kind} "${m.doc.metadata.name}" in namespace "${rel.ns}" exists and cannot be imported into the current release: invalid ownership metadata; annotation validation error: missing key "meta.helm.sh/release-name": must be set to "${rel.name}"` };
        }
        const saved = OUT.length;
        for (const m of manifests) {
          const d = clone(m.doc);
          d.metadata.annotations = Object.assign({}, d.metadata.annotations, { 'meta.helm.sh/release-name': rel.name, 'meta.helm.sh/release-namespace': rel.ns });
          const before = OUT.length;
          if (!applyDoc(d, m.source, 'apply')) { const e = OUT.slice(before).filter((l) => l.cls === 'err').map((l) => l.text).join('\n'); OUT.length = saved; return { error: e.replace(/^Error from server \(\w+\): (error when (creating|applying patch to) "[^"]*": )?/, '') }; }
        }
        OUT.length = saved;
        (prevManifests || []).forEach((pm) => { if (!manifests.some((m) => m.doc.kind === pm.doc.kind && m.doc.metadata.name === pm.doc.metadata.name)) { const o = get(pm.doc.kind, pm.doc.metadata.name, pm.doc.metadata.namespace || rel.ns); if (o) deleteObj(o); } });
        return { ok: true };
      } finally { state.ns = old; }
    }
    function helmSecret(rel, rev) {
      const n = `sh.helm.release.v1.${rel.name}.v${rev.rev}`;
      const s = get('Secret', n, rel.ns) || add('Secret', { name: n, namespace: rel.ns }, { type: 'helm.sh/release.v1', data: { release: b64('H4sIAAAAAAAC/' + SH.hash64(n)) } });
      s.metadata.labels = { modifiedAt: String(Math.floor(T() / 1000)), name: rel.name, owner: 'helm', status: rev.status, version: String(rev.rev) };
    }
    function helmStatusBlock(rel, rev, notes) {
      p(`NAME: ${rel.name}`); p(`LAST DEPLOYED: ${goDate(rev.at)}`); p(`NAMESPACE: ${rel.ns}`); p(`STATUS: ${rev.status}`, rev.status === 'deployed' ? 'ok' : ''); p(`REVISION: ${rev.rev}`); p('TEST SUITE: None');
      if (notes && notes.trim()) { p('NOTES:'); notes.replace(/\n+$/, '').split('\n').forEach((l) => p(l)); }
    }
    function pushRev(rel, chart, values, manifests, notes, desc) {
      rel.revisions.forEach((r) => { if (r.status === 'deployed') { r.status = 'superseded'; helmSecret(rel, r); } });
      const rev = { rev: rel.revisions.length ? lastRev(rel).rev + 1 : 1, status: 'deployed', at: T(), chart: `${chart.name}-${chart.version}`, app: chart.appVersion, user: values.user, all: values.all, manifests, notes, desc };
      rel.revisions.push(rev);
      helmSecret(rel, rev);
      return rev;
    }
    function helmWait(rel, rev) {
      for (let s = 0; s <= 300; s++) {
        reconcile();
        const pending = rev.manifests.map((m) => get(m.doc.kind, m.doc.metadata.name, rel.ns)).filter((o) => o && ((o.kind === 'Deployment' && depView(o).ready < depView(o).desired) || (o.kind === 'StatefulSet' && stsView(o).ready < stsView(o).desired)));
        if (!pending.length) return true;
        skew += 1000;
      }
      return false;
    }
    function helm(tokens) {
      const sub = tokens[0], rest = tokens.slice(1);
      cur.kind = 'helm'; cur.verb = sub; cur.meta = {};
      const HSPEC = { value: ['n', 'version', 'timeout', 'revision', 'o', 'description', 'max'], multi: ['f', 'set', 'set-string'], bool: ['create-namespace', 'dry-run', 'wait', 'atomic', 'install', 'reuse-values', 'reset-values', 'all', 'A', 'debug', 'a', 'force-update', 'generate-name', 'keep-history', 'q'], alias: { namespace: 'n', values: 'f', output: 'o', 'all-namespaces': 'A', short: 'q' } };
      const hp = (t) => { const a = SH.parseArgs(t, HSPEC); if (a.error) { err(`Error: ${a.error}`); return null; } return a; };
      const fail = (pre, msg, h) => { err(`Error: ${pre ? pre + ': ' : ''}${msg}`); if (h) hint(h); return false; };
      if (!sub || sub === 'help' || sub === '--help' || sub === '-h') { ['The Kubernetes package manager', '', 'Usage:', '  helm [command]', '', 'Available Commands:', '  create      create a new chart with the given name', '  get         download extended information of a named release', '  history     fetch release history', '  install     install a chart', '  lint        examine a chart for possible issues', '  list        list releases', '  repo        add, list, remove, update chart repositories', '  rollback    roll back a release to a previous revision', '  search      search for a keyword in charts', '  show        show information of a chart', '  status      display the status of the named release', '  template    locally render templates', '  uninstall   uninstall a release', '  upgrade     upgrade a release', '  version     print the client version information'].forEach((l) => p(l)); return true; }
      if (sub === 'version') { p('version.BuildInfo{Version:"v3.16.2", GitCommit:"13654a52f7c70a143b1dd51416d633e1071faffb", GitTreeState:"clean", GoVersion:"go1.22.7"}'); return true; }
      if (sub === 'repo') {
        const op = rest[0], a = hp(rest.slice(1)); if (!a) return false;
        if (op === 'add') {
          const [name, url] = a.args;
          if (!name || !url) return fail('', `"helm repo add" requires 2 arguments`, 'Cú pháp: helm repo add TÊN URL');
          const known = HELM.REPOS[name];
          if (!known || known.url !== url.replace(/\/$/, '')) return fail('', `looks like "${url}" is not a valid chart repository or cannot be reached: Get "${url.replace(/\/$/, '')}/index.yaml": dial tcp: lookup ${url.replace(/^https?:\/\//, '').split('/')[0]}: no such host`, `Lab chạy offline nên chỉ có kho mô phỏng: helm repo add vlab ${HELM.REPOS.vlab.url}${HELM.KNOWN_ONLINE[name] ? ` (kho "${name}" có thật trên Internet — dùng trên máy thật)` : ''}`);
          if (state.repos[name]) { p(`"${name}" already exists with the same configuration, skipping`); return true; }
          state.repos[name] = known.url; p(`"${name}" has been added to your repositories`); cur.meta = { repo: name }; return true;
        }
        if (op === 'list' || op === 'ls') { const rs = Object.entries(state.repos); if (!rs.length) return fail('', 'no repositories to show'); SH.table([['NAME', 'URL'], ...rs]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
        if (op === 'update' || op === 'up') { if (!Object.keys(state.repos).length) return fail('', 'no repositories found. You must add one before updating'); p('Hang tight while we grab the latest from your chart repositories...'); Object.keys(state.repos).forEach((r) => p(`...Successfully got an update from the "${r}" chart repository`)); p('Update Complete. ⎈Happy Helming!⎈'); return true; }
        if (op === 'remove' || op === 'rm') { const n = a.args[0]; if (!state.repos[n]) return fail('', `no repo named "${n}" found`); delete state.repos[n]; p(`"${n}" has been removed from your repositories`); return true; }
        return fail('', `unknown command "${op || ''}" for "helm repo"`, 'helm repo add | list | update | remove');
      }
      if (sub === 'search') {
        if (rest[0] === 'hub') return fail('', 'Get "https://artifacthub.io/api/v1/packages/search": dial tcp: lookup artifacthub.io: no such host', 'Lab offline: dùng helm search repo sau khi helm repo add vlab ...');
        if (rest[0] !== 'repo') return fail('', `unknown command "${rest[0] || ''}" for "helm search"`);
        const kw = (rest[1] || '').toLowerCase();
        const rows = Object.keys(state.repos).flatMap((r) => Object.keys(HELM.REPOS[r].charts).map((c) => HELM.repoChart(r, c)).filter((c) => !kw || `${r}/${c.name} ${c.description}`.toLowerCase().includes(kw)).map((c) => [`${r}/${c.name}`, c.version, c.appVersion, c.description]));
        if (!rows.length) { p('No results found'); return true; }
        SH.table([['NAME', 'CHART VERSION', 'APP VERSION', 'DESCRIPTION'], ...rows]).forEach((l, i) => p(l, i ? '' : 'head'));
        return true;
      }
      if (sub === 'create') {
        const name = rest[0];
        if (!name) return fail('', '"helm create" requires 1 argument', 'Cú pháp: helm create TÊN_CHART');
        Object.entries(HELM.scaffold(name)).forEach(([k, v]) => (files[`${name}/${k}`] = v));
        emit('files'); p(`Creating ${name}`); cur.meta = { chart: name };
        return true;
      }
      if (sub === 'show' || sub === 'inspect') {
        const what = rest[0], c = helmChart(rest[1]);
        if (c.error) return fail('', c.error, c.hintText);
        if (what === 'values') { c.valuesText.replace(/\n$/, '').split('\n').forEach((l) => p(l)); return true; }
        if (what === 'chart') { p(`apiVersion: v2\nappVersion: ${c.appVersion}\ndescription: ${c.description}\nname: ${c.name}\ntype: application\nversion: ${c.version}`); return true; }
        return fail('', `unknown command "${what || ''}" for "helm show"`, 'helm show values CHART | helm show chart CHART');
      }
      if (sub === 'lint') {
        const ref = rest[0] || '.';
        const c = helmChart(ref);
        p(`==> Linting ${ref}`);
        if (c.error) { p(`[ERROR] Chart.yaml: ${c.error}`, 'err'); p(''); p('Error: 1 chart(s) linted, 1 chart(s) failed', 'err'); return false; }
        const r = helmRender({ name: 'release-name', ns: state.ns }, c, { all: c.values }, 1);
        if (r.error) { p(`[ERROR] templates/: ${r.error}`, 'err'); p(''); p('Error: 1 chart(s) linted, 1 chart(s) failed', 'err'); return false; }
        p('[INFO] Chart.yaml: icon is recommended'); p(''); p('1 chart(s) linted, 0 chart(s) failed', 'ok');
        return true;
      }
      const a = hp(rest); if (!a) return false;
      const ns = a.flags.n || state.ns;
      cur.meta = { ns };
      if (sub === 'install' || sub === 'template' || (sub === 'upgrade' && a.flags.install && !findRel(a.args[0], ns))) {
        const tpl = sub === 'template', PRE = tpl ? '' : 'INSTALLATION FAILED';
        let [name, ref] = a.args;
        if (a.args.length === 1 && (a.flags['generate-name'] || tpl)) { ref = name; name = a.flags['generate-name'] ? `${String(ref).split('/').pop()}-${Math.floor(T() / 1000)}` : 'release-name'; }
        if (!name || !ref) return fail(PRE, `"helm ${sub}" requires 2 arguments`, `Cú pháp: helm ${sub} TÊN_RELEASE CHART (ví dụ: helm install shop ./webapp)`);
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) || name.length > 53) return fail(PRE, `invalid release name, must match regex ^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$ and the length must not be longer than 53`);
        if (!tpl && findRel(name, ns)) return fail(PRE, 'cannot re-use a name that is still in use', `Release "${name}" đã tồn tại. Cập nhật bằng: helm upgrade ${name} ${ref}`);
        if (!tpl && !get('Namespace', ns)) { if (!a.flags['create-namespace']) return fail(PRE, `create: failed to create: namespaces "${ns}" not found`, 'Thêm --create-namespace để Helm tự tạo namespace.'); add('Namespace', { name: ns }, { spec: {} }); nsDefaults(ns); }
        const c = helmChart(ref);
        if (c.error) return fail(PRE, c.error, c.hintText);
        let vals; try { vals = helmValues(a, c); } catch (e) { return fail(PRE, e.message); }
        const rel = { name, ns, revisions: [] };
        const r = helmRender(rel, c, vals, 1);
        if (r.error) return fail(PRE, r.error);
        if (tpl || a.flags['dry-run']) {
          if (!tpl) { p(`NAME: ${name}`); p(`LAST DEPLOYED: ${goDate(T())}`); p(`NAMESPACE: ${ns}`); p('STATUS: pending-install'); p('REVISION: 1'); p('TEST SUITE: None'); p('HOOKS:'); p('MANIFEST:'); }
          HELM.manifestText(r.manifests).split('\n').forEach((l) => p(l));
          cur.meta = { release: name, dry: true };
          return true;
        }
        const ap = helmApply(rel, r.manifests, null);
        if (ap.error) return fail(PRE, ap.error);
        state.releases.push(rel);
        const rev = pushRev(rel, c, vals, r.manifests, r.notes, 'Install complete');
        if (a.flags.wait && !helmWait(rel, rev)) { rev.status = 'failed'; helmSecret(rel, rev); return fail(PRE, 'context deadline exceeded', 'Có Pod chưa sẵn sàng trong thời gian chờ. Xem kubectl get pods.'); }
        if (sub === 'upgrade') p(`Release "${name}" does not exist. Installing it now.`);
        helmStatusBlock(rel, rev, r.notes);
        cur.meta = { release: name, rev: rev.rev, chart: c.name };
        return true;
      }
      if (sub === 'upgrade') {
        const [name, ref] = a.args;
        if (!name || !ref) return fail('', '"helm upgrade" requires 2 arguments', 'Cú pháp: helm upgrade TÊN_RELEASE CHART --set khóa=giá_trị');
        const rel = findRel(name, ns);
        if (!rel) return fail('UPGRADE FAILED', `"${name}" has no deployed releases`, `Chưa có release "${name}" trong namespace ${ns}. Cài mới bằng helm install, hoặc dùng helm upgrade --install.`);
        const c = helmChart(ref);
        if (c.error) return fail('UPGRADE FAILED', c.error, c.hintText);
        let vals; try { vals = helmValues(a, c, lastRev(rel).user); } catch (e) { return fail('UPGRADE FAILED', e.message); }
        const r = helmRender(rel, c, vals, lastRev(rel).rev + 1);
        if (r.error) return fail('UPGRADE FAILED', r.error);
        const ap = helmApply(rel, r.manifests, lastRev(rel).manifests);
        if (ap.error) return fail('UPGRADE FAILED', ap.error);
        const rev = pushRev(rel, c, vals, r.manifests, r.notes, 'Upgrade complete');
        if (a.flags.wait && !helmWait(rel, rev)) { rev.status = 'failed'; helmSecret(rel, rev); return fail('UPGRADE FAILED', 'context deadline exceeded'); }
        p(`Release "${name}" has been upgraded. Happy Helming!`, 'ok');
        helmStatusBlock(rel, rev, r.notes);
        cur.meta = { release: name, rev: rev.rev, chart: c.name, user: vals.user };
        return true;
      }
      const name = a.args[0];
      const rel = name && findRel(name, ns);
      if (sub === 'list' || sub === 'ls') {
        const rels = state.releases.filter((r) => a.flags.A || r.ns === ns);
        if (a.flags.q) { rels.forEach((r) => p(r.name)); return true; }
        SH.table([['NAME', 'NAMESPACE', 'REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION'], ...rels.map((r) => { const v = lastRev(r); return [r.name, r.ns, v.rev, helmTime(v.at), v.status, v.chart, v.app]; })]).forEach((l, i) => p(l, i ? '' : 'head'));
        return true;
      }
      if (['status', 'history', 'hist', 'rollback', 'uninstall', 'delete', 'del', 'un', 'get'].includes(sub)) {
        const nm = sub === 'get' ? a.args[1] : name;
        const rl = sub === 'get' ? findRel(nm, ns) : rel;
        if (!nm) return fail('', `"helm ${sub}" requires at least 1 argument`, `Cú pháp: helm ${sub} TÊN_RELEASE`);
        if (!rl) return fail(sub === 'rollback' ? '' : sub.startsWith('un') || sub.startsWith('del') ? 'uninstall' : '', `release: not found`, `Không có release "${nm}" trong namespace ${ns}. Xem: helm list${ns === 'default' ? '' : ' -n ' + ns}`);
        if (sub === 'status') { helmStatusBlock(rl, lastRev(rl), lastRev(rl).notes); return true; }
        if (sub === 'history' || sub === 'hist') { SH.table([['REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION', 'DESCRIPTION'], ...rl.revisions.map((v) => [v.rev, goDate(v.at), v.status, v.chart, v.app, v.desc])]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
        if (sub === 'get') {
          const what = a.args[0], v = a.flags.revision ? rl.revisions.find((x) => x.rev === +a.flags.revision) : lastRev(rl);
          if (!v) return fail('', 'release: not found');
          if (what === 'values') { const o = a.flags.all ? v.all : v.user; p(a.flags.all ? 'COMPUTED VALUES:' : 'USER-SUPPLIED VALUES:'); (Object.keys(o).length ? HELM.toYaml(o) : 'null').split('\n').forEach((l) => p(l)); return true; }
          if (what === 'manifest') { HELM.manifestText(v.manifests).split('\n').forEach((l) => p(l)); return true; }
          if (what === 'notes') { p('NOTES:'); (v.notes || '').replace(/\n+$/, '').split('\n').forEach((l) => p(l)); return true; }
          return fail('', `unknown command "${what || ''}" for "helm get"`, 'helm get values | manifest | notes TÊN_RELEASE');
        }
        if (sub === 'rollback') {
          const cur0 = lastRev(rl), target = a.args[1] ? rl.revisions.find((x) => x.rev === +a.args[1]) : rl.revisions[rl.revisions.length - 2];
          if (!target) return fail('', a.args[1] ? `release has no ${a.args[1]} version` : 'release has no previous revision to roll back to');
          const ap = helmApply(rl, target.manifests, cur0.manifests);
          if (ap.error) return fail('', ap.error);
          const rev = pushRev(rl, { name: target.chart.replace(/-[\d.]+$/, ''), version: target.chart.split('-').pop(), appVersion: target.app }, { user: target.user, all: target.all }, target.manifests, target.notes, `Rollback to ${target.rev}`);
          rev.chart = target.chart;
          p('Rollback was a success! Happy Helming!', 'ok');
          cur.meta = { release: rl.name, rev: rev.rev, rollbackTo: target.rev };
          return true;
        }
        // uninstall: xóa mọi đối tượng trong manifest; PVC sinh từ StatefulSet không nằm trong manifest nên vẫn còn
        [...lastRev(rl).manifests].reverse().forEach((m) => { const o = get(m.doc.kind, m.doc.metadata.name, m.doc.metadata.namespace || rl.ns); if (o) deleteObj(o); });
        list('Secret', rl.ns).filter((s) => s.metadata.name.startsWith(`sh.helm.release.v1.${rl.name}.`)).forEach(removeObj);
        state.releases.splice(state.releases.indexOf(rl), 1);
        p(`release "${rl.name}" uninstalled`);
        const left = list('PersistentVolumeClaim', rl.ns).filter((c) => c.metadata.name.includes(rl.name));
        if (left.length) hint(`PVC vẫn còn: ${left.map((c) => c.metadata.name).join(', ')} — Helm không xóa PVC sinh từ volumeClaimTemplates. Xóa tay nếu không cần dữ liệu: kubectl delete pvc ${left[0].metadata.name}`);
        cur.meta = { release: rl.name, uninstalled: true };
        return true;
      }
      err(`Error: unknown command "${sub}" for "helm"`);
      p("Run 'helm --help' for usage.");
      return false;
    }

    function kubectl(tokens) {
      // Giả danh người dùng khác (--as) để thử phân quyền RBAC
      let as = null;
      const asGroups = [];
      tokens = tokens.filter((t, i, arr) => {
        if (t === '--as' || t === '--as-group') { arr[i + 1] !== undefined && (t === '--as' ? (as = arr[i + 1]) : asGroups.push(arr[i + 1])); arr[i + 1] = '\u0000'; return false; }
        if (t.startsWith('--as=')) { as = t.slice(5); return false; }
        if (t.startsWith('--as-group=')) { asGroups.push(t.slice(11)); return false; }
        return t !== '\u0000';
      });
      const who = as ? whoIs(as, asGroups) : null;
      const verb = tokens[0], rest = tokens.slice(1);
      cur.kind = 'kubectl'; cur.verb = verb; cur.meta = {};
      if (who && verb !== 'auth') {
        const deny = permsFor(verb, rest).find((pm) => !can(who, pm.verb, pm.resource + (pm.sub ? '/' + pm.sub : ''), pm.group, pm.ns, pm.name));
        if (deny) { forbidden(deny, who); cur.meta = { forbidden: true, as: as, perm: deny }; return false; }
      }
      if (!verb || verb === '--help' || verb === '-h' || verb === 'help') { ['kubectl controls the Kubernetes cluster manager.', '', 'Basic Commands:', '  create, expose, run, set, get, explain, edit, delete', 'Deploy Commands:', '  rollout, scale, autoscale', 'Troubleshooting and Debugging Commands:', '  describe, logs, exec, port-forward, top', 'Advanced Commands:', '  apply, label, annotate', '', 'Usage:', '  kubectl [flags] [options]'].forEach((l) => p(l)); return true; }
      switch (verb) {
        case 'get': return cmdGet(rest);
        case 'describe': return cmdDescribe(rest);
        case 'run': return cmdRun(rest);
        case 'create': return cmdCreate(rest);
        case 'apply': return cmdApply(rest);
        case 'delete': return cmdDelete(rest);
        case 'logs': return cmdLogs(rest);
        case 'exec': return cmdExec(rest);
        case 'expose': return cmdExpose(rest);
        case 'scale': return cmdScale(rest);
        case 'set': return cmdSet(rest);
        case 'rollout': return cmdRollout(rest);
        case 'autoscale': return cmdAutoscale(rest);
        case 'port-forward': return cmdPortForward(rest);
        case 'top': return cmdTop(rest);
        case 'label': return cmdLabel(rest, false);
        case 'annotate': return cmdLabel(rest, true);
        case 'config': return cmdConfig(rest);
        case 'auth': return cmdAuth(rest, who);
        case 'wait': return cmdWait(rest);
        case 'cluster-info': p('Kubernetes control plane is running at https://127.0.0.1:6443', 'ok'); p('CoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy'); return true;
        case 'version': p('Client Version: v1.31.1'); p('Kustomize Version: v5.4.2'); p('Server Version: v1.31.0'); return true;
        case 'api-resources': { const SHORT = { ConfigMap: 'cm', Endpoints: 'ep', Event: 'ev', Namespace: 'ns', Node: 'no', Pod: 'po', Service: 'svc', ServiceAccount: 'sa', PersistentVolumeClaim: 'pvc', PersistentVolume: 'pv', Deployment: 'deploy', ReplicaSet: 'rs', StatefulSet: 'sts', HorizontalPodAutoscaler: 'hpa', Ingress: 'ing', StorageClass: 'sc' }; const ks = [...Object.keys(PLURAL), 'Event']; SH.table([['NAME', 'SHORTNAMES', 'APIVERSION', 'NAMESPACED', 'KIND'], ...ks.map((k) => [(PLURAL[k] || 'events').split('.')[0], SHORT[k] || '', (API[k] || ['v1'])[0], String(namespaced(k)), k]).sort((x, y) => (x[2].includes('/') - y[2].includes('/')) || x[2].localeCompare(y[2]) || x[0].localeCompare(y[0]))]).forEach((l, i) => p(l, i ? '' : 'head')); return true; }
        case 'explain': { const k = KINDS[(rest[0] || '').toLowerCase().split('.')[0]]; if (!k) { err(`error: couldn't find resource for "${rest[0] || ''}"`); return false; } p(`KIND:       ${k}`); p(`VERSION:    ${(API[k] || ['v1'])[0]}`); p(''); p('FIELDS:'); Object.keys(SCHEMA[k] || {}).forEach((f) => p(`  ${f}`)); hint('(mô phỏng) Bản rút gọn. Trên máy thật có mô tả đầy đủ từng trường, ví dụ: kubectl explain deployment.spec.strategy'); return true; }
        case 'edit': err('(mô phỏng) Không có trình soạn thảo vi trong terminal này.'); hint('Sửa file YAML ở khung soạn thảo rồi chạy kubectl apply -f TÊN_FILE — đó cũng là cách làm chuẩn (GitOps).'); return false;
        default: {
          const best = VERBS.map((x) => [x, lev(verb, x)]).sort((x, y) => x[1] - y[1])[0];
          err(`error: unknown command "${verb}" for "kubectl"`);
          if (best[1] <= 2) { p(''); p('Did you mean this?'); p(`\t${best[0]}`); }
          p(''); p("Run 'kubectl --help' for usage.");
          return false;
        }
      }
    }
    function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }

    // ---------- Lệnh máy host ----------
    function curl(tok) {
      const a = SH.parseArgs(tok, { bool: ['s', 'i', 'v', 'L', 'f', 'k', 'I'], value: ['H', 'X', 'd', 'o', 'm', 'w'], multi: ['H'], alias: { silent: 's', include: 'i', verbose: 'v', header: 'H', request: 'X', data: 'd', location: 'L', fail: 'f', insecure: 'k', head: 'I', output: 'o', 'max-time': 'm' } });
      if (a.error) { err(`curl: option ${a.error}`); return false; }
      if (!a.args[0]) { err("curl: try 'curl --help' or 'curl --manual' for more information"); return false; }
      const headers = {};
      (a.flags.H || []).forEach((h) => { const i = h.indexOf(':'); if (i > 0) headers[h.slice(0, i).trim().toLowerCase()] = h.slice(i + 1).trim(); });
      const r = http(a.args[0], null, headers);
      cur.kind = 'curl';
      const um = a.args[0].match(/^(?:https?:\/\/)?([^/:\s]+)(?::(\d+))?(\/.*)?$/) || [];
      cur.meta = { url: a.args[0], host: headers.host || um[1], port: um[2] ? +um[2] : 80, path: um[3] || '/', code: r.code, pod: r.pod, svc: r.svc && r.svc.metadata.name, via: r.via, ingress: r.ingress };
      state.requests.push({ t: T(), from: 'host', url: a.args[0], code: r.code, pod: r.pod, svc: r.svc && r.svc.metadata.name, via: r.via, ingress: r.ingress, host: cur.meta.host, path: cur.meta.path, count: r.count });
      if (r.code === 0) {
        err(`curl: (${r.exit || 7}) ${r.err}`);
        if (r.clusterOnly) hint(`"${um[1]}" là tên Service — chỉ phân giải được BÊN TRONG cluster. Từ máy host dùng: kubectl port-forward svc/${um[1]} 8080:${(resolveSvc(um[1], state.ns).spec.ports[0] || {}).port}, NodePort, hoặc Ingress.`);
        else if (r.noEndpoints) hint('Service không có Pod nào READY (endpoints rỗng). Kiểm tra: kubectl get endpoints và nhãn của Pod có khớp selector không.');
        else if (r.refused && r.svc) hint('Pod nhận được kết nối nhưng app không lắng nghe ở cổng đó: kiểm tra targetPort của Service khớp cổng app (vlab/web: 8080, nginx: 80).');
        else if (/localhost/.test(a.args[0])) hint('Không có gì lắng nghe ở cổng này trên máy host. Mở đường bằng kubectl port-forward, Service NodePort (30000-32767) hoặc Ingress (cổng 80).');
        return false;
      }
      if (a.flags.i || a.flags.I) { p(`HTTP/1.1 ${r.code} ${r.code === 200 ? 'OK' : r.code === 404 ? 'Not Found' : r.code === 503 ? 'Service Temporarily Unavailable' : ''}`, 'head'); p(`Content-Type: ${/^</.test(r.body) ? 'text/html' : 'text/plain; charset=utf-8'}`); p(''); }
      if (!a.flags.I) r.body.split('\n').forEach((l) => p(l));
      return !(a.flags.f && r.code >= 400);
    }
    // Ống dẫn đơn giản: chỉ lọc stdout, dòng lỗi/gợi ý vẫn hiện như stderr
    function pipeStage(lines, tok) {
      const c = tok[0], a = tok.slice(1);
      const num = (def) => { const i = a.indexOf('-n'); if (i >= 0) return +a[i + 1]; const m = a.find((x) => /^-\d+$/.test(x)); return m ? +m.slice(1) : def; };
      if (c === 'grep') { const inv = a.includes('-v'), ci = a.includes('-i'); const pat = a.filter((x) => !x.startsWith('-'))[0] || ''; let re; try { re = new RegExp(pat, ci ? 'i' : ''); } catch (e) { re = { test: (s) => s.includes(pat) }; } return lines.filter((l) => re.test(l.text) !== inv); }
      if (c === 'head') return lines.slice(0, num(10));
      if (c === 'tail') return lines.slice(-num(10));
      if (c === 'wc') return [{ text: String(a.includes('-l') ? lines.length : lines.map((l) => l.text).join('\n').length), cls: '' }];
      if (c === 'sort') return lines.slice().sort((x, y) => x.text.localeCompare(y.text));
      if (c === 'base64') { const t = lines.map((l) => l.text).join(''); try { return (a.includes('-d') || a.includes('--decode') ? unb64(t.trim()) : b64(t)).split('\n').map((x) => ({ text: x, cls: '' })); } catch (e) { return [{ text: 'base64: invalid input', cls: 'err' }]; } }
      return null;
    }
    function hostCmd(tokens) {
      const pi = tokens.indexOf('|');
      if (pi > 0) {
        const before = OUT.length;
        const ok = hostCmd(tokens.slice(0, pi));
        const lines = OUT.splice(before);
        let outl = lines.filter((l) => l.cls !== 'err' && l.cls !== 'hint');
        let rest = tokens.slice(pi + 1);
        while (rest.length) {
          const j = rest.indexOf('|'), stage = j >= 0 ? rest.slice(0, j) : rest;
          const r = pipeStage(outl, stage);
          if (!r) { err(`${stage[0] || ''}: command not found`); hint('Ống dẫn trong lab hỗ trợ: grep [-i] [-v], head/tail [-n N], wc -l, sort, base64 -d'); return false; }
          outl = r;
          rest = j >= 0 ? rest.slice(j + 1) : [];
        }
        lines.filter((l) => l.cls === 'err' || l.cls === 'hint').forEach((l) => OUT.push(l));
        outl.forEach((l) => OUT.push(l));
        return ok;
      }
      // Chuyển hướng "> file" để lưu output (ví dụ --dry-run=client -o yaml > deploy.yaml)
      const gt = tokens.indexOf('>');
      if (gt > 0 && tokens[gt + 1]) {
        const target = tokens[gt + 1].replace(/^\.\//, '');
        const before = OUT.length;
        const ok = hostCmd(tokens.slice(0, gt));
        const lines = OUT.splice(before);
        const errs = lines.filter((l) => l.cls === 'err' || l.cls === 'hint');
        if (ok) { files[target] = lines.filter((l) => l.cls !== 'err' && l.cls !== 'hint').map((l) => l.text).join('\n') + '\n'; emit('files'); }
        errs.forEach((l) => OUT.push(l));
        return ok;
      }
      const c = tokens[0];
      if (c === 'kubectl' || c === 'k') return kubectl(tokens.slice(1));
      if (c === 'helm') return helm(tokens.slice(1));
      if (c === 'curl') return curl(tokens.slice(1));
      if (c === 'clear') { CLEAR = true; return true; }
      if (c === 'ls') { const fs = Object.keys(files).sort(); p(fs.join('  ') || ''); return true; }
      if (c === 'cat') { const f = (tokens[1] || '').replace(/^\.\//, ''); if (typeof files[f] !== 'string') { err(`cat: ${tokens[1] || ''}: No such file or directory`); return false; } files[f].replace(/\n$/, '').split('\n').forEach((l) => p(l)); cur.kind = 'cat'; cur.meta = { file: f }; return true; }
      if (c === 'echo') { p(tokens.slice(1).join(' ')); return true; }
      if (c === 'help') { ['Lệnh hỗ trợ trong máy lab Kubernetes:', '  kubectl get|describe|apply|create|run|delete|logs|exec|expose|scale|set|rollout|autoscale|port-forward|top|label|wait|auth can-i', '  helm repo|search|install|upgrade|rollback|list|history|uninstall|template|show|get|lint|create', '  curl URL           gọi HTTP từ máy host (localhost:CỔNG, http://shop.local ...)', '  ls, cat FILE       xem file trong thư mục lab', '  clear              xóa màn hình', 'Mẹo: "k" là bí danh của kubectl. Tab để gợi ý.'].forEach((l) => p(l)); return true; }
      if (c === 'docker') { err('docker: lab này là cluster Kubernetes — hãy dùng kubectl.'); return false; }
      if (['vi', 'vim', 'nano'].includes(c)) { err(`${c}: không có trong máy lab mô phỏng`); hint('Sửa file ở khung soạn thảo bên cạnh terminal.'); return false; }
      if (c === 'minikube' || c === 'kind') { p('lab'); hint('Cluster "lab" (kind) đã được tạo sẵn với 1 control-plane và 2 worker.'); return true; }
      err(`${c}: command not found`);
      if (/^kub/.test(c) || c === 'kubeclt' || c === 'kubetcl') hint('Có phải ý bạn là kubectl?');
      return false;
    }
    function sessionCmd(tokens) {
      const pod = get('Pod', session.pod, session.ns);
      if (!pod || !podView(pod).running) { const s = session; session = null; err('command terminated with exit code 137'); hint(`Pod ${s.pod} đã dừng hoặc bị xóa nên phiên shell kết thúc.`); return false; }
      if (tokens[0] === 'exit') {
        const s = session; session = null; cur.kind = 'exit';
        if (s.viaRun) { p(`Session ended, resume using 'kubectl attach ${s.pod} -c ${s.pod} -i -t' command when the pod is running`); if (s.rm) { deleteObj(pod); removeObj(pod); p(`pod "${s.pod}" deleted`); } }
        return true;
      }
      if (tokens[0] === 'clear') { CLEAR = true; return true; }
      const r = podCmd(pod, tokens);
      r.lines.forEach((l) => p(l.text, l.cls));
      cur.kind = 'pod-exec'; cur.meta = Object.assign({ pod: pod.metadata.name, cmd: tokens[0], ok: r.code === 0 }, r.meta || {});
      if (r.hintText) hint(r.hintText);
      return r.code === 0;
    }

    function exec(line) {
      OUT = []; CLEAR = false; cur = { kind: 'other', meta: {} };
      const trimmed = String(line).trim();
      if (!trimmed) return { ok: true, lines: [] };
      let ok = true;
      reconcile();
      try {
        let tokens = null;
        try { tokens = SH.tokenize(trimmed); } catch (e) { err(`bash: syntax error: ${e.message}`); ok = false; }
        if (tokens) ok = (session ? sessionCmd(tokens) : hostCmd(tokens)) !== false;
      } catch (e) {
        err('Lỗi nội bộ của bộ mô phỏng: ' + e.message);
        if (typeof console !== 'undefined') console.error(e);
        ok = false;
      }
      reconcile();
      state.history.push({ cmd: trimmed, ok, kind: cur.kind, verb: cur.verb, meta: cur.meta, t: T() });
      emit('change');
      return { ok, lines: OUT, clear: CLEAR };
    }
    function complete(line) {
      const endsSpace = /\s$/.test(line);
      let toks; try { toks = SH.tokenize(line); } catch (e) { return { line, options: [] }; }
      const word = endsSpace ? '' : toks.pop() || '';
      const before = line.slice(0, line.length - word.length);
      let cands = [];
      if (session) cands = toks.length ? [] : ['env', 'cat', 'ls', 'curl', 'wget', 'nslookup', 'hostname', 'exit'];
      else if (!toks.length) cands = ['kubectl', 'helm', 'curl', 'ls', 'cat', 'clear', 'help'];
      else if (toks[0] === 'helm') {
        const hs = toks[1];
        const rels = state.releases.map((r) => r.name);
        const charts = [...new Set(Object.keys(files).filter((f) => /\/Chart\.yaml$/.test(f)).map((f) => './' + f.replace(/\/Chart\.yaml$/, '')))].concat(Object.keys(state.repos).flatMap((r) => Object.keys(HELM.REPOS[r].charts).map((c) => `${r}/${c}`)));
        if (toks.length === 1) cands = ['install', 'upgrade', 'rollback', 'list', 'history', 'status', 'uninstall', 'template', 'repo', 'search', 'show', 'get', 'lint', 'create', 'version'];
        else if (hs === 'repo' && toks.length === 2) cands = ['add', 'list', 'update', 'remove'];
        else if (hs === 'repo' && toks[2] === 'add' && toks.length === 3) cands = Object.keys(HELM.REPOS);
        else if (hs === 'repo' && toks[2] === 'add' && toks.length === 4) cands = [(HELM.REPOS[toks[3]] || {}).url].filter(Boolean);
        else if (hs === 'search' && toks.length === 2) cands = ['repo'];
        else if (hs === 'get' && toks.length === 2) cands = ['values', 'manifest', 'notes'];
        else if (hs === 'get' && toks.length === 3) cands = rels;
        else if (hs === 'show' && toks.length === 2) cands = ['values', 'chart'];
        else if (word.startsWith('-')) cands = ['--set', '--values', '--namespace', '--create-namespace', '--dry-run', '--wait', '--reuse-values', '--install'];
        else if (['install', 'template'].includes(hs) && toks.length === 3) cands = charts;
        else if (['upgrade', 'rollback', 'history', 'status', 'uninstall'].includes(hs) && toks.length === 2) cands = rels;
        else if (hs === 'upgrade' && toks.length === 3) cands = charts;
        else if (['show', 'lint'].includes(hs)) cands = charts;
      }
      else if (toks[0] === 'cat') cands = Object.keys(files);
      else if (toks[0] === 'kubectl' || toks[0] === 'k') {
        const v = toks[1];
        if (toks.length === 1) cands = VERBS;
        else if (toks[toks.length - 1] === '-f') cands = Object.keys(files).filter((f) => /\.ya?ml$/.test(f));
        else if (word.startsWith('-')) cands = ['--namespace', '--output', '--selector', '--filename', '--all-namespaces', '--image', '--replicas', '--port', '--target-port', '--type', '--dry-run=client', '--show-labels'];
        else if (v === 'rollout' && toks.length === 2) cands = ['status', 'history', 'undo', 'restart'];
        else if (v === 'set' && toks.length === 2) cands = ['image', 'env'];
        else if (v === 'create' && toks.length === 2) cands = ['deployment', 'configmap', 'secret', 'namespace', 'ingress', 'job', 'serviceaccount', 'role', 'rolebinding', 'clusterrole', 'clusterrolebinding'];
        else if (v === 'auth' && toks.length === 2) cands = ['can-i', 'whoami'];
        else if (v === 'wait' && toks.length === 2) cands = ['--for=condition=Ready', '--for=condition=complete', '--for=condition=available'];
        else if (v === 'top' && toks.length === 2) cands = ['pods', 'nodes'];
        else if (['get', 'describe', 'delete', 'expose', 'scale', 'label', 'autoscale', 'edit'].includes(v) && toks.length === 2) cands = ['pods', 'deployments', 'services', 'replicasets', 'nodes', 'configmaps', 'secrets', 'ingress', 'hpa', 'events', 'namespaces', 'all', 'endpoints', 'statefulsets', 'jobs', 'pvc', 'pv', 'storageclass', 'serviceaccounts', 'roles', 'rolebindings', 'clusterroles', 'clusterrolebindings'];
        else if (['logs', 'exec', 'port-forward'].includes(v) || (toks.length >= 3 && KINDS[(toks[2] || '').toLowerCase()] === 'Pod')) cands = list('Pod').filter(live).map((x) => x.metadata.name).concat(v === 'port-forward' ? list('Service').map((s) => 'svc/' + s.metadata.name) : []);
        else if (toks.length >= 3) { const k = KINDS[(toks[2] || '').toLowerCase()]; if (k) cands = list(k).map((x) => x.metadata.name); else if (['rollout', 'set'].includes(v)) cands = list('Deployment').map((d) => 'deployment/' + d.metadata.name).concat(list('StatefulSet').map((s) => 'statefulset/' + s.metadata.name)); }
      }
      const r = SH.completeWord(word, cands);
      return { line: before + r.value, options: r.options };
    }
    function prompt() {
      if (!session) return 'user@lab:~$';
      const pod = get('Pod', session.pod, session.ns);
      const sh = pod && podView(pod).beh && podView(pod).beh.shell;
      return sh === 'bash' ? `root@${session.pod}:/#` : '/ #';
    }
    function tick() { const before = JSON.stringify(state.objs.map((o) => [o.metadata.name, o.spec && o.spec.replicas])); reconcile(); emit('change'); return before; }

    return {
      exec, complete, prompt, tick, on, off, state, get, list, podView, depView, stsView, jobView, endpoints, http, exportObj,
      // Cho bài lab: danh tính này có được làm việc đó không (giống kubectl auth can-i --as)
      authz: (user, verb, resource, group = '', ns = state.ns) => can(whoIs(user), verb, resource, group, ns),
      get files() { return files; },
      get session() { return session ? Object.assign({}, session) : null; },
      setFile(name, text) { files[name] = text; emit('change'); emit('files'); },
      resetFile(name) { if (name in initialFiles) files[name] = initialFiles[name]; else delete files[name]; emit('change'); emit('files'); },
      resetFiles() { files = Object.assign({}, initialFiles); emit('change'); emit('files'); },
      initialFiles,
      // Cho kiểm thử: cho thời gian mô phỏng trôi nhanh
      advance(ms) { for (let s = 0; s < ms; s += 1000) { skew += Math.min(1000, ms - s); reconcile(); } emit('change'); },
      now: T,
      kind: 'kube',
    };
  }

  return { createKube, imgInfo, toYaml };
});
