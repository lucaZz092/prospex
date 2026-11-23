"""Ranqueador da Prospex: prioriza leads crus do Google Maps para qualquer cliente.

A nota mede a chance de conseguir uma conversa, não o encaixe com um produto
específico: contato direto disponível, empresa ativa (avaliações) e presença digital.
"""
import re, unicodedata


def _num(v):
    try:
        return float(str(v).replace(",", ".").strip())
    except (TypeError, ValueError):
        return 0.0


def _norm(s):
    return unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower().strip()


def whatsapp(phone):
    """Link wa.me só para celular brasileiro (11 dígitos com DDD, começando em 9)."""
    d = re.sub(r"\D", "", str(phone or ""))
    if d.startswith("55") and len(d) >= 12:
        d = d[2:]
    d = d.lstrip("0")
    return "https://wa.me/55" + d if len(d) == 11 and d[2] == "9" else ""


def pontos(r, wa):
    s = 0
    if wa: s += 30
    elif r.get("phone"): s += 15
    if r.get("emails"): s += 20
    if r.get("website"): s += 10
    if r.get("instagram") or r.get("linkedin"): s += 10
    rc = _num(r.get("review_count"))
    s += 20 if rc >= 50 else 14 if rc >= 20 else 8 if rc >= 5 else 0
    if _num(r.get("review_rating")) >= 4: s += 10
    return s


def roteiro(nicho, empresa):
    n = (nicho or "empresas").strip().lower()
    return (f"Olá, falo com a {empresa}? Vi o perfil de vocês no Google e trabalho com {n} da região. "
            f"Queria entender como vocês lidam hoje com [o problema que você resolve] e, se fizer sentido, "
            f"mostrar em 10 minutos como ajudamos outras {n}. Qual o melhor horário para conversarmos?")


def kit_abordagem(nicho):
    """Roteiro de primeiro contato e modelo de e-mail do nicho, entregue junto com a lista."""
    n = (nicho or "empresas").strip().lower()
    return {
        "ligacao": [
            "Apresente-se e diga de onde veio o contato: \"Encontrei vocês no Google Maps\".",
            f"Pergunte como a empresa resolve hoje [o problema que você resolve] em {n}.",
            "Escute e anote. Não apresente o produto antes de entender a resposta.",
            "Proponha um próximo passo curto: uma conversa de 10 a 15 minutos com data marcada.",
            "Se a pessoa não quiser contato, agradeça e marque o lead como \"perdido\".",
        ],
        "email_assunto": f"Uma ideia para {n} da sua região",
        "email": (f"Olá, [nome],\n\nEncontrei a [empresa] no Google Maps e vi que vocês atendem bem a região "
                  f"(as avaliações mostram isso). Trabalho com {n} e ajudamos a [resultado que você entrega].\n\n"
                  "Faz sentido uma conversa de 15 minutos esta semana?\n\n"
                  "[sua assinatura]\n\nSe não quiser receber mensagens minhas, é só responder \"não\" que eu não "
                  "entro mais em contato."),
    }


def ranquear(linhas, nicho):
    """linhas: dicts do kit (title, phone, emails, website, category, address, review_rating,
    review_count, instagram, linkedin, _cidade). Devolve leads deduplicados e ordenados."""
    vistos, out = set(), []
    for r in linhas:
        empresa = (r.get("title") or "").strip()
        if not empresa:
            continue
        chave = (_norm(empresa), re.sub(r"\D", "", r.get("phone") or "") or _norm(r.get("address")))
        if chave in vistos:
            continue
        vistos.add(chave)
        wa = whatsapp(r.get("phone"))
        p = pontos(r, wa)
        email = (r.get("emails") or "").split(";")[0].split(",")[0].strip()
        fontes = ["Google Maps (nome, telefone, endereço, avaliações)"]
        if email and r.get("website"):
            fontes.append(f"e-mail publicado em {r['website']}")
        if r.get("instagram") or r.get("linkedin"):
            fontes.append("redes sociais públicas da empresa")
        out.append({
            "prioridade": "A" if p >= 80 else "B" if p >= 55 else "C",
            "pontos": p, "empresa": empresa, "segmento": nicho, "categoria": r.get("category") or "",
            "telefone": r.get("phone") or "", "whatsapp": wa, "email": email, "site": r.get("website") or "",
            "instagram": r.get("instagram") or "", "linkedin": r.get("linkedin") or "",
            "endereco": r.get("address") or "", "cidade": r.get("_cidade") or "",
            "avaliacao": _num(r.get("review_rating")) or None, "n_avaliacoes": int(_num(r.get("review_count"))) or None,
            "abordagem": roteiro(nicho, empresa), "fonte": "; ".join(fontes),
        })
    out.sort(key=lambda x: -x["pontos"])
    return out
