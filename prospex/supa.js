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

  async jaCliente() {
    const { count, error } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pronta');
    if (error) throw error;
    return (count || 0) > 0;
  },
  async _linhas(orderId) {
    const cols = ['prioridade', 'pontos', 'empresa', 'segmento', 'categoria', 'telefone', 'whatsapp', 'email', 'site', 'instagram', 'linkedin', 'endereco', 'cidade', 'avaliacao', 'n_avaliacoes', 'abordagem', 'fonte', 'etapa', 'notas'];
    const rows = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from('leads').select(cols.join(',')).eq('order_id', orderId).order('pontos', { ascending: false }).range(de, de + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return { cols, rows };
  },
  _nome(orderId, nome, ext) { return (nome || 'prospex_' + orderId).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '_') + ext; },
  _baixar(blob, arquivo) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: arquivo });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async baixarExcel(orderId, nome) {
    const { cols, rows } = await this._linhas(orderId);
    if (!window.XLSX) await new Promise((ok, falha) => document.head.appendChild(Object.assign(document.createElement('script'),
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', onload: ok, onerror: falha })));
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    this._baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), this._nome(orderId, nome, '.xlsx'));
  },
  baixarKit(order) {
    const k = order.kit; if (!k) throw new Error('Kit ainda não disponível');
    const txt = `KIT DE ABORDAGEM: ${order.nicho}\n\nROTEIRO DE LIGAÇÃO\n${k.ligacao.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\n`
      + `MODELO DE E-MAIL\nAssunto: ${k.email_assunto}\n\n${k.email}\n\nBoas práticas de contato (LGPD): ${location.origin}/guia-lgpd.html\n`;
    this._baixar(new Blob([txt], { type: 'text/plain;charset=utf-8' }), this._nome(order.id, 'kit_abordagem_' + order.nicho, '.txt'));
  },
  async baixarCSV(orderId, nome) {
    const { cols, rows: data } = await this._linhas(orderId);
    const cel = v => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '﻿' + [cols.join(','), ...data.map(r => cols.map(c => cel(r[c])).join(','))].join('\n');
    this._baixar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), this._nome(orderId, nome, '.csv'));
  },
};

function traduz(m) {
  const t = { 'Invalid login credentials': 'E-mail ou senha incorretos', 'User already registered': 'Já existe uma conta com esse e-mail',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)', 'Password should be at least 6 characters': 'A senha precisa ter pelo menos 8 caracteres' };
  return t[m] || m;
}
window.Prospex = Prospex;
