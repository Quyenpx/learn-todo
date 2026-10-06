/*
 * ml-math.js — Lõi tính toán Machine Learning viết thuần JavaScript.
 * Tách riêng khỏi giao diện để: (1) kiểm thử được bằng Node.js, (2) người học đọc được thuật toán rõ ràng.
 * Hỗ trợ cả trình duyệt (window.MLMath) lẫn Node.js (module.exports).
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.MLMath = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Số ngẫu nhiên có seed: giúp dữ liệu mô phỏng lặp lại được khi cần so sánh ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Phân phối chuẩn (Box-Muller) để tạo nhiễu tự nhiên cho dữ liệu
  function gaussian(rand) {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- Hàm kích hoạt và đạo hàm (df nhận cả z và a để tính nhanh) ----------
  const activations = {
    sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), df: (z, a) => a * (1 - a), formula: "σ'(z) = a(1 − a)" },
    tanh: { f: (z) => Math.tanh(z), df: (z, a) => 1 - a * a, formula: "tanh'(z) = 1 − a²" },
    relu: { f: (z) => (z > 0 ? z : 0), df: (z) => (z > 0 ? 1 : 0), formula: "ReLU'(z) = 1 nếu z > 0, ngược lại 0" },
    linear: { f: (z) => z, df: () => 1, formula: "f'(z) = 1" },
  };

  // ---------- Hồi quy tuyến tính: ŷ = w·x + b, Loss = MSE ----------
  function linearLoss(points, w, b) {
    let s = 0;
    for (const p of points) { const e = w * p.x + b - p.y; s += e * e; }
    return s / points.length;
  }

  function linearGradients(points, w, b) {
    let dw = 0, db = 0;
    for (const p of points) { const e = w * p.x + b - p.y; dw += 2 * e * p.x; db += 2 * e; }
    return { dw: dw / points.length, db: db / points.length };
  }

  // Một bước Gradient Descent: đi ngược hướng gradient một đoạn bằng learning rate
  function linearStep(points, w, b, lr) {
    const g = linearGradients(points, w, b);
    const nw = w - lr * g.dw, nb = b - lr * g.db;
    return { w: nw, b: nb, dw: g.dw, db: g.db, loss: linearLoss(points, nw, nb) };
  }

  // Nghiệm đóng (bình phương tối thiểu) để biết "đáp án đúng" mà Gradient Descent cần tiến tới
  function linearOptimum(points) {
    const n = points.length;
    const mx = points.reduce((s, p) => s + p.x, 0) / n;
    const my = points.reduce((s, p) => s + p.y, 0) / n;
    let cov = 0, vx = 0;
    for (const p of points) { cov += (p.x - mx) * (p.y - my); vx += (p.x - mx) ** 2; }
    const w = vx === 0 ? 0 : cov / vx;
    const b = my - w * mx;
    return { w, b, loss: linearLoss(points, w, b) };
  }

  // ---------- Hồi quy đa thức (dùng cho bài Overfitting) ----------
  // Giải hệ phương trình tuyến tính bằng khử Gauss-Jordan có chọn phần tử trụ để ổn định số học
  function solveLinearSystem(A, bvec) {
    const n = A.length;
    const M = A.map((row, i) => [...row, bvec[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c];
      if (Math.abs(d) < 1e-15) continue;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / d;
        if (f === 0) continue;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => (Math.abs(row[i]) < 1e-15 ? 0 : row[n] / row[i]));
  }

  // lambda là hệ số regularization (Ridge): phạt hệ số lớn để đường cong mượt hơn
  function polyFit(xs, ys, degree, lambda = 0) {
    const m = degree + 1;
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    const bv = new Array(m).fill(0);
    for (let i = 0; i < xs.length; i++) {
      const pw = [1];
      for (let k = 1; k < m; k++) pw.push(pw[k - 1] * xs[i]);
      for (let r = 0; r < m; r++) {
        bv[r] += pw[r] * ys[i];
        for (let c = 0; c < m; c++) A[r][c] += pw[r] * pw[c];
      }
    }
    // Cộng thêm 1e-10 tối thiểu để hệ luôn giải được kể cả khi số điểm ít hơn số hệ số
    const reg = Math.max(lambda, 1e-10);
    for (let r = 1; r < m; r++) A[r][r] += reg;
    A[0][0] += 1e-10;
    return solveLinearSystem(A, bv);
  }

  function polyEval(coefs, x) {
    let y = 0;
    for (let k = coefs.length - 1; k >= 0; k--) y = y * x + coefs[k];
    return y;
  }

  function mse(pred, actual) {
    let s = 0;
    for (let i = 0; i < pred.length; i++) s += (pred[i] - actual[i]) ** 2;
    return s / pred.length;
  }

  // ---------- Một nơ-ron: forward và backward theo chain rule ----------
  function neuronForward({ x, w, b, y, activation }) {
    const act = activations[activation];
    const z = w * x + b;
    const a = act.f(z);
    const loss = (a - y) ** 2;
    return { z, a, loss };
  }

  function neuronBackward(p) {
    const fw = neuronForward(p);
    const act = activations[p.activation];
    const dL_da = 2 * (fw.a - p.y);           // đạo hàm của (a − y)²
    const da_dz = act.df(fw.z, fw.a);          // đạo hàm hàm kích hoạt
    const dL_dz = dL_da * da_dz;               // chain rule
    return { ...fw, dL_da, da_dz, dL_dz, dL_dw: dL_dz * p.x, dL_db: dL_dz, dL_dx: dL_dz * p.w };
  }

  // ---------- Mạng nơ-ron nhiều lớp (MLP) cho phân loại nhị phân ----------
  class MLP {
    // sizes ví dụ [2, 4, 4, 1]: 2 đầu vào, 2 lớp ẩn 4 nơ-ron, 1 đầu ra sigmoid
    constructor(sizes, activation = 'tanh', seed = 1) {
      this.sizes = sizes;
      this.activation = activation;
      const rand = mulberry32(seed);
      this.W = [];
      this.b = [];
      for (let l = 0; l < sizes.length - 1; l++) {
        const nIn = sizes[l], nOut = sizes[l + 1];
        // Khởi tạo Xavier/He: giữ tín hiệu không quá lớn/nhỏ khi qua nhiều lớp
        const scale = activation === 'relu' ? Math.sqrt(2 / nIn) : Math.sqrt(2 / (nIn + nOut));
        this.W.push(Array.from({ length: nOut }, () => Array.from({ length: nIn }, () => gaussian(rand) * scale)));
        this.b.push(new Array(nOut).fill(activation === 'relu' ? 0.01 : 0));
      }
    }

    forward(x) {
      const acts = [x], zs = [];
      let a = x;
      const L = this.W.length;
      for (let l = 0; l < L; l++) {
        const W = this.W[l], b = this.b[l];
        const act = l === L - 1 ? activations.sigmoid : activations[this.activation];
        const z = new Array(W.length), out = new Array(W.length);
        for (let j = 0; j < W.length; j++) {
          let s = b[j];
          const row = W[j];
          for (let i = 0; i < a.length; i++) s += row[i] * a[i];
          z[j] = s;
          out[j] = act.f(s);
        }
        zs.push(z); acts.push(out); a = out;
      }
      return { zs, acts, output: a[0] };
    }

    predict(x) { return this.forward(x).output; }

    // Huấn luyện một epoch trên toàn bộ dữ liệu (full-batch gradient descent), trả về loss Binary Cross-Entropy
    trainBatch(X, Y, lr) {
      const L = this.W.length;
      const gW = this.W.map((W) => W.map((r) => new Array(r.length).fill(0)));
      const gb = this.b.map((b) => new Array(b.length).fill(0));
      const hidden = activations[this.activation];
      let loss = 0;
      const eps = 1e-7;
      for (let n = 0; n < X.length; n++) {
        const { zs, acts } = this.forward(X[n]);
        const p = acts[L][0], y = Y[n];
        loss += -(y * Math.log(p + eps) + (1 - y) * Math.log(1 - p + eps));
        let delta = [p - y]; // đạo hàm gộp của sigmoid + cross-entropy
        for (let l = L - 1; l >= 0; l--) {
          const aPrev = acts[l];
          for (let j = 0; j < delta.length; j++) {
            gb[l][j] += delta[j];
            const g = gW[l][j];
            for (let i = 0; i < aPrev.length; i++) g[i] += delta[j] * aPrev[i];
          }
          if (l > 0) {
            const nd = new Array(aPrev.length);
            for (let i = 0; i < aPrev.length; i++) {
              let s = 0;
              for (let j = 0; j < delta.length; j++) s += this.W[l][j][i] * delta[j];
              nd[i] = s * hidden.df(zs[l - 1][i], aPrev[i]);
            }
            delta = nd;
          }
        }
      }
      const m = X.length;
      for (let l = 0; l < L; l++) {
        for (let j = 0; j < this.W[l].length; j++) {
          for (let i = 0; i < this.W[l][j].length; i++) this.W[l][j][i] -= (lr * gW[l][j][i]) / m;
          this.b[l][j] -= (lr * gb[l][j]) / m;
        }
      }
      return loss / m;
    }

    accuracy(X, Y) {
      let c = 0;
      for (let i = 0; i < X.length; i++) if ((this.predict(X[i]) >= 0.5 ? 1 : 0) === Y[i]) c++;
      return X.length ? c / X.length : 0;
    }
  }

  // ---------- Bộ dữ liệu 2 chiều cho bài mạng nơ-ron (tọa độ trong khoảng [-1, 1]) ----------
  function makeDataset(type, n, noise, seed) {
    const r = mulberry32(seed);
    const g = () => gaussian(r) * noise;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const c = i % 2;
      let x1, x2;
      if (type === 'gauss') {
        const cx = c ? 0.45 : -0.45;
        x1 = cx + gaussian(r) * 0.22 + g();
        x2 = cx + gaussian(r) * 0.22 + g();
      } else if (type === 'circle') {
        const rad = c ? r() * 0.42 : 0.62 + r() * 0.3;
        const ang = r() * Math.PI * 2;
        x1 = rad * Math.cos(ang) + g();
        x2 = rad * Math.sin(ang) + g();
      } else if (type === 'xor') {
        x1 = r() * 1.8 - 0.9; x2 = r() * 1.8 - 0.9;
        x1 += x1 > 0 ? 0.06 : -0.06; x2 += x2 > 0 ? 0.06 : -0.06;
        const label = x1 * x2 > 0 ? 1 : 0;
        pts.push({ x: [x1 + g(), x2 + g()], y: label });
        continue;
      } else {
        // spiral: hai nhánh xoắn ốc lồng nhau
        const t = Math.floor(i / 2) / Math.ceil(n / 2);
        const rad = 0.08 + t * 0.85;
        const ang = t * Math.PI * 2.6 + c * Math.PI;
        x1 = rad * Math.cos(ang) + g();
        x2 = rad * Math.sin(ang) + g();
      }
      pts.push({ x: [x1, x2], y: c });
    }
    return pts;
  }

  // ---------- K-Means ----------
  function makeBlobs(k, nPer, spread, seed) {
    const r = mulberry32(seed);
    const centers = [];
    let guard = 0;
    while (centers.length < k && guard++ < 2000) {
      const c = [r() * 1.5 - 0.75, r() * 1.5 - 0.75];
      if (centers.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) > 0.45)) centers.push(c);
    }
    const pts = [];
    centers.forEach((c) => {
      for (let i = 0; i < nPer; i++) pts.push([c[0] + gaussian(r) * spread, c[1] + gaussian(r) * spread]);
    });
    return { points: pts, centers };
  }

  function kmeansInit(points, k, seed) {
    const r = mulberry32(seed);
    const idx = new Set();
    while (idx.size < Math.min(k, points.length)) idx.add(Math.floor(r() * points.length));
    return [...idx].map((i) => points[i].slice());
  }

  function kmeansAssign(points, cents) {
    return points.map((p) => {
      let best = 0, bd = Infinity;
      for (let j = 0; j < cents.length; j++) {
        const d = (p[0] - cents[j][0]) ** 2 + (p[1] - cents[j][1]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      return best;
    });
  }

  function kmeansUpdate(points, labels, cents) {
    return cents.map((c, j) => {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < points.length; i++) if (labels[i] === j) { sx += points[i][0]; sy += points[i][1]; n++; }
      return n ? [sx / n, sy / n] : c.slice(); // cụm rỗng thì giữ nguyên tâm
    });
  }

  function kmeansInertia(points, labels, cents) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const c = cents[labels[i]];
      s += (points[i][0] - c[0]) ** 2 + (points[i][1] - c[1]) ** 2;
    }
    return s;
  }

  // Chạy K-Means đến khi hội tụ, lấy kết quả tốt nhất qua nhiều lần khởi tạo
  function kmeansRun(points, k, seed = 1, restarts = 5, maxIter = 100) {
    let best = null;
    for (let t = 0; t < restarts; t++) {
      let cents = kmeansInit(points, k, seed + t * 101);
      let labels = kmeansAssign(points, cents);
      for (let it = 0; it < maxIter; it++) {
        const nc = kmeansUpdate(points, labels, cents);
        const moved = nc.some((c, j) => Math.hypot(c[0] - cents[j][0], c[1] - cents[j][1]) > 1e-9);
        cents = nc;
        labels = kmeansAssign(points, cents);
        if (!moved) break;
      }
      const inertia = kmeansInertia(points, labels, cents);
      if (!best || inertia < best.inertia) best = { cents, labels, inertia };
    }
    return best;
  }

  return {
    mulberry32, gaussian, activations,
    linearLoss, linearGradients, linearStep, linearOptimum,
    solveLinearSystem, polyFit, polyEval, mse,
    neuronForward, neuronBackward,
    MLP, makeDataset,
    makeBlobs, kmeansInit, kmeansAssign, kmeansUpdate, kmeansInertia, kmeansRun,
  };
});
