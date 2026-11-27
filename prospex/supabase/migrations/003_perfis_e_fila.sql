-- O worker usa service_role para retirar pedidos da fila.
grant execute on function public.proximo_pedido() to service_role;

-- Contas que já existiam antes da instalação do trigger também precisam de perfil.
insert into public.profiles (id, nome)
select id, coalesce(raw_user_meta_data->>'nome', raw_user_meta_data->>'full_name', split_part(email, '@', 1), '')
from auth.users
on conflict (id) do nothing;
