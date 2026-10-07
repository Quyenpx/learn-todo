"""Hồi quy một đặc trưng: chia tập, fit train, chọn validation, đo test cuối."""
import argparse
import csv
import json
import math
from pathlib import Path
import random
import sys


def validate_rows(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Dữ liệu phải là danh sách không rỗng.")
    for row in rows:
        if not isinstance(row, dict) or any(type(row.get(key)) not in (int, float) or not math.isfinite(row[key]) for key in ("x", "y")):
            raise ValueError("Mỗi mẫu cần x và y là số hữu hạn.")
    return rows


def finite(value):
    # Phép ** với float lớn ném OverflowError, phép nhân lại cho inf/nan; gom về một lỗi dễ hiểu.
    if not math.isfinite(value):
        raise ValueError("Giá trị quá lớn, phép tính vượt miền số hữu hạn. Hãy chuẩn hóa đơn vị dữ liệu.")
    return value


def load_data(path):
    with Path(path).open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not {"gio_hoc", "diem"}.issubset(reader.fieldnames):
            raise ValueError("CSV cần hai cột gio_hoc và diem.")
        try:
            rows = [{"x": float(row["gio_hoc"]), "y": float(row["diem"])} for row in reader]
        except (TypeError, ValueError) as error:
            raise ValueError("Mỗi dòng CSV cần đủ giờ học và điểm dạng số.") from error
    return validate_rows(rows)


def split_data(rows, train_ratio=0.6, validation_ratio=0.2, seed=7):
    validate_rows(rows)
    if any(type(ratio) not in (int, float) or not math.isfinite(ratio) or not 0 < ratio < 1 for ratio in (train_ratio, validation_ratio)) or train_ratio + validation_ratio >= 1:
        raise ValueError("Tỷ lệ phải dương và tổng train + validation nhỏ hơn 1.")
    if type(seed) is not int or seed < 0:
        raise ValueError("Seed phải là số nguyên không âm.")
    shuffled = [dict(row) for row in rows]
    random.Random(seed).shuffle(shuffled)
    n_train, n_validation = int(len(rows) * train_ratio), int(len(rows) * validation_ratio)
    if min(n_train, n_validation, len(rows) - n_train - n_validation) < 1:
        raise ValueError("Cần đủ mẫu để cả ba tập đều không rỗng.")
    return {"train": shuffled[:n_train], "validation": shuffled[n_train:n_train + n_validation], "test": shuffled[n_train + n_validation:]}


def fit_scaler(train):
    validate_rows(train)
    mean = finite(sum(row["x"] for row in train) / len(train))
    scale = math.sqrt(finite(sum((row["x"] - mean) * (row["x"] - mean) for row in train) / len(train)))
    return {"mean": mean, "scale": scale or 1.0}


def transform(rows, scaler):
    validate_rows(rows)
    return [{"x": (row["x"] - scaler["mean"]) / scaler["scale"], "y": row["y"]} for row in rows]


def fit_model(train, alpha=0):
    validate_rows(train)
    if type(alpha) not in (int, float) or not math.isfinite(alpha) or alpha < 0:
        raise ValueError("Alpha phải là số hữu hạn không âm.")
    mean_x = finite(sum(row["x"] for row in train) / len(train))
    mean_y = finite(sum(row["y"] for row in train) / len(train))
    numerator = finite(sum((row["x"] - mean_x) * (row["y"] - mean_y) for row in train))
    denominator = finite(sum((row["x"] - mean_x) * (row["x"] - mean_x) for row in train) + alpha)
    slope = numerator / denominator if denominator else 0.0
    return {"slope": slope, "intercept": mean_y - slope * mean_x}


def predict(model, rows):
    validate_rows(rows)
    return [model["intercept"] + model["slope"] * row["x"] for row in rows]


def mse(labels, predictions):
    if not labels or len(labels) != len(predictions) or any(type(value) not in (int, float) or not math.isfinite(value) for value in list(labels) + list(predictions)):
        raise ValueError("Hai dãy số hữu hạn phải cùng độ dài và không rỗng.")
    return finite(sum((label - prediction) * (label - prediction) for label, prediction in zip(labels, predictions)) / len(labels))


def select_model(train, validation, alphas):
    validate_rows(train)
    validate_rows(validation)
    if not alphas:
        raise ValueError("Cần ít nhất một cấu hình alpha.")
    candidates = []
    for alpha in alphas:
        model = fit_model(train, alpha)
        error = mse([row["y"] for row in validation], predict(model, validation))
        candidates.append({"alpha": alpha, "validation_mse": error, "model": model})
    best = min(candidates, key=lambda item: (item["validation_mse"], item["alpha"]))
    return {**best, "candidates": candidates}


def evaluate_split(sets, alphas=(0, 1, 10)):
    scaler = fit_scaler(sets["train"])
    train = transform(sets["train"], scaler)
    validation = transform(sets["validation"], scaler)
    selection = select_model(train, validation, alphas)
    # Chỉ đọc test sau khi cố định cấu hình và mô hình đã học trên train.
    test = transform(sets["test"], scaler)
    return {"counts": {key: len(sets[key]) for key in ("train", "validation", "test")},
            "scaler": scaler, "selection": selection,
            "test_mse": mse([row["y"] for row in test], predict(selection["model"], test)),
            "note": "Dữ liệu tổng hợp; MSE có đơn vị điểm bình phương. Không dùng test để chọn alpha."}


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path(__file__).with_name("study_scores.csv"))
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    try:
        report = evaluate_split(split_data(load_data(args.data), seed=args.seed))
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
