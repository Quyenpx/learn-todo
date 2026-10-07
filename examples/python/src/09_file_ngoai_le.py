# %% [markdown]
# # Bài 9 — File và ngoại lệ
#
# Mục tiêu: đọc/ghi file bằng `with open(...)`, bắt đúng loại lỗi (`FileNotFoundError`, `ValueError`),
# và chuẩn bị môi trường cài thư viện cho phần NumPy, pandas, scikit-learn, PyTorch.

# %%
import os
import tempfile

# Tạo file CSV mẫu trong thư mục tạm để không ghi rác vào dự án
THU_MUC = tempfile.mkdtemp(prefix="bai9_")
DUONG_DAN = os.path.join(THU_MUC, "diem.csv")
with open(DUONG_DAN, "w", encoding="utf-8") as f:
    f.write("ten,diem\nAn,8\nBình,6.5\nChi,tám\nDũng,9\n")
print("Đã tạo", DUONG_DAN)

with open(DUONG_DAN, encoding="utf-8") as f:
    for so_dong, dong in enumerate(f, start=1):
        print(so_dong, dong.rstrip("\n"))

# %% [markdown]
# ## Bắt đúng loại lỗi
# Chỉ bắt lỗi bạn biết cách xử lý. `except Exception` che mất lỗi thật và làm khó gỡ lỗi.

# %%
try:
    open(os.path.join(THU_MUC, "khong_co.csv"), encoding="utf-8")
except FileNotFoundError as loi:
    print("FileNotFoundError:", loi.strerror)

try:
    float("tám")
except ValueError as loi:
    print("ValueError:", loi)
finally:
    print("finally luôn chạy, dùng để dọn dẹp")

# %% [markdown]
# ## BÀI TẬP
# Viết `doc_diem(duong_dan)` trả `(danh_sach_diem, so_dong_loi)`:
# - bỏ dòng tiêu đề; mỗi dòng tách bằng `split(",")`, đổi cột 2 sang `float`;
# - dòng nào đổi lỗi (`ValueError`) hoặc thiếu cột (`IndexError`) thì bỏ qua và tăng `so_dong_loi`;
# - file không tồn tại thì để `FileNotFoundError` bay ra (không bắt).

# %%
def doc_diem(duong_dan):
    # >>> LOI GIAI: with open, bỏ tiêu đề, try/except từng dòng
    diem, so_loi = [], 0
    with open(duong_dan, encoding="utf-8") as f:
        next(f, None)
        for dong in f:
            try:
                diem.append(float(dong.strip().split(",")[1]))
            except (ValueError, IndexError):
                so_loi += 1
    return diem, so_loi
    # <<< LOI GIAI

# %%
assert doc_diem(DUONG_DAN) == ([8.0, 6.5, 9.0], 1)
try:
    doc_diem(os.path.join(THU_MUC, "khong_co.csv"))
    raise AssertionError("file không tồn tại phải báo FileNotFoundError")
except FileNotFoundError:
    pass

# %% [markdown]
# ## Chuẩn bị thư viện cho phần sau
# Trong terminal (đã kích hoạt môi trường ảo):
# ```
# pip install -r examples/python/requirements.txt
# python -c "import numpy, pandas, sklearn, torch"
# ```
# Ô dưới chỉ báo thư viện nào đã có, không làm notebook dừng.

# %%
import importlib.util
for ten in ["numpy", "pandas", "matplotlib", "sklearn", "torch"]:
    print(f"{ten:<11}", "đã cài" if importlib.util.find_spec(ten) else "CHƯA cài")
print("Hoàn thành bài 9")
