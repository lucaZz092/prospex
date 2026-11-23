"""Worker da Prospex (Supabase).

Pega pedidos 'na_fila' (RPC proximo_pedido, com trava), roda o Google Maps Scraper Kit em
todas as cidades da região (lista do IBGE), ranqueia, grava os leads, aplica a garantia de
volume e avisa o cliente por e-mail.

  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 worker/worker.py

Variáveis opcionais:
  PROSPEX_DEMO_LEADS=1   gera leads de demonstração (só para testes locais; nunca em produção)
  PROSPEX_KIT            pasta do Google Maps Scraper Kit (padrão: ../softsolutions_prospeccao/google-maps-scraper-kit)
  PROSPEX_DEPTH          profundidade da busca nas cidades grandes (padrão 3)
  MP_ACCESS_TOKEN        token do Mercado Pago, para devoluções automáticas da garantia
  RESEND_API_KEY, EMAIL_FROM, SITE_URL   e-mail de "lista pronta"
"""
import csv, json, math, os, random, subprocess, sys, tempfile, time, traceback
from datetime import datetime, timezone
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ranker import ranquear, kit_abordagem  # noqa: E402

SB_URL = os.environ["SUPABASE_URL"].rstrip("/")
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "content-type": "application/json"}
http = httpx.Client(base_url=f"{SB_URL}/rest/v1", headers=H, timeout=30)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KIT = os.environ.get("PROSPEX_KIT") or os.path.join(REPO, "softsolutions_prospeccao", "google-maps-scraper-kit")
DEPTH = int(os.environ.get("PROSPEX_DEPTH", "3"))
DEMO = os.environ.get("PROSPEX_DEMO_LEADS") == "1"
MP = os.environ.get("MP_ACCESS_TOKEN", "")
RESEND = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "")
SITE = os.environ.get("SITE_URL", "").rstrip("/")

# Prazo de cada plano (o mesmo da landing) menos uma folga para ranquear e gravar.
PRAZO_S = {"cidade": 50 * 60, "estado": 5.5 * 3600, "pais": 46 * 3600}
GARANTIA = 0.7  # entrega abaixo de 70% da estimativa devolve a diferença

UF_COD = {"RO": 11, "AC": 12, "AM": 13, "RR": 14, "PA": 15, "AP": 16, "TO": 17, "MA": 21, "PI": 22, "CE": 23, "RN": 24,
          "PB": 25, "PE": 26, "AL": 27, "SE": 28, "BA": 29, "MG": 31, "ES": 32, "RJ": 33, "SP": 35, "PR": 41, "SC": 42,
          "RS": 43, "MS": 50, "MT": 51, "GO": 52, "DF": 53}


def _set(oid, **kw):
    http.patch("/orders", params={"id": f"eq.{oid}"}, json=kw).raise_for_status()


def _proximo():
    r = http.post("/rpc/proximo_pedido", json={}); r.raise_for_status()
    rs = r.json(); return rs[0] if rs else None


# ---------- cidades da região (IBGE) ----------
def municipios(uf):
    """[(\"Cidade, UF\", população)] do Censo 2022, maiores primeiro."""
    url = (f"https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93"
           f"?localidades=N6[N3[{UF_COD[uf]}]]")
    for tentativa in range(3):
        try:
            r = httpx.get(url, timeout=60); r.raise_for_status()
            series = r.json()[0]["resultados"][0]["series"]
            out = []
            for s in series:
                nome = s["localidade"]["nome"].rsplit(" - ", 1)[0]
                pop = int(next(iter(s["serie"].values())) or 0)
                out.append((f"{nome}, {uf}", pop))
            return sorted(out, key=lambda x: -x[1])
        except Exception:
            time.sleep(5 * (tentativa + 1))
    raise RuntimeError(f"Não foi possível obter a lista de cidades de {uf} no IBGE")


MIN_S, MAX_S = 15, 1800  # tempo mínimo garantido e máximo por cidade


def plano_de_busca(o):
    """[(cidade, peso, profundidade)], maiores primeiro. O peso divide o tempo do plano entre as cidades."""
    if o["escopo"] == "cidade":
        return [(o["regiao"], 1.0, DEPTH)]
    ufs = [o["regiao"]] if o["escopo"] == "estado" else list(UF_COD)
    cidades = sorted((c for uf in ufs for c in municipios(uf)), key=lambda x: -x[1])
    return [(cidade, math.sqrt(max(pop, 1)), DEPTH if pop >= 200_000 else 2 if pop >= 50_000 else 1)
            for cidade, pop in cidades]


