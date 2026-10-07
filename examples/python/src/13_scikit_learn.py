# %% [markdown]
# # Bài 13 — scikit-learn: quy trình học máy
#
# Mục tiêu: chia train/test, `Pipeline` chuẩn hóa + KNN không rò rỉ, chọn k bằng cross-validation, đánh giá một lần trên test.

# %%
import numpy as np
from sklearn.datasets import load_iris
from sklearn.metrics import classification_report
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_iris(return_X_y=True)
print("X.shape =", X.shape, " số lớp:", len(np.unique(y)))
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)
print("train:", X_train.shape, " test:", X_test.shape)

# %% [markdown]
# ## Đọc lỗi tham số
# Thư viện kiểm tra tham số và báo lỗi rõ ràng; đọc dòng cuối để sửa nhanh.

# %%
try:
    train_test_split(X, y, test_size=1.0)
except ValueError as loi:
    print("ValueError:", str(loi)[:120], "...")

# %% [markdown]
# ## BÀI TẬP
# 1. `tao_pipeline(k)` trả `Pipeline([("scaler", StandardScaler()), ("knn", KNeighborsClassifier(n_neighbors=k))])`.
# 2. `chon_k(X_train, y_train, cac_k)` trả k có điểm `cross_val_score(..., cv=5).mean()` cao nhất (chỉ dùng train).

# %%
def tao_pipeline(k):
    # >>> LOI GIAI: Pipeline gồm scaler và knn
    return Pipeline([("scaler", StandardScaler()), ("knn", KNeighborsClassifier(n_neighbors=k))])
    # <<< LOI GIAI


def chon_k(X_train, y_train, cac_k):
    # >>> LOI GIAI: cross-validation trên train cho từng k
    diem = {k: cross_val_score(tao_pipeline(k), X_train, y_train, cv=5).mean() for k in cac_k}
    for k, d in diem.items():
        print(f"k = {k}: CV = {d:.3f}")
    return max(diem, key=diem.get)
    # <<< LOI GIAI

# %%
k_tot = chon_k(X_train, y_train, [1, 3, 5, 7, 9])
assert k_tot in [1, 3, 5, 7, 9]
mo_hinh = tao_pipeline(k_tot).fit(X_train, y_train)
assert isinstance(mo_hinh, Pipeline)
do_chinh_xac = mo_hinh.score(X_test, y_test)
print("k chọn được:", k_tot, " độ chính xác test:", round(do_chinh_xac, 3))
print(classification_report(y_test, mo_hinh.predict(X_test)))
assert do_chinh_xac >= 0.85
print("Hoàn thành bài 13")
