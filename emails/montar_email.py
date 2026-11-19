#!/usr/bin/env python3
"""Monta e-mails da SoftSolutions a partir do template + textos por nicho.

Uso:
  python3 montar_email.py --lead '{"empresa":"Clínica X","segmento":"Saúde","email":"a@b.com"}'
  python3 montar_email.py --csv ../leads_campinas_sp_priorizados.csv --out fila_campinas.jsonl [--prioridade A]
  python3 montar_email.py --previews   # gera previews/<nicho>.html para conferir o visual

Remetente: variáveis de ambiente SS_REMETENTE_NOME, SS_REMETENTE_CARGO, SS_REMETENTE_EMAIL,
SS_LINK_DESCADASTRO (pode conter {{email}}).
"""
import argparse, csv, html, json, os, re, sys, unicodedata, urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = open(os.path.join(AQUI, "template.html"), encoding="utf-8").read()
NICHOS = json.load(open(os.path.join(AQUI, "nichos.json"), encoding="utf-8"))
DESCADASTRO = os.path.join(AQUI, "descadastrados.txt")

def remetente():
    return {
        "remetente_nome": os.environ.get("SS_REMETENTE_NOME", "Lucas Mendonça Martins"),
        "remetente_cargo": os.environ.get("SS_REMETENTE_CARGO", "CEO"),
        "remetente_email": os.environ.get("SS_REMETENTE_EMAIL", "lucas.martins@softsolutions.com.br"),
        "link_descadastro": os.environ.get("SS_LINK_DESCADASTRO",
            "mailto:{{remetente_email}}?subject=SAIR&body=Remover%20{{email}}"),
    }

def fill(text, vars_, escape):
    def rep(m):
        v = str(vars_.get(m.group(1), ""))
        return html.escape(v) if escape and m.group(1) not in RAW else v
    for _ in range(3):  # resolve variáveis aninhadas ({{empresa}} dentro do assunto etc.)
        text = re.sub(r"\{\{(\w+)\}\}", rep, text)
    return text

RAW = {"cta_link", "link_descadastro", "whatsapp_texto"}

def montar(lead):
    seg = lead.get("segmento") or "Outros"
    nicho = NICHOS.get(seg, NICHOS["Outros"])
    empresa = (lead.get("empresa") or "").strip() or "sua empresa"
    v = {**NICHOS["_comum"], **nicho, **remetente(), "empresa": empresa,
         "email": lead.get("email", "")}
    v["whatsapp_texto"] = urllib.parse.quote(nicho["whatsapp_texto"])
    v["link_descadastro"] = fill(v["link_descadastro"], {**v, "email": urllib.parse.quote(v["email"])}, False)
    assunto = fill(nicho["assunto"], v, False)
    v["assunto"] = assunto
    corpo = fill(TEMPLATE, v, True)
    texto = (f"Olá, equipe da {empresa}!\n\n{v['abertura']}\n\n{v['dor']}\n\n"
             f"{v['titulo']} {v['subtitulo']}\n\n{v['cta_texto']}: {v['cta_link']}\n"
             f"WhatsApp: https://wa.me/5511978377155\n\n{v['remetente_nome']}\n{v['remetente_cargo']} · SoftSolutions\n"
             f"softsolutions.com.br\n\nPara não receber mais, responda SAIR.")
    return {"para": v["email"], "assunto": assunto, "html": corpo, "texto": texto, "segmento": seg}

def descadastrados():
    try: return {l.strip().lower() for l in open(DESCADASTRO, encoding="utf-8") if l.strip()}
    except FileNotFoundError: return set()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead"); ap.add_argument("--csv"); ap.add_argument("--out")
    ap.add_argument("--prioridade", help="ex.: A ou AB"); ap.add_argument("--previews", action="store_true")
    a = ap.parse_args()
    if a.previews:
        os.makedirs(os.path.join(AQUI, "previews"), exist_ok=True)
        for seg in NICHOS:
            if seg.startswith("_"): continue
            e = montar({"empresa": "Empresa Exemplo", "segmento": seg, "email": "exemplo@empresa.com.br"})
            nome = re.sub(r"[^a-z]+", "_", unicodedata.normalize("NFKD", seg.lower()).encode("ascii", "ignore").decode()).strip("_")
            open(os.path.join(AQUI, "previews", f"{nome}.html"), "w", encoding="utf-8").write(e["html"])
        print("previews gerados em", os.path.join(AQUI, "previews")); return
    if a.lead:
        print(json.dumps(montar(json.loads(a.lead)), ensure_ascii=False)); return
    if not a.csv: ap.error("use --lead, --csv ou --previews")
    bloq, vistos, n = descadastrados(), set(), 0
    out = open(a.out or "fila.jsonl", "w", encoding="utf-8")
    for r in csv.DictReader(open(a.csv, encoding="utf-8-sig")):
        if a.prioridade and r.get("prioridade") not in a.prioridade: continue
        email = (r.get("email") or "").split(",")[0].split(";")[0].strip().lower()
        if not email or email in bloq or email in vistos: continue
        vistos.add(email)
        out.write(json.dumps(montar({"empresa": r.get("empresa"), "segmento": r.get("segmento"), "email": email}),
                             ensure_ascii=False) + "\n"); n += 1
    print(f"{n} e-mails na fila → {a.out or 'fila.jsonl'}")

if __name__ == "__main__":
    main()
