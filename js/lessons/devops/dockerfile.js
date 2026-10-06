/*
 * Bài D2 — Dockerfile & build: tự đóng gói app Flask, hiểu cache theo lớp, .dockerignore và image slim.
 * Sơ đồ bên phải vẽ từng lớp của lần build gần nhất (CACHED / build lại) và so sánh kích thước các image.
 */
(function () {
  'use strict';
  const APP_PY = 'from flask import Flask\napp = Flask(__name__)\n\n@app.get("/")\ndef index():\n    return "Hello from myapp!"\n\napp.run(host="0.0.0.0", port=5000)\n';
  // Dockerfile ban đầu cố ý chưa tối ưu: COPY . . đứng trước pip install
  const DF = 'FROM python:3.12\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nEXPOSE 5000\nCMD ["python", "app.py"]\n';
  const FILES = { Dockerfile: DF, 'app.py': APP_PY, 'requirements.txt': 'flask==3.0.3\n', '.venv/': { size: 180e6 }, '.git/': { size: 25e6 } };
  const builds = (e) => (e && e.builds ? e.builds.filter((b) => b.ok) : []);

  const lesson = {
    id: 'dockerfile',
    course: 'devops',
    group: 'Docker',
    icon: '🧱',
    navTitle: 'Dockerfile & build',
    navSub: 'Cache, lớp, thu nhỏ image',
    badge: 'DevOps · Bài 2',
    title: 'Dockerfile: tự đóng gói ứng dụng thành image',
    lead: 'Bạn có một app Flask nhỏ và một Dockerfile "chạy được nhưng dở". Hãy build, chạy, rồi tối ưu để build lại chỉ mất vài giây và image nhỏ đi gần 10 lần.',
    labs: [
      {
        id: 'build', title: 'Build image đầu tiên',
        desc: 'Build image tên <code>myapp:v1</code> từ thư mục hiện tại. Quan sát từng bước <code>[n/N]</code> trong output và các lớp trên sơ đồ.',
        hint: '<code>docker build -t myapp:v1 .</code> — đừng quên dấu chấm cuối: đó là <b>thư mục ngữ cảnh build</b>.',
        check: (e) => (builds(e).some((b) => b.tags.some((t) => /^myapp/.test(t))) ? { ok: true } : { ok: false, msg: 'Chưa có lần build thành công nào với tên myapp.' }),
      },
      {
        id: 'run', title: 'Chạy app từ image vừa build',
        desc: 'Chạy container nền từ image myapp, ánh xạ cổng <b>5000</b>, rồi <code>curl localhost:5000</code> để thấy "Hello from myapp!".',
        hint: '<code>docker run -d --name app -p 5000:5000 myapp:v1</code> rồi <code>curl localhost:5000</code>.',
        check: (e) => {
          const ok = e && e.state && e.state.containers.some((c) => /myapp/.test(c.image) && c.status === 'running') && e.state.history.some((h) => h.kind === 'curl' && h.ok && h.meta.port === 5000);
          return ok ? { ok: true } : { ok: false, msg: 'Cần container từ image myapp đang chạy và một lần curl thành công tới cổng 5000.' };
        },
      },
      {
        id: 'cache', title: 'Tận dụng cache: sửa code mà không cài lại thư viện',
        desc: 'Sửa Dockerfile để <code>COPY requirements.txt .</code> và <code>RUN pip install</code> đứng <b>trước</b> <code>COPY . .</code>. Build một lần, sửa <code>app.py</code> (đổi câu chào), build lại: bước pip install phải hiện <b>CACHED</b>.',
        hint: 'Dockerfile tối ưu:<pre class="code">FROM python:3.12\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["python", "app.py"]</pre>',
        reflect: { q: 'Vì sao thứ tự lại quan trọng?', a: 'Mỗi chỉ thị tạo một lớp; khóa cache của COPY gồm cả nội dung file. Khi một lớp thay đổi, mọi lớp phía sau phải build lại. Đặt phần ít thay đổi (thư viện) lên trước, phần hay thay đổi (code) xuống cuối.' },
        check: (e) => (builds(e).some((b) => b.steps.some((s) => /pip install/.test(s.text) && s.cached) && b.steps.some((s) => /^COPY \. /.test(s.text) && !s.cached)) ? { ok: true } : { ok: false, msg: 'Chưa thấy lần build nào có pip install CACHED trong khi COPY . . được build lại.' }),
      },
      {
        id: 'slim', title: 'Thu nhỏ image dưới 300MB',
        desc: 'Kết hợp 3 kỹ thuật: tạo <code>.dockerignore</code> loại <code>.venv</code> và <code>.git</code>, đổi sang <code>python:3.12-slim</code>, và thêm <code>--no-cache-dir</code> cho pip. Build lại và xem sơ đồ so sánh kích thước.',
        hint: 'File <code>.dockerignore</code>:<pre class="code">.venv\n.git\n__pycache__/</pre>Trong Dockerfile: <code>FROM python:3.12-slim</code> và <code>RUN pip install --no-cache-dir -r requirements.txt</code>.',
        reflect: { q: 'Mỗi kỹ thuật bớt được bao nhiêu?', a: '.dockerignore bỏ ~205MB rác (.venv, .git) khỏi ngữ cảnh build. Image slim bỏ trình biên dịch và công cụ build (~890MB). --no-cache-dir bỏ bộ đệm tải về của pip.' },
        check: (e) => (builds(e).some((b) => b.size < 300e6) ? { ok: true } : { ok: false, msg: 'Chưa có image nào dưới 300MB. Xem sơ đồ kích thước để biết đang ở mức nào.' }),
      },
    ],
    quiz: [
      { q: 'Trong Dockerfile, chỉ thị nào tạo ra <b>lớp hệ thống file</b> mới?', options: ['ENV, EXPOSE, CMD', 'RUN, COPY, ADD (và WORKDIR)', 'Chỉ FROM', 'Mọi chỉ thị đều tạo lớp có dung lượng'], answer: 1, explain: 'RUN/COPY/ADD thay đổi file nên tạo lớp có dung lượng. ENV, EXPOSE, CMD chỉ ghi metadata (lớp 0B).' },
      { q: 'Sửa một dòng trong app.py, Dockerfile có <code>COPY . .</code> trước <code>RUN pip install</code>. Điều gì xảy ra khi build lại?', options: ['Mọi bước đều CACHED', 'COPY . . và mọi bước sau nó (kể cả pip install) phải chạy lại', 'Chỉ bước FROM chạy lại', 'Build báo lỗi'], answer: 1, explain: 'Nội dung ngữ cảnh đổi → khóa cache của COPY đổi → toàn bộ lớp sau bị vô hiệu.' },
      { q: 'Khác nhau giữa <code>CMD</code> và <code>RUN</code>?', options: ['Giống nhau', 'RUN chạy lúc build để tạo lớp; CMD là lệnh mặc định khi container khởi động', 'CMD chạy lúc build', 'RUN chỉ dùng cho Python'], answer: 1, explain: 'RUN pip install chạy một lần lúc build. CMD ["python","app.py"] chạy mỗi khi docker run.' },
      { q: '<code>.dockerignore</code> có tác dụng gì?', options: ['Bỏ qua lỗi khi build', 'Loại file/thư mục khỏi ngữ cảnh gửi tới Docker, giúp build nhanh, image nhỏ và không lộ bí mật', 'Xóa image cũ', 'Ẩn container khỏi docker ps'], answer: 1, explain: 'Giống .gitignore: .venv, .git, node_modules, .env không bị gửi đi nên không lọt vào image.' },
      { q: 'Multi-stage build giúp gì?', options: ['Build song song nhiều image', 'Dùng stage đầy đủ công cụ để biên dịch, rồi chỉ chép kết quả sang stage tối giản → image cuối nhỏ', 'Chạy nhiều container cùng lúc', 'Tăng bảo mật mạng'], answer: 1, explain: 'COPY --from=builder chỉ lấy thư mục kết quả; gcc, build-essential ở lại stage builder.' },
      { q: 'Vì sao nên viết <code>CMD ["python", "app.py"]</code> thay vì <code>CMD python app.py</code>?', options: ['Chạy nhanh hơn', 'Dạng mảng JSON chạy trực tiếp tiến trình làm PID 1, nhận được tín hiệu dừng (SIGTERM) để tắt êm', 'Dạng shell không chạy được', 'Không có khác biệt'], answer: 1, explain: 'Dạng shell bọc qua /bin/sh -c; shell không chuyển SIGTERM cho app nên docker stop phải đợi 10 giây rồi kill.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Dockerfile là "công thức" tạo image</h2>
        <p>Mỗi dòng là một chỉ thị, Docker thực hiện từ trên xuống. Kết quả là một image gồm nhiều <b>lớp</b> xếp chồng, lớp sau ghi đè lên lớp trước.</p>
        <pre class="code"><code>FROM python:3.12-slim        # image gốc
WORKDIR /app                 # thư mục làm việc (tự tạo)
COPY requirements.txt .      # chép file từ ngữ cảnh build
RUN pip install --no-cache-dir -r requirements.txt
COPY . .                     # chép phần code còn lại
EXPOSE 5000                  # ghi chú cổng app lắng nghe
CMD ["python", "app.py"]     # lệnh mặc định khi chạy</code></pre>
        <h3>Cache theo lớp — bí quyết build nhanh</h3>
        <p>Docker lưu lại kết quả từng bước. Lần build sau, nếu chỉ thị và dữ liệu đầu vào không đổi, bước đó hiện <code>CACHED</code> và mất 0 giây. Nhưng <b>một bước đổi thì mọi bước phía sau đều build lại</b>.</p>
        <div class="callout tip"><strong>Quy tắc vàng:</strong> thứ ít thay đổi lên trên (image gốc, cài thư viện), thứ hay thay đổi xuống dưới (code). Chép riêng <code>requirements.txt</code> trước để sửa code không phải cài lại thư viện.</div>
        <h3>Ngữ cảnh build và .dockerignore</h3>
        <p>Dấu <code>.</code> trong <code>docker build -t myapp .</code> là <b>ngữ cảnh</b>: toàn bộ thư mục được gửi cho Docker. <code>COPY</code> chỉ lấy được file trong ngữ cảnh. Dùng <code>.dockerignore</code> để loại <code>.venv</code>, <code>.git</code>, <code>node_modules</code>, <code>.env</code>.</p>
        <h3>Thu nhỏ image</h3>
        <ul>
          <li><b>Image gốc nhỏ:</b> <code>python:3.12</code> ~1GB → <code>python:3.12-slim</code> ~130MB → <code>alpine</code> ~8MB (nhưng dùng <code>apk</code> thay <code>apt-get</code>).</li>
          <li><b>Dọn trong cùng lệnh RUN:</b> <code>apt-get update &amp;&amp; apt-get install -y gcc &amp;&amp; rm -rf /var/lib/apt/lists/*</code>. Xóa ở lệnh RUN khác không giảm được dung lượng vì lớp cũ vẫn còn.</li>
          <li><b>Multi-stage:</b> stage <code>builder</code> có đủ công cụ biên dịch; stage cuối chỉ <code>COPY --from=builder</code> phần kết quả.</li>
        </ul>
        <pre class="code"><code>FROM python:3.12-slim AS builder
RUN apt-get update &amp;&amp; apt-get install -y gcc build-essential
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
COPY --from=builder /install /usr/local
COPY . /app
CMD ["python", "/app/app.py"]</code></pre>
        <p>Xem các lớp của một image: <code>docker history myapp:v1</code>. Xem dung lượng cache: <code>docker system df</code>.</p>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Tạo thư mục chứa <code>app.py</code>, <code>requirements.txt</code>, <code>Dockerfile</code> như trong trình sửa file, rồi chạy <code>docker build -t myapp:v1 .</code> và <code>docker run -p 5000:5000 myapp:v1</code>. Thêm <code>--progress=plain</code> để xem đầy đủ output từng bước.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>requires exactly 1 argument</code> — quên dấu <code>.</code> ở cuối lệnh build.</li>
            <li><code>"/app.py": not found</code> — file không nằm trong ngữ cảnh hoặc bị <code>.dockerignore</code> loại.</li>
            <li><code>Could not open requirements file</code> — chạy pip install trước khi COPY requirements.txt.</li>
            <li><code>apt-get: not found</code> — image Alpine dùng <code>apk add</code>.</li>
            <li>Image cũ thành <code>&lt;none&gt;</code> — build lại cùng tag; dọn bằng <code>docker image prune</code>.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        title: '🧱 Xưởng build image',
        files: FILES,
        editFiles: ['Dockerfile', '.dockerignore', 'app.py', 'requirements.txt'],
        diagram: 'layers',
        cvHeight: 280,
        height: 300,
        welcome: ['Thư mục ~/lab có sẵn app Flask. Sửa file ở khung bên trái, build ở terminal này.', 'Thử: ls → cat Dockerfile → docker build -t myapp:v1 .'],
        chips: ['ls', 'cat Dockerfile', 'docker build -t myapp:v1 .', 'docker run -d --name app -p 5000:5000 myapp:v1', 'curl localhost:5000', 'docker images', 'docker history myapp:v1', 'docker rm -f app'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
