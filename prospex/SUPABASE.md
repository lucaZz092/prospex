# Prospex no Supabase: configuração

## 1. Banco de dados
Supabase → **SQL Editor** → cole e rode `supabase/migrations/001_schema.sql` e depois `002_lancamento.sql`.
Isso cria as tabelas `profiles`, `orders` e `leads`, a view `orders_stats`, as regras de acesso (RLS), o Realtime e a função de fila `proximo_pedido`. O 002 acrescenta a origem e a cidade de cada lead, o kit de abordagem, a garantia de volume e o desconto de cliente.

Devoluções que não puderam ser feitas automaticamente aparecem na view `devolucoes_pendentes` (só o painel do Supabase enxerga).

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
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...             # obrigatório: sem ele a função recusa pedidos
# só em ambiente de teste, nunca em produção:
# supabase secrets set PROSPEX_DEMO=1                         # aprova pedidos sem cobrar
```
No Mercado Pago, cadastre o webhook em **Suas integrações → Webhooks**: URL `https://SEU_REF.supabase.co/functions/v1/mp-webhook`, evento **Pagamentos**.
Sem a CLI, crie as duas funções em **Edge Functions → Deploy a new function**. Cole o código e junte o conteúdo de `_shared/pricing.ts` no mesmo arquivo. Na `mp-webhook`, desligue a opção "Verify JWT".

## 4. Front-end
Em `config.js`, coloque a **Project URL** e a **anon key** (Project Settings → API).

## 5. Worker
Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A service role key fica **só** nesse arquivo: nunca no front-end, nunca no git.
Para a garantia de volume e o e-mail de "lista pronta", preencha também `MP_ACCESS_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM` e `SITE_URL`.
```bash
bash rodar.sh          # site em localhost:8000 + worker com leads FICTÍCIOS (teste)
bash rodar.sh --real   # busca real no Google Maps (motor do kit rodando)
```
Sem o kit, o worker em modo real não inicia, para nunca entregar uma lista falsa a um cliente pagante.
O worker precisa de uma máquina sempre ligada com Chrome (um servidor ou VPS). Num estado grande, ele percorre
todas as cidades do IBGE dentro do prazo do plano: as maiores ganham mais tempo de busca.

## Segurança
- O usuário só lê os próprios pedidos e leads. Ele só pode alterar a etapa e as notas dos leads e o nome e as preferências do perfil.
- Pedidos são criados apenas pela Edge Function, que calcula o preço. Só o worker e o webhook mudam o status de um pedido.
- O webhook confirma cada pagamento direto na API do Mercado Pago e confere o valor pago.
