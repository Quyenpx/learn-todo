/*
 * Kiểm thử lõi mô phỏng DevOps (YAML, shell, Docker) bằng node --test.
 * Mục đích: bảo đảm terminal giả lập phản hồi giống Docker thật để người học không bị hiểu sai.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('../js/devops/yaml-lite.js');
const shell = require('../js/devops/shell.js');

// ---------- Nhiệm vụ 1: YAML rút gọn ----------
test('yaml: map lồng nhau, list, inline list, kiểu số/bool/null, comment', () => {
  const doc = yaml.parse([
    '# tệp compose mẫu',
    'services:',
    '  web:',
    '    image: "nginx:1.25"   # có nháy',
    '    ports: [8080, "443:443"]',
    '    environment:',
    '      - DEBUG=1',
    '      - NAME=a b',
    '  redis:',
    '    image: redis:7',
    '    replicas: 3',
    '    enabled: true',
    '    extra: null',
    'volumes:',
    '  data:',
  ].join('\n'));
  assert.equal(doc.services.web.image, 'nginx:1.25');
  assert.deepEqual(doc.services.web.ports, [8080, '443:443']);
  assert.deepEqual(doc.services.web.environment, ['DEBUG=1', 'NAME=a b']);
  assert.equal(doc.services.redis.image, 'redis:7');
  assert.equal(doc.services.redis.replicas, 3);
  assert.equal(doc.services.redis.enabled, true);
  assert.equal(doc.services.redis.extra, null);
  assert.ok('data' in doc.volumes);
  assert.equal(doc.volumes.data, null);
});

test('yaml: list các map và nhiều tài liệu', () => {
  const docs = yaml.parseAll([
    'kind: Pod',
    'spec:',
    '  containers:',
    '    - name: app',
    '      image: nginx',
    '      ports:',
    '        - containerPort: 80',
    '    - name: side',
    '      image: busybox',
    '---',
    'kind: Service',
  ].join('\n'));
  assert.equal(docs.length, 2);
  assert.equal(docs[0].spec.containers.length, 2);
  assert.equal(docs[0].spec.containers[0].ports[0].containerPort, 80);
  assert.equal(docs[0].spec.containers[1].image, 'busybox');
  assert.equal(docs[1].kind, 'Service');
});

test('yaml: thụt lề sai báo lỗi có số dòng', () => {
  assert.throws(() => yaml.parse('services:\n  web:\n    image: nginx\n   ports: []'), (e) => e.name === 'YamlError' && e.line === 4);
  assert.throws(() => yaml.parse('a: 1\n\tb: 2'), (e) => e.name === 'YamlError' && e.line === 2);
});

// ---------- Nhiệm vụ 2: shell ----------
test('shell: tokenize xử lý nháy và ký tự thoát', () => {
  assert.deepEqual(shell.tokenize('docker run -e "A=b c" x'), ['docker', 'run', '-e', 'A=b c', 'x']);
  assert.deepEqual(shell.tokenize("echo 'xin chào' a\\ b"), ['echo', 'xin chào', 'a b']);
  assert.deepEqual(shell.tokenize('   '), []);
  assert.throws(() => shell.tokenize('echo "abc'), (e) => e.name === 'ShellError');
});

test('shell: parseArgs gộp cờ, cờ có giá trị, cờ lặp, dừng sau image', () => {
  const spec = { bool: ['d', 'i', 't', 'rm'], value: ['name', 'p', 'e'], multi: ['p', 'e'], alias: { detach: 'd', publish: 'p' }, stopAfter: 1 };
  const r = shell.parseArgs(['-dit', '--name=web', '-p', '80:80', '--publish', '443:443', 'nginx', 'nginx', '-g', 'daemon off;'], spec);
  assert.equal(r.error, undefined);
  assert.equal(r.flags.d, true); assert.equal(r.flags.i, true); assert.equal(r.flags.t, true);
  assert.equal(r.flags.name, 'web');
  assert.deepEqual(r.flags.p, ['80:80', '443:443']);
  assert.deepEqual(r.args, ['nginx']);
  assert.deepEqual(r.rest, ['nginx', '-g', 'daemon off;']);
  assert.equal(shell.parseArgs(['--nme', 'x'], spec).error, 'unknown flag: --nme');
  assert.equal(shell.parseArgs(['--name'], spec).error, 'flag needs an argument: --name');
});

test('shell: định dạng bảng, kích thước, thời gian', () => {
  const t = shell.table([['NAME', 'SIZE'], ['nginx', '192MB'], ['hello-world', '13.3kB']]);
  assert.equal(t[0], 'NAME          SIZE');
  assert.equal(t[2], 'hello-world   13.3kB');
  assert.equal(shell.fmtSize(192e6), '192MB');
  assert.equal(shell.fmtSize(13256), '13.3kB');
  assert.equal(shell.fmtSize(1.02e9), '1.02GB');
  assert.equal(shell.fmtSize(7.8e6), '7.8MB');
  assert.equal(shell.ago(5000), '5 seconds ago');
  assert.equal(shell.ago(70000), 'About a minute ago');
  assert.equal(shell.ago(3 * 60000), '3 minutes ago');
  assert.equal(shell.ago(400), 'Less than a second ago');
});

test('shell: gợi ý hoàn thành từ', () => {
  assert.deepEqual(shell.completeWord('st', ['start', 'stop', 'stats', 'run']), { value: 'st', options: ['start', 'stats', 'stop'] });
  assert.deepEqual(shell.completeWord('ru', ['start', 'run']), { value: 'run ', options: [] });
  assert.deepEqual(shell.completeWord('n', ['network', 'netstat']), { value: 'net', options: ['netstat', 'network'] });
});

// ---------- Nhiệm vụ 3: registry và vòng đời container ----------
const { createDocker } = require('../js/devops/docker-engine.js');
const out = (r) => r.lines.map((l) => l.text).join('\n');
// Đồng hồ giả giúp kiểm thử thời gian ("Up 5 seconds") một cách xác định
function mkDocker(opts = {}) {
  let t = Date.UTC(2026, 9, 6, 2, 30, 0);
  const eng = createDocker(Object.assign({ seed: 1, now: () => t }, opts));
  eng.advance = (ms) => { t += ms; eng.tick(); };
  return eng;
}

test('docker: pull lần đầu, lần hai, và layer dùng chung', () => {
  const d = mkDocker();
  let r = d.exec('docker pull nginx');
  assert.ok(r.ok);
  assert.match(out(r), /Using default tag: latest/);
  assert.match(out(r), /Status: Downloaded newer image for nginx:latest/);
  r = d.exec('docker pull nginx');
  assert.match(out(r), /Status: Image is up to date for nginx:latest/);
  r = d.exec('docker pull redis:7');
  assert.match(out(r), /Already exists/);
  r = d.exec('docker pull khongco');
  assert.equal(r.ok, false);
  assert.match(out(r), /pull access denied for khongco/);
  r = d.exec('docker pull nginx:9.9');
  assert.match(out(r), /manifest for nginx:9\.9 not found/);
  assert.match(out(d.exec('docker images')), /^REPOSITORY\s+TAG\s+IMAGE ID\s+CREATED\s+SIZE/);
});

test('docker: run hello-world tự tải image và thoát với mã 0', () => {
  const d = mkDocker();
  const r = d.exec('docker run hello-world');
  assert.ok(r.ok);
  assert.match(out(r), /Unable to find image 'hello-world:latest' locally/);
  assert.match(out(r), /Hello from Docker!/);
  const c = d.state.containers[0];
  assert.equal(c.status, 'exited');
  assert.equal(c.exitCode, 0);
  assert.match(out(d.exec('docker ps -a')), /Exited \(0\)/);
  assert.doesNotMatch(out(d.exec('docker ps')), /hello-world/);
});

test('docker: chạy nginx nền, ps, trùng tên, trùng cổng', () => {
  const d = mkDocker();
  let r = d.exec('docker run -d --name web -p 8080:80 nginx');
  assert.ok(r.ok);
  assert.match(r.lines[r.lines.length - 1].text, /^[0-9a-f]{64}$/);
  d.advance(5000);
  const ps = out(d.exec('docker ps'));
  assert.match(ps, /0\.0\.0\.0:8080->80\/tcp/);
  assert.match(ps, /Up 5 seconds/);
  assert.match(ps, /web$/m);
  r = d.exec('docker run -d --name web nginx');
  assert.equal(r.ok, false);
  assert.match(out(r), /Conflict\. The container name "\/web" is already in use/);
  r = d.exec('docker run -d --name web2 -p 8080:80 nginx');
  assert.equal(r.ok, false);
  assert.match(out(r), /Bind for 0\.0\.0\.0:8080 failed: port is already allocated/);
  assert.equal(d.find('web2').status, 'created');
  assert.ok(r.lines.some((l) => l.cls === 'hint'), 'phải có dòng gợi ý tiếng Việt');
});

test('docker: curl qua cổng ánh xạ, logs, stop và rm', () => {
  const d = mkDocker();
  d.exec('docker run -d --name web -p 8080:80 nginx');
  let r = d.exec('curl localhost:8080');
  assert.ok(r.ok);
  assert.match(out(r), /Welcome to nginx!/);
  const h = d.state.history[d.state.history.length - 1];
  assert.equal(h.kind, 'curl'); assert.equal(h.ok, true); assert.equal(h.meta.port, 8080);
  r = d.exec('curl localhost:9999');
  assert.equal(r.ok, false);
  assert.match(out(r), /Failed to connect to localhost port 9999/);
  r = d.exec('curl web');
  assert.match(out(r), /Could not resolve host: web/);
  assert.match(out(d.exec('docker logs web')), /"GET \/ HTTP\/1\.1" 200/);
  r = d.exec('docker rm web');
  assert.equal(r.ok, false);
  assert.match(out(r), /container is running/);
  assert.equal(out(d.exec('docker stop web')), 'web');
  assert.equal(d.find('web').status, 'exited');
  assert.equal(out(d.exec('docker rm web')), 'web');
  assert.equal(d.find('web'), undefined);
  assert.deepEqual(d.state.removed.map((x) => [x.name, x.status]), [['web', 'exited']]);
  r = d.exec('docker stop khongco');
  assert.match(out(r), /No such container: khongco/);
});

test('docker: --rm, lệnh ghi đè, postgres thiếu mật khẩu, lệnh lạ', () => {
  const d = mkDocker();
  let r = d.exec('docker run --rm alpine echo xin chao');
  assert.match(out(r), /^xin chao$/m);
  assert.equal(d.state.containers.filter((c) => c.image === 'alpine').length, 0);
  d.exec('docker run -d --name db postgres:16');
  assert.equal(d.find('db').status, 'exited');
  assert.equal(d.find('db').exitCode, 1);
  assert.match(out(d.exec('docker logs db')), /POSTGRES_PASSWORD/);
  d.exec('docker run -d --name db2 -e POSTGRES_PASSWORD=secret postgres:16');
  assert.equal(d.find('db2').status, 'running');
  assert.match(out(d.exec('docker foo')), /docker: 'foo' is not a docker command/);
  assert.match(out(d.exec('lenhla')), /lenhla: command not found/);
  r = d.exec('docker run -d --nme x nginx');
  assert.match(out(r), /unknown flag: --nme/);
});

test('docker: exec vào container và gợi ý Tab', () => {
  const d = mkDocker();
  d.exec('docker run -d --name web -p 8080:80 nginx');
  assert.match(out(d.exec('docker exec web cat /usr/share/nginx/html/index.html')), /Welcome to nginx!/);
  d.exec('docker run -d --name box alpine sleep 3600');
  let r = d.exec('docker exec -it box sh');
  assert.ok(r.ok);
  assert.match(d.prompt(), /#\s*$/);
  r = d.exec('echo hello > /tmp/a.txt');
  assert.match(out(d.exec('cat /tmp/a.txt')), /^hello$/);
  d.exec('exit');
  assert.equal(d.prompt(), 'user@lab:~$');
  assert.equal(d.find('box').status, 'running', 'thoát phiên exec không dừng container');
  r = d.exec('docker exec -it box bash');
  assert.match(out(r), /executable file not found/);
  assert.deepEqual(d.complete('docker sto').line, 'docker stop ');
  assert.equal(d.complete('docker stop w').line, 'docker stop web ');
  assert.ok(d.complete('docker st').options.includes('start'));
});

// ---------- Nhiệm vụ 4: docker build ----------
// Dự án Python mẫu dùng chung cho bài D2. ".venv/" và ".git/" là thư mục ảo nặng để minh họa vai trò của .dockerignore
const APP_PY = 'from flask import Flask\napp = Flask(__name__)\n\n@app.get("/")\ndef index():\n    return "Hello from myapp!"\n\napp.run(host="0.0.0.0", port=5000)\n';
const DF_NAIVE = 'FROM python:3.12\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nEXPOSE 5000\nCMD ["python", "app.py"]\n';
const DF_OPT = 'FROM python:3.12\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["python", "app.py"]\n';
const pyFiles = (df, extra = {}) => Object.assign({ Dockerfile: df, 'app.py': APP_PY, 'requirements.txt': 'flask==3.0.3\nredis==5.0.8\n', '.venv/': { size: 180e6 }, '.git/': { size: 25e6 } }, extra);
const lastBuild = (d) => d.builds[d.builds.length - 1];
const stepOf = (b, re) => b.steps.find((s) => re.test(s.text));

test('build: lần đầu không có cache, build lại y nguyên thì mọi bước đều CACHED', () => {
  const d = mkDocker({ files: pyFiles(DF_NAIVE) });
  let r = d.exec('docker build -t myapp:v1 .');
  assert.ok(r.ok, out(r));
  assert.match(out(r), /\[\+\] Building [\d.]+s \(\d+\/\d+\) FINISHED/);
  assert.match(out(r), /\[1\/4\] FROM docker\.io\/library\/python:3\.12/);
  assert.match(out(r), /naming to docker\.io\/library\/myapp:v1/);
  assert.ok(lastBuild(d).steps.length === 3 && lastBuild(d).steps.every((s) => !s.cached));
  assert.ok(d.findImage('myapp:v1'));
  r = d.exec('docker build -t myapp:v1 .');
  assert.ok(lastBuild(d).steps.every((s) => s.cached));
  assert.match(out(r), /CACHED \[3\/4\] COPY \. \./);
});

test('build: Dockerfile chưa tối ưu — sửa app.py làm bước pip install bị chạy lại', () => {
  const d = mkDocker({ files: pyFiles(DF_NAIVE) });
  d.exec('docker build -t myapp:v1 .');
  d.setFile('app.py', APP_PY.replace('Hello', 'Xin chao'));
  d.exec('docker build -t myapp:v1 .');
  const b = lastBuild(d);
  assert.equal(stepOf(b, /^WORKDIR/).cached, true);
  assert.equal(stepOf(b, /^COPY \. \./).cached, false);
  assert.equal(stepOf(b, /pip install/).cached, false);
  assert.match(out(d.exec('docker images')), /<none>/, 'image cũ mất tag thành <none>');
});

test('build: Dockerfile tối ưu — sửa app.py nhưng bước pip install vẫn CACHED', () => {
  const d = mkDocker({ files: pyFiles(DF_OPT) });
  d.exec('docker build -t myapp:v1 .');
  d.setFile('app.py', APP_PY.replace('Hello', 'Xin chao'));
  d.exec('docker build -t myapp:v2 .');
  const b = lastBuild(d);
  assert.equal(stepOf(b, /pip install/).cached, true);
  assert.equal(stepOf(b, /^COPY \. \./).cached, false);
  d.setFile('requirements.txt', 'flask==3.0.3\nredis==5.0.8\nrequests==2.32.3\n');
  d.exec('docker build -t myapp:v3 .');
  assert.equal(stepOf(lastBuild(d), /pip install/).cached, false, 'đổi requirements.txt thì phải cài lại');
});

test('build: .dockerignore, image slim và multi-stage làm image nhỏ đi', () => {
  const d = mkDocker({ files: pyFiles(DF_OPT) });
  d.exec('docker build -t myapp:v1 .');
  const v1 = d.findImage('myapp:v1').size;
  d.setFile('.dockerignore', '.venv\n.git\n__pycache__/\n*.pyc\n');
  d.exec('docker build -t myapp:ignore .');
  assert.ok(d.findImage('myapp:ignore').size < v1 - 200e6, '.dockerignore phải loại .venv và .git');
  d.setFile('Dockerfile', DF_OPT.replace('python:3.12', 'python:3.12-slim').replace('pip install', 'pip install --no-cache-dir'));
  d.exec('docker build -t myapp:slim .');
  assert.ok(d.findImage('myapp:slim').size < v1 * 0.5, 'slim phải nhỏ hơn 50%');
  const single = 'FROM python:3.12-slim\nWORKDIR /app\nRUN apt-get update && apt-get install -y gcc build-essential\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nCMD ["python", "app.py"]\n';
  const multi = 'FROM python:3.12-slim AS builder\nWORKDIR /app\nRUN apt-get update && apt-get install -y gcc build-essential\nCOPY requirements.txt .\nRUN pip install --no-cache-dir --prefix=/install -r requirements.txt\n\nFROM python:3.12-slim\nWORKDIR /app\nCOPY --from=builder /install /usr/local\nCOPY . .\nCMD ["python", "app.py"]\n';
  d.setFile('Dockerfile', single);
  d.exec('docker build -t myapp:single .');
  d.setFile('Dockerfile', multi);
  const r = d.exec('docker build -t myapp:multi .');
  assert.ok(r.ok, out(r));
  assert.match(out(r), /\[builder 1\/5\] FROM/);
  assert.match(out(r), /\[stage-1 3\/4\] COPY --from=builder \/install \/usr\/local/);
  assert.ok(d.findImage('myapp:multi').size < d.findImage('myapp:single').size - 150e6, 'multi-stage bỏ được công cụ build');
});

test('build: lỗi cú pháp, thiếu file, image gốc không tồn tại, quên dấu chấm', () => {
  const d = mkDocker({ files: pyFiles('FROM python:3.12\nWORKDIR /app\nCOPY . .\nRUNN pip install -r requirements.txt\n') });
  let r = d.exec('docker build -t x .');
  assert.equal(r.ok, false);
  assert.match(out(r), /dockerfile parse error on line 4: unknown instruction: RUNN/);
  assert.equal(lastBuild(d).errorLine, 4);
  d.setFile('Dockerfile', 'FROM python:3.12\nCOPY khongco.txt .\n');
  r = d.exec('docker build -t x .');
  assert.match(out(r), /"\/khongco\.txt": not found/);
  d.setFile('Dockerfile', 'FROM khongco:1\n');
  r = d.exec('docker build -t x .');
  assert.match(out(r), /failed to resolve source metadata for docker\.io\/library\/khongco:1/);
  d.setFile('Dockerfile', 'FROM python:3.12\nWORKDIR /app\nRUN pip install -r requirements.txt\nCOPY . .\n');
  r = d.exec('docker build -t x .');
  assert.match(out(r), /Could not open requirements file/);
  assert.match(out(r), /did not complete successfully: exit code: 1/);
  r = d.exec('docker build -t x');
  assert.match(out(r), /requires exactly 1 argument/);
  assert.ok(r.lines.some((l) => l.cls === 'hint' && l.text.includes('dấu chấm')));
});

test('build: chạy image vừa build và xem history', () => {
  const d = mkDocker({ files: pyFiles(DF_OPT, { '.dockerignore': '.venv\n.git\n' }) });
  d.exec('docker build -t myapp:v1 .');
  d.exec('docker run -d --name app -p 5000:5000 myapp:v1');
  assert.equal(d.find('app').status, 'running');
  assert.match(out(d.exec('curl localhost:5000')), /Hello from myapp!/);
  assert.match(out(d.exec('docker history myapp:v1')), /RUN \/bin\/sh -c pip install/);
  d.setFile('Dockerfile', 'FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\n');
  d.exec('docker build -t nocmd .');
  d.exec('docker run -d --name nocmd nocmd');
  assert.equal(d.find('nocmd').status, 'exited', 'không có CMD thì kế thừa CMD python3 và thoát ngay');
});
