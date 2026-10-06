# Kế hoạch triển khai giai đoạn 1: Khóa DevOps (nền tảng và Docker D1–D3)

> **Dành cho tác tử thực thi:** Thực hiện từng nhiệm vụ theo thứ tự, đánh dấu `- [ ]` khi xong. Áp dụng TDD cho phần lõi mô phỏng (test trước, code sau).

**Mục tiêu:** Tách ứng dụng thành 2 khóa AI và DevOps. Xây bộ mô phỏng Docker chạy trên trình duyệt, terminal giả lập và 3 bài học Docker.

**Kiến trúc:** Lõi mô phỏng gồm 5 file UMD trong `js/devops/`, xuất qua `window.DevOpsSim`, có thể kiểm thử bằng Node. Thành phần giao diện riêng của khóa DevOps nằm trong `js/ui-devops.js`. Bài học nằm ở `js/lessons/devops/`.

**Công nghệ:** HTML, CSS và JavaScript thuần. Không thư viện, không bước build. Kiểm thử bằng `node --test`.

**Tài liệu thiết kế:** [2026-10-06-devops-phase1-design.md](../specs/2026-10-06-devops-phase1-design.md)

## Ràng buộc chung
- Mọi comment, nội dung giao diện và gợi ý viết bằng tiếng Việt; kết quả lệnh giữ tiếng Anh giống Docker thật.
- Không dùng ES module (để mở trực tiếp bằng `file://` vẫn chạy được).
- Các file trong `js/devops/` không đụng tới `window`, `document`; chỉ dùng đối tượng gốc của UMD.
- Mọi chuỗi hiển thị trong terminal phải được escape HTML.
- Khóa lưu tiến độ là `mlviz-progress-v1` và giữ nguyên định dạng cũ.
- Kiểm tra ở 3 kích thước: 1440 px, 768 px, 390 px.
- Thư mục chưa có git: bỏ qua các bước commit, chỉ chạy test.

## Bản đồ file
| File | Trách nhiệm |
|---|---|
| `js/devops/yaml-lite.js` | `DevOpsSim.yaml.parse/parseAll`, `YamlError` |
| `js/devops/shell.js` | `tokenize`, `parseArgs`, `completeWord`, `table`, `fmtSize`, `ago`, `hash`, `rng` |
| `js/devops/docker-registry.js` | Danh mục image ảo và hành vi từng loại image |
| `js/devops/docker-build.js` | Đọc Dockerfile, `.dockerignore`, cache, ước lượng kích thước |
| `js/devops/docker-engine.js` | `createDocker()`: trạng thái, lệnh docker, exec trong container, compose |
| `js/ui-devops.js` | `App.terminal`, `App.fileEditor`, `App.rrect` |
| `js/lessons/devops/*.js` | Trang chủ DevOps, D1, D2, D3 |
| `tests/devops-sim.test.js` | Kiểm thử lõi mô phỏng và hàm `check` của lab |

## Giao diện giữa các thành phần
```js
DevOpsSim.yaml.parse(text) -> any ; parseAll(text) -> any[] ; throws YamlError{ line, message }
DevOpsSim.shell.tokenize(line) -> string[]                // throws ShellError khi thiếu dấu nháy đóng
DevOpsSim.shell.parseArgs(tokens, spec) -> { flags, args, rest, error }
  // spec: { bool:[], value:[], multi:[], alias:{}, stopAfter?:n }
DevOpsSim.shell.completeWord(prefix, candidates) -> { value, options }
DevOpsSim.shell.table(rows:string[][]) -> string[]       // căn cột giống docker (3 khoảng trắng)
DevOpsSim.shell.fmtSize(bytes) -> '192MB' ; ago(ms) -> '5 seconds ago'
DevOpsSim.registry.resolve(ref) -> { repo, tag, def } | null
DevOpsSim.build.parseDockerfile(text) -> { stages:[{ name, from, steps:[{ instr, args, line, raw }] }] } ; throws BuildError{ line }
DevOpsSim.build.run({ files, dockerfile, tag, cache, resolveBase }) -> { ok, lines, image, steps }
const eng = DevOpsSim.createDocker({ seed, files, now })
eng.exec(line) -> { ok, lines:[{ text, cls }], clear? }
eng.complete(line) -> { line, options }
eng.prompt() -> string ; eng.state ; eng.files ; eng.setFile(name, text) ; eng.on(evt, fn)
eng.find(nameOrId) -> container|undefined ; eng.findImage(ref) -> image|undefined
eng.state.history: [{ cmd, ok, kind, meta }] ; eng.state.removed: [{ name, image, status }]
eng.builds: [{ tag, steps:[{ label, cached, size }], size, ok }]
```

---

### Nhiệm vụ 1: `yaml-lite.js`
- [ ] Viết test: map lồng nhau; list chuỗi; list các map (`- name: a`); inline list `[80, 443]`; số, bool, null; comment; chuỗi có nháy chứa `:`; nhiều tài liệu với `---`; thụt lề sai → `YamlError` có `line` đúng.
- [ ] Chạy `node --test tests/devops-sim.test.js` → thấy FAIL.
- [ ] Viết parser dựa trên thụt lề (đệ quy theo từng khối dòng).
- [ ] Chạy lại → PASS.

### Nhiệm vụ 2: `shell.js`
- [ ] Viết test: `tokenize('docker run -e "A=b c" x')` → `['docker','run','-e','A=b c','x']`; thiếu nháy đóng → lỗi; `parseArgs` gộp `-dit`; `--name=web` và `--name web`; `-p` lặp lại; `stopAfter:1` giữ phần lệnh sau image; cờ lạ → `error: 'unknown flag: --nme'`; `table` căn cột; `fmtSize(192e6)='192MB'`, `fmtSize(13256)='13.3kB'`, `fmtSize(1.02e9)='1.02GB'`.
- [ ] FAIL → viết code → PASS.

