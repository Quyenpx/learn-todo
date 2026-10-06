/* final.js — Bài kiểm tra tổng hợp: bảng tiến độ toàn khóa và câu hỏi vận dụng kết hợp nhiều bài */
(function () {
  'use strict';
  const lesson = {
    id: 'final',
    icon: '🎓',
    title: 'Bài kiểm tra tổng hợp',
    navTitle: 'Kiểm tra tổng hợp',
    navSub: 'Đánh giá toàn khóa',
    group: 'Tổng kết',
    cardText: '10 câu hỏi vận dụng tổng hợp kiến thức của cả khóa, kèm bảng theo dõi tiến độ từng bài và gợi ý bước tiếp theo.',
    quiz: [
      { q: 'Phát biểu nào đúng về quan hệ giữa AI, Machine Learning và Deep Learning?', options: ['Ba lĩnh vực hoàn toàn tách biệt', 'Deep Learning là tập con của Machine Learning, Machine Learning là tập con của AI', 'AI là tập con của Deep Learning', 'Machine Learning là tập con của Deep Learning'], answer: 1, explain: 'AI là lĩnh vực rộng nhất, ML là cách tiếp cận cho máy tự học từ dữ liệu, DL là ML dùng mạng nơ-ron nhiều lớp.' },
      { q: 'Dự đoán giá căn hộ từ diện tích, số phòng và vị trí là bài toán gì?', options: ['Phân cụm (không giám sát)', 'Hồi quy (học có giám sát)', 'Phân loại nhị phân', 'Học tăng cường'], answer: 1, explain: 'Có nhãn (giá) và đầu ra là một số liên tục, nên đây là hồi quy có giám sát như Bài 1.' },
      { q: 'Đoạn code sau làm gì?', code: 'for epoch in range(100):\n    grad = compute_gradient(w)\n    w = w - lr * grad', options: ['Lan truyền xuôi', 'Gradient Descent: cập nhật tham số ngược hướng gradient', 'Phân cụm K-Means', 'Chuẩn hóa dữ liệu'], answer: 1, explain: 'Đây chính là quy tắc cập nhật w ← w − lr·∂L/∂w ở Bài 1.' },
      { q: 'Trong lúc huấn luyện, Loss trên tập train tiếp tục giảm nhưng Loss trên tập validation bắt đầu tăng từ epoch 20. Nên làm gì?', options: ['Tăng learning rate', 'Mô hình đang overfitting, nên dừng sớm (early stopping) ở khoảng epoch 20 hoặc thêm regularization', 'Tiếp tục huấn luyện thêm 1000 epoch', 'Bỏ tập validation'], answer: 1, explain: 'Khoảng cách train và validation tăng dần là dấu hiệu overfitting (Bài 2).' },
      { q: 'Bộ dữ liệu email có 99% thư thường và 1% spam. Một mô hình luôn đoán "thư thường" đạt accuracy bao nhiêu và có tốt không?', options: ['1%, rất tệ', '99%, nhưng vô dụng vì không phát hiện được thư spam nào; nên dùng Recall, Precision hoặc F1', '50%, trung bình', '99%, rất tốt'], answer: 1, explain: 'Với dữ liệu mất cân bằng, accuracy gây hiểu lầm. Recall của lớp spam ở đây bằng 0.' },
      { q: 'Bạn có 10.000 hồ sơ khách hàng không gắn nhãn và muốn chia họ thành các nhóm để làm tiếp thị. Nên dùng phương pháp nào?', options: ['Hồi quy tuyến tính', 'Phân cụm như K-Means', 'Mạng nơ-ron phân loại', 'Không thể làm được'], answer: 1, explain: 'Không có nhãn nên dùng học không giám sát, ví dụ K-Means ở Bài 3.' },
      { q: 'Trong PyTorch, lệnh loss.backward() làm gì?', options: ['Cập nhật trọng số', 'Tính gradient của Loss theo mọi tham số bằng lan truyền ngược', 'Tính dự đoán', 'Đặt gradient về 0'], answer: 1, explain: 'backward() thực hiện backprop (Bài 4). Cập nhật trọng số là việc của optimizer.step().' },
      { q: 'Một mạng 5 lớp dùng sigmoid học rất chậm, gradient ở các lớp đầu gần bằng 0. Nguyên nhân và cách khắc phục là gì?', options: ['Learning rate quá lớn, nên giảm lr', 'Gradient biến mất do sigmoid bão hòa; nên dùng ReLU và khởi tạo trọng số phù hợp', 'Dữ liệu quá nhiều, nên giảm dữ liệu', 'Do không có bias'], answer: 1, explain: 'Đạo hàm sigmoid ≤ 0.25 nên khi nhân qua nhiều lớp, gradient nhỏ dần đến biến mất.' },
      { q: 'Vì sao mạng nơ-ron cần ít nhất một lớp ẩn với hàm kích hoạt phi tuyến để giải bài XOR?', options: ['Để chạy nhanh hơn', 'Vì XOR không tách được bằng một đường thẳng; lớp ẩn phi tuyến tạo được ranh giới cong', 'Vì XOR có quá nhiều dữ liệu', 'Không cần, mô hình tuyến tính cũng giải được'], answer: 1, explain: 'Như bạn đã thấy ở Bài 5: không có lớp ẩn thì ranh giới luôn là đường thẳng.' },
      { q: 'Kiến trúc nào phù hợp nhất cho bài toán nhận diện ảnh, và kiến trúc nào là nền tảng của ChatGPT?', options: ['RNN cho ảnh, CNN cho ChatGPT', 'CNN cho ảnh, Transformer cho ChatGPT', 'K-Means cho ảnh, hồi quy tuyến tính cho ChatGPT', 'MLP cho cả hai'], answer: 1, explain: 'CNN khai thác cấu trúc không gian của ảnh. Transformer với cơ chế Attention là nền tảng của các mô hình ngôn ngữ lớn.' },
    ],
    render(root) {
      const tracked = App.lessonsOf('ai').filter((l) => l.id !== 'home' && l.id !== 'final');
      // Gộp đoạn code (nếu có) vào nội dung câu hỏi để quizUI hiển thị
      lesson.quiz.forEach((q) => { if (q.code && !q._merged) { q.q += `<pre class="code">${q.code}</pre>`; q._merged = true; } });
      const el = App.h(`<section class="lesson">
        <header class="lesson-head reveal">
          <span class="badge">Tổng kết khóa học</span>
          <h1>🎓 Bài kiểm tra tổng hợp</h1>
          <p class="lead">Kiểm tra khả năng vận dụng kiến thức của cả 5 bài vào tình huống thực tế. Đạt từ 8/10 câu là bạn đã sẵn sàng chuyển sang thực hành bằng Python.</p>
        </header>
        <section class="card reveal">
          <h2>📊 Tiến độ từng bài</h2>
          <div class="cards">${tracked.map((l, i) => {
            const done = App.store.labDone(l.id), nDone = l.labs.filter((t) => done[t.id]).length, q = App.store.quiz(l.id);
            return `<a class="lesson-card" href="${App.url(l)}">
              <span class="ic">${l.icon}</span><h3>Bài ${i + 1}. ${l.navTitle}</h3>
              <p>🧪 Lab: <b>${nDone}/${l.labs.length}</b> nhiệm vụ<br>✅ Trắc nghiệm: <b>${q ? `${q.score}/${q.total}` : 'chưa làm'}</b></p>
              <div class="bar"><span style="width:${App.lessonProgress(l) * 100}%"></span></div></a>`;
          }).join('')}</div>
        </section>
        <section class="card reveal">
          <div class="section-head"><h2>📝 10 câu hỏi vận dụng</h2><span class="pill" id="quiz-best-final"></span></div>
          <div class="quiz"></div>
        </section>
        <section class="card reveal">
          <h2>🚀 Bước tiếp theo</h2>
          <div class="steps-how">
            <div><b>1. Viết lại bằng NumPy</b>Tự code Gradient Descent và mạng nơ-ron giải XOR từ đầu, như trong tài liệu hướng dẫn.</div>
            <div><b>2. Dùng scikit-learn</b>Thực hành quy trình chuẩn trên bộ dữ liệu Iris và Titanic (Kaggle).</div>
            <div><b>3. Học PyTorch</b>Huấn luyện mạng nhận diện chữ số MNIST trên Google Colab (miễn phí GPU).</div>
            <div><b>4. Tìm hiểu CNN và Transformer</b>Phân loại ảnh CIFAR-10, sau đó tinh chỉnh (fine-tune) mô hình Hugging Face cho văn bản tiếng Việt.</div>
          </div>
        </section>
      </section>`);
      root.appendChild(el);
      App.quizUI(el.querySelector('.quiz'), lesson);
    },
  };
  App.register(lesson);
})();
