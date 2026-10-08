#!/usr/bin/env bash
# =============================================================================
# Testes rápidos de fumaça. Usa --resolve, então funciona MESMO SEM editar o
# arquivo hosts (útil em CI). Rode após: docker compose up -d
# =============================================================================
set -uo pipefail

CA="${CA:-nginx/certs/ca.crt}"
D="meuappweb.com.br"
RESOLVE=(--resolve "$D:443:127.0.0.1" --resolve "www.$D:443:127.0.0.1"
         --resolve "api.$D:443:127.0.0.1" --resolve "admin.$D:443:127.0.0.1"
         --resolve "$D:80:127.0.0.1")
PASS=0; FAIL=0

check() {  # check "descrição" "esperado" comando...
  local desc="$1" expected="$2"; shift 2
  local got; got="$("$@" 2>/dev/null)"
  if [[ "$got" == *"$expected"* ]]; then echo "  ok   $desc"; PASS=$((PASS+1))
  else echo "  FAIL $desc (esperado: '$expected', obtido: '${got:0:120}')"; FAIL=$((FAIL+1)); fi
}
c() { curl -s --cacert "$CA" "${RESOLVE[@]}" "$@"; }

echo "== Roteamento por domínio"
check "web responde 200"            "200" c -o /dev/null -w '%{http_code}' "https://$D/"
check "SPA: rota interna -> 200"    "200" c -o /dev/null -w '%{http_code}' "https://$D/eventos/1"
check "api /health"                 '"status":"ok"' c "https://api.$D/health"
check "admin responde 200"          "200" c -o /dev/null -w '%{http_code}' "https://admin.$D/"
check "web /api (same-origin)"      '"items"' c "https://$D/api/v1/events"
check "admin /api (same-origin)"    '"items"' c "https://admin.$D/api/v1/events"

echo "== Redirecionamentos"
check "HTTP -> HTTPS (301)"         "301" c -o /dev/null -w '%{http_code}' "http://$D/"
check "www -> apex (301)"           "https://$D/" c -o /dev/null -w '%{redirect_url}' "https://www.$D/"

echo "== Proxy preserva o contexto do cliente"
check "backend vê scheme https"     '"scheme":"https"' c "https://$D/api/v1/debug/request"
check "backend vê o Host público"   "\"host\":\"$D\"" c "https://$D/api/v1/debug/request"

echo "== Headers de segurança e hardening"
H="$(c -I "https://$D/" | tr 'A-Z' 'a-z' | tr -d '\r')"
has() { if grep -q -- "$2" <<<"$H"; then echo "  ok   $1"; PASS=$((PASS+1)); else echo "  FAIL $1"; FAIL=$((FAIL+1)); fi; }
has "HSTS"                       "^strict-transport-security:"
has "X-Frame-Options DENY"       "^x-frame-options: deny"
has "X-Content-Type-Options"     "^x-content-type-options: nosniff"
has "Content-Security-Policy"    "^content-security-policy:"
has "server_tokens off (sem versão)" "^server: nginx$"
check "HTTP/2 ativo"                "2" c -o /dev/null -w '%{http_version}' "https://$D/"

echo "== TLS"
check "TLS 1.3 aceito"   "200" c --tlsv1.3 -o /dev/null -w '%{http_code}' "https://$D/"
check "TLS 1.1 recusado" "000" c --tlsv1.1 --tls-max 1.1 -o /dev/null -w '%{http_code}' "https://$D/"

echo "== Cache de assets"
check "assets imutáveis"  "immutable" bash -c "curl -sI --cacert '$CA' --resolve '$D:443:127.0.0.1' https://$D/assets/app-1.0.0.js"

echo
echo "Resultado: $PASS ok, $FAIL falha(s)"
[[ $FAIL -eq 0 ]]
