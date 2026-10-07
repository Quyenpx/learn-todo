# %% [markdown]
# # Bài 7 — Comprehension và xử lý chuỗi
#
# Mục tiêu: list/dict comprehension, `split`, `lower`, `strip`, `join` — bước tiền xử lý văn bản trước khi đưa vào mô hình.

# %%
so = [1, 2, 3, 4, 5]
print([x * x for x in so])
print([x for x in so if x % 2 == 1])
print({x: x * x for x in so})
cau = "  Học Máy rất THÚ VỊ  "
print(repr(cau.strip()), cau.lower().split(), "-".join(["a", "b", "c"]))

# %% [markdown]
# ## Bỏ dấu câu
# `str.isalnum()` cho biết ký tự là chữ hoặc số (kể cả chữ có dấu tiếng Việt).

# %%
print("".join(ch for ch in "Xin chào, thế giới!" if ch.isalnum() or ch.isspace()))

# %% [markdown]
# ## BÀI TẬP
# 1. `lam_sach(cau)`: viết thường, thay ký tự không phải chữ/số/khoảng trắng bằng khoảng trắng, trả list từ.
# 2. `dem_tu(tu)`: nhận list từ, trả dict từ → số lần.
# 3. `tu_pho_bien(cau, k)`: trả list k từ xuất hiện nhiều nhất (dùng `collections.Counter(...).most_common(k)`).

# %%
from collections import Counter


def lam_sach(cau):
    # >>> LOI GIAI: lower, thay dấu câu bằng khoảng trắng, split
    sach = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in cau.lower())
    return sach.split()
    # <<< LOI GIAI


def dem_tu(tu):
    # >>> LOI GIAI: dict comprehension trên tập từ
    return {w: tu.count(w) for w in set(tu)}
    # <<< LOI GIAI


def tu_pho_bien(cau, k):
    # >>> LOI GIAI: Counter trên kết quả lam_sach
    return [w for w, _ in Counter(lam_sach(cau)).most_common(k)]
    # <<< LOI GIAI

# %%
assert lam_sach("Học, học nữa!") == ["học", "học", "nữa"]
assert lam_sach("   ") == []
assert dem_tu(["a", "b", "a"]) == {"a": 2, "b": 1}
assert tu_pho_bien("mèo chó mèo chim mèo chó", 2) == ["mèo", "chó"]
print("Hoàn thành bài 7")
