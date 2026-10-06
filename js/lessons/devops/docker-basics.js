/*
 * Bài D1 — Docker cơ bản: image, container, cổng, log, exec và vòng đời container.
 * Mục tiêu: người học tự chạy được web server trong container và hiểu điều gì xảy ra sau mỗi lệnh.
 */
(function () {
  'use strict';
  const hist = (e) => (e && e.state ? e.state.history : []);
  const conts = (e) => (e && e.state ? e.state.containers : []);

  const lesson = {
    id: 'docker-basics',
    course: 'devops',
    group: 'Docker',
    icon: '📦',
    navTitle: 'Docker cơ bản',
    navSub: 'Image, container, cổng',
    badge: 'DevOps · Bài 1',
    title: 'Docker cơ bản: từ image đến container đang chạy',
    lead: 'Bạn sẽ chạy container đầu tiên, mở một web server nginx ra cổng 8080, đọc log, chui vào bên trong container và dọn dẹp đúng cách — tất cả trong terminal ngay bên phải.',
    labs: [
      {
        id: 'hello', title: 'Chạy container đầu tiên',
        desc: 'Gõ <code>docker run hello-world</code>. Quan sát Docker tự tải image (vì máy chưa có), tạo container, chạy rồi container thoát với mã 0.',
        hint: 'Chỉ cần gõ đúng <code>docker run hello-world</code> rồi Enter. Sau đó thử <code>docker ps -a</code> để thấy container đã "Exited (0)".',
        reflect: { q: 'Vì sao container hello-world thoát ngay?', a: 'Container chỉ sống khi tiến trình chính (PID 1) còn chạy. Chương trình hello in thông điệp rồi kết thúc → container dừng với mã thoát 0 (thành công).' },
        check: (e) => (hist(e).some((h) => h.kind === 'run' && h.ok && /hello-world/.test(h.meta.image || '')) ? { ok: true } : { ok: false, msg: 'Chưa thấy lệnh docker run hello-world chạy thành công.' }),
      },
      {
        id: 'web', title: 'Chạy nginx ở chế độ nền và mở cổng 8080',
        desc: 'Chạy container tên <code>web</code> từ image <code>nginx</code>, chạy nền (<code>-d</code>) và ánh xạ cổng <b>8080</b> của máy vào cổng <b>80</b> của container.',
        hint: '<code>docker run -d --name web -p 8080:80 nginx</code> — thứ tự trong -p luôn là <b>cổng máy:cổng container</b>.',
        reflect: { q: 'Nếu bỏ -p 8080:80 thì sao?', a: 'nginx vẫn chạy và lắng nghe cổng 80, nhưng là cổng 80 bên trong network riêng của container. Từ máy host không có đường vào → curl localhost:8080 báo "Connection refused".' },
        check: (e) => (conts(e).some((c) => c.status === 'running' && /nginx/.test(c.image) && c.ports.some((p) => +p.host === 8080 && +p.container === 80)) ? { ok: true } : { ok: false, msg: 'Chưa có container nginx đang chạy với -p 8080:80.' }),
      },
      {
        id: 'curl', title: 'Gửi request và đọc log',
        desc: 'Gọi web server bằng <code>curl localhost:8080</code>, sau đó xem log truy cập bằng <code>docker logs web</code> — bạn sẽ thấy dòng <code>"GET / HTTP/1.1" 200</code> của chính request vừa gửi.',
        hint: 'Gõ lần lượt: <code>curl localhost:8080</code> rồi <code>docker logs web</code>.',
        check: (e) => {
          const h = hist(e);
          const c = h.findIndex((x) => x.kind === 'curl' && x.ok && x.meta.port === 8080);
          return c >= 0 && h.slice(c).some((x) => x.kind === 'logs' && x.ok) ? { ok: true } : { ok: false, msg: c < 0 ? 'Chưa curl thành công tới localhost:8080.' : 'Đã curl, giờ hãy xem docker logs.' };
        },
      },
      {
        id: 'clean', title: 'Vào trong container rồi dọn dẹp',
        desc: 'Mở shell trong container (<code>docker exec -it web bash</code>), thử <code>ls /usr/share/nginx/html</code>, gõ <code>exit</code>. Cuối cùng dừng và xóa container web.',
        hint: '<code>docker exec -it web bash</code> → <code>ls /usr/share/nginx/html</code> → <code>exit</code> → <code>docker stop web</code> → <code>docker rm web</code>. (Hoặc <code>docker rm -f web</code>.)',
        reflect: { q: 'Sửa file trong container rồi xóa container thì file đó còn không?', a: 'Không. Mọi thay đổi nằm ở lớp ghi tạm của container và mất khi container bị xóa. Image gốc không đổi. Muốn giữ dữ liệu phải dùng volume (Bài 3).' },
        check: (e) => {
          const ex = hist(e).some((h) => h.kind === 'exec' && h.ok);
          const rm = e && e.state && e.state.removed.some((x) => /nginx/.test(x.image));
          return ex && rm ? { ok: true } : { ok: false, msg: !ex ? 'Chưa vào được container bằng docker exec.' : 'Container nginx chưa bị xóa.' };
        },
      },
    ],
    quiz: [
      { q: 'Quan hệ đúng giữa image và container là gì?', options: ['Image là container đang chạy', 'Image là khuôn chỉ đọc; container là một thể hiện đang chạy tạo từ khuôn đó', 'Container được dùng để tạo image mỗi lần chạy', 'Hai khái niệm giống nhau'], answer: 1, explain: 'Giống class và object: một image tạo được nhiều container, mỗi container có lớp ghi riêng.' },
      { q: 'Lệnh <code>docker run -p 3000:80 nginx</code> nghĩa là gì?', options: ['Cổng 3000 trong container nối ra cổng 80 của máy', 'Cổng 3000 của máy chuyển vào cổng 80 của container', 'Chạy 3000 container nginx', 'Giới hạn bộ nhớ 3000MB'], answer: 1, explain: 'Cú pháp luôn là -p &lt;cổng host&gt;:&lt;cổng container&gt;. Truy cập localhost:3000 sẽ tới nginx.' },
      { q: 'Container chạy <code>docker run alpine echo hi</code> có trạng thái gì sau đó?', options: ['Running mãi mãi', 'Exited (0) vì lệnh echo đã xong', 'Paused', 'Bị xóa tự động'], answer: 1, explain: 'Container dừng khi tiến trình chính kết thúc. Muốn tự xóa khi dừng phải thêm --rm.' },
      { q: 'Muốn thấy cả container đã dừng thì dùng lệnh nào?', options: ['docker ps', 'docker ps -a', 'docker images', 'docker logs'], answer: 1, explain: 'docker ps chỉ liệt kê container đang chạy; -a (all) hiện cả container đã dừng.' },
      { q: '<code>docker rm web</code> báo lỗi "container is running". Cách xử lý đúng?', options: ['Xóa image nginx trước', 'docker stop web rồi docker rm web, hoặc docker rm -f web', 'Khởi động lại máy', 'docker kill docker'], answer: 1, explain: 'Docker không cho xóa container đang chạy để tránh mất dữ liệu ngoài ý muốn; dừng trước hoặc dùng -f.' },
      { q: 'Vì sao container khởi động nhanh hơn máy ảo nhiều lần?', options: ['Container dùng chung nhân (kernel) của máy host, không phải khởi động hệ điều hành riêng', 'Container không có hệ thống file', 'Container chỉ chạy được ứng dụng nhỏ', 'Do Docker nén dữ liệu'], answer: 0, explain: 'Container là tiến trình được cô lập bằng namespace và cgroup trên cùng kernel → khởi động trong mili giây.' },
    ],
    render(root, ctx) {
      const theory = `
        <h2>Vấn đề Docker giải quyết</h2>
        <p>Ứng dụng chạy tốt trên máy bạn nhưng lỗi trên server vì khác phiên bản Python, thiếu thư viện, khác hệ điều hành. Docker <b>đóng gói ứng dụng cùng toàn bộ môi trường</b> của nó thành một khối chạy giống hệt nhau ở mọi nơi.</p>
        <h3>3 khái niệm cốt lõi</h3>
        <ul>
          <li><b>Image</b> — "khuôn" chỉ đọc: hệ điều hành tối thiểu + runtime + code + cấu hình. Ví dụ <code>nginx:1.27</code>, <code>python:3.12-slim</code>.</li>
          <li><b>Container</b> — một thể hiện đang chạy của image, có lớp ghi riêng, network riêng, tiến trình riêng. Một image → nhiều container.</li>
          <li><b>Registry</b> — kho chứa image (Docker Hub). <code>docker pull</code> tải về, <code>docker push</code> đẩy lên.</li>
        </ul>
        <div class="callout info"><strong>Container ≠ máy ảo.</strong> Máy ảo giả lập cả phần cứng và chạy hệ điều hành riêng (vài GB, khởi động hàng phút). Container chỉ là tiến trình được cô lập trên cùng kernel của host (vài MB, khởi động trong mili giây).</div>
        <h3>Chuyện gì xảy ra khi gõ <code>docker run</code>?</h3>
        <ol>
          <li>Tìm image trong máy; không có thì tự <code>pull</code> từ registry (từng lớp — lớp nào đã có thì "Already exists").</li>
          <li>Tạo container: thêm lớp ghi, cấp IP trong network <code>bridge</code>, ánh xạ cổng nếu có <code>-p</code>.</li>
          <li>Chạy tiến trình chính (CMD của image). Tiến trình kết thúc → container <b>Exited</b>.</li>
        </ol>
        <h3>Các lệnh cần nhớ</h3>
        <pre class="code"><code>docker run -d --name web -p 8080:80 nginx   # chạy nền, đặt tên, mở cổng
docker ps            # container đang chạy (-a: tất cả)
docker logs -f web   # xem log (theo dõi liên tục với -f)
docker exec -it web bash   # mở shell bên trong
docker stop web && docker rm web   # dừng rồi xóa
docker images        # image trong máy
docker rmi nginx     # xóa image</code></pre>
        <p>Các cờ hay dùng của <code>run</code>: <code>-d</code> chạy nền, <code>-it</code> tương tác có terminal, <code>--rm</code> tự xóa khi dừng, <code>-e KEY=val</code> biến môi trường, <code>-v</code> gắn volume.</p>
        <details><summary>🖥 Chạy trên máy thật</summary>
          <p>Cài Docker Desktop, mở terminal và gõ đúng các lệnh trên. Mở trình duyệt vào <code>http://localhost:8080</code> để thấy trang "Welcome to nginx!". Trên Linux có thể cần <code>sudo</code> hoặc thêm user vào nhóm <code>docker</code>.</p>
        </details>
        <details><summary>⚠ Lỗi thường gặp</summary>
          <ul>
            <li><code>port is already allocated</code> — cổng host đã bị container/ứng dụng khác dùng. Đổi sang <code>-p 8081:80</code>.</li>
            <li><code>Conflict. The container name "/web" is already in use</code> — tên trùng, kể cả container đã dừng. Xóa cái cũ hoặc đặt tên khác.</li>
            <li><code>pull access denied</code> — sai tên image hoặc image riêng tư.</li>
            <li>Container vừa chạy đã Exited — xem nguyên nhân bằng <code>docker logs &lt;tên&gt;</code>.</li>
          </ul>
        </details>`;
      const s = App.shell(root, lesson, theory);
      App.dvSetup(s.sim, ctx, lesson, {
        title: '🐳 Máy lab Docker',
        welcome: ['Chào mừng tới máy lab! Đây là terminal mô phỏng Docker 27.', 'Gõ lệnh rồi Enter · Tab để gợi ý · ↑↓ xem lại lệnh cũ · gõ "help" để xem các lệnh hỗ trợ.'],
        chips: ['docker run hello-world', 'docker ps -a', 'docker run -d --name web -p 8080:80 nginx', 'curl localhost:8080', 'docker logs web', 'docker exec -it web bash', 'docker images', 'docker rm -f web'],
      });
      App.labUI(s.lab, lesson, ctx);
      App.quizUI(s.quiz, lesson);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
