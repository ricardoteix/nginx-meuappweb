#!/usr/bin/env bash
# Dispara 8 logins seguidos: com rate=5r/m e burst=3, os primeiros passam
# (401 = senha errada) e os seguintes recebem 429 Too Many Requests do NGINX.
set -uo pipefail
CA="${CA:-nginx/certs/ca.crt}"
for i in $(seq 1 8); do
  code=$(curl -s --cacert "$CA" --resolve api.meuappweb.com.br:443:127.0.0.1 \
    -o /dev/null -w '%{http_code}' -X POST https://api.meuappweb.com.br/v1/auth/login \
    -H 'Content-Type: application/json' -d '{"username":"admin","password":"errada"}')
  echo "tentativa $i -> HTTP $code"
done
