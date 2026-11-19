# Prospex no Supabase: configuração

## 1. Banco de dados
Supabase → **SQL Editor** → cole e rode `supabase/migrations/001_schema.sql`.
Isso cria as tabelas `profiles`, `orders` e `leads`, a view `orders_stats`, as regras de acesso (RLS), o Realtime e a função de fila `proximo_pedido`.

## 2. Login
**Authentication → URL Configuration**
- Site URL: `http://localhost:8000` (depois troque pelo domínio real).
- Redirect URLs: `http://localhost:8000/**`.

**Google (opcional):** Authentication → Providers → Google. Informe o Client ID e o Secret do Google Cloud.

## 3. Edge Functions
Com a CLI (`brew install supabase/tap/supabase`):
```bash
supabase login
supabase link --project-ref SEU_REF
supabase functions deploy criar-pedido
supabase functions deploy mp-webhook --no-verify-jwt
supabase secrets set SITE_URL=http://localhost:8000          # domínio real em produção
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...             # sem isso: modo demo (pagamento aprovado na hora)
```
Sem a CLI, crie as duas funções em **Edge Functions → Deploy a new function**. Cole o código e junte o conteúdo de `_shared/pricing.ts` no mesmo arquivo. Na `mp-webhook`, desligue a opção "Verify JWT".

## 4. Front-end
Em `config.js`, coloque a **Project URL** e a **anon key** (Project Settings → API).

## 5. Worker
Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A service role key fica **só** nesse arquivo: nunca no front-end, nunca no git.
```bash
bash rodar.sh          # site em localhost:8000 + worker com leads de demonstração
bash rodar.sh --real   # busca real no Google Maps (motor do kit rodando)
```

## Segurança
- O usuário só lê os próprios pedidos e leads. Ele só pode alterar a etapa e as notas dos leads e o nome e as preferências do perfil.
- Pedidos são criados apenas pela Edge Function, que calcula o preço. Só o worker e o webhook mudam o status de um pedido.
- O webhook confirma cada pagamento direto na API do Mercado Pago e confere o valor pago.
