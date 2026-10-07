# %% [markdown]
# # Bài 4 — Vòng lặp
#
# Mục tiêu: `for` với `range`, `while` có điều kiện dừng, `break`, `continue`.
# Vòng lặp là nền của vòng huấn luyện mô hình: lặp lại "dự đoán → đo lỗi → cập nhật".

# %%
for i in range(3):
    print("vòng", i)
tong = 0
for x in [2, 4, 6]:
    tong += x
print("tổng =", tong)

# %% [markdown]
# ## while và giới hạn an toàn
# Mô phỏng loss giảm theo hệ số mỗi vòng. Luôn có `toi_da` để vòng không chạy mãi khi loss không giảm.

# %%
loss, buoc = 1.0, 0
while loss > 0.01 and buoc < 100:
    loss *= 0.5
    buoc += 1
print("dừng sau", buoc, "vòng, loss =", round(loss, 4))

for so in range(10):
    if so % 2 == 0:
        continue           # bỏ qua số chẵn
    if so > 7:
        break              # thoát vòng
    print(so, end=" ")
print()

# %% [markdown]
# ## BÀI TẬP
# 1. `tong_binh_phuong(n)` trả 1² + 2² + ... + n² bằng `for`.
# 2. `so_vong_hoi_tu(he_so, nguong, toi_da)`: bắt đầu `loss = 1.0`, mỗi vòng `loss *= he_so`,
#    dừng khi `loss <= nguong` hoặc đã chạy `toi_da` vòng; trả số vòng đã chạy.

# %%
def tong_binh_phuong(n):
    # >>> LOI GIAI: cộng k * k với k từ 1 đến n
    tong = 0
    for k in range(1, n + 1):
        tong += k * k
    return tong
    # <<< LOI GIAI


def so_vong_hoi_tu(he_so, nguong, toi_da):
    # >>> LOI GIAI: while có hai điều kiện dừng
    loss, buoc = 1.0, 0
    while loss > nguong and buoc < toi_da:
        loss *= he_so
        buoc += 1
    return buoc
    # <<< LOI GIAI

# %%
assert tong_binh_phuong(3) == 14 and tong_binh_phuong(0) == 0
assert so_vong_hoi_tu(0.5, 0.01, 100) == 7, "0.5^7 = 0.0078 là lần đầu ≤ 0.01"
assert so_vong_hoi_tu(1, 0.01, 50) == 50, "he_so = 1 thì loss không giảm, phải dừng ở toi_da"
assert so_vong_hoi_tu(0.5, 2, 10) == 0, "loss ban đầu đã ≤ ngưỡng thì không chạy vòng nào"
print("Hoàn thành bài 4")
