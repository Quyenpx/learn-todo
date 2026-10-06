/* neuron.js — Bài 4: Một nơ-ron, đồ thị tính toán, lan truyền xuôi và lan truyền ngược (chain rule) với số liệu cụ thể */
(function () {
  'use strict';
  const M = window.MLMath;
  const LRS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  const ACT_LABEL = { sigmoid: 'σ', tanh: 'tanh', relu: 'ReLU', linear: 'f' };
  const ACT_NAME = { sigmoid: 'Sigmoid', tanh: 'Tanh', relu: 'ReLU', linear: 'Tuyến tính (không kích hoạt)' };

  const THEORY = `
    <h2>📖 Lý thuyết</h2>
    <h3>1. Nơ-ron nhân tạo</h3>
    <p>Một nơ-ron làm 2 việc: tính <b>tổng có trọng số</b> rồi đưa qua <b>hàm kích hoạt</b>:</p>
    <div class="formula">z = w·x + b        <span class="c">// phần tuyến tính</span>
a = f(z)           <span class="c">// hàm kích hoạt</span>
L = (a − y)²       <span class="c">// sai số so với đáp án y</span></div>
    <p>Nó giống hệt hồi quy tuyến tính ở Bài 1, chỉ thêm hàm <code>f</code>. Ghép hàng nghìn nơ-ron thành nhiều lớp ta có mạng nơ-ron sâu (Deep Learning).</p>
    <h3>2. Vì sao cần hàm kích hoạt?</h3>
    <p>Nếu không có <code>f</code>, xếp chồng 100 lớp tuyến tính vẫn chỉ tương đương <b>một</b> phép tuyến tính, tức chỉ vẽ được đường thẳng. Hàm kích hoạt phi tuyến giúp mạng học được ranh giới cong (xem Bài 5).</p>
    <h3>3. Lan truyền xuôi (forward)</h3>
    <p>Tính lần lượt từ trái sang phải trên đồ thị: x, w → z → a → L. Giá trị hiện màu <span style="color:var(--accent)">xanh</span>.</p>
    <h3>4. Lan truyền ngược (backpropagation)</h3>
    <p>Muốn cập nhật w, ta cần biết <code>∂L/∂w</code>. Vì L phụ thuộc w qua một chuỗi phép tính, ta dùng <b>quy tắc đạo hàm hàm hợp (chain rule)</b>, nhân các đạo hàm cục bộ từ phải sang trái:</p>
    <div class="formula">∂L/∂w = ∂L/∂a × ∂a/∂z × ∂z/∂w
      = 2(a − y) × f'(z) × x</div>
    <p>Gradient hiện màu <span style="color:var(--orange)">cam</span>. Mỗi nút chỉ cần biết đạo hàm của chính nó rồi chuyển tiếp về phía trước, nên backprop tính được gradient cho hàng tỷ tham số một cách hiệu quả.</p>
    <h3>5. Hai vấn đề kinh điển</h3>
    <ul>
      <li><b>Gradient biến mất (vanishing gradient):</b> sigmoid bị "bão hòa" khi |z| lớn, đạo hàm gần 0 nên nơ-ron gần như không học. Hãy quan sát đường đạo hàm trên biểu đồ ②.</li>
      <li><b>ReLU chết (dying ReLU):</b> khi z &lt; 0, đạo hàm của ReLU bằng 0 nên gradient không truyền qua được.</li>
    </ul>
    <div class="callout info"><strong>🔗 Trong PyTorch:</strong> <code>loss.backward()</code> thực hiện đúng quá trình lan truyền ngược bạn thấy ở đây, tự động cho mọi tham số. Sau đó <code>optimizer.step()</code> là bước ③ cập nhật.</div>`;

  const lesson = {
    id: 'neuron',
    icon: '🧠',
    title: 'Nơ-ron và lan truyền ngược',
    navTitle: 'Nơ-ron & Backprop',
    navSub: 'Chain rule',
    group: 'Deep Learning',
    badge: 'Bài 4 · Deep Learning · Nền tảng',
    lead: 'Mổ xẻ viên gạch nhỏ nhất của Deep Learning. Bấm từng bước để thấy giá trị chảy xuôi và gradient chảy ngược trên đồ thị tính toán, kèm phép tính chain rule bằng số cụ thể.',
    cardText: 'Viên gạch của mạng nơ-ron. Xem giá trị chảy xuôi, gradient chảy ngược theo chain rule, và hiện tượng gradient biến mất.',
    labs: [
      {
        id: 'hand', title: 'Tái hiện ví dụ tính tay',
        desc: 'Nhấn <b>↺ Ví dụ tính tay</b> (x = 2, w = 0.5, b = 0, y = 1, sigmoid), rồi thực hiện bước ① và ②. Đối chiếu ∂L/∂w = −0.2115 với tài liệu.',
        check: (s) => ({ ok: !!s.flags.hand, msg: 'Hãy đặt đúng ví dụ tính tay và chạy lan truyền ngược.' }),
      },
      {
        id: 'train', title: 'Huấn luyện nơ-ron đến Loss < 0.001',
        desc: 'Thực hiện bước ③ nhiều lần (hoặc dùng <b>▶ Huấn luyện liên tục</b>) đến khi Loss nhỏ hơn 0.001.',
        check: (s) => ({ ok: !!s.flags.lossLow, msg: 'Loss chưa đủ nhỏ.' }),
        reflect: { q: 'Mỗi lần cập nhật, w và b thay đổi theo hướng nào?', a: 'Ngược dấu gradient. Ví dụ ∂L/∂w âm thì w tăng. Đây chính là Gradient Descent ở Bài 1, chỉ khác là gradient được tính qua chain rule.' },
      },
      {
        id: 'vanish', title: 'Tạo ra gradient biến mất',
        desc: 'Dùng sigmoid và chỉnh w, b sao cho <b>∂a/∂z &lt; 0.02</b>, rồi chạy lan truyền ngược. Thử cập nhật vài lần, Loss có giảm nhanh không?',
        hint: 'Cần |z| lớn, khoảng trên 4. Ví dụ x = 2, w = −2.5, b = 0 thì z = −5.',
        check: (s) => ({ ok: !!s.flags.vanish, msg: 'Chưa đạt: cần sigmoid và ∂a/∂z < 0.02 sau khi lan truyền ngược.' }),
        reflect: { q: 'Vì sao đây là vấn đề lớn trong mạng sâu?', a: 'Trong mạng nhiều lớp, gradient là tích của nhiều đạo hàm. Mỗi lớp sigmoid nhân thêm một số ≤ 0.25, qua 10 lớp gradient còn khoảng 0.25¹⁰ ≈ 0.000001, nên các lớp đầu gần như không học được. ReLU ra đời một phần để giải quyết vấn đề này.' },
      },
      {
        id: 'relu', title: 'Quan sát ReLU “chết”',
        desc: 'Chọn hàm ReLU, chỉnh sao cho <b>z &lt; 0</b> rồi lan truyền ngược. Gradient của w và b bằng bao nhiêu?',
        check: (s) => ({ ok: !!s.flags.dead, msg: 'Cần chọn ReLU, có z < 0 và chạy lan truyền ngược.' }),
        reflect: { q: 'Hậu quả của ReLU chết là gì?', a: 'Gradient bằng 0 nên w, b không bao giờ được cập nhật nữa, nơ-ron "chết" vĩnh viễn. Các biến thể như Leaky ReLU (cho phép độ dốc nhỏ khi z < 0) được dùng để tránh điều này.' },
      },
    ],
    quiz: [
      { q: 'Một nơ-ron nhân tạo tính toán gì?', options: ['Chỉ cộng các đầu vào', 'Tổng có trọng số của đầu vào cộng bias, rồi đưa qua hàm kích hoạt', 'Nhân tất cả đầu vào với nhau', 'Chọn đầu vào lớn nhất'], answer: 1, explain: 'z = w·x + b, rồi a = f(z).' },
      { q: 'Nếu bỏ hết hàm kích hoạt trong một mạng 10 lớp, mạng tương đương với gì?', options: ['Một mạng 20 lớp', 'Một mô hình tuyến tính duy nhất', 'Một mô hình phi tuyến mạnh hơn', 'Không chạy được'], answer: 1, explain: 'Hợp của các hàm tuyến tính vẫn là hàm tuyến tính, nên chỉ tạo được ranh giới thẳng.' },
      { q: 'Lan truyền ngược (backpropagation) dựa trên quy tắc toán học nào?', options: ['Định lý Pythagoras', 'Quy tắc đạo hàm hàm hợp (chain rule)', 'Định lý Bayes', 'Phép nhân ma trận nghịch đảo'], answer: 1, explain: 'Gradient được tính bằng cách nhân các đạo hàm cục bộ dọc theo đồ thị tính toán, từ đầu ra về đầu vào.' },
      { q: 'Với sigmoid, khi z = 8 thì điều gì xảy ra với gradient?', options: ['Rất lớn, học rất nhanh', 'Gần bằng 0, nơ-ron học rất chậm (gradient biến mất)', 'Bằng đúng 1', 'Đổi dấu liên tục'], answer: 1, explain: 'σ\'(8) = a(1 − a) ≈ 0.0003. Sigmoid bão hòa nên gradient gần như biến mất.' },
      { q: 'Thứ tự đúng của một bước huấn luyện là gì?', options: ['Cập nhật → lan truyền xuôi → lan truyền ngược', 'Lan truyền xuôi → tính Loss → lan truyền ngược → cập nhật tham số', 'Lan truyền ngược → lan truyền xuôi → cập nhật', 'Tính Loss → cập nhật → lan truyền xuôi'], answer: 1, explain: 'Phải có dự đoán mới tính được Loss, có Loss mới tính được gradient, có gradient mới cập nhật được.' },
    ],
    render,
  };

  function render(root, ctx) {
    const shell = App.shell(root, lesson, THEORY);
    const s = (lesson.state = { x: 2, w: 0.5, b: 0, y: 1, lr: 0.5, act: 'sigmoid', fw: false, bw: false, history: [], updates: 0, training: false, acc: 0, flags: {} });
    let animToken = 0;
    const timers = [];
    ctx.onCleanup(() => timers.forEach(clearTimeout));
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    const sim = shell.sim;
    sim.appendChild(App.h(`<div class="section-head"><h2>🎮 Mô phỏng</h2><span class="status-chip warn" id="nr-status">Sẵn sàng</span></div>`));
    sim.appendChild(App.h(`<div class="panel"><div class="panel-title">① Đồ thị tính toán <small><span style="color:var(--accent)">xanh = giá trị xuôi</span> · <span style="color:var(--orange)">cam = gradient ngược</span></small></div>
      <div class="canvas-wrap" style="padding:6px">${graphSvg()}</div></div>`));

    const toolbar = App.h(`<div class="toolbar">
      <button class="btn primary" id="nr-fw">① Lan truyền xuôi</button>
      <button class="btn primary" id="nr-bw">② Lan truyền ngược</button>
      <button class="btn primary" id="nr-up">③ Cập nhật w, b</button>
      <button class="btn" id="nr-all">⟳ Cả 3 bước</button>
      <button class="btn" id="nr-train">▶ Huấn luyện liên tục</button>
      <button class="btn ghost" id="nr-hand">↺ Ví dụ tính tay</button>
    </div>`);
    sim.appendChild(toolbar);

    const sliders = {};
    const controls = App.h('<div class="controls"></div>');
    const onParam = (k) => (v) => { s[k] = v; s.bw = false; s.training && setTraining(false); refresh(); };
    sliders.x = App.slider({ id: 'nr-x', label: 'Đầu vào x', min: -3, max: 3, step: 0.1, value: s.x, format: (v) => v.toFixed(2), onInput: onParam('x') });
    sliders.w = App.slider({ id: 'nr-w', label: 'Trọng số w', min: -4, max: 4, step: 0.05, value: s.w, format: (v) => v.toFixed(2), onInput: onParam('w') });
    sliders.b = App.slider({ id: 'nr-b', label: 'Bias b', min: -4, max: 4, step: 0.05, value: s.b, format: (v) => v.toFixed(2), onInput: onParam('b') });
    sliders.y = App.slider({ id: 'nr-y', label: 'Đáp án mong muốn y', min: 0, max: 1, step: 0.05, value: s.y, format: (v) => v.toFixed(2), onInput: onParam('y') });
    sliders.lr = App.slider({ id: 'nr-lr', label: 'Learning rate', values: LRS, value: s.lr, onInput: (v) => (s.lr = v) });
    const actSel = App.select({ id: 'nr-act', label: 'Hàm kích hoạt', value: s.act, options: Object.keys(ACT_NAME).map((k) => ({ value: k, label: ACT_NAME[k] })), onChange: (v) => { s.act = v; s.bw = false; refresh(); } });
    controls.append(sliders.x, sliders.w, sliders.b, sliders.y, sliders.lr, actSel);
    sim.appendChild(controls);

    const chain = App.h('<div class="explain-live" id="nr-chain" aria-live="polite"></div>');
    sim.appendChild(chain);

    const grid = App.h('<div class="sim-grid"></div>');
    sim.appendChild(grid);
    const p2 = App.h('<div class="panel"><div class="panel-title">② Hàm kích hoạt và đạo hàm <small>tiếp tuyến tại z hiện tại</small></div></div>');
    const p3 = App.h('<div class="panel"><div class="panel-title">③ Loss qua các lần cập nhật</div></div>');
    grid.append(p2, p3);
    const cvAct = ctx.canvas(p2, { aspect: 1.5 });
    p2.appendChild(App.h(`<div class="legend"><span><i class="line" style="background:#a78bfa"></i>f(z)</span><span><i class="line" style="background:#fb923c"></i>f'(z)</span><span><i style="background:#22d3ee"></i>z hiện tại</span></div>`));
    const cvLoss = ctx.canvas(p3, { aspect: 1.5 });

    const $ = (id) => document.getElementById(id);
    const btnTrain = toolbar.querySelector('#nr-train');
    const setTraining = (on) => { s.training = on; btnTrain.textContent = on ? '⏸ Dừng' : '▶ Huấn luyện liên tục'; };

    toolbar.querySelector('#nr-fw').addEventListener('click', () => { setTraining(false); forward(true); });
    toolbar.querySelector('#nr-bw').addEventListener('click', () => {
      setTraining(false);
      if (!s.fw) { forward(true, () => backward(true)); return; }
      backward(true);
    });
    toolbar.querySelector('#nr-up').addEventListener('click', () => {
      setTraining(false);
      if (!s.bw) return App.toast('Cần thực hiện ② lan truyền ngược trước để có gradient.', 'warn');
      update();
    });
    toolbar.querySelector('#nr-all').addEventListener('click', () => { setTraining(false); forward(true, () => backward(true, () => later(update, 500))); });
    btnTrain.addEventListener('click', () => setTraining(!s.training));
    toolbar.querySelector('#nr-hand').addEventListener('click', () => {
      setTraining(false);
      Object.assign(s, { x: 2, w: 0.5, b: 0, y: 1, lr: 0.5, act: 'sigmoid', fw: false, bw: false, history: [], updates: 0 });
      ['x', 'w', 'b', 'y', 'lr'].forEach((k) => sliders[k].set(s[k]));
      actSel.set('sigmoid');
      refresh();
      App.toast('Đã đặt ví dụ tính tay. Hãy nhấn ① rồi ②.');
    });

    const params = () => ({ x: s.x, w: s.w, b: s.b, y: s.y, activation: s.act });

    // Hoạt ảnh theo từng giai đoạn: mỗi cạnh "chảy" rồi hiện giá trị tương ứng
    function animate(stages, cls, done) {
      const token = ++animToken;
      document.querySelectorAll('#nr-graph .edge').forEach((e) => e.classList.remove('flow-f', 'flow-b'));
      stages.forEach((st, i) => later(() => {
        if (token !== animToken) return;
        st.edges.forEach((id) => $(id).classList.add(cls));
        later(() => { if (token !== animToken) return; st.edges.forEach((id) => $(id).classList.remove(cls)); st.reveal && st.reveal(); }, 380);
      }, i * 420));
      later(() => { if (token === animToken && done) done(); }, stages.length * 420 + 60);
    }

    function forward(anim, done) {
      s.bw = false;
      if (!anim) { s.fw = true; refresh(); done && done(); return; }
      s.fw = false; refresh();
      const show = (ids) => () => ids.forEach((id) => $(id).classList.remove('hidden'));
      animate([
        { edges: ['e-x', 'e-w'], reveal: show(['t-wx']) },
        { edges: ['e-mul', 'e-b'], reveal: show(['t-z']) },
        { edges: ['e-z'], reveal: show(['t-a']) },
        { edges: ['e-a', 'e-y'], reveal: show(['t-L']) },
      ], 'flow-f', () => { s.fw = true; refresh(); done && done(); });
    }

    function backward(anim, done) {
      const finish = () => {
        s.bw = true;
        const r = M.neuronBackward(params());
        const near = (a, b) => Math.abs(a - b) < 1e-6;
        if (s.act === 'sigmoid' && near(s.x, 2) && near(s.w, 0.5) && near(s.b, 0) && near(s.y, 1)) s.flags.hand = true;
        if (s.act === 'sigmoid' && r.da_dz < 0.02) s.flags.vanish = true;
        if (s.act === 'relu' && r.z < 0) s.flags.dead = true;
        refresh(); done && done();
      };
      if (!anim) return finish();
      const show = (ids) => () => ids.forEach((id) => $(id).classList.remove('hidden'));
      animate([
        { edges: ['e-a'], reveal: show(['g-a']) },
        { edges: ['e-z'], reveal: show(['g-z']) },
        { edges: ['e-mul', 'e-b'], reveal: show(['g-wx', 'g-b']) },
        { edges: ['e-w'], reveal: show(['g-w']) },
      ], 'flow-b', finish);
    }

    function update() {
      const r = M.neuronBackward(params());
      if (!s.history.length) s.history.push(r.loss);
      s.w = Math.max(-4, Math.min(4, s.w - s.lr * r.dL_dw));
      s.b = Math.max(-4, Math.min(4, s.b - s.lr * r.dL_db));
      s.updates++;
      sliders.w.set(s.w); sliders.b.set(s.b);
      const nl = M.neuronForward(params()).loss;
      s.history.push(nl);
      if (nl < 0.001) s.flags.lossLow = true;
      s.lastUpdate = { dw: r.dL_dw, db: r.dL_db };
      s.fw = true; s.bw = false;
      refresh();
    }

    function refresh() {
      const r = M.neuronBackward(params());
      const f = (v, d = 4) => App.fmt(v, d);
      $('t-x').textContent = `x = ${f(s.x, 2)}`;
      $('t-w').textContent = `w = ${f(s.w, 2)}`;
      $('t-b').textContent = `b = ${f(s.b, 2)}`;
      $('t-y').textContent = `y = ${f(s.y, 2)}`;
      $('t-wx').textContent = `w·x = ${f(s.w * s.x, 3)}`;
      $('t-z').textContent = `z = ${f(r.z, 3)}`;
      $('t-a').textContent = `a = ${f(r.a, 4)}`;
      $('t-L').textContent = `L = ${f(r.loss, 4)}`;
      $('g-a').textContent = `∂L/∂a = ${f(r.dL_da)}`;
      $('g-z').textContent = `∂L/∂z = ${f(r.dL_dz)}`;
      $('g-wx').textContent = f(r.dL_dz);
      $('g-b').textContent = `∂L/∂b = ${f(r.dL_db)}`;
      $('g-w').textContent = `∂L/∂w = ${f(r.dL_dw)}`;
      $('n-act').textContent = ACT_LABEL[s.act];
      ['t-wx', 't-z', 't-a', 't-L'].forEach((id) => $(id).classList.toggle('hidden', !s.fw));
      ['g-a', 'g-z', 'g-wx', 'g-b', 'g-w'].forEach((id) => $(id).classList.toggle('hidden', !s.bw));

      const act = M.activations[s.act];
      if (s.bw) {
        chain.innerHTML = `<b>Chain rule với số liệu hiện tại</b>
∂L/∂w = ∂L/∂a × ∂a/∂z × ∂z/∂w
      = 2(a − y) × ${act.formula.split('=')[0].trim()} × x
      = <span class="hl">${f(r.dL_da)}</span> × <span class="hl">${f(r.da_dz)}</span> × <span class="hc">${f(s.x, 2)}</span> = <span class="hl">${f(r.dL_dw)}</span>
∂L/∂b = ∂L/∂a × ∂a/∂z × 1 = <span class="hl">${f(r.dL_db)}</span>

<b>Bước ③ sẽ cập nhật</b> (lr = ${s.lr}):
w mới = ${f(s.w)} − ${s.lr} × (${f(r.dL_dw)}) = <span class="hg">${f(Math.max(-4, Math.min(4, s.w - s.lr * r.dL_dw)))}</span>
b mới = ${f(s.b)} − ${s.lr} × (${f(r.dL_db)}) = <span class="hg">${f(Math.max(-4, Math.min(4, s.b - s.lr * r.dL_db)))}</span>${r.da_dz < 0.02 ? '\n\n<span class="hl">⚠ ∂a/∂z rất nhỏ: gradient gần như biến mất, nơ-ron học rất chậm!</span>' : ''}`;
      } else if (s.fw) {
        chain.innerHTML = `<b>Lan truyền xuôi</b>
z = w·x + b = ${f(s.w, 2)} × ${f(s.x, 2)} + ${f(s.b, 2)} = <span class="hc">${f(r.z)}</span>
a = ${ACT_LABEL[s.act]}(z) = <span class="hc">${f(r.a)}</span>
L = (a − y)² = (${f(r.a)} − ${f(s.y, 2)})² = <span class="hc">${f(r.loss)}</span>

Nhấn <b>② Lan truyền ngược</b> để tính gradient.`;
      } else {
        chain.innerHTML = 'Nhấn <b>① Lan truyền xuôi</b> để tính dự đoán a và Loss L từ trái sang phải.';
      }

      const chip = $('nr-status');
      chip.className = 'status-chip ' + (r.loss < 0.001 ? 'good' : r.loss < 0.05 ? 'warn' : 'bad');
      chip.textContent = `Loss = ${f(r.loss)} · ${s.updates} lần cập nhật`;
      drawAct(r);
      App.lineChart(cvLoss, [{ data: s.history, color: '#fb923c', dots: s.history.length < 40 }], { logY: true, xlabel: 'lần cập nhật', hlines: [{ y: 0.001, label: 'mục tiêu 0.001', color: 'rgba(52,211,153,0.7)' }] });
    }

    function drawAct(r) {
      if (!cvAct.w) return;
      const c = cvAct.ctx, act = M.activations[s.act];
      const yr = { sigmoid: [-0.15, 1.15], tanh: [-1.15, 1.15], relu: [-0.6, 4.5], linear: [-4.5, 4.5] }[s.act];
      const v = App.view(cvAct, { xmin: -6, xmax: 6, ymin: yr[0], ymax: yr[1], pad: { l: 36, r: 10, t: 10, b: 26 } });
      c.clearRect(0, 0, cvAct.w, cvAct.h);
      App.drawAxes(cvAct, v, { xlabel: 'z' });
      c.save(); c.beginPath(); c.rect(v.pad.l, v.pad.t, cvAct.w - v.pad.l - v.pad.r, cvAct.h - v.pad.t - v.pad.b); c.clip();
      const plot = (fn, col, dash) => { c.strokeStyle = col; c.lineWidth = 2.5; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i <= 240; i++) { const z = -6 + (12 * i) / 240; const y = fn(z); i ? c.lineTo(v.sx(z), v.sy(y)) : c.moveTo(v.sx(z), v.sy(y)); } c.stroke(); c.setLineDash([]); };
      plot((z) => act.df(z, act.f(z)), '#fb923c', [6, 5]);
      plot((z) => act.f(z), '#a78bfa');
      const zc = Math.max(-6, Math.min(6, r.z));
      const slope = r.da_dz;
      c.strokeStyle = 'rgba(34,211,238,0.8)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(v.sx(zc - 1.5), v.sy(r.a - slope * 1.5)); c.lineTo(v.sx(zc + 1.5), v.sy(r.a + slope * 1.5)); c.stroke();
      c.setLineDash([3, 4]); c.beginPath(); c.moveTo(v.sx(zc), v.sy(yr[0])); c.lineTo(v.sx(zc), v.sy(yr[1])); c.stroke(); c.setLineDash([]);
      c.shadowColor = '#22d3ee'; c.shadowBlur = 14;
      App.dot(c, v.sx(zc), v.sy(r.a), 6, '#22d3ee', '#fff');
      c.restore();
      c.font = '600 12px "JetBrains Mono"'; c.fillStyle = '#a5f3fc'; c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillText(`z = ${App.fmt(r.z, 2)}   f'(z) = ${App.fmt(slope, 4)}`, v.pad.l + 8, v.pad.t + 6);
    }
    cvAct.onResize = refresh;
    cvLoss.onResize = refresh;

    ctx.loop((dt) => {
      if (!s.training) return;
      s.acc += dt;
      if (s.acc > 140) { s.acc = 0; update(); if (M.neuronForward(params()).loss < 1e-5) { setTraining(false); App.toast('Loss đã gần như bằng 0.', 'ok'); } }
    });

    refresh();
    App.labUI(shell.lab, lesson, ctx);
    App.quizUI(shell.quiz, lesson);
  }

  // SVG đồ thị tính toán: x, w → (×) → (+ b) → z → f → a → Loss(y)
  function graphSvg() {
    const node = (id, x, y, label, cls = '') => `<g class="node ${cls}"><circle cx="${x}" cy="${y}" r="24"/><text x="${x}" y="${y}" ${id ? `id="${id}"` : ''}>${label}</text></g>`;
    const t = (id, x, y, cls, anchor = 'middle') => `<text id="${id}" class="${cls}" x="${x}" y="${y}" style="text-anchor:${anchor}"></text>`;
    return `<svg id="nr-graph" class="graph-svg" viewBox="0 0 760 280" role="img" aria-label="Đồ thị tính toán của một nơ-ron">
      <path id="e-x" class="edge" d="M94 66 L198 120"/>
      <path id="e-w" class="edge" d="M94 194 L198 140"/>
      <path id="e-mul" class="edge" d="M244 130 L346 130"/>
      <path id="e-b" class="edge" d="M370 206 L370 154"/>
      <path id="e-z" class="edge" d="M394 130 L496 130"/>
      <path id="e-a" class="edge" d="M544 130 L646 130"/>
      <path id="e-y" class="edge" d="M670 206 L670 154"/>
      ${node('', 70, 60, 'x')}${node('', 70, 200, 'w')}${node('', 220, 130, '×', 'op')}${node('', 370, 130, '+', 'op')}
      ${node('', 370, 230, 'b')}${node('n-act', 520, 130, 'σ', 'op')}${node('', 670, 130, 'L', 'out')}${node('', 670, 230, 'y')}
      ${t('t-x', 70, 100, 'val')}${t('t-w', 70, 240, 'val')}${t('g-w', 70, 262, 'grd hidden')}
      ${t('t-wx', 295, 112, 'val hidden')}${t('g-wx', 295, 170, 'grd hidden')}
      ${t('t-b', 402, 224, 'val', 'start')}${t('g-b', 402, 246, 'grd hidden', 'start')}
      ${t('t-z', 445, 112, 'val hidden')}${t('g-z', 445, 170, 'grd hidden')}
      ${t('t-a', 595, 112, 'val hidden')}${t('g-a', 595, 170, 'grd hidden')}
      ${t('t-y', 638, 230, 'val', 'end')}${t('t-L', 670, 92, 'val hidden')}
      <text class="lbl" x="220" y="94">nhân</text><text class="lbl" x="370" y="94">cộng</text><text class="lbl" x="520" y="94">kích hoạt</text><text class="lbl" x="702" y="130" style="text-anchor:start">(a−y)²</text>
    </svg>`;
  }

  App.register(lesson);
})();
