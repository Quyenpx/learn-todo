/*
 * core.js — Lõi ứng dụng: điều hướng, lưu tiến độ, và các thành phần giao diện dùng chung
 * (thanh trượt, canvas, biểu đồ, bài lab, bài kiểm tra). Mỗi bài học chỉ cần mô tả nội dung riêng.
 * Dùng script thường (không dùng ES module) để mở trực tiếp file index.html vẫn chạy được.
 */
(function () {
  'use strict';
  const App = (window.App = { lessons: [] });

  // ---------- Bộ phát sự kiện đơn giản để sidebar cập nhật khi tiến độ thay đổi ----------
  const listeners = {};
  App.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  App.emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

  // ---------- Lưu tiến độ vào localStorage để người học quay lại vẫn giữ kết quả ----------
  const KEY = 'mlviz-progress-v1';
  const store = (App.store = {
    data: (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })(),
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* chế độ ẩn danh có thể chặn */ } },
    labDone(id) { return (this.data.labs && this.data.labs[id]) || {}; },
    setLab(id, taskId) {
      this.data.labs = this.data.labs || {};
      this.data.labs[id] = this.data.labs[id] || {};
      if (this.data.labs[id][taskId]) return false;
      this.data.labs[id][taskId] = true;
      this.save(); App.emit('progress');
      return true;
    },
    quiz(id) { return (this.data.quiz || {})[id]; },
    setQuiz(id, score, total) {
      this.data.quiz = this.data.quiz || {};
      const prev = this.data.quiz[id];
      if (!prev || score >= prev.score) this.data.quiz[id] = { score, total };
      this.save(); App.emit('progress');
    },
    reset() { this.data = {}; this.save(); App.emit('progress'); },
    // Chỉ xóa tiến độ của một khóa để không làm mất kết quả của khóa còn lại
    resetCourse(course) {
      App.lessonsOf(course).forEach((l) => { if (this.data.labs) delete this.data.labs[l.id]; if (this.data.quiz) delete this.data.quiz[l.id]; });
      this.save(); App.emit('progress');
    },
  });

  // ---------- Bốn khóa học có tiến độ độc lập ----------
  // Bài không khai báo course mặc định thuộc khóa AI (giữ tương thích các bài cũ)
  App.courses = {
    genai: { id: 'genai', name: 'AI tạo sinh', icon: '✦', title: 'Học AI tạo sinh qua thực hành', home: 'genai-home', sub: 'Từ nguyên lý đến ứng dụng có nguồn' },
    ai: { id: 'ai', name: 'AI / ML', icon: '🧠', home: 'home', sub: 'Học AI bằng cách nhìn thấy', title: 'Học Machine Learning trực quan' },
    devops: { id: 'devops', name: 'DevOps', icon: '🐳', home: 'devops-home', sub: 'Docker & Kubernetes thực chiến', title: 'Học Docker & Kubernetes thực hành' },
    // Khóa nền tảng cho người mới: học Python trước khi vào ML/DL, tiến độ tách riêng như các khóa khác
    python: { id: 'python', name: 'Python', icon: '🐍', home: 'python-home', sub: 'Python nền tảng cho ML và DL', title: 'Học Python cho AI' },
  };
  App.courseOf = (l) => (l && l.course) || 'ai';
  App.lessonsOf = (course) => App.lessons.filter((l) => App.courseOf(l) === course);
  App.url = (l) => { const lesson = typeof l === 'string' ? App.lessons.find((x) => x.id === l) : l; return lesson ? `#/${App.courseOf(lesson)}/${lesson.id}` : '#/'; };
  App.activeCourse = 'ai';
  const LAST_COURSE = 'vlab-last-course';

  App.lessonProgress = function (lesson) {
    let parts = 0, sum = 0;
    if (lesson.labs && lesson.labs.length) {
      parts++;
      const done = store.labDone(lesson.id);
      sum += lesson.labs.filter((t) => done[t.id]).length / lesson.labs.length;
    }
    if (lesson.quiz && lesson.quiz.length) {
      parts++;
      const q = store.quiz(lesson.id);
      sum += q ? q.score / q.total : 0;
    }
    return parts ? sum / parts : 0;
  };

  // ---------- Tiện ích DOM ----------
  App.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  App.fmt = (v, d = 3) => {
    if (!isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'NaN';
    if (Math.abs(v) >= 1e4) return v.toExponential(1).replace('-', '−');
    return v.toFixed(d).replace('-', '−');
  };

  App.toast = function (msg, type = '') {
    const root = document.getElementById('toast-root');
    const el = App.h(`<div class="toast ${type}" role="status">${msg}</div>`);
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3800);
  };

  // Thanh trượt: hỗ trợ cả dải liên tục và danh sách giá trị rời rạc (ví dụ learning rate theo thang log)
  App.slider = function ({ id, label, min, max, step, value, values, format = (v) => v, onInput }) {
    const discrete = Array.isArray(values);
    const toVal = (raw) => (discrete ? values[Math.round(raw)] : raw);
    const startRaw = discrete ? Math.max(0, values.indexOf(value)) : value;
    const el = App.h(`<label class="control" for="${id}">
      <span class="control-top"><span>${label}</span><output id="${id}-out"></output></span>
      <input type="range" id="${id}" min="${discrete ? 0 : min}" max="${discrete ? values.length - 1 : max}" step="${discrete ? 1 : step}" value="${startRaw}">
    </label>`);
    const input = el.querySelector('input'), out = el.querySelector('output');
    const paint = () => {
      const p = ((parseFloat(input.value) - parseFloat(input.min)) / (parseFloat(input.max) - parseFloat(input.min))) * 100;
      input.style.setProperty('--p', p + '%');
      out.textContent = format(toVal(parseFloat(input.value)));
    };
    input.addEventListener('input', () => { paint(); onInput && onInput(toVal(parseFloat(input.value))); });
    el.set = (v) => { input.value = discrete ? Math.max(0, values.indexOf(v)) : v; paint(); };
    el.input = input;
    paint();
    return el;
  };

  App.select = function ({ id, label, options, value, onChange }) {
    const el = App.h(`<label class="control" for="${id}"><span class="control-top"><span>${label}</span></span>
      <select id="${id}">${options.map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>`);
    el.querySelector('select').addEventListener('change', (e) => onChange(e.target.value));
    el.set = (v) => (el.querySelector('select').value = v);
    return el;
  };

  // Nhóm nút chọn một (segmented control)
  App.seg = function ({ id, options, value, onChange }) {
    const el = App.h(`<div class="seg" id="${id}" role="group">${options.map((o) => `<button type="button" data-v="${o.value}" id="${id}-${o.value}" class="${o.value === value ? 'on' : ''}">${o.label}</button>`).join('')}</div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onChange(b.dataset.v);
    });
    el.set = (v) => el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === v));
    return el;
  };

  App.stats = function (container, items) {
    const el = App.h(`<div class="stats">${items.map((it) => `<div class="stat"><span class="k">${it.label}</span><span class="v" id="${it.id}">–</span></div>`).join('')}</div>`);
    container.appendChild(el);
    const map = {};
    items.forEach((it) => (map[it.key] = el.querySelector('#' + it.id)));
    return {
      el,
      set(key, text, cls) { const n = map[key]; if (!n) return; n.textContent = text; n.className = 'v' + (cls ? ' ' + cls : ''); },
    };
  };

  // ---------- Canvas tự co giãn theo khung, sắc nét trên màn hình độ phân giải cao ----------
  App.canvas = function (parent, { height = 300, aspect = null, clickable = false, hint = '' } = {}) {
    const wrap = App.h(`<div class="canvas-wrap ${clickable ? 'clickable' : ''}"><canvas></canvas>${hint ? `<span class="canvas-hint">${hint}</span>` : ''}</div>`);
    parent.appendChild(wrap);
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const cv = { canvas, ctx, wrap, w: 0, h: 0, onResize: null };
    let lastW = -1;
    const resize = () => {
      const w = wrap.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      const h = aspect ? Math.round(w / aspect) : height;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.w = w; cv.h = h;
      cv.onResize && cv.onResize();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    cv.destroy = () => ro.disconnect();
    // Chuyển tọa độ chuột/chạm sang tọa độ canvas
    cv.pointer = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    resize();
    return cv;
  };

  // Phép biến đổi giữa tọa độ dữ liệu và điểm ảnh
  App.view = function (cv, { xmin, xmax, ymin, ymax, pad = { l: 44, r: 14, t: 14, b: 32 } }) {
    const W = () => cv.w - pad.l - pad.r, H = () => cv.h - pad.t - pad.b;
    return {
      xmin, xmax, ymin, ymax, pad,
      sx: (x) => pad.l + ((x - xmin) / (xmax - xmin)) * W(),
      sy: (y) => pad.t + (1 - (y - ymin) / (ymax - ymin)) * H(),
      ix: (px) => xmin + ((px - pad.l) / W()) * (xmax - xmin),
      iy: (py) => ymin + (1 - (py - pad.t) / H()) * (ymax - ymin),
    };
  };

  App.niceTicks = function (min, max, count = 5) {
    const range = max - min;
    if (range <= 0 || !isFinite(range)) return [min];
    const raw = range / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return ticks;
  };

  App.drawAxes = function (cv, v, { xlabel = '', ylabel = '', xticks = 5, yticks = 5, yfmt, xfmt } = {}) {
    const { ctx } = cv;
    ctx.save();
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const fx = xfmt || ((t) => +t.toFixed(2));
    const fy = yfmt || ((t) => +t.toFixed(2));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    App.niceTicks(v.xmin, v.xmax, xticks).forEach((t) => {
      const x = v.sx(t);
      ctx.beginPath(); ctx.moveTo(x, v.pad.t); ctx.lineTo(x, cv.h - v.pad.b); ctx.stroke();
      ctx.fillText(fx(t), x, cv.h - v.pad.b + 6);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    App.niceTicks(v.ymin, v.ymax, yticks).forEach((t) => {
      const y = v.sy(t);
      ctx.beginPath(); ctx.moveTo(v.pad.l, y); ctx.lineTo(cv.w - v.pad.r, y); ctx.stroke();
      ctx.fillText(fy(t), v.pad.l - 6, y);
    });
    ctx.fillStyle = 'rgba(203,213,225,0.9)';
    ctx.font = '600 11.5px "Be Vietnam Pro", sans-serif';
    if (xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xlabel, cv.w - v.pad.r, cv.h - v.pad.b - 4); }
    if (ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(ylabel, v.pad.l + 6, v.pad.t + 2); }
    ctx.restore();
  };

  // Biểu đồ đường dùng cho đường cong Loss; hỗ trợ trục log vì loss thường giảm theo cấp số nhân
  App.lineChart = function (cv, series, { logY = false, xlabel = '', ylabel = '', hlines = [], vline = null, xmin = null, xmax = null, ymin = null, ymax = null } = {}) {
    const { ctx } = cv;
    ctx.clearRect(0, 0, cv.w, cv.h);
    const tf = (y) => (logY ? Math.log10(Math.max(y, 1e-6)) : y);
    let n = 0, lo = Infinity, hi = -Infinity;
    series.forEach((s) => {
      n = Math.max(n, s.data.length);
      s.data.forEach((p) => { const y = tf(Array.isArray(p) ? p[1] : p); if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    });
    hlines.forEach((h) => { const y = tf(h.y); lo = Math.min(lo, y); hi = Math.max(hi, y); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (ymin !== null) lo = tf(ymin);
    if (ymax !== null) hi = tf(ymax);
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    const padY = (hi - lo) * 0.08;
    const v = App.view(cv, { xmin: xmin !== null ? xmin : 0, xmax: xmax !== null ? xmax : Math.max(n - 1, 1), ymin: lo - padY, ymax: hi + padY, pad: { l: 48, r: 14, t: 14, b: 30 } });
    App.drawAxes(cv, v, { xlabel, ylabel, yfmt: logY ? (t) => { const val = Math.pow(10, t); return val >= 100 ? val.toFixed(0) : val >= 1 ? +val.toFixed(1) : +val.toPrecision(1); } : undefined, xfmt: (t) => Math.round(t) });
    hlines.forEach((h) => {
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = h.color || 'rgba(52,211,153,0.8)'; ctx.lineWidth = 1.5;
      const y = v.sy(tf(h.y)); ctx.beginPath(); ctx.moveTo(v.pad.l, y); ctx.lineTo(cv.w - v.pad.r, y); ctx.stroke();
      if (h.label) { ctx.setLineDash([]); ctx.fillStyle = h.color || 'rgba(52,211,153,0.9)'; ctx.font = '11px "Be Vietnam Pro"'; ctx.textAlign = 'left'; ctx.fillText(h.label, v.pad.l + 6, y - 6); }
      ctx.restore();
    });
    if (vline !== null) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 4]);
      const x = v.sx(vline); ctx.beginPath(); ctx.moveTo(x, v.pad.t); ctx.lineTo(x, cv.h - v.pad.b); ctx.stroke(); ctx.restore();
    }
    series.forEach((s) => {
      if (!s.data.length) return;
      ctx.save();
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2; ctx.lineJoin = 'round';
      ctx.shadowColor = s.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      let started = false;
      s.data.forEach((p, i) => {
        const xv = Array.isArray(p) ? p[0] : i, yv = tf(Array.isArray(p) ? p[1] : p);
        if (!isFinite(yv)) return;
        const x = v.sx(xv), y = v.sy(Math.min(Math.max(yv, v.ymin), v.ymax));
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        started = true;
      });
      ctx.stroke();
      if (s.dots) {
        ctx.shadowBlur = 0; ctx.fillStyle = s.color;
        s.data.forEach((p, i) => { const xv = Array.isArray(p) ? p[0] : i, yv = tf(Array.isArray(p) ? p[1] : p); if (!isFinite(yv)) return; ctx.beginPath(); ctx.arc(v.sx(xv), v.sy(Math.min(Math.max(yv, v.ymin), v.ymax)), 3, 0, 7); ctx.fill(); });
      }
      ctx.restore();
    });
    return v;
  };

  App.dot = function (ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  };

  // Bảng màu "plasma" rút gọn: giá trị thấp tối, giá trị cao sáng
  const PLASMA = [[13, 8, 135], [84, 2, 163], [139, 10, 165], [185, 50, 137], [219, 92, 104], [244, 136, 73], [254, 188, 43], [240, 249, 33]];
  App.plasma = function (t) {
    t = Math.min(1, Math.max(0, t)) * (PLASMA.length - 1);
    const i = Math.min(PLASMA.length - 2, Math.floor(t)), f = t - i;
    return PLASMA[i].map((c, k) => Math.round(c + (PLASMA[i + 1][k] - c) * f));
  };
  App.PALETTE = ['#22d3ee', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#f87171'];

  // ---------- Khung trang bài học ----------
  App.shell = function (root, lesson, theoryHtml) {
    const list = App.lessonsOf(App.courseOf(lesson));
    const idx = list.indexOf(lesson);
    const prev = list[idx - 1], next = list[idx + 1];
    const el = App.h(`<section class="lesson">
      <header class="lesson-head reveal">
        <span class="badge">${lesson.badge}</span>
        <h1>${lesson.title}</h1>
        <p class="lead">${lesson.lead}</p>
      </header>
      <div class="lesson-grid">
        <article class="card theory reveal" aria-label="Lý thuyết">${theoryHtml}</article>
        <div class="card sim reveal" id="sim-${lesson.id}" aria-label="Mô phỏng tương tác"></div>
      </div>
      ${lesson.labs ? `<section class="card reveal" aria-labelledby="lab-h-${lesson.id}">
        <div class="section-head"><h2 id="lab-h-${lesson.id}">🧪 Bài lab thực hành</h2><span class="pill" id="lab-count-${lesson.id}"></span></div>
        <p class="muted">Làm từng nhiệm vụ trên mô phỏng phía trên. Nhiệm vụ có nút <b>Kiểm tra</b> sẽ được hệ thống tự xác nhận khi bạn đạt yêu cầu.</p>
        <div class="lab"></div></section>` : ''}
      ${lesson.quiz ? `<section class="card reveal" aria-labelledby="quiz-h-${lesson.id}">
        <div class="section-head"><h2 id="quiz-h-${lesson.id}">✅ Kiểm tra kiến thức</h2><span class="pill" id="quiz-best-${lesson.id}"></span></div>
        <div class="quiz"></div></section>` : ''}
      <nav class="lesson-nav" aria-label="Chuyển bài">
        ${prev ? `<a href="${App.url(prev)}" class="btn ghost" id="prev-lesson">← ${prev.navTitle || prev.title}</a>` : '<span></span>'}
        ${next ? `<a href="${App.url(next)}" class="btn primary" id="next-lesson">${next.navTitle || next.title} →</a>` : ''}
      </nav>
    </section>`);
    root.appendChild(el);
    return { el, sim: el.querySelector('.sim'), lab: el.querySelector('.lab'), quiz: el.querySelector('.quiz') };
  };

  // ---------- Bài lab: nhiệm vụ tự kiểm tra dựa trên trạng thái mô phỏng ----------
  App.labUI = function (container, lesson, ctx) {
    if (!container) return;
    const countEl = document.getElementById('lab-count-' + lesson.id);
    const done = () => store.labDone(lesson.id);
    const updateCount = () => {
      const n = lesson.labs.filter((t) => done()[t.id]).length;
      countEl.textContent = `${n}/${lesson.labs.length} nhiệm vụ`;
      countEl.classList.toggle('ok', n === lesson.labs.length);
    };
    const nodes = {};
    lesson.labs.forEach((t, i) => {
      const el = App.h(`<div class="task ${done()[t.id] ? 'done' : ''}" id="task-${lesson.id}-${t.id}">
        <div class="task-num">${done()[t.id] ? '✓' : i + 1}</div>
        <div>
          <div class="task-title">${t.title}</div>
          <div class="task-desc">${t.desc}</div>
          <div class="task-actions">
            ${t.check ? `<button class="btn small primary" data-a="check" id="check-${lesson.id}-${t.id}">Kiểm tra</button>` : `<button class="btn small primary" data-a="manual" id="manual-${lesson.id}-${t.id}">Tôi đã làm xong</button>`}
            ${t.hint ? `<button class="btn small ghost" data-a="hint">💡 Gợi ý</button>` : ''}
            ${t.reflect ? `<button class="btn small ghost" data-a="reflect">🤔 Giải thích</button>` : ''}
            <span class="task-msg" aria-live="polite"></span>
          </div>
          ${t.hint ? `<div class="reveal-box hint" hidden>${t.hint}</div>` : ''}
          ${t.reflect ? `<div class="reveal-box explain" hidden><b>${t.reflect.q}</b><br>${t.reflect.a}</div>` : ''}
        </div></div>`);
      nodes[t.id] = el;
      container.appendChild(el);
      const msg = el.querySelector('.task-msg');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const a = b.dataset.a;
        if (a === 'hint') el.querySelector('.reveal-box.hint').hidden ^= true;
        if (a === 'reflect') el.querySelector('.reveal-box.explain').hidden ^= true;
        if (a === 'manual') complete(t);
        if (a === 'check') {
          const r = t.check(lesson.state || {});
          if (r.ok) complete(t);
          else { msg.className = 'task-msg no'; msg.textContent = r.msg || 'Chưa đạt, hãy thử lại nhé.'; }
        }
      });
    });
    function complete(t) {
      const el = nodes[t.id];
      const msg = el.querySelector('.task-msg');
      msg.className = 'task-msg ok';
      msg.textContent = '✓ Hoàn thành!';
      if (store.setLab(lesson.id, t.id)) {
        el.classList.add('done');
        el.querySelector('.task-num').textContent = '✓';
        App.toast(`🎉 Hoàn thành nhiệm vụ: <b>${t.title}</b>`, 'ok');
        if (t.reflect) el.querySelector('.reveal-box.explain').hidden = false;
      }
      updateCount();
    }
    // Tự động xác nhận nhiệm vụ khi người học đạt yêu cầu, không cần bấm nút
    ctx.interval(() => {
      lesson.labs.forEach((t) => { if (t.check && !done()[t.id] && t.check(lesson.state || {}).ok) complete(t); });
    }, 700);
    updateCount();
  };

  // ---------- Bài kiểm tra trắc nghiệm có giải thích ngay sau mỗi câu ----------
  App.quizUI = function (container, lesson) {
    if (!container) return;
    const qs = lesson.quiz;
    const bestEl = document.getElementById('quiz-best-' + lesson.id);
    const showBest = () => {
      const b = store.quiz(lesson.id);
      bestEl.textContent = b ? `Điểm cao nhất: ${b.score}/${b.total}` : `${qs.length} câu hỏi`;
      bestEl.classList.toggle('ok', !!b && b.score === b.total);
    };
    let idx = 0, score = 0, wrong = [];
    const keys = ['A', 'B', 'C', 'D', 'E'];
    function renderQ() {
      const q = qs[idx];
      container.innerHTML = '';
      const el = App.h(`<div class="quiz-card">
        <div class="quiz-top"><span>Câu ${idx + 1}/${qs.length}</span><div class="bar quiz-bar"><span style="width:${(idx / qs.length) * 100}%"></span></div><span>Đúng: ${score}</span></div>
        <div class="quiz-q">${q.q}</div>
        <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}" id="opt-${lesson.id}-${idx}-${i}"><span class="key">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
        <div class="quiz-slot"></div>
      </div>`);
      container.appendChild(el);
      el.querySelector('.opts').addEventListener('click', (e) => {
        const b = e.target.closest('.opt');
        if (!b || b.disabled) return;
        const i = +b.dataset.i;
        const ok = i === q.answer;
        if (ok) score++; else wrong.push(q);
        el.querySelectorAll('.opt').forEach((x, j) => { x.disabled = true; if (j === q.answer) x.classList.add('correct'); });
        if (!ok) b.classList.add('wrong');
        const slot = el.querySelector('.quiz-slot');
        slot.appendChild(App.h(`<div class="quiz-explain ${ok ? 'ok' : 'no'}"><b>${ok ? '✅ Chính xác!' : '❌ Chưa đúng.'}</b> ${q.explain}</div>`));
        const last = idx === qs.length - 1;
        const foot = App.h(`<div class="quiz-foot"><button class="btn primary" id="quiz-next-${lesson.id}">${last ? 'Xem kết quả' : 'Câu tiếp theo →'}</button></div>`);
        slot.appendChild(foot);
        foot.querySelector('button').addEventListener('click', () => { idx++; last ? renderResult() : renderQ(); });
        foot.querySelector('button').focus({ preventScroll: true });
      });
    }
    function renderResult() {
      store.setQuiz(lesson.id, score, qs.length);
      showBest();
      const pct = score / qs.length, C = 2 * Math.PI * 54;
      const msg = pct === 1 ? '🏆 Xuất sắc! Bạn đã nắm vững bài này.' : pct >= 0.7 ? '👍 Tốt lắm! Xem lại các câu sai bên dưới để hiểu trọn vẹn.' : '📚 Hãy đọc lại phần lý thuyết và thử lại mô phỏng, rồi làm lại bài kiểm tra.';
      container.innerHTML = '';
      const el = App.h(`<div class="quiz-result">
        <div class="score-ring"><svg viewBox="0 0 120 120"><defs><linearGradient id="scoreGrad"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs>
        <circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><strong>${score}/${qs.length}</strong></div>
        <p>${msg}</p>
        ${wrong.length ? `<div class="review"><b>Các câu cần xem lại:</b>${wrong.map((q) => `<div class="review-item"><b>${q.q}</b><br>Đáp án: ${q.options[q.answer]}. <span class="muted">${q.explain}</span></div>`).join('')}</div>` : ''}
        <button class="btn primary" id="quiz-retry-${lesson.id}">↻ Làm lại</button>
      </div>`);
      container.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.querySelector('.fg').style.strokeDashoffset = C * (1 - pct))));
      el.querySelector('button').addEventListener('click', () => { idx = 0; score = 0; wrong = []; renderQ(); });
    }
    showBest();
    renderQ();
  };

  // ---------- Điều hướng (hash router) ----------
  App.register = (lesson) => App.lessons.push(lesson);
  let cleanups = [];
  let activeId = null;

  function ring(p) {
    const r = 9, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 24 24" aria-label="Tiến độ ${Math.round(p * 100)}%"><circle cx="12" cy="12" r="${r}" class="ring-bg"/><circle cx="12" cy="12" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    const course = App.courses[App.activeCourse];
    let lastGroup = null, html = '';
    App.lessonsOf(course.id).forEach((l) => {
      if (l.group && l.group !== lastGroup) { html += `<div class="nav-group">${l.group}</div>`; lastGroup = l.group; }
      const tracked = l.labs || l.quiz;
      html += `<a href="${App.url(l)}" id="nav-${l.id}" class="nav-item ${l.id === activeId ? 'active' : ''}" ${l.id === activeId ? 'aria-current="page"' : ''}>
        <span class="nav-icon">${l.icon}</span>
        <span class="nav-text"><span class="nav-title">${l.navTitle || l.title}</span>${l.navSub ? `<span class="nav-sub">${l.navSub}</span>` : ''}</span>
        ${tracked ? ring(App.lessonProgress(l)) : ''}</a>`;
    });
    // Các bài đã lên lộ trình nhưng chưa phát hành (hiển thị mờ để người học biết hướng đi tiếp)
    (course.upcoming || []).forEach((u) => {
      if (u.group && u.group !== lastGroup) { html += `<div class="nav-group">${u.group}</div>`; lastGroup = u.group; }
      html += `<div class="nav-item soon" aria-disabled="true"><span class="nav-icon">${u.icon}</span><span class="nav-text"><span class="nav-title">${u.title}</span><span class="nav-sub">Sắp ra mắt</span></span></div>`;
    });
    nav.innerHTML = html;
    const overall = App.overallProgress(course.id);
    document.getElementById('overall-pct').textContent = Math.round(overall * 100) + '%';
    document.getElementById('overall-bar').style.width = overall * 100 + '%';
    document.querySelectorAll('.brand-sub').forEach((n) => (n.textContent = course.sub));
    const sw = document.getElementById('course-switch');
    if (sw) sw.querySelectorAll('button').forEach((b) => { const on = b.dataset.v === course.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  App.overallProgress = (course = App.activeCourse) => {
    const tracked = App.lessonsOf(course).filter((l) => l.kind !== 'resources' && (l.labs || l.quiz));
    return tracked.reduce((s, l) => s + App.lessonProgress(l), 0) / Math.max(1, tracked.length);
  };

  // Phân tích hash: "#/<khóa>/<bài>"; dạng cũ "#/<bài>" được đổi tại chỗ bằng replaceState
  function resolveRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] && App.courses[parts[0]]) {
      const course = App.courses[parts[0]];
      const lesson = App.lessonsOf(course.id).find((l) => l.id === (parts[1] || course.home)) || App.lessons.find((l) => l.id === course.home) || App.lessonsOf(course.id)[0];
      return lesson;
    }
    if (parts[0]) {
      const old = App.lessons.find((l) => l.id === parts[0]);
      if (old) { history.replaceState(null, '', App.url(old)); return old; }
    }
    let last = 'ai';
    try { last = localStorage.getItem(LAST_COURSE) || 'ai'; } catch (e) { /* bỏ qua */ }
    const c = App.courses[last] || App.courses.ai;
    const home = App.lessons.find((l) => l.id === c.home) || App.lessons[0];
    history.replaceState(null, '', App.url(home));
    return home;
  }

  function navigate() {
    const lesson = resolveRoute();
    cleanups.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    cleanups = [];
    activeId = lesson.id;
    App.activeCourse = App.courseOf(lesson);
    document.body.dataset.course = App.activeCourse;
    try { localStorage.setItem(LAST_COURSE, App.activeCourse); } catch (e) { /* chế độ ẩn danh */ }
    const main = document.getElementById('main');
    main.innerHTML = '';
    window.scrollTo(0, 0);
    // ctx cung cấp vòng lặp hoạt ảnh và bộ hẹn giờ tự dọn dẹp khi rời trang, tránh rò rỉ bộ nhớ
    const ctx = {
      onCleanup: (f) => cleanups.push(f),
      loop(fn) {
        let raf, last = performance.now();
        const tick = (t) => { const dt = Math.min(64, t - last); last = t; fn(dt); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        cleanups.push(() => cancelAnimationFrame(raf));
      },
      interval(fn, ms) { const h = setInterval(fn, ms); cleanups.push(() => clearInterval(h)); },
      canvas(parent, opts) { const cv = App.canvas(parent, opts); cleanups.push(cv.destroy); return cv; },
    };
    lesson.render(main, ctx);
    if (App.studyUI) App.studyUI(main, lesson);
    const course = App.courses[App.activeCourse];
    document.title = (lesson.id === course.home ? '' : (lesson.navTitle || lesson.title) + ' · ') + `Visual Lab — ${course.title}`;
    renderNav();
    document.body.classList.remove('nav-open');
  }

  App.start = function () {
    if (App.registerResourcePages) App.registerResourcePages();
    window.addEventListener('hashchange', navigate);
    App.on('progress', renderNav);
    document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
    const sideClose = document.getElementById('sidebar-close');
    if (sideClose) sideClose.addEventListener('click', () => document.body.classList.remove('nav-open'));
    // Đóng sidebar trên mobile khi người dùng chọn bất kỳ bài học nào
    document.getElementById('nav').addEventListener('click', (e) => {
      if (e.target.closest('a')) document.body.classList.remove('nav-open');
    });
    // Nút chuyển khóa: về trang chủ của khóa được chọn
    const sw = document.getElementById('course-switch');
    if (sw) {
      sw.innerHTML = Object.values(App.courses).map((c) => `<button type="button" data-v="${c.id}" id="course-${c.id}"><span aria-hidden="true">${c.icon}</span> ${c.name}</button>`).join('');
      sw.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) {
          document.body.classList.remove('nav-open');
          if (b.dataset.v !== App.activeCourse) location.hash = App.url(App.courses[b.dataset.v].home);
        }
      });
    }
    document.getElementById('brand-link').addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.remove('nav-open');
      location.hash = App.url(App.courses[App.activeCourse].home);
    });
    document.getElementById('reset-progress').addEventListener('click', () => {
      const c = App.courses[App.activeCourse];
      if (confirm(`Xóa tiến độ lab và điểm kiểm tra của khóa ${c.name}?`)) {
        store.resetCourse(c.id);
        document.body.classList.remove('nav-open');
        navigate();
        App.toast('Đã xóa tiến độ.');
      }
    });
    navigate();
  };
})();
