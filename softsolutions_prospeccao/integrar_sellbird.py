#!/usr/bin/env python3
"""Importa os leads de São Paulo no Sellbird e prepara uma primeira rodada."""

import asyncio
import csv
import hashlib
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from ranquear_leads import norm
from sellbird.models.company import Company
from sellbird.models.prospect import COMPANY_INBOX_SOURCE, Prospect
from sellbird.register import _cell
from sellbird.state import StateManager


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "sellbird" / "data"
EMAIL = re.compile(r"[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}", re.I | re.ASCII)
QUESTIONS = {
    "Saúde": ("agendamento e retornos", "Como a equipe confirma consultas e acompanha os retornos hoje?"),
    "Contabilidade/Jurídico": ("prazos e documentos", "Como a equipe acompanha prazos e documentos pendentes hoje?"),
    "Logística/Distribuição": ("pedidos e estoque", "Como vocês acompanham pedidos e atualizam o estoque hoje?"),
    "Indústria/Construção": ("ordens de serviço e custos", "Como vocês acompanham o andamento dos serviços e seus custos hoje?"),
    "Imobiliário": ("contratos e vencimentos", "Como vocês acompanham contratos e vencimentos hoje?"),
    "Serviços locais": ("cadastro e cobrança", "Como vocês acompanham cadastros e cobranças hoje?"),
}


def read_csv(name):
    with (ROOT / name).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def key(name, phone):
    return norm(name), re.sub(r"\D", "", phone or "")


def website_and_domain(value):
    try:
        url = urlsplit(value)
        domain = (url.hostname or "").removeprefix("www.")
    except ValueError:
        return "", ""
    if url.scheme not in {"http", "https"} or "." not in domain or url.username:
        return "", ""
    shared = {"facebook.com", "instagram.com", "linkedin.com", "linktr.ee",
              "wa.me", "whatsapp.com", "google.com", "maps.app.goo.gl"}
    if any(domain == host or domain.endswith("." + host) for host in shared):
        return "", ""
    return value, domain


async def main():
    leads = read_csv("leads_sao_paulo_sp_priorizados.csv")
    sources = {}
    for row in read_csv("bruto_sao_paulo_sp.csv"):
        sources.setdefault(key(row["title"], row["phone"]), row)
    state = StateManager(str(DATA / "sellbird.db"))
    await state.init_db()
    companies, contacts = set(), set()
    files = DATA / "exports"
    files.mkdir(exist_ok=True)
    queue = []
    selected = Counter()
    seen_channels = set()
    shortlisted = set()

    for lead in leads:
        name, segment = lead["empresa"], lead["segmento"]
        identity = key(name, lead["telefone"])
        original = sources.get(identity, {})
        source = original.get("link", "")
        digest = hashlib.sha256("\0".join(identity).encode()).hexdigest()[:24]
        website, domain = website_and_domain(lead["site"])
        score = int(lead["pontos"])
        notes = [f"Google Maps | prioridade {lead['prioridade']} | {score} pontos",
                 lead["categoria"], lead["abordagem"], lead["observacoes"]]
        company_id = await state.add_company(Company(
            name=name, domain=domain, website=website, industry=segment,
            location=lead["endereco"] or "São Paulo, SP, Brasil",
            phone=lead["telefone"], source="Google Maps CSV", source_url=source,
            external_id="softsolutions:" + (original.get("place_id") or digest),
            notes="\n".join(filter(None, notes)),
        ))
        companies.add(company_id)

        emails = list(dict.fromkeys(
            item.strip().lower() for item in re.split(r"[,;\s]+", lead["email"])
            if EMAIL.fullmatch(item)
        ))
        if lead["status"].strip():
            continue
        for email in emails:
            contacts.add(await state.add_prospect(Prospect(
                company_id=company_id, company=name, industry=segment, email=email,
                title="General inbox", source=COMPANY_INBOX_SOURCE, source_url=source,
                score=score, personalization_notes=lead["abordagem"],
            )))

        if (lead["prioridade"] != "A" or segment not in QUESTIONS
                or selected[segment] >= 5 or company_id in shortlisted):
            continue
        email = next((item for item in emails if item not in seen_channels), "")
        whatsapp = lead["whatsapp"]
        if email:
            channel, address, check = "E-mail", email, "Validar a caixa e o destinatário"
        elif whatsapp and whatsapp not in seen_channels:
            channel, address, check = "WhatsApp", whatsapp, "Confirmar o número comercial"
        else:
            continue
        topic, question = QUESTIONS[segment]
        observations = {
            observation["signal_code"]: observation
            for observation in await state.get_observations(company_id, latest_only=True)
        }
        contact_form = observations.get("CONTACT_FORM_URL", {}).get("value_text", "")
        booking = observations.get("NO_ONLINE_BOOKING", {})
        queue.append({
            "Empresa": name, "Segmento": segment, "Pontos": score,
            "Canal": channel, "Contato": address, "Google Maps": source,
            "Formulário encontrado": contact_form,
            "Página para validar agendamento": (
                booking["evidence_url"] if booking.get("value_num") == 1 else ""
            ),
            "Próxima ação": check, "Assunto": f"Uma pergunta sobre {topic}" if email else "",
            "Primeiro contato": (
                f"Olá, equipe da {name}! Encontrei o contato de vocês no Google Maps. "
                f"Sou da Soft Solutions. Desenvolvemos sistemas sob medida para organizar {topic}. "
                f"{question} Se fizer sentido, posso sugerir uma forma de simplificar esse fluxo.\n\n"
                "Se preferirem não receber outros contatos, é só me avisar."
            ),
            "Retomada": (
                f"Olá! Retomo minha pergunta sobre {topic}. "
                "Se esse fluxo estiver na pauta de vocês, podemos conversar por 15 minutos? "
                "Se preferirem encerrar por aqui, é só me avisar."
            ),
        })
        selected[segment] += 1
        shortlisted.add(company_id)
        seen_channels.add(address)
        if whatsapp:
            seen_channels.add(whatsapp)
        seen_channels.update(emails)

    if queue:
        path = files / "softsolutions-primeira-rodada.csv"
        with path.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(queue[0]))
            writer.writeheader()
            writer.writerows({k: _cell(v) for k, v in row.items()} for row in queue)
    print(f"{len(leads)} linhas → {len(companies)} empresas e {len(contacts)} e-mails no Sellbird")
    print(f"{len(queue)} empresas com rascunho | {dict(Counter(r['Canal'] for r in queue))}")


if __name__ == "__main__":
    asyncio.run(main())
