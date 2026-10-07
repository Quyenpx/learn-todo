# %% [markdown]
# # Bài 8 — Lớp và đối tượng
#
# Mục tiêu: `class`, `__init__`, `self`, thuộc tính, phương thức và phương thức đặc biệt `__len__`, `__getitem__`.
# PyTorch dùng đúng mẫu này: `Dataset` có `__len__`/`__getitem__`, mô hình là lớp con của `nn.Module`.

# %%
class DemBuoc:
    def __init__(self, ten):
        self.ten = ten          # thuộc tính riêng của từng đối tượng
        self.so_buoc = 0

    def tang(self):
        self.so_buoc += 1
        return self.so_buoc

    def __repr__(self):
        return f"DemBuoc({self.ten!r}, so_buoc={self.so_buoc})"


a, b = DemBuoc("a"), DemBuoc("b")
a.tang(); a.tang(); b.tang()
print(a, b)

# %% [markdown]
# ## BÀI TẬP
# 1. Lớp `TapDuLieu(X, y)`:
#    - `__init__` báo `ValueError` nếu `len(X) != len(y)`;
#    - `__len__` trả số mẫu; `__getitem__(i)` trả `(X[i], y[i])`;
#    - `cac_lo(kich_thuoc)` là generator trả lần lượt `(X_lô, y_lô)` (lô cuối có thể ngắn hơn).
# 2. Lớp `MoHinhTuyenTinh(w=0.0, b=0.0)`:
#    - `du_doan(x)` trả `w * x + b`;
#    - `cap_nhat(x, y, lr)` làm một bước gradient descent với loss `(du_doan(x) - y) ** 2`
#      (đạo hàm theo w là `2 * sai * x`, theo b là `2 * sai`) và trả loss trước khi cập nhật.

# %%
class TapDuLieu:
    # >>> LOI GIAI: cài đủ bốn phương thức
    def __init__(self, X, y):
        if len(X) != len(y):
            raise ValueError("X và y phải cùng số mẫu")
        self.X, self.y = list(X), list(y)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        return self.X[i], self.y[i]

    def cac_lo(self, kich_thuoc):
        for i in range(0, len(self), kich_thuoc):
            yield self.X[i:i + kich_thuoc], self.y[i:i + kich_thuoc]
    # <<< LOI GIAI


class MoHinhTuyenTinh:
    # >>> LOI GIAI: lưu w, b; du_doan; cap_nhat một bước
    def __init__(self, w=0.0, b=0.0):
        self.w, self.b = w, b

    def du_doan(self, x):
        return self.w * x + self.b

    def cap_nhat(self, x, y, lr):
        sai = self.du_doan(x) - y
        self.w -= lr * 2 * sai * x
        self.b -= lr * 2 * sai
        return sai ** 2
    # <<< LOI GIAI

# %%
ds = TapDuLieu([1, 2, 3], [2, 4, 6])
assert len(ds) == 3 and ds[1] == (2, 4)
assert list(TapDuLieu(range(5), range(5)).cac_lo(2)) == [([0, 1], [0, 1]), ([2, 3], [2, 3]), ([4], [4])]
try:
    TapDuLieu([1, 2], [1])
    raise AssertionError("độ dài lệch phải báo ValueError")
except ValueError:
    pass
m = MoHinhTuyenTinh()
for _ in range(200):
    for x, y in ds:
        m.cap_nhat(x, y, 0.02)
assert abs(m.w - 2) < 0.05 and abs(m.b) < 0.1, f"mô hình phải học được y = 2x, nhận w={m.w:.3f}, b={m.b:.3f}"
print("Hoàn thành bài 8")
