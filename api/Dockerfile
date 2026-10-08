FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Executa como usuário sem privilégios
RUN useradd --system --uid 10001 appuser
USER appuser

EXPOSE 8080

# --proxy-headers + --forwarded-allow-ips: confia no X-Forwarded-* vindo do NGINX,
# assim request.client.host mostra o IP real e request.url.scheme vira "https".
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
