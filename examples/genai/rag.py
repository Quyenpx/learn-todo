"""Truy xuất từ khóa và trích nguyên văn có nguồn; không chạy mô hình sinh."""
import argparse
import json
from pathlib import Path
import re
import sys
import unicodedata

STOP_WORDS = set("la va cua co cho toi ban trong bao lau nao gi khi neu thi duoc mot cac voi the khong ve".split())


def tokens(text):
    normalized = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    return set(re.findall(r"[a-z0-9]+", normalized)) - STOP_WORDS


def validate_documents(documents):
    if not isinstance(documents, list) or not documents:
        raise ValueError("Tài liệu phải là danh sách không rỗng.")
    for doc in documents:
        if not isinstance(doc, dict) or any(not isinstance(doc.get(key), str) or not doc[key].strip() for key in ("title", "source", "text")):
            raise ValueError("Mỗi tài liệu cần title, source và text không rỗng.")
    return documents


def load_documents(path):
    with Path(path).open(encoding="utf-8") as handle:
        return validate_documents(json.load(handle))


def retrieve(question, documents, top_k=2, min_overlap=2, min_coverage=0.5):
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Câu hỏi phải là chuỗi không rỗng.")
    if type(top_k) is not int or top_k < 1 or type(min_overlap) is not int or min_overlap < 1:
        raise ValueError("top_k và min_overlap phải là số nguyên dương.")
    if not isinstance(min_coverage, (int, float)) or not 0 < min_coverage <= 1:
        raise ValueError("min_coverage phải lớn hơn 0 và không vượt 1.")
    validate_documents(documents)
    query = tokens(question)
    matches = []
    for doc in documents:
        overlap = len(query & tokens(doc["text"]))
        coverage = overlap / len(query) if query else 0.0
        if overlap >= min_overlap and coverage >= min_coverage:
            matches.append({**doc, "overlap": overlap, "coverage": coverage})
    return sorted(matches, key=lambda item: (-item["coverage"], -item["overlap"], item["source"]))[:top_k]


def answer(question, documents, **options):
    matches = retrieve(question, documents, **options)
    return {"answered": bool(matches),
            "answer": "\n".join("[{}] {}".format(i + 1, doc["text"]) for i, doc in enumerate(matches)) if matches else "Không có đủ chứng cứ trong tài liệu để trả lời.",
            "sources": [{"id": i + 1, "title": doc["title"], "source": doc["source"], "coverage": doc["coverage"]} for i, doc in enumerate(matches)],
            "note": "Chỉ khớp từ khóa và trích nguyên văn. Điểm khớp không xác nhận tính đúng của câu trả lời."}


def main():
    # Cả thông báo lỗi và kết quả dùng UTF-8 khi chuyển hướng trên Windows.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--question", required=True, help="Câu hỏi tiếng Việt")
    parser.add_argument("--documents", type=Path, default=Path(__file__).with_name("policies.json"))
    parser.add_argument("--top-k", type=int, default=2)
    args = parser.parse_args()
    try:
        result = answer(args.question, load_documents(args.documents), top_k=args.top_k)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
