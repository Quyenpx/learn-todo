# %% [markdown]
# # Bài 15 — Dự án tổng kết: dự đoán học sinh đạt
#
# Ghép mọi kỹ năng: tạo/đọc dữ liệu bằng pandas, làm sạch, chia tập phân tầng, `Pipeline` có
# `SimpleImputer` + `StandardScaler` + `LogisticRegression`, chọn ngưỡng theo recall và đánh giá trên test.

# %%
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Dữ liệu tổng hợp: đạt phụ thuộc giờ học và số bài tập; có giá trị thiếu, dòng trùng và dòng thiếu nhãn
rng = np.random.default_rng(42)
n = 300
gio_hoc = rng.uniform(0, 10, n).round(1)
so_bai_tap = rng.integers(0, 21, n)
z = 0.8 * gio_hoc + 0.25 * so_bai_tap - 7 + rng.normal(0, 1.2, n)
df = pd.DataFrame({"gio_hoc": gio_hoc, "so_bai_tap": so_bai_tap, "dat": (z > 0).astype(float)})
df.loc[rng.choice(n, 25, replace=False), "gio_hoc"] = np.nan
df.loc[rng.choice(n, 5, replace=False), "dat"] = np.nan
df = pd.concat([df, df.iloc[:10]], ignore_index=True)        # 10 dòng trùng
print(df.shape)
print(df.isna().sum().to_dict(), " số dòng trùng:", int(df.duplicated().sum()))

# %% [markdown]
# ## BÀI TẬP
# 1. `lam_sach(df)`: bỏ dòng trùng, bỏ dòng thiếu nhãn `dat`, đổi `dat` sang `int`; **giữ** NaN ở `gio_hoc`
#    (Pipeline sẽ điền bằng trung vị học từ train). Trả DataFrame mới.
# 2. `tao_mo_hinh()`: trả `Pipeline` gồm `SimpleImputer(strategy="median")`, `StandardScaler()`, `LogisticRegression()`.
# 3. `chon_nguong(xac_suat, y, recall_toi_thieu)`: thử các ngưỡng 0.95, 0.90, ..., 0.05 (từ cao xuống)
#    và trả ngưỡng **đầu tiên** có recall ≥ yêu cầu (làm tròn 2 chữ số).

# %%
def lam_sach(df):
    # >>> LOI GIAI: drop_duplicates, dropna theo nhãn, ép kiểu nhãn
    sach = df.drop_duplicates().dropna(subset=["dat"]).copy()
    sach["dat"] = sach["dat"].astype(int)
    return sach
    # <<< LOI GIAI


def tao_mo_hinh():
    # >>> LOI GIAI: ba bước trong Pipeline
    return Pipeline([
        ("dien", SimpleImputer(strategy="median")),
        ("chuan_hoa", StandardScaler()),
        ("mo_hinh", LogisticRegression()),
    ])
    # <<< LOI GIAI


def chon_nguong(xac_suat, y, recall_toi_thieu):
    # >>> LOI GIAI: duyệt ngưỡng từ cao xuống thấp
    for nguong in np.arange(0.95, 0.04, -0.05):
        if recall_score(y, (xac_suat >= nguong).astype(int)) >= recall_toi_thieu:
            return round(float(nguong), 2)
    return 0.05
    # <<< LOI GIAI

# %%
sach = lam_sach(df)
assert sach is not None and sach.duplicated().sum() == 0 and sach["dat"].isna().sum() == 0
assert sach["gio_hoc"].isna().sum() > 0, "giữ NaN ở gio_hoc để Pipeline tự điền"
X, y = sach[["gio_hoc", "so_bai_tap"]], sach["dat"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)
mo_hinh = tao_mo_hinh().fit(X_train, y_train)
xac_suat_train = mo_hinh.predict_proba(X_train)[:, 1]
nguong = chon_nguong(xac_suat_train, y_train, 0.9)       # chọn ngưỡng trên train, không nhìn test
print("ngưỡng chọn được:", nguong)
y_pred = (mo_hinh.predict_proba(X_test)[:, 1] >= nguong).astype(int)
acc, rec, f1 = accuracy_score(y_test, y_pred), recall_score(y_test, y_pred), f1_score(y_test, y_pred)
print(f"accuracy = {acc:.3f}, recall = {rec:.3f}, f1 = {f1:.3f}")
print("ma trận nhầm lẫn [[TN, FP], [FN, TP]]:\n", confusion_matrix(y_test, y_pred))
assert 0.05 <= nguong <= 0.95
assert acc >= 0.75 and rec >= 0.8
print("Hoàn thành bài 15")
