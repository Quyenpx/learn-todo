"""Kiểm thử notebook khóa Python cho AI.

Mục tiêu:
- Notebook sinh từ file nguồn luôn khớp (không sửa tay notebook rồi quên cập nhật nguồn).
- Bản lời giải chạy hết mọi ô và in "Hoàn thành bài N".
- Bản bài tập (đã thay lời giải bằng TODO) phải thất bại, chứng tỏ ô kiểm tra thực sự kiểm tra.
- Bài cần thư viện chưa cài thì bỏ qua kèm lý do thay vì báo lỗi giả.

Chạy: python -m unittest discover -s examples/python/tests
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAI = [
    ('01_bat_dau', []), ('02_bien_kieu_du_lieu', []), ('03_dieu_kien', []), ('04_vong_lap', []),
    ('05_cau_truc_du_lieu', []), ('06_ham', []), ('07_comprehension_chuoi', []), ('08_lop_doi_tuong', []),
    ('09_file_ngoai_le', []), ('10_numpy_co_ban', ['numpy']), ('11_numpy_dai_so', ['numpy']),
    ('12_pandas_matplotlib', ['numpy', 'pandas', 'matplotlib']), ('13_scikit_learn', ['numpy', 'sklearn']),
    ('14_pytorch', ['torch']), ('15_du_an_tong_ket', ['numpy', 'pandas', 'sklearn']),
]


def thieu_thu_vien(ds):
    return [m for m in ds if importlib.util.find_spec(m) is None]


def doc_notebook(duong_dan):
    with open(duong_dan, encoding='utf-8') as f:
        return json.load(f)


def chay_notebook(duong_dan):
    """Ghép các ô code thành một script rồi chạy trong thư mục tạm để không tạo file rác trong kho."""
    nb = doc_notebook(duong_dan)
    ma = '\n\n'.join(''.join(o['source']) for o in nb['cells'] if o['cell_type'] == 'code')
    with tempfile.TemporaryDirectory() as tam:
        script = os.path.join(tam, 'notebook.py')
        with open(script, 'w', encoding='utf-8') as f:
            f.write(ma)
        env = dict(os.environ, MPLBACKEND='Agg', PYTHONIOENCODING='utf-8')
        return subprocess.run([sys.executable, script], cwd=tam, env=env, capture_output=True, text=True, encoding='utf-8', timeout=600)


class KiemTraNotebook(unittest.TestCase):
    def test_notebook_khop_file_nguon(self):
        kq = subprocess.run([sys.executable, os.path.join(GOC, 'build_notebooks.py'), '--check'], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(kq.returncode, 0, kq.stdout + kq.stderr)

    def test_cau_truc_hop_le(self):
        for ten, _ in BAI:
            for duong_dan in (os.path.join(GOC, 'notebooks', ten + '.ipynb'), os.path.join(GOC, 'solutions', ten + '_loi_giai.ipynb')):
                with self.subTest(file=duong_dan):
                    nb = doc_notebook(duong_dan)
                    self.assertEqual(nb['nbformat'], 4)
                    loai = {o['cell_type'] for o in nb['cells']}
                    self.assertTrue({'markdown', 'code'} <= loai)
                    for o in nb['cells']:
                        if o['cell_type'] == 'code':
                            self.assertEqual(o['outputs'], [], 'notebook lưu sạch, không kèm đầu ra')
            bt = ''.join(''.join(o['source']) for o in doc_notebook(os.path.join(GOC, 'notebooks', ten + '.ipynb'))['cells'])
            self.assertIn('TODO', bt, f'{ten}: bản bài tập phải có chỗ TODO')
            self.assertNotIn('LOI GIAI', bt, f'{ten}: không lộ dấu lời giải')

    def test_loi_giai_chay_het_va_bai_tap_that_bai(self):
        for so, (ten, thu_vien) in enumerate(BAI, start=1):
            with self.subTest(bai=ten):
                thieu = thieu_thu_vien(thu_vien)
                if thieu:
                    self.skipTest(f'chưa cài {", ".join(thieu)}')
                kq = chay_notebook(os.path.join(GOC, 'solutions', ten + '_loi_giai.ipynb'))
                self.assertEqual(kq.returncode, 0, kq.stderr[-2000:])
                self.assertIn(f'Hoàn thành bài {so}', kq.stdout)
                kq = chay_notebook(os.path.join(GOC, 'notebooks', ten + '.ipynb'))
                self.assertNotEqual(kq.returncode, 0, f'{ten}: bản bài tập chưa làm mà vẫn qua kiểm tra')
                self.assertNotIn(f'Hoàn thành bài {so}', kq.stdout)


if __name__ == '__main__':
    unittest.main()
