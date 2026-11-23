#!/usr/bin/env bash
# Prospex local: site estático + worker de buscas conectado ao Supabase.
#   bash rodar.sh          → worker gera leads de demonstração
#   bash rodar.sh --real   → worker faz a busca real no Google Maps (precisa do kit e do Chrome)
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Crie o .env a partir de .env.example"; exit 1; }
set -a; . ./.env; set +a
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r worker/requirements.txt
[ "${1:-}" = "--real" ] || { export PROSPEX_DEMO_LEADS=1; echo "Modo demonstração: leads fictícios (use --real para a busca de verdade)"; }
python3 -m http.server "${PORT:-8000}" --bind 127.0.0.1 >/dev/null 2>&1 &
SITE=$!; trap 'kill $SITE' EXIT
echo "Site: http://localhost:${PORT:-8000}"
.venv/bin/python worker/worker.py