### Nhiệm vụ 3: Registry và vòng đời container
- [ ] Viết test: `pull nginx` in `Status: Downloaded newer image`; pull lần hai in `Image is up to date`; layer dùng chung in `Already exists`; `run hello-world` thoát với mã 0 và in `Hello from Docker!`; `run -d --name web -p 8080:80 nginx` rồi `ps` thấy `0.0.0.0:8080->80/tcp`; trùng tên → lỗi `Conflict`; trùng cổng → `port is already allocated`; `curl localhost:8080` → `Welcome to nginx!` và history có `kind:'curl', ok:true`; `rm web` khi đang chạy → lỗi; `stop` rồi `rm` → `state.removed` có web với `status:'exited'`; image không tồn tại → `pull access denied`; `run --rm alpine echo hi` → in `hi` và không còn container; postgres thiếu `POSTGRES_PASSWORD` → exited (1) và log báo lỗi.
- [ ] FAIL → viết `docker-registry.js` và phần container của `docker-engine.js` → PASS.

### Nhiệm vụ 4: Build
- [ ] Viết test: build lần đầu không có CACHED; build lại y nguyên thì mọi bước đều CACHED; sửa `app.py` (Dockerfile chưa tối ưu, `COPY . .` đứng trước `pip install`) → bước pip bị build lại; Dockerfile tối ưu → bước pip vẫn CACHED; dùng `python:3.12-slim` thì nhỏ hơn 50%; multi-stage nhỏ hơn single-stage; thiếu `.dockerignore` thì image lớn hơn (do `.venv/` và `.git/`); chỉ thị lạ → lỗi kèm số dòng; COPY file không tồn tại → `not found`; image cũ trùng tag trở thành `<none>`.
- [ ] FAIL → viết `docker-build.js` và nối vào lệnh `docker build`, `history`, `image prune` → PASS.

### Nhiệm vụ 5: Volume, network, exec, compose
- [ ] Viết test: dữ liệu redis mất sau khi `rm` nếu không có volume; vẫn còn nếu có `-v redis-data:/data`; `exec c1 ping c2` thất bại trên `bridge` và thành công trên `appnet`; `vlab/counter` đếm lượt truy cập qua redis; `compose up -d` tạo `lab_default`, `lab-web-1`, `lab-redis-1` và volume `lab_redis-data`; `compose down` xóa container và network nhưng giữ volume; `down -v` xóa cả volume; YAML lỗi → báo số dòng.
- [ ] FAIL → viết code → PASS.

### Nhiệm vụ 6: Hai khóa học trong `core.js`
- [ ] Thêm `App.courses`, `App.url`, `App.courseOf`, `App.activeCourse`; phân tích route `#/<course>/<id>`; tự chuyển route cũ bằng `history.replaceState`; menu và tiến độ lọc theo khóa; prev/next trong cùng khóa; nút chuyển khóa; `body[data-course]`; xóa tiến độ theo khóa; lưu `lastCourse`.
- [ ] Thêm `course:'ai'` cho 7 bài AI; sửa liên kết trong `home.js`, `final.js` dùng `App.url`; `final.js` chỉ lọc bài AI.
- [ ] Đổi thương hiệu trong `index.html`; thêm style cho nút chuyển khóa và màu DevOps vào CSS.
- [ ] Chạy 11 test cũ → PASS. Mở trang, kiểm tra `#/gradient` tự chuyển sang `#/ai/gradient`.

### Nhiệm vụ 7: `ui-devops.js` và CSS
- [ ] `App.terminal(parent, { engine, welcome, chips, onExec, height })` → `{ el, run(cmd), focus(), print(lines) }`.
- [ ] `App.fileEditor(parent, { engine, files, onChange })` → `{ el, select(name), highlight(line) }`.
- [ ] CSS: `.term`, `.term-out`, `.term-line.ok/err/hint/dim/head`, `.term-input`, `.chips`, `.fed`, `.fed-tabs`, `.fed-area`, `.soon`.

### Nhiệm vụ 8: Trang chủ DevOps
- [ ] `js/lessons/devops/home.js` (`id:'devops-home'`, `course:'devops'`): hero, sơ đồ hành trình, lộ trình 10 bài (bài chưa làm hiện "Sắp ra mắt"), mục chuẩn bị môi trường thật.

### Nhiệm vụ 9–11: Các bài D1, D2, D3
- [ ] Mỗi bài: lý thuyết đầy đủ (kèm "Chạy trên máy thật" và "Lỗi thường gặp"), canvas động vẽ lại theo `engine.on('change')`, terminal kèm chip lệnh mẫu, 4 nhiệm vụ lab có `check(state)`, 6 câu trắc nghiệm, nút "↺ Đặt lại môi trường".
- [ ] Thêm test cho các hàm `check` (dựng trạng thái bằng chuỗi lệnh, gọi `lesson.labs[i].check`). Bài học xuất ra `DevOpsLessons[id]` để Node lấy được phần `labs`.

### Nhiệm vụ 12: Hoàn thiện
- [ ] Cập nhật README (cấu trúc, cách chạy test `node --test tests/`).
- [ ] Chạy toàn bộ test.
- [ ] Kiểm tra trên trình duyệt: chuyển khóa, route cũ, hoàn thành lab bằng terminal, 3 kích thước màn hình, console không có lỗi.
