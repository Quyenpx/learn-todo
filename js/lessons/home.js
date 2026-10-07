/* home.js — Trang tổng quan: bức tranh AI/ML/DL, vòng lặp huấn luyện và danh sách bài học */
(function () {
  'use strict';
  App.register({
    id: 'home',
    icon: '🏠',
    title: 'Tổng quan',
    navTitle: 'Tổng quan',
    navSub: 'Bắt đầu từ đây',
    render(root) {
      const lessons = App.lessonsOf('ai').filter((l) => l.id !== 'home' && l.kind !== 'resources');
      const pct = Math.round(App.overallProgress('ai') * 100);
      const el = App.h(`<div class="lesson">
        <section class="hero reveal">
          <div>
            <span class="badge">Học bằng cách nhìn thấy và tự tay thử</span>
            <h1 style="margin-top:14px">Hiểu <span class="grad-text">Machine Learning</span> và <span class="grad-text">Deep Learning</span> qua mô phỏng trực quan</h1>
            <p class="lead">Mỗi bài gồm 4 phần: <b>lý thuyết ngắn gọn</b>, <b>mô phỏng tương tác</b> cho bạn tự chỉnh tham số và quan sát, <b>bài lab</b> có nhiệm vụ được hệ thống tự kiểm tra, và <b>bài trắc nghiệm</b> để xác nhận bạn đã hiểu.</p>
            <div class="hero-cta">
              <a href="${App.url(lessons[0])}" class="btn primary" id="start-btn">${pct > 0 ? 'Tiếp tục học' : 'Bắt đầu bài 1'} →</a>
              <a href="${App.url('final')}" class="btn" id="final-btn">🎓 Bài kiểm tra tổng hợp</a>
            </div>
            <p class="muted" style="margin-top:14px;font-size:14px">Tiến độ của bạn: <b>${pct}%</b>, được lưu tự động trên trình duyệt này.</p>
          </div>
          <div class="circles" aria-label="Quan hệ giữa AI, Machine Learning và Deep Learning">
            <div class="c c1">Trí tuệ nhân tạo (AI)</div>
            <div class="c c2">Machine Learning</div>
            <div class="c c3"><span>Deep Learning<small>mạng nơ-ron nhiều lớp</small></span></div>
          </div>
        </section>

        <section class="card reveal">
          <h2>🔁 Vòng lặp huấn luyện: trái tim của mọi mô hình</h2>
          <p class="muted">Từ đường thẳng đơn giản đến ChatGPT, mọi mô hình đều học bằng cách lặp lại 4 bước dưới đây hàng nghìn đến hàng tỷ lần. Hiểu vòng lặp này là hiểu 80% cách máy học.</p>
          <div class="loop">
            <div class="loop-step"><span class="n">BƯỚC 1</span><h3>Dự đoán</h3><p>Đưa dữ liệu vào mô hình với tham số hiện tại.</p><span class="f">ŷ = f(x; w)</span></div>
            <div class="loop-step"><span class="n">BƯỚC 2</span><h3>Đo sai số</h3><p>So sánh dự đoán với đáp án thật bằng hàm mất mát.</p><span class="f">L = Loss(ŷ, y)</span></div>
            <div class="loop-step"><span class="n">BƯỚC 3</span><h3>Tính gradient</h3><p>Tìm hướng thay đổi tham số làm sai số giảm nhanh nhất.</p><span class="f">∂L/∂w</span></div>
            <div class="loop-step"><span class="n">BƯỚC 4</span><h3>Cập nhật</h3><p>Dịch tham số một bước nhỏ ngược hướng gradient.</p><span class="f">w ← w − lr·∂L/∂w</span></div>
          </div>
        </section>

        <section class="reveal">
          <h2>📚 Lộ trình ${lessons.filter(l => l.id !== 'final').length} bài chuyên môn và kiểm tra tổng hợp</h2>
          <div class="cards">${lessons.map((l, i) => {
            const p = App.lessonProgress(l);
            return `<a class="lesson-card" href="${App.url(l)}" id="card-${l.id}">
              <span class="ic">${l.icon}</span>
              <h3>${l.id === 'final' ? '' : `Bài ${i + 1}. `}${l.navTitle}</h3>
              <p>${l.cardText || ''}</p>
              <div class="meta"><span>${l.navSub || ''}</span><span>${Math.round(p * 100)}% hoàn thành</span></div>
              <div class="bar"><span style="width:${p * 100}%"></span></div>
            </a>`;
          }).join('')}</div>
        </section>

        <section class="card reveal">
          <h2>⚖️ Lập trình truyền thống và Machine Learning khác nhau thế nào?</h2>
          <div class="table-scroll"><table class="compare">
            <thead><tr><th></th><th>Lập trình truyền thống</th><th>Machine Learning</th></tr></thead>
            <tbody>
              <tr><td><b>Đầu vào</b></td><td>Dữ liệu + <b>quy tắc</b> do con người viết</td><td>Dữ liệu + <b>đáp án</b> (nhãn)</td></tr>
              <tr><td><b>Đầu ra</b></td><td>Đáp án</td><td><b>Quy tắc</b>, tức là mô hình</td></tr>
              <tr><td><b>Ví dụ lọc spam</b></td><td><code>if "khuyến mãi" in email: spam</code></td><td>Cho máy xem 10.000 email đã gắn nhãn, máy tự rút ra dấu hiệu của spam</td></tr>
              <tr><td><b>Khi nào phù hợp</b></td><td>Quy tắc rõ ràng, ít thay đổi</td><td>Quy tắc quá phức tạp để viết tay: nhận diện ảnh, giọng nói, ngôn ngữ</td></tr>
            </tbody>
          </table></div>
        </section>

        <section class="card reveal">
          <h2>🧭 Cách học hiệu quả với ứng dụng này</h2>
          <div class="steps-how">
            <div><b>1. Đọc lý thuyết</b>Khung bên trái mỗi bài, chỉ khoảng 3 phút đọc.</div>
            <div><b>2. Chơi với mô phỏng</b>Kéo thanh trượt, bấm chạy, quan sát điều gì thay đổi và tự hỏi "vì sao?".</div>
            <div><b>3. Làm bài lab</b>Mỗi nhiệm vụ yêu cầu bạn tạo ra một hiện tượng cụ thể. Đạt yêu cầu là được tự động đánh dấu.</div>
            <div><b>4. Làm trắc nghiệm</b>Mỗi câu có giải thích. Mục tiêu là đạt điểm tối đa trước khi sang bài mới.</div>
            <div><b>5. Viết lại bằng Python</b>Sau khi hiểu trực quan, viết lại thuật toán bằng NumPy theo tài liệu hướng dẫn.</div>
          </div>
        </section>
      </div>`);
      root.appendChild(el);
    },
  });
})();
