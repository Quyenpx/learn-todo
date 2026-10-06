/*
 * ui-devops.js — Thành phần giao diện dùng chung cho khóa DevOps:
 * terminal giả lập, trình sửa file, sơ đồ trạng thái Docker và sơ đồ lớp image.
 * Mọi chuỗi từ bộ mô phỏng đều gán bằng textContent (không dùng innerHTML) để tránh chèn HTML.
 */
(function () {
  'use strict';
  const App = window.App;

  // ---------- Terminal ----------
  App.terminal = function (parent, { engine, welcome = [], chips = [], onExec, height = 320, title = 'Terminal — máy ảo lab' } = {}) {
    const el = App.h(`<div class="term" role="region" aria-label="Terminal giả lập">
      <div class="term-bar"><i></i><i></i><i></i><span class="t"></span><button type="button" data-a="clear" title="Xóa màn hình (Ctrl+L)">Xóa</button></div>
      <div class="term-out" role="log" aria-live="polite"></div>
      <div class="term-opts" hidden></div>
      <label class="term-input"><span class="ps"></span><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Nhập lệnh"></label>
      ${chips.length ? '<div class="chips" aria-label="Lệnh mẫu"></div>' : ''}
    </div>`);
    el.querySelector('.t').textContent = title;
    parent.appendChild(el);
    const out = el.querySelector('.term-out'), input = el.querySelector('input'), ps = el.querySelector('.term-input .ps'), opts = el.querySelector('.term-opts');
    out.style.height = height + 'px';
    const hist = [];
    let hi = 0;

    function line(text, cls) {
      const d = document.createElement('div');
      d.className = 'term-line' + (cls ? ' ' + cls : '');
      d.textContent = text;
      out.appendChild(d);
      return d;
    }
    function print(lines) { lines.forEach((l) => (typeof l === 'string' ? line(l) : line(l.text, l.cls))); out.scrollTop = out.scrollHeight; }
    function clear() { out.innerHTML = ''; }
    const setPrompt = () => { ps.textContent = engine.prompt(); };

    function run(cmd) {
      const d = line('', 'cmd');
      const p = document.createElement('span'); p.className = 'ps'; p.textContent = engine.prompt() + ' ';
      d.appendChild(p); d.appendChild(document.createTextNode(cmd));
      opts.hidden = true;
      if (cmd.trim()) { hist.push(cmd); hi = hist.length; }
      const r = engine.exec(cmd);
      if (r.clear) clear();
      print(r.lines);
      setPrompt();
      onExec && onExec(cmd, r);
      return r;
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const r = engine.complete(input.value);
        input.value = r.line;
        opts.hidden = !r.options.length;
        opts.textContent = r.options.join('   ');
      } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clear(); }
      else if (e.key === 'c' && e.ctrlKey) {
        if (input.selectionStart !== input.selectionEnd) return; // đang bôi đen: để trình duyệt sao chép
        line(engine.prompt() + ' ' + input.value + '^C', 'dim'); input.value = '';
      }
    });
    out.addEventListener('click', () => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); });
    el.querySelector('[data-a="clear"]').addEventListener('click', clear);
    if (chips.length) {
      const box = el.querySelector('.chips');
      chips.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = c; b.title = 'Bấm để chạy lệnh này';
        b.addEventListener('click', () => { run(c); input.focus({ preventScroll: true }); });
        box.appendChild(b);
      });
    }
    print(welcome.map((t) => ({ text: t, cls: 'welcome' })));
    setPrompt();
    return { el, run, print, clear, focus: () => input.focus({ preventScroll: true }), refresh: setPrompt };
  };

  // ---------- Trình sửa file trong thư mục lab ----------
  App.fileEditor = function (parent, { engine, files, onChange } = {}) {
    const el = App.h(`<div class="fed">
      <div class="fed-tabs" role="tablist"></div>
      <div class="fed-body"><div class="fed-gutter" aria-hidden="true"></div><textarea class="fed-area" spellcheck="false" aria-label="Nội dung file"></textarea></div>
      <div class="fed-foot"><span class="fed-info">Sửa trực tiếp — thay đổi được lưu ngay vào thư mục lab (~/lab)</span><button type="button" class="btn small ghost" data-a="reset">↺ Khôi phục file gốc</button></div>
    </div>`);
    parent.appendChild(el);
    const tabs = el.querySelector('.fed-tabs'), area = el.querySelector('.fed-area'), gutter = el.querySelector('.fed-gutter'), info = el.querySelector('.fed-info');
    let current = files[0], badLine = 0;
    const content = (n) => (typeof engine.files[n] === 'string' ? engine.files[n] : '');

    function renderTabs() {
      tabs.innerHTML = '';
      files.forEach((n) => {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = n;
        b.className = (n === current ? 'on ' : '') + (content(n) !== (engine.initialFiles[n] || '') ? 'dirty' : '');
        b.setAttribute('aria-selected', n === current);
        b.addEventListener('click', () => select(n));
        tabs.appendChild(b);
      });
    }
    function renderGutter() {
      const n = area.value.split('\n').length;
      gutter.innerHTML = '';
      for (let i = 1; i <= n; i++) {
        const s = document.createElement('div');
        s.textContent = i;
        if (i === badLine) s.className = 'bad';
        gutter.appendChild(s);
      }
      area.style.height = 'auto';
      area.style.height = Math.max(220, area.scrollHeight) + 'px';
    }
    function select(n) { current = n; badLine = 0; area.value = content(n); renderTabs(); renderGutter(); }
    function highlight(line) { badLine = line; renderGutter(); }

    area.addEventListener('input', () => {
      engine.setFile(current, area.value);
      badLine = 0;
      renderGutter(); renderTabs();
      onChange && onChange(current, area.value);
    });
    // Tab chèn 2 khoảng trắng (YAML không cho phép ký tự tab)
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = area.selectionStart;
      area.setRangeText('  ', s, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input'));
    });
    el.querySelector('[data-a="reset"]').addEventListener('click', () => { engine.resetFile(current); select(current); });
    const offFiles = engine.on('files', () => { if (document.activeElement !== area) select(current); });
    const offEvt = engine.on('event', (e) => {
      if (e.type === 'fileError' && files.includes(e.file)) { if (current !== e.file) select(e.file); highlight(e.line); info.textContent = `⚠ Lỗi ở dòng ${e.line} của ${e.file}`; }
      if (e.type === 'build') info.textContent = 'Sửa trực tiếp — thay đổi được lưu ngay vào thư mục lab (~/lab)';
    });
    select(current);
    return { el, select, highlight, destroy() { offFiles(); offEvt(); } };
  };

  // ---------- Vẽ hình chữ nhật bo góc ----------
  App.rrect = function (ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  };
  const fit = (ctx, s, w) => { if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
  const COL = { run: '#34d399', exit: '#64748b', fail: '#f87171', created: '#fbbf24', img: '#38bdf8', vol: '#c084fc', net: 'rgba(45,212,191,0.55)' };

  // ---------- Sơ đồ trạng thái Docker: image → container (theo network) → volume ----------
  App.dockerDiagram = function (cv, engine, t = 0) {
    const { ctx, w, h } = cv;
    const S = engine.state;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 560;
    const imgW = narrow ? Math.max(96, w * 0.28) : Math.min(210, w * 0.24);
    const vols = S.volumes;
    const volW = vols.length ? (narrow ? 92 : 150) : 0;
    const midX = imgW + 26, midW = w - midX - (volW ? volW + 26 : 8);
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
    ctx.textBaseline = 'middle';
    // Tiêu đề cột
    ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText(narrow ? 'IMAGE' : 'IMAGE (khuôn)', 8, 12);
    ctx.fillText(narrow ? 'CONTAINER' : 'CONTAINER (đang chạy từ khuôn)', midX, 12);
    if (volW) ctx.fillText('VOLUME', w - volW - 4, 12);

    // Cột image
    const imgPos = {};
    const imgs = S.images.slice(0, 9);
    imgs.forEach((im, i) => {
      const y = 26 + i * 32;
      const dangling = im.repo === '<none>';
      App.rrect(ctx, 6, y, imgW - 12, 26, 7, dangling ? 'rgba(100,116,139,0.12)' : 'rgba(56,189,248,0.10)', dangling ? 'rgba(100,116,139,0.4)' : 'rgba(56,189,248,0.38)');
      ctx.fillStyle = dangling ? '#94a3b8' : '#e0f2fe';
      ctx.font = '600 11.5px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, `${im.repo}:${im.tag}`, imgW - 70), 14, y + 13);
      ctx.fillStyle = '#7c879f'; ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
      ctx.fillText(App.fmtBytes(im.size), imgW - 12, y + 13); ctx.textAlign = 'left';
      imgPos[im.id] = imgPos[im.id] || { x: imgW - 6, y: y + 13 };
    });
    if (!imgs.length) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText(narrow ? '(trống)' : 'Chưa có image — thử docker pull nginx', 8, 40); }
    if (S.images.length > imgs.length) { ctx.fillStyle = '#64748b'; ctx.font = '11px "Be Vietnam Pro"'; ctx.fillText(`+${S.images.length - imgs.length} image khác`, 10, 26 + imgs.length * 32 + 8); }

    // Container gom theo network đầu tiên
    const groups = {};
    S.containers.forEach((c) => { const n = Object.keys(c.networks)[0] || 'none'; (groups[n] = groups[n] || []).push(c); });
    let y = 24;
    const cW = narrow ? midW - 16 : Math.min(200, (midW - 28) / 2);
    const perRow = Math.max(1, Math.floor((midW - 16) / (cW + 10)));
    const pos = {};
    Object.keys(groups).forEach((net) => {
      const list = groups[net];
      const rows = Math.ceil(list.length / perRow);
      const gh = 26 + rows * 62;
      ctx.setLineDash([5, 4]);
      App.rrect(ctx, midX, y, midW, gh, 12, 'rgba(45,212,191,0.03)', COL.net);
      ctx.setLineDash([]);
      ctx.fillStyle = '#5eead4'; ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(`network: ${net}${net === 'bridge' && !narrow ? ' (mặc định — không gọi nhau bằng tên)' : ''}`, midX + 10, y + 13);
      list.forEach((c, i) => {
        const cx = midX + 8 + (i % perRow) * (cW + 10), cy = y + 24 + Math.floor(i / perRow) * 62;
        const st = c.status === 'running' ? 'run' : c.status === 'created' ? 'created' : c.exitCode ? 'fail' : 'exit';
        App.rrect(ctx, cx, cy, cW, 54, 10, st === 'run' ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)', st === 'run' ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)');
        const pulse = st === 'run' ? 3.5 + Math.sin(t / 300 + i) * 1.3 : 3.5;
        App.dot(ctx, cx + 12, cy + 15, pulse, COL[st]);
        ctx.fillStyle = '#f1f5f9'; ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
        ctx.fillText(fit(ctx, c.name, cW - 30), cx + 22, cy + 15);
        ctx.fillStyle = '#94a3b8'; ctx.font = '10.5px "JetBrains Mono", monospace';
        const status = st === 'run' ? 'Up' : st === 'created' ? 'Created' : `Exited (${c.exitCode})`;
        ctx.fillText(fit(ctx, `${c.image} · ${status}`, cW - 16), cx + 8, cy + 32);
        if (c.ports.length) { ctx.fillStyle = '#fbbf24'; ctx.fillText(fit(ctx, c.ports.map((p) => `:${p.host}→${p.container}`).join(' '), cW - 16), cx + 8, cy + 46); }
        pos[c.id] = { x: cx, y: cy + 27, r: cx + cW };
        // Đường nối container ← image
        const ip = imgPos[c.imageId];
        if (ip) {
          ctx.strokeStyle = st === 'run' ? 'rgba(56,189,248,0.4)' : 'rgba(100,116,139,0.25)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(ip.x, ip.y); ctx.bezierCurveTo(ip.x + 20, ip.y, cx - 20, cy + 27, cx, cy + 27); ctx.stroke();
        }
      });
      y += gh + 10;
    });
    if (!S.containers.length) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText(narrow ? 'Chưa có container' : 'Chưa có container — thử docker run hello-world', midX + 4, 40); }

    // Cột volume và đường nối mount
    vols.slice(0, 8).forEach((v, i) => {
      const vx = w - volW - 4, vy = 26 + i * 36;
      App.rrect(ctx, vx, vy, volW, 28, 8, 'rgba(192,132,252,0.10)', 'rgba(192,132,252,0.42)');
      ctx.fillStyle = '#e9d5ff'; ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, '🗄 ' + v.name, volW - 12), vx + 8, vy + 14);
      S.containers.forEach((c) => c.mounts.forEach((m) => {
        if (m.type !== 'volume' || m.source !== v.name || !pos[c.id]) return;
        const p = pos[c.id];
        ctx.strokeStyle = 'rgba(192,132,252,0.45)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(p.r, p.y); ctx.bezierCurveTo(p.r + 20, p.y, vx - 20, vy + 14, vx, vy + 14); ctx.stroke(); ctx.setLineDash([]);
      }));
    });
    return Math.max(y, 26 + imgs.length * 32, 26 + vols.length * 36) + 8;
  };
  App.fmtBytes = (b) => (window.DevOpsSim ? window.DevOpsSim.shell.fmtSize(b) : Math.round(b / 1e6) + 'MB');

  // ---------- Sơ đồ lớp của lần build gần nhất + so sánh kích thước các image đã build ----------
  App.layerDiagram = function (cv, engine) {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const b = engine.builds[engine.builds.length - 1];
    const narrow = w < 560;
    const leftW = narrow ? w : w * 0.56;
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText(b ? `LỚP CỦA LẦN BUILD GẦN NHẤT${b.tag ? ' — ' + b.tag : ''}` : 'LỚP IMAGE', 8, 12);
    if (!b) { ctx.fillStyle = '#64748b'; ctx.font = '12px "Be Vietnam Pro"'; ctx.fillText('Chạy docker build -t myapp:v1 . để xem từng lớp', 8, 40); return; }
    const steps = b.steps.slice();
    const rowH = Math.min(30, (h - 70) / Math.max(1, steps.length + 1));
    const maxS = Math.max(1, ...steps.map((s) => s.size));
    // Lớp gốc ở dưới cùng, các bước xếp chồng lên trên đúng như cấu trúc image
    const base = h - 18 - rowH;
    App.rrect(ctx, 8, base, leftW - 16, rowH - 4, 6, 'rgba(100,116,139,0.18)', 'rgba(100,116,139,0.4)');
    ctx.fillStyle = '#cbd5e1'; ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('FROM — các lớp của image gốc', 16, base + rowH / 2 - 2);
    steps.forEach((s, i) => {
      const y = base - (i + 1) * rowH;
      const c = s.cached ? ['rgba(45,212,191,0.12)', 'rgba(45,212,191,0.5)', '#5eead4'] : ['rgba(251,146,60,0.12)', 'rgba(251,146,60,0.55)', '#fdba74'];
      App.rrect(ctx, 8, y, leftW - 16, rowH - 4, 6, c[0], c[1]);
      const bw = Math.max(2, ((leftW - 16) * 0.3) * Math.sqrt(s.size / maxS));
      ctx.fillStyle = c[1]; ctx.globalAlpha = 0.35; ctx.fillRect(leftW - 8 - bw, y, bw, rowH - 4); ctx.globalAlpha = 1;
      ctx.fillStyle = c[2]; ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillText(s.cached ? 'CACHED' : 'BUILD', 14, y + rowH / 2 - 2);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, s.text, leftW - 150), 66, y + rowH / 2 - 2);
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.fillText(App.fmtBytes(s.size), leftW - 14, y + rowH / 2 - 2); ctx.textAlign = 'left';
    });
    if (!b.ok) { ctx.fillStyle = '#fca5a5'; ctx.font = '600 12px "Be Vietnam Pro"'; ctx.fillText(`✖ Build lỗi${b.errorLine ? ' ở dòng ' + b.errorLine : ''}`, 8, 30); }
    if (narrow) return;
    // Bên phải: so sánh kích thước các image đã build (mỗi tag lấy lần build cuối)
    const rx = leftW + 16, rw = w - rx - 8;
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = 'rgba(154,164,189,0.85)';
    ctx.fillText('KÍCH THƯỚC IMAGE ĐÃ BUILD', rx, 12);
    const seen = {};
    engine.builds.forEach((x) => { if (x.ok && x.tag) seen[x.tag] = x.size; });
    const list = Object.entries(seen).slice(-8);
    const mx = Math.max(1, ...list.map((x) => x[1]));
    list.forEach(([tag, size], i) => {
      const y = 30 + i * 34;
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(fit(ctx, tag, rw - 70), rx, y + 6);
      ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.fillText(App.fmtBytes(size), rx + rw, y + 6); ctx.textAlign = 'left';
      const g = ctx.createLinearGradient(rx, 0, rx + rw, 0); g.addColorStop(0, '#2496ed'); g.addColorStop(1, '#2dd4bf');
      App.rrect(ctx, rx, y + 14, rw, 8, 4, 'rgba(255,255,255,0.06)');
      App.rrect(ctx, rx, y + 14, Math.max(4, (rw * size) / mx), 8, 4, g);
    });
  };

  // ---------- Khung chung cho bài DevOps: engine + terminal + sơ đồ + nút đặt lại ----------
  // Trả về { engine, term, cv, editor }; lesson.state luôn trỏ tới engine hiện tại để lab tự kiểm tra
  App.dvSetup = function (sim, ctx, lesson, { files = {}, editFiles = null, chips = [], welcome = [], diagram = 'docker', title, height = 300, cvHeight = 300 } = {}) {
    const top = App.h(`<div class="sim-top"><h2>${title || '🐳 Môi trường thực hành'}</h2><button class="btn small ghost" type="button" id="reset-env-${lesson.id}">↺ Đặt lại môi trường</button></div>`);
    sim.classList.add('dv-sim');
    sim.appendChild(top);
    const holder = { engine: null, term: null, editor: null };
    const cvBox = document.createElement('div');
    const cv = ctx.canvas(cvBox, { height: cvHeight });
    const termBox = document.createElement('div');
    const edBox = document.createElement('div');
    sim.appendChild(cvBox);
    if (editFiles) { const split = App.h('<div class="dv-split"></div>'); split.appendChild(edBox); split.appendChild(termBox); sim.appendChild(split); } else sim.appendChild(termBox);
    const legend = App.h(diagram === 'docker'
      ? '<div class="dv-legend"><span style="--c:#34d399">Đang chạy</span><span style="--c:#64748b">Đã dừng (mã 0)</span><span style="--c:#f87171">Lỗi (mã ≠ 0)</span><span style="--c:#38bdf8">Image</span><span style="--c:#c084fc">Volume</span></div>'
      : '<div class="dv-legend"><span style="--c:#2dd4bf">Lấy từ cache</span><span style="--c:#fb923c">Build lại</span><span style="--c:#64748b">Lớp của image gốc</span></div>');
    cvBox.appendChild(legend);

    function boot() {
      if (holder.editor) holder.editor.destroy();
      edBox.innerHTML = ''; termBox.innerHTML = '';
      const engine = window.DevOpsSim.createDocker({ seed: 7, files: JSON.parse(JSON.stringify(files)) });
      holder.engine = engine;
      lesson.state = engine;
      holder.term = App.terminal(termBox, { engine, chips, welcome, height });
      if (editFiles) holder.editor = App.fileEditor(edBox, { engine, files: editFiles });
    }
    boot();
    top.querySelector('button').addEventListener('click', () => { boot(); App.toast('Đã đặt lại môi trường lab về trạng thái ban đầu.'); });
    // Đồng hồ thật: cho các container "sleep N" tự kết thúc đúng hạn
    ctx.interval(() => holder.engine.tick(), 1000);
    ctx.loop(() => {
      if (!cv.w) return;
      if (diagram === 'docker') App.dockerDiagram(cv, holder.engine, performance.now());
      else App.layerDiagram(cv, holder.engine);
    });
    ctx.onCleanup(() => holder.editor && holder.editor.destroy());
    return holder;
  };
})();
