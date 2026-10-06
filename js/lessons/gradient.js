/* gradient.js — Bài 1: Gradient Descent với hồi quy tuyến tính, gồm 3 góc nhìn đồng bộ: dữ liệu, bản đồ Loss, đường cong Loss */
(function () {
  'use strict';
  const M = window.MLMath;
  const LRS = [0.001, 0.003, 0.01, 0.03, 0.05, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6];
  const SPEEDS = [0.1, 0.25, 0.5, 1, 3, 10];
  const R = { wmin: -2, wmax: 5, bmin: -3, bmax: 4 }; // vùng hiển thị bản đồ Loss
  const START = { w: -1, b: 3 };

  const THEORY = `
    <h2>📖 Lý thuyết</h2>
    <h3>1. Bài toán</h3>
    <p>Có 30 căn nhà với diện tích <code>x</code> và giá <code>y</code>. Ta muốn tìm một đường thẳng để dự đoán giá từ diện tích:</p>
    <div class="formula">ŷ = w·x + b   <span class="c">// w: độ dốc, b: hệ số chặn</span></div>
    <p>Máy chưa biết <code>w</code> và <code>b</code>, nó bắt đầu từ một giá trị bất kỳ và tự điều chỉnh dần.</p>
    <h3>2. Đo độ sai bằng hàm mất mát</h3>
    <p>Mean Squared Error (MSE) là trung bình bình phương các đoạn <span style="color:var(--red)">màu đỏ</span> trên biểu đồ ①:</p>
    <div class="formula">L(w, b) = (1/n) · Σ (ŷᵢ − yᵢ)²</div>
    <p>Mỗi cặp (w, b) cho ra một giá trị Loss. Tô màu cho mọi cặp ta được bản đồ ②: vùng <b>tối</b> là Loss thấp. <b>"Học" chính là đi tìm điểm tối nhất</b> (ngôi sao ★).</p>
    <h3>3. Gradient: la bàn chỉ hướng dốc</h3>
    <div class="formula">∂L/∂w = (2/n) · Σ (ŷᵢ − yᵢ) · xᵢ
∂L/∂b = (2/n) · Σ (ŷᵢ − yᵢ)</div>
    <p>Gradient chỉ hướng làm Loss <b>tăng</b> nhanh nhất, vì vậy ta bước theo hướng ngược lại:</p>
    <div class="formula">w ← w − lr · ∂L/∂w
b ← b − lr · ∂L/∂b</div>
    <div class="callout info"><strong>🏔️ Hình dung:</strong> bạn đứng trên sườn núi trong sương mù dày và muốn xuống thung lũng. Bạn không nhìn thấy đáy, chỉ cảm nhận được độ dốc dưới chân, nên mỗi lần bước một bước về phía dốc xuống.</div>
    <h3>4. Learning rate (lr): độ dài bước chân</h3>
    <ul>
      <li><b>Quá nhỏ:</b> đi rất chậm, cần hàng trăm bước.</li>
      <li><b>Vừa phải:</b> xuống đáy nhanh và ổn định.</li>
      <li><b>Quá lớn:</b> bước vượt qua đáy, dao động zíc zắc, thậm chí văng ra xa (phân kỳ).</li>
    </ul>
    <div class="callout tip"><strong>Hãy thử:</strong> lần lượt đặt lr = 0.01, 0.4 và 0.5 rồi so sánh quỹ đạo trên bản đồ ②. Vì sao quỹ đạo không đi thẳng tới ngôi sao?</div>
    <div class="callout warn"><strong>Ghi chú nâng cao:</strong> bản đồ ② là một thung lũng hẹp và dài. Gradient luôn vuông góc với đường đồng mức nên quỹ đạo bị zíc zắc. Đây là lý do các thuật toán tối ưu như Momentum và Adam ra đời.</div>
    <h3>5. Code Python tương ứng</h3>
    <pre class="code">for epoch in range(1000):
    y_pred = w * X + b
    error = y_pred - y
    dw = 2 * (error * X).mean()
    db = 2 * error.mean()
    w -= lr * dw
    b -= lr * db</pre>`;

  const lesson = {
    id: 'gradient',
    icon: '📉',
    title: 'Gradient Descent: máy “học” như thế nào?',
    navTitle: 'Gradient Descent',
    navSub: 'Hồi quy tuyến tính',
    group: 'Machine Learning',
    badge: 'Bài 1 · Machine Learning · Học có giám sát',
    lead: 'Quan sát mô hình tự điều chỉnh đường thẳng để khớp dữ liệu. Mỗi bước được thể hiện đồng thời trên dữ liệu, trên bản đồ Loss và trên đường cong Loss.',
    cardText: 'Thuật toán tối ưu đứng sau gần như mọi mô hình. Xem từng bước cập nhật w, b và ảnh hưởng của learning rate.',
    labs: [
      {
        id: 'converge', title: 'Huấn luyện đến khi hội tụ',
        desc: 'Giữ learning rate mặc định 0.1, nhấn <b>▶ Chạy</b> và chờ đến khi đường Loss chạm đường tối ưu màu xanh.',
        hint: 'Nếu đã chạy trước đó, nhấn <b>↺ Đặt lại</b> rồi chạy lại. Có thể tăng tốc độ mô phỏng để chờ ít hơn.',
        check: (s) => ({ ok: s.convergedAt !== null && s.convergedAt !== undefined, msg: 'Mô hình chưa hội tụ. Hãy chạy thêm.' }),
      },
      {
        id: 'diverge', title: 'Làm cho mô hình phân kỳ',
        desc: 'Tăng learning rate đến khi Loss tăng vọt thay vì giảm. Quan sát quỹ đạo trên bản đồ ②.',
        hint: 'Thử lr ≥ 0.5. Với dữ liệu này, khi lr vượt khoảng 0.46 thì mỗi bước nhảy lại càng xa đáy hơn.',
        check: (s) => ({ ok: !!s.everDiverged, msg: 'Chưa thấy phân kỳ. Hãy tăng learning rate rồi chạy.' }),
        reflect: { q: 'Vì sao learning rate lớn lại gây phân kỳ?', a: 'Mỗi bước di chuyển một đoạn bằng lr × gradient. Khi lr quá lớn, bước nhảy vượt qua đáy sang sườn bên kia, nơi dốc hơn, nên gradient lớn hơn và bước kế tiếp còn xa hơn. Sai số khuếch đại liên tục và Loss tăng vọt.' },
      },
      {
        id: 'fast', title: 'Hội tụ trong dưới 50 bước',
        desc: 'Đặt lại và chọn learning rate sao cho mô hình hội tụ trong <b>ít hơn 50 bước</b>.',
        hint: 'Learning rate tốt nhất nằm sát dưới ngưỡng phân kỳ. Thử 0.3 hoặc 0.4.',
        check: (s) => ({ ok: s.bestConverge < 50, msg: isFinite(s.bestConverge) ? `Lần nhanh nhất hiện tại: ${s.bestConverge} bước.` : 'Chưa có lần hội tụ nào.' }),
        reflect: { q: 'Có phải learning rate càng lớn càng tốt?', a: 'Không. Learning rate tốt nhất nằm ngay dưới ngưỡng gây dao động mạnh. Trong thực tế người ta thường bắt đầu với lr vừa phải rồi giảm dần (learning rate schedule), hoặc dùng Adam để tự điều chỉnh.' },
      },
      {
        id: 'click', title: 'Chọn điểm xuất phát khác',
        desc: 'Nhấp vào một vị trí bất kỳ trên bản đồ ② để đặt (w, b) ban đầu, rồi chạy đến khi hội tụ. Mọi điểm xuất phát có cùng về một đích không?',
        check: (s) => ({ ok: !!s.convergedFromClick, msg: 'Hãy nhấp lên bản đồ Loss, sau đó chạy đến khi hội tụ.' }),
        reflect: { q: 'Vì sao mọi điểm xuất phát đều về cùng một đích?', a: 'Loss của hồi quy tuyến tính có dạng một cái bát (hàm lồi) nên chỉ có một đáy duy nhất. Với mạng nơ-ron, bề mặt Loss có nhiều hố, nên điểm xuất phát (khởi tạo trọng số) có thể dẫn đến kết quả khác nhau.' },
      },
    ],
    quiz: [
      { q: 'Mục tiêu của quá trình huấn luyện mô hình là gì?', options: ['Làm cho mô hình có nhiều tham số nhất', 'Tìm bộ tham số làm hàm mất mát (Loss) nhỏ nhất', 'Làm cho dữ liệu khớp với mô hình', 'Tăng learning rate càng lớn càng tốt'], answer: 1, explain: 'Huấn luyện là quá trình tối ưu: tìm w, b sao cho Loss trên dữ liệu huấn luyện nhỏ nhất.' },
      { q: 'Tại một bước, ∂L/∂w = −4. Gradient Descent sẽ làm gì với w?', options: ['Giảm w', 'Tăng w', 'Giữ nguyên w', 'Đặt w = −4'], answer: 1, explain: 'w ← w − lr × (−4) = w + 4·lr. Gradient âm nghĩa là tăng w thì Loss giảm, nên w được tăng.' },
      { q: 'Learning rate quá lớn thường dẫn đến hiện tượng nào?', options: ['Hội tụ rất chậm', 'Loss dao động hoặc tăng vọt (phân kỳ)', 'Mô hình bị underfitting', 'Không ảnh hưởng gì'], answer: 1, explain: 'Bước nhảy vượt qua đáy, sai số bị khuếch đại sau mỗi bước, như bạn đã thấy trong bài lab.' },
      { q: 'Vì sao MSE dùng bình phương sai số thay vì cộng thẳng sai số?', options: ['Để tính nhanh hơn', 'Để sai số âm và dương không triệt tiêu nhau, đồng thời phạt nặng sai số lớn', 'Vì bắt buộc theo quy ước', 'Để Loss luôn bằng 0'], answer: 1, explain: 'Nếu cộng thẳng, sai số +5 và −5 cho tổng 0 dù mô hình sai. Bình phương luôn dương và phạt sai số lớn nặng hơn nhiều.' },
      { q: 'Trên bản đồ Loss, điểm mà Gradient Descent hướng tới là gì?', options: ['Điểm sáng nhất (Loss cao nhất)', 'Điểm xuất phát', 'Điểm tối nhất, nơi gradient bằng 0 (Loss thấp nhất)', 'Góc trên bên phải'], answer: 2, explain: 'Tại đáy, gradient bằng 0 nên các bước cập nhật nhỏ dần và dừng lại. Đó là điểm hội tụ.' },
    ],
    render,
  };

  function render(root, ctx) {
    const shell = App.shell(root, lesson, THEORY);
    const s = (lesson.state = {
      points: [], opt: null, w: START.w, b: START.b, lr: 0.1, speed: 0.25, noise: 0.3, seed: 1,
      steps: 0, history: [], path: [], playing: false, diverged: false, everDiverged: false,
      convergedAt: null, bestConverge: Infinity, fromClick: false, convergedFromClick: false,
      showResid: true, acc: 0, last: null, dirty: true,
    });

    // ----- Dựng giao diện mô phỏng -----
    const sim = shell.sim;
    sim.appendChild(App.h(`<div class="section-head"><h2>🎮 Mô phỏng</h2><span class="status-chip warn" id="gd-status">Chưa huấn luyện</span></div>`));
    const grid = App.h('<div class="sim-grid"></div>');
    sim.appendChild(grid);
    const p1 = App.h('<div class="panel"><div class="panel-title">① Dữ liệu và đường dự đoán <small>ŷ = w·x + b</small></div></div>');
    const p2 = App.h('<div class="panel"><div class="panel-title">② Bản đồ Loss theo (w, b) <small>tối = Loss thấp</small></div></div>');
    const p3 = App.h('<div class="panel span-2"><div class="panel-title">③ Loss qua từng bước <small>trục tung dạng log</small></div></div>');
    grid.append(p1, p2, p3);
    const cvData = ctx.canvas(p1, { aspect: 1.25 });
    p1.appendChild(App.h(`<div class="legend"><span><i style="background:#22d3ee"></i>Dữ liệu</span><span><i class="line" style="background:#fb923c"></i>Mô hình</span><span><i class="line" style="background:#34d399"></i>Tối ưu</span><span><i class="line" style="background:#f87171"></i>Sai số</span></div>`));
    const cvSurf = ctx.canvas(p2, { aspect: 1.25, clickable: true, hint: 'Nhấp để chọn điểm xuất phát' });
    p2.appendChild(App.h(`<div class="legend"><span><i style="background:#fde047"></i>★ Điểm tối ưu</span><span><i style="background:#fff"></i>Quỹ đạo học</span></div>`));
    const cvLoss = ctx.canvas(p3, { height: 170 });

    const toolbar = App.h(`<div class="toolbar">
      <button class="btn primary" id="gd-play">▶ Chạy</button>
      <button class="btn" id="gd-step">⏭ 1 bước</button>
      <button class="btn" id="gd-reset">↺ Đặt lại</button>
      <button class="btn ghost" id="gd-data">🎲 Dữ liệu mới</button>
      <label class="check"><input type="checkbox" id="gd-resid" checked> Hiện sai số</label>
    </div>`);
    sim.appendChild(toolbar);

    const controls = App.h('<div class="controls"></div>');
    controls.append(
      App.slider({ id: 'gd-lr', label: 'Learning rate (lr)', values: LRS, value: s.lr, onInput: (v) => { s.lr = v; s.dirty = true; } }),
      App.slider({ id: 'gd-speed', label: 'Tốc độ mô phỏng', values: SPEEDS, value: s.speed, format: (v) => (v < 1 ? `${Math.round(v * 60)} bước/giây` : `${v} bước/khung hình`), onInput: (v) => (s.speed = v) }),
      App.slider({ id: 'gd-noise', label: 'Độ nhiễu dữ liệu', min: 0, max: 1, step: 0.05, value: s.noise, format: (v) => v.toFixed(2), onInput: (v) => { s.noise = v; genData(); resetTraining(START.w, START.b); } }),
    );
    sim.appendChild(controls);

    const stats = App.stats(sim, [
      { key: 'steps', id: 'gd-s-steps', label: 'Bước' },
      { key: 'w', id: 'gd-s-w', label: 'w' },
      { key: 'b', id: 'gd-s-b', label: 'b' },
      { key: 'loss', id: 'gd-s-loss', label: 'Loss (MSE)' },
      { key: 'dw', id: 'gd-s-dw', label: '∂L/∂w' },
      { key: 'db', id: 'gd-s-db', label: '∂L/∂b' },
    ]);
    const explain = App.h('<div class="explain-live" id="gd-explain" aria-live="polite"></div>');
    sim.appendChild(explain);

    const btnPlay = toolbar.querySelector('#gd-play');
    const setPlaying = (on) => { s.playing = on; btnPlay.textContent = on ? '⏸ Tạm dừng' : '▶ Chạy'; s.dirty = true; };
    btnPlay.addEventListener('click', () => {
      if (s.diverged || s.convergedAt !== null) resetTraining(s.path.length && s.fromClick ? s.path[0][0] : START.w, s.path.length && s.fromClick ? s.path[0][1] : START.b, s.fromClick);
      setPlaying(!s.playing);
    });
    toolbar.querySelector('#gd-step').addEventListener('click', () => { setPlaying(false); if (s.diverged) return App.toast('Mô hình đã phân kỳ. Hãy nhấn Đặt lại.', 'warn'); step(); s.dirty = true; });
    toolbar.querySelector('#gd-reset').addEventListener('click', () => { setPlaying(false); resetTraining(START.w, START.b); });
    toolbar.querySelector('#gd-data').addEventListener('click', () => { setPlaying(false); s.seed++; genData(); resetTraining(START.w, START.b); });
    toolbar.querySelector('#gd-resid').addEventListener('change', (e) => { s.showResid = e.target.checked; s.dirty = true; });

    // Nhấp lên bản đồ Loss để chọn điểm xuất phát: giúp thấy mọi điểm đều về cùng một đáy
    cvSurf.canvas.addEventListener('click', (e) => {
      const p = cvSurf.pointer(e), v = surfView();
      const w = v.ix(p.x), b = v.iy(p.y);
      if (w < R.wmin || w > R.wmax || b < R.bmin || b > R.bmax) return;
      setPlaying(false);
      resetTraining(w, b, true);
      App.toast(`Điểm xuất phát mới: w = ${App.fmt(w, 2)}, b = ${App.fmt(b, 2)}. Nhấn ▶ Chạy để xem quỹ đạo.`);
    });

    // ----- Dữ liệu và bản đồ Loss -----
    const off = document.createElement('canvas');
    off.width = 160; off.height = 128;
    function genData() {
      const r = M.mulberry32(s.seed * 7919);
      const tw = 0.8 + r() * 1.6, tb = -0.3 + r() * 1.4;
      s.points = Array.from({ length: 30 }, () => { const x = r() * 2; return { x, y: tw * x + tb + M.gaussian(r) * s.noise }; });
      s.opt = M.linearOptimum(s.points);
      computeSurface();
    }
    function computeSurface() {
      const W = off.width, H = off.height, octx = off.getContext('2d');
      const img = octx.createImageData(W, H);
      const vals = new Float64Array(W * H);
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const w = R.wmin + ((i + 0.5) / W) * (R.wmax - R.wmin);
        const b = R.bmax - ((j + 0.5) / H) * (R.bmax - R.bmin);
        const L = Math.log(M.linearLoss(s.points, w, b) + 1e-6);
        vals[j * W + i] = L; lo = Math.min(lo, L); hi = Math.max(hi, L);
      }
      for (let k = 0; k < vals.length; k++) {
        const t = Math.floor(((vals[k] - lo) / (hi - lo)) * 18) / 18; // lượng tử hóa tạo hiệu ứng đường đồng mức
        const c = App.plasma(t * 0.92);
        img.data[k * 4] = c[0]; img.data[k * 4 + 1] = c[1]; img.data[k * 4 + 2] = c[2]; img.data[k * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
    }
    function resetTraining(w, b, fromClick = false) {
      Object.assign(s, { w, b, steps: 0, path: [[w, b]], diverged: false, convergedAt: null, fromClick, last: null, acc: 0 });
      s.loss = M.linearLoss(s.points, w, b);
      s.history = [s.loss];
      s.grad = M.linearGradients(s.points, w, b);
      s.dirty = true;
    }

    // ----- Một bước Gradient Descent -----
    function step() {
      if (s.diverged) return;
      const r = M.linearStep(s.points, s.w, s.b, s.lr);
      s.last = { w: s.w, b: s.b, dw: r.dw, db: r.db, lr: s.lr };
      s.w = r.w; s.b = r.b; s.steps++; s.loss = r.loss;
      s.grad = M.linearGradients(s.points, s.w, s.b);
      s.history.push(r.loss);
      if (s.path.length < 6000) s.path.push([s.w, s.b]);
      if (!isFinite(r.loss) || r.loss > 1e5) {
        s.diverged = true; s.everDiverged = true; setPlaying(false);
        App.toast('💥 Mô hình phân kỳ! Learning rate quá lớn khiến mỗi bước nhảy vượt qua đáy và ngày càng xa hơn.', 'warn');
      } else if (s.convergedAt === null && r.loss <= s.opt.loss * 1.01 + 0.002) {
        s.convergedAt = s.steps;
        s.bestConverge = Math.min(s.bestConverge, s.steps);
        if (s.fromClick) s.convergedFromClick = true;
        setPlaying(false);
        App.toast(`✅ Hội tụ sau <b>${s.steps}</b> bước với learning rate ${s.lr}.`, 'ok');
      }
    }

    // ----- Vẽ -----
    const surfView = () => App.view(cvSurf, { xmin: R.wmin, xmax: R.wmax, ymin: R.bmin, ymax: R.bmax, pad: { l: 36, r: 10, t: 10, b: 28 } });
    function dataView() {
      const ys = s.points.map((p) => p.y);
      const lo = Math.min(...ys), hi = Math.max(...ys);
      return App.view(cvData, { xmin: -0.1, xmax: 2.1, ymin: lo - 0.6, ymax: hi + 0.6, pad: { l: 36, r: 10, t: 10, b: 28 } });
    }
    function clipRect(c, cv, v) { c.beginPath(); c.rect(v.pad.l, v.pad.t, cv.w - v.pad.l - v.pad.r, cv.h - v.pad.t - v.pad.b); c.clip(); }

    function drawData() {
      const c = cvData.ctx, v = dataView();
      c.clearRect(0, 0, cvData.w, cvData.h);
      App.drawAxes(cvData, v, { xlabel: 'x (diện tích)', ylabel: 'y (giá)' });
      c.save(); clipRect(c, cvData, v);
      const finite = isFinite(s.w) && isFinite(s.b);
      if (s.showResid && finite) {
        c.strokeStyle = 'rgba(248,113,113,0.7)'; c.lineWidth = 1.5;
        s.points.forEach((p) => { c.beginPath(); c.moveTo(v.sx(p.x), v.sy(p.y)); c.lineTo(v.sx(p.x), v.sy(s.w * p.x + s.b)); c.stroke(); });
      }
      c.setLineDash([6, 6]); c.strokeStyle = 'rgba(52,211,153,0.75)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(v.sx(-0.1), v.sy(s.opt.w * -0.1 + s.opt.b)); c.lineTo(v.sx(2.1), v.sy(s.opt.w * 2.1 + s.opt.b)); c.stroke();
      c.setLineDash([]);
      if (finite) {
        c.strokeStyle = '#fb923c'; c.lineWidth = 3; c.shadowColor = '#fb923c'; c.shadowBlur = 12;
        c.beginPath(); c.moveTo(v.sx(-0.1), v.sy(s.w * -0.1 + s.b)); c.lineTo(v.sx(2.1), v.sy(s.w * 2.1 + s.b)); c.stroke();
        c.shadowBlur = 0;
      }
      s.points.forEach((p) => App.dot(c, v.sx(p.x), v.sy(p.y), 4.5, '#22d3ee', 'rgba(8,13,28,0.9)'));
      c.restore();
      c.font = '600 13px "JetBrains Mono"'; c.fillStyle = '#fdba74'; c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillText(finite ? `ŷ = ${App.fmt(s.w, 2)}·x ${s.b >= 0 ? '+' : '−'} ${App.fmt(Math.abs(s.b), 2)}` : 'ŷ = ∞', v.pad.l + 8, v.pad.t + 22);
    }

    function star(c, x, y, r) {
      c.save(); c.translate(x, y); c.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fillStyle = '#fde047'; c.shadowColor = '#fde047'; c.shadowBlur = 14; c.fill();
      c.strokeStyle = '#0a0f1e'; c.lineWidth = 1.5; c.stroke(); c.restore();
    }

    function drawSurf() {
      const c = cvSurf.ctx, v = surfView();
      c.clearRect(0, 0, cvSurf.w, cvSurf.h);
      c.imageSmoothingEnabled = true;
      c.drawImage(off, v.sx(R.wmin), v.sy(R.bmax), v.sx(R.wmax) - v.sx(R.wmin), v.sy(R.bmin) - v.sy(R.bmax));
      App.drawAxes(cvSurf, v, { xlabel: 'w', ylabel: 'b' });
      c.save(); clipRect(c, cvSurf, v);
      star(c, v.sx(s.opt.w), v.sy(s.opt.b), 10);
      if (s.path.length) {
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.lineJoin = 'round';
        c.beginPath();
        s.path.forEach(([w, b], i) => { const x = v.sx(w), y = v.sy(b); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.stroke();
        if (s.path.length < 300) s.path.forEach(([w, b]) => App.dot(c, v.sx(w), v.sy(b), 2.2, '#fff'));
        App.dot(c, v.sx(s.path[0][0]), v.sy(s.path[0][1]), 6, 'rgba(255,255,255,0.25)', '#fff');
        if (isFinite(s.w) && isFinite(s.b)) {
          const x = v.sx(s.w), y = v.sy(s.b);
          c.shadowColor = '#fb923c'; c.shadowBlur = 16;
          App.dot(c, x, y, 7, '#fb923c', '#fff');
          c.shadowBlur = 0;
          // Mũi tên cho thấy hướng ngược gradient (hướng sẽ bước tới)
          if (s.grad && !s.diverged) {
            const gx = -s.grad.dw, gy = -s.grad.db, len = Math.hypot(gx, gy);
            if (len > 1e-6) {
              const L = 34, ux = gx / len, uy = gy / len;
              const ex = x + ux * L, ey = y - uy * L;
              c.strokeStyle = '#a5f3fc'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
              const ang = Math.atan2(ey - y, ex - x);
              c.fillStyle = '#a5f3fc'; c.beginPath(); c.moveTo(ex, ey);
              c.lineTo(ex - 9 * Math.cos(ang - 0.4), ey - 9 * Math.sin(ang - 0.4)); c.lineTo(ex - 9 * Math.cos(ang + 0.4), ey - 9 * Math.sin(ang + 0.4)); c.fill();
            }
          }
        }
      }
      c.restore();
    }

    function drawLoss() {
      App.lineChart(cvLoss, [{ data: s.history.map((l) => Math.min(l, 1e6)), color: '#fb923c' }], {
        logY: true, xlabel: 'bước', hlines: [{ y: s.opt.loss, label: 'Loss tối ưu', color: 'rgba(52,211,153,0.85)' }],
      });
    }

    function updateInfo() {
      stats.set('steps', String(s.steps));
      stats.set('w', App.fmt(s.w));
      stats.set('b', App.fmt(s.b));
      stats.set('loss', App.fmt(s.loss, 4), s.diverged ? 'bad' : s.convergedAt !== null ? 'good' : '');
      stats.set('dw', s.grad ? App.fmt(s.grad.dw) : '–');
      stats.set('db', s.grad ? App.fmt(s.grad.db) : '–');
      const chip = document.getElementById('gd-status');
      if (s.diverged) { chip.className = 'status-chip bad'; chip.textContent = '💥 Phân kỳ, hãy đặt lại'; }
      else if (s.convergedAt !== null) { chip.className = 'status-chip good'; chip.textContent = `✓ Hội tụ sau ${s.convergedAt} bước`; }
      else if (s.playing) { chip.className = 'status-chip warn'; chip.textContent = '⏳ Đang học...'; }
      else { chip.className = 'status-chip warn'; chip.textContent = s.steps ? '⏸ Tạm dừng' : 'Chưa huấn luyện'; }
      if (s.last && isFinite(s.w)) {
        const L = s.last;
        explain.innerHTML = `<b>Phép tính ở bước ${s.steps}</b> (lr = ${L.lr})
∂L/∂w = <span class="hl">${App.fmt(L.dw)}</span>  → gradient ${L.dw < 0 ? 'âm nên <span class="hg">tăng w</span>' : 'dương nên <span class="hg">giảm w</span>'}
w mới = w − lr × ∂L/∂w = ${App.fmt(L.w)} − ${L.lr} × (${App.fmt(L.dw)}) = <span class="hc">${App.fmt(s.w)}</span>
b mới = b − lr × ∂L/∂b = ${App.fmt(L.b)} − ${L.lr} × (${App.fmt(L.db)}) = <span class="hc">${App.fmt(s.b)}</span>`;
      } else if (s.diverged) {
        explain.textContent = 'Các tham số đã tiến ra vô cực. Learning rate quá lớn.';
      } else {
        explain.innerHTML = 'Nhấn <b>⏭ 1 bước</b> để xem chi tiết phép tính cập nhật w và b. Mũi tên xanh trên bản đồ ② chỉ hướng mà bước tiếp theo sẽ đi (ngược hướng gradient).';
      }
    }

    function drawAll() { if (!cvData.w) return; drawData(); drawSurf(); drawLoss(); updateInfo(); s.dirty = false; }
    [cvData, cvSurf, cvLoss].forEach((cv) => (cv.onResize = () => (s.dirty = true)));

    ctx.loop(() => {
      if (s.playing) {
        s.acc += s.speed;
        while (s.acc >= 1 && s.playing) { step(); s.acc -= 1; }
        s.dirty = true;
      }
      if (s.dirty) drawAll();
    });

    genData();
    resetTraining(START.w, START.b);
    App.labUI(shell.lab, lesson, ctx);
    App.quizUI(shell.quiz, lesson);
  }

  App.register(lesson);
})();
