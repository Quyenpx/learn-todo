# Chỉ đóng gói web và tài liệu cần cho liên kết thực hành.
FROM python:3.13-slim
WORKDIR /app
COPY index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY examples/ ./examples/
COPY docs/tutorials/ ./docs/tutorials/
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/index.html', timeout=2)"
CMD ["python", "-m", "http.server", "8080", "--bind", "0.0.0.0"]
