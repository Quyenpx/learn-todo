/*
 * Bài D3 — Docker Compose, volume và network: ghép web + Redis thành một hệ thống,
 * cho container gọi nhau bằng tên và giữ dữ liệu khi container bị xóa.
 */
(function () {
  'use strict';
  // compose.yaml ban đầu chưa có volume: người học tự thêm ở nhiệm vụ 4
  const COMPOSE = 'services:\n  web:\n    image: vlab/counter:1.0\n    ports:\n      - "5000:5000"\n    environment:\n      REDIS_HOST: redis\n    depends_on:\n      - redis\n  redis:\n    image: redis:7\n';
  const H = (e) => (e && e.state ? e.state.history : []);

  const lesson = {
    id: 'docker-compose',
    course: 'devops',
    group: 'Docker',
    icon: '🎼',
    navTitle: 'Compose, volume, network',
    navSub: 'Nhiều dịch vụ, dữ liệu bền',
    badge: 'DevOps · Bài 3',
    title: 'Docker Compose: chạy cả hệ thống bằng một lệnh',
    lead: 'Ứng dụng thật hiếm khi chỉ có một container. Bạn sẽ cho các container nói chuyện với nhau qua network, giữ dữ liệu Redis bằng volume, rồi gói tất cả vào một file compose.yaml.',
    labs: [
      {
        id: 'net', title: 'Cho hai container gọi nhau bằng tên',
        desc: 'Tạo network <code>appnet</code>, chạy 2 container alpine trên network đó, rồi từ container này <code>ping</code> container kia bằng tên. Thử cả trên network mặc định để thấy khác biệt.',
        hint: '<code>docker network create appnet</code><br><code>docker run -d --name c1 --network appnet alpine sleep 3600</code><br><code>docker run -d --name c2 --network appnet alpine sleep 3600</code><br><code>docker exec c1 ping -c 1 c2</code>',
        reflect: { q: 'Vì sao trên network bridge mặc định lại không ping được bằng tên?', a: 'Network bridge mặc định không có DNS nội bộ (lý do lịch sử). Network do bạn tạo có DNS tích hợp: tên container tự phân giải ra IP. Compose luôn tạo network riêng nên các service gọi nhau bằng tên service.' },
        check: (e) => (H(e).some((h) => h.kind === 'exec' && h.ok && h.meta.cmd === 'ping') ? { ok: true } : { ok: false, msg: 'Chưa có lệnh ping nào thành công từ bên trong container.' }),
      },
      {
        id: 'vol', title: 'Giữ dữ liệu Redis bằng volume',
        desc: 'Chạy redis với <code>-v redis-data:/data</code>, ghi một khóa bằng <code>redis-cli set</code>, xóa hẳn container, chạy container mới gắn lại volume đó và đọc lại khóa.',
        hint: '<code>docker run -d --name r1 -v redis-data:/data redis:7</code><br><code>docker exec r1 redis-cli set ten Lan</code><br><code>docker rm -f r1</code><br><code>docker run -d --name r2 -v redis-data:/data redis:7</code><br><code>docker exec r2 redis-cli get ten</code>',
        reflect: { q: 'Dữ liệu nằm ở đâu khi container đã bị xóa?', a: 'Trong volume — vùng lưu trữ do Docker quản lý, tách khỏi vòng đời container. Không có volume, dữ liệu nằm ở lớp ghi tạm và mất cùng container.' },
        check: (e) => {
          const vol = e && e.state && e.state.volumes.some((v) => Object.keys(v.data).length);
          const rm = e && e.state && e.state.removed.some((x) => /redis/.test(x.image));
          return vol && rm ? { ok: true } : { ok: false, msg: !vol ? 'Chưa có volume nào chứa dữ liệu.' : 'Hãy xóa container redis cũ để chứng minh dữ liệu vẫn còn.' };
        },
      },
      {
        id: 'up', title: 'Chạy cả hệ thống bằng docker compose up',
        desc: 'Dùng file <code>compose.yaml</code> có sẵn (web đếm lượt truy cập + redis). Chạy <code>docker compose up -d</code>, rồi <code>curl localhost:5000</code> vài lần để thấy bộ đếm tăng.',
        hint: '<code>docker compose up -d</code> → <code>docker compose ps</code> → <code>curl localhost:5000</code>.',
        check: (e) => {
          const run = e && e.state && e.state.containers.filter((c) => c.labels && c.labels['com.docker.compose.project'] && c.status === 'running').length >= 2;
          const curl = H(e).some((h) => h.kind === 'curl' && h.ok && h.meta.port === 5000);
          return run && curl ? { ok: true } : { ok: false, msg: !run ? 'Chưa có ít nhất 2 service compose đang chạy.' : 'Hãy curl localhost:5000 để kiểm tra.' };
        },
      },
      {
        id: 'down', title: 'Thêm volume vào compose và down mà không mất dữ liệu',
        desc: 'Sửa <code>compose.yaml</code>: gắn volume <code>redis-data:/data</code> cho service redis và khai báo nó ở mục <code>volumes:</code> cấp cao nhất. Chạy lại <code>up -d</code>, rồi <code>docker compose down</code> (không có -v) — volume <code>lab_redis-data</code> phải còn.',
        hint: 'Thêm vào service redis:<pre class="code">    volumes:\n      - redis-data:/data</pre>và cuối file:<pre class="code">volumes:\n  redis-data:</pre>',
        reflect: { q: 'down và down -v khác nhau thế nào?', a: 'docker compose down xóa container và network nhưng giữ volume (dữ liệu an toàn). down -v xóa luôn volume — chỉ dùng khi muốn làm lại từ đầu.' },
        check: (e) => {
          const keep = e && e.state && e.state.volumes.some((v) => v.name === 'lab_redis-data');
          const down = H(e).some((h) => h.kind === 'compose' && h.meta.action === 'down' && h.ok);
          return keep && down ? { ok: true } : { ok: false, msg: !keep ? 'Chưa có volume lab_redis-data (kiểm tra lại compose.yaml rồi up -d).' : 'Hãy chạy docker compose down để kiểm chứng volume vẫn còn.' };
        },
      },
    ],
    quiz: [
      { q: 'Hai container trên network <b>do bạn tạo</b> gọi nhau bằng gì?', options: ['Chỉ bằng IP', 'Bằng tên container (hoặc tên service trong compose) nhờ DNS nội bộ', 'Bằng cổng của host', 'Không gọi được nhau'], answer: 1, explain: 'Network tự tạo có DNS tích hợp; network bridge mặc định thì không.' },
      { q: 'Trong compose, service <code>web</code> kết nối Redis với host nào?', options: ['localhost', 'redis (tên service)', '127.0.0.1', 'IP của máy host'], answer: 1, explain: 'Bên trong container, localhost là chính container đó. Phải dùng tên service.' },
      { q: 'Lệnh nào xóa cả dữ liệu trong volume của project compose?', options: ['docker compose stop', 'docker compose down', 'docker compose down -v', 'docker compose restart'], answer: 2, explain: 'Chỉ có -v mới xóa volume; down thường giữ dữ liệu.' },
      { q: '<code>depends_on</code> đảm bảo điều gì?', options: ['Service phụ thuộc đã sẵn sàng phục vụ', 'Thứ tự khởi động container; không chờ ứng dụng bên trong sẵn sàng (trừ khi dùng healthcheck)', 'Hai service chạy trên cùng máy', 'Chia sẻ biến môi trường'], answer: 1, explain: 'Muốn chờ thật sự sẵn sàng phải kết hợp healthcheck với condition: service_healthy.' },
      { q: 'Khác biệt giữa named volume (<code>-v data:/data</code>) và bind mount (<code>-v ./src:/app</code>)?', options: ['Không khác', 'Named volume do Docker quản lý, hợp cho dữ liệu; bind mount gắn thẳng thư mục máy host, hợp cho phát triển (sửa code thấy ngay)', 'Bind mount nhanh hơn trên mọi hệ điều hành', 'Named volume chỉ đọc'], answer: 1, explain: 'Cơ sở dữ liệu dùng named volume; code đang phát triển dùng bind mount.' },
      { q: 'Compose đặt tên container của service web trong project "lab" là gì?', options: ['web', 'lab-web-1', 'lab_web', 'web-lab'], answer: 1, explain: 'Định dạng &lt;project&gt;-&lt;service&gt;-&lt;số thứ tự&gt;; network là lab_default, volume là lab_&lt;tên&gt;.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Từ một container đến cả hệ thống</h2>
        <p>Ứng dụng web thường cần thêm cơ sở dữ liệu, cache, hàng đợi... Chạy từng thứ bằng <code>docker run</code> dài dòng và dễ sai. Bài này giải quyết 3 câu hỏi: container <b>gọi nhau</b> thế nào, <b>dữ liệu</b> sống ở đâu, và làm sao <b>khởi động tất cả</b> bằng một lệnh.</p>
        <h3>1. Network — container gọi nhau bằng tên</h3>
        <pre class="code"><code>docker network create appnet
docker run -d --name redis --network appnet redis:7
docker run -d --name web --network appnet -p 5000:5000 vlab/counter:1.0
# trong web, Redis có địa chỉ "redis:6379"</code></pre>
        <div class="callout warn"><strong>Bẫy hay gặp:</strong> network <code>bridge</code> mặc định không phân giải tên. Và <code>localhost</code> bên trong container là chính container đó, không phải máy host.</div>
        <h3>2. Volume — dữ liệu bền hơn container</h3>
        <p>Container nên được coi là "dùng xong vứt". Dữ liệu cần giữ đặt vào <b>volume</b>: <code>-v redis-data:/data</code>. Xóa container, chạy container mới gắn lại volume → dữ liệu còn nguyên.</p>
        <ul>
          <li><b>Named volume</b> <code>data:/var/lib/postgresql/data</code> — Docker quản lý, dùng cho dữ liệu.</li>
          <li><b>Bind mount</b> <code>./src:/app</code> — gắn thư mục máy host, dùng khi phát triển.</li>
        </ul>
        <h3>3. Compose — mô tả hệ thống bằng YAML</h3>
        <pre class="code"><code>services:
  web:
    build: .              # hoặc image: vlab/counter:1.0
    ports: ["5000:5000"]
    environment:
      REDIS_HOST: redis
    depends_on: [redis]
  redis:
    image: redis:7
    volumes:
      - redis-data:/data
volumes:
  redis-data:</code></pre>
        <p>Compose tự tạo network <code>&lt;project&gt;_default</code>, đặt tên container <code>&lt;project&gt;-&lt;service&gt;-1</code> và volume <code>&lt;project&gt;_redis-data</code>. Project mặc định là tên thư mục (ở đây: <code>lab</code>).</p>
        <pre class="code"><code>docker compose up -d      # tạo và chạy tất cả
docker compose ps         # trạng thái
docker compose logs -f web
docker compose down       # xóa container + network, giữ volume
docker compose down -v    # xóa cả volume</code></pre>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Lưu nội dung trên vào <code>compose.yaml</code> (thay <code>vlab/counter</code> bằng app của bạn có <code>build: .</code>), chạy <code>docker compose up -d --build</code>. Docker Desktop đã có sẵn Compose v2; lệnh cũ <code>docker-compose</code> (có gạch nối) đã ngừng phát triển.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>yaml: line N: ...</code> — thụt lề sai. YAML dùng dấu cách, không dùng Tab; các khóa cùng cấp phải thẳng cột.</li>
            <li><code>no configuration file provided</code> — không có compose.yaml trong thư mục hiện tại.</li>
            <li>App báo không kết nối được Redis — kiểm tra biến <code>REDIS_HOST</code> có trùng tên service không.</li>
            <li>Mất dữ liệu sau <code>down -v</code> — cờ -v xóa volume.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        title: '🎼 Phòng điều phối',
        files: { 'compose.yaml': COMPOSE },
        editFiles: ['compose.yaml'],
        cvHeight: 320,
        welcome: ['Thư mục ~/lab có sẵn compose.yaml (web đếm lượt truy cập + redis).', 'Làm lần lượt: network → volume → compose. Sơ đồ phía trên vẽ network và volume theo thời gian thực.'],
        chips: ['docker network create appnet', 'docker run -d --name c1 --network appnet alpine sleep 3600', 'docker run -d --name c2 --network appnet alpine sleep 3600', 'docker exec c1 ping -c 1 c2', 'docker volume ls', 'docker compose up -d', 'docker compose ps', 'curl localhost:5000', 'docker compose down'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
