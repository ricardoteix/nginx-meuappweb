#!/bin/sh
# =============================================================================
# Gera uma CA local + certificado TLS (SAN) para os domínios do exemplo
# e o arquivo dhparam.pem. É idempotente: se os arquivos existem, não refaz.
#
# Uso:  sh scripts/gen-certs.sh [diretorio_destino]   (padrão: ./nginx/certs)
# =============================================================================
set -eu

OUT="${1:-./nginx/certs}"
DOMAIN="meuappweb.com.br"
DAYS_CA=3650
DAYS_CERT=397          # navegadores rejeitam certificados com validade > 398 dias

mkdir -p "$OUT"
cd "$OUT"

if ! command -v openssl >/dev/null 2>&1; then
  echo "[certgen] instalando openssl..."
  apk add --no-cache openssl >/dev/null
fi

# --- 1. Autoridade Certificadora local --------------------------------------
if [ ! -f ca.key ] || [ ! -f ca.crt ]; then
  echo "[certgen] criando CA local (ca.crt)..."
  openssl genrsa -out ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" \
    -subj "/C=BR/O=MeuApp Dev Local/CN=MeuApp Dev Local CA" \
    -out ca.crt
fi

# --- 2. Certificado do servidor com SAN para todos os subdomínios ----------
if [ ! -f "$DOMAIN.key" ] || [ ! -f "$DOMAIN.crt" ]; then
  echo "[certgen] criando certificado para $DOMAIN e subdomínios..."
  cat > server.ext <<EXT
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = api.$DOMAIN
DNS.4 = admin.$DOMAIN
EXT
  openssl ecparam -name prime256v1 -genkey -noout -out "$DOMAIN.key"
  openssl req -new -key "$DOMAIN.key" -subj "/C=BR/O=MeuApp Dev Local/CN=$DOMAIN" -out server.csr
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days "$DAYS_CERT" -sha256 -extfile server.ext -out "$DOMAIN.crt" 2>/dev/null
  # fullchain = folha + CA (o que o NGINX deve servir, conforme o checklist A+)
  cat "$DOMAIN.crt" ca.crt > fullchain.pem
  rm -f server.csr server.ext ca.srl
fi

# --- 3. Parâmetros Diffie-Hellman (2048 bits) -------------------------------
if [ ! -f dhparam.pem ]; then
  echo "[certgen] gerando dhparam.pem (2048 bits) — pode levar alguns segundos..."
  openssl dhparam -out dhparam.pem 2048 2>/dev/null
fi

chmod 644 ca.crt "$DOMAIN.crt" fullchain.pem dhparam.pem
chmod 640 ca.key "$DOMAIN.key" 2>/dev/null || true
echo "[certgen] ok — certificados em $OUT"
