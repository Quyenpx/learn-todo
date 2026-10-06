/*
 * docker-registry.js — "Docker Hub ảo": danh mục image có sẵn để người học pull/run.
 * Kích thước và layer được chọn gần với image thật (bản 2024–2026) để người học so sánh có ý nghĩa.
 * Các image dùng chung layer gốc (Debian, Alpine) để minh họa dòng "Already exists" khi pull.
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else (root.DevOpsSim = root.DevOpsSim || {}).registry = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Layer gốc dùng chung giữa nhiều image
  const BASE = {
    debianSlim: { id: 'a2318d6c47ec', size: 74.8e6, cmd: '# debian:bookworm-slim' },
    debian: { id: '6e909acdb790', size: 117e6, cmd: '# debian:bookworm' },
    buildpack: { id: '9e1b5fa2c4d3', size: 211e6, cmd: 'RUN apt-get install -y curl git gcc ... (buildpack-deps)' },
    alpine: { id: 'c6a83fedfae6', size: 7.8e6, cmd: '# alpine:3.20' },
  };

  // Tạo định nghĩa image: layer cuối tự bù để tổng kích thước đúng bằng size
  function img(o) {
    const layers = (o.base || []).map((b) => Object.assign({}, b));
    const extra = o.layers || [];
    let used = layers.reduce((s, l) => s + l.size, 0);
    extra.forEach((l, i) => {
      const size = i === extra.length - 1 ? Math.max(0, o.size - used) : l.size;
      used += size;
      layers.push({ id: l.id, size, cmd: l.cmd });
    });
    return Object.assign({ env: {}, workdir: '/', expose: [], entrypoint: [], files: {}, shell: 'bash', daysAgo: 14 }, o, { layers });
  }

  const NGINX_HTML = [
    '<!DOCTYPE html>',
    '<html>',
    '<head><title>Welcome to nginx!</title></head>',
    '<body>',
    '<h1>Welcome to nginx!</h1>',
    '<p>If you see this page, the nginx web server is successfully installed and working.</p>',
    '</body>',
    '</html>',
  ].join('\n');

  const nginxLatest = img({
    id: 'a8758716bb6a', size: 192e6, kind: 'nginx', version: '1.27.2', daysAgo: 16,
    base: [BASE.debianSlim],
    layers: [
      { id: '4b2a3c1d9e0f', size: 41.2e6, cmd: 'RUN set -x && apt-get install nginx ...' },
      { id: '77ab5d8e1c2f', size: 1.2e3, cmd: 'COPY docker-entrypoint.sh / # buildkit' },
      { id: '1f0e6a7b3c9d', size: 0, cmd: 'COPY 10-listen-on-ipv6-by-default.sh ...' },
    ],
    entrypoint: ['/docker-entrypoint.sh'], cmd: ['nginx', '-g', 'daemon off;'], expose: [80],
    files: { '/usr/share/nginx/html/index.html': NGINX_HTML, '/etc/nginx/nginx.conf': 'user nginx;\nworker_processes auto;\nhttp {\n    include /etc/nginx/conf.d/*.conf;\n}' },
  });
  const nginxAlpine = img({
    id: 'c7b4f26a1d07', size: 48.4e6, kind: 'nginx', version: '1.27.2', shell: 'sh', daysAgo: 16,
    base: [BASE.alpine],
    layers: [{ id: '8d3e2b1a6f45', size: 32e6, cmd: 'RUN apk add nginx ...' }, { id: '2c1b0a9f8e7d', size: 0, cmd: 'COPY docker-entrypoint.sh /' }],
    entrypoint: ['/docker-entrypoint.sh'], cmd: ['nginx', '-g', 'daemon off;'], expose: [80],
    files: { '/usr/share/nginx/html/index.html': NGINX_HTML },
  });
  const redis7 = img({
    id: '7fc1b3c6a3a8', size: 117e6, kind: 'redis', version: '7.4.1', daysAgo: 21,
    base: [BASE.debianSlim],
    layers: [{ id: '5e4d3c2b1a09', size: 0.8e6, cmd: 'RUN groupadd -r redis && useradd ...' }, { id: '3a2b1c0d9e8f', size: 0, cmd: 'RUN make install redis ...' }],
    entrypoint: ['docker-entrypoint.sh'], cmd: ['redis-server'], expose: [6379], workdir: '/data',
  });
  const postgres16 = img({
    id: 'f23dc7cd74bd', size: 435e6, kind: 'postgres', version: '16.4', daysAgo: 30,
    base: [BASE.debianSlim],
    layers: [{ id: '0b9a8c7d6e5f', size: 2.1e6, cmd: 'RUN set -ex; apt-get install gnupg ...' }, { id: '6c5d4e3f2a1b', size: 0, cmd: 'RUN apt-get install postgresql-16 ...' }],
    entrypoint: ['docker-entrypoint.sh'], cmd: ['postgres'], expose: [5432], env: { PGDATA: '/var/lib/postgresql/data' },
  });
  const python312 = img({
    id: '1a4e5b2c9d73', size: 1.02e9, kind: 'python', version: '3.12.7', daysAgo: 9,
    base: [BASE.debian, BASE.buildpack],
    layers: [{ id: 'e1d2c3b4a596', size: 18e6, cmd: 'ENV PYTHON_VERSION=3.12.7' }, { id: 'b7a6c5d4e3f2', size: 0, cmd: 'RUN ./configure && make install python ...' }],
    cmd: ['python3'], env: { PYTHON_VERSION: '3.12.7', LANG: 'C.UTF-8' },
  });
  const python312slim = img({
    id: '5d8c7e9f0a12', size: 130e6, kind: 'python', version: '3.12.7', daysAgo: 9,
    base: [BASE.debianSlim],
    layers: [{ id: 'd4c3b2a19f8e', size: 3.4e6, cmd: 'RUN apt-get install ca-certificates netbase ...' }, { id: '9f8e7d6c5b4a', size: 0, cmd: 'RUN ./configure && make install python ...' }],
    cmd: ['python3'], env: { PYTHON_VERSION: '3.12.7', LANG: 'C.UTF-8' },
  });
  const node20 = img({
    id: 'b3f1a8c2d6e4', size: 1.1e9, kind: 'node', version: '20.18.0', daysAgo: 12,
    base: [BASE.debian, BASE.buildpack],
    layers: [{ id: 'a9b8c7d6e5f4', size: 4e6, cmd: 'RUN groupadd --gid 1000 node ...' }, { id: 'f4e3d2c1b0a9', size: 0, cmd: 'RUN curl node-v20 && tar -xJf ...' }],
    entrypoint: ['docker-entrypoint.sh'], cmd: ['node'], env: { NODE_VERSION: '20.18.0' },
  });
  const node20alpine = img({
    id: 'e8d7c6b5a493', size: 135e6, kind: 'node', version: '20.18.0', shell: 'sh', daysAgo: 12,
    base: [BASE.alpine],
    layers: [{ id: 'c2b1a0f9e8d7', size: 1.1e6, cmd: 'RUN addgroup -g 1000 node ...' }, { id: '7e6d5c4b3a29', size: 0, cmd: 'RUN apk add nodejs ...' }],
    entrypoint: ['docker-entrypoint.sh'], cmd: ['node'], env: { NODE_VERSION: '20.18.0' },
  });
  const alpine320 = img({ id: '91ef0af61f39', size: 7.8e6, kind: 'shell', shell: 'sh', daysAgo: 40, base: [BASE.alpine], cmd: ['/bin/sh'] });
  const busybox = img({
    id: '27a71e19c956', size: 4.27e6, kind: 'shell', shell: 'sh', daysAgo: 60,
    layers: [{ id: 'ec562eabd705', size: 0, cmd: 'ADD busybox.tar.xz / # buildkit' }], cmd: ['sh'],
  });
  const helloWorld = img({
    id: 'd2c94e258dcb', size: 13256, kind: 'hello', shell: null, daysAgo: 540,
    layers: [{ id: 'c1ec31eb5944', size: 0, cmd: 'COPY hello / # buildkit' }], cmd: ['/hello'],
  });
  // Ứng dụng web mẫu cho bài Compose: đếm lượt truy cập, lưu số đếm trong Redis
  const counter = img({
    id: '4c9e2f7a1b38', size: 145e6, kind: 'counter', daysAgo: 3,
    base: [BASE.debianSlim],
    layers: [{ id: '8a7b6c5d4e3f', size: 52e6, cmd: 'RUN pip install flask redis' }, { id: '0f1e2d3c4b5a', size: 0, cmd: 'COPY app.py .' }],
    cmd: ['python', 'app.py'], expose: [5000], workdir: '/app', env: { REDIS_HOST: 'redis' },
    files: { '/app/app.py': 'import os, redis\nfrom flask import Flask\napp = Flask(__name__)\nr = redis.Redis(host=os.getenv("REDIS_HOST", "redis"), port=6379)\n\n@app.get("/")\ndef index():\n    n = r.incr("hits")\n    return f"Xin chào! Trang này đã được xem {n} lần.\\n"\n\napp.run(host="0.0.0.0", port=5000)\n' },
  });

  // repo → tag → định nghĩa. Các tag trỏ cùng một đối tượng có cùng IMAGE ID
  const CATALOG = {
    'hello-world': { latest: helloWorld },
    nginx: { latest: nginxLatest, '1.27': nginxLatest, alpine: nginxAlpine, '1.27-alpine': nginxAlpine },
    redis: { latest: redis7, '7': redis7, '7.4': redis7 },
    postgres: { latest: postgres16, '16': postgres16 },
    python: { latest: python312, '3.12': python312, '3.12-slim': python312slim, slim: python312slim },
    node: { latest: node20, '20': node20, '20-alpine': node20alpine },
    alpine: { latest: alpine320, '3.20': alpine320 },
    busybox: { latest: busybox },
    'vlab/counter': { latest: counter, '1.0': counter },
  };

  // Chuẩn hóa tham chiếu image: "docker.io/library/nginx:1.27" → { repo: 'nginx', tag: '1.27' }
  function parseRef(ref) {
    let s = String(ref).trim().replace(/@sha256:[0-9a-f]+$/, '');
    s = s.replace(/^(docker\.io|index\.docker\.io|registry-1\.docker\.io)\//, '').replace(/^library\//, '');
    const slash = s.lastIndexOf('/');
    const colon = s.lastIndexOf(':');
    const hasTag = colon > slash;
    const repo = (hasTag ? s.slice(0, colon) : s).toLowerCase();
    const tag = hasTag ? s.slice(colon + 1) : 'latest';
    return { repo, tag, ref: `${repo}:${tag}`, explicitTag: hasTag };
  }

  function resolve(ref) {
    const p = parseRef(ref);
    const repo = CATALOG[p.repo];
    if (!repo) return { error: 'repo', repo: p.repo, tag: p.tag };
    const def = repo[p.tag];
    if (!def) return { error: 'tag', repo: p.repo, tag: p.tag };
    return { repo: p.repo, tag: p.tag, def };
  }

  // Danh sách để gợi ý Tab cho "docker pull/run"
  function refs() {
    const out = [];
    Object.keys(CATALOG).forEach((r) => Object.keys(CATALOG[r]).forEach((t) => out.push(t === 'latest' ? r : `${r}:${t}`)));
    return out;
  }

  return { CATALOG, BASE, parseRef, resolve, refs, NGINX_HTML };
});
