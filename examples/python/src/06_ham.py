# %% [markdown]
# # Bài 6 — Hàm
#
# Mục tiêu: định nghĩa hàm, tham số mặc định, `return`, kiểm tra đầu vào bằng `raise`.

# %%
def binh_phuong(x):
    return x * x


def khong_return(x):
    x * x           # tính xong nhưng không trả về -> hàm trả None


print(binh_phuong(3), khong_return(3))

# %% [markdown]
# ## Tham số mặc định và tham số từ khóa
# `b=0.0` là giá trị mặc định; gọi `du_doan(2, w=3)` rõ nghĩa hơn `du_doan(2, 3)`.
# Tránh dùng list làm giá trị mặc định (`def f(x=[])`) vì list được dùng chung giữa các lần gọi.

# %%
def tang(x, buoc=1):
    return x + buoc


print(tang(5), tang(5, buoc=10))

# %% [markdown]
# ## BÀI TẬP
# 1. `du_doan(x, w, b=0.0)` trả `w * x + b`.
# 2. `mse(ys, ys_hat)`: trung bình bình phương sai số. Báo `ValueError("Hai danh sách phải cùng độ dài và không rỗng")`
#    khi rỗng hoặc khác độ dài.
# 3. `mae(ys, ys_hat)`: trung bình trị tuyệt đối sai số (cùng kiểm tra đầu vào).

# %%
def du_doan(x, w, b=0.0):
    # >>> LOI GIAI: mô hình tuyến tính một biến
    return w * x + b
    # <<< LOI GIAI


def mse(ys, ys_hat):
    # >>> LOI GIAI: kiểm tra đầu vào rồi lấy trung bình (y - y_hat)^2
    if not ys or len(ys) != len(ys_hat):
        raise ValueError("Hai danh sách phải cùng độ dài và không rỗng")
    return sum((y - yh) ** 2 for y, yh in zip(ys, ys_hat)) / len(ys)
    # <<< LOI GIAI


def mae(ys, ys_hat):
    # >>> LOI GIAI: giống mse nhưng dùng abs
    if not ys or len(ys) != len(ys_hat):
        raise ValueError("Hai danh sách phải cùng độ dài và không rỗng")
    return sum(abs(y - yh) for y, yh in zip(ys, ys_hat)) / len(ys)
    # <<< LOI GIAI

# %%
assert du_doan(2, 3) == 6 and du_doan(2, 3, b=1) == 7
assert mse([2, 4], [2, 4]) == 0.0
assert mse([1, 2], [2, 4]) == 2.5
try:
    mse([], [])
    raise AssertionError("mse([], []) phải báo ValueError")
except ValueError as loi:
    print("Đúng, báo lỗi:", loi)
# Một điểm ngoại lai làm MSE tăng mạnh hơn MAE vì sai số được bình phương
ys, ys_hat = [1, 2, 3, 4], [1, 2, 3, 14]
print("MSE =", mse(ys, ys_hat), " MAE =", mae(ys, ys_hat))
assert mse(ys, ys_hat) == 25.0 and mae(ys, ys_hat) == 2.5
print("Hoàn thành bài 6")
