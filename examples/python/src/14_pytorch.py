# %% [markdown]
# # Bài 14 — PyTorch: tensor và autograd
#
# Mục tiêu: tensor có `requires_grad`, `loss.backward()`, `optimizer.step()`, `optimizer.zero_grad()`,
# rồi viết lại bằng `nn.Linear`, `nn.MSELoss`.
#
# Cài đặt: xem hướng dẫn trên https://pytorch.org/get-started/locally/ (bản CPU là đủ cho khóa học).

# %%
import torch
from torch import nn

torch.manual_seed(0)
x = torch.tensor(2.0)
w = torch.tensor(1.0, requires_grad=True)
loss = (w * x - 7) ** 2
loss.backward()
print("loss =", loss.item(), " w.grad =", w.grad.item(), " (= 2 * (w*x - 7) * x)")
loss = (w * x - 7) ** 2
loss.backward()
print("gọi backward lần hai không zero_grad: w.grad =", w.grad.item(), "<- bị cộng dồn")

# %% [markdown]
# ## Dữ liệu
# y = 3x + 2 cộng nhiễu nhỏ. Mục tiêu: học lại w ≈ 3, b ≈ 2.

# %%
X = torch.linspace(-1, 1, 50)
y = 3 * X + 2 + 0.05 * torch.randn(50)

# %% [markdown]
# ## BÀI TẬP
# 1. `huan_luyen(X, y, lr, so_buoc, zero_grad=True)`: tạo `w`, `b` bằng `torch.zeros(1, requires_grad=True)`,
#    dùng `torch.optim.SGD([w, b], lr=lr)`; mỗi bước: tính loss MSE (`((w * X + b - y) ** 2).mean()`),
#    `backward()`, `step()`, và `zero_grad()` nếu `zero_grad=True`. Trả `(w.item(), b.item(), lich_su_loss)`.
# 2. `huan_luyen_nn(X, y, lr, so_buoc)`: dùng `nn.Linear(1, 1)`, `nn.MSELoss()`, SGD; X cần shape `(n, 1)`
#    (`X.unsqueeze(1)`). Trả mô hình đã huấn luyện.

# %%
def huan_luyen(X, y, lr, so_buoc, zero_grad=True):
    # >>> LOI GIAI: bốn bước mỗi vòng
    w = torch.zeros(1, requires_grad=True)
    b = torch.zeros(1, requires_grad=True)
    opt = torch.optim.SGD([w, b], lr=lr)
    lich_su = []
    for _ in range(so_buoc):
        loss = ((w * X + b - y) ** 2).mean()
        loss.backward()
        opt.step()
        if zero_grad:
            opt.zero_grad()
        lich_su.append(loss.item())
    return w.item(), b.item(), lich_su
    # <<< LOI GIAI


def huan_luyen_nn(X, y, lr, so_buoc):
    # >>> LOI GIAI: nn.Linear + MSELoss + SGD
    mo_hinh = nn.Linear(1, 1)
    ham_loss = nn.MSELoss()
    opt = torch.optim.SGD(mo_hinh.parameters(), lr=lr)
    Xc, yc = X.unsqueeze(1), y.unsqueeze(1)
    for _ in range(so_buoc):
        loss = ham_loss(mo_hinh(Xc), yc)
        opt.zero_grad()
        loss.backward()
        opt.step()
    return mo_hinh
    # <<< LOI GIAI

# %%
w_hoc, b_hoc, lich_su = huan_luyen(X, y, 0.1, 300)
print(f"tự viết: w = {w_hoc:.3f}, b = {b_hoc:.3f}, loss cuối = {lich_su[-1]:.5f}")
assert abs(w_hoc - 3) < 0.1 and abs(b_hoc - 2) < 0.1
assert lich_su[-1] < lich_su[0]
_, _, lich_su_sai = huan_luyen(X, y, 0.1, 300, zero_grad=False)
print(f"quên zero_grad: loss cuối = {lich_su_sai[-1]:.5f} (kém hơn hoặc dao động)")
mo_hinh = huan_luyen_nn(X, y, 0.1, 300)
print(f"nn.Linear: w = {mo_hinh.weight.item():.3f}, b = {mo_hinh.bias.item():.3f}")
assert abs(mo_hinh.weight.item() - 3) < 0.1 and abs(mo_hinh.bias.item() - 2) < 0.1
print("Hoàn thành bài 14")
