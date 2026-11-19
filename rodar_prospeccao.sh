#!/usr/bin/env bash
# Prospecção Soft Solutions via Google Maps Scraper Kit.
# Uso:  bash rodar_prospeccao.sh "São Paulo, SP" [profundidade]
set -euo pipefail
CIDADE="${1:?Informe a cidade, ex.: bash rodar_prospeccao.sh \"Campinas, SP\"}"
DEPTH="${2:-3}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
KIT="$AQUI/google-maps-scraper-kit"
SLUG="$(python3 -c 'import re,sys,unicodedata; s=unicodedata.normalize("NFKD",sys.argv[1]).encode("ascii","ignore").decode(); print(re.sub(r"[^a-z0-9]+","_",s.lower()).strip("_"))' "$CIDADE")"

[ -d "$KIT" ] || git clone --depth 1 https://github.com/Mahanaicoach/google-maps-scraper-kit.git "$KIT"
cd "$KIT"
sed "s/{CIDADE}/$CIDADE/g" "$AQUI/keywords_softsolutions.txt" > "$AQUI/keywords_${SLUG}.txt"

python3 scripts/engine.py status || python3 scripts/engine.py start
python3 scripts/engine.py status

echo "Aviso: uso intenso pode gerar bloqueio temporário do seu IP pelo Google. Se ocorrer, espere ou reduza a profundidade."
python3 scripts/scrape.py --keywords-file "$AQUI/keywords_${SLUG}.txt" --city "$CIDADE" \
  --lang pt --country br --depth "$DEPTH" --has-phone --max-time 1800 --out "$AQUI/bruto_${SLUG}.csv"

python3 "$AQUI/ranquear_leads.py" "$AQUI/bruto_${SLUG}.csv" -o "$AQUI/leads_${SLUG}_priorizados.csv"
echo "Pronto: $AQUI/leads_${SLUG}_priorizados.csv"
