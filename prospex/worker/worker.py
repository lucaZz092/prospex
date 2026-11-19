"""Worker da Prospex (Supabase).

Pega pedidos 'na_fila' (via RPC proximo_pedido, com trava), roda o Google Maps Scraper Kit,
ranqueia e grava os leads no Supabase com a service role. Roda na máquina que tem Chrome.

  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 worker/worker.py
  PROSPEX_DEMO_LEADS=1 → gera leads de demonstração em vez de raspar.
"""
import csv, json, os, random, subprocess, sys, tempfile, time, traceback
from datetime import datetime, timezone
import httpx

SB_URL = os.environ["SUPABASE_URL"].rstrip("/")
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "content-type": "application/json"}
http = httpx.Client(base_url=f"{SB_URL}/rest/v1", headers=H, timeout=30)

def _set(oid, **kw):
    http.patch("/orders", params={"id": f"eq.{oid}"}, json=kw).raise_for_status()

def _proximo():
    r = http.post("/rpc/proximo_pedido", json={}); r.raise_for_status()
    rs = r.json(); return rs[0] if rs else None

KIT = os.environ.get("PROSPEX_KIT", os.path.expanduser("~/Desktop/softsolutions_prospeccao/google-maps-scraper-kit"))
RANKER = os.environ.get("PROSPEX_RANKER", os.path.expanduser("~/Desktop/softsolutions_prospeccao/ranquear_leads.py"))
DEPTH = int(os.environ.get("PROSPEX_DEPTH", "3"))
FORCE_DEMO = os.environ.get("PROSPEX_DEMO_LEADS") == "1"

# Cidades por estado (as maiores). Expanda conforme necessário.
CIDADES_UF = {
    "SP": ["São Paulo", "Campinas", "Guarulhos", "Santo André", "São José dos Campos", "Ribeirão Preto", "Sorocaba", "Santos", "Osasco", "São Bernardo do Campo"],
    "RJ": ["Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Campos dos Goytacazes", "Petrópolis", "Volta Redonda"],
    "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Uberaba", "Ipatinga"],
    "PR": ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais", "Foz do Iguaçu"],
    "RS": ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Santa Maria", "Gravataí", "Novo Hamburgo"],
    "SC": ["Florianópolis", "Joinville", "Blumenau", "São José", "Itajaí", "Chapecó", "Criciúma"],
    "BA": ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Itabuna", "Juazeiro"],
}
CAPITAIS = {"AC": "Rio Branco", "AL": "Maceió", "AP": "Macapá", "AM": "Manaus", "BA": "Salvador", "CE": "Fortaleza", "DF": "Brasília",
    "ES": "Vitória", "GO": "Goiânia", "MA": "São Luís", "MT": "Cuiabá", "MS": "Campo Grande", "MG": "Belo Horizonte", "PA": "Belém",
    "PB": "João Pessoa", "PR": "Curitiba", "PE": "Recife", "PI": "Teresina", "RJ": "Rio de Janeiro", "RN": "Natal", "RS": "Porto Alegre",
    "RO": "Porto Velho", "RR": "Boa Vista", "SC": "Florianópolis", "SP": "São Paulo", "SE": "Aracaju", "TO": "Palmas"}

def cidades_do_pedido(o: dict) -> list[str]:
    if o["escopo"] == "cidade": return [o["regiao"]]
    if o["escopo"] == "estado":
        uf = o["regiao"]; return [f"{c}, {uf}" for c in CIDADES_UF.get(uf, [CAPITAIS[uf]])]
    return [f"{c}, {uf}" for uf, c in CAPITAIS.items()]

def kit_ok() -> bool:
    if FORCE_DEMO or not os.path.isdir(KIT): return False
    r = subprocess.run(["python3", "scripts/engine.py", "status"], cwd=KIT, capture_output=True, text=True)
    return r.returncode == 0


