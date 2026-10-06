/* playground.js — Bài 5: Sân chơi mạng nơ-ron. Huấn luyện MLP thời gian thực, xem ranh giới phân loại và đặc trưng mỗi nơ-ron học được */
(function () {
  'use strict';
  const M = window.MLMath;
  const LRS = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
  const SPEEDS = [1, 2, 5, 10, 20];
  const ORANGE = [251, 146, 60], BLUE = [96, 165, 250], BG = [14, 20, 42];
  const DATASETS = [
    { value: 'circle', label: '⭕ Vòng tròn' },
    { value: 'xor', label: '✖ XOR' },
    { value: 'gauss', label: '⚫ Hai cụm' },
    { value: 'spiral', label: '🌀 Xoắn ốc' },
  ];

  const THEORY = `
    <h2>📖 Lý thuyết</h2>
    <h3>1. Từ một nơ-ron đến một mạng</h3>
    <p>Mạng nơ-ron gồm nhiều <b>lớp</b>, mỗi lớp nhiều nơ-ron như ở Bài 4. Đầu ra của lớp trước là đầu vào của lớp sau:</p>
    <div class="formula">h₁ = f(W₁·x + b₁)       <span class="c">// lớp ẩn 1</span>
h₂ = f(W₂·h₁ + b₂)      <span class="c">// lớp ẩn 2</span>
ŷ  = σ(W₃·h₂ + b₃)      <span class="c">// đầu ra: xác suất lớp cam</span></div>
    <h3>2. Bài toán phân loại</h3>
    <p>Mỗi điểm có 2 đặc trưng (x₁, x₂) và thuộc lớp <span style="color:var(--orange)">cam</span> hoặc <span style="color:var(--blue)">xanh</span>. Mạng học cách tô màu toàn bộ mặt phẳng. Đường giao giữa hai màu là <b>ranh giới quyết định</b> (decision boundary).</p>
    <h3>3. Vì sao cần lớp ẩn?</h3>
    <p>Không có lớp ẩn, mạng chỉ là hồi quy logistic, luôn tạo ranh giới là <b>đường thẳng</b>. Mỗi nơ-ron ẩn học một đặc trưng đơn giản (một nửa mặt phẳng). Lớp sau <b>kết hợp</b> chúng thành hình dạng phức tạp hơn: vòng tròn, chữ X, xoắn ốc.</p>
    <div class="callout info"><strong>👀 Quan sát sơ đồ mạng:</strong> mỗi ô vuông nhỏ là "bức tranh" đầu ra của một nơ-ron trên toàn mặt phẳng. Lớp đầu thường là các vùng chia bởi đường thẳng, lớp sau là các hình phức tạp hơn. Đường nối <span style="color:var(--orange)">cam</span> là trọng số dương, <span style="color:var(--blue)">xanh</span> là âm, càng dày thì trị tuyệt đối càng lớn.</div>
    <h3>4. Huấn luyện</h3>
    <p>Mỗi <b>epoch</b> là một lượt đi qua toàn bộ dữ liệu: lan truyền xuôi → tính Loss (Binary Cross-Entropy) → lan truyền ngược → cập nhật mọi trọng số. Đúng vòng lặp 4 bước bạn đã thấy, chỉ là có nhiều tham số hơn.</p>
    <div class="formula">Loss = −[y·log(ŷ) + (1−y)·log(1−ŷ)]</div>
    <div class="callout tip"><strong>Hãy thử:</strong> chọn hàm kích hoạt "Tuyến tính" với 3 lớp ẩn trên bài Vòng tròn. Vì sao mạng nhiều lớp vẫn chỉ vẽ được đường thẳng?</div>
    <h3>5. Code PyTorch tương ứng</h3>
    <pre class="code">model = nn.Sequential(
    nn.Linear(2, 4), nn.Tanh(),
    nn.Linear(4, 4), nn.Tanh(),
    nn.Linear(4, 1), nn.Sigmoid())
loss_fn = nn.BCELoss()
opt = torch.optim.SGD(model.parameters(), lr=0.3)
for epoch in range(1000):
    loss = loss_fn(model(X), y)
    opt.zero_grad(); loss.backward(); opt.step()</pre>`;

  const lesson = {
    id: 'playground',
    icon: '🕸️',
    title: 'Sân chơi mạng nơ-ron',
    navTitle: 'Mạng nơ-ron',
    navSub: 'Phân loại phi tuyến',
    group: 'Deep Learning',
    badge: 'Bài 5 · Deep Learning · Mạng nhiều lớp',
    lead: 'Tự thiết kế kiến trúc mạng, bấm chạy và quan sát ranh giới phân loại hình thành theo thời gian thực. Nhấp lên mặt phẳng để thêm dữ liệu của riêng bạn.',
    cardText: 'Giống TensorFlow Playground: chọn số lớp, số nơ-ron, hàm kích hoạt và xem mạng học ranh giới cong, kể cả bài xoắn ốc.',
    labs: [
      {
        id: 'linear', title: 'Giới hạn của mô hình tuyến tính',
        desc: 'Đặt <b>0 lớp ẩn</b>, chọn bài <b>Vòng tròn</b>, chạy ít nhất 300 epoch. Độ chính xác có vượt được 80% không?',
        check: (s) => ({ ok: !!s.flags.linearFail, msg: s.layers !== 0 ? 'Hãy đặt số lớp ẩn = 0.' : s.dataset !== 'circle' ? 'Hãy chọn bài Vòng tròn.' : `Đã chạy ${s.epoch} epoch, cần ít nhất 300.` }),
        reflect: { q: 'Vì sao không có lớp ẩn thì thất bại?', a: 'Không có lớp ẩn, đầu ra là σ(w₁x₁ + w₂x₂ + b). Ranh giới tại ŷ = 0.5 là w₁x₁ + w₂x₂ + b = 0, luôn là một đường thẳng. Không đường thẳng nào tách được vòng tròn trong khỏi vành ngoài.' },
      },
      {
        id: 'circle', title: 'Giải bài Vòng tròn',
        desc: 'Thêm lớp ẩn và đạt độ chính xác <b>≥ 95%</b> trên bài Vòng tròn.',
        hint: '1 lớp ẩn với 3–4 nơ-ron tanh và learning rate 0.3 là đủ.',
        check: (s) => ({ ok: (s.best.circle || 0) >= 0.95, msg: `Độ chính xác tốt nhất: ${Math.round((s.best.circle || 0) * 100)}%.` }),
      },
      {
        id: 'xor', title: 'Giải bài XOR',
        desc: 'Đạt độ chính xác <b>≥ 95%</b> trên bài XOR. Nhìn sơ đồ mạng: các nơ-ron ẩn đã học những đặc trưng gì?',
        hint: 'Cần ít nhất 2–3 nơ-ron ẩn. Mỗi nơ-ron học một đường thẳng, lớp đầu ra kết hợp chúng.',
        check: (s) => ({ ok: (s.best.xor || 0) >= 0.95, msg: `Độ chính xác tốt nhất: ${Math.round((s.best.xor || 0) * 100)}%.` }),
        reflect: { q: 'XOR có ý nghĩa lịch sử gì?', a: 'Năm 1969, Minsky và Papert chứng minh perceptron một lớp không giải được XOR, góp phần dẫn tới “mùa đông AI” đầu tiên. Mạng nhiều lớp cùng thuật toán lan truyền ngược (phổ biến từ năm 1986) đã giải quyết được vấn đề này.' },
      },
      {
        id: 'spiral', title: 'Thử thách: bài Xoắn ốc',
        desc: 'Đạt độ chính xác <b>≥ 90%</b> trên bài Xoắn ốc. Đây là bài khó, cần mạng sâu hơn và kiên nhẫn.',
        hint: 'Thử 2–3 lớp ẩn, 8 nơ-ron mỗi lớp, tanh, learning rate 0.3, tốc độ 20 epoch/khung hình. Có thể cần vài nghìn epoch.',
        check: (s) => ({ ok: (s.best.spiral || 0) >= 0.9, msg: `Độ chính xác tốt nhất: ${Math.round((s.best.spiral || 0) * 100)}%.` }),
        reflect: { q: 'Bài học rút ra?', a: 'Dữ liệu càng phức tạp thì mạng càng cần sâu và rộng hơn, và cần nhiều epoch hơn. Nhưng mạng quá lớn trên dữ liệu ít, nhiều nhiễu sẽ dễ overfitting (Bài 2). Hãy thử tăng nhiễu lên 0.25 để thấy ranh giới bắt đầu uốn theo từng điểm nhiễu.' },
      },
    ],
    quiz: [
      { q: 'Mạng nơ-ron không có lớp ẩn chỉ tạo được ranh giới phân loại dạng nào?', options: ['Đường tròn', 'Đường thẳng', 'Đường xoắn ốc', 'Bất kỳ hình dạng nào'], answer: 1, explain: 'Không có lớp ẩn, mô hình là hồi quy logistic, nên ranh giới w·x + b = 0 luôn là đường thẳng.' },
      { q: 'Lớp ẩn giúp mạng làm được điều gì?', options: ['Huấn luyện nhanh hơn', 'Kết hợp các đặc trưng đơn giản thành ranh giới phức tạp, phi tuyến', 'Giảm số lượng tham số', 'Không cần dữ liệu huấn luyện'], answer: 1, explain: 'Mỗi nơ-ron ẩn học một đặc trưng, lớp sau tổ hợp chúng thành hình dạng phức tạp hơn.' },
      { q: 'Một “epoch” là gì?', options: ['Một nơ-ron', 'Một lượt mô hình đi qua toàn bộ dữ liệu huấn luyện', 'Một lớp ẩn', 'Một lần dự đoán'], answer: 1, explain: 'Huấn luyện thường kéo dài nhiều epoch đến khi Loss không giảm nữa.' },
      { q: 'Mạng 3 lớp ẩn nhưng dùng hàm kích hoạt tuyến tính trên bài Vòng tròn sẽ thế nào?', options: ['Giải được dễ dàng', 'Vẫn chỉ tạo ranh giới thẳng, không giải được', 'Tốt hơn tanh', 'Báo lỗi'], answer: 1, explain: 'Hợp của các phép tuyến tính vẫn là tuyến tính. Đây là lý do hàm kích hoạt phi tuyến là bắt buộc.' },
      { q: 'Dùng mạng rất lớn trên tập dữ liệu nhỏ và nhiều nhiễu có nguy cơ gì?', options: ['Underfitting', 'Overfitting', 'Gradient luôn bằng 0', 'Không có nguy cơ gì'], answer: 1, explain: 'Mạng có quá nhiều "độ tự do" sẽ uốn ranh giới theo từng điểm nhiễu, tức học vẹt.' },
    ],
    render,
  };

  function render(root, ctx) {
    const shell = App.shell(root, lesson, THEORY);
    const s = (lesson.state = {
      dataset: 'circle', noise: 0.05, layers: 1, neurons: 4, act: 'tanh', lr: 0.3, speed: 5, seed: 11, netSeed: 1,
      points: [], net: null, epoch: 0, loss: null, acc: 0, history: [], histStep: 1, playing: false, addClass: 1,
      best: {}, flags: {}, frame: 0, dirty: true,
    });

    const sim = shell.sim;
    sim.appendChild(App.h(`<div class="section-head"><h2>🎮 Mô phỏng</h2><span class="status-chip warn" id="pg-status">Chưa huấn luyện</span></div>`));
    const dsBar = App.h('<div class="toolbar"></div>');
    dsBar.appendChild(App.seg({ id: 'pg-ds', options: DATASETS, value: s.dataset, onChange: (v) => { s.dataset = v; gen(); rebuild(); } }));
    sim.appendChild(dsBar);

    const grid = App.h('<div class="sim-grid"></div>');
    sim.appendChild(grid);
    const p1 = App.h('<div class="panel"><div class="panel-title">① Dữ liệu và ranh giới phân loại <small id="pg-addinfo"></small></div></div>');
    const p2 = App.h('<div class="panel"><div class="panel-title">② Sơ đồ mạng <small>mỗi ô = đặc trưng nơ-ron học được</small></div></div>');
    grid.append(p1, p2);
    const cvData = ctx.canvas(p1, { aspect: 1, clickable: true, hint: 'Nhấp để thêm điểm' });
    p1.appendChild(App.h(`<div class="legend"><span><i style="background:#fb923c"></i>Lớp 1 (cam)</span><span><i style="background:#60a5fa"></i>Lớp 0 (xanh)</span><span><i style="border:2px solid #fff;background:transparent"></i>Đoán sai</span></div>`));
    const netPanel = App.h('<div></div>');
    p2.appendChild(netPanel);
    const cvNet = ctx.canvas(netPanel, { aspect: 1 });
    p2.appendChild(App.h(`<div class="legend"><span><i class="line" style="background:#fb923c"></i>Trọng số dương</span><span><i class="line" style="background:#60a5fa"></i>Trọng số âm</span></div>`));

    const toolbar = App.h(`<div class="toolbar">
      <button class="btn primary" id="pg-play">▶ Huấn luyện</button>
      <button class="btn" id="pg-step">⏭ 1 epoch</button>
      <button class="btn" id="pg-reset">↺ Khởi tạo lại trọng số</button>
      <button class="btn ghost" id="pg-data">🎲 Sinh lại dữ liệu</button>
    </div>`);
    sim.appendChild(toolbar);
    const addBar = App.h('<div class="toolbar"><span class="muted" style="font-size:13px">Nhấp lên ① để thêm điểm:</span></div>');
    addBar.appendChild(App.seg({ id: 'pg-add', options: [{ value: '1', label: '🟠 Lớp cam' }, { value: '0', label: '🔵 Lớp xanh' }], value: '1', onChange: (v) => (s.addClass = +v) }));
    sim.appendChild(addBar);

    const controls = App.h('<div class="controls"></div>');
    controls.append(
      App.slider({ id: 'pg-layers', label: 'Số lớp ẩn', min: 0, max: 3, step: 1, value: s.layers, onInput: (v) => { s.layers = v; rebuild(); } }),
      App.slider({ id: 'pg-neurons', label: 'Nơ-ron mỗi lớp ẩn', min: 1, max: 8, step: 1, value: s.neurons, onInput: (v) => { s.neurons = v; rebuild(); } }),
      App.select({ id: 'pg-act', label: 'Hàm kích hoạt', value: s.act, options: [{ value: 'tanh', label: 'Tanh' }, { value: 'relu', label: 'ReLU' }, { value: 'sigmoid', label: 'Sigmoid' }, { value: 'linear', label: 'Tuyến tính (không kích hoạt)' }], onChange: (v) => { s.act = v; rebuild(); } }),
      App.slider({ id: 'pg-lr', label: 'Learning rate', values: LRS, value: s.lr, onInput: (v) => (s.lr = v) }),
      App.slider({ id: 'pg-speed', label: 'Tốc độ', values: SPEEDS, value: s.speed, format: (v) => `${v} epoch/khung hình`, onInput: (v) => (s.speed = v) }),
      App.slider({ id: 'pg-noise', label: 'Độ nhiễu dữ liệu', min: 0, max: 0.3, step: 0.01, value: s.noise, format: (v) => v.toFixed(2), onInput: (v) => { s.noise = v; gen(); resetTrain(); } }),
    );
    sim.appendChild(controls);
    const stats = App.stats(sim, [
      { key: 'epoch', id: 'pg-s-epoch', label: 'Epoch' },
      { key: 'loss', id: 'pg-s-loss', label: 'Loss (BCE)' },
      { key: 'acc', id: 'pg-s-acc', label: 'Độ chính xác' },
      { key: 'params', id: 'pg-s-params', label: 'Số tham số' },
      { key: 'arch', id: 'pg-s-arch', label: 'Kiến trúc' },
    ]);
    const pLoss = App.h('<div class="panel"><div class="panel-title">③ Loss theo epoch <small>trục log</small></div></div>');
    sim.appendChild(pLoss);
    const cvLoss = ctx.canvas(pLoss, { height: 150 });

    const btnPlay = toolbar.querySelector('#pg-play');
    const setPlaying = (on) => { s.playing = on; btnPlay.textContent = on ? '⏸ Tạm dừng' : '▶ Huấn luyện'; s.dirty = true; };
    btnPlay.addEventListener('click', () => setPlaying(!s.playing));
    toolbar.querySelector('#pg-step').addEventListener('click', () => { setPlaying(false); trainEpochs(1); s.dirty = true; s.mapsDirty = true; });
    toolbar.querySelector('#pg-reset').addEventListener('click', () => { s.netSeed++; rebuild(); });
    toolbar.querySelector('#pg-data').addEventListener('click', () => { s.seed++; gen(); resetTrain(); });
    cvData.canvas.addEventListener('click', (e) => {
      const p = cvData.pointer(e), v = dataView();
      const x = v.ix(p.x), y = v.iy(p.y);
      if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) return;
      s.points.push({ x: [x, y], y: s.addClass });
      s.dirty = true;
    });

    function gen() { s.points = M.makeDataset(s.dataset, 200, s.noise, s.seed * 97 + s.dataset.length); s.dirty = true; }
    function rebuild() {
      const sizes = [2, ...Array(s.layers).fill(s.neurons), 1];
      s.net = new M.MLP(sizes, s.act, s.netSeed * 13 + 7);
      resetTrain();
    }
    function resetTrain() {
      Object.assign(s, { epoch: 0, history: [], histStep: 1, loss: null });
      s.acc = s.net.accuracy(s.points.map((p) => p.x), s.points.map((p) => p.y));
      s.dirty = true; s.mapsDirty = true;
    }

    function trainEpochs(n) {
      const X = s.points.map((p) => p.x), Y = s.points.map((p) => p.y);
      for (let i = 0; i < n; i++) {
        s.loss = s.net.trainBatch(X, Y, s.lr);
        s.epoch++;
        if (!isFinite(s.loss)) { setPlaying(false); App.toast('Loss không còn là số hữu hạn. Learning rate quá lớn, hãy giảm và khởi tạo lại.', 'warn'); break; }
        if (s.epoch % s.histStep === 0) {
          s.history.push([s.epoch, s.loss]);
          if (s.history.length > 600) { s.history = s.history.filter((_, k) => k % 2 === 0); s.histStep *= 2; }
        }
      }
      s.acc = s.net.accuracy(X, Y);
      s.best[s.dataset] = Math.max(s.best[s.dataset] || 0, s.acc);
      if (s.layers === 0 && s.dataset === 'circle' && s.epoch >= 300 && s.acc < 0.8) s.flags.linearFail = true;
    }

    // ----- Vẽ ranh giới phân loại -----
    const dataView = () => App.view(cvData, { xmin: -1.2, xmax: 1.2, ymin: -1.2, ymax: 1.2, pad: { l: 8, r: 8, t: 8, b: 8 } });
    const bnd = document.createElement('canvas');
    bnd.width = 60; bnd.height = 60;
    const mix = (t) => { const c = t >= 0 ? ORANGE : BLUE, a = Math.min(1, Math.abs(t)); return [BG[0] + (c[0] - BG[0]) * a, BG[1] + (c[1] - BG[1]) * a, BG[2] + (c[2] - BG[2]) * a]; };

    function drawData() {
      const c = cvData.ctx, v = dataView();
      const bctx = bnd.getContext('2d'), img = bctx.createImageData(bnd.width, bnd.height);
      for (let j = 0; j < bnd.height; j++) for (let i = 0; i < bnd.width; i++) {
        const x = -1.2 + ((i + 0.5) / bnd.width) * 2.4, y = 1.2 - ((j + 0.5) / bnd.height) * 2.4;
        const p = s.net.predict([x, y]);
        const col = mix((p - 0.5) * 2 * 0.75), k = (j * bnd.width + i) * 4;
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      c.clearRect(0, 0, cvData.w, cvData.h);
      c.imageSmoothingEnabled = true;
      c.drawImage(bnd, v.sx(-1.2), v.sy(1.2), v.sx(1.2) - v.sx(-1.2), v.sy(-1.2) - v.sy(1.2));
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(v.sx(0), v.sy(-1.2)); c.lineTo(v.sx(0), v.sy(1.2)); c.moveTo(v.sx(-1.2), v.sy(0)); c.lineTo(v.sx(1.2), v.sy(0)); c.stroke();
      s.points.forEach((p) => {
        const wrong = (s.net.predict(p.x) >= 0.5 ? 1 : 0) !== p.y;
        App.dot(c, v.sx(p.x[0]), v.sy(p.x[1]), wrong ? 5 : 4, p.y ? '#fb923c' : '#60a5fa', wrong ? '#ffffff' : 'rgba(8,13,28,0.85)');
      });
    }

    // ----- Sơ đồ mạng với bản đồ đặc trưng thu nhỏ của từng nơ-ron -----
    const G = 16;
    let mapCanvases = [];
    function computeMaps() {
      const sizes = s.net.sizes;
      const vals = sizes.map((n) => Array.from({ length: n }, () => new Float32Array(G * G)));
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const x = -1.2 + ((i + 0.5) / G) * 2.4, y = 1.2 - ((j + 0.5) / G) * 2.4;
        const { acts } = s.net.forward([x, y]);
        acts.forEach((a, l) => a.forEach((val, k) => (vals[l][k][j * G + i] = val)));
      }
      const last = sizes.length - 1;
      mapCanvases = vals.map((layer, l) => layer.map((arr) => {
        const cnv = document.createElement('canvas');
        cnv.width = G; cnv.height = G;
        const cc = cnv.getContext('2d'), img = cc.createImageData(G, G);
        let mx = 1e-6;
        arr.forEach((v) => (mx = Math.max(mx, Math.abs(v))));
        for (let k = 0; k < arr.length; k++) {
          let t;
          if (l === last || (l > 0 && s.act === 'sigmoid')) t = (arr[k] - 0.5) * 2;
          else t = arr[k] / mx;
          const col = mix(t);
          img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2]; img.data[k * 4 + 3] = 255;
        }
        cc.putImageData(img, 0, 0);
        return cnv;
      }));
      s.mapsDirty = false;
    }

    function drawNet() {
      const c = cvNet.ctx, W = cvNet.w, H = cvNet.h, sizes = s.net.sizes;
      c.clearRect(0, 0, W, H);
      const padX = 36, padTop = 34, padBot = 16, box = Math.min(34, W / 11);
      const colX = (l) => padX + (l * (W - 2 * padX)) / (sizes.length - 1);
      const nodeY = (l, k) => { const n = sizes[l], gap = Math.min(box + 14, (H - padTop - padBot) / n); return padTop + (H - padTop - padBot) / 2 + (k - (n - 1) / 2) * gap; };
      for (let l = 0; l < s.net.W.length; l++) {
        s.net.W[l].forEach((row, j) => row.forEach((w, i) => {
          const a = Math.min(1, Math.abs(w) / 2);
          c.strokeStyle = w >= 0 ? `rgba(251,146,60,${0.15 + 0.75 * a})` : `rgba(96,165,250,${0.15 + 0.75 * a})`;
          c.lineWidth = 0.6 + Math.min(4.5, Math.abs(w) * 1.6);
          c.beginPath();
          const x1 = colX(l) + box / 2, y1 = nodeY(l, i), x2 = colX(l + 1) - box / 2, y2 = nodeY(l + 1, j);
          c.moveTo(x1, y1); c.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2); c.stroke();
        }));
      }
      c.imageSmoothingEnabled = false;
      sizes.forEach((n, l) => {
        for (let k = 0; k < n; k++) {
          const x = colX(l) - box / 2, y = nodeY(l, k) - box / 2;
          if (mapCanvases[l] && mapCanvases[l][k]) c.drawImage(mapCanvases[l][k], x, y, box, box);
          c.strokeStyle = l === sizes.length - 1 ? '#fde047' : 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.strokeRect(x, y, box, box);
        }
      });
      c.fillStyle = 'rgba(203,213,225,0.9)'; c.font = '600 11px "Be Vietnam Pro"'; c.textAlign = 'center';
      sizes.forEach((n, l) => c.fillText(l === 0 ? 'Đầu vào' : l === sizes.length - 1 ? 'Đầu ra' : `Ẩn ${l}`, colX(l), 16));
      c.font = '11px "JetBrains Mono"'; c.fillStyle = 'rgba(154,164,189,0.9)';
      c.fillText('x₁', colX(0), nodeY(0, 0) + box / 2 + 13);
      c.fillText('x₂', colX(0), nodeY(0, 1) + box / 2 + 13);
    }

    function updateInfo() {
      const params = s.net.W.reduce((acc, W, l) => acc + W.length * W[0].length + s.net.b[l].length, 0);
      stats.set('epoch', String(s.epoch));
      stats.set('loss', s.loss === null ? '–' : App.fmt(s.loss, 4));
      stats.set('acc', Math.round(s.acc * 100) + '%', s.acc >= 0.95 ? 'good' : s.acc < 0.75 ? 'bad' : 'warn');
      stats.set('params', String(params));
      stats.set('arch', s.net.sizes.join('→'));
      const chip = document.getElementById('pg-status');
      if (s.acc >= 0.95 && s.epoch > 0) { chip.className = 'status-chip good'; chip.textContent = `✓ Độ chính xác ${Math.round(s.acc * 100)}%`; }
      else if (s.playing) { chip.className = 'status-chip warn'; chip.textContent = '⏳ Đang huấn luyện...'; }
      else { chip.className = 'status-chip warn'; chip.textContent = s.epoch ? `⏸ ${Math.round(s.acc * 100)}% sau ${s.epoch} epoch` : 'Chưa huấn luyện'; }
      document.getElementById('pg-addinfo').textContent = `${s.points.length} điểm`;
      App.lineChart(cvLoss, [{ data: s.history, color: '#fb923c' }], { logY: true, xmin: 0, xmax: Math.max(1, s.epoch), xlabel: 'epoch' });
    }

    [cvData, cvNet, cvLoss].forEach((cv) => (cv.onResize = () => { s.dirty = true; s.mapsDirty = true; }));

    ctx.loop(() => {
      s.frame++;
      if (s.playing) { trainEpochs(s.speed); s.dirty = true; if (s.frame % 8 === 0) s.mapsDirty = true; }
      if (s.dirty && cvData.w) {
        if (s.mapsDirty) computeMaps();
        drawData(); drawNet(); updateInfo();
        s.dirty = false;
      }
    });

    gen();
    rebuild();
    App.labUI(shell.lab, lesson, ctx);
    App.quizUI(shell.quiz, lesson);
  }

  App.register(lesson);
})();
