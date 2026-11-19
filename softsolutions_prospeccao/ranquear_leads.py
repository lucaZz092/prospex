#!/usr/bin/env python3
"""Prioriza os leads do Google Maps para a Soft Solutions.
Uso: python3 ranquear_leads.py results.csv [-o leads_priorizados.csv]"""
import argparse, csv, re, unicodedata

# segmento -> (palavras que aparecem na categoria, ângulo de abordagem)
SEGMENTOS = {
    "Saúde": (["clinica", "médic", "medic", "odont", "dentist", "laborat", "estetic", "fisioter", "psicolog"],
              "Agenda, prontuário e retornos sem planilha: menos faltas e atendimento mais organizado."),
    "Contabilidade/Jurídico": (["contab", "contador", "advog", "juridic"],
              "Controle de clientes, prazos e documentos em um sistema só, com avisos automáticos."),
    "Logística/Distribuição": (["transport", "logist", "distribuid", "atacad", "armazem", "deposito"],
              "Pedidos, rotas e estoque integrados, sem planilha desatualizada."),
    "Indústria/Construção": (["industri", "fabric", "construt", "engenhar", "metalurg", "manutenc"],
              "Ordens de serviço, produção e custos acompanhados em tempo real."),
    "Imobiliário": (["imobili", "corretor"],
              "Funil de clientes, contratos e vencimentos num painel único."),
    "Serviços locais": (["oficina", "mecanic", "escola", "curso", "academia", "idioma"],
              "Cadastro, cobrança e agendamento automáticos no lugar da planilha."),
}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return s

def num(v):
    try: return float(str(v).replace(",", ".").strip())
    except ValueError: return 0.0

def whatsapp(phone):
    d = re.sub(r"\D", "", str(phone or ""))
    if d.startswith("55") and len(d) >= 12: d = d[2:]
    d = d.lstrip("0")
    if len(d) == 11 and d[2] == "9": return "https://wa.me/55" + d      # celular com DDD
    return ""

def segmento(cat):
    c = norm(cat)
    for nome, (chaves, angulo) in SEGMENTOS.items():
        if any(k in c for k in chaves): return nome, angulo
    return "Outros", "Substituir planilhas e controles manuais por um sistema sob medida."

def score(r):
    s = 0
    if segmento(r.get("category"))[0] != "Outros": s += 30
    if r.get("emails"): s += 20
    if r.get("phone"): s += 15
    if r.get("website"): s += 10
    rc = num(r.get("review_count"))
    s += 15 if rc >= 50 else 10 if rc >= 20 else 5 if rc >= 5 else 0
    if num(r.get("review_rating")) >= 4: s += 5
    if r.get("linkedin") or r.get("instagram"): s += 5
    return s

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada"); ap.add_argument("-o", "--saida", default="leads_priorizados.csv")
    a = ap.parse_args()
    with open(a.entrada, newline="", encoding="utf-8-sig") as f: rows = list(csv.DictReader(f))
    vistos, out = set(), []
    for r in rows:
        chave = (norm(r.get("title")), re.sub(r"\D", "", r.get("phone") or ""))
        if chave in vistos or not r.get("title"): continue
        vistos.add(chave)
        seg, ang = segmento(r.get("category")); sc = score(r)
        out.append({"prioridade": "A" if sc >= 70 else "B" if sc >= 50 else "C", "pontos": sc, "empresa": r.get("title"),
                    "segmento": seg, "categoria": r.get("category"), "telefone": r.get("phone"),
                    "whatsapp": whatsapp(r.get("phone")), "email": r.get("emails"), "site": r.get("website"),
                    "instagram": r.get("instagram"), "linkedin": r.get("linkedin"), "endereco": r.get("address"),
                    "avaliacao": r.get("review_rating"), "avaliacoes": r.get("review_count"), "abordagem": ang,
                    "status": "", "observacoes": ""})
    out.sort(key=lambda x: -x["pontos"])
    with open(a.saida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()) if out else ["empresa"]); w.writeheader(); w.writerows(out)
    n = lambda p: sum(1 for x in out if x["prioridade"] == p)
    print(f"{len(out)} leads únicos | A: {n('A')}  B: {n('B')}  C: {n('C')} | com WhatsApp: {sum(1 for x in out if x['whatsapp'])} | com e-mail: {sum(1 for x in out if x['email'])}")
    print("salvo em", a.saida)

if __name__ == "__main__":
    main()
