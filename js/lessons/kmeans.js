/* kmeans.js — Bài 3: Học không giám sát với K-Means, chạy từng nửa bước (gán điểm / cập nhật tâm) và phương pháp khuỷu tay */
(function () {
  'use strict';
  const M = window.MLMath;
  const GRAY = '#94a3b8';

  const THEORY = `
    <h2>📖 Lý thuyết</h2>
    <h3>1. Học không giám sát</h3>
    <p>Ở hai bài trước, dữ liệu luôn có <b>đáp án</b> (giá nhà). Nhưng nhiều khi ta chỉ có dữ liệu mà không có nhãn, ví dụ lịch sử mua hàng của khách. Học không giám sát giúp <b>tự tìm ra cấu trúc</b>, chẳng hạn chia khách hàng thành các nhóm có hành vi giống nhau.</p>
    <h3>2. Thuật toán K-Means</h3>
    <ol>
      <li><b>Khởi tạo:</b> chọn ngẫu nhiên k điểm làm tâm cụm.</li>
      <li><b>Gán điểm:</b> mỗi điểm thuộc về tâm <b>gần nhất</b>.</li>
      <li><b>Cập nhật tâm:</b> dời mỗi tâm về <b>trung bình</b> các điểm thuộc cụm đó.</li>
      <li>Lặp lại bước 2 và 3 đến khi tâm không di chuyển nữa (hội tụ).</li>
    </ol>
    <div class="formula">gán:     cụm(i) = argmin_j ‖xᵢ − μⱼ‖²
cập nhật: μⱼ = trung bình các xᵢ thuộc cụm j</div>
    <h3>3. Đo chất lượng: Inertia</h3>
    <div class="formula">Inertia = Σ ‖xᵢ − μ_cụm(i)‖²</div>
    <p>Tổng bình phương khoảng cách từ mỗi điểm đến tâm cụm của nó. Càng nhỏ thì các cụm càng chặt.</p>
    <h3>4. Chọn k bằng phương pháp khuỷu tay</h3>
    <p>Inertia <b>luôn giảm</b> khi k tăng (k = số điểm thì inertia = 0), nên không thể chọn k có inertia nhỏ nhất. Thay vào đó, ta tìm điểm mà đường cong <b>gãy gập như khuỷu tay</b>: sau điểm đó, thêm cụm không còn giảm inertia đáng kể.</p>
    <div class="callout warn"><strong>Điểm yếu:</strong> kết quả phụ thuộc vào khởi tạo. Một khởi tạo tệ có thể khiến thuật toán kẹt ở nghiệm kém (cực tiểu cục bộ). Cách khắc phục: chạy nhiều lần và lấy kết quả tốt nhất, hoặc dùng <b>k-means++</b> để chọn tâm ban đầu cách xa nhau.</div>
    <div class="callout info"><strong>🔗 Liên hệ:</strong> K-Means cũng là một bài toán tối ưu: mỗi bước đều làm inertia giảm hoặc giữ nguyên, giống tinh thần "giảm Loss" của Gradient Descent.</div>
    <h3>5. Code Python</h3>
    <pre class="code">from sklearn.cluster import KMeans
km = KMeans(n_clusters=4, n_init=10)
labels = km.fit_predict(X)
print(km.inertia_)</pre>`;

  const lesson = {
    id: 'kmeans',
    icon: '🧩',
    title: 'K-Means: tự tìm nhóm trong dữ liệu',
    navTitle: 'K-Means',
    navSub: 'Học không giám sát',
    group: 'Machine Learning',
    badge: 'Bài 3 · Machine Learning · Học không giám sát',
    lead: 'Không có đáp án, máy vẫn có thể tự phát hiện các nhóm. Theo dõi từng bước “gán điểm” và “cập nhật tâm” cho đến khi các cụm ổn định.',
    cardText: 'Phân cụm không cần nhãn. Xem tâm cụm di chuyển qua từng vòng lặp và dùng phương pháp khuỷu tay để chọn số cụm.',
    labs: [
      {
        id: 'run', title: 'Chạy K-Means đến khi hội tụ',
        desc: 'Nhấn <b>⏭ Bước tiếp</b> vài lần để thấy hai bước luân phiên, sau đó nhấn <b>▶ Chạy</b> đến khi các tâm đứng yên.',
        check: (s) => ({ ok: !!s.flags.converged, msg: 'Thuật toán chưa hội tụ.' }),
      },
      {
        id: 'elbow', title: 'Chọn k bằng phương pháp khuỷu tay',
        desc: 'Nhìn biểu đồ ② để tìm điểm "khuỷu tay", đặt <b>k</b> bằng giá trị đó và chạy đến khi hội tụ.',
        hint: 'Tìm điểm mà từ đó đường cong gần như nằm ngang. Giá trị này thường trùng với số cụm thật khi sinh dữ liệu.',
        check: (s) => ({ ok: !!s.flags.correctK, msg: `k = ${s.k} chưa phải điểm khuỷu tay, hoặc chưa chạy đến khi hội tụ.` }),
        reflect: { q: 'Vì sao không chọn k cho inertia nhỏ nhất?', a: 'Vì inertia luôn giảm khi tăng k. Với k bằng số điểm, mỗi điểm là một cụm và inertia bằng 0, nhưng kết quả đó vô nghĩa. Khuỷu tay là điểm cân bằng giữa độ chặt của cụm và sự đơn giản.' },
      },
      {
        id: 'bad', title: 'Quan sát khởi tạo tệ',
        desc: 'Đặt k bằng số cụm thật, nhấn <b>😈 Khởi tạo tệ</b> (mọi tâm dồn vào một góc) rồi chạy đến khi hội tụ. So sánh inertia với đường khuỷu tay.',
        check: (s) => ({ ok: !!s.flags.badInit, msg: 'Hãy nhấn “Khởi tạo tệ” rồi chạy đến khi hội tụ.' }),
        reflect: { q: 'Kết quả có luôn tốt không?', a: 'Không. Nhiều khi hai cụm thật bị gộp làm một trong khi một cụm khác bị chia đôi, và inertia cao hơn mức tốt nhất trên biểu đồ ②. Đây là cực tiểu cục bộ. Thư viện scikit-learn mặc định chạy nhiều lần (n_init) và dùng k-means++ để tránh điều này.' },
      },
      {
        id: 'compare', title: 'Suy ngẫm: khác gì học có giám sát?',
        desc: 'Thử tự trả lời: bài này khác Bài 1 ở điểm nào về dữ liệu và mục tiêu? Bấm "Giải thích" để đối chiếu.',
        reflect: { q: 'Khác biệt giữa học có giám sát và không giám sát', a: 'Bài 1 có nhãn y (giá nhà), mục tiêu là dự đoán đúng nhãn và có thể đo sai số trực tiếp. Bài 3 không có nhãn, mục tiêu là tìm cấu trúc ẩn và không có “đáp án đúng” tuyệt đối, nên việc đánh giá khó hơn (dùng inertia, hiểu biết nghiệp vụ...).' },
      },
    ],
    quiz: [
      { q: 'K-Means thuộc loại học máy nào?', options: ['Học có giám sát', 'Học không giám sát', 'Học tăng cường', 'Deep Learning'], answer: 1, explain: 'K-Means không cần nhãn, nó tự tìm nhóm từ dữ liệu, nên thuộc học không giám sát.' },
      { q: 'Hai bước lặp lại của K-Means là gì?', options: ['Forward và backward', 'Gán mỗi điểm vào tâm gần nhất, rồi dời tâm về trung bình các điểm của cụm', 'Tính gradient và cập nhật trọng số', 'Chia train/test rồi đánh giá'], answer: 1, explain: 'Bước gán (assignment) và bước cập nhật (update) luân phiên đến khi hội tụ.' },
      { q: 'Inertia đo đại lượng nào?', options: ['Số cụm', 'Tổng bình phương khoảng cách từ mỗi điểm đến tâm cụm của nó', 'Độ chính xác phân loại', 'Số vòng lặp'], answer: 1, explain: 'Inertia nhỏ nghĩa là các điểm nằm gần tâm cụm của mình, tức cụm chặt.' },
      { q: 'Vì sao không chọn k có inertia nhỏ nhất?', options: ['Vì inertia luôn giảm khi k tăng, đến 0 khi mỗi điểm là một cụm', 'Vì inertia không tính được', 'Vì k phải luôn bằng 2', 'Vì inertia tăng khi k tăng'], answer: 0, explain: 'Cần cân bằng giữa độ chặt và sự đơn giản, đó là lý do dùng phương pháp khuỷu tay.' },
      { q: 'Làm thế nào để giảm ảnh hưởng của khởi tạo tệ?', options: ['Giảm số vòng lặp', 'Chạy nhiều lần với khởi tạo khác nhau, hoặc dùng k-means++', 'Luôn đặt k = 1', 'Bỏ bước cập nhật tâm'], answer: 1, explain: 'Chạy nhiều lần rồi giữ kết quả có inertia nhỏ nhất, và k-means++ chọn tâm ban đầu cách xa nhau.' },
    ],
    render,
  };

  function render(root, ctx) {
    const shell = App.shell(root, lesson, THEORY);
    const s = (lesson.state = {
      k: 3, trueK: 4, spread: 0.1, seed: 5, points: [], cents: [], labels: null, phase: 'assign', iter: 0,
      converged: false, playing: false, trails: [], inertia: null, elbow: [], lastMove: null, lastAction: null,
      badInitActive: false, acc: 0, flags: { converged: false, correctK: false, badInit: false },
    });

    const sim = shell.sim;
    sim.appendChild(App.h(`<div class="section-head"><h2>🎮 Mô phỏng</h2><span class="status-chip warn" id="km-status">–</span></div>`));
    const grid = App.h('<div class="sim-grid"></div>');
    sim.appendChild(grid);
    const p1 = App.h('<div class="panel"><div class="panel-title">① Dữ liệu chưa có nhãn <small>tâm cụm: hình tròn lớn có dấu +</small></div></div>');
    const p2 = App.h('<div class="panel"><div class="panel-title">② Phương pháp khuỷu tay <small>inertia theo k</small></div></div>');
    grid.append(p1, p2);
    const cv = ctx.canvas(p1, { aspect: 1.1, clickable: true, hint: 'Nhấp để thêm điểm' });
    const cvElbow = ctx.canvas(p2, { aspect: 1.1 });
    p2.appendChild(App.h(`<div class="legend"><span><i class="line" style="background:#a78bfa"></i>Inertia tốt nhất</span><span><i class="line" style="background:#fb923c"></i>Lần chạy hiện tại</span></div>`));

    const toolbar = App.h(`<div class="toolbar">
      <button class="btn primary" id="km-play">▶ Chạy</button>
      <button class="btn" id="km-step">⏭ Bước tiếp: Gán điểm</button>
      <button class="btn" id="km-init">🎯 Khởi tạo ngẫu nhiên</button>
      <button class="btn" id="km-bad">😈 Khởi tạo tệ</button>
      <button class="btn ghost" id="km-data">🎲 Dữ liệu mới</button>
    </div>`);
    sim.appendChild(toolbar);
    const controls = App.h('<div class="controls"></div>');
    controls.append(
      App.slider({ id: 'km-k', label: 'Số cụm k', min: 1, max: 8, step: 1, value: s.k, onInput: (v) => { s.k = v; initRandom(); } }),
      App.slider({ id: 'km-true', label: 'Số cụm thật khi sinh dữ liệu', min: 2, max: 6, step: 1, value: s.trueK, onInput: (v) => { s.trueK = v; gen(); } }),
      App.slider({ id: 'km-spread', label: 'Độ phân tán mỗi cụm', min: 0.04, max: 0.25, step: 0.01, value: s.spread, format: (v) => v.toFixed(2), onInput: (v) => { s.spread = v; gen(); } }),
    );
    sim.appendChild(controls);
    const stats = App.stats(sim, [
      { key: 'iter', id: 'km-s-iter', label: 'Vòng lặp' },
      { key: 'next', id: 'km-s-next', label: 'Bước tiếp theo' },
      { key: 'inertia', id: 'km-s-inertia', label: 'Inertia' },
      { key: 'move', id: 'km-s-move', label: 'Tâm dịch chuyển' },
      { key: 'n', id: 'km-s-n', label: 'Số điểm' },
    ]);
    const explain = App.h('<div class="explain-live" aria-live="polite"></div>');
    sim.appendChild(explain);

    const btnPlay = toolbar.querySelector('#km-play'), btnStep = toolbar.querySelector('#km-step');
    const setPlaying = (on) => { s.playing = on; btnPlay.textContent = on ? '⏸ Tạm dừng' : '▶ Chạy'; };
    btnPlay.addEventListener('click', () => { if (s.converged) initRandom(); setPlaying(!s.playing); });
    btnStep.addEventListener('click', () => { setPlaying(false); step(); });
    toolbar.querySelector('#km-init').addEventListener('click', () => { setPlaying(false); initRandom(); });
    toolbar.querySelector('#km-bad').addEventListener('click', () => { setPlaying(false); initBad(); });
    toolbar.querySelector('#km-data').addEventListener('click', () => { setPlaying(false); s.seed++; gen(); });
    cv.canvas.addEventListener('click', (e) => {
      const p = cv.pointer(e), v = view();
      const x = v.ix(p.x), y = v.iy(p.y);
      if (Math.abs(x) > 1.1 || Math.abs(y) > 1.1) return;
      s.points.push([x, y]);
      s.labels = s.labels ? M.kmeansAssign(s.points, s.cents) : null;
      s.converged = false; s.phase = 'assign';
      computeElbow(); draw();
    });

    function gen() {
      s.points = M.makeBlobs(s.trueK, 40, s.spread, s.seed * 31).points;
      computeElbow();
      initRandom();
    }
    function computeElbow() { s.elbow = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => [k, M.kmeansRun(s.points, k, 7, 6).inertia]); }
    function resetRun(cents, bad) {
      Object.assign(s, { cents, labels: null, phase: 'assign', iter: 0, converged: false, inertia: null, lastMove: null, lastAction: null, badInitActive: bad });
      s.trails = cents.map((c) => [c.slice()]);
      draw();
    }
    function initRandom() { resetRun(M.kmeansInit(s.points, s.k, Date.now() % 100000), false); }
    function initBad() { resetRun(Array.from({ length: s.k }, (_, j) => [-1 + j * 0.04, -1 + (j % 2) * 0.04]), true); }

    function step() {
      if (s.converged) return;
      if (s.phase === 'assign') {
        s.labels = M.kmeansAssign(s.points, s.cents);
        s.phase = 'update'; s.lastAction = 'assign';
      } else {
        const nc = M.kmeansUpdate(s.points, s.labels, s.cents);
        s.lastMove = Math.max(...nc.map((c, j) => Math.hypot(c[0] - s.cents[j][0], c[1] - s.cents[j][1])));
        nc.forEach((c, j) => s.trails[j].push(c.slice()));
        s.cents = nc; s.iter++; s.phase = 'assign'; s.lastAction = 'update';
        if (s.lastMove < 1e-7) {
          s.converged = true; s.flags.converged = true;
          const best = s.elbow[s.k - 1][1];
          if (s.k === s.trueK) s.flags.correctK = true;
          if (s.badInitActive) s.flags.badInit = true;
          setPlaying(false);
          App.toast(`✅ Hội tụ sau ${s.iter} vòng lặp. Inertia = ${App.fmt(s.inertia, 3)} (tốt nhất với k = ${s.k}: ${App.fmt(best, 3)}).`, 'ok');
        }
      }
      s.inertia = M.kmeansInertia(s.points, s.labels, s.cents);
      draw();
    }

    const view = () => App.view(cv, { xmin: -1.15, xmax: 1.15, ymin: -1.15, ymax: 1.15, pad: { l: 10, r: 10, t: 10, b: 10 } });
    const off = document.createElement('canvas');
    off.width = 72; off.height = 72;
    function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

    function draw() {
      if (!cv.w) return;
      const c = cv.ctx, v = view();
      c.clearRect(0, 0, cv.w, cv.h);
      // Nền Voronoi: mỗi vùng tô màu theo tâm gần nhất, cho thấy "lãnh thổ" của từng cụm
      if (s.labels) {
        const octx = off.getContext('2d'), img = octx.createImageData(off.width, off.height);
        const cols = App.PALETTE.map(hexToRgb);
        for (let j = 0; j < off.height; j++) for (let i = 0; i < off.width; i++) {
          const x = -1.15 + ((i + 0.5) / off.width) * 2.3, y = 1.15 - ((j + 0.5) / off.height) * 2.3;
          let best = 0, bd = Infinity;
          s.cents.forEach((m, q) => { const d = (x - m[0]) ** 2 + (y - m[1]) ** 2; if (d < bd) { bd = d; best = q; } });
          const col = cols[best % cols.length], k = (j * off.width + i) * 4;
          img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 34;
        }
        octx.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = false;
        c.drawImage(off, v.sx(-1.15), v.sy(1.15), v.sx(1.15) - v.sx(-1.15), v.sy(-1.15) - v.sy(1.15));
      }
      // Đường nối điểm với tâm ngay sau bước gán
      if (s.labels && s.phase === 'update') {
        c.lineWidth = 1;
        s.points.forEach((p, i) => { const m = s.cents[s.labels[i]]; c.strokeStyle = App.PALETTE[s.labels[i] % 8] + '40'; c.beginPath(); c.moveTo(v.sx(p[0]), v.sy(p[1])); c.lineTo(v.sx(m[0]), v.sy(m[1])); c.stroke(); });
      }
      s.points.forEach((p, i) => App.dot(c, v.sx(p[0]), v.sy(p[1]), 4, s.labels ? App.PALETTE[s.labels[i] % 8] : GRAY, 'rgba(8,13,28,0.8)'));
      s.trails.forEach((tr, j) => {
        const col = App.PALETTE[j % 8];
        c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath();
        tr.forEach((m, i) => (i ? c.lineTo(v.sx(m[0]), v.sy(m[1])) : c.moveTo(v.sx(m[0]), v.sy(m[1]))));
        c.stroke(); c.setLineDash([]);
      });
      s.cents.forEach((m, j) => {
        const x = v.sx(m[0]), y = v.sy(m[1]), col = App.PALETTE[j % 8];
        c.shadowColor = col; c.shadowBlur = 18;
        App.dot(c, x, y, 11, col, '#fff');
        c.shadowBlur = 0;
        c.strokeStyle = '#0a0f1e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke();
      });

      const hl = s.converged && s.inertia !== null ? [{ y: s.inertia, label: 'lần chạy hiện tại', color: 'rgba(251,146,60,0.9)' }] : [];
      App.lineChart(cvElbow, [{ data: s.elbow, color: '#a78bfa', dots: true }], { xmin: 1, xmax: 8, ymin: 0, xlabel: 'k', ylabel: 'inertia', vline: s.k, hlines: hl });

      const chip = document.getElementById('km-status');
      if (s.converged) { chip.className = 'status-chip good'; chip.textContent = `✓ Hội tụ sau ${s.iter} vòng`; }
      else if (!s.labels) { chip.className = 'status-chip warn'; chip.textContent = 'Đã khởi tạo tâm, chưa gán điểm'; }
      else { chip.className = 'status-chip warn'; chip.textContent = s.playing ? '⏳ Đang lặp...' : '⏸ Đang giữa chừng'; }
      btnStep.textContent = s.phase === 'assign' ? '⏭ Bước tiếp: Gán điểm' : '⏭ Bước tiếp: Cập nhật tâm';
      btnStep.disabled = s.converged;
      stats.set('iter', String(s.iter));
      stats.set('next', s.converged ? 'Đã xong' : s.phase === 'assign' ? 'Gán điểm' : 'Cập nhật tâm');
      stats.set('inertia', s.inertia === null ? '–' : App.fmt(s.inertia, 3), s.converged ? (s.inertia <= s.elbow[s.k - 1][1] * 1.02 ? 'good' : 'warn') : '');
      stats.set('move', s.lastMove === null ? '–' : App.fmt(s.lastMove, 4));
      stats.set('n', String(s.points.length));
      explain.innerHTML = s.converged
        ? `<span class="hg">Hội tụ:</span> sau bước cập nhật, không tâm nào dịch chuyển nên phép gán sẽ không đổi nữa.${s.inertia > s.elbow[s.k - 1][1] * 1.02 ? `\n<span class="hl">Inertia ${App.fmt(s.inertia, 3)} cao hơn mức tốt nhất ${App.fmt(s.elbow[s.k - 1][1], 3)}: thuật toán bị kẹt ở cực tiểu cục bộ!</span>` : ''}`
        : s.lastAction === 'assign'
          ? '<span class="hc">Vừa gán điểm:</span> mỗi điểm được tô màu theo tâm gần nhất (đường mờ nối điểm với tâm).\nBước tiếp theo: dời mỗi tâm về trung bình các điểm cùng màu.'
          : s.lastAction === 'update'
            ? `<span class="hc">Vừa cập nhật tâm:</span> tâm dịch chuyển xa nhất ${App.fmt(s.lastMove, 4)} (đường nét đứt là quỹ đạo).\nBước tiếp theo: gán lại các điểm theo vị trí tâm mới.`
            : 'Các tâm đã được đặt ngẫu nhiên, điểm chưa có màu vì chưa thuộc cụm nào.\nNhấn <b>⏭ Bước tiếp</b> để gán mỗi điểm vào tâm gần nhất.';
    }
    cv.onResize = draw;
    cvElbow.onResize = draw;

    ctx.loop((dt) => {
      if (!s.playing) return;
      s.acc += dt;
      if (s.acc > 450) { s.acc = 0; step(); }
    });

    gen();
    App.labUI(shell.lab, lesson, ctx);
    App.quizUI(shell.quiz, lesson);
  }

  App.register(lesson);
})();
