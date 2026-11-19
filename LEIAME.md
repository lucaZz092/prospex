# Prospecção Soft Solutions (Google Maps)

## Rodar no seu Mac (Terminal)
1. Deixe esta pasta no Mac e entre nela: `cd softsolutions_prospeccao`
2. Requisitos: Python 3.9+, git e Google Chrome instalados.
3. Execute: `bash rodar_prospeccao.sh "São Paulo, SP"`   (opcional: profundidade, ex. `... "Campinas, SP" 5`)
4. O resultado sai em `leads_<cidade>_priorizados.csv`. Abra no Excel ou Google Planilhas.

## O que o arquivo final traz
Prioridade A/B/C, pontos, empresa, segmento, telefone, link de WhatsApp (só celulares), e-mail, site,
Instagram, LinkedIn, avaliação e uma sugestão de abordagem por segmento. As colunas "status" e
"observacoes" são para você acompanhar o contato.

## Cuidados
- Raspar o Google Maps vai contra os Termos de Serviço do Google. Use volume moderado e trate o resultado como lista a validar.
- Uso intenso pode bloquear seu IP temporariamente. Se acontecer, espere ou reduza a profundidade.
- Telefones e e-mails são dados de contato de empresas, mas a LGPD vale: aborde com transparência, diga de onde veio o contato e respeite pedidos de "não receber mais".
- Evite mensagens em massa idênticas. Personalize o primeiro contato.

## Trabalhar os leads de São Paulo no Sellbird

A operação usa os dois CSVs de São Paulo. O importador vincula cada empresa
à origem no Google Maps, reutiliza os registros por domínio ou identificador
da origem e mantém os e-mails sem verificação até haver confirmação.
As empresas sem e-mail também aparecem no Sellbird. Linhas com status preenchido
ficam fora da seleção para novos contatos.

- [Primeira rodada](sellbird/data/exports/softsolutions-primeira-rodada.csv)
  com cinco empresas de prioridade A por segmento, contato, assunto,
  primeiro e-mail e retomada. Confira o destinatário e adapte o rascunho antes de usar.
- [Cadastro de empresas](sellbird/data/exports/softsolutions-empresas.csv)
  gerado pelo comando `sellbird companies`, com origem, contatos e status.

Para atualizar as exportações ou abrir o painel local, a partir desta pasta:

```bash
sellbird/.venv/bin/python integrar_sellbird.py
cd sellbird
.venv/bin/sellbird companies --out data/exports/softsolutions-empresas.csv
.venv/bin/sellbird dashboard
```

Os rascunhos da primeira rodada ficam no CSV. A instância está configurada
para a Soft Solutions em português, com envio desativado e aprovação manual
habilitada para quando um remetente for configurado.
