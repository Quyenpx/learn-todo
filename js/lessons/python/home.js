/* Trang tổng quan khóa Python cho AI: lộ trình 15 bài, tiến độ và cách dùng mô phỏng + notebook. */
(function () {
  'use strict';
  App.register({
    id: 'python-home', course: 'python', icon: '🏠', title: 'Lộ trình Python cho AI', navTitle: 'Tổng quan', navSub: '14 bài + dự án tổng kết',
    render(root) {
      const lessons = App.lessonsOf('python').filter((l) => l.id !== 'python-home' && l.kind !== 'resources');
      // Nội dung tĩnh do dự án viết nên dùng template; không có dữ liệu người dùng trong trang này
      root.appendChild(App.h(`<div class="lesson"><section class="card py-hero"><span class="badge">Python cho AI · Từ con số 0</span><h1>Python nền tảng để học ML và DL</h1>
        <p class="lead">Mỗi bài có đoạn mã chạy từng dòng trên trình duyệt (xem dòng đang chạy, biến và đầu ra), bốn nhiệm vụ, sáu câu hỏi và một notebook để chạy Python thật trên máy.</p>
        <p>Mô phỏng viết bằng JavaScript để giải thích cách Python chạy; nó không thay thế Python thật. Sau mỗi bài, tải notebook bài tập, điền các chỗ <code>TODO</code> rồi so với bản lời giải.</p>
        <div class="hero-cta"><a class="btn primary" href="${App.url(lessons[0])}">Bắt đầu học →</a><a class="btn" href="docs/tutorials/python.html">Cài đặt Python và notebook</a><a class="btn" href="${App.url('python-resources')}">Thư viện tài liệu</a></div>
        <p>Tiến độ: ${Math.round(App.overallProgress('python') * 100)}%, lưu trên trình duyệt này.</p></section>
        <section><h2>Lộ trình ${lessons.length} bài</h2><div class="cards">${lessons.map((l, i) => `<a class="lesson-card" href="${App.url(l)}"><span class="ic">${l.icon}</span><h3>${i + 1}. ${l.title}</h3><p>${l.lead}</p><div class="bar"><span style="width:${App.lessonProgress(l) * 100}%"></span></div></a>`).join('')}</div></section></div>`));
    },
  });
})();
