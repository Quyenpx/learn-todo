"""Sinh notebook bài tập và lời giải cho khóa Python cho AI từ file nguồn .py.

Vì sao dùng file nguồn .py thay vì sửa notebook trực tiếp:
- File .py dễ đọc khi xem thay đổi trên git; notebook JSON khó so sánh.
- Một nguồn sinh ra cả hai bản nên bài tập và lời giải không bao giờ lệch nhau.

Quy ước trong src/<tên>.py:
- "# %% [markdown]" mở ô văn bản (mỗi dòng bắt đầu bằng "# ").
- "# %%" mở ô code.
- Đoạn giữa "# >>> LOI GIAI: gợi ý" và "# <<< LOI GIAI" là lời giải. Bản bài tập thay đoạn này
  bằng "# TODO: gợi ý" và "pass  # TODO" với cùng thụt lề.

Dùng:
    python examples/python/build_notebooks.py          # sinh lại notebook
    python examples/python/build_notebooks.py --check  # chỉ kiểm tra notebook có khớp nguồn không
Chỉ dùng thư viện chuẩn để chạy được ngay sau khi cài Python.
"""
import json
import os
import sys

GOC = os.path.dirname(os.path.abspath(__file__))
NGUON = os.path.join(GOC, 'src')
BAI_TAP = os.path.join(GOC, 'notebooks')
LOI_GIAI = os.path.join(GOC, 'solutions')
MO, DONG = '# >>> LOI GIAI', '# <<< LOI GIAI'


def tach_o(van_ban):
    """Tách file nguồn thành danh sách (loại ô, các dòng)."""
    cac_o, hien_tai = [], None
    for dong in van_ban.splitlines():
        if dong.startswith('# %% [markdown]'):
            hien_tai = ['markdown', []]
            cac_o.append(hien_tai)
        elif dong.startswith('# %%'):
            hien_tai = ['code', []]
            cac_o.append(hien_tai)
        elif hien_tai is not None:
            hien_tai[1].append(dong)
    return cac_o


def xu_ly_loi_giai(dong_ma, giu_loi_giai, ten):
    ket_qua, trong_loi_giai = [], False
    for dong in dong_ma:
        goc = dong.strip()
        if goc.startswith(MO):
            if trong_loi_giai:
                raise ValueError(f'{ten}: lồng dấu lời giải')
            trong_loi_giai = True
            if not giu_loi_giai:
                le = dong[: len(dong) - len(dong.lstrip())]
                goi_y = goc[len(MO):].lstrip(':').strip() or 'viết mã của bạn tại đây'
                ket_qua += [f'{le}# TODO: {goi_y}', f'{le}pass  # TODO']
            continue
        if goc.startswith(DONG):
            if not trong_loi_giai:
                raise ValueError(f'{ten}: dấu đóng lời giải thừa')
            trong_loi_giai = False
            continue
        if trong_loi_giai and not giu_loi_giai:
            continue
        ket_qua.append(dong)
    if trong_loi_giai:
        raise ValueError(f'{ten}: thiếu dấu đóng lời giải')
    return ket_qua


def gon(dong):
    # Bỏ dòng trống đầu/cuối ô để notebook gọn
    while dong and not dong[0].strip():
        dong = dong[1:]
    while dong and not dong[-1].strip():
        dong = dong[:-1]
    return dong


def nguon_o(dong):
    return [d + '\n' for d in dong[:-1]] + ([dong[-1]] if dong else [])


def tao_notebook(ten, van_ban, giu_loi_giai):
    o_ra = []
    loi_nhac = (
        f'> **Bản lời giải.** Hãy tự làm `notebooks/{ten}.ipynb` trước khi xem.'
        if giu_loi_giai else
        f'> **Notebook bài tập.** Thay mỗi `pass  # TODO` bằng mã của bạn rồi chạy lại ô kiểm tra. '
        f'Khi bí, xem `solutions/{ten}_loi_giai.ipynb`.'
    )
    for loai, dong in tach_o(van_ban):
        if loai == 'markdown':
            dong = [d[2:] if d.startswith('# ') else d.lstrip('#') for d in dong]
        else:
            dong = xu_ly_loi_giai(dong, giu_loi_giai, ten)
        dong = gon(dong)
        if not dong:
            continue
        o_ra.append([loai, dong])
    if not o_ra or o_ra[0][0] != 'markdown':
        raise ValueError(f'{ten}: ô đầu tiên phải là tiêu đề markdown')
    o_ra.insert(1, ['markdown', [loi_nhac]])
    cells = []
    for i, (loai, dong) in enumerate(o_ra):
        o = {'cell_type': loai, 'id': f'o{i:02d}', 'metadata': {}, 'source': nguon_o(dong)}
        if loai == 'code':
            o['execution_count'] = None
            o['outputs'] = []
        cells.append(o)
    nb = {
        'cells': cells,
        'metadata': {
            'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
            'language_info': {'name': 'python'},
        },
        'nbformat': 4,
        'nbformat_minor': 5,
    }
    return json.dumps(nb, ensure_ascii=False, indent=1) + '\n'


def danh_sach_dich():
    for tep in sorted(os.listdir(NGUON)):
        if not tep.endswith('.py'):
            continue
        ten = tep[:-3]
        with open(os.path.join(NGUON, tep), encoding='utf-8') as f:
            van_ban = f.read()
        yield os.path.join(BAI_TAP, ten + '.ipynb'), tao_notebook(ten, van_ban, False)
        yield os.path.join(LOI_GIAI, ten + '_loi_giai.ipynb'), tao_notebook(ten, van_ban, True)


def main(argv):
    chi_kiem_tra = '--check' in argv
    lech = []
    for duong_dan, noi_dung in danh_sach_dich():
        cu = None
        if os.path.exists(duong_dan):
            with open(duong_dan, encoding='utf-8', newline='') as f:
                # Git trên Windows có thể đổi LF thành CRLF khi checkout; nội dung vẫn giống nên không coi là lệch
                cu = f.read().replace('\r\n', '\n')
        if cu == noi_dung:
            continue
        if chi_kiem_tra:
            lech.append(os.path.relpath(duong_dan, GOC))
            continue
        os.makedirs(os.path.dirname(duong_dan), exist_ok=True)
        with open(duong_dan, 'w', encoding='utf-8', newline='\n') as f:
            f.write(noi_dung)
        print('Đã sinh', os.path.relpath(duong_dan, GOC))
    if lech:
        print('Notebook chưa khớp file nguồn, hãy chạy: python examples/python/build_notebooks.py')
        for p in lech:
            print(' -', p)
        return 1
    if chi_kiem_tra:
        print('Mọi notebook khớp file nguồn.')
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
