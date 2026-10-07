/* Bài 14 — PyTorch: tensor, autograd, vòng huấn luyện và lỗi quên zero_grad. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const X = 2, Y = 7, W0 = 1, B0 = 0;
  // PyTorch in tensor một phần tử với 4 chữ số thập phân, số nguyên in dạng "2."; mô phỏng gần đúng (không mô phỏng sai số float32)
  const tensorText = (v, grad) => {
    const body = Number.isInteger(v) ? `${v}.` : v.toFixed(4);
    return P.raw(`tensor(${body}${grad ? ', requires_grad=True' : ''})`);
  };
  const lesson = P.lesson({
    id: 'py-pytorch', icon: '🔥', group: 'Thư viện ML/DL', title: 'PyTorch: tensor và autograd', navTitle: 'PyTorch',
    lead: 'Tensor có requires_grad, loss.backward() tự tính đạo hàm, optimizer cập nhật tham số — và vì sao phải gọi zero_grad().',
    experiment: {
      defaults: { lr: 0.05, so_buoc: 5, zero_grad: 'co', requires_grad: 'co' },
      controls: [
        { key: 'lr', label: 'lr — tốc độ học', type: 'number', step: 0.01 },
        { key: 'so_buoc', label: 'Số bước huấn luyện (1–30)', type: 'number', step: 1 },
        { key: 'zero_grad', label: 'Gọi opt.zero_grad() mỗi bước', type: 'select', options: [{ value: 'co', label: 'Có (đúng)' }, { value: 'khong', label: 'Không (gradient cộng dồn)' }] },
        { key: 'requires_grad', label: 'Tham số w, b có requires_grad', type: 'select', options: [{ value: 'co', label: 'Có' }, { value: 'khong', label: 'Không' }] },
      ],
      code: (i) => {
        const rg = i.requires_grad === 'khong' ? '' : ', requires_grad=True';
        return [
          'import torch',
          'x, y = torch.tensor(2.0), torch.tensor(7.0)',
          `w = torch.tensor(1.0${rg})`,
          `b = torch.tensor(0.0${rg})`,
          `opt = torch.optim.SGD([w, b], lr=${Number.isFinite(i.lr) ? P.repr(P.float(i.lr)) : '?'})`,
          `for buoc in range(${Number.isFinite(i.so_buoc) ? i.so_buoc : '?'}):`,
          '    loss = (w * x + b - y) ** 2',
          '    loss.backward()            # tính w.grad, b.grad',
          '    opt.step()                 # w -= lr * w.grad',
          i.zero_grad === 'khong' ? '    # opt.zero_grad()  (bị bỏ: gradient cộng dồn)' : '    opt.zero_grad()            # xóa gradient cho bước sau',
          'print(round(loss.item(), 4), round(w.item(), 4), round(b.item(), 4))',
        ];
      },
      run: (i) => P.execute((t) => {
        const lr = P.num(i.lr, 'lr', { min: 0, max: 2 });
        const n = P.num(i.so_buoc, 'Số bước', { min: 1, max: 30, integer: true });
        if (!['co', 'khong'].includes(i.zero_grad) || !['co', 'khong'].includes(i.requires_grad)) throw P.inputError('Lựa chọn không hợp lệ.');
        const rg = i.requires_grad === 'co';
        let w = W0, b = B0, gw = 0, gb = 0, loss = null;
        const losses = [];
        t.step(1, {});
        t.step(2, { x: tensorText(X), y: tensorText(Y) });
        t.step(3, { w: tensorText(w, rg), 'w.grad': P.raw('None') });
        t.step(4, { w: tensorText(w, rg), b: tensorText(b, rg) });
        t.step(5, { w: tensorText(w, rg), b: tensorText(b, rg), lr: P.float(lr) });
        for (let k = 0; k < n; k++) {
          t.step(6, { buoc: k });
          const r = w * X + b - Y;
          loss = r * r;
          if (!Number.isFinite(loss)) loss = Infinity;
          losses.push(Math.min(loss, 1e12));
          t.step(7, { buoc: k, loss: tensorText(P.round(loss, 4)) });
          t.step(8, { buoc: k, loss: tensorText(P.round(loss, 4)) });
          if (!rg) throw P.error('RuntimeError', 'element 0 of tensors does not require grad and does not have a grad_fn', 8);
          // Gradient mới được CỘNG vào .grad; chỉ zero_grad() mới đưa về 0
          gw += 2 * r * X; gb += 2 * r;
          t.step(8, { buoc: k, 'w.grad': tensorText(P.round(gw, 4)), 'b.grad': tensorText(P.round(gb, 4)) });
          w -= lr * gw; b -= lr * gb;
          t.step(9, { buoc: k, w: tensorText(P.round(w, 4), true), b: tensorText(P.round(b, 4), true), 'w.grad': tensorText(P.round(gw, 4)) });
          if (i.zero_grad === 'co') { gw = 0; gb = 0; t.step(10, { buoc: k, 'w.grad': tensorText(0), 'b.grad': tensorText(0) }); }
          else t.step(10, { buoc: k, 'w.grad (giữ nguyên)': tensorText(P.round(gw, 4)) });
        }
        t.step(11, { loss: tensorText(P.round(loss, 4)), w: tensorText(P.round(w, 4), true), b: tensorText(P.round(b, 4), true) });
        const fmt = (v) => (Number.isFinite(v) ? P.float(P.round(v, 4)) : P.raw(v > 0 ? 'inf' : '-inf'));
        t.print(fmt(loss), fmt(w), fmt(b));
        return {
          zero_grad: i.zero_grad, loss0: losses[0], loss, losses,
          visual: { type: 'chart', title: 'loss ở đầu mỗi bước (trục log)', xlabel: 'bước', ylabel: 'loss', logY: true, series: [{ label: 'loss', data: losses.map((v) => Math.max(v, 1e-12)), color: '#ffd43b', dots: true }] },
        };
      }),
    },
    tasks: [
      { title: 'Huấn luyện đúng cách', desc: 'Chạy vòng huấn luyện có zero_grad() để loss cuối nhỏ hơn 1% loss ban đầu.', hint: 'Giữ mặc định: lr 0.05, 5 bước, có zero_grad và requires_grad.', accept: (r) => !r.error && r.zero_grad === 'co' && r.loss < r.loss0 * 0.01 },
      { title: 'Quên zero_grad()', desc: 'Bỏ opt.zero_grad() rồi chạy. Quan sát w.grad sau mỗi bước — nó lớn dần vì được cộng dồn.', hint: 'Chọn “Không (gradient cộng dồn)”. Đi từng bước và so w.grad giữa các vòng.', accept: (r) => !r.error && r.zero_grad === 'khong' },
      { title: 'Tốc độ học quá lớn', desc: 'Giữ zero_grad() nhưng tăng lr cho đến khi loss cuối lớn hơn loss ban đầu (phân kỳ).', hint: 'Đặt lr = 0.3. Mỗi bước tham số nhảy quá đích và sai số đổi dấu, lớn dần.', accept: (r) => !r.error && r.zero_grad === 'co' && r.loss > r.loss0 },
      { title: 'Tham số không có requires_grad', desc: 'Tắt requires_grad của w, b và đọc lỗi khi gọi loss.backward().', hint: 'Chọn requires_grad “Không”. PyTorch không xây đồ thị tính toán nên không có gì để lan truyền ngược.', accept: (r) => !!r.error && r.error.type === 'RuntimeError' && r.error.message.includes('does not require grad') },
    ],
    quiz: [
      { q: 'requires_grad=True trên một tensor nghĩa là gì?', options: ['PyTorch ghi lại các phép tính với tensor này để tính đạo hàm', 'Tensor được đưa lên GPU', 'Tensor không đổi được'], answer: 0, explain: 'Autograd xây đồ thị tính toán từ các tensor có requires_grad; loss.backward() đi ngược đồ thị để điền .grad.' },
      { q: 'loss.backward() làm gì với w.grad?', options: ['Cộng đạo hàm mới vào w.grad hiện có', 'Ghi đè w.grad', 'Cập nhật w'], answer: 0, explain: 'Gradient được cộng dồn (accumulate). Đó là lý do phải gọi zero_grad() mỗi bước; cập nhật w là việc của opt.step().' },
      { q: 'Quên opt.zero_grad() thì điều gì xảy ra?', options: ['Gradient các bước trước cộng dồn nên bước cập nhật sai, có thể dao động', 'Chương trình báo lỗi ngay', 'Không ảnh hưởng gì'], answer: 0, explain: 'Không có lỗi nào được báo — chính vì vậy lỗi này khó phát hiện. Mô phỏng cho thấy w.grad lớn dần qua các bước.' },
      { q: 'Thứ tự đúng trong một bước huấn luyện là?', options: ['Tính loss → backward() → step() → zero_grad()', 'step() → loss → backward()', 'zero_grad() → step() → backward()'], answer: 0, explain: 'Cũng có thể gọi zero_grad() ở đầu bước; quan trọng là xóa gradient cũ trước khi backward() cho bước mới.' },
      { q: 'loss.item() trả về gì?', options: ['Số Python (float) từ tensor một phần tử', 'Tensor mới', 'Danh sách gradient'], answer: 0, explain: '.item() lấy giá trị ra khỏi tensor để in hoặc lưu lịch sử, không giữ đồ thị tính toán.' },
      { q: 'Với y = (w·x + b − 7)², x = 2, đạo hàm theo w là?', options: ['2·(w·x + b − 7)·x', '(w·x + b − 7)', '2·w'], answer: 0, explain: 'Quy tắc chuỗi: đạo hàm của r² là 2r, nhân với đạo hàm của r theo w là x. Autograd tự tính đúng điều này.' },
    ],
    study: {
      sections: [
        { title: 'Tensor và autograd', html: '<p>Tensor giống mảng NumPy nhưng chạy được trên GPU và hỗ trợ tự động tính đạo hàm (autograd). Đánh dấu tham số cần học bằng <code>requires_grad=True</code>; mọi phép tính dùng chúng được ghi thành đồ thị. Gọi <code>loss.backward()</code> trên một số vô hướng sẽ lan truyền ngược và điền đạo hàm vào <code>w.grad</code>, <code>b.grad</code>. Nếu không tham số nào có requires_grad, backward() báo <code>RuntimeError</code> vì không có đồ thị.</p>' },
        { title: 'Vòng huấn luyện bốn bước', html: '<p>Mỗi bước: (1) tính dự đoán và loss, (2) <code>loss.backward()</code>, (3) <code>opt.step()</code> cập nhật <code>w -= lr * w.grad</code>, (4) <code>opt.zero_grad()</code> xóa gradient. Gradient được <b>cộng dồn</b> theo thiết kế (hữu ích khi gộp nhiều lô nhỏ), nên quên bước 4 làm cập nhật sai mà không có thông báo lỗi. Tốc độ học quá lớn khiến tham số nhảy quá đích và loss tăng dần (phân kỳ).</p>' },
        { title: 'Từ ví dụ nhỏ tới mạng nơ-ron', html: '<p>Mạng thật dùng <code>torch.nn.Module</code> (ví dụ <code>nn.Linear</code>), hàm mất mát có sẵn như <code>nn.MSELoss</code> và <code>DataLoader</code> chia lô dữ liệu, nhưng vòng lặp vẫn đúng bốn bước trên. Dùng <code>model.train()</code>/<code>model.eval()</code> và <code>torch.no_grad()</code> khi đánh giá để không tính gradient. Mô phỏng tính bằng JavaScript với số thực 64 bit; PyTorch dùng float32 nên chữ số cuối có thể khác.</p>' },
      ],
      practice: {
        title: 'Thực hành: hồi quy tuyến tính bằng PyTorch', goal: 'Tự viết vòng huấn luyện rồi chuyển sang nn.Linear và so với nghiệm đúng.',
        steps: ['Cài torch theo hướng dẫn trên pytorch.org (bản CPU là đủ), mở notebooks/14_pytorch.ipynb.', 'Hoàn thành huan_luyen(X, y, lr, so_buoc) với w, b có requires_grad và đủ bốn bước mỗi vòng.', 'Thử bỏ zero_grad() và so sánh loss cuối.', 'Viết lại bằng nn.Linear, nn.MSELoss, torch.optim.SGD và kiểm tra w gần 3, b gần 2.'],
        expected: 'Loss giảm dần về gần 0; w ≈ 3 và b ≈ 2 với dữ liệu tạo từ y = 3x + 2 cộng nhiễu nhỏ; notebook in "Hoàn thành bài 14".',
        troubleshooting: ['ModuleNotFoundError: No module named torch — cài torch trong đúng môi trường đang chạy notebook.', 'RuntimeError: grad can be implicitly created only for scalar outputs — loss phải là số vô hướng, dùng .mean().', 'Loss thành nan — giảm lr.'],
        downloads: P.notebookLinks('14_pytorch'),
      },
      references: [
        { title: 'PyTorch: Learn the Basics', url: 'https://pytorch.org/tutorials/beginner/basics/intro.html', topic: 'PyTorch', note: 'Chuỗi bài chính thức về tensor, autograd, mô hình và vòng tối ưu.', checked: '07/10/2026' },
        { title: 'Automatic Differentiation with torch.autograd', url: 'https://pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html', topic: 'Autograd', note: 'Giải thích requires_grad, backward() và việc gradient được cộng dồn.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
