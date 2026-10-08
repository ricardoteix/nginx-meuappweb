#!/usr/bin/env bash
# =============================================================================
# Adiciona/remove os domínios do exemplo no /etc/hosts (Linux/macOS/WSL).
#   sudo ./scripts/hosts.sh add
#   sudo ./scripts/hosts.sh remove
# =============================================================================
set -euo pipefail

HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
BEGIN="# >>> meuappweb (exemplo NGINX) >>>"
END="# <<< meuappweb (exemplo NGINX) <<<"
ENTRIES="127.0.0.1   meuappweb.com.br
127.0.0.1   www.meuappweb.com.br
127.0.0.1   api.meuappweb.com.br
127.0.0.1   admin.meuappweb.com.br"

remove_block() {
  local tmp; tmp="$(mktemp)"
  sed "/^$BEGIN\$/,/^$END\$/d" "$HOSTS_FILE" > "$tmp"
  cat "$tmp" > "$HOSTS_FILE"
  rm -f "$tmp"
}

case "${1:-}" in
  add)
    remove_block
    printf '\n%s\n%s\n%s\n' "$BEGIN" "$ENTRIES" "$END" >> "$HOSTS_FILE"
    echo "Entradas adicionadas em $HOSTS_FILE:"; echo "$ENTRIES"
    ;;
  remove)
    remove_block
    echo "Entradas removidas de $HOSTS_FILE."
    ;;
  *)
    echo "uso: sudo $0 {add|remove}"; exit 1 ;;
esac
