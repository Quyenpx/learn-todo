# %% [markdown]
# # Bài 2 — Biến và kiểu dữ liệu
#
# Mục tiêu: phân biệt `int`, `float`, `str`, `bool`, `None`; đổi kiểu an toàn.
# Trước khi chạy mỗi ô, hãy đoán kết quả rồi so sánh.

# %%
for gia_tri in [42, 3.5, "42", True, None]:
    print(repr(gia_tri), "->", type(gia_tri).__name__)

# %% [markdown]
# ## Phép chia và số thực
# `/` luôn trả float, `//` chia lấy phần nguyên, `%` lấy dư. Số thực có sai số làm tròn nhỏ.

# %%
print(7 / 2, 7 // 2, 7 % 2)
print(0.1 + 0.2, 0.1 + 0.2 == 0.3)
print(abs((0.1 + 0.2) - 0.3) < 1e-9)   # so sánh số thực bằng sai số cho phép

# %% [markdown]
# ## Đổi kiểu
# `int("3.5")` báo `ValueError`; `bool("0")` là `True` vì chuỗi không rỗng.

# %%
print(int("42"), float("3.5"), int(float("3.5")), bool(""), bool("0"))
try:
    int("3.5")
except ValueError as loi:
    print("ValueError:", loi)

# %% [markdown]
# ## BÀI TẬP
# Viết `doc_so(chuoi)` trả `float` nếu chuỗi là số, ngược lại trả `None`.
# Gợi ý: dùng `try: ... except ValueError: ...`; nên `strip()` khoảng trắng trước.

# %%
def doc_so(chuoi):
    # >>> LOI GIAI: thử float(chuoi.strip()), lỗi ValueError thì trả None
    try:
        return float(chuoi.strip())
    except ValueError:
        return None
    # <<< LOI GIAI

# %%
assert doc_so("3.5") == 3.5
assert doc_so(" 42 ") == 42.0 and isinstance(doc_so("42"), float), "doc_so('42') phải trả float 42.0"
assert doc_so("abc") is None, "chuỗi không phải số phải trả None"
assert doc_so("") is None
print("Hoàn thành bài 2")
