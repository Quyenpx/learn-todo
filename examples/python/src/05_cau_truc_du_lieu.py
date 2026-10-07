# %% [markdown]
# # Bài 5 — list, tuple, dict, set
#
# Mục tiêu: chỉ số, cắt lát, phương thức thường dùng; chọn cấu trúc phù hợp cho dữ liệu ML.

# %%
diem = [8, 6.5, 9, 7]
print(diem[0], diem[-1], diem[1:3], diem[::-1], len(diem))
diem.append(10)
print("sau append:", diem)
try:
    diem[10]
except IndexError as loi:
    print("IndexError:", loi)

# %% [markdown]
# ## tuple, dict, set
# - `tuple` không đổi được, hay dùng cho shape `(hàng, cột)`.
# - `dict` ánh xạ khóa → giá trị, ví dụ cấu hình siêu tham số.
# - `set` tập không trùng lặp, ví dụ tập nhãn.

# %%
shape = (3, 2)
cau_hinh = {"lr": 0.1, "so_vong": 100}
cau_hinh["batch"] = 32
nhan = ["mèo", "chó", "mèo", "chim"]
print(shape[0], cau_hinh, cau_hinh.get("dropout", 0.0))
print("tập nhãn:", sorted(set(nhan)))
for khoa, gia_tri in cau_hinh.items():
    print(f"  {khoa} = {gia_tri}")

# %% [markdown]
# ## BÀI TẬP
# 1. `chia_train_test(ds, ti_le)`: `n = int(len(ds) * ti_le)`, trả `(ds[:n], ds[n:])` bằng cắt lát.
# 2. `dem_nhan(nhan)`: trả dict đếm số lần xuất hiện của mỗi nhãn (không dùng `Counter`).

# %%
def chia_train_test(ds, ti_le):
    # >>> LOI GIAI: tính n rồi cắt lát hai phần
    n = int(len(ds) * ti_le)
    return ds[:n], ds[n:]
    # <<< LOI GIAI


def dem_nhan(nhan):
    # >>> LOI GIAI: dùng dict.get(khóa, 0) + 1
    dem = {}
    for x in nhan:
        dem[x] = dem.get(x, 0) + 1
    return dem
    # <<< LOI GIAI

# %%
train, test = chia_train_test(list(range(10)), 0.8)
assert train == [0, 1, 2, 3, 4, 5, 6, 7] and test == [8, 9]
assert dem_nhan(["mèo", "chó", "mèo"]) == {"mèo": 2, "chó": 1}
assert dem_nhan([]) == {}
print("Hoàn thành bài 5")
