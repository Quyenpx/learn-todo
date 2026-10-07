"""Kiểm thử hành vi thực của hai chương trình, không cần dịch vụ ngoài."""
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def program(case, relative):
    path = ROOT / relative
    case.assertTrue(path.is_file(), "Chưa có chương trình: " + relative)
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.rag = program(self, "examples/genai/rag.py")
        self.docs = [{"title": "Đổi trả", "source": "chinh-sach/doi-tra", "text": "Đổi trả sản phẩm trong 7 ngày nếu còn hóa đơn."},
                     {"title": "Giao hàng", "source": "chinh-sach/giao-hang", "text": "Giao hàng nội thành trong 2 ngày làm việc."}]

    def test_trich_nguyen_van_va_nguon_khi_co_chung_cu(self):
        result = self.rag.answer("Đổi trả sản phẩm trong bao lâu?", self.docs)
        self.assertTrue(result["answered"])
        self.assertIn(self.docs[0]["text"], result["answer"])
        self.assertEqual(result["sources"][0]["source"], "chinh-sach/doi-tra")

    def test_tu_choi_cau_hoi_ngoai_tai_lieu(self):
        result = self.rag.answer("Lãi suất vay ngân hàng?", self.docs)
        self.assertFalse(result["answered"])
        self.assertEqual(result["sources"], [])

    def test_mot_tu_chung_khong_du_chung_cu(self):
        self.assertFalse(self.rag.answer("Sản phẩm bảo hiểm y tế?", self.docs)["answered"])

    def test_khong_dau_va_hoa_thuong_truy_xuat_cung_nguon(self):
        result = self.rag.answer("DOI TRA SAN PHAM?", self.docs)
        self.assertEqual(result["sources"][0]["source"], "chinh-sach/doi-tra")

    def test_rong_va_sai_kieu_bi_tu_choi(self):
        for query in ["", "   ", None, 12]:
            with self.subTest(query=query), self.assertRaises(ValueError):
                self.rag.answer(query, self.docs)

    def test_tham_so_va_tai_lieu_sai_bi_tu_choi(self):
        for kwargs in [{"top_k": 0}, {"top_k": 1.5}, {"min_overlap": 0}, {"min_coverage": float("nan")}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.rag.answer("Đổi trả sản phẩm?", self.docs, **kwargs)
        with self.assertRaises(ValueError):
            self.rag.answer("Đổi trả sản phẩm?", [{"text": "Thiếu nguồn"}])

    def test_load_tai_lieu_mau_va_file_sai(self):
        docs = self.rag.load_documents(ROOT / "examples/genai/policies.json")
        self.assertGreaterEqual(len(docs), 3)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.json"
            path.write_text('{"not": "documents"}', encoding="utf-8")
            with self.assertRaises(ValueError):
                self.rag.load_documents(path)

    def test_lenh_chay_co_chung_cu(self):
        result = subprocess.run([sys.executable, str(ROOT / "examples/genai/rag.py"), "--question", "Đổi trả sản phẩm trong bao lâu?"], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["answered"])

    def test_lenh_chay_input_sai_co_ma_loi(self):
        result = subprocess.run([sys.executable, str(ROOT / "examples/genai/rag.py"), "--question", ""], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("Traceback", result.stderr)


class MachineLearningTests(unittest.TestCase):
    def setUp(self):
        self.ml = program(self, "examples/ml/workflow.py")

    def test_chia_tap_khong_trung_va_tai_lap(self):
        data = [{"x": i, "y": i * 2} for i in range(10)]
        sets = self.ml.split_data(data, seed=7)
        self.assertEqual([len(sets[k]) for k in ["train", "validation", "test"]], [6, 2, 2])
        self.assertEqual(sets, self.ml.split_data(data, seed=7))
        ids = [row["x"] for rows in sets.values() for row in rows]
        self.assertEqual(sorted(ids), list(range(10)))

    def test_chia_tap_sai_bi_tu_choi(self):
        for kwargs in [{"train_ratio": .9, "validation_ratio": .2}, {"train_ratio": float("nan")}, {"seed": -1}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.ml.split_data([{"x": i, "y": i} for i in range(10)], **kwargs)
        with self.assertRaises(ValueError):
            self.ml.split_data([{"x": 1, "y": 1}])

    def test_scaler_fit_train_va_ap_dung_nguyen_trang(self):
        scaler = self.ml.fit_scaler([{"x": 2, "y": 0}, {"x": 4, "y": 0}])
        self.assertEqual(scaler, {"mean": 3.0, "scale": 1.0})
        self.assertEqual(self.ml.transform([{"x": 100, "y": 8}], scaler), [{"x": 97.0, "y": 8}])
        self.assertEqual(scaler, {"mean": 3.0, "scale": 1.0})

    def test_cot_hang_khong_chia_cho_khong(self):
        scaler = self.ml.fit_scaler([{"x": 2, "y": 1}, {"x": 2, "y": 2}])
        self.assertEqual(scaler["scale"], 1.0)
        self.assertEqual(self.ml.transform([{"x": 2, "y": 9}], scaler)[0]["x"], 0.0)

    def test_hoi_quy_tuyen_tinh_du_doan_mau_moi(self):
        model = self.ml.fit_model([{"x": -1, "y": 1}, {"x": 1, "y": 5}], alpha=0)
        self.assertEqual(self.ml.predict(model, [{"x": 2, "y": 0}]), [7.0])

    def test_mse_bang_gia_tri_tinh_tay(self):
        self.assertEqual(self.ml.mse([1, 3], [2, 1]), 2.5)
        for labels, predictions in [([], []), ([1], [1, 2]), ([float("nan")], [1])]:
            with self.subTest(labels=labels), self.assertRaises(ValueError):
                self.ml.mse(labels, predictions)

    def test_chon_model_bang_validation(self):
        selection = self.ml.select_model([{"x": -1, "y": 1}, {"x": 1, "y": 5}], [{"x": 2, "y": 7}], [0, 100])
        self.assertEqual(selection["alpha"], 0)
        self.assertEqual(selection["validation_mse"], 0.0)
        self.assertEqual(len(selection["candidates"]), 2)

    def test_test_khong_anh_huong_lua_chon_hoac_scaler(self):
        sets = {"train": [{"x": 2, "y": 1}, {"x": 4, "y": 5}], "validation": [{"x": 5, "y": 7}], "test": [{"x": 6, "y": 9}]}
        a = self.ml.evaluate_split(sets, [0, 100])
        sets["test"] = [{"x": 6000, "y": -9000}]
        b = self.ml.evaluate_split(sets, [0, 100])
        self.assertEqual(a["selection"], b["selection"])
        self.assertEqual(a["scaler"], b["scaler"])
        self.assertNotEqual(a["test_mse"], b["test_mse"])

    def test_csv_mau_va_du_lieu_sai(self):
        rows = self.ml.load_data(ROOT / "examples/ml/study_scores.csv")
        self.assertGreaterEqual(len(rows), 20)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.csv"
            for content in ['gio_hoc,diem\nNaN,5\n', 'gio_hoc,diem\n1\n']:
                path.write_text(content, encoding="utf-8")
                with self.subTest(content=content), self.assertRaises(ValueError):
                    self.ml.load_data(path)

    def test_du_lieu_va_alpha_sai_bi_tu_choi(self):
        with self.assertRaises(ValueError):
            self.ml.fit_scaler([])
        with self.assertRaises(ValueError):
            self.ml.fit_model([{"x": 1, "y": 1}], alpha=-1)
        with self.assertRaises(ValueError):
            self.ml.select_model([{"x": 1, "y": 1}], [], [0])

    def test_gia_tri_qua_lon_bao_loi_ro_rang(self):
        # Bình phương 1e200 vượt miền float; phải trả ValueError tiếng Việt thay vì OverflowError/traceback.
        huge = [{"x": 1e200, "y": 1}, {"x": -1e200, "y": 2}]
        with self.assertRaises(ValueError):
            self.ml.fit_scaler(huge)
        with self.assertRaises(ValueError):
            self.ml.fit_model(huge, alpha=0)
        with self.assertRaises(ValueError):
            self.ml.mse([1e200], [-1e200])

    def test_lenh_chay_bao_cao_test_cuoi(self):
        result = subprocess.run([sys.executable, str(ROOT / "examples/ml/workflow.py")], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["counts"], {"train": 18, "validation": 6, "test": 6})
        self.assertTrue(math.isfinite(report["test_mse"]))


if __name__ == "__main__":
    unittest.main()
