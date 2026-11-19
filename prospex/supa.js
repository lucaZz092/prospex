// Cliente Supabase compartilhado pelas páginas. Configure config.js com URL e anon key.
const sb = window.supabase.createClient(window.PROSPEX_CONFIG.SUPABASE_URL, window.PROSPEX_CONFIG.SUPABASE_ANON_KEY);

const Prospex = {
  sb,
  async user() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },

  async me() {
    const u = await this.user(); if (!u) return null;
    const { data } = await sb.from('profiles').select('nome,prefs').eq('id', u.id).maybeSingle();
    return { id: u.id, email: u.email, nome: (data && data.nome) || u.email.split('@')[0], prefs: (data && data.prefs) || {} };
  },
  async exigirLogin() { const m = await this.me(); if (!m) { location.href = 'login.html'; throw new Error('login'); } return m; },
  async atualizarPerfil(patch) {
    const u = await this.user();
    const { error } = await sb.from('profiles').update(patch).eq('id', u.id); if (error) throw new Error('Não foi possível salvar');
    return this.me();
  },

  async signup(nome, email, senha) {
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: location.origin + '/workspace.html' } });
    if (error) throw new Error(traduz(error.message));
    return { confirmar: !data.session };
  },
  async login(email, senha) { const { error } = await sb.auth.signInWithPassword({ email, password: senha }); if (error) throw new Error(traduz(error.message)); },
  async google(next) { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' + next } }); if (error) throw new Error(error.message); },
  async esqueci(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/login.html#nova-senha' }); if (error) throw new Error(traduz(error.message)); },
  async novaSenha(senha) { const { error } = await sb.auth.updateUser({ password: senha }); if (error) throw new Error(traduz(error.message)); },
  async logout() { await sb.auth.signOut(); },

  async criarPedido(body) {
    const { data, error } = await sb.functions.invoke('criar-pedido', { body });
    if (error) { let m = 'Não foi possível criar o pedido'; try { m = (await error.context.json()).detail || m; } catch (e) {} throw new Error(m); }
    return data;
  },
  async pedido(id) { const { data, error } = await sb.from('orders').select('*').eq('id', id).single(); if (error) throw error; return data; },
  async pedidos() {
    const { data, error } = await sb.from('orders_stats').select('*').neq('status', 'aguardando_pagamento').order('id', { ascending: false });
    if (error) throw error; return data;
  },
  ouvirPedidos(userId, cb) {
    return sb.channel('orders-' + userId).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'user_id=eq.' + userId }, cb).subscribe();
  },

  async leads() {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('leads').select('*').order('pontos', { ascending: false }).range(from, from + 999);
      if (error) throw error; out.push(...data); if (data.length < 1000) break;
    }
    return out;
  },
  async atualizarLead(id, patch) { const { error } = await sb.from('leads').update(patch).eq('id', id); if (error) throw new Error('Não foi possível salvar o lead'); },

  async baixarCSV(orderId, nome) {
    const cols = ['prioridade', 'pontos', 'empresa', 'segmento', 'categoria', 'telefone', 'whatsapp', 'email', 'site', 'instagram', 'linkedin', 'endereco', 'avaliacao', 'n_avaliacoes', 'abordagem', 'etapa', 'notas'];
    const { data, error } = await sb.from('leads').select(cols.join(',')).eq('order_id', orderId).order('pontos', { ascending: false }).limit(200000);
    if (error) throw error;
    const cel = v => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '﻿' + [cols.join(','), ...data.map(r => cols.map(c => cel(r[c])).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
      download: (nome || 'prospex_' + orderId).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '_') + '.csv' });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

function traduz(m) {
  const t = { 'Invalid login credentials': 'E-mail ou senha incorretos', 'User already registered': 'Já existe uma conta com esse e-mail',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)', 'Password should be at least 6 characters': 'A senha precisa ter pelo menos 8 caracteres' };
  return t[m] || m;
}
window.Prospex = Prospex;
