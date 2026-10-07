# %% [markdown]
# # Bài 3 — Câu lệnh điều kiện
#
# Mục tiêu: `if/elif/else`, thứ tự kiểm tra, giá trị biên, `and/or/not`.

# %%
diem = 7
if diem < 0 or diem > 10:
    print("Điểm không hợp lệ")
elif diem >= 8:
    print("Giỏi")
elif diem >= 6.5:
    print("Khá")
elif diem >= 5:
    print("Trung bình")
else:
    print("Yếu")

# %% [markdown]
# ## Thứ tự quan trọng
# Python kiểm tra từ trên xuống và dừng ở nhánh đúng đầu tiên. Nếu đặt `diem >= 5` lên trước,
# điểm 9 cũng bị xếp "Trung bình".

# %%
print(0 <= 7 <= 10, not (7 > 10), (3 > 5) or (2 < 4))

# %% [markdown]
# ## BÀI TẬP
# | Điều kiện | Kết quả |
# |---|---|
# | ngoài [0, 10] | `"Điểm không hợp lệ"` |
# | ≥ 8 | `"Giỏi"` |
# | ≥ 6.5 | `"Khá"` |
# | ≥ 5 | `"Trung bình"` |
# | còn lại | `"Yếu"` |
#
# 1. Viết `xep_loai(diem)` theo bảng.
# 2. Viết `nhan_tu_xac_suat(p, nguong=0.5)` trả 1 nếu `p >= nguong`, ngược lại 0 (như bộ phân loại).

# %%
def xep_loai(diem):
    # >>> LOI GIAI: kiểm tra không hợp lệ trước, sau đó từ mức cao xuống thấp
    if diem < 0 or diem > 10:
        return "Điểm không hợp lệ"
    if diem >= 8:
        return "Giỏi"
    if diem >= 6.5:
        return "Khá"
    if diem >= 5:
        return "Trung bình"
    return "Yếu"
    # <<< LOI GIAI


def nhan_tu_xac_suat(p, nguong=0.5):
    # >>> LOI GIAI: so sánh p với nguong
    return 1 if p >= nguong else 0
    # <<< LOI GIAI

# %%
for d, mong_doi in [(5, "Trung bình"), (6.5, "Khá"), (8, "Giỏi"), (0, "Yếu"), (10, "Giỏi"), (11, "Điểm không hợp lệ"), (-1, "Điểm không hợp lệ")]:
    assert xep_loai(d) == mong_doi, f"xep_loai({d}) phải là {mong_doi!r}, nhận {xep_loai(d)!r}"
assert nhan_tu_xac_suat(0.5) == 1 and nhan_tu_xac_suat(0.49) == 0
assert nhan_tu_xac_suat(0.7, nguong=0.8) == 0
print("Hoàn thành bài 3")
