/* overfit.js — Bài 2: Overfitting và Underfitting bằng hồi quy đa thức, kèm regularization và thêm dữ liệu */
(function () {
  'use strict';
  const M = window.MLMath;
  const LAMS = [0, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1];
  const MAXDEG = 15;
  const truth = (x) => Math.sin(Math.PI * x * 0.9) * 0.8 + 0.2 * x; // quy luật thật, mô hình không biết

  const THEORY = `
    <h2>📖 Lý thuyết</h2>
    <h3>1. Mục tiêu thật sự: dự đoán tốt dữ liệu MỚI</h3>
    <p>Mô hình được học trên <b>tập huấn luyện</b> (chấm xanh đặc), nhưng giá trị thật của nó nằm ở khả năng dự đoán dữ liệu <b>chưa từng thấy</b>, tức <b>tập kiểm tra</b> (chấm tím rỗng). Khả năng này gọi là <b>tổng quát hóa</b>.</p>
    <h3>2. Mô hình đa thức bậc d</h3>
    <div class="formula">ŷ = w₀ + w₁x + w₂x² + … + w_d·x^d</div>
    <p>Bậc càng cao, đường cong càng uốn lượn được nhiều, tức mô hình càng <b>phức tạp</b>.</p>
    <h3>3. Ba tình huống</h3>
    <ul>
      <li><b>Underfitting (học chưa đủ):</b> bậc 1–2, mô hình quá đơn giản, sai nhiều trên <i>cả</i> tập train và test.</li>
      <li><b>Vừa đủ:</b> bắt được quy luật chính, bỏ qua nhiễu. Lỗi test thấp nhất.</li>
      <li><b>Overfitting (học vẹt):</b> bậc cao, đường cong đi qua gần như mọi điểm train, kể cả nhiễu. Lỗi train rất thấp nhưng lỗi test cao.</li>
    </ul>
    <div class="callout info"><strong>🎓 Ví dụ đời thường:</strong> học sinh học thuộc lòng đáp án đề cương sẽ đạt 10 điểm khi đề thi trùng đề cương (train), nhưng làm bài kém khi gặp đề mới (test). Đó là overfitting.</div>
    <h3>4. Đường cong hình chữ U</h3>
    <p>Biểu đồ ② cho thấy khi bậc tăng: lỗi train <b>luôn giảm</b>, còn lỗi test giảm rồi <b>tăng trở lại</b>. Điểm đáy của đường test là độ phức tạp tốt nhất.</p>
    <h3>5. Cách chữa overfitting</h3>
    <ul>
      <li><b>Thêm dữ liệu:</b> nhiều điểm hơn thì mô hình khó "học thuộc" nhiễu.</li>
      <li><b>Regularization (λ):</b> phạt các hệ số lớn để đường cong mượt hơn.</li>
      <li><b>Giảm độ phức tạp</b> mô hình, hoặc dùng <b>early stopping</b> và <b>dropout</b> trong Deep Learning.</li>
    </ul>
    <div class="formula">Loss = MSE + λ · Σ wᵢ²   <span class="c">// Ridge regularization</span></div>
    <div class="callout warn"><strong>Quy tắc vàng:</strong> không bao giờ chọn mô hình dựa trên lỗi train. Hãy chia dữ liệu thành <b>train / validation / test</b> và chỉ dùng tập test <b>một lần</b> ở cuối.</div>
    <div class="callout tip"><strong>Hãy thử:</strong> nhấp vào biểu đồ ① để thêm điểm train ở chỗ lạ và xem mô hình bậc 15 phản ứng thế nào so với bậc 3.</div>`;

  const lesson = {
    id: 'overfit',
    icon: '🎯',
    title: 'Overfitting và Underfitting',
    navTitle: 'Overfitting',
    navSub: 'Tổng quát hóa',
    group: 'Machine Learning',
    badge: 'Bài 2 · Machine Learning · Đánh giá mô hình',
    lead: 'Một mô hình đạt điểm tuyệt đối trên dữ liệu huấn luyện chưa chắc đã tốt. Kéo thanh “bậc đa thức” để thấy ranh giới giữa học chưa đủ, vừa đủ và học vẹt.',
    cardText: 'Vấn đề quan trọng nhất trong thực tế. Thấy tận mắt đường cong chữ U và hai cách chữa: thêm dữ liệu và regularization.',
    labs: [
      {
        id: 'sweet', title: 'Tìm độ phức tạp tốt nhất',
        desc: 'Với λ = 0, kéo thanh <b>Bậc đa thức</b> đến giá trị cho <b>lỗi test thấp nhất</b> (đáy chữ U trên biểu đồ ②).',
        hint: 'Quan sát đường tím trên biểu đồ ②. Điểm thấp nhất thường nằm ở bậc 3 đến 6.',
        check: (s) => ({ ok: !!s.degreeTouched && s.lam === 0 && s.testErr <= s.bestTest0 * 1.05 + 1e-9, msg: !s.degreeTouched ? 'Hãy tự kéo thanh Bậc đa thức để khám phá trước.' : s.lam !== 0 ? 'Hãy đặt λ = 0.' : `Lỗi test hiện tại ${App.fmt(s.testErr, 4)}, tốt nhất có thể là ${App.fmt(s.bestTest0, 4)}.` }),
      },
      {
        id: 'overfit', title: 'Tạo ra hiện tượng overfitting',
        desc: 'Chọn bậc ≥ 9 sao cho <b>lỗi train nhỏ hơn 30% lỗi test</b>. Quan sát đường cong uốn lượn giữa các điểm.',
        check: (s) => ({ ok: s.degree >= 9 && s.trainErr < s.testErr * 0.3, msg: `Bậc ${s.degree}: train ${App.fmt(s.trainErr, 4)}, test ${App.fmt(s.testErr, 4)}.` }),
        reflect: { q: 'Vì sao lỗi train rất thấp mà lỗi test lại cao?', a: 'Mô hình có đủ “độ tự do” để đi qua từng điểm train, kể cả phần nhiễu ngẫu nhiên. Nhiễu không lặp lại ở dữ liệu mới nên những chỗ uốn lượn đó trở thành sai số trên tập test.' },
      },
      {
        id: 'reg', title: 'Chữa overfitting bằng regularization',
        desc: 'Giữ bậc ≥ 12, tăng <b>λ</b> đến khi lỗi test giảm xuống gần mức tốt nhất (không quá 130% mức tốt nhất).',
        hint: 'Thử λ trong khoảng 0.0001 đến 0.01. λ quá lớn sẽ làm mô hình quá phẳng, dẫn tới underfitting.',
        check: (s) => ({ ok: s.degree >= 12 && s.lam > 0 && s.testErr <= s.bestTest0 * 1.3, msg: s.degree < 12 ? 'Hãy đặt bậc ≥ 12.' : `Lỗi test ${App.fmt(s.testErr, 4)}, mục tiêu ≤ ${App.fmt(s.bestTest0 * 1.3, 4)}.` }),
        reflect: { q: 'Regularization hoạt động thế nào?', a: 'Hàm mất mát được cộng thêm λ·Σw². Muốn khớp từng điểm nhiễu, mô hình cần hệ số rất lớn, nhưng giờ hệ số lớn bị phạt. Mô hình buộc phải chọn đường cong mượt hơn, gần quy luật thật hơn.' },
      },
      {
        id: 'data', title: 'Chữa overfitting bằng thêm dữ liệu',
        desc: 'Giữ bậc ≥ 12 và λ = 0, tăng <b>số điểm train</b> lên ≥ 35. Lỗi test phải giảm còn dưới một nửa so với khi chỉ có 15 điểm.',
        check: (s) => ({ ok: s.degree >= 12 && s.lam === 0 && s.nTrain >= 35 && s.testErr < 0.5 * s.errWith15, msg: `Bậc ${s.degree}, λ = ${s.lam}, ${s.nTrain} điểm: lỗi test ${App.fmt(s.testErr, 4)} (khi có 15 điểm: ${App.fmt(s.errWith15, 4)}).` }),
        reflect: { q: 'Vì sao thêm dữ liệu giúp giảm overfitting?', a: 'Với nhiều điểm, nhiễu ở các điểm gần nhau có xu hướng triệt tiêu lẫn nhau. Mô hình không thể đi qua tất cả nên buộc phải bám theo xu hướng chung. Đây là lý do các mô hình lớn như GPT cần lượng dữ liệu khổng lồ.' },
      },
    ],
    quiz: [
      { q: 'Overfitting là hiện tượng gì?', options: ['Mô hình quá đơn giản, không học được quy luật', 'Mô hình học thuộc dữ liệu huấn luyện, kể cả nhiễu, nên dự đoán kém trên dữ liệu mới', 'Mô hình huấn luyện quá chậm', 'Dữ liệu có quá nhiều đặc trưng'], answer: 1, explain: 'Overfitting = học vẹt: tốt trên dữ liệu đã thấy, kém trên dữ liệu mới.' },
      { q: 'Dấu hiệu nào cho thấy mô hình đang overfitting?', options: ['Lỗi train cao, lỗi test cao', 'Lỗi train thấp, lỗi test thấp', 'Lỗi train thấp, lỗi test cao', 'Lỗi train cao, lỗi test thấp'], answer: 2, explain: 'Khoảng cách lớn giữa lỗi train (thấp) và lỗi test (cao) là dấu hiệu kinh điển.' },
      { q: 'Mô hình bậc 1 cho lỗi train = 0.30 và lỗi test = 0.32 trên dữ liệu có dạng sóng. Đây là gì?', options: ['Overfitting', 'Underfitting', 'Mô hình hoàn hảo', 'Lỗi dữ liệu'], answer: 1, explain: 'Cả hai lỗi đều cao và gần nhau: mô hình quá đơn giản để bắt được quy luật, tức underfitting.' },
      { q: 'Cách nào KHÔNG giúp giảm overfitting?', options: ['Thu thập thêm dữ liệu', 'Thêm regularization', 'Tăng độ phức tạp của mô hình', 'Dùng early stopping'], answer: 2, explain: 'Tăng độ phức tạp còn làm overfitting nặng hơn. Ba cách còn lại đều là kỹ thuật chống overfitting phổ biến.' },
      { q: 'Vì sao phải đánh giá mô hình trên tập test riêng biệt?', options: ['Để huấn luyện nhanh hơn', 'Để đo khả năng tổng quát hóa trên dữ liệu mô hình chưa từng thấy', 'Vì tập train quá nhỏ', 'Để tăng độ chính xác trên tập train'], answer: 1, explain: 'Lỗi trên tập train luôn lạc quan. Chỉ dữ liệu chưa thấy mới phản ánh hiệu năng thật khi triển khai.' },
    ],
    render,
  };

  function render(root, ctx) {
    const shell = App.shell(root, lesson, THEORY);
    const s = (lesson.state = { degree: 3, lam: 0, nTrain: 15, noise: 0.2, seed: 3, pool: [], extra: [], test: [], showTest: true, showTrue: true, coefs: [], trainErr: 0, testErr: 0, bestTest0: 0, errWith15: 0, curve: [] });

    const sim = shell.sim;
    sim.appendChild(App.h(`<div class="section-head"><h2>🎮 Mô phỏng</h2><span class="status-chip" id="of-status">–</span></div>`));
    const grid = App.h('<div class="sim-grid"></div>');
    sim.appendChild(grid);
    const p1 = App.h('<div class="panel"><div class="panel-title">① Dữ liệu và mô hình đa thức <small id="of-eq"></small></div></div>');
    const p2 = App.h('<div class="panel"><div class="panel-title">② Lỗi theo độ phức tạp <small>trục log</small></div></div>');
    grid.append(p1, p2);
    const cvFit = ctx.canvas(p1, { aspect: 1.2, clickable: true, hint: 'Nhấp để thêm điểm train' });
    p1.appendChild(App.h(`<div class="legend"><span><i style="background:#22d3ee"></i>Train</span><span><i style="border:2px solid #a78bfa"></i>Test</span><span><i class="line" style="background:#fb923c"></i>Mô hình</span><span><i class="line" style="background:rgba(52,211,153,.8)"></i>Quy luật thật</span></div>`));
    const cvErr = ctx.canvas(p2, { aspect: 1.2 });
    p2.appendChild(App.h(`<div class="legend"><span><i class="line" style="background:#22d3ee"></i>Lỗi train</span><span><i class="line" style="background:#a78bfa"></i>Lỗi test</span><span><i class="line" style="background:rgba(255,255,255,.4)"></i>Bậc hiện tại</span></div>`));

    const toolbar = App.h(`<div class="toolbar">
      <button class="btn" id="of-data">🎲 Dữ liệu mới</button>
      <button class="btn ghost" id="of-clear">✖ Xóa điểm đã thêm</button>
      <label class="check"><input type="checkbox" id="of-test" checked> Hiện tập test</label>
      <label class="check"><input type="checkbox" id="of-true" checked> Hiện quy luật thật</label>
    </div>`);
    sim.appendChild(toolbar);
    const controls = App.h('<div class="controls"></div>');
    controls.append(
      App.slider({ id: 'of-degree', label: 'Bậc đa thức (độ phức tạp)', min: 1, max: MAXDEG, step: 1, value: s.degree, onInput: (v) => { s.degree = v; s.degreeTouched = true; update(); } }),
      App.slider({ id: 'of-lam', label: 'Regularization λ', values: LAMS, value: 0, format: (v) => (v === 0 ? '0 (tắt)' : v.toExponential(0)), onInput: (v) => { s.lam = v; update(); } }),
      App.slider({ id: 'of-n', label: 'Số điểm train', min: 6, max: 40, step: 1, value: s.nTrain, onInput: (v) => { s.nTrain = v; update(); } }),
      App.slider({ id: 'of-noise', label: 'Độ nhiễu', min: 0.05, max: 0.5, step: 0.05, value: s.noise, format: (v) => v.toFixed(2), onInput: (v) => { s.noise = v; gen(); update(); } }),
    );
    sim.appendChild(controls);
    const stats = App.stats(sim, [
      { key: 'train', id: 'of-s-train', label: 'Lỗi train (MSE)' },
      { key: 'test', id: 'of-s-test', label: 'Lỗi test (MSE)' },
      { key: 'gap', id: 'of-s-gap', label: 'Test ÷ Train' },
      { key: 'best', id: 'of-s-best', label: 'Bậc tốt nhất' },
      { key: 'maxw', id: 'of-s-maxw', label: 'Hệ số lớn nhất |w|' },
    ]);

    toolbar.querySelector('#of-data').addEventListener('click', () => { s.seed++; s.extra = []; gen(); update(); });
    toolbar.querySelector('#of-clear').addEventListener('click', () => { s.extra = []; update(); });
    toolbar.querySelector('#of-test').addEventListener('change', (e) => { s.showTest = e.target.checked; draw(); });
    toolbar.querySelector('#of-true').addEventListener('change', (e) => { s.showTrue = e.target.checked; draw(); });
    cvFit.canvas.addEventListener('click', (e) => {
      const p = cvFit.pointer(e), v = fitView();
      const x = v.ix(p.x), y = v.iy(p.y);
      if (Math.abs(x) > 1 || Math.abs(y) > 1.9) return;
      s.extra.push([x, y]);
      update();
    });

    function gen() {
      const r = M.mulberry32(s.seed * 104729);
      // Tạo sẵn 40 điểm; thanh trượt chỉ lấy n điểm đầu nên tăng n là "thêm dữ liệu" chứ không đổi dữ liệu cũ
      s.pool = Array.from({ length: 40 }, () => { const x = r() * 2 - 1; return [x, truth(x) + M.gaussian(r) * s.noise]; });
      s.test = Array.from({ length: 120 }, () => { const x = r() * 2 - 1; return [x, truth(x) + M.gaussian(r) * s.noise]; });
    }
    const trainSet = (n = s.nTrain) => s.pool.slice(0, n).concat(s.extra);
    function fitErr(train, deg, lam) {
      const c = M.polyFit(train.map((p) => p[0]), train.map((p) => p[1]), deg, lam);
      const e = (set) => M.mse(set.map((p) => M.polyEval(c, p[0])), set.map((p) => p[1]));
      return { c, train: e(train), test: e(s.test) };
    }

    function update() {
      const tr = trainSet();
      const cur = fitErr(tr, s.degree, s.lam);
      s.coefs = cur.c; s.trainErr = cur.train; s.testErr = cur.test;
      s.curve = []; let curve0Best = Infinity;
      for (let d = 1; d <= MAXDEG; d++) {
        const r = fitErr(tr, d, s.lam);
        s.curve.push({ d, train: r.train, test: r.test });
        curve0Best = Math.min(curve0Best, s.lam === 0 ? r.test : fitErr(tr, d, 0).test);
      }
      s.bestTest0 = curve0Best;
      s.errWith15 = fitErr(s.pool.slice(0, 15).concat(s.extra), s.degree, s.lam).test;
      draw();
    }

    const fitView = () => App.view(cvFit, { xmin: -1.05, xmax: 1.05, ymin: -1.9, ymax: 1.9, pad: { l: 36, r: 10, t: 10, b: 28 } });

    function draw() {
      if (!cvFit.w) return;
      const c = cvFit.ctx, v = fitView();
      c.clearRect(0, 0, cvFit.w, cvFit.h);
      App.drawAxes(cvFit, v, { xlabel: 'x', ylabel: 'y' });
      c.save(); c.beginPath(); c.rect(v.pad.l, v.pad.t, cvFit.w - v.pad.l - v.pad.r, cvFit.h - v.pad.t - v.pad.b); c.clip();
      const curve = (fn, color, width, dash) => {
        c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.beginPath();
        for (let i = 0; i <= 300; i++) { const x = -1.05 + (2.1 * i) / 300; const y = Math.max(-5, Math.min(5, fn(x))); i ? c.lineTo(v.sx(x), v.sy(y)) : c.moveTo(v.sx(x), v.sy(y)); }
        c.stroke(); c.setLineDash([]);
      };
      if (s.showTrue) curve(truth, 'rgba(52,211,153,0.75)', 1.8, [6, 6]);
      if (s.showTest) s.test.forEach((p) => App.dot(c, v.sx(p[0]), v.sy(p[1]), 3.2, null, 'rgba(167,139,250,0.75)'));
      c.shadowColor = '#fb923c'; c.shadowBlur = 12;
      curve((x) => M.polyEval(s.coefs, x), '#fb923c', 3);
      c.shadowBlur = 0;
      trainSet().forEach((p, i) => App.dot(c, v.sx(p[0]), v.sy(p[1]), 5, i >= s.nTrain ? '#fde047' : '#22d3ee', 'rgba(8,13,28,0.9)'));
      c.restore();

      const clip = (e) => Math.min(e, 50);
      App.lineChart(cvErr, [
        { data: s.curve.map((r) => [r.d, clip(r.train)]), color: '#22d3ee', dots: true },
        { data: s.curve.map((r) => [r.d, clip(r.test)]), color: '#a78bfa', dots: true },
      ], { logY: true, xmin: 1, xmax: MAXDEG, xlabel: 'bậc đa thức', vline: s.degree, hlines: [{ y: s.noise * s.noise, label: 'mức nhiễu (không thể thấp hơn)', color: 'rgba(52,211,153,0.6)' }] });

      // Trạng thái: so sánh lỗi hiện tại với lỗi tốt nhất có thể và khoảng cách train/test
      const bestCurve = s.curve.reduce((a, b) => (b.test < a.test ? b : a));
      const chip = document.getElementById('of-status');
      if (s.testErr <= bestCurve.test * 1.3) { chip.className = 'status-chip good'; chip.textContent = '✓ Vừa đủ: tổng quát hóa tốt'; }
      else if (s.trainErr < s.testErr * 0.5) { chip.className = 'status-chip bad'; chip.textContent = '⚠ Overfitting: học vẹt'; }
      else { chip.className = 'status-chip warn'; chip.textContent = '⚠ Underfitting: học chưa đủ'; }
      document.getElementById('of-eq').textContent = `bậc ${s.degree}, ${s.coefs.length} tham số, ${trainSet().length} điểm`;
      stats.set('train', App.fmt(s.trainErr, 4), s.trainErr < s.testErr * 0.5 ? 'good' : '');
      stats.set('test', App.fmt(s.testErr, 4), s.testErr <= bestCurve.test * 1.3 ? 'good' : 'bad');
      stats.set('gap', App.fmt(s.testErr / Math.max(s.trainErr, 1e-9), 1) + '×', s.testErr / Math.max(s.trainErr, 1e-9) > 3 ? 'bad' : '');
      stats.set('best', String(bestCurve.d));
      const maxw = Math.max(...s.coefs.map(Math.abs));
      stats.set('maxw', App.fmt(maxw, 1), maxw > 50 ? 'bad' : '');
    }
    cvFit.onResize = draw;
    cvErr.onResize = draw;

    gen();
    update();
    App.labUI(shell.lab, lesson, ctx);
    App.quizUI(shell.quiz, lesson);
  }

  App.register(lesson);
})();
