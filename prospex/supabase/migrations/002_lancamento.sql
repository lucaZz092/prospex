-- Prospex 002: origem dos contatos, cidade de cada lead, kit de abordagem, garantia e desconto de cliente.
-- Rode depois do 001 no SQL Editor do Supabase (ou `supabase db push`).

alter table public.leads  add column if not exists cidade text;
alter table public.leads  add column if not exists fonte text;

alter table public.orders add column if not exists kit jsonb;
alter table public.orders add column if not exists desconto_centavos integer not null default 0;
alter table public.orders add column if not exists reembolso_centavos integer not null default 0;
alter table public.orders add column if not exists reembolso_status text
  check (reembolso_status in ('pendente', 'devolvido'));
alter table public.orders add column if not exists reembolso_motivo text;

-- boleto não é mais aceito (a landing oferece Pix ou cartão)
alter table public.orders drop constraint if exists orders_pagamento_metodo_check;
alter table public.orders add constraint orders_pagamento_metodo_check
  check (pagamento_metodo is null or pagamento_metodo in ('pix', 'card')) not valid;

drop view if exists public.orders_stats;
create view public.orders_stats with (security_invoker = true) as
select o.id, o.nicho, o.escopo, o.regiao, o.extras, o.valor_centavos, o.desconto_centavos, o.estimativa, o.status,
       o.progresso, o.erro, o.pagamento_metodo, o.criado_em, o.concluido_em, o.kit,
       o.reembolso_centavos, o.reembolso_status,
       count(l.id)::int as total,
       count(l.id) filter (where l.prioridade = 'A')::int as a,
       count(l.id) filter (where coalesce(l.whatsapp,'') <> '')::int as wa,
       count(l.id) filter (where coalesce(l.email,'') <> '')::int as mail
from public.orders o left join public.leads l on l.order_id = o.id
group by o.id;
grant select on public.orders_stats to authenticated;

-- Pedidos pendentes de devolução, para quem opera a Prospex conferir.
create or replace view public.devolucoes_pendentes as
select id, user_id, nicho, regiao, valor_centavos, reembolso_centavos, reembolso_motivo, pagamento_id, concluido_em
from public.orders where reembolso_status = 'pendente';
revoke all on public.devolucoes_pendentes from anon, authenticated;