def tempo_da_cidade(restante, pesos_restantes, peso):
    """Garante MIN_S a cada cidade que falta e reparte o resto pelo peso. Recalculado a cada cidade,
    então o tempo que uma cidade pequena não usa passa para as seguintes."""
    n = len(pesos_restantes)
    livre = max(0.0, restante - MIN_S * n)
    return int(min(MAX_S, MIN_S + livre * peso / sum(pesos_restantes)))


# ---------- busca ----------
def kit_ok() -> bool:
    if not os.path.isdir(KIT): return False
    r = subprocess.run([sys.executable, "scripts/engine.py", "status"], cwd=KIT, capture_output=True, text=True)
    return r.returncode == 0


def _raspar(o, tmp):
    socials = o["escopo"] != "cidade" or "socials" in (o["extras"] or [])
    plano = plano_de_busca(o)
    fim = time.time() + PRAZO_S[o["escopo"]]
    linhas = []
    pesos = [w for _, w, _ in plano]
    for i, (cidade, peso, prof) in enumerate(plano):
        restante = fim - time.time()
        if restante < 10:
            print(f"pedido {o['id']}: prazo atingido em {i}/{len(plano)} cidades", flush=True)
            break
        seg = int(min(tempo_da_cidade(restante, pesos[i:], peso), restante))
        out = os.path.join(tmp, f"c{i}.csv")
        cmd = [sys.executable, "scripts/scrape.py", f"{o['nicho']} em {cidade}", "--city", cidade, "--lang", "pt",
               "--country", "br", "--depth", str(prof), "--has-phone", "--max-time", str(seg), "--out", out]
        if not socials: cmd.append("--no-socials")
        try:
            subprocess.run(cmd, cwd=KIT, capture_output=True, text=True, timeout=seg + 60)
        except subprocess.TimeoutExpired:
            pass
        if os.path.exists(out):
            with open(out, encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    r["_cidade"] = cidade
                    linhas.append(r)
        if i % 5 == 0 or i == len(plano) - 1:
            _set(o["id"], progresso=min(90, 2 + int(88 * (i + 1) / len(plano))))
    if not linhas:
        raise RuntimeError("Nenhum resultado encontrado (o Google pode ter limitado o acesso; tente mais tarde)")
    return ranquear(linhas, o["nicho"])


def _demo(o):
    """Leads fictícios, só com PROSPEX_DEMO_LEADS=1. Marcados como demonstração em cada linha."""
    random.seed(o["id"])
    out = []
    for i in range(min(o["estimativa"] or 60, 60)):
        p = "A" if i < 25 else "B" if i < 45 else "C"
        tel = f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
        out.append({"prioridade": p, "pontos": 90 - i, "empresa": f"[DEMONSTRAÇÃO] Empresa {i + 1}",
                    "segmento": o["nicho"], "categoria": o["nicho"], "telefone": tel,
                    "whatsapp": "" if p == "C" else "https://wa.me/55" + "".join(c for c in tel if c.isdigit()),
                    "email": f"contato{i}@exemplo.com.br" if i % 3 else "", "site": "", "instagram": "", "linkedin": "",
                    "endereco": "Endereço de demonstração", "cidade": o["regiao"], "avaliacao": round(4.9 - i * .02, 1),
                    "n_avaliacoes": 300 - i * 4, "abordagem": "", "fonte": "Dados fictícios de demonstração"})
        time.sleep(.05)
    return out


# ---------- garantia e aviso ----------
def _email_do_cliente(uid):
    r = httpx.get(f"{SB_URL}/auth/v1/admin/users/{uid}", headers=H, timeout=30)
    return r.json().get("email") if r.status_code == 200 else None


def avisar(o, assunto, texto):
    if not (RESEND and EMAIL_FROM):
        print(f"pedido {o['id']}: e-mail não enviado (configure RESEND_API_KEY e EMAIL_FROM)", flush=True)
        return
    para = _email_do_cliente(o["user_id"])
    if not para: return
    try:
        httpx.post("https://api.resend.com/emails", timeout=30, headers={"Authorization": f"Bearer {RESEND}"},
                   json={"from": EMAIL_FROM, "to": [para], "subject": assunto, "text": texto}).raise_for_status()
    except httpx.HTTPError as e:
        print(f"pedido {o['id']}: falha ao enviar e-mail: {e}", file=sys.stderr)


def devolver(o, centavos, motivo):
    """Devolve parte do pagamento pelo Mercado Pago. Sem token ou sem pagamento real, registra para devolução manual."""
    if centavos <= 0: return 0
    pid = str(o.get("pagamento_id") or "")
    if MP and pid.isdigit():
        r = httpx.post(f"https://api.mercadopago.com/v1/payments/{pid}/refunds", timeout=30,
                       headers={"Authorization": f"Bearer {MP}", "content-type": "application/json",
                                "X-Idempotency-Key": f"refund-{o['id']}-{centavos}"},
                       json={"amount": round(centavos / 100, 2)})
        if r.status_code in (200, 201):
            _set(o["id"], reembolso_centavos=centavos, reembolso_status="devolvido", reembolso_motivo=motivo)
            return centavos
        print(f"pedido {o['id']}: devolução recusada pelo Mercado Pago: {r.text[:300]}", file=sys.stderr)
    _set(o["id"], reembolso_centavos=centavos, reembolso_status="pendente", reembolso_motivo=motivo)
    return 0


def brl(c): return f"R$ {c / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ---------- pedido ----------
CAMPOS = ["prioridade", "pontos", "empresa", "segmento", "categoria", "telefone", "whatsapp", "email", "site", "instagram",
          "linkedin", "endereco", "cidade", "avaliacao", "n_avaliacoes", "abordagem", "fonte"]


def processar(o):
    oid = o["id"]
    try:
        if DEMO:
            for p in (20, 45, 70): time.sleep(1.5); _set(oid, progresso=p)
            leads = _demo(o)
        else:
            with tempfile.TemporaryDirectory() as tmp:
                leads = _raspar(o, tmp)
        http.delete("/leads", params={"order_id": f"eq.{oid}"}).raise_for_status()
        linhas = [{**{k: (l.get(k) if l.get(k) not in ("", None) else None) for k in CAMPOS}, "order_id": oid, "user_id": o["user_id"]}
                  for l in leads]
        for i in range(0, len(linhas), 500):
            http.post("/leads", json=linhas[i:i + 500], headers={"Prefer": "return=minimal"}).raise_for_status()
        _set(oid, status="pronta", progresso=100, kit=kit_abordagem(o["nicho"]),
             concluido_em=datetime.now(timezone.utc).isoformat())
        print(f"pedido {oid}: {len(linhas)} leads", flush=True)

        texto = (f"Sua lista de {o['nicho']} em {o['regiao']} está pronta: {len(linhas)} empresas, "
                 f"com prioridade A/B/C e o roteiro de abordagem do nicho.\n\n"
                 f"Abra em {SITE}/workspace.html#prospeccoes\n")
        est = o.get("estimativa") or 0
        if est and len(linhas) < GARANTIA * est:
            dif = round(o["valor_centavos"] * (1 - len(linhas) / est))
            if devolver(o, dif, f"Entrega de {len(linhas)} leads para estimativa de {est}"):
                texto += f"\nA entrega ficou mais de 30% abaixo da estimativa. Devolvemos {brl(dif)} no seu meio de pagamento.\n"
            else:
                texto += f"\nA entrega ficou mais de 30% abaixo da estimativa. A devolução de {brl(dif)} será feita em até 7 dias.\n"
        avisar(o, "Sua lista da Prospex está pronta", texto)
    except Exception as e:
        traceback.print_exc()
        _set(oid, status="erro", erro=str(e)[:300])
        dev = devolver(o, o["valor_centavos"], f"Falha na busca: {str(e)[:200]}")
        avisar(o, "Não conseguimos concluir sua lista na Prospex",
               f"A busca de {o['nicho']} em {o['regiao']} falhou: {str(e)[:200]}.\n\n"
               + (f"Devolvemos {brl(dev)} no seu meio de pagamento.\n" if dev else
                  "Vamos devolver o valor pago em até 7 dias.\n"))


def main():
    if not DEMO and not kit_ok():
        sys.exit(f"Motor de busca indisponível em {KIT}. Instale o kit (ou defina PROSPEX_KIT). "
                 "Para testar sem busca real, use PROSPEX_DEMO_LEADS=1.")
    # pedidos interrompidos por um worker que caiu voltam para a fila
    http.patch("/orders", params={"status": "eq.buscando"}, json={"status": "na_fila"})
    print("worker da Prospex rodando", "(DEMONSTRAÇÃO: leads fictícios)" if DEMO else f"(kit em {KIT})", flush=True)
    while True:
        try:
            o = _proximo()
            if o: processar(o)
            else: time.sleep(5)
        except httpx.HTTPError as e:
            print("erro de rede:", e, file=sys.stderr); time.sleep(10)


if __name__ == "__main__":
    main()
