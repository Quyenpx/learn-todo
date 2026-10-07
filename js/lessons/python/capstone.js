/* Bài 15 — Dự án tổng kết: xử lý thiếu dữ liệu, chia tập, chuẩn hóa, hồi quy logistic và chọn ngưỡng. */
(function () {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('../../learning/pytrace.js') : window.PyTrace;
  const N = 40, SEED = 7;
  // Dữ liệu tổng hợp 40 học sinh: đạt hay không phụ thuộc giờ học và số bài tập, có nhiễu; một số giờ học bị thiếu (NaN)
  const DATA = (() => {
    const rand = P.rng(SEED), rows = [];
    for (let k = 0; k < N; k++) {
      const gio = P.round(rand() * 10, 1), bt = Math.floor(rand() * 21);
      const z = 0.7 * gio + 0.2 * bt - 5.5 + (rand() - 0.5) * 4;
      rows.push({ gio: k % 7 === 3 ? NaN : gio, bt, dat: z > 0 ? 1 : 0 });
    }
    return rows;
  })();
  const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // Chia phân tầng: mỗi lớp lấy cùng tỷ lệ test (gần đúng cách sklearn phân bổ)
  function split(rows, ts) {
    const rand = P.rng(0), test = [], train = [];
    [0, 1].forEach((c) => {
      const idx = rows.map((r, j) => j).filter((j) => rows[j].dat === c);
      for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
      const nTest = Math.round(ts * idx.length);
      test.push(...idx.slice(0, nTest)); train.push(...idx.slice(nTest));
    });
    return { train: train.map((j) => rows[j]), test: test.map((j) => rows[j]) };
  }
  // Hồi quy logistic bằng hạ gradient, có điều chuẩn L2 tương đương C = 1 như mặc định của sklearn
  function fitLogistic(X, y) {
    let w = [0, 0], b = 0;
    const n = X.length, sig = (z) => 1 / (1 + Math.exp(-z));
    for (let it = 0; it < 2000; it++) {
      const g = [0, 0]; let gb = 0;
      X.forEach((x, j) => { const e = sig(w[0] * x[0] + w[1] * x[1] + b) - y[j]; g[0] += e * x[0]; g[1] += e * x[1]; gb += e; });
      w = w.map((v, c) => v - 0.5 * (g[c] / n + v / n));
      b -= 0.5 * gb / n;
    }
    return { w, b, proba: (x) => sig(w[0] * x[0] + w[1] * x[1] + b) };
  }
  function metrics(yTrue, prob, thr) {
    const pred = prob.map((p) => (p >= thr ? 1 : 0));
    let tp = 0, fp = 0, fn = 0, ok = 0;
    pred.forEach((p, j) => { if (p === yTrue[j]) ok++; if (p && yTrue[j]) tp++; if (p && !yTrue[j]) fp++; if (!p && yTrue[j]) fn++; });
    const recall = tp + fn ? tp / (tp + fn) : 0, precision = tp + fp ? tp / (tp + fp) : 0;
    return { acc: ok / yTrue.length, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
  }
  const cleanLines = {
    drop: 'df = df.dropna()                                   # bỏ dòng thiếu',
    fill: 'df["gio_hoc"] = df["gio_hoc"].fillna(df["gio_hoc"].median())',
    none: '# không xử lý giá trị thiếu',
  };
  const lesson = P.lesson({
    id: 'py-capstone', icon: '🎓', group: 'Dự án', title: 'Dự án tổng kết: dự đoán học sinh đạt', navTitle: 'Dự án tổng kết',
    lead: 'Ghép mọi kỹ năng: đọc dữ liệu thiếu, làm sạch, chia tập phân tầng, chuẩn hóa, hồi quy logistic và chọn ngưỡng theo mục tiêu.',
    badgeTail: 'Dự án',
    experiment: {
      defaults: { xu_ly: 'drop', ti_le_test: 0.25, nguong: 0.5 },
      controls: [
        { key: 'xu_ly', label: 'Xử lý giá trị thiếu', type: 'select', options: [{ value: 'drop', label: 'dropna — bỏ dòng thiếu' }, { value: 'fill', label: 'fillna bằng trung vị' }, { value: 'none', label: 'Không xử lý' }] },
        { key: 'ti_le_test', label: 'test_size (0.1–0.5)', type: 'number', step: 0.05 },
        { key: 'nguong', label: 'Ngưỡng xác suất để dự đoán “đạt”', type: 'number', step: 0.05 },
      ],
      code: (i) => [
        'import pandas as pd',
        'from sklearn.model_selection import train_test_split',
        'from sklearn.preprocessing import StandardScaler',
        'from sklearn.linear_model import LogisticRegression',
        'from sklearn.metrics import accuracy_score, recall_score, f1_score',
        'df = pd.read_csv("hoc_sinh.csv")                   # cột gio_hoc, so_bai_tap, dat',
        cleanLines[i.xu_ly] || cleanLines.drop,
        'X, y = df[["gio_hoc", "so_bai_tap"]], df["dat"]',
        `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${Number.isFinite(i.ti_le_test) ? P.repr(P.float(i.ti_le_test)) : '?'}, stratify=y, random_state=0)`,
        'scaler = StandardScaler().fit(X_train)',
        'model = LogisticRegression().fit(scaler.transform(X_train), y_train)',
        'xac_suat = model.predict_proba(scaler.transform(X_test))[:, 1]',
        `y_pred = (xac_suat >= ${Number.isFinite(i.nguong) ? P.repr(P.float(i.nguong)) : '?'}).astype(int)`,
        'print("accuracy:", round(accuracy_score(y_test, y_pred), 3))',
        'print("recall:", round(recall_score(y_test, y_pred), 3))',
        'print("f1:", round(f1_score(y_test, y_pred), 3))',
      ],
      run: (i) => P.execute((t) => {
        if (!cleanLines[i.xu_ly]) throw P.inputError('Cách xử lý giá trị thiếu không hợp lệ.');
        const ts = P.num(i.ti_le_test, 'test_size', { min: 0.1, max: 0.5 });
        const thr = P.num(i.nguong, 'Ngưỡng', { min: 0, max: 1 });
        for (let k = 1; k <= 5; k++) t.step(k, {});
        const nNan = DATA.filter((r) => Number.isNaN(r.gio)).length;
        t.step(6, { 'df.shape': P.tuple([N, 3]), 'df["gio_hoc"].isna().sum()': nNan });
        let rows = DATA;
        if (i.xu_ly === 'drop') rows = DATA.filter((r) => !Number.isNaN(r.gio));
        if (i.xu_ly === 'fill') { const m = median(DATA.filter((r) => !Number.isNaN(r.gio)).map((r) => r.gio)); rows = DATA.map((r) => (Number.isNaN(r.gio) ? { ...r, gio: m } : r)); }
        t.step(7, { 'df.shape': P.tuple([rows.length, 3]), 'số NaN còn lại': rows.filter((r) => Number.isNaN(r.gio)).length });
        t.step(8, { 'X.shape': P.tuple([rows.length, 2]), 'y.mean()': P.float(P.round(P.mean(rows.map((r) => r.dat)), 3)) });
        const sp = split(rows, ts);
        t.step(9, { 'X_train.shape': P.tuple([sp.train.length, 2]), 'X_test.shape': P.tuple([sp.test.length, 2]) });
        // StandardScaler bỏ qua NaN khi fit nên dòng 10 vẫn chạy; LogisticRegression thì không chấp nhận NaN
        const col = (rs, c) => rs.map((r) => (c ? r.bt : r.gio)).filter((v) => !Number.isNaN(v));
        const mean = [0, 1].map((c) => P.mean(col(sp.train, c)));
        const std = [0, 1].map((c) => Math.sqrt(P.mean(col(sp.train, c).map((v) => (v - mean[c]) ** 2))) || 1);
        t.step(10, { 'scaler.mean_': P.raw(`array([${mean.map((v) => P.round(v, 2)).join(', ')}])`) });
        t.step(11, {});
        if (i.xu_ly === 'none') throw P.error('ValueError', 'Input X contains NaN. LogisticRegression does not accept missing values encoded as NaN natively.', 11);
        const f = (r) => [(r.gio - mean[0]) / std[0], (r.bt - mean[1]) / std[1]];
        const model = fitLogistic(sp.train.map(f), sp.train.map((r) => r.dat));
        t.step(11, { 'model.coef_': P.raw(`array([[${model.w.map((v) => P.round(v, 2)).join(', ')}]])`) });
        const prob = sp.test.map((r) => model.proba(f(r))), yte = sp.test.map((r) => r.dat);
        t.step(12, { 'xac_suat[:5]': P.raw(`array([${prob.slice(0, 5).map((v) => P.round(v, 2)).join(', ')}])`) });
        const m = metrics(yte, prob, thr);
        t.step(13, { nguong: P.float(thr), 'y_pred.sum()': prob.filter((p) => p >= thr).length, 'y_test.sum()': yte.filter(Boolean).length });
        t.step(14, {}); t.print('accuracy:', P.float(P.round(m.acc, 3)));
        t.step(15, {}); t.print('recall:', P.float(P.round(m.recall, 3)));
        t.step(16, {}); t.print('f1:', P.float(P.round(m.f1, 3)));
        const rowsTable = [0.3, 0.5, 0.7, 0.9].map((v) => { const x = metrics(yte, prob, v); return [v, P.round(x.acc, 3), P.round(x.recall, 3), P.round(x.f1, 3)]; });
        return {
          xu_ly: i.xu_ly, nguong: thr, acc: m.acc, recall: m.recall, f1: m.f1,
          visual: [
            { type: 'table', title: 'Chỉ số trên tập test theo ngưỡng (cùng mô hình)', columns: ['ngưỡng', 'accuracy', 'recall', 'f1'], rows: rowsTable },
            { type: 'table', title: '5 dòng dữ liệu đầu (sau bước xử lý thiếu)', columns: ['gio_hoc', 'so_bai_tap', 'dat'], rows: rows.slice(0, 5).map((r) => [Number.isNaN(r.gio) ? NaN : r.gio, r.bt, r.dat]) },
          ],
        };
      }),
    },
    tasks: [
      { title: 'Chạy trọn quy trình', desc: 'Bỏ dòng thiếu bằng dropna, dùng ngưỡng 0.5 và đạt accuracy ít nhất 0.8.', hint: 'Giữ mặc định: dropna, test_size 0.25, ngưỡng 0.5.', accept: (r) => !r.error && r.xu_ly === 'drop' && r.nguong === 0.5 && r.acc >= 0.8 },
      { title: 'Quên xử lý giá trị thiếu', desc: 'Chọn “Không xử lý” và tìm dòng gây lỗi. Vì sao StandardScaler vẫn chạy được?', hint: 'Chọn “Không xử lý”. Lỗi ValueError xuất hiện ở dòng 11 khi LogisticRegression gặp NaN.', accept: (r) => !!r.error && r.error.type === 'ValueError' && r.error.message.includes('NaN') },
      { title: 'Ngưỡng quá cao', desc: 'Tăng ngưỡng lên ít nhất 0.8 để recall dưới 0.7. Mô hình bỏ sót bao nhiêu học sinh đạt?', hint: 'Đặt ngưỡng 0.9. Chỉ học sinh có xác suất rất cao mới được dự đoán “đạt”.', accept: (r) => !r.error && r.nguong >= 0.8 && r.recall < 0.7 },
      { title: 'Điền giá trị thiếu', desc: 'Thay dropna bằng fillna trung vị (giữ đủ 40 dòng) và vẫn đạt accuracy ít nhất 0.8.', hint: 'Chọn “fillna bằng trung vị”, ngưỡng 0.5.', accept: (r) => !r.error && r.xu_ly === 'fill' && r.acc >= 0.8 },
    ],
    quiz: [
      { q: 'dropna() và fillna(median) khác nhau thế nào?', options: ['dropna bỏ dòng thiếu (mất dữ liệu); fillna giữ dòng và điền giá trị ước lượng', 'Giống hệt nhau', 'fillna xóa cột'], answer: 0, explain: 'Bỏ dòng đơn giản nhưng mất mẫu; điền trung vị giữ mẫu nhưng thêm giá trị giả định. Chọn theo lượng dữ liệu thiếu và lý do thiếu.' },
      { q: 'Để tránh rò rỉ, trung vị dùng để điền nên tính từ đâu?', options: ['Chỉ từ tập train, ví dụ SimpleImputer trong Pipeline', 'Từ cả train và test', 'Từ tập test'], answer: 0, explain: 'Giống StandardScaler ở bài 13: mọi thống kê tiền xử lý chỉ học từ train. Mô phỏng điền trước khi chia cho đơn giản.' },
      { q: 'stratify=y trong train_test_split để làm gì?', options: ['Giữ tỷ lệ lớp đạt/không đạt giống nhau ở train và test', 'Tăng số mẫu', 'Sắp xếp theo y'], answer: 0, explain: 'Với dữ liệu nhỏ, chia ngẫu nhiên có thể làm test lệch lớp; phân tầng giúp đánh giá ổn định hơn.' },
      { q: 'Tăng ngưỡng xác suất từ 0.5 lên 0.9 thường làm gì?', options: ['Ít dự đoán “đạt” hơn: precision tăng, recall giảm', 'Recall tăng', 'Không đổi gì'], answer: 0, explain: 'Ngưỡng cao chỉ nhận trường hợp rất chắc chắn, nên bỏ sót nhiều trường hợp dương thật (recall giảm).' },
      { q: 'Recall đo điều gì?', options: ['Trong các học sinh thực sự đạt, tỷ lệ được mô hình nhận ra', 'Tỷ lệ dự đoán đúng tổng thể', 'Tỷ lệ dự đoán “đạt” là đúng'], answer: 0, explain: 'Recall = TP / (TP + FN). Tỷ lệ dự đoán “đạt” là đúng là precision; tổng thể là accuracy.' },
      { q: 'predict_proba(X)[:, 1] trả về gì?', options: ['Xác suất thuộc lớp 1 (đạt) cho từng mẫu', 'Nhãn dự đoán', 'Hệ số mô hình'], answer: 0, explain: 'Cột 1 là xác suất lớp 1. So với ngưỡng để ra nhãn; predict() mặc định dùng ngưỡng 0.5.' },
    ],
    study: {
      sections: [
        { title: 'Quy trình một dự án nhỏ', html: '<p>Một dự án ML điển hình: đọc dữ liệu bằng pandas → kiểm tra và xử lý giá trị thiếu → tách đặc trưng <code>X</code> và nhãn <code>y</code> → chia train/test (phân tầng với <code>stratify=y</code>) → chuẩn hóa (fit trên train) → huấn luyện → đánh giá trên test. Mỗi bước dùng kỹ năng của một bài trước: DataFrame (bài 12), NumPy (bài 10–11), sklearn (bài 13), hàm và vòng lặp (bài 4–6).</p>' },
        { title: 'Giá trị thiếu', html: '<p>Dữ liệu thật hay thiếu (NaN). <code>df.isna().sum()</code> đếm số thiếu mỗi cột. <code>dropna()</code> bỏ dòng thiếu; <code>fillna(median)</code> điền trung vị. Nhiều mô hình như <code>LogisticRegression</code> báo <code>ValueError: Input X contains NaN</code>, trong khi <code>StandardScaler</code> bỏ qua NaN khi fit — lỗi xuất hiện muộn hơn chỗ gây ra. Trong dự án thật, dùng <code>SimpleImputer</code> trong <code>Pipeline</code> để thống kê điền chỉ học từ train.</p>' },
        { title: 'Xác suất, ngưỡng và chỉ số', html: '<p>Hồi quy logistic cho xác suất thuộc lớp “đạt”. Ngưỡng biến xác suất thành nhãn: ngưỡng cao làm ít dự đoán dương, <b>recall</b> (bắt được bao nhiêu trường hợp đạt thật) giảm. <b>Accuracy</b> là tỷ lệ đúng tổng thể; <b>F1</b> cân bằng precision và recall. Chọn ngưỡng theo chi phí sai: bỏ sót học sinh cần hỗ trợ thường tệ hơn báo nhầm. Mô phỏng tự cài hồi quy logistic bằng hạ gradient trên dữ liệu tổng hợp; số liệu khác khi chạy sklearn thật.</p>' },
      ],
      practice: {
        title: 'Thực hành: dự án hoàn chỉnh trong notebook', goal: 'Tự dựng toàn bộ quy trình, dùng Pipeline có SimpleImputer và chọn ngưỡng theo recall.',
        steps: ['Mở notebooks/15_du_an_tong_ket.ipynb; notebook tự tạo dữ liệu học sinh có giá trị thiếu.', 'Hoàn thành lam_sach(df) và tao_mo_hinh() trả Pipeline gồm SimpleImputer, StandardScaler, LogisticRegression.', 'Hoàn thành chon_nguong(xac_suat, y, recall_toi_thieu) trả ngưỡng lớn nhất đạt recall yêu cầu.', 'In accuracy, recall, f1 trên test và ma trận nhầm lẫn.'],
        expected: 'Accuracy trên test khoảng 0.8 trở lên, ngưỡng chọn được đạt recall yêu cầu; notebook in "Hoàn thành bài 15".',
        troubleshooting: ['ValueError: Input X contains NaN — thêm SimpleImputer vào Pipeline hoặc xử lý thiếu trước khi fit.', 'ValueError về stratify khi một lớp có quá ít mẫu — tăng dữ liệu hoặc bỏ stratify.', 'Recall bằng 0 — ngưỡng quá cao, hạ xuống.'],
        downloads: P.notebookLinks('15_du_an_tong_ket'),
      },
      references: [
        { title: 'scikit-learn: Imputation of missing values', url: 'https://scikit-learn.org/stable/modules/impute.html', topic: 'Giá trị thiếu', note: 'SimpleImputer và các chiến lược điền mean, median, most_frequent.', checked: '07/10/2026' },
        { title: 'scikit-learn: Metrics and scoring', url: 'https://scikit-learn.org/stable/modules/model_evaluation.html', topic: 'Đánh giá mô hình', note: 'Định nghĩa accuracy, precision, recall, F1 và chỉnh ngưỡng quyết định.', checked: '07/10/2026' },
      ],
    },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = lesson;
  else App.register(lesson);
})();
