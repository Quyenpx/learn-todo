/*
 * pycourse-ui.js — Giao diện bài học khóa "Python cho AI".
 * Khung mã có tô dòng đang chạy, nút đi từng bước, bảng biến, đầu ra và hình minh họa (lưới mảng, bảng, biểu đồ).
 * Mọi nội dung do người học nhập hoặc do mô phỏng sinh ra đều gán qua textContent để không thể chèn HTML.
 */
(function () {
  'use strict';
  const App = window.App;
  function node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  const readValue = (c, raw) => (['range', 'number'].includes(c.type) ? (String(raw).trim() === '' ? NaN : Number(raw)) : raw);

  // Lưới mảng NumPy: tối đa 2 chiều được vẽ thành ô; mảng 3 chiều hiển thị từng lát
  function drawGrid(parent, item) {
    const box = node('figure', undefined, 'py-grid-box');
    box.appendChild(node('figcaption', item.title));
    const slices = Array.isArray(item.data) && Array.isArray(item.data[0]) && Array.isArray(item.data[0][0]) ? item.data : [item.data];
    slices.forEach((s) => {
      const rows = Array.isArray(s) ? (Array.isArray(s[0]) ? s : [s]) : [[s]];
      const grid = node('div', undefined, 'py-grid');
      grid.style.gridTemplateColumns = `repeat(${rows[0].length}, minmax(34px, auto))`;
      rows.forEach((r) => r.forEach((v) => grid.appendChild(node('span', typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v)))));
      box.appendChild(grid);
    });
    parent.appendChild(box);
  }
  function drawTable(parent, item) {
    const wrap = node('div', undefined, 'table-scroll');
    const table = node('table', undefined, 'compare py-table');
    if (item.title) table.appendChild(node('caption', item.title));
    const head = node('tr');
    item.columns.forEach((c) => head.appendChild(node('th', c)));
    const thead = node('thead'); thead.appendChild(head); table.appendChild(thead);
    const body = node('tbody');
    item.rows.forEach((r) => {
      const tr = node('tr');
      r.forEach((v) => tr.appendChild(node('td', v === null || v === undefined || Number.isNaN(v) ? 'NaN' : String(v), v === null || Number.isNaN(v) ? 'py-nan' : undefined)));
      body.appendChild(tr);
    });
    table.appendChild(body); wrap.appendChild(table); parent.appendChild(wrap);
  }

  App.renderPythonLesson = function (root, ctx, lesson) {
    const exp = lesson.experiment;
    const sections = ((lesson.study && lesson.study.sections) || []).map((s) => `<h2>${s.title}</h2>${s.html}`).join('');
    const view = App.shell(root, lesson, sections);
    const state = (lesson.state = { input: { ...exp.defaults }, result: null, history: [], step: 0 });
    const sim = view.sim;

    sim.appendChild(node('h2', 'Thử và quan sát'));
    sim.appendChild(node('p', 'Sửa đầu vào, bấm Chạy, rồi đi từng bước để xem dòng nào chạy và biến thay đổi ra sao. Đây là mô phỏng bằng JavaScript của đoạn mã, không phải Python thật; chạy notebook để kiểm chứng trên máy.', 'muted'));

    // Ô điều khiển
    const fields = {};
    const controls = node('div', undefined, 'experiment-controls py-controls');
    exp.controls.forEach((c) => {
      const label = node('label', undefined, 'control');
      label.appendChild(node('span', c.label));
      const input = node(c.type === 'textarea' ? 'textarea' : c.type === 'select' ? 'select' : 'input');
      input.id = lesson.id + '-' + c.key;
      if (!['textarea', 'select'].includes(c.type)) input.type = c.type;
      ['min', 'max', 'step'].forEach((k) => { if (c[k] !== undefined) input[k] = c[k]; });
      (c.options || []).forEach((o) => { const opt = node('option', o.label || o); opt.value = o.value !== undefined ? o.value : o; input.appendChild(opt); });
      input.value = state.input[c.key];
      fields[c.key] = input;
      label.appendChild(input);
      controls.appendChild(label);
    });
    sim.appendChild(controls);

    const actions = node('div', undefined, 'experiment-actions');
    const runBtn = node('button', '▶ Chạy', 'btn primary'), resetBtn = node('button', '↺ Đặt lại', 'btn');
    runBtn.type = resetBtn.type = 'button';
    runBtn.id = lesson.id + '-run'; resetBtn.id = lesson.id + '-reset';
    actions.appendChild(runBtn); actions.appendChild(resetBtn);
    sim.appendChild(actions);
    const status = node('p', 'Chưa chạy. Các nhiệm vụ chỉ được chấm sau khi bấm Chạy.', 'muted py-status');
    status.setAttribute('role', 'status');
    sim.appendChild(status);

    // Khung mã + bước
    const codeBox = node('div', undefined, 'py-code');
    codeBox.setAttribute('aria-label', 'Mã Python minh họa');
    sim.appendChild(codeBox);
    const stepper = node('div', undefined, 'py-stepper');
    const btn = (text, id, label) => { const b = node('button', text, 'btn small'); b.type = 'button'; b.id = lesson.id + '-' + id; b.setAttribute('aria-label', label); stepper.appendChild(b); return b; };
    const firstBtn = btn('⏮', 'first', 'Về bước đầu'), prevBtn = btn('◀ Trước', 'prev', 'Bước trước');
    const stepLabel = node('span', 'Bước 0/0', 'py-step-label'); stepLabel.setAttribute('aria-live', 'polite'); stepper.appendChild(stepLabel);
    const nextBtn = btn('Tiếp ▶', 'next', 'Bước tiếp'), lastBtn = btn('⏭', 'last', 'Đến bước cuối');
    sim.appendChild(stepper);

    const panels = node('div', undefined, 'py-panels');
    const varsBox = node('div', undefined, 'py-vars');
    const outBox = node('div', undefined, 'py-out-box');
    outBox.appendChild(node('h3', 'Đầu ra'));
    const out = node('pre', 'Kết quả print sẽ xuất hiện tại đây.', 'py-out');
    out.setAttribute('aria-live', 'polite');
    outBox.appendChild(out);
    panels.appendChild(varsBox); panels.appendChild(outBox);
    sim.appendChild(panels);
    const visualBox = node('div', undefined, 'py-visual');
    sim.appendChild(visualBox);

    function paintCode(lines, active, isError) {
      codeBox.textContent = '';
      lines.forEach((text, i) => {
        const row = node('div', undefined, 'py-line' + (i + 1 === active ? (isError ? ' err' : ' on') : ''));
        row.appendChild(node('span', String(i + 1), 'ln'));
        row.appendChild(node('code', text));
        codeBox.appendChild(row);
      });
    }
    function paintVars(vars) {
      varsBox.textContent = '';
      varsBox.appendChild(node('h3', 'Biến'));
      const keys = Object.keys(vars || {});
      if (!keys.length) { varsBox.appendChild(node('p', 'Chưa có biến.', 'muted')); return; }
      const dl = node('dl');
      keys.forEach((k) => { dl.appendChild(node('dt', k)); dl.appendChild(node('dd', vars[k])); });
      varsBox.appendChild(dl);
    }
    function paintVisual(visual) {
      visualBox.textContent = '';
      if (!visual) return;
      (Array.isArray(visual) ? visual : [visual]).forEach((v) => {
        if (v.type === 'grid') drawGrid(visualBox, v);
        if (v.type === 'table') drawTable(visualBox, v);
        if (v.type === 'chart') {
          visualBox.appendChild(node('h3', v.title));
          const cv = ctx.canvas(visualBox, { height: 220 });
          const draw = () => App.lineChart(cv, v.series, { xlabel: v.xlabel || '', ylabel: v.ylabel || '', logY: !!v.logY });
          cv.onResize = draw; draw();
          const legend = node('p', v.series.map((s) => '— ' + s.label).join('   '), 'muted');
          visualBox.appendChild(legend);
        }
      });
    }
    function paint() {
      const r = state.result;
      const lines = exp.code(state.result ? state.input : { ...exp.defaults, ...state.input });
      if (!r) { paintCode(lines, 0, false); paintVars({}); stepLabel.textContent = 'Bước 0/0'; out.textContent = 'Kết quả print sẽ xuất hiện tại đây.'; paintVisual(null); return; }
      const n = r.trace.length, k = Math.min(state.step, Math.max(0, n - 1)), cur = r.trace[k];
      paintCode(lines, cur ? cur.line : 0, !!(cur && cur.error));
      paintVars(cur ? cur.vars : {});
      stepLabel.textContent = `Bước ${n ? k + 1 : 0}/${n}${r.truncated ? ' (đã rút gọn)' : ''}`;
      const shown = cur ? r.output.slice(0, cur.out) : r.output;
      out.textContent = shown.length ? shown.join('\n') : '(chưa có đầu ra ở bước này)';
      out.classList.toggle('err', !!(cur && cur.error));
      [firstBtn, prevBtn].forEach((b) => (b.disabled = k <= 0));
      [nextBtn, lastBtn].forEach((b) => (b.disabled = k >= n - 1));
    }
    function go(k) { if (state.result) { state.step = Math.max(0, Math.min(k, state.result.trace.length - 1)); paint(); } }
    firstBtn.addEventListener('click', () => go(0));
    prevBtn.addEventListener('click', () => go(state.step - 1));
    nextBtn.addEventListener('click', () => go(state.step + 1));
    lastBtn.addEventListener('click', () => go(Infinity));

    runBtn.addEventListener('click', () => {
      exp.controls.forEach((c) => (state.input[c.key] = readValue(c, fields[c.key].value)));
      const result = exp.run({ ...state.input });
      state.result = result;
      state.history.push({ input: { ...state.input }, result });
      state.step = Math.max(0, result.trace.length - 1);
      if (result.inputError) status.textContent = 'Đầu vào chưa hợp lệ: ' + result.inputError;
      else if (result.error && result.error.type === 'SimulationError') status.textContent = 'Mô phỏng gặp lỗi: ' + result.error.message;
      else if (result.error) status.textContent = `Chương trình dừng ở dòng ${result.error.line} với ${result.error.type}. Đọc dòng cuối của đầu ra để biết nguyên nhân.`;
      else status.textContent = `Đã chạy ${state.history.length} lần, ${result.trace.length} bước. Dùng nút ◀ ▶ để xem lại từng bước.`;
      paint();
      paintVisual(result.visual);
    });
    resetBtn.addEventListener('click', () => {
      state.input = { ...exp.defaults }; state.result = null; state.history = []; state.step = 0;
      Object.keys(fields).forEach((k) => (fields[k].value = state.input[k]));
      status.textContent = 'Đã đặt lại đầu vào và lịch sử chạy. Tiến độ đã đạt vẫn được lưu.';
      paint();
    });
    // Khung mã cập nhật theo đầu vào ngay khi gõ (trước khi chạy) để người học thấy đoạn mã sẽ chạy
    Object.keys(fields).forEach((k) => fields[k].addEventListener('input', () => {
      if (state.result) return;
      const c = exp.controls.find((x) => x.key === k);
      state.input[k] = readValue(c, fields[k].value);
      try { paint(); } catch (e) { /* đầu vào dở dang: giữ khung mã cũ */ }
    }));
    paint();
    App.labUI(view.lab, lesson, ctx);
    App.quizUI(view.quiz, lesson);
  };
})();
