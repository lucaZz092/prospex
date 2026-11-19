-- Prospex: schema + RLS. Rode no SQL Editor do Supabase (ou `supabase db push`).

-- ---------- perfis ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  prefs jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- pedidos ----------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nicho text not null check (char_length(nicho) between 3 and 60),
  escopo text not null check (escopo in ('cidade','estado','pais')),
  regiao text not null,
  extras jsonb not null default '[]'::jsonb,
  valor_centavos integer not null,
  estimativa integer not null default 0,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','na_fila','buscando','pronta','erro')),
  progresso smallint not null default 0,
  erro text,
  pagamento_id text,
  pagamento_metodo text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index if not exists orders_user_idx on public.orders(user_id, id desc);
create index if not exists orders_fila_idx on public.orders(status, id);

-- ---------- leads ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prioridade text, pontos integer, empresa text, segmento text, categoria text,
  telefone text, whatsapp text, email text, site text, instagram text, linkedin text, endereco text,
  avaliacao real, n_avaliacoes integer, abordagem text,
  etapa text not null default 'novo' check (etapa in ('novo','contato','reuniao','proposta','ganho','perdido')),
  notas text not null default '' check (char_length(notas) <= 5000),
  atualizado_em timestamptz
);
create index if not exists leads_user_idx on public.leads(user_id, order_id, pontos desc);

create or replace function public.touch_lead() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update of etapa, notas on public.leads for each row execute function public.touch_lead();

-- ---------- pedidos + estatísticas (respeita RLS de quem consulta) ----------
create or replace view public.orders_stats with (security_invoker = true) as
select o.id, o.nicho, o.escopo, o.regiao, o.extras, o.valor_centavos, o.estimativa, o.status, o.progresso, o.erro,
       o.pagamento_metodo, o.criado_em, o.concluido_em,
       count(l.id)::int as total,
       count(l.id) filter (where l.prioridade = 'A')::int as a,
       count(l.id) filter (where coalesce(l.whatsapp,'') <> '')::int as wa,
       count(l.id) filter (where coalesce(l.email,'') <> '')::int as mail
from public.orders o left join public.leads l on l.order_id = o.id
group by o.id;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;
alter table public.leads    enable row level security;

drop policy if exists "perfil: ler o próprio" on public.profiles;
create policy "perfil: ler o próprio" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: editar o próprio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- pedidos: o usuário só LÊ. Criar/alterar é exclusivo das Edge Functions e do worker (service role).
drop policy if exists "pedidos: ler os próprios" on public.orders;
create policy "pedidos: ler os próprios" on public.orders for select to authenticated using (user_id = auth.uid());

drop policy if exists "leads: ler os próprios" on public.leads;
create policy "leads: ler os próprios" on public.leads for select to authenticated using (user_id = auth.uid());
drop policy if exists "leads: editar os próprios" on public.leads;
create policy "leads: editar os próprios" on public.leads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- privilégios de coluna: o usuário só altera nome/prefs do perfil e etapa/notas do lead
revoke insert, update, delete on public.profiles, public.orders, public.leads from anon, authenticated;
grant select on public.profiles, public.orders, public.leads, public.orders_stats to authenticated;
grant update (nome, prefs) on public.profiles to authenticated;
grant update (etapa, notas) on public.leads to authenticated;

-- progresso em tempo real
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

-- ---------- worker: pega o próximo pedido com trava (vários workers sem conflito) ----------
create or replace function public.proximo_pedido() returns setof public.orders
language sql security definer set search_path = public as $$
  update public.orders set status = 'buscando', progresso = 2
  where id = (select id from public.orders where status = 'na_fila' order by id for update skip locked limit 1)
  returning *;
$$;
revoke all on function public.proximo_pedido() from public, anon, authenticated;
