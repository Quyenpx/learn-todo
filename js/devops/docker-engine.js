/*
 * docker-engine.js — Bộ mô phỏng Docker chạy hoàn toàn trên trình duyệt.
 * Giữ trạng thái image, container, volume, network và phản hồi lệnh giống Docker 27 thật.
 * Mỗi lỗi kèm dòng "💡" tiếng Việt giải thích nguyên nhân để người học tự sửa.
 * Không đụng tới DOM: giao diện chỉ gọi exec() và lắng nghe sự kiện 'change' / 'event'.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./shell.js'), require('./docker-registry.js'), require('./yaml-lite.js'), () => require('./docker-build.js'));
  } else {
    const ns = (root.DevOpsSim = root.DevOpsSim || {});
    Object.assign(ns, factory(ns.shell, ns.registry, ns.yaml, () => ns.build));
  }
})(typeof self !== 'undefined' ? self : this, function (SH, REG, YAML, getBuild) {
  'use strict';

  const ADJ = ['admiring', 'brave', 'clever', 'eager', 'focused', 'gifted', 'happy', 'jolly', 'keen', 'loving', 'nifty', 'quirky', 'serene', 'vibrant', 'zealous', 'determined', 'elegant', 'festive', 'hopeful', 'modest'];
  const SCI = ['turing', 'lovelace', 'hopper', 'curie', 'tesla', 'darwin', 'newton', 'noether', 'ritchie', 'torvalds', 'babbage', 'pasteur', 'galileo', 'hawking', 'kepler', 'shannon', 'dijkstra', 'knuth', 'wozniak', 'euler'];
  const BUILTIN_NETS = ['bridge', 'host', 'none'];
  const SHELLS = ['sh', 'bash', 'ash'];
  const BASE_DIRS = ['bin', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var'];

  const HELLO = [
    '',
    'Hello from Docker!',
    'This message shows that your installation appears to be working correctly.',
    '',
    'To generate this message, Docker took the following steps:',
    ' 1. The Docker client contacted the Docker daemon.',
    ' 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.',
    '    (amd64)',
    ' 3. The Docker daemon created a new container from that image which runs the',
    '    executable that produces the output you are currently reading.',
    ' 4. The Docker daemon streamed that output to the Docker client, which sent it',
    '    to your terminal.',
    '',
    'To try something more ambitious, you can run an Ubuntu container with:',
    ' $ docker run -it ubuntu bash',
  ];

  // Đặc tả cờ của từng lệnh: dùng cho cả phân tích lệnh lẫn gợi ý Tab
  const SPECS = {
    run: { bool: ['d', 'i', 't', 'rm', 'P', 'privileged', 'init'], value: ['name', 'p', 'e', 'v', 'network', 'w', 'entrypoint', 'restart', 'hostname', 'label', 'memory', 'cpus', 'user', 'network-alias', 'platform'], multi: ['p', 'e', 'v', 'label', 'network-alias'], alias: { detach: 'd', interactive: 'i', tty: 't', publish: 'p', env: 'e', volume: 'v', workdir: 'w', net: 'network', 'publish-all': 'P', h: 'hostname', l: 'label', m: 'memory', u: 'user' }, stopAfter: 1 },
    ps: { bool: ['a', 'q', 's', 'no-trunc', 'l'], value: ['filter', 'format', 'n'], multi: ['filter'], alias: { all: 'a', quiet: 'q', size: 's', latest: 'l', f: 'filter', last: 'n' } },
    images: { bool: ['a', 'q', 'no-trunc', 'digests'], value: ['filter', 'format'], multi: ['filter'], alias: { all: 'a', quiet: 'q', f: 'filter' } },
    pull: { bool: ['q', 'a'], value: ['platform'], alias: { quiet: 'q', 'all-tags': 'a' } },
    rmi: { bool: ['f', 'no-prune'], alias: { force: 'f' } },
    start: { bool: ['a', 'i'], alias: { attach: 'a', interactive: 'i' } },
    stop: { value: ['t', 's'], alias: { time: 't', timeout: 't', signal: 's' } },
    restart: { value: ['t'], alias: { time: 't', timeout: 't' } },
    kill: { value: ['s'], alias: { signal: 's' } },
    rm: { bool: ['f', 'v', 'l'], alias: { force: 'f', volumes: 'v', link: 'l' } },
    logs: { bool: ['f', 't', 'details'], value: ['tail', 'since', 'until'], alias: { follow: 'f', timestamps: 't', n: 'tail' } },
    exec: { bool: ['i', 't', 'd', 'privileged'], value: ['e', 'w', 'u'], multi: ['e'], alias: { interactive: 'i', tty: 't', detach: 'd', env: 'e', workdir: 'w', user: 'u' }, stopAfter: 1 },
    inspect: { bool: ['s'], value: ['f', 'type'], alias: { format: 'f', size: 's' } },
    build: { bool: ['no-cache', 'q', 'pull', 'load', 'push'], value: ['t', 'f', 'target', 'build-arg', 'platform', 'progress'], multi: ['t', 'build-arg'], alias: { tag: 't', file: 'f', quiet: 'q' } },
    history: { bool: ['H', 'q', 'no-trunc'], value: ['format'], alias: { human: 'H', quiet: 'q' } },
    stats: { bool: ['a', 'no-stream', 'no-trunc'], value: ['format'], alias: { all: 'a' } },
    'volume create': { value: ['d', 'label', 'o'], multi: ['label', 'o'], alias: { driver: 'd', opt: 'o' } },
    'volume ls': { bool: ['q'], value: ['filter', 'format'], alias: { quiet: 'q', f: 'filter' } },
    'volume rm': { bool: ['f'], alias: { force: 'f' } },
    'volume prune': { bool: ['f', 'a'], alias: { force: 'f', all: 'a' } },
    'network create': { value: ['d', 'subnet', 'gateway'], bool: ['internal', 'attachable'], alias: { driver: 'd' } },
    'network ls': { bool: ['q', 'no-trunc'], value: ['filter', 'format'], alias: { quiet: 'q', f: 'filter' } },
    'network rm': { bool: ['f'], alias: { force: 'f' } },
    'network connect': { value: ['alias', 'ip'], multi: ['alias'] },
    'network prune': { bool: ['f'], alias: { force: 'f' } },
    compose: { value: ['f', 'p'], multi: [], alias: { file: 'f', 'project-name': 'p' } },
    'compose up': { bool: ['d', 'build', 'force-recreate', 'no-build', 'wait'], alias: { detach: 'd' } },
    'compose down': { bool: ['v', 'remove-orphans'], value: ['rmi'], alias: { volumes: 'v' } },
    'compose ps': { bool: ['a', 'q'], alias: { all: 'a', quiet: 'q' } },
    'compose logs': { bool: ['f', 't', 'no-color'], value: ['tail'], alias: { follow: 'f', timestamps: 't' } },
    'compose exec': { bool: ['d', 'T', 'i', 't'], value: ['e', 'w', 'u'], multi: ['e'], alias: { detach: 'd', 'no-TTY': 'T' }, stopAfter: 1 },
    'system prune': { bool: ['f', 'a', 'volumes'], alias: { force: 'f', all: 'a' } },
    'image prune': { bool: ['f', 'a'], alias: { force: 'f', all: 'a' } },
    'container prune': { bool: ['f'], alias: { force: 'f' } },
    'builder prune': { bool: ['f', 'a'], alias: { force: 'f', all: 'a' } },
  };

  // Tên lệnh quản lý dạng mới ("docker container ls") quy về lệnh ngắn tương đương
  const ALIAS = {
    'container ls': 'ps', 'container list': 'ps', 'container ps': 'ps', 'container run': 'run', 'container start': 'start', 'container stop': 'stop',
    'container restart': 'restart', 'container rm': 'rm', 'container logs': 'logs', 'container exec': 'exec', 'container inspect': 'inspect',
    'container kill': 'kill', 'container port': 'port', 'container stats': 'stats', 'container rename': 'rename', 'container prune': 'container prune',
    'image ls': 'images', 'image list': 'images', 'image rm': 'rmi', 'image pull': 'pull', 'image build': 'build', 'image history': 'history',
    'image inspect': 'inspect', 'image tag': 'tag', 'image prune': 'image prune', 'buildx build': 'build', 'builder build': 'build', 'builder prune': 'builder prune',
    'system prune': 'system prune', 'system df': 'system df', 'system info': 'info',
  };

  const TOP = ['run', 'ps', 'pull', 'images', 'rmi', 'start', 'stop', 'restart', 'kill', 'rm', 'logs', 'exec', 'inspect', 'build', 'history', 'tag', 'port', 'stats', 'rename', 'version', 'info', 'volume', 'network', 'compose', 'system', 'container', 'image', 'builder'];

  const HELP = {
    run: ['docker run [OPTIONS] IMAGE [COMMAND] [ARG...]', 'Create and run a new container from an image', 'Tạo và chạy container mới từ một image', [['-d, --detach', 'Chạy nền, in ra ID container'], ['--name string', 'Đặt tên cho container'], ['-p, --publish list', 'Ánh xạ cổng host:container, ví dụ 8080:80'], ['-e, --env list', 'Đặt biến môi trường KEY=VALUE'], ['-v, --volume list', 'Gắn volume tên:/đường/dẫn hoặc ./thư-mục:/đường/dẫn'], ['--network string', 'Gắn container vào network'], ['--rm', 'Tự xóa container khi nó thoát'], ['-i, -t', 'Giữ stdin mở và cấp terminal (dùng chung: -it)']]],
    ps: ['docker ps [OPTIONS]', 'List containers', 'Liệt kê container (mặc định chỉ container đang chạy)', [['-a, --all', 'Hiện cả container đã dừng'], ['-q, --quiet', 'Chỉ in ID'], ['--format string', 'Định dạng, ví dụ "{{.Names}}\\t{{.Status}}"']]],
    images: ['docker images [OPTIONS] [REPOSITORY[:TAG]]', 'List images', 'Liệt kê image có trên máy', [['-q, --quiet', 'Chỉ in ID image']]],
    pull: ['docker pull [OPTIONS] NAME[:TAG]', 'Download an image from a registry', 'Tải image từ registry (Docker Hub)', []],
    rmi: ['docker rmi [OPTIONS] IMAGE [IMAGE...]', 'Remove one or more images', 'Xóa image', [['-f, --force', 'Xóa cưỡng bức']]],
    start: ['docker start [OPTIONS] CONTAINER [CONTAINER...]', 'Start one or more stopped containers', 'Khởi động lại container đã dừng', []],
    stop: ['docker stop [OPTIONS] CONTAINER [CONTAINER...]', 'Stop one or more running containers', 'Dừng container (gửi SIGTERM, sau 10 giây gửi SIGKILL)', []],
    restart: ['docker restart [OPTIONS] CONTAINER [CONTAINER...]', 'Restart one or more containers', 'Dừng rồi chạy lại container', []],
    rm: ['docker rm [OPTIONS] CONTAINER [CONTAINER...]', 'Remove one or more containers', 'Xóa container', [['-f, --force', 'Dừng và xóa container đang chạy'], ['-v, --volumes', 'Xóa cả volume ẩn danh đi kèm']]],
    logs: ['docker logs [OPTIONS] CONTAINER', 'Fetch the logs of a container', 'Xem log (stdout/stderr) của container', [['-f, --follow', 'Theo dõi log mới'], ['-n, --tail string', 'Chỉ hiện N dòng cuối']]],
    exec: ['docker exec [OPTIONS] CONTAINER COMMAND [ARG...]', 'Execute a command in a running container', 'Chạy lệnh bên trong container đang chạy', [['-i, -t', 'Mở phiên tương tác, ví dụ: docker exec -it web sh'], ['-e, --env list', 'Đặt biến môi trường']]],
    inspect: ['docker inspect [OPTIONS] NAME|ID [NAME|ID...]', 'Return low-level information on Docker objects', 'Xem thông tin chi tiết dạng JSON', [['-f, --format string', 'Lấy một trường, ví dụ {{.State.Status}}']]],
    build: ['docker build [OPTIONS] PATH', 'Build an image from a Dockerfile', 'Build image từ Dockerfile', [['-t, --tag list', 'Đặt tên:tag cho image'], ['-f, --file string', 'Tên Dockerfile (mặc định "Dockerfile")'], ['--no-cache', 'Không dùng cache'], ['--target string', 'Chỉ build đến stage chỉ định']]],
    history: ['docker history [OPTIONS] IMAGE', 'Show the history of an image', 'Xem các layer tạo nên image', []],
    tag: ['docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]', 'Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE', 'Gắn thêm tên cho image', []],
    port: ['docker port CONTAINER', 'List port mappings', 'Liệt kê ánh xạ cổng của container', []],
    volume: ['docker volume COMMAND', 'Manage volumes', 'Quản lý volume. Lệnh con: create, ls, rm, inspect, prune', []],
    network: ['docker network COMMAND', 'Manage networks', 'Quản lý network. Lệnh con: create, ls, rm, inspect, connect, disconnect, prune', []],
    compose: ['docker compose [OPTIONS] COMMAND', 'Define and run multi-container applications', 'Chạy nhiều container theo file docker-compose.yml. Lệnh con: up, down, ps, logs, exec, stop, start, restart, build, config', []],
  };

  function createDocker(opts = {}) {
    const seed = opts.seed || 1;
    const now = opts.now || (() => Date.now());
    const project = opts.project || 'lab';
    const rand = SH.rng(seed);
    let idCounter = 0;
    const newId = () => SH.hash64(`${seed}:${++idCounter}:${rand()}`);
    const initialFiles = Object.assign({}, opts.files || {});
    let files = Object.assign({}, initialFiles);
    const listeners = {};
    const state = { images: [], containers: [], volumes: [], networks: [], history: [], removed: [], layers: new Set(), buildCache: {} };
    const builds = [];
    let session = null; // phiên shell bên trong container: { c, cwd, viaRun }
    let netSeq = 18, ephemeral = 32768;
    let OUT = [], CLEAR = false, cur = { kind: 'other', meta: {} };

    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => off(evt, fn); }
    function off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); }
    function emit(evt, data) { (listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }); }

    // ---------- Ghi kết quả ra terminal ----------
    const p = (text, cls = '') => String(text).split('\n').forEach((t) => OUT.push({ text: t, cls }));
    const err = (text) => p(text, 'err');
    const hint = (text) => p('💡 ' + text, 'hint');
    const okLine = (text) => p(text, 'ok');
    const id12 = (id) => id.slice(0, 12);
    const repoPath = (repo) => (repo.includes('/') ? repo : 'library/' + repo);
    const pad2 = (n) => String(n).padStart(2, '0');
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function dt(t = now()) { const d = new Date(t); return { Y: d.getUTCFullYear(), M: pad2(d.getUTCMonth() + 1), D: pad2(d.getUTCDate()), h: pad2(d.getUTCHours()), m: pad2(d.getUTCMinutes()), s: pad2(d.getUTCSeconds()), mon: MON[d.getUTCMonth()] }; }
    const iso = (t) => new Date(t).toISOString().replace(/\.\d+Z$/, '.000000000Z');

    // ---------- Network mặc định ----------
    function addNet(name, driver, subnet, builtin) {
      const n = { id: newId(), name, driver, subnet, prefix: subnet ? subnet.split('.').slice(0, 3).join('.') : '', next: 2, builtin: !!builtin, created: now(), labels: {} };
      state.networks.push(n);
      return n;
    }
    addNet('bridge', 'bridge', '172.17.0.0/16', true);
    addNet('host', 'host', '', true);
    addNet('none', 'null', '', true);
    const findNet = (name) => state.networks.find((n) => n.name === name || n.id.startsWith(name));

    function connect(c, net, aliases = []) {
      const ip = net.prefix ? `${net.prefix}.${net.next++}` : '';
      c.networks[net.name] = { ip, aliases: [c.name, id12(c.id), ...aliases] };
    }

    // ---------- Image ----------
    const fullId = (shortId) => shortId + SH.hash64(shortId).slice(shortId.length);
    function findImage(ref) {
      if (!ref) return undefined;
      const r = String(ref);
      if (/^(sha256:)?[0-9a-f]{4,64}$/.test(r)) {
        const h = r.replace('sha256:', '');
        const m = state.images.find((i) => i.id.startsWith(h));
        if (m) return m;
      }
      const pr = REG.parseRef(r);
      return state.images.find((i) => i.repo === pr.repo && i.tag === pr.tag);
    }
    const findImageById = (id) => state.images.find((i) => i.id === id);
    function addImageRef(img) {
      const old = state.images.find((i) => i.repo === img.repo && i.tag === img.tag);
      if (old && old.id !== img.id) {
        // Image cũ mất tag: nếu không còn tag nào khác thì thành image "<none>" (dangling)
        const others = state.images.filter((i) => i.id === old.id && i !== old);
        if (others.length) state.images.splice(state.images.indexOf(old), 1);
        else { old.repo = '<none>'; old.tag = '<none>'; }
      } else if (old) return old;
      state.images.push(img);
      return img;
    }
    function imageFromDef(def, repo, tag) {
      return { id: fullId(def.id), repo, tag, size: def.size, layers: def.layers, created: now() - def.daysAgo * 86400000, config: Object.assign({}, def) };
    }

    // In kết quả pull giống Docker; fromRun = true khi được gọi tự động từ "docker run"
    function pull(ref, o = {}) {
      const pr = REG.parseRef(ref);
      const res = REG.resolve(ref);
      const pre = o.prefix || '';
      if (res.error === 'repo') {
        err(`${pre}Error response from daemon: pull access denied for ${res.repo}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied`);
        hint(`Không có image "${res.repo}" trên registry (hoặc gõ sai tên). Môi trường mô phỏng có sẵn: ${Object.keys(REG.CATALOG).join(', ')}.`);
        return null;
      }
      if (res.error === 'tag') {
        err(`${pre}Error response from daemon: manifest for ${res.repo}:${res.tag} not found: manifest unknown: manifest unknown`);
        hint(`Image "${res.repo}" không có tag "${res.tag}". Các tag có sẵn: ${Object.keys(REG.CATALOG[res.repo]).join(', ')}.`);
        return null;
      }
      if (!pr.explicitTag && !o.fromRun) p('Using default tag: latest');
      p(`${res.tag}: Pulling from ${repoPath(res.repo)}`);
      const id = fullId(res.def.id);
      const existing = findImage(`${res.repo}:${res.tag}`);
      const digest = `Digest: sha256:${SH.hash64('digest:' + id)}`;
      let image;
      if (existing && existing.id === id) {
        p(digest);
        p(`Status: Image is up to date for ${res.repo}:${res.tag}`);
        image = existing;
      } else {
        res.def.layers.forEach((l) => {
          if (state.layers.has(l.id)) p(`${l.id}: Already exists`, 'dim');
          else { p(`${l.id}: Pull complete`); state.layers.add(l.id); }
        });
        p(digest);
        p(`Status: Downloaded newer image for ${res.repo}:${res.tag}`);
        image = addImageRef(imageFromDef(res.def, res.repo, res.tag));
      }
      if (!o.fromRun) p(`docker.io/${repoPath(res.repo)}:${res.tag}`);
      emit('event', { type: 'pull', repo: res.repo, tag: res.tag });
      return image;
    }

    // ---------- Container: hệ thống file ----------
    function imageFiles(c) { const img = findImageById(c.imageId); return (img && img.config.files) || c.cfg.files || {}; }
    function mountFor(c, path) {
      let best = null;
      for (const m of c.mounts) {
        const t = m.target.replace(/\/$/, '');
        if (path === t || path.startsWith(t + '/')) if (!best || t.length > best.target.length) best = m;
      }
      return best;
    }
    const relOf = (m, path) => { const t = m.target.replace(/\/$/, ''); return path === t ? '' : path.slice(t.length + 1); };
    function wsKey(src, rel) {
      let s = String(src).replace(/^\/home\/user\/lab\/?/, './').replace(/^\.\//, '').replace(/\/$/, '');
      if (s === '.') s = '';
      return [s, rel].filter(Boolean).join('/');
    }
    function getVolume(name) { return state.volumes.find((v) => v.name === name); }
    function ensureVolume(name, anonymous, labels) {
      let v = getVolume(name);
      if (!v) { v = { name, created: now(), data: {}, anonymous: !!anonymous, labels: labels || {} }; state.volumes.push(v); }
      return v;
    }
    function fsRead(c, path) {
      const m = mountFor(c, path);
      if (m) {
        const rel = relOf(m, path);
        if (m.type === 'volume') { const v = getVolume(m.source); return v ? v.data[rel] : undefined; }
        const f = files[wsKey(m.source, rel)];
        return typeof f === 'string' ? f : undefined;
      }
      if (Object.prototype.hasOwnProperty.call(c.layer, path)) return c.layer[path] === null ? undefined : c.layer[path];
      return imageFiles(c)[path];
    }
    function fsWrite(c, path, content) {
      const m = mountFor(c, path);
      if (m) {
        if (m.ro) return 'Read-only file system';
        const rel = relOf(m, path);
        if (m.type === 'volume') ensureVolume(m.source).data[rel] = content;
        else files[wsKey(m.source, rel)] = content;
        return null;
      }
      c.layer[path] = content;
      return null;
    }
    function fsDelete(c, path) {
      const m = mountFor(c, path);
      if (m) {
        const rel = relOf(m, path);
        if (m.type === 'volume') { const v = getVolume(m.source); if (v) delete v.data[rel]; } else delete files[wsKey(m.source, rel)];
        return;
      }
      c.layer[path] = null;
    }
    // Liệt kê toàn bộ đường dẫn file mà container nhìn thấy (image + lớp ghi + mount)
    function allPaths(c) {
      const set = new Set();
      Object.keys(imageFiles(c)).forEach((k) => set.add(k));
      Object.keys(c.layer).forEach((k) => (c.layer[k] === null ? set.delete(k) : set.add(k)));
      c.mounts.forEach((m) => {
        const t = m.target.replace(/\/$/, '');
        [...set].forEach((k) => { if (k.startsWith(t + '/')) set.delete(k); });
        if (m.type === 'volume') { const v = getVolume(m.source); if (v) Object.keys(v.data).forEach((r) => set.add(r ? `${t}/${r}` : t)); } else {
          const pre = wsKey(m.source, '');
          Object.keys(files).forEach((k) => { if (typeof files[k] === 'string' && (pre === '' || k.startsWith(pre + '/'))) set.add(`${t}/${pre ? k.slice(pre.length + 1) : k}`); });
        }
      });
      return set;
    }
    function isDir(c, path) {
      if (path === '/') return true;
      const top = path.split('/')[1];
      if (path === '/' + top && BASE_DIRS.includes(top)) return true;
      if (c.dirs.has(path)) return true;
      if (c.mounts.some((m) => m.target.replace(/\/$/, '') === path || m.target.startsWith(path + '/'))) return true;
      if (c.workdir === path || c.workdir.startsWith(path + '/')) return true;
      for (const k of allPaths(c)) if (k.startsWith(path + '/')) return true;
      return false;
    }
    function listDir(c, path) {
      const base = path === '/' ? '' : path;
      const names = new Set();
      if (path === '/') BASE_DIRS.forEach((d) => names.add(d));
      const add = (full) => { if (full.startsWith(base + '/')) { const n = full.slice(base.length + 1).split('/')[0]; if (n) names.add(n); } };
      allPaths(c).forEach(add);
      c.dirs.forEach(add);
      c.mounts.forEach((m) => add(m.target.replace(/\/$/, '')));
      add(c.workdir);
      return [...names].sort();
    }
    function prepopulate(v, image, target) {
      // Docker chép sẵn nội dung image vào volume rỗng ở lần gắn đầu tiên
      if (!v || Object.keys(v.data).length) return;
      const t = target.replace(/\/$/, '');
      const f = (image && image.config.files) || {};
      Object.keys(f).forEach((k) => { if (k.startsWith(t + '/')) v.data[k.slice(t.length + 1)] = f[k]; });
    }

    // ---------- Container: vòng đời ----------
    function randomName() {
      for (let k = 0; k < 400; k++) {
        const n = `${ADJ[Math.floor(rand() * ADJ.length)]}_${SCI[Math.floor(rand() * SCI.length)]}`;
        if (!state.containers.some((c) => c.name === n)) return n;
      }
      return 'container_' + idCounter;
    }
    function find(nameOrId) {
      if (!nameOrId) return undefined;
      const byName = state.containers.find((c) => c.name === nameOrId || c.name === String(nameOrId).replace(/^\//, ''));
      if (byName) return byName;
      const m = state.containers.filter((c) => c.id.startsWith(nameOrId));
      return m.length === 1 ? m[0] : undefined;
    }
    const log = (c, text, stream = 'stdout') => String(text).split('\n').forEach((t) => c.logs.push({ t: now(), text: t, stream }));

    function createContainer(image, o) {
      const id = newId();
      const c = {
        id, name: o.name || randomName(), image: o.imageRef, imageId: image.id, cfg: image.config,
        cmd: o.cmd && o.cmd.length ? o.cmd.slice() : (image.config.cmd || []).slice(), userCmd: !!(o.cmd && o.cmd.length),
        entrypoint: o.entrypoint !== undefined ? [o.entrypoint].filter(Boolean) : (image.config.entrypoint || []).slice(),
        status: 'created', exitCode: 0, created: now(), startedAt: 0, finishedAt: 0,
        ports: o.ports || [], mounts: o.mounts || [], networks: {}, env: Object.assign({}, image.config.env, o.env || {}),
        logs: [], layer: {}, dirs: new Set(), serving: [], rm: !!o.rm, tty: !!o.tty, interactive: !!o.interactive,
        workdir: o.workdir || image.config.workdir || '/', labels: o.labels || {}, restart: o.restart || 'no', sleepUntil: 0, bins: new Set(),
      };
      c.hostname = o.hostname || id12(id);
      state.containers.push(c);
      connect(c, findNet(o.network || 'bridge'), o.aliases || []);
      c.mounts.forEach((m) => { if (m.type === 'volume') prepopulate(ensureVolume(m.source, m.anonymous, m.labels), image, m.target); });
      return c;
    }

    function cmdString(c) { return [...c.entrypoint, ...c.cmd].join(' '); }
    function exitC(c, code) {
      c.status = 'exited'; c.exitCode = code; c.finishedAt = now(); c.serving = []; c.sleepUntil = 0;
      if (session && session.c === c) session = null;
      if (c.rm) removeContainer(c, { volumes: true, auto: true });
    }
    function start(c) {
      for (const pt of c.ports) {
        if (pt.host == null || pt.auto) { pt.auto = true; pt.host = ephemeral++; }
        const clash = state.containers.find((o) => o !== c && o.status === 'running' && o.ports.some((q) => q.host === pt.host && q.proto === pt.proto));
        if (clash) return { ok: false, clash, error: `driver failed programming external connectivity on endpoint ${c.name} (${c.id}): Bind for ${pt.ip}:${pt.host} failed: port is already allocated`, port: pt.host };
      }
      const missing = Object.keys(c.networks).find((n) => !findNet(n));
      if (missing) return { ok: false, error: `network ${missing} not found` };
      c.status = 'running'; c.startedAt = now(); c.exitCode = 0; c.serving = [];
      const from = c.logs.length;
      const r = runMain(c) || {};
      if (r.error) return { ok: false, error: r.error, oci: true };
      return { ok: true, out: c.logs.slice(from) };
    }
    function stopC(c, signal) {
      if (c.status !== 'running') return;
      const k = c.cfg.kind, main = progName(c.cmd[0]);
      let code = 0;
      if (signal === 'KILL') code = 137;
      else if (k === 'nginx' && !c.userCmd) { const d = dt(); log(c, `${d.Y}/${d.M}/${d.D} ${d.h}:${d.m}:${d.s} [notice] 1#1: signal 3 (SIGQUIT) received, shutting down`); log(c, `${d.Y}/${d.M}/${d.D} ${d.h}:${d.m}:${d.s} [notice] 1#1: exit`); }
      else if (k === 'redis' && !c.userCmd) { log(c, `1:M ${redisTime()} # User requested shutdown...`); log(c, `1:M ${redisTime()} * DB saved on disk`); log(c, `1:M ${redisTime()} # Redis is now ready to exit, bye bye...`); }
      else if (k === 'postgres' && !c.userCmd) log(c, `${pgTime()} UTC [1] LOG:  database system is shut down`);
      // Tiến trình PID 1 không tự xử lý SIGTERM (python, sleep...) bị SIGKILL sau 10 giây → mã 137
      else if (['app', 'counter'].includes(k) || ['sleep', 'tail', 'python', 'python3', 'node'].includes(main)) code = 137;
      exitC(c, code);
    }
    function removeContainer(c, o = {}) {
      state.removed.push({ id: c.id, name: c.name, image: c.image, status: c.status, t: now(), auto: !!o.auto });
      const i = state.containers.indexOf(c);
      if (i >= 0) state.containers.splice(i, 1);
      if (o.volumes) c.mounts.filter((m) => m.anonymous).forEach((m) => { const v = getVolume(m.source); if (v && !volumeUsers(v.name).length) state.volumes.splice(state.volumes.indexOf(v), 1); });
      if (session && session.c === c) session = null;
      emit('event', { type: 'rm', name: c.name });
    }
    const volumeUsers = (name) => state.containers.filter((c) => c.mounts.some((m) => m.type === 'volume' && m.source === name));

    const progName = (s) => String(s || '').split('/').pop();
    const redisTime = () => { const d = dt(); return `${d.D} ${d.mon} ${d.Y} ${d.h}:${d.m}:${d.s}.000`; };
    const pgTime = () => { const d = dt(); return `${d.Y}-${d.M}-${d.D} ${d.h}:${d.m}:${d.s}.000`; };

    // Tiến trình chính (PID 1) của container quyết định container chạy tiếp hay thoát
    function runMain(c) {
      const k = c.cfg.kind, cmd = c.cmd, prog = progName(cmd[0]);
      const d = dt();
      if (k === 'hello' && !c.userCmd) { HELLO.forEach((l) => log(c, l)); exitC(c, 0); return; }
      if (k === 'hello') return { error: `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "${cmd[0]}": executable file not found in $PATH: unknown` };
      if (k === 'nginx' && (!c.userCmd || prog === 'nginx')) {
        ['/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration', '/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh', '/docker-entrypoint.sh: Configuration complete; ready for start up'].forEach((l) => log(c, l));
        log(c, `${d.Y}/${d.M}/${d.D} ${d.h}:${d.m}:${d.s} [notice] 1#1: nginx/${c.cfg.version}`);
        log(c, `${d.Y}/${d.M}/${d.D} ${d.h}:${d.m}:${d.s} [notice] 1#1: start worker processes`);
        c.serving = [80];
        return;
      }
      if (k === 'redis' && (!c.userCmd || prog === 'redis-server')) {
        log(c, `1:C ${redisTime()} * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo`);
        log(c, `1:M ${redisTime()} * Server initialized`);
        if (fsRead(c, '/data/dump.rdb')) log(c, `1:M ${redisTime()} * DB loaded from disk: 0.000 seconds`);
        log(c, `1:M ${redisTime()} * Ready to accept connections tcp`);
        c.serving = [6379];
        return;
      }
      if (k === 'postgres' && (!c.userCmd || prog === 'postgres')) {
        if (!c.env.POSTGRES_PASSWORD && c.env.POSTGRES_HOST_AUTH_METHOD !== 'trust') {
          ['Error: Database is uninitialized and superuser password is not specified.', '       You must specify POSTGRES_PASSWORD to a non-empty value for the', '       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".'].forEach((l) => log(c, l, 'stderr'));
          exitC(c, 1);
          return;
        }
        const pg = !fsRead(c, '/var/lib/postgresql/data/PG_VERSION');
        if (pg) { fsWrite(c, '/var/lib/postgresql/data/PG_VERSION', '16'); log(c, 'PostgreSQL init process complete; ready for start up.'); }
        log(c, `${pgTime()} UTC [1] LOG:  database system is ready to accept connections`);
        c.serving = [5432];
        return;
      }
      if ((k === 'counter' || k === 'app') && (!c.userCmd || /python|flask|gunicorn|uvicorn|node|npm/.test(prog))) {
        if (k === 'app' && !c.cfg.app) return runProgram(c, cmd);
        const port = k === 'counter' ? 5000 : c.cfg.app.port;
        const ip = Object.values(c.networks)[0].ip;
        if (k === 'app' && c.cfg.app.lang === 'node') log(c, `Server listening on http://0.0.0.0:${port}`);
        else { log(c, " * Serving Flask app 'app'"); log(c, ' * Debug mode: off'); log(c, ' * Running on all addresses (0.0.0.0)'); log(c, ` * Running on http://127.0.0.1:${port}`); log(c, ` * Running on http://${ip}:${port}`); }
        c.serving = [port];
        return;
      }
      return runProgram(c, cmd);
    }

    function runProgram(c, cmd) {
      const prog = progName(cmd[0]);
      const args = cmd.slice(1);
      if (!prog) { exitC(c, 0); return; }
      if (!which(c, prog)) return { error: `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "${cmd[0]}": executable file not found in $PATH: unknown` };
      if (SHELLS.includes(prog)) {
        const ci = args.indexOf('-c');
        if (ci >= 0) { const r = runScript(c, args.slice(ci + 1).join(' '), { cwd: c.workdir }); r.lines.forEach((l) => log(c, l.text, l.cls === 'err' ? 'stderr' : 'stdout')); exitC(c, r.code); return; }
        if (c.tty && c.interactive) return; // giữ chạy để người học gắn vào shell
        exitC(c, 0); // không có stdin nên shell thoát ngay
        return;
      }
      if (prog === 'sleep') { const n = args[0] === 'infinity' ? Infinity : parseFloat(args[0]) || 0; c.sleepUntil = now() + n * 1000; if (n <= 0) exitC(c, 0); return; }
      if (prog === 'tail' && args.includes('-f')) return;
      if (['python', 'python3', 'node'].includes(prog) && !args.length) {
        if (c.tty && c.interactive) {
          log(c, prog === 'node' ? `Welcome to Node.js v${c.cfg.version || '20.18.0'}.` : `Python ${c.cfg.version || '3.12.7'} (main, Oct  1 2026, 08:12:31) [GCC 12.2.0] on linux`);
          log(c, '(mô phỏng: chế độ REPL tương tác không được hỗ trợ, container thoát)');
        }
        exitC(c, 0);
        return;
      }
      if (['python', 'python3'].includes(prog) && args[0] && !args[0].startsWith('-')) {
        const path = args[0].startsWith('/') ? args[0] : (c.workdir.replace(/\/$/, '') + '/' + args[0]);
        const src = fsRead(c, path);
        if (src === undefined) { log(c, `python: can't open file '${path}': [Errno 2] No such file or directory`, 'stderr'); exitC(c, 2); return; }
        if (/app\.run|flask|uvicorn|http\.server|serve_forever/.test(src)) {
          const pm = src.match(/port\s*=\s*(\d+)/);
          c.serving = [pm ? +pm[1] : 5000];
          log(c, " * Serving Flask app 'app'"); log(c, ` * Running on http://0.0.0.0:${c.serving[0]}`);
          return;
        }
        const pr = [...src.matchAll(/print\((['"])(.*?)\1\)/g)].map((m) => m[2]);
        pr.forEach((l) => log(c, l));
        exitC(c, 0);
        return;
      }
      const r = containerCmd(c, cmd, { cwd: c.workdir });
      r.lines.forEach((l) => log(c, l.text, l.cls === 'err' ? 'stderr' : 'stdout'));
      exitC(c, r.code);
    }

    // Chương trình có sẵn trong từng loại image (alpine không có bash, debian-slim không có ping...)
    function which(c, prog) {
      const k = c.cfg.kind, sh = c.cfg.shell;
      if (c.bins.has(prog)) return true;
      if (k === 'hello') return prog === '/hello' || prog === 'hello';
      const common = ['sh', 'echo', 'ls', 'cat', 'env', 'printenv', 'hostname', 'sleep', 'tail', 'pwd', 'whoami', 'id', 'mkdir', 'touch', 'rm', 'cd', 'ps', 'exit', 'true', 'false', 'date', 'uname', 'head', 'wc', 'clear', 'export'];
      if (common.includes(prog)) return true;
      if (sh === 'sh') { if (['ash', 'ping', 'wget', 'nslookup', 'nc', 'vi', 'top', 'apk'].includes(prog)) return true; }
      else if (['bash', 'getent', 'apt-get', 'apt'].includes(prog)) return true;
      if (prog === 'curl' && (['nginx'].includes(k) && sh === 'bash' || c.cfg.layers.some((l) => /curl/.test(l.cmd)))) return true;
      const extra = { redis: ['redis-cli', 'redis-server'], postgres: ['psql', 'pg_isready', 'postgres'], python: ['python', 'python3', 'pip'], counter: ['python', 'python3', 'pip'], node: ['node', 'npm', 'npx'], nginx: ['nginx'] };
      if (k === 'app') return ['python', 'python3', 'pip', 'node', 'npm', 'npx'].includes(prog) && (c.cfg.app ? (c.cfg.app.lang === 'node') === ['node', 'npm', 'npx'].includes(prog) : true);
      return (extra[k] || []).includes(prog);
    }

    // ---------- Phân giải tên và gọi dịch vụ giữa các container ----------
    function resolveHost(c, host) {
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host) || host === c.hostname || host === id12(c.id)) return { target: c, ip: '127.0.0.1' };
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        for (const net of Object.keys(c.networks)) {
          const t = state.containers.find((o) => o.status === 'running' && o.networks[net] && o.networks[net].ip === host);
          if (t) return { target: t, ip: host, net };
        }
        return { fail: 'noroute' };
      }
      for (const net of Object.keys(c.networks)) {
        if (BUILTIN_NETS.includes(net)) continue; // network bridge mặc định không có DNS theo tên
        const t = state.containers.find((o) => o.status === 'running' && o.networks[net] && o.networks[net].aliases.includes(host));
        if (t) return { target: t, ip: t.networks[net].ip, net };
      }
      const ex = state.containers.find((o) => o.name === host || Object.values(o.networks).some((n) => n.aliases.includes(host)));
      if (ex) {
        if (ex.status !== 'running') return { fail: 'stopped', exists: ex };
        const shared = Object.keys(c.networks).filter((n) => ex.networks[n]);
        return { fail: shared.includes('bridge') ? 'bridge-dns' : 'other-net', exists: ex };
      }
      return { fail: 'unknown' };
    }
    function resolveHint(c, host, r) {
      if (r.fail === 'bridge-dns') return `"${host}" và "${c.name}" cùng ở network bridge mặc định. Network này không có DNS theo tên container. Tạo network riêng (docker network create appnet) rồi chạy cả hai container với --network appnet.`;
      if (r.fail === 'other-net') return `"${host}" đang chạy nhưng ở network khác (${Object.keys(r.exists.networks).join(', ')}). Hai container phải chung một network do bạn tạo: docker network connect <network> ${c.name}`;
      if (r.fail === 'stopped') return `Container "${host}" đang dừng. Docker chỉ phân giải tên của container đang chạy.`;
      return '';
    }
    function clf() { const d = dt(); return `${d.D}/${d.mon}/${d.Y}:${d.h}:${d.m}:${d.s} +0000`; }
    function redisStore(t) { if (!t.redis) { try { t.redis = JSON.parse(fsRead(t, '/data/dump.rdb') || '{}'); } catch (e) { t.redis = {}; } } return t.redis; }
    function redisSave(t) { fsWrite(t, '/data/dump.rdb', JSON.stringify(t.redis || {})); }

    // Trả lời một yêu cầu HTTP tới container đích ở cổng port
    function serve(t, port, path, fromIp, ua = 'curl/8.5.0') {
      if (t.status !== 'running' || !t.serving.includes(port)) return { refused: true };
      const k = t.cfg.kind;
      if (k === 'nginx') {
        const file = '/usr/share/nginx/html' + (path === '/' || path === '' ? '/index.html' : path.replace(/\/$/, '/index.html'));
        const body = fsRead(t, file);
        const status = body === undefined ? 404 : 200;
        const text = body === undefined ? '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx/' + t.cfg.version + '</center>\n</body>\n</html>' : body;
        log(t, `${fromIp} - - [${clf()}] "GET ${path || '/'} HTTP/1.1" ${status} ${text.length} "-" "${ua}"`);
        return { status, body: text, server: `nginx/${t.cfg.version}`, type: 'text/html' };
      }
      if (k === 'counter') {
        const host = t.env.REDIS_HOST || 'redis';
        const r = resolveHost(t, host);
        const rd = r.target && r.target.cfg.kind === 'redis' && r.target.serving.includes(6379) ? r.target : null;
        if (!rd) {
          const why = r.target ? 'Connection refused' : 'Name or service not known';
          log(t, `[${new Date(now()).toISOString()}] ERROR in app: Exception on / [GET]`, 'stderr');
          log(t, `redis.exceptions.ConnectionError: Error ${r.target ? 111 : -2} connecting to ${host}:6379. ${why}.`, 'stderr');
          log(t, `${fromIp} - - [${clf()}] "GET / HTTP/1.1" 500 -`, 'stderr');
          return { status: 500, body: '<!doctype html>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>', server: 'Werkzeug/3.0.4 Python/3.12.7', type: 'text/html', redisError: why, redisHost: host, redisFail: r };
        }
        const st = redisStore(rd);
        st.hits = String((parseInt(st.hits, 10) || 0) + 1);
        redisSave(rd);
        log(t, `${fromIp} - - [${clf()}] "GET / HTTP/1.1" 200 -`, 'stderr');
        emit('event', { type: 'call', from: t.name, to: rd.name, ok: true });
        return { status: 200, body: `Xin chào! Trang này đã được xem ${st.hits} lần.`, server: 'Werkzeug/3.0.4 Python/3.12.7', type: 'text/html; charset=utf-8', hits: +st.hits };
      }
      if (k === 'app' || (t.serving.length && ['python', 'node'].includes(k))) {
        const msg = (t.cfg.app && t.cfg.app.message) || `Hello from ${t.image}!`;
        log(t, `${fromIp} - - [${clf()}] "GET ${path || '/'} HTTP/1.1" 200 -`, 'stderr');
        return { status: 200, body: msg, server: 'Werkzeug/3.0.4 Python/3.12.7', type: 'text/html; charset=utf-8' };
      }
      return { empty: true };
    }

    function parseUrl(u) {
      const m = String(u).replace(/^https?:\/\//, '').match(/^([^/:]+)(?::(\d+))?(\/.*)?$/);
      if (!m) return null;
      return { host: m[1], port: m[2] ? +m[2] : 80, path: m[3] || '/' };
    }
    function printHttp(res, flags) {
      if (flags.i || flags.I) {
        p(`HTTP/1.1 ${res.status} ${res.status === 200 ? 'OK' : res.status === 404 ? 'Not Found' : 'Internal Server Error'}`);
        p(`Server: ${res.server}`);
        p(`Content-Type: ${res.type}`);
        p(`Content-Length: ${res.body.length}`);
        if (flags.I) return;
        p('');
      }
      p(res.body);
    }

    // curl chạy trên máy host: chỉ tới được container qua cổng đã ánh xạ (-p)
    function hostCurl(args, prog) {
      const a = SH.parseArgs(args, { bool: ['s', 'i', 'I', 'v', 'L', 'q', 'S', 'f'], value: ['O', 'o', 'X', 'H', 'm'], alias: { silent: 's', include: 'i', head: 'I', verbose: 'v', location: 'L' } });
      const url = a.args[0];
      cur.kind = 'curl';
      if (!url) { err(`${prog}: try '${prog} --help' for more information`); return false; }
      const u = parseUrl(url);
      if (!u) { err(`curl: (3) URL rejected: Malformed input to a URL function`); return false; }
      cur.meta = { port: u.port, host: u.host, path: u.path, ok: false };
      if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(u.host)) {
        err(`curl: (6) Could not resolve host: ${u.host}`);
        if (find(u.host)) hint(`"${u.host}" là tên container. Tên này chỉ phân giải được bên trong network của Docker, không phải từ máy host. Từ máy host hãy dùng localhost:<cổng host đã ánh xạ>.`);
        emit('event', { type: 'curl', from: 'host', to: null, ok: false });
        return false;
      }
      const t = state.containers.find((c) => c.status === 'running' && c.ports.some((q) => q.host === u.port));
      if (!t) {
        err(`curl: (7) Failed to connect to ${u.host} port ${u.port} after 0 ms: Couldn't connect to server`);
        const stopped = state.containers.find((c) => c.status !== 'running' && c.ports.some((q) => q.host === u.port));
        const unpub = state.containers.find((c) => c.status === 'running' && c.serving.includes(u.port) && !c.ports.length);
        if (stopped) hint(`Container "${stopped.name}" có ánh xạ cổng ${u.port} nhưng đang ${stopped.status === 'created' ? 'ở trạng thái Created (chưa chạy được)' : 'dừng'}. Khởi động lại bằng: docker start ${stopped.name}`);
        else if (unpub) hint(`Container "${unpub.name}" lắng nghe cổng ${u.port} bên trong, nhưng chưa ánh xạ ra máy host. Chạy lại với -p ${u.port}:${u.port} (cổng host:cổng container).`);
        else hint(`Không có container đang chạy nào ánh xạ cổng ${u.port} của máy host. Kiểm tra bằng "docker ps" (cột PORTS).`);
        emit('event', { type: 'curl', from: 'host', to: null, ok: false });
        return false;
      }
      const map = t.ports.find((q) => q.host === u.port);
      const res = serve(t, map.container, u.path, '172.17.0.1');
      cur.meta.container = t.name;
      if (res.refused) {
        err('curl: (56) Recv failure: Connection reset by peer');
        hint(`Cổng ${u.port} của host được chuyển tới cổng ${map.container} của "${t.name}", nhưng trong container không có tiến trình nào lắng nghe cổng ${map.container}${t.serving.length ? ` (ứng dụng đang nghe cổng ${t.serving.join(', ')})` : ''}. Kiểm tra lại vế phải của -p.`);
        emit('event', { type: 'curl', from: 'host', to: t.name, ok: false });
        return false;
      }
      if (res.empty) { err('curl: (52) Empty reply from server'); hint(`"${t.name}" không phải máy chủ HTTP nên không trả lời curl.`); return false; }
      printHttp(res, a.flags);
      if (res.redisError) hint(`Ứng dụng không kết nối được Redis tại "${res.redisHost}" (${res.redisError}). Xem "docker logs ${t.name}". ${resolveHint(t, res.redisHost, res.redisFail) || ''}`);
      cur.meta.ok = res.status < 400; cur.meta.status = res.status; cur.meta.hits = res.hits;
      emit('event', { type: 'curl', from: 'host', to: t.name, ok: res.status < 400 });
      return res.status < 400 || !!(a.flags.i || a.flags.I);
    }

    // ---------- Lệnh chạy bên trong container ----------
    function runScript(c, script, ctx) {
      const parts = String(script).split(/\s*(?:&&|;)\s*/).filter(Boolean);
      const lines = [];
      let code = 0;
      for (const part of parts) {
        let toks;
        try { toks = SH.tokenize(part); } catch (e) { return { code: 2, lines: [{ text: `sh: syntax error: ${e.message}`, cls: 'err' }] }; }
        const r = containerCmd(c, toks, ctx);
        lines.push(...r.lines);
        code = r.code;
        if (code !== 0 && script.includes('&&')) break;
      }
      return { code, lines };
    }

    function containerCmd(c, tokens, ctx) {
      const lines = [];
      const say = (t, cls = '') => String(t).split('\n').forEach((x) => lines.push({ text: x, cls }));
      const fail = (t, code = 1) => { say(t, 'err'); return { code, lines, meta }; };
      const meta = {};
      const busy = c.cfg.shell === 'sh';
      let toks = tokens.slice();
      // Chuyển hướng "> file" và ">> file"
      let redirect = null;
      const ri = toks.findIndex((t) => t === '>' || t === '>>');
      if (ri >= 0) { redirect = { append: toks[ri] === '>>', path: toks[ri + 1] }; toks = toks.slice(0, ri); }
      const abs = (pth) => { if (!pth) return ctx.cwd; const raw = pth.startsWith('/') ? pth : `${ctx.cwd.replace(/\/$/, '')}/${pth}`; const out = []; raw.split('/').forEach((s) => { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }); return '/' + out.join('/'); };
      const [prog0, ...args] = toks;
      const prog = progName(prog0);
      if (!prog) return { code: 0, lines, meta };
      if (prog === 'cd') {
        const target = abs(args[0] || '/root');
        if (!isDir(c, target)) return fail(busy ? `sh: cd: can't cd to ${args[0]}: No such file or directory` : `bash: cd: ${args[0]}: No such file or directory`, 2);
        ctx.cwd = target;
        return { code: 0, lines, meta };
      }
      if (!which(c, prog)) {
        say(busy ? `sh: ${prog}: not found` : `bash: ${prog}: command not found`, 'err');
        if (prog === 'bash' && busy) say('💡 Image dựa trên Alpine/BusyBox không có bash, hãy dùng sh.', 'hint');
        else if (prog === 'ping') say('💡 Image này (Debian rút gọn) không cài sẵn ping. Thử "getent hosts <tên>" hoặc dùng container alpine/busybox để ping.', 'hint');
        else if (prog === 'curl' && busy) say('💡 Alpine không có curl, dùng: wget -qO- http://<tên>:<cổng> (hoặc cài: apk add curl).', 'hint');
        else if (prog === 'curl') say('💡 Image này không cài sẵn curl. Có thể cài tạm: apt-get update && apt-get install -y curl (chỉ nằm trong lớp ghi của container, mất khi xóa container).', 'hint');
        else if (prog === 'docker') say('💡 Bạn đang ở bên trong container. Gõ "exit" để quay lại máy host.', 'hint');
        return { code: 127, lines, meta };
      }
      let text = null; // kết quả có thể bị chuyển hướng vào file
      switch (prog) {
        case 'echo': text = args.filter((x) => x !== '-n' && x !== '-e').join(' '); break;
        case 'cat': {
          if (!args.length) return { code: 0, lines, meta };
          const outs = [];
          for (const f of args) {
            const pth = abs(f), v = fsRead(c, pth);
            if (v === undefined) return fail(isDir(c, pth) ? `cat: ${f}: Is a directory` : busy ? `cat: can't open '${f}': No such file or directory` : `cat: ${f}: No such file or directory`);
            outs.push(v.replace(/\n$/, ''));
          }
          text = outs.join('\n');
          break;
        }
        case 'ls': {
          const targets = args.filter((x) => !x.startsWith('-'));
          const showAll = args.some((x) => /^-\w*a/.test(x));
          const pth = abs(targets[0]);
          if (fsRead(c, pth) !== undefined) { text = targets[0]; break; }
          if (!isDir(c, pth)) return fail(busy ? `ls: ${targets[0]}: No such file or directory` : `ls: cannot access '${targets[0]}': No such file or directory`, busy ? 1 : 2);
          text = listDir(c, pth).filter((n) => showAll || !n.startsWith('.')).join('  ');
          break;
        }
        case 'pwd': text = ctx.cwd; break;
        case 'mkdir': args.filter((x) => !x.startsWith('-')).forEach((d) => { const pth = abs(d); c.dirs.add(pth); const m = mountFor(c, pth); if (m && m.type === 'volume') { /* thư mục trong volume được tạo ngầm */ } }); break;
        case 'touch': for (const f of args) { const pth = abs(f); if (fsRead(c, pth) === undefined) { const e = fsWrite(c, pth, ''); if (e) return fail(`touch: ${f}: ${e}`); } } break;
        case 'rm': for (const f of args.filter((x) => !x.startsWith('-'))) { const pth = abs(f); if (fsRead(c, pth) === undefined && !args.some((x) => x.includes('f'))) return fail(busy ? `rm: can't remove '${f}': No such file or directory` : `rm: cannot remove '${f}': No such file or directory`); fsDelete(c, pth); } break;
        case 'env': case 'printenv': {
          const env = Object.assign({ PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', HOSTNAME: c.hostname }, c.env, { HOME: '/root' });
          text = args[0] && prog === 'printenv' ? (env[args[0]] ?? '') : Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
          break;
        }
        case 'export': args.forEach((a) => { const i = a.indexOf('='); if (i > 0) c.env[a.slice(0, i)] = a.slice(i + 1); }); break;
        case 'hostname': text = c.hostname; break;
        case 'whoami': text = 'root'; break;
        case 'id': text = 'uid=0(root) gid=0(root) groups=0(root)'; break;
        case 'uname': text = args.includes('-a') ? `Linux ${c.hostname} 6.10.14-linuxkit #1 SMP x86_64 GNU/Linux` : 'Linux'; break;
        case 'date': { const d = dt(); text = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(now()).getUTCDay()]} ${d.mon} ${d.D} ${d.h}:${d.m}:${d.s} UTC ${d.Y}`; break; }
        case 'true': case 'clear': break;
        case 'false': return { code: 1, lines, meta };
        case 'sleep': break;
        case 'ps': {
          const main = cmdString(c) || 'sh';
          text = busy ? `PID   USER     TIME  COMMAND\n    1 root      0:00 ${main}\n   ${String(7).padStart(2)} root      0:00 sh\n   ${String(13).padStart(2)} root      0:00 ps` : `  PID TTY          TIME CMD\n    1 ?        00:00:00 ${progName(c.cmd[0]) || 'sh'}\n    7 pts/0    00:00:00 bash\n   13 pts/0    00:00:00 ps`;
          break;
        }
        case 'sh': case 'bash': case 'ash': {
          const ci = args.indexOf('-c');
          if (ci >= 0) { const r = runScript(c, args.slice(ci + 1).join(' '), ctx); lines.push(...r.lines); return { code: r.code, lines, meta }; }
          break;
        }
        case 'ping': {
          const cnt = args.indexOf('-c') >= 0 ? Math.min(5, parseInt(args[args.indexOf('-c') + 1], 10) || 3) : 3;
          const host = args.filter((x, i) => !x.startsWith('-') && args[i - 1] !== '-c')[0];
          if (!host) return fail('BusyBox v1.36.1 multi-call binary.\n\nUsage: ping [OPTIONS] HOST');
          const r = resolveHost(c, host);
          Object.assign(meta, { kind: 'ping', target: host, net: r.net });
          if (!r.target) {
            say(`ping: bad address '${host}'`, 'err');
            const h = resolveHint(c, host, r);
            if (h) say('💡 ' + h, 'hint');
            meta.ok = false;
            emit('event', { type: 'ping', from: c.name, to: r.exists ? r.exists.name : null, ok: false });
            return { code: 1, lines, meta };
          }
          say(`PING ${host} (${r.ip}): 56 data bytes`);
          for (let i = 0; i < cnt; i++) say(`64 bytes from ${r.ip}: seq=${i} ttl=64 time=0.0${7 + i} ms`);
          say('', ''); say(`--- ${host} ping statistics ---`); say(`${cnt} packets transmitted, ${cnt} packets received, 0% packet loss`);
          meta.ok = true; meta.to = r.target.name;
          emit('event', { type: 'ping', from: c.name, to: r.target.name, ok: true });
          break;
        }
        case 'nslookup': case 'getent': {
          const host = prog === 'getent' ? args[1] : args[0];
          const r = resolveHost(c, host || '');
          if (!r.target) { if (prog === 'getent') return { code: 2, lines, meta }; return fail(`Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\n** server can't find ${host}: NXDOMAIN`); }
          text = prog === 'getent' ? `${r.ip}       ${host}` : `Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\nName:\t${host}\nAddress: ${r.ip}`;
          meta.kind = 'resolve'; meta.ok = true; meta.target = host;
          break;
        }
        case 'curl': case 'wget': {
          const url = args.filter((x) => !x.startsWith('-'))[0];
          const u = url && parseUrl(url);
          if (!u) return fail(`${prog}: no URL specified`);
          const r = resolveHost(c, u.host);
          Object.assign(meta, { kind: 'http', target: u.host, port: u.port });
          if (!r.target) {
            say(prog === 'wget' ? `wget: bad address '${u.host}'` : `curl: (6) Could not resolve host: ${u.host}`, 'err');
            const h = resolveHint(c, u.host, r); if (h) say('💡 ' + h, 'hint');
            emit('event', { type: 'ping', from: c.name, to: r.exists ? r.exists.name : null, ok: false });
            return { code: 6, lines, meta };
          }
          const res = serve(r.target, u.port, u.path, Object.values(c.networks)[0].ip, prog === 'wget' ? 'Wget' : 'curl/8.5.0');
          if (res.refused) return fail(prog === 'wget' ? `wget: can't connect to remote host (${r.ip}): Connection refused` : `curl: (7) Failed to connect to ${u.host} port ${u.port} after 0 ms: Couldn't connect to server`, 7);
          if (res.empty) return fail('curl: (52) Empty reply from server', 52);
          if (prog === 'wget' && !args.some((x) => x.includes('O'))) say(`Connecting to ${u.host}:${u.port} (${r.ip}:${u.port})\nsaving to 'index.html'\nindex.html           100% |********************************|   ${res.body.length}  0:00:00 ETA\n'index.html' saved`);
          else text = res.body;
          meta.ok = res.status < 400; meta.to = r.target.name;
          emit('event', { type: 'ping', from: c.name, to: r.target.name, ok: meta.ok });
          break;
        }
        case 'redis-cli': return redisCli(c, args, lines, meta);
        case 'python': case 'python3': {
          const ci = args.indexOf('-c');
          if (ci >= 0) { const code = args.slice(ci + 1).join(' '); text = [...code.matchAll(/print\((['"])(.*?)\1\)/g)].map((m) => m[2]).join('\n'); break; }
          if (args[0] === '--version' || args[0] === '-V') { text = `Python ${c.cfg.version || '3.12.7'}`; break; }
          say('(mô phỏng: REPL Python tương tác không được hỗ trợ; hãy dùng python -c "print(...)")', 'dim');
          break;
        }
        case 'node': {
          if (args[0] === '--version' || args[0] === '-v') { text = `v${c.cfg.version || '20.18.0'}`; break; }
          const ei = args.indexOf('-e');
          if (ei >= 0) { text = [...args.slice(ei + 1).join(' ').matchAll(/console\.log\((['"])(.*?)\1\)/g)].map((m) => m[2]).join('\n'); break; }
          say('(mô phỏng: REPL Node tương tác không được hỗ trợ)', 'dim');
          break;
        }
        case 'pip': text = args[0] === 'list' ? 'Package    Version\n---------- -------\npip        24.2\nsetuptools 75.1.0' : '(mô phỏng) Successfully installed'; break;
        case 'nginx': text = args.includes('-v') ? `nginx version: nginx/${c.cfg.version}` : args.includes('-t') ? 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful' : ''; break;
        case 'apk': case 'apt-get': case 'apt': {
          const pk = args.filter((x) => !x.startsWith('-') && !['add', 'install', 'update', 'upgrade'].includes(x));
          if (args.includes('add') || args.includes('install')) {
            pk.forEach((x) => c.bins.add(x));
            say(prog === 'apk' ? `fetch https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86_64/APKINDEX.tar.gz\n(1/1) Installing ${pk.join(', ')}\nOK: 12 MiB in 18 packages` : `Reading package lists... Done\nSetting up ${pk.join(', ')} ...`);
            say('💡 Gói vừa cài chỉ nằm trong lớp ghi của container này và sẽ mất khi xóa container. Muốn giữ lâu dài, hãy đưa lệnh cài vào Dockerfile (RUN ...).', 'hint');
          } else if (args.includes('update')) say(prog === 'apk' ? 'OK: 24 distinct packages available' : 'Reading package lists... Done');
          break;
        }
        case 'psql': case 'pg_isready': text = prog === 'pg_isready' ? '/var/run/postgresql:5432 - accepting connections' : 'psql (16.4)\n(mô phỏng: phiên psql tương tác không được hỗ trợ)'; break;
        case 'head': case 'wc': case 'tail': case 'top': case 'vi': case 'nc': text = '(mô phỏng: lệnh này chưa được hỗ trợ đầy đủ)'; break;
        default: text = '';
      }
      if (text !== null && text !== undefined) {
        if (redirect) {
          if (!redirect.path) return fail(busy ? 'sh: syntax error: unexpected newline' : 'bash: syntax error near unexpected token `newline\'', 2);
          const pth = abs(redirect.path);
          const prev = redirect.append ? (fsRead(c, pth) || '') : '';
          const e = fsWrite(c, pth, prev + text + '\n');
          if (e) return fail(`sh: can't create ${redirect.path}: ${e}`);
        } else if (text !== '') say(text);
      }
      return { code: 0, lines, meta };
    }

    function redisCli(c, args, lines, meta) {
      const say = (t, cls = '') => String(t).split('\n').forEach((x) => lines.push({ text: x, cls }));
      let host = 'localhost';
      const rest = [];
      for (let i = 0; i < args.length; i++) { if (args[i] === '-h') host = args[++i]; else if (args[i] === '-p') i++; else rest.push(args[i]); }
      Object.assign(meta, { kind: 'redis', target: host });
      const r = resolveHost(c, host);
      const t = r.target;
      if (!t) { say(`Could not connect to Redis at ${host}:6379: Name or service not known`, 'err'); const h = resolveHint(c, host, r); if (h) say('💡 ' + h, 'hint'); return { code: 1, lines, meta }; }
      if (t.cfg.kind !== 'redis' || !t.serving.includes(6379)) { say(`Could not connect to Redis at ${host}:6379: Connection refused`, 'err'); return { code: 1, lines, meta }; }
      if (!rest.length) { say('(mô phỏng: chế độ tương tác của redis-cli không được hỗ trợ. Gõ kèm lệnh, ví dụ: redis-cli set ten Lan)', 'dim'); return { code: 0, lines, meta }; }
      const st = redisStore(t);
      const op = rest[0].toLowerCase(), k = rest[1];
      meta.op = op; meta.key = k; meta.to = t.name;
      let out;
      switch (op) {
        case 'ping': out = 'PONG'; break;
        case 'set': if (k === undefined || rest[2] === undefined) out = "(error) ERR wrong number of arguments for 'set' command"; else { st[k] = rest.slice(2).join(' '); out = 'OK'; } break;
        case 'get': out = st[k] === undefined ? '(nil)' : `"${st[k]}"`; meta.value = st[k]; break;
        case 'incr': st[k] = String((parseInt(st[k], 10) || 0) + 1); out = `(integer) ${st[k]}`; break;
        case 'del': out = `(integer) ${rest.slice(1).filter((x) => x in st).length}`; rest.slice(1).forEach((x) => delete st[x]); break;
        case 'keys': { const re = new RegExp('^' + String(k || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); const ks = Object.keys(st).filter((x) => re.test(x)); out = ks.length ? ks.map((x, i) => `${i + 1}) "${x}"`).join('\n') : '(empty array)'; break; }
        case 'dbsize': out = `(integer) ${Object.keys(st).length}`; break;
        case 'flushall': case 'flushdb': Object.keys(st).forEach((x) => delete st[x]); out = 'OK'; break;
        case 'save': out = 'OK'; break;
        default: out = `(error) ERR unknown command '${rest[0]}', with args beginning with: `;
      }
      redisSave(t);
      say(out, out.startsWith('(error)') ? 'err' : '');
      meta.ok = !out.startsWith('(error)');
      emit('event', { type: 'redis', from: c.name, to: t.name, op });
      return { code: meta.ok ? 0 : 1, lines, meta };
    }

    // ---------- Các lệnh docker ----------
    function parse(name, args) {
      const a = SH.parseArgs(args, SPECS[name] || {});
      if (a.error) { err(a.error); p(`See 'docker ${name} --help'.`); return null; }
      return a;
    }
    function noSuch(n) { err(`Error response from daemon: No such container: ${n}`); hint('Kiểm tra tên bằng "docker ps -a". Tên container phân biệt chữ hoa/thường.'); }
    function needArgs(name, a, n, usage) {
      if (a.args.length >= n) return true;
      err(`"docker ${name}" requires at least ${n} argument${n > 1 ? 's' : ''}.`);
      p(`See 'docker ${name} --help'.`); p(''); p(`Usage:  ${usage}`);
      return false;
    }
    function parsePort(spec) {
      const m = String(spec).match(/^(?:(\d+\.\d+\.\d+\.\d+):)?(?:(\d*):)?(\d+)(?:\/(tcp|udp))?$/);
      if (!m) return null;
      const host = m[2] ? +m[2] : null, container = +m[3];
      if (container < 1 || container > 65535 || (host !== null && (host < 1 || host > 65535))) return null;
      return { ip: m[1] || '0.0.0.0', host, container, proto: m[4] || 'tcp' };
    }
    function parseVolumeSpec(spec) {
      const parts = String(spec).split(':');
      if (parts.length === 1) {
        if (!parts[0].startsWith('/')) return { error: `invalid mount config for type "volume": invalid mount path: '${parts[0]}' mount path must be absolute` };
        return { type: 'volume', source: SH.hash64('anon:' + newId()), target: parts[0], anonymous: true };
      }
      const [src0, target, mode] = parts;
      const src = src0.replace(/^\$\((pwd|PWD)\)|^\$\{?PWD\}?/, '.');
      const bind = /^[./~]/.test(src);
      if (!target || !target.startsWith('/')) return { error: `invalid mount config for type "${bind ? 'bind' : 'volume'}": invalid mount path: '${target || ''}' mount path must be absolute` };
      if (!bind && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(src)) return { error: `create ${src}: "${src}" includes invalid characters for a local volume name, only "[a-zA-Z0-9][a-zA-Z0-9_.-]" are allowed. If you intended to pass a host directory, use absolute path` };
      return { type: bind ? 'bind' : 'volume', source: src, target, ro: mode === 'ro' };
    }
    function parseEnv(list) {
      const env = {};
      (list || []).forEach((e) => { const i = e.indexOf('='); if (i > 0) env[e.slice(0, i)] = e.slice(i + 1); else env[e] = ''; });
      return env;
    }

    function runCmd(args) {
      const a = parse('run', args);
      if (!a) return false;
      if (!needArgs('run', a, 1, 'docker run [OPTIONS] IMAGE [COMMAND] [ARG...]')) return false;
      const ref = a.args[0];
      cur.kind = 'run'; cur.meta = { image: ref };
      const name = a.flags.name;
      if (name !== undefined) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) { err(`docker: Error response from daemon: Invalid container name (${name}), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed.`); return false; }
        const ex = find(name);
        if (ex && ex.name === name) {
          err(`docker: Error response from daemon: Conflict. The container name "/${name}" is already in use by container "${ex.id}". You have to remove (or rename) that container to be able to reuse that name.`);
          p("See 'docker run --help'.");
          hint(`Đã có container tên "${name}" (trạng thái: ${ex.status}). Xóa nó bằng "docker rm -f ${name}" hoặc đặt tên khác.`);
          return false;
        }
      }
      const ports = [];
      for (const s of a.flags.p || []) { const pt = parsePort(s); if (!pt) { err(`docker: Error response from daemon: invalid port specification: "${s}"`); hint('Cú pháp đúng: -p <cổng host>:<cổng container>, ví dụ -p 8080:80'); return false; } ports.push(pt); }
      const mounts = [];
      for (const s of a.flags.v || []) { const m = parseVolumeSpec(s); if (m.error) { err(`docker: Error response from daemon: ${m.error}.`); return false; } mounts.push(m); }
      const netName = a.flags.network || 'bridge';
      if (!findNet(netName)) { err(`docker: Error response from daemon: network ${netName} not found.`); hint(`Tạo network trước: docker network create ${netName}`); return false; }
      let image = findImage(ref);
      if (!image) {
        p(`Unable to find image '${REG.parseRef(ref).ref}' locally`);
        image = pull(ref, { fromRun: true, prefix: 'docker: ' });
        if (!image) { p("See 'docker run --help'."); return false; }
      }
      const c = createContainer(image, { name, imageRef: ref, ports, mounts, network: netName, env: parseEnv(a.flags.e), cmd: a.rest, entrypoint: a.flags.entrypoint, rm: a.flags.rm, tty: a.flags.t, interactive: a.flags.i, workdir: a.flags.w, hostname: a.flags.hostname, restart: a.flags.restart, aliases: a.flags['network-alias'] });
      cur.meta.name = c.name;
      const st = start(c);
      if (!st.ok) {
        err(`docker: Error response from daemon: ${st.error}.`);
        if (st.clash) hint(`Cổng ${st.port} của máy host đang được container "${st.clash.name}" dùng. Mỗi cổng host chỉ gán được cho một container: chọn cổng khác (ví dụ -p ${st.port + 1}:${ports[0].container}) hoặc dừng "${st.clash.name}". Container "${c.name}" đã được tạo nhưng ở trạng thái Created.`);
        if (st.oci) { c.exitCode = 127; hint(`Image không có chương trình "${c.cmd[0]}". Kiểm tra lại lệnh ở cuối "docker run".`); }
        return false;
      }
      emit('event', { type: 'run', name: c.name, image: ref });
      if (a.flags.d) {
        p(c.id);
        if (c.status === 'exited') hint(`Container "${c.name}" đã thoát ngay sau khi chạy (mã thoát ${c.exitCode}). Xem lý do bằng: docker logs ${c.name}`);
        return true;
      }
      st.out.forEach((l) => p(l.text, l.stream === 'stderr' ? 'err' : ''));
      if (c.status === 'running') {
        if (c.tty && c.interactive && SHELLS.includes(progName(c.cmd[0]))) { session = { c, cwd: c.workdir, viaRun: true }; return true; }
        hint('Container đang chạy ở chế độ tiền cảnh (foreground). Trên máy thật terminal sẽ bị giữ cho đến khi bấm Ctrl+C; trong mô phỏng container được chuyển sang chạy nền. Lần sau hãy thêm -d.');
        return true;
      }
      if (c.status === 'exited' && SHELLS.includes(progName(c.cmd[0])) && !c.tty) hint('Shell thoát ngay vì không có -it (không có bàn phím gắn vào). Muốn vào shell: docker run -it ' + ref + ' sh');
      return c.exitCode === 0;
    }

    function fmtPorts(c) {
      if (c.status !== 'running') return '';
      const pub = c.ports.map((q) => `${q.ip}:${q.host}->${q.container}/${q.proto}`);
      const exp = (c.cfg.expose || []).filter((e) => !c.ports.some((q) => q.container === e)).map((e) => `${e}/tcp`);
      return [...pub, ...exp].join(', ');
    }
    function fmtStatus(c) {
      if (c.status === 'running') return `Up ${SH.duration(now() - c.startedAt)}`;
      if (c.status === 'exited') return `Exited (${c.exitCode}) ${SH.ago(now() - c.finishedAt)}`;
      return 'Created';
    }
    function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    function goFormat(fmt, obj) {
      return fmt.replace(/^table\s+/, '').replace(/\\t/g, '\t').replace(/\{\{\s*(json\s+)?\.([\w.]*)\s*\}\}/g, (m, json, path) => {
        let v = obj;
        path.split('.').filter(Boolean).forEach((k) => { v = v == null ? undefined : v[k]; });
        if (json || (v && typeof v === 'object')) return JSON.stringify(v === undefined ? null : v);
        return v === undefined ? '<no value>' : String(v);
      });
    }

    function psCmd(args) {
      const a = parse('ps', args);
      if (!a) return false;
      let list = state.containers.filter((c) => a.flags.a || c.status === 'running');
      (a.flags.filter || []).forEach((f) => {
        const [k, v] = f.split('=');
        list = list.filter((c) => (k === 'status' ? c.status === v : k === 'name' ? c.name.includes(v) : k === 'ancestor' ? c.image === v || c.image.split(':')[0] === v : k === 'network' ? !!c.networks[v] : true));
      });
      list = list.slice().sort((x, y) => y.created - x.created);
      if (a.flags.l) list = list.slice(0, 1);
      if (a.flags.q) { list.forEach((c) => p(id12(c.id))); return true; }
      if (a.flags.format) {
        list.forEach((c) => p(goFormat(a.flags.format, { ID: id12(c.id), Image: c.image, Names: c.name, Status: fmtStatus(c), Ports: fmtPorts(c), Command: `"${cmdString(c)}"`, State: c.status, Networks: Object.keys(c.networks).join(',') })));
        return true;
      }
      const rows = [['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES']];
      list.forEach((c) => rows.push([id12(c.id), c.image, `"${trunc(cmdString(c), 20)}"`, SH.ago(now() - c.created), fmtStatus(c), fmtPorts(c), c.name]));
      SH.table(rows).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
      return true;
    }

    function imagesCmd(args) {
      const a = parse('images', args);
      if (!a) return false;
      let list = state.images.slice().sort((x, y) => y.created - x.created);
      if (a.args[0]) { const pr = REG.parseRef(a.args[0]); list = list.filter((i) => i.repo === pr.repo && (!pr.explicitTag || i.tag === pr.tag)); }
      (a.flags.filter || []).forEach((f) => { if (f === 'dangling=true') list = list.filter((i) => i.repo === '<none>'); });
      if (a.flags.q) { [...new Set(list.map((i) => id12(i.id)))].forEach((x) => p(x)); return true; }
      if (a.flags.format) { list.forEach((i) => p(goFormat(a.flags.format, { Repository: i.repo, Tag: i.tag, ID: id12(i.id), Size: SH.fmtSize(i.size), CreatedSince: SH.ago(now() - i.created) }))); return true; }
      const rows = [['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE']];
      list.forEach((i) => rows.push([i.repo, i.tag, id12(i.id), SH.ago(now() - i.created), SH.fmtSize(i.size)]));
      SH.table(rows).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
      return true;
    }

    function pullCmd(args) {
      const a = parse('pull', args);
      if (!a) return false;
      if (!needArgs('pull', a, 1, 'docker pull [OPTIONS] NAME[:TAG|@DIGEST]')) return false;
      cur.kind = 'pull'; cur.meta = { image: a.args[0] };
      return !!pull(a.args[0]);
    }

    function rmiCmd(args) {
      const a = parse('rmi', args);
      if (!a) return false;
      if (!needArgs('rmi', a, 1, 'docker rmi [OPTIONS] IMAGE [IMAGE...]')) return false;
      let ok = true;
      for (const ref of a.args) {
        const img = findImage(ref);
        if (!img) { err(`Error response from daemon: No such image: ${ref}`); ok = false; continue; }
        const user = state.containers.find((c) => c.imageId === img.id);
        if (user && !a.flags.f) {
          err(`Error response from daemon: conflict: unable to remove repository reference "${ref}" (must force) - container ${id12(user.id)} is using its referenced image ${id12(img.id)}`);
          hint(`Container "${user.name}" (kể cả khi đã dừng) vẫn dùng image này. Xóa container trước: docker rm ${user.name}`);
          ok = false; continue;
        }
        const byId = /^[0-9a-f]{4,64}$/.test(ref) && img.id.startsWith(ref);
        const refs = byId ? state.images.filter((i) => i.id === img.id) : [img];
        refs.forEach((r) => { if (r.repo !== '<none>') p(`Untagged: ${r.repo}:${r.tag}`); state.images.splice(state.images.indexOf(r), 1); });
        if (!state.images.some((i) => i.id === img.id)) {
          p(`Deleted: sha256:${img.id}`);
          const still = new Set(); state.images.forEach((i) => i.layers.forEach((l) => still.add(l.id)));
          img.layers.forEach((l) => { if (!still.has(l.id) && state.layers.delete(l.id)) p(`Deleted: sha256:${SH.hash64('layer:' + l.id)}`, 'dim'); });
        }
      }
      return ok;
    }

    function eachContainer(name, args, fn) {
      const a = parse(name, args);
      if (!a) return false;
      if (!needArgs(name, a, 1, `docker ${name} [OPTIONS] CONTAINER [CONTAINER...]`)) return false;
      let ok = true;
      a.args.forEach((n) => { const c = find(n); if (!c) { noSuch(n); ok = false; return; } if (fn(c, n, a) === false) ok = false; });
      return ok;
    }
    const startCmd = (args) => eachContainer('start', args, (c, n, a) => {
      cur.kind = 'start'; cur.meta = { name: c.name };
      if (c.status === 'running') { p(n); return true; }
      const st = start(c);
      if (!st.ok) { err(`Error response from daemon: ${st.error}`); err(`Error: failed to start containers: ${n}`); if (st.clash) hint(`Cổng ${st.port} đang bị "${st.clash.name}" chiếm. Dừng container đó trước.`); return false; }
      emit('event', { type: 'start', name: c.name });
      if ((a.flags.a || a.flags.i) && SHELLS.includes(progName(c.cmd[0])) && c.status === 'running') { session = { c, cwd: c.workdir, viaRun: true }; return true; }
      p(n);
      return true;
    });
    const stopCmd = (args) => eachContainer('stop', args, (c, n) => { cur.kind = 'stop'; cur.meta = { name: c.name }; stopC(c); p(n); emit('event', { type: 'stop', name: c.name }); });
    const killCmd = (args) => eachContainer('kill', args, (c, n) => {
      if (c.status !== 'running') { err(`Error response from daemon: cannot kill container: ${n}: container ${c.id} is not running`); return false; }
      stopC(c, 'KILL'); p(n); emit('event', { type: 'stop', name: c.name });
    });
    const restartCmd = (args) => eachContainer('restart', args, (c, n) => {
      stopC(c); const st = start(c);
      if (!st.ok) { err(`Error response from daemon: ${st.error}`); return false; }
      p(n); emit('event', { type: 'start', name: c.name });
    });
    const rmCmd = (args) => eachContainer('rm', args, (c, n, a) => {
      cur.kind = 'rm'; cur.meta = { name: c.name };
      if (c.status === 'running' && !a.flags.f) {
        err(`Error response from daemon: cannot remove container "/${c.name}": container is running: stop the container before removing or force remove`);
        hint(`Dừng trước rồi xóa: docker stop ${n} && docker rm ${n}, hoặc xóa cưỡng bức: docker rm -f ${n}`);
        return false;
      }
      removeContainer(c, { volumes: a.flags.v });
      p(n);
    });

    function logsCmd(args) {
      const a = parse('logs', args);
      if (!a) return false;
      if (a.args.length !== 1) { err(`"docker logs" requires exactly 1 argument.`); p("See 'docker logs --help'."); return false; }
      const c = find(a.args[0]);
      if (!c) { noSuch(a.args[0]); return false; }
      cur.kind = 'logs'; cur.meta = { name: c.name };
      let ls = c.logs;
      if (a.flags.tail !== undefined && a.flags.tail !== 'all') ls = ls.slice(-Math.max(0, parseInt(a.flags.tail, 10) || 0));
      ls.forEach((l) => p((a.flags.t ? iso(l.t) + ' ' : '') + l.text, l.stream === 'stderr' ? 'err' : ''));
      if (!c.logs.length) p('(container chưa ghi log nào)', 'dim');
      if (a.flags.f) hint('Trên máy thật, -f giữ terminal để theo dõi log mới cho đến khi bấm Ctrl+C. Mô phỏng chỉ in log hiện có.');
      return true;
    }

    function execCmd(args) {
      const a = parse('exec', args);
      if (!a) return false;
      if (a.args.length < 1 || !a.rest.length) { err(`"docker exec" requires at least 2 arguments.`); p("See 'docker exec --help'."); p(''); p('Usage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]'); return false; }
      return execIn(find(a.args[0]), a.args[0], a.rest, a.flags);
    }
    function execIn(c, n, rest, flags) {
      if (!c) { noSuch(n); return false; }
      cur.kind = 'exec'; cur.meta = { name: c.name, cmd: rest[0] };
      if (c.status !== 'running') { err(`Error response from daemon: container ${c.id} is not running`); hint(`"docker exec" chỉ dùng với container đang chạy. Khởi động trước: docker start ${c.name}`); return false; }
      const prog = progName(rest[0]);
      if (!which(c, prog)) {
        err(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${rest[0]}": executable file not found in $PATH: unknown`);
        if (prog === 'bash' && c.cfg.shell === 'sh') hint('Image dựa trên Alpine/BusyBox không có bash. Dùng: docker exec -it ' + c.name + ' sh');
        else hint(`Image này không có chương trình "${rest[0]}".`);
        return false;
      }
      if (SHELLS.includes(prog) && !rest.includes('-c')) {
        if (flags.i && flags.t) { session = { c, cwd: flags.w || c.workdir, viaRun: false }; cur.meta.ok = true; return true; }
        hint(`Thiếu -it nên shell không có bàn phím gắn vào và thoát ngay. Dùng: docker exec -it ${c.name} ${prog}`);
        return true;
      }
      const r = containerCmd(c, rest, { cwd: flags.w || c.workdir });
      r.lines.forEach((l) => p(l.text, l.cls));
      Object.assign(cur.meta, r.meta, { ok: r.code === 0 });
      return r.code === 0;
    }

    function containerJSON(c) {
      const pb = {};
      c.ports.forEach((q) => { pb[`${q.container}/${q.proto}`] = [{ HostIp: q.ip, HostPort: String(q.host) }]; });
      const nets = {};
      Object.entries(c.networks).forEach(([k, v]) => { nets[k] = { Aliases: v.aliases.slice(1), IPAddress: c.status === 'running' ? v.ip : '', Gateway: c.status === 'running' && v.ip ? v.ip.replace(/\.\d+$/, '.1') : '' }; });
      return {
        Id: c.id, Created: iso(c.created), Path: [...c.entrypoint, ...c.cmd][0] || '', Args: [...c.entrypoint, ...c.cmd].slice(1),
        State: { Status: c.status, Running: c.status === 'running', ExitCode: c.exitCode, StartedAt: c.startedAt ? iso(c.startedAt) : '0001-01-01T00:00:00Z', FinishedAt: c.finishedAt ? iso(c.finishedAt) : '0001-01-01T00:00:00Z' },
        Image: 'sha256:' + c.imageId, Name: '/' + c.name, RestartCount: 0,
        HostConfig: { PortBindings: pb, Binds: c.mounts.filter((m) => m.type === 'bind').map((m) => `${m.source}:${m.target}`), RestartPolicy: { Name: c.restart } },
        Mounts: c.mounts.map((m) => ({ Type: m.type, Name: m.type === 'volume' ? m.source : undefined, Source: m.type === 'volume' ? `/var/lib/docker/volumes/${m.source}/_data` : m.source, Destination: m.target, RW: !m.ro })),
        Config: { Hostname: c.hostname, Env: Object.entries(c.env).map(([k, v]) => `${k}=${v}`), Cmd: c.cmd, Entrypoint: c.entrypoint.length ? c.entrypoint : null, Image: c.image, WorkingDir: c.workdir, ExposedPorts: Object.fromEntries((c.cfg.expose || []).map((e) => [`${e}/tcp`, {}])), Labels: c.labels },
        NetworkSettings: { Ports: pb, Networks: nets },
      };
    }
    function imageJSON(i) {
      return { Id: 'sha256:' + i.id, RepoTags: state.images.filter((x) => x.id === i.id && x.repo !== '<none>').map((x) => `${x.repo}:${x.tag}`), Created: iso(i.created), Size: Math.round(i.size), Config: { Cmd: i.config.cmd || null, Entrypoint: i.config.entrypoint && i.config.entrypoint.length ? i.config.entrypoint : null, Env: Object.entries(i.config.env || {}).map(([k, v]) => `${k}=${v}`), ExposedPorts: Object.fromEntries((i.config.expose || []).map((e) => [`${e}/tcp`, {}])), WorkingDir: i.config.workdir === '/' ? '' : i.config.workdir, User: i.config.user || '' }, RootFS: { Type: 'layers', Layers: i.layers.map((l) => 'sha256:' + SH.hash64('layer:' + l.id)) } };
    }
    function volumeJSON(v) { return { CreatedAt: iso(v.created), Driver: 'local', Labels: v.labels, Mountpoint: `/var/lib/docker/volumes/${v.name}/_data`, Name: v.name, Options: null, Scope: 'local' }; }
    function networkJSON(n) {
      const cs = {};
      state.containers.filter((c) => c.status === 'running' && c.networks[n.name]).forEach((c) => { cs[c.id] = { Name: c.name, IPv4Address: c.networks[n.name].ip ? c.networks[n.name].ip + '/16' : '' }; });
      return { Name: n.name, Id: n.id, Created: iso(n.created), Scope: 'local', Driver: n.driver, IPAM: { Config: n.subnet ? [{ Subnet: n.subnet, Gateway: n.prefix + '.1' }] : [] }, Containers: cs, Labels: n.labels };
    }
    function inspectCmd(args) {
      const a = parse('inspect', args);
      if (!a) return false;
      if (!needArgs('inspect', a, 1, 'docker inspect [OPTIONS] NAME|ID [NAME|ID...]')) return false;
      const objs = [];
      let ok = true;
      a.args.forEach((n) => {
        const t = a.flags.type;
        const c = (!t || t === 'container') && find(n);
        const i = !c && (!t || t === 'image') && findImage(n);
        const v = !c && !i && (!t || t === 'volume') && getVolume(n);
        const net = !c && !i && !v && (!t || t === 'network') && findNet(n);
        const o = c ? containerJSON(c) : i ? imageJSON(i) : v ? volumeJSON(v) : net ? networkJSON(net) : null;
        if (!o) { err(`Error: No such object: ${n}`); ok = false; return; }
        objs.push(o);
      });
      cur.kind = 'inspect'; cur.meta = { names: a.args };
      if (a.flags.f) objs.forEach((o) => p(goFormat(a.flags.f, o)));
      else if (objs.length) p(JSON.stringify(objs, null, 4));
      return ok;
    }

    function historyCmd(args) {
      const a = parse('history', args);
      if (!a) return false;
      if (!needArgs('history', a, 1, 'docker history [OPTIONS] IMAGE')) return false;
      const img = findImage(a.args[0]);
      if (!img) { err(`Error response from daemon: No such image: ${a.args[0]}`); return false; }
      cur.kind = 'history'; cur.meta = { image: a.args[0] };
      const rows = [['IMAGE', 'CREATED', 'CREATED BY', 'SIZE', 'COMMENT']];
      img.layers.slice().reverse().forEach((l, i) => rows.push([i === 0 ? id12(img.id) : '<missing>', SH.ago(now() - (l.created || img.created)), a.flags['no-trunc'] ? l.cmd : trunc(l.cmd, 45), SH.fmtSize(l.size), l.built ? 'buildkit.dockerfile.v0' : '']));
      SH.table(rows).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
      return true;
    }

    function tagCmd(args) {
      if (args.length !== 2) { err('"docker tag" requires exactly 2 arguments.'); p(''); p('Usage:  docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]'); return false; }
      const img = findImage(args[0]);
      if (!img) { err(`Error response from daemon: No such image: ${args[0]}`); return false; }
      const pr = REG.parseRef(args[1]);
      addImageRef(Object.assign({}, img, { repo: pr.repo, tag: pr.tag }));
      return true;
    }

    function portCmd(args) {
      const c = find(args[0]);
      if (!c) { noSuch(args[0] || ''); return false; }
      if (c.status === 'running') c.ports.forEach((q) => p(`${q.container}/${q.proto} -> ${q.ip}:${q.host}`));
      return true;
    }

    function statsCmd(args) {
      const a = parse('stats', args);
      if (!a) return false;
      const MEM = { nginx: 7.3, redis: 4.1, postgres: 38.5, app: 31.2, counter: 33.6, python: 9.8, node: 12.4, shell: 0.6 };
      const list = state.containers.filter((c) => (a.args.length ? a.args.includes(c.name) : a.flags.a || c.status === 'running'));
      const rows = [['CONTAINER ID', 'NAME', 'CPU %', 'MEM USAGE / LIMIT', 'MEM %', 'NET I/O', 'BLOCK I/O', 'PIDS']];
      list.forEach((c) => {
        const run = c.status === 'running';
        const h = parseInt(SH.hash(c.id), 16);
        const mem = run ? (MEM[c.cfg.kind] || 2) * (1 + (h % 20) / 100) : 0;
        rows.push([id12(c.id), c.name, run ? ((h % 90) / 100).toFixed(2) + '%' : '0.00%', `${mem.toFixed(2)}MiB / 7.66GiB`, ((mem / 7843) * 100).toFixed(2) + '%', run ? `${(1 + (h % 50) / 10).toFixed(1)}kB / 0B` : '0B / 0B', '0B / 0B', run ? String(c.cfg.kind === 'nginx' ? 9 : c.cfg.kind === 'postgres' ? 6 : 1) : '0']);
      });
      SH.table(rows).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
      if (!a.flags['no-stream']) hint('Trên máy thật bảng này cập nhật liên tục (bấm Ctrl+C để thoát). Dùng --no-stream để chỉ in một lần.');
      return true;
    }

    function renameCmd(args) {
      if (args.length !== 2) { err('"docker rename" requires exactly 2 arguments.'); return false; }
      const c = find(args[0]);
      if (!c) { noSuch(args[0]); return false; }
      if (find(args[1])) { err(`Error response from daemon: Conflict. The container name "/${args[1]}" is already in use.`); return false; }
      Object.values(c.networks).forEach((n) => { n.aliases = n.aliases.map((x) => (x === c.name ? args[1] : x)); });
      c.name = args[1];
      return true;
    }

    function versionCmd() {
      ['Client: Docker Engine - Community', ' Version:           27.3.1', ' API version:       1.47', ' Go version:        go1.22.7', ' OS/Arch:           linux/amd64', '', 'Server: Docker Engine - Community', ' Engine:', '  Version:          27.3.1', '  API version:      1.47 (minimum version 1.24)', '  OS/Arch:          linux/amd64', ' containerd:', '  Version:          1.7.22', ' runc:', '  Version:          1.1.14'].forEach((l) => p(l));
      p('(Đây là môi trường mô phỏng trong trình duyệt)', 'dim');
      return true;
    }
    function infoCmd() {
      const run = state.containers.filter((c) => c.status === 'running').length;
      p(`Containers: ${state.containers.length}`); p(` Running: ${run}`); p(' Paused: 0'); p(` Stopped: ${state.containers.length - run}`);
      p(`Images: ${new Set(state.images.map((i) => i.id)).size}`); p('Server Version: 27.3.1'); p('Storage Driver: overlay2'); p('Cgroup Driver: cgroupfs'); p('Kernel Version: 6.10.14-linuxkit'); p('Operating System: Docker Desktop'); p('CPUs: 8'); p('Total Memory: 7.66GiB');
      return true;
    }

    // ---------- volume ----------
    function volumeCmd(args) {
      const sub = args[0], rest = args.slice(1);
      if (!sub || sub === '--help') { cmdHelp('volume'); return true; }
      if (sub === 'create') {
        const a = parse('volume create', rest); if (!a) return false;
        const name = a.args[0] || SH.hash64('vol:' + newId());
        if (a.args[0] && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(name)) { err(`Error response from daemon: create ${name}: "${name}" includes invalid characters for a local volume name, only "[a-zA-Z0-9][a-zA-Z0-9_.-]" are allowed`); return false; }
        ensureVolume(name, !a.args[0]);
        cur.kind = 'volume'; cur.meta = { action: 'create', name };
        p(name); emit('event', { type: 'volume', name });
        return true;
      }
      if (sub === 'ls' || sub === 'list') {
        const a = parse('volume ls', rest); if (!a) return false;
        if (a.flags.q) { state.volumes.forEach((v) => p(v.name)); return true; }
        SH.table([['DRIVER', 'VOLUME NAME'], ...state.volumes.map((v) => ['local', v.name])]).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
        return true;
      }
      if (sub === 'rm' || sub === 'remove') {
        const a = parse('volume rm', rest); if (!a) return false;
        if (!a.args.length) { err('"docker volume rm" requires at least 1 argument.'); return false; }
        let ok = true;
        a.args.forEach((n) => {
          const v = getVolume(n);
          if (!v) { err(`Error response from daemon: get ${n}: no such volume`); ok = false; return; }
          const users = volumeUsers(n);
          if (users.length) { err(`Error response from daemon: remove ${n}: volume is in use - [${users.map((c) => c.id).join(', ')}]`); hint(`Volume đang được container ${users.map((c) => `"${c.name}"`).join(', ')} dùng (kể cả khi đã dừng). Xóa container trước.`); ok = false; return; }
          state.volumes.splice(state.volumes.indexOf(v), 1); p(n);
        });
        return ok;
      }
      if (sub === 'inspect') {
        if (!rest.length) { err('"docker volume inspect" requires at least 1 argument.'); return false; }
        const vs = rest.map(getVolume);
        if (vs.some((v) => !v)) { err(`Error response from daemon: get ${rest[vs.findIndex((v) => !v)]}: no such volume`); return false; }
        p(JSON.stringify(vs.map(volumeJSON), null, 4));
        return true;
      }
      if (sub === 'prune') {
        const a = parse('volume prune', rest); if (!a) return false;
        if (!a.flags.f) { p('WARNING! This will remove anonymous local volumes not used by at least one container.'); p('Are you sure you want to continue? [y/N]'); hint('Mô phỏng không nhận câu trả lời y/N. Thêm -f để xác nhận: docker volume prune -f'); return true; }
        const del = state.volumes.filter((v) => !volumeUsers(v.name).length && (a.flags.a || v.anonymous));
        if (del.length) { p('Deleted Volumes:'); del.forEach((v) => { p(v.name); state.volumes.splice(state.volumes.indexOf(v), 1); }); p(''); }
        p('Total reclaimed space: 0B');
        return true;
      }
      err(`docker: unknown command: docker volume ${sub}`); p(''); p("Run 'docker volume --help' for more information");
      return false;
    }

    // ---------- network ----------
    function networkCmd(args) {
      const sub = args[0], rest = args.slice(1);
      if (!sub || sub === '--help') { cmdHelp('network'); return true; }
      if (sub === 'create') {
        const a = parse('network create', rest); if (!a) return false;
        if (a.args.length !== 1) { err('"docker network create" requires exactly 1 argument.'); p(''); p('Usage:  docker network create [OPTIONS] NETWORK'); return false; }
        const name = a.args[0], driver = a.flags.d || 'bridge';
        if (findNet(name) && findNet(name).name === name) { err(`Error response from daemon: network with name ${name} already exists`); return false; }
        if (driver === 'host' || driver === 'null' || driver === 'none') { err(`Error response from daemon: only one instance of "${driver}" network is allowed`); return false; }
        const n = addNet(name, driver, a.flags.subnet || `172.${netSeq++}.0.0/16`, false);
        cur.kind = 'network'; cur.meta = { action: 'create', name };
        p(n.id); emit('event', { type: 'network', name });
        return true;
      }
      if (sub === 'ls' || sub === 'list') {
        const a = parse('network ls', rest); if (!a) return false;
        if (a.flags.q) { state.networks.forEach((n) => p(id12(n.id))); return true; }
        SH.table([['NETWORK ID', 'NAME', 'DRIVER', 'SCOPE'], ...state.networks.map((n) => [id12(n.id), n.name, n.driver, 'local'])]).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
        return true;
      }
      if (sub === 'rm' || sub === 'remove') {
        if (!rest.length) { err('"docker network rm" requires at least 1 argument.'); return false; }
        let ok = true;
        rest.filter((x) => !x.startsWith('-')).forEach((nm) => {
          const n = findNet(nm);
          if (!n) { err(`Error response from daemon: network ${nm} not found`); ok = false; return; }
          if (n.builtin) { err(`Error response from daemon: ${n.name} is a pre-defined network and cannot be removed`); ok = false; return; }
          const active = state.containers.filter((c) => c.status === 'running' && c.networks[n.name]);
          if (active.length) { err(`Error response from daemon: error while removing network: network ${n.name} id ${n.id} has active endpoints`); hint(`Các container đang dùng network: ${active.map((c) => c.name).join(', ')}. Dừng hoặc ngắt kết nối chúng trước.`); ok = false; return; }
          state.containers.forEach((c) => delete c.networks[n.name]);
          state.networks.splice(state.networks.indexOf(n), 1); p(nm);
        });
        return ok;
      }
      if (sub === 'inspect') {
        const n = findNet(rest[0] || '');
        if (!n) { err(`Error response from daemon: network ${rest[0] || ''} not found`); return false; }
        p(JSON.stringify([networkJSON(n)], null, 4));
        return true;
      }
      if (sub === 'connect' || sub === 'disconnect') {
        const a = parse('network connect', rest); if (!a) return false;
        if (a.args.length !== 2) { err(`"docker network ${sub}" requires exactly 2 arguments.`); p(''); p(`Usage:  docker network ${sub} [OPTIONS] NETWORK CONTAINER`); return false; }
        const n = findNet(a.args[0]), c = find(a.args[1]);
        if (!n) { err(`Error response from daemon: network ${a.args[0]} not found`); return false; }
        if (!c) { noSuch(a.args[1]); return false; }
        if (sub === 'connect') {
          if (c.networks[n.name]) { err(`Error response from daemon: endpoint with name ${c.name} already exists in network ${n.name}`); return false; }
          connect(c, n, a.flags.alias || []);
        } else {
          if (!c.networks[n.name]) { err(`Error response from daemon: container ${c.id} is not connected to network ${n.name}`); return false; }
          delete c.networks[n.name];
        }
        cur.kind = 'network'; cur.meta = { action: sub, name: n.name, container: c.name };
        emit('event', { type: 'network', name: n.name });
        return true;
      }
      if (sub === 'prune') {
        const a = parse('network prune', rest); if (!a) return false;
        if (!a.flags.f) { p('WARNING! This will remove all custom networks not used by at least one container.'); p('Are you sure you want to continue? [y/N]'); hint('Thêm -f để xác nhận: docker network prune -f'); return true; }
        const del = state.networks.filter((n) => !n.builtin && !state.containers.some((c) => c.networks[n.name]));
        if (del.length) { p('Deleted Networks:'); del.forEach((n) => { p(n.name); state.networks.splice(state.networks.indexOf(n), 1); }); }
        return true;
      }
      err(`docker: unknown command: docker network ${sub}`); p(''); p("Run 'docker network --help' for more information");
      return false;
    }

    // ---------- build ----------
    function buildCmd(args) {
      const a = parse('build', args);
      if (!a) return false;
      if (a.args.length !== 1) { err('ERROR: "docker buildx build" requires exactly 1 argument.'); p("See 'docker buildx build --help'."); p(''); p('Usage:  docker buildx build [OPTIONS] PATH | URL | -'); hint('Đừng quên dấu chấm ở cuối: docker build -t myapp:v1 .   (dấu "." là thư mục ngữ cảnh build)'); return false; }
      const B = getBuild();
      const tags = (a.flags.t || []).map((t) => REG.parseRef(t));
      cur.kind = 'build'; cur.meta = { tags: tags.map((t) => t.ref) };
      const res = B.run({
        files, now, context: a.args[0], dockerfile: a.flags.f || 'Dockerfile', cache: state.buildCache, noCache: !!a.flags['no-cache'], target: a.flags.target,
        buildArgs: parseEnv(a.flags['build-arg']),
        resolveBase: (ref) => {
          const local = findImage(ref);
          if (local) return local;
          const r = REG.resolve(ref);
          if (r.error) return null;
          r.def.layers.forEach((l) => state.layers.add(l.id));
          return addImageRef(imageFromDef(r.def, r.repo, r.tag));
        },
      });
      res.lines.forEach((l) => p(l.text, l.cls));
      const rec = { tags: tags.map((t) => t.ref), tag: tags[0] ? tags[0].ref : null, ok: res.ok, steps: res.steps || [], size: res.image ? res.image.size : 0, t: now(), errorLine: res.errorLine, file: a.flags.f || 'Dockerfile' };
      builds.push(rec);
      Object.assign(cur.meta, { ok: res.ok, steps: rec.steps, size: rec.size });
      if (!res.ok) { if (res.errorLine) emit('event', { type: 'fileError', file: rec.file, line: res.errorLine }); return false; }
      const id = fullId(SH.hash('img:' + res.image.key).padEnd(12, '0').slice(0, 12));
      const base = { id, size: res.image.size, layers: res.image.layers, created: now(), config: res.image.config };
      if (!tags.length) state.images.push(Object.assign({ repo: '<none>', tag: '<none>' }, base));
      tags.forEach((t) => addImageRef(Object.assign({ repo: t.repo, tag: t.tag }, base, { layers: res.image.layers.slice() })));
      tags.forEach((t) => p(` => => naming to docker.io/${repoPath(t.repo)}:${t.tag}`, 'dim'));
      p(` => => writing image sha256:${id}`, 'dim');
      if (!tags.length) hint('Image chưa có tên (hiện là <none>). Lần sau thêm -t ten:tag để dễ dùng.');
      emit('event', { type: 'build', tag: rec.tag, steps: rec.steps });
      return true;
    }

    // ---------- compose ----------
    const COMPOSE_FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml'];
    function loadCompose(fileFlag) {
      const name = fileFlag || COMPOSE_FILES.find((f) => typeof files[f] === 'string');
      if (!name || typeof files[name] !== 'string') { err(`no configuration file provided: not found`); hint('Cần có file docker-compose.yml trong thư mục dự án.'); return null; }
      let doc;
      try { doc = YAML.parse(files[name]); } catch (e) {
        err(`parsing /home/user/lab/${name}: ${e.message}`);
        if (e.line) { hint(`Lỗi cú pháp YAML ở dòng ${e.line}. YAML dùng dấu cách (không dùng Tab) và các mục cùng cấp phải thụt lề bằng nhau.`); emit('event', { type: 'fileError', file: name, line: e.line }); }
        return null;
      }
      if (!doc || typeof doc !== 'object' || !doc.services || typeof doc.services !== 'object' || Array.isArray(doc.services)) { err(`/home/user/lab/${name}: services must be a mapping`); return null; }
      if ('version' in doc) p(`WARN[0000] /home/user/lab/${name}: the attribute \`version\` is obsolete, it will be ignored, please remove it to avoid potential confusion`, 'hint');
      const svcs = {};
      for (const [sn, s0] of Object.entries(doc.services)) {
        const s = s0 || {};
        if (!s.image && !s.build) { err(`service "${sn}" has neither an image nor a build context specified: invalid compose project`); return null; }
        const env = Array.isArray(s.environment) ? parseEnv(s.environment.map(String)) : Object.fromEntries(Object.entries(s.environment || {}).map(([k, v]) => [k, v == null ? '' : String(v)]));
        const ports = [];
        for (const pp of s.ports || []) { const pt = parsePort(String(pp)); if (!pt) { err(`service "${sn}": invalid port specification: "${pp}"`); return null; } ports.push(pt); }
        const mounts = [];
        for (const vv of s.volumes || []) {
          const m = parseVolumeSpec(String(vv));
          if (m.error) { err(`service "${sn}": ${m.error}`); return null; }
          if (m.type === 'volume' && !m.anonymous) {
            if (!doc.volumes || !(m.source in doc.volumes)) { err(`service "${sn}" refers to undefined volume ${m.source}: invalid compose project`); hint(`Khai báo volume ở cuối file:\nvolumes:\n  ${m.source}:`); return null; }
            m.source = `${project}_${m.source}`;
            m.labels = { 'com.docker.compose.project': project };
          }
          mounts.push(m);
        }
        const dep = Array.isArray(s.depends_on) ? s.depends_on : Object.keys(s.depends_on || {});
        const nets = Array.isArray(s.networks) ? s.networks : Object.keys(s.networks || {});
        const cmd = s.command == null ? [] : Array.isArray(s.command) ? s.command.map(String) : SH.tokenize(String(s.command));
        svcs[sn] = { name: sn, image: s.image ? String(s.image) : `${project}-${sn}`, build: s.build, env, ports, mounts, depends: dep, nets: nets.length ? nets : ['default'], cmd, restart: s.restart };
      }
      for (const s of Object.values(svcs)) for (const d of s.depends) if (!svcs[d]) { err(`service "${s.name}" depends on undefined service "${d}": invalid compose project`); return null; }
      // Thứ tự khởi động theo depends_on
      const order = [], seen = {};
      const visit = (n, stack) => {
        if (seen[n] === 2) return true;
        if (seen[n] === 1) { err(`dependency cycle detected: ${[...stack, n].join(' -> ')}`); return false; }
        seen[n] = 1;
        for (const d of svcs[n].depends) if (!visit(d, [...stack, n])) return false;
        seen[n] = 2; order.push(n);
        return true;
      };
      for (const n of Object.keys(svcs)) if (!visit(n, [])) return null;
      const netNames = new Set(['default']);
      Object.values(svcs).forEach((s) => s.nets.forEach((n) => netNames.add(n)));
      return { file: name, doc, svcs, order, volumes: Object.keys(doc.volumes || {}), nets: [...netNames].filter((n) => n !== 'default' || Object.values(svcs).some((s) => s.nets.includes('default'))) };
    }
    const projContainers = () => state.containers.filter((c) => c.labels['com.docker.compose.project'] === project);

    function composeCmd(args) {
      const g = SH.parseArgs(args, Object.assign({}, SPECS.compose, { stopAfter: 1 }));
      if (g.error) { err(g.error); return false; }
      const sub = g.args[0], rest = g.rest;
      if (!sub || sub === '--help') { cmdHelp('compose'); return true; }
      cur.kind = 'compose'; cur.meta = { action: sub };
      const lines = [];
      const step = (txt, ok = true) => lines.push({ text: ` ${ok ? '✔' : '✘'} ${txt}`, cls: ok ? 'ok' : 'err' });
      const flush = (verb) => { const n = lines.length; if (!n) return; p(`[+] ${verb} ${lines.filter((l) => l.cls === 'ok').length}/${n}`); lines.forEach((l) => p(l.text, l.cls)); lines.length = 0; };
      const cname = (s) => `${project}-${s}-1`;
      const W = 28;

      if (sub === 'up') {
        const a = parse('compose up', rest); if (!a) return false;
        const cf = loadCompose(g.flags.f); if (!cf) return false;
        const pulls = [];
        for (const sn of cf.order) {
          const s = cf.svcs[sn];
          if (s.build && (!findImage(s.image) || a.flags.build)) {
            const B = getBuild();
            const ctx = typeof s.build === 'string' ? s.build : (s.build.context || '.');
            const df = typeof s.build === 'object' && s.build.dockerfile ? s.build.dockerfile : 'Dockerfile';
            p(`[+] Building ${sn}`);
            const res = B.run({ files, now, context: ctx, dockerfile: df, cache: state.buildCache, resolveBase: (ref) => findImage(ref) || (() => { const r = REG.resolve(ref); if (r.error) return null; r.def.layers.forEach((l) => state.layers.add(l.id)); return addImageRef(imageFromDef(r.def, r.repo, r.tag)); })() });
            res.lines.forEach((l) => p(l.text, l.cls));
            if (!res.ok) { err(`failed to solve: service "${sn}" build failed`); return false; }
            const pr = REG.parseRef(s.image);
            addImageRef({ id: fullId(SH.hash('img:' + res.image.key).slice(0, 12)), repo: pr.repo, tag: pr.tag, size: res.image.size, layers: res.image.layers, created: now(), config: res.image.config });
            builds.push({ tag: pr.ref, tags: [pr.ref], ok: true, steps: res.steps, size: res.image.size, t: now() });
          } else if (!findImage(s.image)) {
            const r = REG.resolve(s.image);
            if (r.error) { p(`[+] Pulling 0/1`); p(` ✘ ${sn} Error pull access denied for ${r.repo}, repository does not exist or may require 'docker login'`, 'err'); hint(`Image "${s.image}" của service "${sn}" không có trên registry.`); return false; }
            r.def.layers.forEach((l) => state.layers.add(l.id));
            addImageRef(imageFromDef(r.def, r.repo, r.tag));
            pulls.push(sn);
          }
        }
        if (pulls.length) { p(`[+] Pulling ${pulls.length}/${pulls.length}`); pulls.forEach((sn) => p(` ✔ ${sn} Pulled`, 'ok')); }
        for (const n of cf.nets) {
          const full = `${project}_${n}`;
          if (!findNet(full)) { const net = addNet(full, 'bridge', `172.${netSeq++}.0.0/16`, false); net.labels = { 'com.docker.compose.project': project }; step(`Network ${full}`.padEnd(W) + ' Created'); }
        }
        for (const v of cf.volumes) { const full = `${project}_${v}`; if (!getVolume(full)) { ensureVolume(full, false, { 'com.docker.compose.project': project }); step(`Volume "${full}"`.padEnd(W) + ' Created'); } }
        let ok = true;
        for (const sn of cf.order) {
          const s = cf.svcs[sn];
          const image = findImage(s.image);
          const sig = JSON.stringify([image.id, s.env, s.ports, s.mounts.map((m) => [m.source, m.target]), s.cmd, s.nets]);
          let c = find(cname(sn));
          let verb = 'Started';
          if (c && c.labels['com.docker.compose.config'] !== sig) { stopC(c); removeContainer(c, {}); c = null; verb = 'Recreated'; }
          if (c && c.status === 'running') { step(`Container ${cname(sn)}`.padEnd(W) + ' Running'); continue; }
          if (!c) {
            c = createContainer(image, { name: cname(sn), imageRef: s.image, ports: s.ports.map((q) => Object.assign({}, q)), mounts: s.mounts.map((m) => Object.assign({}, m)), network: `${project}_${s.nets[0]}`, env: s.env, cmd: s.cmd, restart: s.restart, aliases: [sn], labels: { 'com.docker.compose.project': project, 'com.docker.compose.service': sn, 'com.docker.compose.config': sig } });
            s.nets.slice(1).forEach((n) => connect(c, findNet(`${project}_${n}`), [sn]));
          }
          const st = start(c);
          if (!st.ok) { step(`Container ${cname(sn)}`.padEnd(W) + ' Error', false); flush('Running'); err(`Error response from daemon: ${st.error}`); if (st.clash) hint(`Cổng ${st.port} đang bị container "${st.clash.name}" chiếm. Dừng nó (docker stop ${st.clash.name}) rồi chạy lại.`); ok = false; break; }
          step(`Container ${cname(sn)}`.padEnd(W) + ' ' + verb);
          emit('event', { type: 'run', name: c.name });
        }
        if (ok) flush('Running');
        cur.meta.services = cf.order; cur.meta.ok = ok;
        if (ok && !a.flags.d) {
          p('Attaching to ' + cf.order.map(cname).join(', '), 'dim');
          cf.order.forEach((sn) => { const c = find(cname(sn)); if (c) c.logs.slice(-3).forEach((l) => p(`${(sn + '-1').padEnd(10)} | ${l.text}`, 'dim')); });
          hint('Không có -d nên trên máy thật terminal sẽ hiển thị log liên tục cho đến khi bấm Ctrl+C (và Ctrl+C sẽ dừng các container). Mô phỏng đã chuyển sang chạy nền; lần sau dùng: docker compose up -d');
        }
        return ok;
      }
      if (sub === 'down') {
        const a = parse('compose down', rest); if (!a) return false;
        const cs = projContainers();
        cs.forEach((c) => { stopC(c); removeContainer(c, { volumes: true }); step(`Container ${c.name}`.padEnd(W) + ' Removed'); });
        if (a.flags.v) state.volumes.filter((v) => v.labels['com.docker.compose.project'] === project).forEach((v) => { state.volumes.splice(state.volumes.indexOf(v), 1); step(`Volume ${v.name}`.padEnd(W) + ' Removed'); });
        state.networks.filter((n) => n.labels['com.docker.compose.project'] === project).forEach((n) => { state.networks.splice(state.networks.indexOf(n), 1); step(`Network ${n.name}`.padEnd(W) + ' Removed'); });
        flush('Running');
        if (!cs.length && !lines.length) p('(không có gì để dọn: dự án chưa chạy)', 'dim');
        cur.meta.volumes = !!a.flags.v;
        emit('event', { type: 'rm', name: project });
        return true;
      }
      if (sub === 'ps') {
        const a = parse('compose ps', rest); if (!a) return false;
        const cs = projContainers().filter((c) => a.flags.a || c.status === 'running');
        if (a.flags.q) { cs.forEach((c) => p(id12(c.id))); return true; }
        const rows = [['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS']];
        cs.forEach((c) => rows.push([c.name, c.image, `"${trunc(cmdString(c), 20)}"`, c.labels['com.docker.compose.service'], SH.ago(now() - c.created), fmtStatus(c), fmtPorts(c)]));
        SH.table(rows).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
        return true;
      }
      if (sub === 'logs') {
        const a = parse('compose logs', rest); if (!a) return false;
        const cs = projContainers().filter((c) => !a.args.length || a.args.includes(c.labels['com.docker.compose.service']));
        cs.forEach((c) => c.logs.forEach((l) => p(`${(c.labels['com.docker.compose.service'] + '-1').padEnd(10)} | ${l.text}`, l.stream === 'stderr' ? 'err' : '')));
        cur.kind = 'logs'; cur.meta = { compose: true, services: cs.map((c) => c.labels['com.docker.compose.service']) };
        return true;
      }
      if (['stop', 'start', 'restart'].includes(sub)) {
        const cs = projContainers().filter((c) => !rest.length || rest.includes(c.labels['com.docker.compose.service']));
        cs.forEach((c) => {
          if (sub !== 'start') stopC(c);
          if (sub !== 'stop') { const st = start(c); if (!st.ok) { step(`Container ${c.name}`.padEnd(W) + ' Error', false); return; } }
          step(`Container ${c.name}`.padEnd(W) + ' ' + (sub === 'stop' ? 'Stopped' : 'Started'));
        });
        flush('Running');
        return true;
      }
      if (sub === 'exec') {
        const a = parse('compose exec', rest); if (!a) return false;
        if (!a.args.length || !a.rest.length) { err('"docker compose exec" requires at least 2 arguments.'); return false; }
        const c = find(cname(a.args[0]));
        if (!c) { err(`service "${a.args[0]}" is not running`); return false; }
        return execIn(c, a.args[0], a.rest, { i: true, t: !a.flags.T, w: a.flags.w });
      }
      if (sub === 'config') { const cf = loadCompose(g.flags.f); if (!cf) return false; p(files[cf.file].replace(/\n$/, '')); return true; }
      if (sub === 'build') {
        const cf = loadCompose(g.flags.f); if (!cf) return false;
        const toBuild = cf.order.filter((sn) => cf.svcs[sn].build);
        if (!toBuild.length) { p('(không có service nào khai báo build)', 'dim'); return true; }
        return composeCmd([...(g.flags.f ? ['-f', g.flags.f] : []), 'up', '--build', '-d']);
      }
      err(`unknown docker command: "compose ${sub}"`);
      return false;
    }

    // ---------- system / prune ----------
    function pruneContainers(force) {
      if (!force) { p('WARNING! This will remove all stopped containers.'); p('Are you sure you want to continue? [y/N]'); hint('Thêm -f để xác nhận.'); return true; }
      const del = state.containers.filter((c) => c.status !== 'running');
      if (del.length) { p('Deleted Containers:'); del.forEach((c) => { p(c.id); removeContainer(c, {}); }); p(''); }
      p('Total reclaimed space: 0B');
      return true;
    }
    function pruneImages(all, force) {
      if (!force) { p(all ? 'WARNING! This will remove all images without at least one container associated to them.' : 'WARNING! This will remove all dangling images.'); p('Are you sure you want to continue? [y/N]'); hint('Thêm -f để xác nhận.'); return true; }
      const used = new Set(state.containers.map((c) => c.imageId));
      const del = state.images.filter((i) => !used.has(i.id) && (all || i.repo === '<none>'));
      let total = 0;
      if (del.length) { p('Deleted Images:'); del.forEach((i) => { if (i.repo !== '<none>') p(`untagged: ${i.repo}:${i.tag}`); p(`deleted: sha256:${i.id}`); total += i.size; state.images.splice(state.images.indexOf(i), 1); }); p(''); }
      p(`Total reclaimed space: ${SH.fmtSize(total)}`);
      return true;
    }
    function systemCmd(args) {
      const sub = args[0], rest = args.slice(1);
      if (sub === 'df') {
        const used = new Set(state.containers.map((c) => c.imageId));
        const imgs = [...new Map(state.images.map((i) => [i.id, i])).values()];
        const isz = imgs.reduce((s, i) => s + i.size, 0), rec = imgs.filter((i) => !used.has(i.id)).reduce((s, i) => s + i.size, 0);
        const cache = Object.values(state.buildCache).reduce((s, x) => s + (x.size || 0), 0);
        SH.table([['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'], ['Images', imgs.length, used.size, SH.fmtSize(isz), `${SH.fmtSize(rec)} (${isz ? Math.round((rec / isz) * 100) : 0}%)`], ['Containers', state.containers.length, state.containers.filter((c) => c.status === 'running').length, '0B', '0B'], ['Local Volumes', state.volumes.length, state.volumes.filter((v) => volumeUsers(v.name).length).length, '0B', '0B'], ['Build Cache', Object.keys(state.buildCache).length, 0, SH.fmtSize(cache), SH.fmtSize(cache)]]).forEach((l, i) => p(l, i === 0 ? 'head' : ''));
        return true;
      }
      if (sub === 'prune') {
        const a = parse('system prune', rest); if (!a) return false;
        if (!a.flags.f) { p('WARNING! This will remove:'); p('  - all stopped containers'); p('  - all networks not used by at least one container'); p(a.flags.a ? '  - all images without at least one container associated to them' : '  - all dangling images'); p('  - unused build cache'); p(''); p('Are you sure you want to continue? [y/N]'); hint('Thêm -f để xác nhận: docker system prune -f'); return true; }
        pruneContainers(true);
        state.networks.filter((n) => !n.builtin && !state.containers.some((c) => c.networks[n.name])).forEach((n) => state.networks.splice(state.networks.indexOf(n), 1));
        pruneImages(a.flags.a, true);
        Object.keys(state.buildCache).forEach((k) => delete state.buildCache[k]);
        return true;
      }
      if (sub === 'info') return infoCmd();
      err(`docker: unknown command: docker system ${sub || ''}`);
      return false;
    }

    function cmdHelp(sub) {
      const h = HELP[sub];
      if (!h) { p(`Usage:  docker ${sub} [OPTIONS]`); p('(mô phỏng: chưa có trang trợ giúp chi tiết cho lệnh này)', 'dim'); return true; }
      p(''); p(`Usage:  ${h[0]}`); p(''); p(h[1]); p(h[2], 'dim');
      if (h[3].length) { p(''); p('Options:'); h[3].forEach(([f, d]) => p(`  ${f.padEnd(22)} ${d}`)); }
      return true;
    }
    function dockerHelp() {
      p(''); p('Usage:  docker [OPTIONS] COMMAND'); p(''); p('A self-sufficient runtime for containers'); p('');
      p('Common Commands:', 'head');
      [['run', 'Create and run a new container from an image'], ['exec', 'Execute a command in a running container'], ['ps', 'List containers'], ['build', 'Build an image from a Dockerfile'], ['pull', 'Download an image from a registry'], ['images', 'List images'], ['logs', 'Fetch the logs of a container'], ['stop', 'Stop one or more running containers'], ['start', 'Start one or more stopped containers'], ['rm', 'Remove one or more containers'], ['rmi', 'Remove one or more images'], ['inspect', 'Return low-level information on Docker objects'], ['version', 'Show the Docker version information'], ['info', 'Display system-wide information']].forEach(([c, d]) => p(`  ${c.padEnd(10)} ${d}`));
      p(''); p('Management Commands:', 'head');
      [['compose', 'Docker Compose'], ['container', 'Manage containers'], ['image', 'Manage images'], ['network', 'Manage networks'], ['system', 'Manage Docker'], ['volume', 'Manage volumes']].forEach(([c, d]) => p(`  ${c.padEnd(10)} ${d}`));
      p(''); p("Run 'docker COMMAND --help' for more information on a command.");
      return true;
    }

    const CMDS = {
      run: runCmd, ps: psCmd, images: imagesCmd, pull: pullCmd, rmi: rmiCmd, start: startCmd, stop: stopCmd, restart: restartCmd, kill: killCmd, rm: rmCmd,
      logs: logsCmd, exec: execCmd, inspect: inspectCmd, build: buildCmd, history: historyCmd, tag: tagCmd, port: portCmd, stats: statsCmd, rename: renameCmd,
      version: versionCmd, info: infoCmd, volume: volumeCmd, network: networkCmd, compose: composeCmd, system: systemCmd,
      'container prune': (r) => { const a = parse('container prune', r); return a ? pruneContainers(a.flags.f) : false; },
      'image prune': (r) => { const a = parse('image prune', r); return a ? pruneImages(a.flags.a, a.flags.f) : false; },
      'builder prune': (r) => { const a = parse('builder prune', r); if (!a) return false; if (!a.flags.f) { p('WARNING! This will remove all dangling build cache.'); p('Are you sure you want to continue? [y/N]'); hint('Thêm -f để xác nhận.'); return true; } const total = Object.values(state.buildCache).reduce((s, x) => s + (x.size || 0), 0); Object.keys(state.buildCache).forEach((k) => delete state.buildCache[k]); p(`Total:\t${SH.fmtSize(total)}`); return true; },
      'system df': (r) => systemCmd(['df', ...r]), 'system prune': (r) => systemCmd(['prune', ...r]),
      login: () => { p('Login Succeeded'); p('(mô phỏng: không thực sự đăng nhập Docker Hub)', 'dim'); return true; },
      search: (r) => { SH.table([['NAME', 'DESCRIPTION', 'STARS', 'OFFICIAL'], ...Object.keys(REG.CATALOG).filter((n) => !r[0] || n.includes(r[0])).map((n) => [n, 'Official image (mô phỏng)', '9999', n.includes('/') ? '' : '[OK]'])]).forEach((l, i) => p(l, i === 0 ? 'head' : '')); return true; },
    };

    function docker(args) {
      if (!args.length || ['--help', 'help', '-h'].includes(args[0])) return dockerHelp();
      if (args[0] === '--version' || args[0] === '-v') { p('Docker version 27.3.1, build ce12230'); return true; }
      let sub = args[0], rest = args.slice(1);
      const two = `${args[0]} ${args[1] || ''}`;
      if (ALIAS[two]) { sub = ALIAS[two]; rest = args.slice(2); }
      else if (['container', 'image', 'builder', 'buildx'].includes(sub)) {
        if (!args[1] || args[1] === '--help') { p(`Usage:  docker ${sub} COMMAND`); return true; }
        err(`docker: unknown command: docker ${sub} ${args[1]}`); p(''); p(`Run 'docker ${sub} --help' for more information`);
        return false;
      }
      if (rest.includes('--help') && !['volume', 'network', 'compose'].includes(sub)) return cmdHelp(sub);
      const fn = CMDS[sub];
      if (!fn) {
        err(`docker: '${sub}' is not a docker command.`); p("See 'docker --help'");
        const near = TOP.find((t) => t.startsWith(sub.slice(0, 2)));
        if (near) hint(`Có phải bạn muốn gõ "docker ${near}"?`);
        return false;
      }
      return fn(rest);
    }

    function help() {
      p('Các lệnh có trong môi trường mô phỏng:', 'head');
      p('  docker ...          Các lệnh Docker (gõ "docker" để xem danh sách)');
      p('  docker compose ...  Chạy nhiều container theo docker-compose.yml');
      p('  curl <url>          Gửi yêu cầu HTTP, ví dụ: curl localhost:8080');
      p('  ls, cat <file>      Xem file trong thư mục dự án');
      p('  clear               Xóa màn hình (hoặc Ctrl+L)');
      p('Phím tắt: ↑/↓ xem lại lệnh cũ · Tab gợi ý · Ctrl+C hủy dòng đang gõ', 'dim');
      return true;
    }
    function hostLs(args) {
      const all = args.some((x) => /^-\w*a/.test(x));
      const dir = (args.find((x) => !x.startsWith('-')) || '').replace(/^\.\/?/, '').replace(/\/$/, '');
      const names = new Set();
      Object.keys(files).forEach((k) => {
        const key = k.replace(/\/$/, '');
        if (dir && !key.startsWith(dir + '/')) return;
        const restK = dir ? key.slice(dir.length + 1) : key;
        const seg = restK.split('/');
        names.add(seg[0] + (seg.length > 1 || typeof files[k] !== 'string' ? '/' : ''));
      });
      if (dir && !names.size) { err(`ls: cannot access '${dir}': No such file or directory`); return false; }
      p([...names].filter((n) => all || !n.startsWith('.')).sort().join('  '));
      return true;
    }
    function hostCat(args) {
      if (!args.length) return true;
      for (const f of args) {
        const k = f.replace(/^\.\//, '');
        const v = files[k];
        if (v === undefined) { if (Object.keys(files).some((x) => x.startsWith(k.replace(/\/$/, '') + '/'))) err(`cat: ${f}: Is a directory`); else err(`cat: ${f}: No such file or directory`); return false; }
        if (typeof v !== 'string') { err(`cat: ${f}: Is a directory`); return false; }
        p(v.replace(/\n$/, ''));
      }
      cur.kind = 'cat'; cur.meta = { files: args };
      return true;
    }

    function hostCmd(tokens) {
      const [cmd, ...rest] = tokens;
      switch (cmd) {
        case 'docker': return docker(rest);
        case 'clear': case 'cls': CLEAR = true; return true;
        case 'help': return help();
        case 'ls': case 'dir': return hostLs(rest);
        case 'cat': case 'type': return hostCat(rest);
        case 'curl': case 'wget': return hostCurl(rest, cmd);
        case 'echo': p(rest.join(' ')); return true;
        case 'pwd': p('/home/user/lab'); return true;
        case 'whoami': p('user'); return true;
        case 'sudo': hint('Người dùng đã thuộc nhóm "docker" nên không cần sudo.'); return rest.length ? hostCmd(rest) : true;
        case 'exit': hint('Bạn đang ở máy host, không ở trong container nào.'); return true;
        case 'docker-compose': hint('docker-compose (viết liền, bản 1) đã ngừng hỗ trợ. Hãy dùng "docker compose" (có dấu cách).'); return docker(['compose', ...rest]);
        case 'kubectl': case 'minikube': case 'helm': case 'kind': err(`bash: ${cmd}: command not found`); hint('Kubernetes sẽ có ở các bài K8s của khóa DevOps.'); return false;
        default: err(`bash: ${cmd}: command not found`); return false;
      }
    }

    function sessionCmd(tokens) {
      const s = session;
      if (s.c.status !== 'running' || !state.containers.includes(s.c)) { session = null; return hostCmd(tokens); }
      if (tokens[0] === 'exit') {
        const c = s.c;
        session = null;
        p('exit', 'dim');
        if (s.viaRun) exitC(c, 0); // shell là PID 1: thoát shell thì container dừng
        cur.kind = 'exit'; cur.meta = { name: c.name, stopped: s.viaRun };
        return true;
      }
      if (tokens[0] === 'clear') { CLEAR = true; return true; }
      const r = containerCmd(s.c, tokens, s);
      r.lines.forEach((l) => p(l.text, l.cls));
      cur.kind = 'exec'; cur.meta = Object.assign({ name: s.c.name, cmd: tokens[0], ok: r.code === 0 }, r.meta);
      return r.code === 0;
    }

    function exec(line) {
      OUT = []; CLEAR = false; cur = { kind: 'other', meta: {} };
      const trimmed = String(line).trim();
      if (!trimmed) return { ok: true, lines: [] };
      let ok = true;
      try {
        let tokens = null;
        try { tokens = SH.tokenize(trimmed); } catch (e) { err(`bash: syntax error: ${e.message}`); ok = false; }
        if (tokens) ok = (session ? sessionCmd(tokens) : hostCmd(tokens)) !== false;
      } catch (e) {
        err('Lỗi nội bộ của bộ mô phỏng: ' + e.message);
        if (typeof console !== 'undefined') console.error(e);
        ok = false;
      }
      state.history.push({ cmd: trimmed, ok, kind: cur.kind, meta: cur.meta, t: now() });
      emit('change');
      return { ok, lines: OUT, clear: CLEAR };
    }

    // ---------- Gợi ý Tab ----------
    function candidates(toks, word) {
      if (session) return toks.length === 0 ? ['ls', 'cat', 'echo', 'env', 'hostname', 'ping', 'curl', 'wget', 'redis-cli', 'exit', 'ps', 'cd', 'pwd'] : listDir(session.c, session.cwd);
      if (toks.length === 0) return ['docker', 'clear', 'help', 'ls', 'cat', 'curl', 'echo'];
      if (toks[0] === 'cat' || toks[0] === 'ls') return Object.keys(files);
      if (toks[0] === 'curl') return ['localhost:'];
      if (toks[0] !== 'docker') return [];
      if (toks.length === 1) return TOP;
      let sub = toks[1];
      const two = `${toks[1]} ${toks[2] || ''}`;
      if (ALIAS[two] && toks.length >= 3) sub = ALIAS[two];
      const names = (f) => state.containers.filter(f).map((c) => c.name);
      const localRefs = state.images.filter((i) => i.repo !== '<none>').map((i) => (i.tag === 'latest' ? i.repo : `${i.repo}:${i.tag}`));
      const prev = toks[toks.length - 1];
      if (word.startsWith('-')) {
        const sp = SPECS[sub] || {};
        const longs = [...(sp.bool || []), ...(sp.value || [])].filter((x) => x.length > 1).map((x) => '--' + x);
        const shorts = [...(sp.bool || []), ...(sp.value || [])].filter((x) => x.length === 1).map((x) => '-' + x);
        return [...longs, ...Object.keys(sp.alias || {}).filter((x) => x.length > 1).map((x) => '--' + x), ...shorts];
      }
      if (prev === '--network' || prev === '--net') return state.networks.map((n) => n.name);
      switch (sub) {
        case 'start': return names((c) => c.status !== 'running');
        case 'stop': case 'kill': case 'restart': case 'exec': case 'port': case 'stats': return names((c) => c.status === 'running');
        case 'rm': case 'logs': case 'inspect': case 'rename': return names(() => true);
        case 'run': case 'pull': return [...new Set([...localRefs, ...REG.refs()])];
        case 'rmi': case 'history': case 'tag': return localRefs;
        case 'volume': return toks.length === 2 ? ['create', 'ls', 'rm', 'inspect', 'prune'] : state.volumes.map((v) => v.name);
        case 'network': if (toks.length === 2) return ['create', 'ls', 'rm', 'inspect', 'connect', 'disconnect', 'prune']; if (['connect', 'disconnect'].includes(toks[2]) && toks.length === 4) return names(() => true); return state.networks.map((n) => n.name);
        case 'compose': if (toks.length === 2) return ['up', 'down', 'ps', 'logs', 'exec', 'stop', 'start', 'restart', 'build', 'config']; if (toks[2] === 'up') return ['-d', '--build']; if (toks[2] === 'down') return ['-v']; return projContainers().map((c) => c.labels['com.docker.compose.service']);
        case 'system': return ['df', 'prune', 'info'];
        case 'container': return ['ls', 'run', 'start', 'stop', 'restart', 'rm', 'logs', 'exec', 'inspect', 'prune'];
        case 'image': return ['ls', 'rm', 'pull', 'build', 'history', 'inspect', 'tag', 'prune'];
        case 'build': return ['.', '-t'];
        default: return [];
      }
    }
    function complete(line) {
      const endsSpace = /\s$/.test(line);
      let toks;
      try { toks = SH.tokenize(line); } catch (e) { return { line, options: [] }; }
      const word = endsSpace ? '' : toks.pop() || '';
      const before = line.slice(0, line.length - word.length);
      const r = SH.completeWord(word, candidates(toks, word));
      return { line: before + r.value, options: r.options };
    }

    function prompt() {
      if (!session) return 'user@lab:~$';
      const c = session.c;
      return c.cfg.shell === 'sh' ? `${session.cwd} # ` : `root@${c.hostname}:${session.cwd}# `;
    }

    function tick() {
      let changed = false;
      for (const c of state.containers.slice()) if (c.status === 'running' && c.sleepUntil && now() >= c.sleepUntil) { exitC(c, 0); changed = true; }
      if (changed) emit('change');
    }

    return {
      exec, complete, prompt, tick, on, off, find, findImage, state, builds,
      get files() { return files; },
      get session() { return session ? { name: session.c.name, cwd: session.cwd } : null; },
      setFile(name, text) { files[name] = text; emit('change'); emit('files'); },
      resetFile(name) { if (name in initialFiles) files[name] = initialFiles[name]; else delete files[name]; emit('change'); emit('files'); },
      resetFiles() { files = Object.assign({}, initialFiles); emit('change'); emit('files'); },
      initialFiles,
      resolveHost: (from, host) => { const c = find(from); return c ? resolveHost(c, host) : null; },
      project,
    };
  }

  return { createDocker };
});
