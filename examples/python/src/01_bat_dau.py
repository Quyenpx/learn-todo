# %% [markdown]
# # Bài 1 — Bắt đầu với Python
#
# Mục tiêu: chạy ô code, dùng `print`, biến, f-string và đọc thông báo lỗi.
#
# Cách dùng notebook: chọn một ô rồi bấm **Shift+Enter** để chạy. Chạy lần lượt từ trên xuống.

# %%
import sys
print("Phiên bản Python:", sys.version.split()[0])
print("Xin", "chào", sep="-")      # sep: chuỗi nối giữa các giá trị
print("Không xuống dòng", end="... ")
print("tiếp tục cùng dòng")

# %% [markdown]
# ## Biến và f-string
# Biến là tên gắn với một giá trị. f-string chèn giá trị vào chuỗi bằng `{tên_biến}`.

# %%
ten = "An"
tuoi = 20
print(f"{ten} năm nay {tuoi} tuổi, sang năm {tuoi + 1} tuổi.")

# %% [markdown]
# ## Đọc lỗi
# Ô dưới cố cộng chuỗi với số. Python dừng và báo `TypeError`; dòng cuối của thông báo cho biết nguyên nhân.
# Ta bắt lỗi bằng `try/except` để notebook chạy tiếp (bài 9 học kỹ hơn).

# %%
try:
    print("Tuổi: " + tuoi)
except TypeError as loi:
    print("TypeError:", loi)
print("Sửa bằng str():", "Tuổi: " + str(tuoi))

# %% [markdown]
# ## BÀI TẬP
# 1. Viết `chao(ten)` trả chuỗi `"Xin chào, <ten>!"`.
# 2. Viết `tuoi_nam_sau(tuoi_chuoi)` nhận tuổi dạng chuỗi (ví dụ `"17"`) và trả số nguyên tuổi năm sau.
#    Gợi ý: `int("17")` đổi chuỗi thành số.

# %%
def chao(ten):
    # >>> LOI GIAI: trả f-string "Xin chào, {ten}!"
    return f"Xin chào, {ten}!"
    # <<< LOI GIAI


def tuoi_nam_sau(tuoi_chuoi):
    # >>> LOI GIAI: đổi chuỗi sang int rồi cộng 1
    return int(tuoi_chuoi) + 1
    # <<< LOI GIAI

# %% [markdown]
# ## Kiểm tra
# Nếu một `assert` sai, Python báo `AssertionError` kèm gợi ý. Sửa hàm rồi chạy lại ô trên và ô này.

# %%
assert chao("Bình") == "Xin chào, Bình!", "chao('Bình') phải trả 'Xin chào, Bình!'"
assert tuoi_nam_sau("17") == 18, "tuoi_nam_sau('17') phải trả số 18 (kiểu int)"
assert isinstance(tuoi_nam_sau("0"), int), "kết quả phải là int"
print("Hoàn thành bài 1")
