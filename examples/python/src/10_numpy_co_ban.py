# %% [markdown]
# # Bài 10 — NumPy cơ bản
#
# Mục tiêu: mảng `ndarray`, `shape`, `dtype`, chỉ số, `axis`, broadcasting và vector hóa (không dùng vòng for).

# %%
import time
import numpy as np

a = np.arange(6).reshape(2, 3)
print(a, a.shape, a.dtype, sep="\n")
print("a[1, 2] =", a[1, 2], " cột 0:", a[:, 0], " a > 2:", a[a > 2])
print("tổng theo cột (axis=0):", a.sum(axis=0), " theo hàng (axis=1):", a.sum(axis=1))

# %% [markdown]
# ## Broadcasting
# Hai shape tương thích khi so từ phải sang trái, mỗi cặp chiều bằng nhau hoặc một bên bằng 1.
# `(2, 3) + (3,)` được; `(2, 3) + (2,)` báo `ValueError`.

# %%
print(a + np.array([10, 20, 30]))
print(a + np.array([[100], [200]]))     # (2, 1) giãn theo cột
try:
    a + np.array([1, 2])
except ValueError as loi:
    print("ValueError:", loi)

# %% [markdown]
# ## BÀI TẬP
# 1. `chuan_hoa(X)`: trả `(X - mean) / std` theo từng cột (dùng `axis=0`).
# 2. `khoang_cach(X, diem)`: khoảng cách Euclid từ mỗi dòng của X tới `diem`, không dùng vòng for.
#    Gợi ý: `np.sqrt(((X - diem) ** 2).sum(axis=1))`.

# %%
def chuan_hoa(X):
    # >>> LOI GIAI: mean và std theo axis=0, broadcasting tự giãn theo hàng
    return (X - X.mean(axis=0)) / X.std(axis=0)
    # <<< LOI GIAI


def khoang_cach(X, diem):
    # >>> LOI GIAI: trừ broadcasting, bình phương, cộng theo hàng, căn
    return np.sqrt(((X - diem) ** 2).sum(axis=1))
    # <<< LOI GIAI

# %%
X = np.array([[1.0, 200.0], [2.0, 400.0], [3.0, 600.0]])
Z = chuan_hoa(X)
assert Z is not None and Z.shape == (3, 2)
assert np.allclose(Z.mean(axis=0), 0) and np.allclose(Z.std(axis=0), 1)
assert np.allclose(khoang_cach(np.array([[0, 0], [3, 4]]), np.array([0, 0])), [0, 5])

# So sánh vòng for và vector hóa trên 100 000 phần tử (thời gian tùy máy)
x = np.random.default_rng(0).random(100_000)
t0 = time.perf_counter(); tong_for = 0.0
for v in x:
    tong_for += v * v
t1 = time.perf_counter(); tong_vec = float((x * x).sum()); t2 = time.perf_counter()
print(f"vòng for: {t1 - t0:.4f}s, vector hóa: {t2 - t1:.5f}s")
assert abs(tong_for - tong_vec) < 1e-6
print("Hoàn thành bài 10")