def _raspar(o, cidades, tmp) -> str:
    extras = o["extras"] or []
    saidas = []
    for i, cidade in enumerate(cidades):
        out = os.path.join(tmp, f"c{i}.csv")
        cmd = ["python3", "scripts/scrape.py", f"{o['nicho']} em {cidade}", "--city", cidade, "--lang", "pt", "--country", "br",
               "--depth", str(DEPTH), "--has-phone", "--max-time", "1800", "--out", out]
        if "emails" not in extras: cmd.append("--no-deep-emails")
        if "socials" not in extras: cmd.append("--no-socials")
        subprocess.run(cmd, cwd=KIT, capture_output=True, text=True, timeout=3600)
        if os.path.exists(out): saidas.append(out)
        _set(o["id"], progresso=int(90 * (i + 1) / len(cidades)))
    # junta tudo num CSV bruto
    bruto = os.path.join(tmp, "bruto.csv"); linhas, campos = [], []
    for s in saidas:
        with open(s, encoding="utf-8") as f:
            rd = csv.DictReader(f); campos = campos or rd.fieldnames; linhas += list(rd)
    if not linhas: raise RuntimeError("Nenhum resultado (o Google pode ter limitado o IP; tente mais tarde)")
    todos = list(dict.fromkeys(k for l in linhas for k in l))
    with open(bruto, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=todos); w.writeheader(); w.writerows(linhas)
    final = os.path.join(tmp, "final.csv")
    subprocess.run(["python3", RANKER, bruto, "-o", final], check=True, capture_output=True)
    with open(final, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def _demo(o) -> list[dict]:
    random.seed(o["id"])
    nomes = ["Vida Plena", "Horizonte", "Prime", "Central", "Nova Era", "Bem Estar", "Excelência", "Avenida", "Ponto Certo", "Master", "Ideal", "Premium", "Aliança", "Sol Nascente", "Integra", "Atlântico", "Vértice", "Pioneira"]
    out = []
    for i in range(min(o["estimativa"] or 60, 60)):
        p = "A" if i < 25 else "B" if i < 45 else "C"
        tel = f"(11) 9{random.randint(1000,9999)}-{random.randint(1000,9999)}"
        out.append({"prioridade": p, "pontos": 90 - i, "empresa": f"{o['nicho'].split()[0]} {nomes[i % len(nomes)]} {i // len(nomes) or ''}".strip(),
                    "segmento": o["nicho"], "categoria": o["nicho"], "telefone": tel, "whatsapp": "" if p == "C" else "https://wa.me/55" + "".join(c for c in tel if c.isdigit()),
                    "email": f"contato{i}@exemplo.com.br" if i % 3 else "", "site": "", "instagram": "", "linkedin": "",
                    "endereco": f"Rua Exemplo, {100 + i} — {o['regiao']}", "avaliacao": round(4.9 - i * .02, 1), "n_avaliacoes": 300 - i * 4, "abordagem": ""})
        time.sleep(.05)
    return out


CAMPOS = ["prioridade", "pontos", "empresa", "segmento", "categoria", "telefone", "whatsapp", "email", "site", "instagram",
          "linkedin", "endereco", "avaliacao", "n_avaliacoes", "abordagem"]

def _num(v, f=float):
    try: return f(float(str(v).replace(",", ".")))
    except (TypeError, ValueError): return None

def processar(o: dict):
    oid = o["id"]
    try:
        if kit_ok():
            with tempfile.TemporaryDirectory() as tmp:
                leads = _raspar(o, cidades_do_pedido(o), tmp)
        else:
            for p in (20, 45, 70): time.sleep(1.5); _set(oid, progresso=p)
            leads = _demo(o)
        http.delete("/leads", params={"order_id": f"eq.{oid}"}).raise_for_status()
        linhas = []
        for l in leads:
            r = {k: (l.get(k) or None) for k in CAMPOS}
            r.update(order_id=oid, user_id=o["user_id"], pontos=_num(l.get("pontos"), int),
                     avaliacao=_num(l.get("avaliacao")), n_avaliacoes=_num(l.get("n_avaliacoes"), int))
            linhas.append(r)
        for i in range(0, len(linhas), 500):
            http.post("/leads", json=linhas[i:i + 500], headers={"Prefer": "return=minimal"}).raise_for_status()
        _set(oid, status="pronta", progresso=100, concluido_em=datetime.now(timezone.utc).isoformat())
        print(f"pedido {oid}: {len(linhas)} leads", flush=True)
    except Exception as e:
        traceback.print_exc()
        _set(oid, status="erro", erro=str(e)[:300])

def main():
    # pedidos interrompidos por um worker que caiu voltam para a fila
    http.patch("/orders", params={"status": "eq.buscando"}, json={"status": "na_fila"})
    print("worker da Prospex rodando", "(demo)" if not kit_ok() else "(kit real)", flush=True)
    while True:
        try:
            o = _proximo()
            if o: processar(o)
            else: time.sleep(5)
        except httpx.HTTPError as e:
            print("erro de rede:", e, file=sys.stderr); time.sleep(10)

if __name__ == "__main__":
    main()
