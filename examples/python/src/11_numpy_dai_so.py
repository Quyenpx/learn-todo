# %% [markdown]
# # Bài 11 — NumPy cho đại số tuyến tính
#
# Mục tiêu: nhân ma trận `@`, chuyển vị `.T`, gradient của MSE ở dạng ma trận và so với nghiệm `np.linalg.lstsq`.

# %%
import numpy as np

A = np.array([[1, 2], [3, 4]])
v = np.array([1, 1])
print(A @ v, A.T, A @ A, sep="\n")
try:
    np.ones((2, 3)) @ np.ones((2, 3))
except ValueError as loi:
    print("ValueError:", loi)

# %% [markdown]
# ## Hồi quy tuyến tính dạng ma trận
# Dự đoán `y_hat = X @ w`, loss `MSE = mean((X @ w - y) ** 2)`, gradient `2 / n * X.T @ (X @ w - y)`.
# Cột đầu của X toàn số 1 để `w[0]` đóng vai hệ số chặn b.

# %%
rng = np.random.default_rng(0)
x = np.linspace(-1, 1, 50)
X = np.column_stack([np.ones_like(x), x])          # shape (50, 2)
y = 2 + 3 * x + rng.normal(0, 0.1, size=50)        # shape (50,)
print("X.shape =", X.shape, " y.shape =", y.shape)

# %% [markdown]
# ## BÀI TẬP
# 1. `gradient(X, y, w)` trả `2 / n * X.T @ (X @ w - y)`.
# 2. `huan_luyen(X, y, lr, so_vong)`: bắt đầu `w = np.zeros(X.shape[1])`, mỗi vòng ghi loss (MSE) vào
#    lịch sử rồi cập nhật `w -= lr * gradient(...)`; trả `(w, lich_su)`.

# %%
def gradient(X, y, w):
    # >>> LOI GIAI: công thức gradient MSE dạng ma trận
    return 2 / len(y) * X.T @ (X @ w - y)
    # <<< LOI GIAI


def huan_luyen(X, y, lr, so_vong):
    # >>> LOI GIAI: vòng lặp gradient descent
    w = np.zeros(X.shape[1])
    lich_su = []
    for _ in range(so_vong):
        lich_su.append(float(np.mean((X @ w - y) ** 2)))
        w = w - lr * gradient(X, y, w)
    return w, lich_su
    # <<< LOI GIAI

# %%
w, lich_su = huan_luyen(X, y, 0.1, 500)
w_dung, *_ = np.linalg.lstsq(X, y, rcond=None)
print("gradient descent:", np.round(w, 4), " lstsq:", np.round(w_dung, 4))
assert np.allclose(w, w_dung, atol=1e-3)
assert all(b <= a + 1e-12 for a, b in zip(lich_su, lich_su[1:])), "loss phải giảm đơn điệu với lr = 0.1"

# Bẫy shape: y dạng cột (50, 1) trừ vector (50,) bị broadcasting thành ma trận (50, 50)
y_cot = y.reshape(-1, 1)
print("shape của (X @ w - y_cot):", (X @ w - y_cot).shape, "<- sai, phải là (50,)")
print("Hoàn thành bài 11")
