# %% [markdown]
# # Bài 12 — pandas và matplotlib
#
# Mục tiêu: `DataFrame`, chọn dòng/cột (`loc`, lọc điều kiện), `groupby`, giá trị thiếu và vẽ biểu đồ.

# %%
import os
import tempfile

import matplotlib
matplotlib.use("Agg")            # vẽ ra file, không cần cửa sổ; trong Jupyter có thể bỏ dòng này
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

df = pd.DataFrame({
    "ten": ["An", "Bình", "Chi", "Dũng", "Em", "Giang", "Hà", "Khoa"],
    "lop": ["A", "A", "B", "B", "A", "B", "A", "B"],
    "gio_hoc": [5.0, 2.0, np.nan, 7.0, 4.0, 6.0, np.nan, 3.0],
    "diem": [8.0, 5.5, 7.0, 9.0, 7.5, 8.5, 6.0, 6.0],
})
print(df.head(3))
print(df.dtypes)

# %% [markdown]
# ## Chọn và lọc
# `df["cot"]` trả Series; `df.loc[điều_kiện, ["cột"]]` lọc dòng và chọn cột.

# %%
print(df.loc[df["gio_hoc"] > 3, ["ten", "gio_hoc"]])
print(df.groupby("lop")["diem"].mean())
print("thiếu mỗi cột:", df.isna().sum().to_dict())

# %% [markdown]
# ## BÀI TẬP
# 1. `tom_tat(df)` trả dict `{"so_dong": số dòng, "thieu": {cột: số giá trị thiếu}}`.
# 2. `diem_trung_binh_theo_lop(df)` trả Series điểm trung bình theo cột `lop`.
# 3. `dien_thieu(df_train, df_test)`: điền NaN của `gio_hoc` ở **cả hai** bằng trung bình của **train**,
#    trả `(train_moi, test_moi)` và không sửa DataFrame gốc (dùng `.copy()` hoặc `fillna` trả bản mới).

# %%
def tom_tat(df):
    # >>> LOI GIAI: len(df) và df.isna().sum()
    return {"so_dong": len(df), "thieu": df.isna().sum().to_dict()}
    # <<< LOI GIAI


def diem_trung_binh_theo_lop(df):
    # >>> LOI GIAI: groupby rồi mean
    return df.groupby("lop")["diem"].mean()
    # <<< LOI GIAI


def dien_thieu(df_train, df_test):
    # >>> LOI GIAI: tính trung bình trên train rồi fillna cho cả hai
    tb = df_train["gio_hoc"].mean()
    train_moi, test_moi = df_train.copy(), df_test.copy()
    train_moi["gio_hoc"] = train_moi["gio_hoc"].fillna(tb)
    test_moi["gio_hoc"] = test_moi["gio_hoc"].fillna(tb)
    return train_moi, test_moi
    # <<< LOI GIAI

# %%
assert tom_tat(df) == {"so_dong": 8, "thieu": {"ten": 0, "lop": 0, "gio_hoc": 2, "diem": 0}}
tb_lop = diem_trung_binh_theo_lop(df)
assert abs(tb_lop["A"] - 6.75) < 1e-9 and abs(tb_lop["B"] - 7.625) < 1e-9
train, test = df.iloc[:5], df.iloc[5:]
train_moi, test_moi = dien_thieu(train, test)
tb_train = train["gio_hoc"].mean()
assert train_moi["gio_hoc"].isna().sum() == 0 and test_moi["gio_hoc"].isna().sum() == 0
assert test_moi.loc[6, "gio_hoc"] == tb_train, "test phải được điền bằng trung bình của train"
assert df["gio_hoc"].isna().sum() == 2, "không được sửa DataFrame gốc"

# Vẽ và lưu biểu đồ ra thư mục tạm
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.5))
ax1.scatter(df["gio_hoc"], df["diem"]); ax1.set_xlabel("giờ học"); ax1.set_ylabel("điểm")
ax2.hist(df["diem"], bins=5); ax2.set_xlabel("điểm")
anh = os.path.join(tempfile.mkdtemp(prefix="bai12_"), "bieu_do.png")
fig.savefig(anh, dpi=100, bbox_inches="tight"); plt.close(fig)
assert os.path.getsize(anh) > 0
print("Đã lưu ảnh:", anh)
print("Hoàn thành bài 12")
