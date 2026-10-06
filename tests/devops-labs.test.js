/*
 * Kiểm thử hàm check() của các lab DevOps: dựng trạng thái bằng chuỗi lệnh thật trên engine
 * để bảo đảm người học làm đúng hướng dẫn trong phần gợi ý thì lab được chấm đạt.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocker } = require('../js/devops/docker-engine.js');
const basics = require('../js/lessons/devops/docker-basics.js');
const dockerfile = require('../js/lessons/devops/dockerfile.js');
const compose = require('../js/lessons/devops/docker-compose.js');

function mk(files = {}) {
  let t = Date.UTC(2026, 9, 6, 3, 0, 0);
  return createDocker({ seed: 3, files: JSON.parse(JSON.stringify(files)), now: () => (t += 1000) });
}
const lab = (lesson, id) => lesson.labs.find((l) => l.id === id);
const run = (e, cmds) => cmds.forEach((c) => e.exec(c));
const okOf = (lesson, id, e) => lab(lesson, id).check(e).ok;

test('lab D1: các nhiệm vụ đạt khi làm theo gợi ý, chưa đạt khi chưa làm', () => {
  const e = mk();
  assert.equal(okOf(basics, 'hello', e), false);
  assert.equal(okOf(basics, 'hello', {}), false, 'không được lỗi khi chưa có engine');
  run(e, ['docker run hello-world']);
  assert.equal(okOf(basics, 'hello', e), true);
  run(e, ['docker run -d --name web -p 8081:80 nginx']);
  assert.equal(okOf(basics, 'web', e), false, 'sai cổng thì chưa đạt');
  run(e, ['docker rm -f web', 'docker run -d --name web -p 8080:80 nginx']);
  assert.equal(okOf(basics, 'web', e), true);
  run(e, ['curl localhost:8080']);
  assert.equal(okOf(basics, 'curl', e), false);
  run(e, ['docker logs web']);
  assert.equal(okOf(basics, 'curl', e), true);
  run(e, ['docker exec -it web bash', 'ls /usr/share/nginx/html', 'exit', 'docker stop web', 'docker rm web']);
  assert.equal(okOf(basics, 'clean', e), true);
});

test('lab D2: build, chạy, cache và thu nhỏ image', () => {
  const FILES = { Dockerfile: 'FROM python:3.12\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nEXPOSE 5000\nCMD ["python", "app.py"]\n', 'app.py': 'from flask import Flask\napp = Flask(__name__)\n@app.get("/")\ndef i():\n    return "Hello from myapp!"\napp.run(host="0.0.0.0", port=5000)\n', 'requirements.txt': 'flask==3.0.3\n', '.venv/': { size: 180e6 }, '.git/': { size: 25e6 } };
  const e = mk(FILES);
  run(e, ['docker build -t myapp:v1 .']);
  assert.equal(okOf(dockerfile, 'build', e), true);
  run(e, ['docker run -d --name app -p 5000:5000 myapp:v1', 'curl localhost:5000']);
  assert.equal(okOf(dockerfile, 'run', e), true);
  assert.equal(okOf(dockerfile, 'cache', e), false);
  e.setFile('Dockerfile', 'FROM python:3.12\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["python", "app.py"]\n');
  run(e, ['docker build -t myapp:v2 .']);
  e.setFile('app.py', e.files['app.py'].replace('Hello', 'Xin chao'));
  run(e, ['docker build -t myapp:v3 .']);
  assert.equal(okOf(dockerfile, 'cache', e), true);
  assert.equal(okOf(dockerfile, 'slim', e), false);
  e.setFile('.dockerignore', '.venv\n.git\n__pycache__/\n');
  e.setFile('Dockerfile', e.files.Dockerfile.replace('python:3.12', 'python:3.12-slim').replace('pip install', 'pip install --no-cache-dir'));
  run(e, ['docker build -t myapp:slim .']);
  assert.equal(okOf(dockerfile, 'slim', e), true);
});

test('lab D3: network, volume, compose up và down giữ volume', () => {
  const COMPOSE = 'services:\n  web:\n    image: vlab/counter:1.0\n    ports:\n      - "5000:5000"\n    environment:\n      REDIS_HOST: redis\n    depends_on:\n      - redis\n  redis:\n    image: redis:7\n';
  const e = mk({ 'compose.yaml': COMPOSE });
  run(e, ['docker network create appnet', 'docker run -d --name c1 --network appnet alpine sleep 3600', 'docker run -d --name c2 --network appnet alpine sleep 3600', 'docker exec c1 ping -c 1 c2']);
  assert.equal(okOf(compose, 'net', e), true);
  run(e, ['docker run -d --name r1 -v redis-data:/data redis:7', 'docker exec r1 redis-cli set ten Lan', 'docker rm -f r1']);
  assert.equal(okOf(compose, 'vol', e), true);
  run(e, ['docker compose up -d', 'curl localhost:5000']);
  assert.equal(okOf(compose, 'up', e), true);
  assert.equal(okOf(compose, 'down', e), false);
  e.setFile('compose.yaml', COMPOSE + '    volumes:\n      - redis-data:/data\nvolumes:\n  redis-data:\n');
  run(e, ['docker compose up -d', 'docker compose down']);
  assert.equal(okOf(compose, 'down', e), true);
});

test('bài DevOps: đủ 4 lab, 6 câu hỏi, đáp án hợp lệ', () => {
  [basics, dockerfile, compose].forEach((l) => {
    assert.equal(l.course, 'devops');
    assert.equal(l.labs.length, 4);
    assert.equal(l.quiz.length, 6);
    l.quiz.forEach((q) => assert.ok(q.answer >= 0 && q.answer < q.options.length, q.q));
  });
});
