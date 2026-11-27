# Prospex — publicação do frontend na Vercel

## Arquitetura

O site de `prospex/` é **HTML/CSS/JavaScript estático**. O Supabase é o backend para login, PostgreSQL/RLS e Edge Functions (`criar-pedido`, `mp-webhook`). O script `prospex/worker/worker.py` faz coleta em execução contínua, chama um scraper externo e pode demorar horas: **não** deve ser publicado como função HTTP na Vercel. O diretório `softsolutions_prospeccao/sellbird` também não integra este site e não é necessário neste deploy.

## Passo 1: configurações na Vercel

1. Importe `lucaZz092/prospex`, **Root Directory: `./`** (raiz do repositório).
2. Escolha **Framework Preset: Other** (não importe como projeto multi-serviço).
3. Use o `vercel.json` versionado na raiz; ele executa `node prospex/build.mjs` e publica `prospex/dist`.
4. Em **Settings → Environment Variables**, configure em Production e Preview:
   - `SUPABASE_URL`: URL HTTPS do projeto Supabase.
   - `SUPABASE_ANON_KEY`: chave pública **anon** (legada) ou **publishable**; nunca `service_role` ou `sb_secret_`.
5. Faça deploy da branch e verifique as páginas `/`, `/login.html`, `/app.html` e `/workspace.html`.

O build cria `dist/config.js` com **somente** a URL e a chave pública. Qualquer chave exposta ao navegador deve ser tratada como pública; segurança é garantida por RLS e autenticação no Supabase, não pelo sigilo da anon key.

## Passo 2: Supabase

1. No projeto Supabase correto, aplique e revise as migrações em `prospex/supabase/migrations` na ordem.
2. Publique as funções `criar-pedido` e `mp-webhook` em `prospex/supabase/functions`, com os secrets de servidor necessários. **Não** coloque `SUPABASE_SERVICE_ROLE_KEY` nem `MP_ACCESS_TOKEN` na Vercel.
3. Em **Authentication → URL Configuration**, configure **Site URL** como a URL de produção e **Redirect URLs** com as URLs de retorno de produção/preview que serão realmente usadas. Ative Google OAuth se fizer parte do login.
4. Configure e teste o webhook do Mercado Pago apontando para a função Supabase. Antes de cobrar clientes reais, confirme assinatura/validação de eventos, status e idempotência.
5. Verifique as políticas RLS de `profiles`, `orders` e `leads` com contas de teste distintas.

Leia também `prospex/SUPABASE.md`.

## Passo 3: worker (hospedagem separada, obrigatória para entrega real)

`prospex/worker/worker.py` executa `while True` e chama o mecanismo em `softsolutions_prospeccao/google-maps-scraper-kit`. Precisa de hospedagem persistente compatível com Python e navegador, isolamento e monitoramento. Sugestão: container em VPS ou máquina/serviço gerenciado para trabalhos de longa duração. Não inicie workers duplicados sem revisar a recuperação de pedidos e travas.

Variáveis somente no ambiente privado do worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` (se usar devolução), `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` e opções de scraper. Não use `PROSPEX_DEMO_LEADS=1` em produção.

## Checklist de go-live

- [ ] Build e página inicial carregam na Vercel
- [ ] Autenticação, confirmação e recuperação de senha funcionam
- [ ] URLs de retorno do Supabase apontam para domínio correto
- [ ] Policies RLS testadas entre dois usuários
- [ ] Criar pedido e consultar pedido funcionam
- [ ] Cobranças e webhooks validados em ambiente de teste
- [ ] Worker real operacional e monitorado, com testes de recuperação de falha
- [ ] Links de privacidade/termos revisados e coleta de dados avaliada juridicamente
- [ ] Preços, prazos, estimativas e promessas comerciais conferidos antes de aceitar pagamentos

O deploy da Vercel **não** implanta automaticamente as Edge Functions, migrações ou worker.
