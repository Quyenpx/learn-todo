/*
 * Trang chủ khóa DevOps: giới thiệu hành trình Code → Image → Container → Compose → Kubernetes,
 * lộ trình theo các bài đã đăng ký và hướng dẫn cài môi trường thật.
 */
(function () {
  'use strict';
  // Lộ trình đầy đủ; bài nào đã có file sẽ tự trở thành liên kết
  const ROADMAP = [
    { id: 'docker-basics', icon: '📦', title: 'Docker cơ bản', text: 'Image, container, cổng, log, exec — chạy web server đầu tiên trong 1 lệnh.' },
    { id: 'dockerfile', icon: '🧱', title: 'Dockerfile & build', text: 'Tự đóng gói app Python, hiểu cache theo lớp, thu nhỏ image từ 1.2GB xuống 150MB.' },
    { id: 'docker-compose', icon: '🎼', title: 'Compose, volume, network', text: 'Ghép web + Redis thành hệ thống, giữ dữ liệu bằng volume, gọi nhau bằng tên.' },
    { id: 'k8s-basics', icon: '☸️', title: 'Kubernetes & Pod', text: 'Cluster, node, Pod, kubectl — vì sao cần bộ điều phối container.', group: 'Kubernetes' },
    { id: 'k8s-deploy', icon: '🔁', title: 'Deployment & Service', text: 'Tự phục hồi, rolling update, cân bằng tải giữa các Pod.' },
    { id: 'k8s-config', icon: '🔐', title: 'ConfigMap, Secret, Probe', text: 'Tách cấu hình khỏi image, kiểm tra sức khỏe ứng dụng.' },
    { id: 'k8s-ingress', icon: '🌐', title: 'Ingress & tự co giãn', text: 'Định tuyến theo domain, HPA tăng giảm số Pod theo tải.' },
    { id: 'k8s-stateful', icon: '🗄️', title: 'StatefulSet & lưu trữ', text: 'PersistentVolume, chạy cơ sở dữ liệu trên Kubernetes.' },
    { id: 'k8s-helm', icon: '⛵', title: 'Helm & RBAC', text: 'Đóng gói ứng dụng thành chart, phân quyền truy cập cluster.' },
    { id: 'k8s-ml', icon: '🤖', title: 'Đưa model ML lên K8s', text: 'Đóng gói model, phục vụ API dự đoán và co giãn theo lưu lượng.' },
    { id: 'devops-cicd', icon: '◈', title: 'CI/CD và rollback', text: 'Gate kiểm thử, phê duyệt và khôi phục phiên bản; phân biệt GitOps.' },
    { id: 'devops-observability', icon: '◈', title: 'Quan sát và xử lý sự cố', text: 'Tỷ lệ lỗi, độ trễ, tài nguyên và quy trình xác nhận khắc phục.' },
    { id: 'devops-final', icon: '🎓', title: 'Dự án tổng kết', text: 'Tự triển khai hệ thống hoàn chỉnh từ code đến cluster.' },
  ];
  // Menu đọc danh sách này mỗi lần vẽ lại: bài chưa có file hiển thị dạng "Sắp ra mắt"
  Object.defineProperty(App.courses.devops, 'upcoming', {
    get: () => ROADMAP.filter((r) => !App.lessons.some((l) => l.id === r.id)).map((r) => ({ icon: r.icon, title: r.title, group: r.id.startsWith('k8s') || r.id === 'devops-final' ? 'Kubernetes' : '' })),
  });

  const lesson = {
    id: 'devops-home',
    course: 'devops',
    icon: '🏠',
    navTitle: 'Tổng quan',
    navSub: 'Lộ trình Docker → K8s',
    render(root, ctx) {
      const has = (id) => App.lessons.some((l) => l.id === id);
      const roadmap = App.lessonsOf('devops').filter(l => l.id !== 'devops-home' && l.kind !== 'resources').map(l => ({id:l.id,icon:l.icon,title:l.navTitle,text:l.cardText || (ROADMAP.find(r => r.id === l.id) || {}).text || ''}));
      const pct = Math.round(App.overallProgress('devops') * 100);
      const first = roadmap.find((r) => has(r.id));
      const el = App.h(`<div class="lesson">
        <section class="hero reveal">
          <div>
            <span class="badge">Thực hành ngay trên trình duyệt — không cần cài gì</span>
            <h1 style="margin-top:14px">Làm chủ <span class="grad-text">Docker</span> và <span class="grad-text">Kubernetes</span> bằng terminal thật sự gõ được</h1>
            <p class="lead">Học qua <b>lý thuyết ngắn</b>, <b>terminal giả lập</b> hoặc phép tính quy trình, <b>lab tự chấm</b> và thực hành trên máy thật. Mô phỏng chỉ hỗ trợ phạm vi được ghi trong từng bài.</p>
            <div class="hero-cta">
              <a href="${first ? App.url(first.id) : '#/'}" class="btn primary" id="dv-start-btn">${pct > 0 ? 'Tiếp tục học' : 'Bắt đầu bài 1'} →</a>
              <a href="#dv-setup" class="btn" id="dv-setup-btn">🛠 Chuẩn bị máy thật</a>
            </div>
            <p class="muted" style="margin-top:14px;font-size:14px">Tiến độ khóa DevOps: <b>${pct}%</b> — lưu tự động trên trình duyệt này.</p>
          </div>
          <div class="ship" aria-label="Minh họa cluster gồm nhiều node chạy container"></div>
        </section>

        <section class="card reveal">
          <h2>🚢 Hành trình của một ứng dụng</h2>
          <p class="muted">"Máy tôi chạy được mà!" — Docker sinh ra để chấm dứt câu này. Bạn sẽ đi qua đúng 5 chặng mà ứng dụng thật đi từ máy lập trình viên tới hàng nghìn người dùng.</p>
          <div class="journey">
            <div><b>📝</b><span>Code</span><small>app.py, package.json</small></div>
            <div><b>🧱</b><span>Image</span><small>Dockerfile → docker build</small></div>
            <div><b>📦</b><span>Container</span><small>docker run</small></div>
            <div><b>🎼</b><span>Compose</span><small>nhiều dịch vụ trên 1 máy</small></div>
            <div><b>☸️</b><span>Kubernetes</span><small>nhiều máy, tự phục hồi</small></div>
          </div>
        </section>

        <section class="reveal">
          <h2>📚 Lộ trình ${roadmap.filter(r => r.id !== 'devops-final').length} bài chuyên môn + dự án tổng kết</h2>
          <div class="cards">${roadmap.map((r, i) => {
        const l = App.lessons.find((x) => x.id === r.id);
        if (!l) return `<div class="lesson-card soon"><span class="ic">${r.icon}</span><h3>${r.id === 'devops-final' ? '' : `Bài ${i + 1}. `}${r.title}</h3><p>${r.text}</p><span class="tag-soon">⏳ Sắp ra mắt</span></div>`;
        const p = App.lessonProgress(l);
        return `<a class="lesson-card" href="${App.url(l)}" id="dv-card-${l.id}"><span class="ic">${r.icon}</span><h3>${r.id === 'devops-final' ? '' : `Bài ${i + 1}. `}${r.title}</h3><p>${r.text}</p>
              <div class="meta"><span>${l.labs.length} lab · ${l.quiz.length} câu hỏi</span><span>${Math.round(p * 100)}%</span></div><div class="bar"><span style="width:${p * 100}%"></span></div></a>`;
      }).join('')}</div>
        </section>

        <section class="card reveal" id="dv-setup">
          <h2>🛠 Chuẩn bị môi trường thật (khi bạn sẵn sàng)</h2>
          <p class="muted">Phần mô phỏng làm được trên trình duyệt. Thực hành trên máy thật cần các công cụ sau và tài liệu bổ sung; hỗ trợ lệnh/cờ có thể khác mô phỏng.</p>
          <div class="steps-how">
            <div><b>1. Docker Desktop</b>Windows/macOS: tải tại docker.com, bật WSL 2 trên Windows. Linux: <code>curl -fsSL https://get.docker.com | sh</code></div>
            <div><b>2. Kiểm tra</b><code>docker version</code> rồi <code>docker run hello-world</code> — thấy "Hello from Docker!" là xong.</div>
            <div><b>3. Kubernetes cục bộ</b>Bật Kubernetes trong Docker Desktop, hoặc cài <code>kind</code> / <code>minikube</code> và <code>kubectl</code>.</div>
            <div><b>4. Trình soạn thảo</b>VS Code + tiện ích Docker và Kubernetes để gợi ý cú pháp Dockerfile, YAML.</div>
          </div>
          <div class="callout warn" style="margin-top:16px"><strong>Lưu ý:</strong> môi trường mô phỏng tái hiện hành vi và thông báo lỗi của Docker 27 / Kubernetes 1.31 cho các lệnh phổ biến, nhưng không chạy mã thật. Kích thước image là ước lượng gần đúng.</div>
        </section>
      </div>`);
      root.appendChild(el);

      // Hoạt cảnh minh họa: 3 node, container lần lượt được xếp lên và nhấp nháy
      const cv = ctx.canvas(el.querySelector('.ship'), { aspect: 1 });
      const boxes = [];
      for (let n = 0; n < 3; n++) for (let k = 0; k < 4; k++) boxes.push({ n, k, delay: (n * 4 + k) * 380 + Math.random() * 300 });
      const colors = ['#2496ed', '#22d3ee', '#2dd4bf', '#38bdf8'];
      let t = 0;
      ctx.loop((dt) => {
        t += dt;
        const { ctx: c, w, h } = cv;
        if (!w) return;
        c.clearRect(0, 0, w, h);
        const nw = w * 0.27, gap = w * 0.045, x0 = (w - 3 * nw - 2 * gap) / 2, base = h * 0.8;
        for (let n = 0; n < 3; n++) {
          const x = x0 + n * (nw + gap);
          App.rrect(c, x, base, nw, h * 0.08, 8, 'rgba(255,255,255,0.05)', 'rgba(45,212,191,0.4)');
          c.fillStyle = '#94a3b8'; c.font = `600 ${Math.max(10, w * 0.03)}px "JetBrains Mono"`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(`node-${n + 1}`, x + nw / 2, base + h * 0.04);
        }
        const cycle = t % 9000;
        boxes.forEach((b, i) => {
          const p = Math.min(1, Math.max(0, (cycle - b.delay) / 500));
          if (p <= 0) return;
          const ease = 1 - Math.pow(1 - p, 3);
          const x = x0 + b.n * (nw + gap) + nw * 0.1, bh = h * 0.13, y = base - (b.k + 1) * (bh + h * 0.015);
          const yy = y - (1 - ease) * h * 0.35;
          c.globalAlpha = cycle > 8200 ? Math.max(0, 1 - (cycle - 8200) / 800) : ease;
          App.rrect(c, x, yy, nw * 0.8, bh, 8, colors[i % 4] + '33', colors[i % 4]);
          for (let s = 1; s < 4; s++) { c.strokeStyle = colors[i % 4] + '66'; c.beginPath(); c.moveTo(x + (nw * 0.8 * s) / 4, yy + 5); c.lineTo(x + (nw * 0.8 * s) / 4, yy + bh - 5); c.stroke(); }
          App.dot(c, x + nw * 0.8 - 10, yy + 10, 3 + Math.sin(t / 250 + i) * 1, '#34d399');
          c.globalAlpha = 1;
        });
        c.fillStyle = 'rgba(203,213,225,0.9)'; c.font = `700 ${Math.max(11, w * 0.034)}px "Be Vietnam Pro"`; c.textAlign = 'center';
        c.fillText('cluster: 3 node · 12 container', w / 2, h * 0.08);
      });
      document.getElementById('dv-setup-btn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('dv-setup').scrollIntoView({ behavior: 'smooth' }); });
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = lesson;
  else { (window.DevOpsLessons = window.DevOpsLessons || {})[lesson.id] = lesson; App.register(lesson); }
})();
