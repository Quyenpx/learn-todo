/* Bài 13 — scikit-learn: chia tập, chuẩn hóa không rò rỉ, KNN và độ chính xác. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const N = 40;
  // Dữ liệu tổng hợp: nhãn phụ thuộc giờ học (0–10); thu nhập (0–1000) không liên quan nhưng có thang đo lớn
  const DATA = (() => {
    const rand = P.rng(11), X = [], y = [];
    for (let k = 0; k < N; k++) {
      const gio = P.round(rand() * 10, 1), thuNhap = Math.round(rand() * 1000);
      X.push([gio, thuNhap]); y.push(gio + (rand() - 0.5) * 2 > 5 ? 1 : 0);
    }
    return { X, y };
  })();
  function split(testSize) {
    const rand = P.rng(0), idx = [...Array(N).keys()];
    for (let k = N - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
    const nTest = Math.ceil(testSize * N);
    return { test: idx.slice(0, nTest), train: idx.slice(nTest) };
  }
  function scaler(rows) {
    const mean = [0, 1].map((c) => P.mean(rows.map((r) => r[c])));
    const std = [0, 1].map((c) => Math.sqrt(P.mean(rows.map((r) => (r[c] - mean[c]) ** 2))) || 1);
    return { mean, std, apply: (r) => r.map((v, c) => (v - mean[c]) / std[c]) };
  }
  function knnScore(Xtr, ytr, Xte, yte, k) {
    let ok = 0;
    Xte.forEach((q, n) => {
      const near = Xtr.map((r, j) => [Math.hypot(r[0] - q[0], r[1] - q[1]), ytr[j]]).sort((a, b) => a[0] - b[0]).slice(0, k);
      const ones = near.filter((p) => p[1] === 1).length;
      const pred = ones > k - ones ? 1 : 0; // hòa phiếu chọn nhãn nhỏ hơn như sklearn
      if (pred === yte[n]) ok++;
    });
    return ok / Xte.length;
  }
  function evaluate(mode, sp, k) {
    const Xtr = sp.train.map((j) => DATA.X[j]), Xte = sp.test.map((j) => DATA.X[j]);
    const ytr = sp.train.map((j) => DATA.y[j]), yte = sp.test.map((j) => DATA.y[j]);
    const sc = mode === 'none' ? null : scaler(mode === 'all' ? DATA.X : Xtr);
    const f = sc ? sc.apply : (r) => r;
    return { acc: knnScore(Xtr.map(f), ytr, Xte.map(f), yte, k), sc, nTrain: Xtr.length, nTest: Xte.length };
  }
  const scalerLines = {
    train: ['scaler = StandardScaler().fit(X_train)            # chỉ học từ train', 'X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)'],
    all: ['scaler = StandardScaler().fit(X)                  # rò rỉ: scaler đã nhìn thấy test', 'X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)'],
    none: ['# không chuẩn hóa: thu_nhap (0–1000) lấn át gio_hoc (0–10)', 'X_train_s, X_test_s = X_train, X_test'],
  };
  const lesson = P.lesson({
    id: 'py-sklearn', icon: '🤖', group: 'Thư viện ML/DL', title: 'scikit-learn: quy trình học máy', navTitle: 'scikit-learn',
    lead: 'Chia train/test, chuẩn hóa đúng cách không rò rỉ dữ liệu, huấn luyện KNN và đọc lỗi tham số của thư viện.',
    experiment: {
      defaults: { test_size: 0.25, chuan_hoa: 'train', k: 5 },
      controls: [
        { key: 'test_size', label: 'test_size — tỷ lệ tập test', type: 'number', step: 0.05 },
        { key: 'chuan_hoa', label: 'Cách chuẩn hóa', type: 'select', options: [{ value: 'train', label: 'Scaler fit trên train (đúng)' }, { value: 'all', label: 'Scaler fit trên toàn bộ X (rò rỉ)' }, { value: 'none', label: 'Không chuẩn hóa' }] },
        { key: 'k', label: 'n_neighbors — số láng giềng k', type: 'number', step: 1 },
      ],
      code: (i) => [
        'from sklearn.model_selection import train_test_split',
        'from sklearn.preprocessing import StandardScaler',
        'from sklearn.neighbors import KNeighborsClassifier',
        `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${Number.isFinite(i.test_size) ? P.repr(P.float(i.test_size)) : '?'}, random_state=0)`,
        ...(scalerLines[i.chuan_hoa] || scalerLines.train),
        `model = KNeighborsClassifier(n_neighbors=${Number.isFinite(i.k) ? i.k : '?'}).fit(X_train_s, y_train)`,
        'print("Độ chính xác test:", model.score(X_test_s, y_test))',
      ],
      run: (i) => P.execute((t) => {
        const ts = P.num(i.test_size, 'test_size', { min: -1, max: 2 });
        const k = P.num(i.k, 'n_neighbors', { min: -5, max: 60, integer: true });
        if (!scalerLines[i.chuan_hoa]) throw P.inputError('Cách chuẩn hóa không hợp lệ.');
        t.step(1, {}); t.step(2, {}); t.step(3, {});
        t.step(4, { 'X.shape': P.tuple([N, 2]), 'test_size': P.float(ts) });
        if (!(ts > 0 && ts < 1)) throw P.error('ValueError', `test_size=${P.repr(P.float(ts))} should be either positive and smaller than the number of samples ${N} or a float in the (0, 1) range`, 4);
        const sp = split(ts);
        const r = evaluate(i.chuan_hoa, sp, Math.max(1, k));
        t.step(4, { 'X_train.shape': P.tuple([r.nTrain, 2]), 'X_test.shape': P.tuple([r.nTest, 2]) });
        t.step(5, r.sc ? { 'scaler.mean_': P.raw(`array([${r.sc.mean.map((v) => P.round(v, 2)).join(', ')}])`), 'scaler.scale_': P.raw(`array([${r.sc.std.map((v) => P.round(v, 2)).join(', ')}])`) } : {});
        t.step(6, { 'X_train_s.shape': P.tuple([r.nTrain, 2]) });
        t.step(7, { n_neighbors: k });
        if (k < 1) throw P.error('ValueError', `The 'n_neighbors' parameter of KNeighborsClassifier must be an int in the range [1, inf) or None. Got ${k} instead.`, 7);
        t.step(8, { n_neighbors: k, n_samples_fit: r.nTrain });
        if (k > r.nTrain) throw P.error('ValueError', `Expected n_neighbors <= n_samples_fit, but n_neighbors = ${k}, n_samples_fit = ${r.nTrain}, n_samples = ${r.nTest}`, 8);
        t.print('Độ chính xác test:', P.float(r.acc));
        const compare = ['train', 'all', 'none'].map((m) => [scalerLines[m][0].includes('rò rỉ') ? 'fit trên toàn bộ X (rò rỉ)' : m === 'none' ? 'không chuẩn hóa' : 'fit trên train', P.round(evaluate(m, sp, k).acc, 3)]);
        return { chuan_hoa: i.chuan_hoa, acc: r.acc, leak: i.chuan_hoa === 'all', visual: { type: 'table', title: `So sánh độ chính xác test với k = ${k}, test_size = ${ts}`, columns: ['cách chuẩn hóa', 'độ chính xác'], rows: compare } };
      }),
    },
    tasks: [
      { title: 'Chạy đúng quy trình', desc: 'Chuẩn hóa bằng scaler học từ train rồi đo độ chính xác trên test, đạt ít nhất 0.8.', hint: 'Giữ mặc định: test_size 0.25, scaler fit trên train, k = 5.', accept: (r) => !r.error && r.chuan_hoa === 'train' && r.acc >= 0.8 },
      { title: 'Nhận diện rò rỉ dữ liệu', desc: 'Chọn fit scaler trên toàn bộ X. Code vẫn chạy, nhưng vi phạm nguyên tắc gì?', hint: 'Chọn “fit trên toàn bộ X”. Kết quả có thể chỉ khác chút ít, nhưng test không còn “chưa thấy” — sai về phương pháp.', accept: (r) => !r.error && r.leak === true },
      { title: 'Đọc lỗi tham số test_size', desc: 'Đặt test_size bằng 1 (100% dữ liệu cho test) và đọc thông báo lỗi của thư viện.', hint: 'Đặt test_size = 1. Số thực phải nằm trong khoảng (0, 1).', accept: (r) => !!r.error && r.error.type === 'ValueError' && r.error.message.includes('test_size') },
      { title: 'k lớn hơn số mẫu train', desc: 'Đặt k lớn hơn số mẫu train. Lỗi xuất hiện ở bước nào?', hint: 'Đặt k = 50. fit() vẫn chạy; lỗi xuất hiện khi score() tìm 50 láng giềng trong 30 mẫu.', accept: (r) => !!r.error && r.error.message.includes('n_neighbors <= n_samples_fit') },
    ],
    quiz: [
      { q: 'Vì sao cần tập test riêng?', options: ['Ước lượng hiệu năng trên dữ liệu mô hình chưa từng thấy', 'Để có thêm dữ liệu huấn luyện', 'Thư viện bắt buộc'], answer: 0, explain: 'Đo trên dữ liệu đã học cho kết quả lạc quan giả. Test chỉ dùng ở bước đánh giá cuối.' },
      { q: 'Rò rỉ dữ liệu (data leakage) khi chuẩn hóa là gì?', options: ['Dùng thống kê của test (mean, std) khi chuẩn bị dữ liệu train', 'Mất file dữ liệu', 'Dùng quá nhiều đặc trưng'], answer: 0, explain: 'fit trên toàn bộ X đưa thông tin test vào mô hình. Đúng: fit trên train, transform cả train và test.' },
      { q: 'Vì sao KNN cần chuẩn hóa đặc trưng?', options: ['Khoảng cách bị đặc trưng có thang lớn lấn át', 'KNN không chạy với số thực', 'Để giảm số mẫu'], answer: 0, explain: 'Thu nhập 0–1000 lấn át giờ học 0–10 dù không liên quan tới nhãn. Bảng so sánh trong mô phỏng cho thấy độ chính xác giảm khi không chuẩn hóa.' },
      { q: 'Mẫu API chung của scikit-learn là gì?', options: ['fit để học, transform/predict để áp dụng', 'run và stop', 'load và save'], answer: 0, explain: 'Mọi bộ biến đổi có fit/transform, mọi mô hình có fit/predict/score. Pipeline nối chúng thành một chuỗi.' },
      { q: 'random_state=0 trong train_test_split để làm gì?', options: ['Cố định cách xáo trộn để chạy lại ra cùng kết quả', 'Tăng độ chính xác', 'Chọn 0% test'], answer: 0, explain: 'Tái lập kết quả quan trọng khi so sánh mô hình. Không chọn random_state theo kết quả test tốt nhất.' },
      { q: 'Pipeline([("scaler", StandardScaler()), ("knn", KNeighborsClassifier())]) giúp gì?', options: ['Tự động fit scaler chỉ trên dữ liệu train, kể cả khi cross-validation', 'Chạy nhanh hơn GPU', 'Không cần dữ liệu'], answer: 0, explain: 'Pipeline gói tiền xử lý cùng mô hình, tránh rò rỉ khi dùng cross_val_score hay GridSearchCV.' },
    ],
    study: {
      sections: [
        { title: 'Chia train và test', html: '<p><code>train_test_split(X, y, test_size=0.25, random_state=0)</code> xáo trộn rồi tách 25% làm test. Mô hình chỉ học từ train; test dùng một lần ở cuối để ước lượng hiệu năng trên dữ liệu mới. Với bài phân loại lệch lớp, thêm <code>stratify=y</code> để tỷ lệ lớp ở hai tập giống nhau. Khi cần chọn siêu tham số (như k), dùng thêm tập validation hoặc cross-validation trên train, không chọn theo test.</p>' },
        { title: 'API fit / transform / predict', html: '<p>scikit-learn thống nhất cách dùng: bộ biến đổi như <code>StandardScaler</code> có <code>fit</code> (học mean, std) và <code>transform</code> (áp dụng); mô hình như <code>KNeighborsClassifier</code> có <code>fit</code>, <code>predict</code>, <code>score</code>. Quy tắc vàng: <b>fit chỉ trên train</b>, rồi transform cả train và test. Fit trên toàn bộ dữ liệu là rò rỉ: số liệu có thể chỉ khác chút ít ở ví dụ nhỏ, nhưng kết quả không còn đáng tin.</p>' },
        { title: 'KNN và chuẩn hóa', html: '<p>KNN (K láng giềng gần nhất) dự đoán theo đa số nhãn của k mẫu train gần nhất. Vì dựa vào khoảng cách, đặc trưng có thang đo lớn (thu nhập 0–1000) lấn át đặc trưng nhỏ (giờ học 0–10). Bảng so sánh trong mô phỏng tính cùng phép chia với ba cách chuẩn hóa. Thư viện kiểm tra tham số và báo lỗi rõ: <code>test_size</code> ngoài (0, 1) hay k lớn hơn số mẫu train. Đọc kỹ lỗi giúp sửa nhanh. Mô phỏng tự cài KNN bằng JavaScript trên dữ liệu tổng hợp; số liệu khác khi chạy sklearn thật.</p>' },
      ],
      practice: {
        title: 'Thực hành: quy trình sklearn hoàn chỉnh', goal: 'Dựng pipeline không rò rỉ và chọn k bằng cross-validation.',
        steps: ['Mở notebooks/13_scikit_learn.ipynb (dùng bộ dữ liệu Iris có sẵn trong sklearn).', 'Hoàn thành tao_pipeline(k) trả Pipeline gồm StandardScaler và KNeighborsClassifier.', 'Dùng cross_val_score trên train để chọn k trong [1, 3, 5, 7, 9].', 'Đánh giá một lần trên test và in classification_report.'],
        expected: 'Độ chính xác test của Iris thường trên 0.9; k được chọn bằng cross-validation, không dựa vào test.',
        troubleshooting: ['ValueError về shape: X phải 2 chiều (n_mẫu, n_đặc_trưng), dùng X.reshape(-1, 1) với một đặc trưng.', 'Kết quả mỗi lần chạy khác nhau: đặt random_state.'],
        downloads: P.notebookLinks('13_scikit_learn'),
      },
      references: [
        { title: 'scikit-learn: Getting Started', url: 'https://scikit-learn.org/stable/getting_started.html', topic: 'scikit-learn', note: 'API fit/predict, Pipeline và đánh giá mô hình trong một trang.', checked: '07/10/2026' },
        { title: 'Common pitfalls: Data leakage', url: 'https://scikit-learn.org/stable/common_pitfalls.html', topic: 'Rò rỉ dữ liệu', note: 'Giải thích rò rỉ khi tiền xử lý và cách dùng Pipeline để tránh.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
