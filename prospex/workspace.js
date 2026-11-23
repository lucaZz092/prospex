const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('prospex_' + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('prospex_' + k, JSON.stringify(v)); } catch (e) {} },
};

// ---------- API ----------
const STAGES = [['novo', 'Novos', '#8A90A8'], ['contato', 'Em contato', '#33E1FF'], ['reuniao', 'Reunião', '#7B5CFF'], ['proposta', 'Proposta', '#FFB84F'], ['ganho', 'Fechado', '#C6FF3D']];
const EMOJI = { 'clín': '🩺', 'odont': '🦷', 'estét': '💆', 'contab': '📊', 'advoc': '⚖️', 'transp': '🚚', 'distrib': '📦', 'constr': '🏗️', 'indúst': '🏭', 'imob': '🏠', 'oficin': '🔧', 'academ': '🏋️', 'idioma': '🗣️', 'restau': '🍽️', 'pet': '🐾', 'salõ': '✂️' };
const emoji = n => (Object.entries(EMOJI).find(([k]) => n.toLowerCase().includes(k)) || [0, '📡'])[1];
const ST = { pronta: 'ok', buscando: 'run', na_fila: 'q', erro: 'q' };
let user = {}, primeiro = '', ORDERS = [], LEADS = [];

function mapOrder(o) {
  const esc = { cidade: 'Cidade', estado: 'Estado', pais: 'Brasil' }[o.escopo];
  return { id: o.id, em: emoji(o.nicho), nicho: o.nicho, reg: o.escopo === 'estado' ? 'Estado de ' + o.regiao : o.regiao, escopo: esc,
    leads: o.total, a: o.a, wa: o.wa, mail: o.mail, st: ST[o.status] || 'q', raw: o.status, erro: o.erro, kit: o.kit, reembolso: o.reembolso_centavos, reembolsoSt: o.reembolso_status,
    p: o.progresso, data: (o.criado_em || '').slice(0, 10).split('-').reverse().join('/') };
}
function mapLead(l) {
  const partes = (l.endereco || '').split(/[,—]/).map(s => s.trim()).filter(Boolean);
  const o = ORDERS.find(x => x.id === l.order_id);
  return { id: l.id, o: l.order_id, nome: l.empresa, bairro: partes.length > 2 ? partes[partes.length - 3] : (partes[1] || '—'), cidade: o ? o.reg : '',
    p: l.prioridade || 'C', nota: l.avaliacao || 0, rev: l.n_avaliacoes || 0, wa: l.whatsapp, mail: l.email, ig: l.instagram,
    tel: l.telefone, stage: l.etapa === 'perdido' ? 'novo' : l.etapa, notas: l.notas || '' };
}
async function loadOrders() { ORDERS = (await Prospex.pedidos()).map(mapOrder); $('#ctOrders').textContent = ORDERS.length;
  $('#credLeads').textContent = fmt(ORDERS.reduce((s, o) => s + o.leads, 0)); }
async function loadLeads() { LEADS = (await Prospex.leads()).map(mapLead); }
async function setLead(l, patch) { Object.assign(l, patch); try { await Prospex.atualizarLead(l.id, { etapa: l.stage, notas: l.notas }); } catch (e) { toast(e.message); } }

$('#logout').onclick = async e => { e.preventDefault(); await Prospex.logout(); location.href = 'login.html'; };

// ---------- roteamento ----------
const routes = { inicio, prospeccoes, leads, pipeline, modelos, config };
function route() {
  const r = (location.hash.slice(1) || 'inicio').split('?')[0];
  $$('#menu a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  $('#page').innerHTML = ''; $('#page').className = '';
  void $('#page').offsetWidth; $('#page').className = 'page';
  (routes[r] || inicio)();
  $('#side').classList.remove('open'); scrollTo(0, 0);
}
addEventListener('hashchange', route);
$('#burger').onclick = () => $('#side').classList.toggle('open');
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('#gsearch').focus(); } });
$('#gsearch').onkeydown = e => { if (e.key === 'Enter') { store.set('q', e.target.value); location.hash = 'leads'; route(); } };
$('#bell').onclick = () => drawer(`<h2 style="font-size:22px;margin-bottom:16px">Notificações</h2><div class="list">${ORDERS.map(o => `<div class="it"><div class="ic">${o.st === 'ok' ? '✅' : o.st === 'run' ? '📡' : '⏳'}</div><div class="tx"><b>${o.nicho} · ${o.reg}</b><small>${o.st === 'ok' ? fmt(o.leads) + ' leads, ' + fmt(o.a) + ' de prioridade A' : o.st === 'run' ? o.p + '% concluído' : o.raw === 'erro' ? 'falhou' : 'na fila'}</small></div></div>`).join('') || '<div class="empty">Nada por aqui ainda.</div>'}</div>`);

// ---------- drawer ----------
function drawer(html) { $('#drawer').innerHTML = `<button class="icon-btn" style="margin-left:auto;margin-bottom:10px" id="dClose">✕</button>` + html; $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); $('#dClose').onclick = closeDrawer; }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); }
$('#scrim').onclick = closeDrawer;
addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

function leadDrawer(id) {
  const l = LEADS.find(x => x.id === id);
  drawer(`<span class="prio ${l.p}" style="width:30px;height:30px;font-size:14px">${l.p}</span>
    <h2 style="font-size:24px;margin:14px 0 4px">${l.nome}</h2><p style="color:var(--muted)">${l.bairro} · ${l.cidade} · ★ ${String(l.nota).replace('.', ',')} (${l.rev})</p>
    <div style="display:grid;gap:8px;margin:22px 0">
      ${l.wa ? `<button class="btn btn-primary" id="dWa">💬 Abrir WhatsApp</button>` : ''}
      ${l.mail ? `<button class="btn btn-ghost" id="dMail">✉️ Enviar e-mail com modelo</button>` : ''}
      ${l.tel ? `<a class="btn btn-ghost" href="tel:${l.tel.replace(/\D/g, '')}">📞 Ligar ${l.tel}</a>` : ''}
    </div>
    <div class="field"><label>Etapa</label><select class="input" id="dStage">${STAGES.map(s => `<option value="${s[0]}" ${l.stage === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></div>
    <div class="field"><label>Anotações</label><textarea class="input notes" id="dNotes" placeholder="Ex.: falar com a recepção às 14h">${l.notas}</textarea></div>
    <button class="btn btn-primary btn-block" id="dSave">Salvar</button>`);
  $('#dSave').onclick = async () => { await setLead(l, { stage: $('#dStage').value, notas: $('#dNotes').value }); closeDrawer(); toast('Lead atualizado'); route(); };
  if ($('#dWa')) $('#dWa').onclick = () => { if (l.stage === 'novo') setLead(l, { stage: 'contato' }); window.open(l.wa, '_blank', 'noopener'); };
  if ($('#dMail')) $('#dMail').onclick = () => { location.hash = 'modelos'; closeDrawer(); };
}

// ---------- páginas ----------
function head(t, s, act = '') { return `<div class="page-head"><div><h1>${t}</h1><p>${s}</p></div>${act}</div>`; }
function countUp(root = document) { root.querySelectorAll('[data-to]').forEach(el => { const to = +el.dataset.to, t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 900); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0); }); }

function inicio() {
  const h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const by = s => LEADS.filter(l => l.stage === s).length;
  const contatados = LEADS.filter(l => l.stage !== 'novo').length;
  const semana = [42, 65, 38, 80, 72, 24, 12], dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const run = ORDERS.find(o => o.st === 'run');
  const tasks = store.get('tasks', [false, false, false, false]);
  if (!ORDERS.length) { $('#page').innerHTML = `<div class="welcome"><h2>${saud}, ${primeiro} 👋</h2><p>Você ainda não tem prospecções. Escolha um nicho e uma região para receber seus primeiros leads.</p><div class="acts"><a href="app.html" class="btn btn-primary">Montar minha primeira prospecção →</a></div></div>`; return; }
  $('#page').innerHTML = `
    <div class="welcome">
      <h2>${saud}, ${primeiro} 👋</h2>
      <p>Você tem <b style="color:var(--lime)">${LEADS.filter(l => l.p === 'A' && l.stage === 'novo').length} leads de prioridade A</b> ainda sem contato. Que tal começar por eles hoje?</p>
      <div class="acts"><a href="#leads" class="btn btn-primary" id="goA">Ver leads prioridade A →</a><a href="app.html" class="btn btn-ghost">Nova prospecção</a></div>
    </div>
    <div class="kpis">
      <div class="kpi"><small>Leads totais</small><strong data-to="${ORDERS.reduce((s, o) => s + o.leads, 0)}">0</strong><div class="delta">em ${ORDERS.filter(o => o.st === 'ok').length} lista(s)</div></div>
      <div class="kpi"><small>Contatados</small><strong data-to="${contatados}">0</strong><div class="delta">${Math.round(contatados / (LEADS.length || 1) * 100)}% da carteira</div></div>
      <div class="kpi"><small>Em negociação</small><strong data-to="${by('reuniao') + by('proposta')}">0</strong><div class="delta">reuniões + propostas</div></div>
      <div class="kpi"><small>Fechados</small><strong style="color:var(--lime)" data-to="${by('ganho')}">0</strong><div class="delta">bora pro primeiro! 🚀</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><div><h3>Contatos feitos</h3><div class="sub">últimos 7 dias</div></div><span class="chip on">Semana</span></div>
        <div class="chart">${semana.map((v, i) => `<div class="col"><div class="bar" data-v="${v} contatos" style="height:${v}%;animation-delay:${i * 70}ms"></div><small>${dias[i]}</small></div>`).join('')}</div></div>
      <div class="card"><h3>Funil</h3><div class="sub" style="margin-bottom:18px">das suas listas</div>
        <div class="funnel">${STAGES.map(s => { const n = by(s[0]); return `<div><span>${s[1]}</span><i style="--w:${Math.max(4, n / (LEADS.length || 1) * 100)}%;background:${s[2]}"></i><b>${n}</b></div>`; }).join('')}</div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>Prospecções recentes</h3><a href="#prospeccoes" style="color:var(--lime);font-size:13px">Ver todas →</a></div>
        <div class="list">${ORDERS.map(o => `<div class="it"><div class="ic">${o.em}</div><div class="tx"><b>${o.nicho}</b><small>${o.reg} · ${o.st === 'ok' ? fmt(o.leads) + ' leads' : o.st === 'run' ? 'buscando…' : o.raw === 'erro' ? 'falhou' : 'aguardando início'}</small>
          ${o.st === 'run' ? `<div class="mini-prog"><i id="runProg" style="--p:${o.p}%"></i></div>` : ''}</div>
          <span class="status ${o.st}">${o.st === 'ok' ? 'Pronta' : o.st === 'run' ? '<span id="runPct">' + o.p + '</span>%' : 'Na fila'}</span></div>`).join('')}</div></div>
      <div class="card"><h3>Primeiros passos</h3><div class="sub" style="margin-bottom:10px">tire o máximo da Prospex</div>
        <div class="checklist">${['Baixar sua primeira lista', 'Contatar 10 leads de prioridade A', 'Personalizar um modelo de e-mail', 'Mover um lead para "Reunião"'].map((t, i) => `<label><input type="checkbox" data-t="${i}" ${tasks[i] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
    </div>`;
  countUp();
  $('#goA').onclick = () => store.set('filtroP', 'A');
  $$('[data-t]').forEach(c => c.onchange = () => { tasks[c.dataset.t] = c.checked; store.set('tasks', tasks); if (tasks.every(Boolean)) toast('🎉 Checklist completo!'); });
  
}

function prospeccoes() {
  $('#page').innerHTML = head('Minhas prospecções', 'Cada compra vira uma lista — baixe quantas vezes quiser.', '<a href="app.html" class="btn btn-primary">＋ Nova prospecção</a>') +
    `<div class="orders">${ORDERS.map(o => `<div class="order" data-o="${o.id}">
      <div class="top"><span class="em">${o.em}</span><span class="status ${o.st}">${o.st === 'ok' ? 'Pronta' : o.st === 'run' ? 'Buscando ' + o.p + '%' : 'Na fila'}</span></div>
      <h3>${o.nicho}</h3><div class="reg">${o.reg} · ${o.escopo} · ${o.data}</div>
      ${o.st === 'run' ? `<div class="mini-prog" style="margin-top:14px"><i style="--p:${o.p}%"></i></div>` : ''}
      <div class="nums"><div><b>${o.leads ? fmt(o.leads) : '—'}</b><small>leads</small></div><div><b style="color:var(--lime)">${o.a ? fmt(o.a) : '—'}</b><small>prioridade A</small></div><div><b>${o.wa ? fmt(o.wa) : '—'}</b><small>WhatsApp</small></div></div>
      ${o.reembolso ? `<div class="reg" style="margin-top:10px">Garantia: ${o.reembolsoSt === 'devolvido' ? 'devolvemos' : 'vamos devolver'} R$ ${(o.reembolso / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>` : ''}
      ${o.st === 'ok' ? '<div class="reg" style="margin-top:6px"><a href="guia-lgpd.html" target="_blank" style="text-decoration:underline">Guia de boas práticas de contato (LGPD)</a></div>' : ''}
      <div class="acts">${o.st === 'ok' ? `<button class="btn btn-primary" data-open="${o.id}">Abrir leads</button><button class="btn btn-ghost" data-dl="${o.id}">⬇ CSV</button><button class="btn btn-ghost" data-xl="${o.id}">⬇ Excel</button><button class="btn btn-ghost" data-kit="${o.id}">Kit de abordagem</button>` :`<button class="btn btn-ghost" disabled style="opacity:.6">${o.raw === 'erro' ? 'Falhou: ' + (o.erro || 'erro') : 'Avisaremos por e-mail'}</button>`}</div>
    </div>`).join('')}
    <a href="app.html" class="order" style="display:grid;place-items:center;text-align:center;border-style:dashed;min-height:240px"><div><div style="font-size:34px">＋</div><b>Nova região ou nicho</b><div class="reg">20% off para clientes</div></div></a></div>`;
  $$('[data-open]').forEach(b => b.onclick = e => { e.stopPropagation(); store.set('filtroO', +b.dataset.open); location.hash = 'leads'; });
  $$('[data-dl]').forEach(b => b.onclick = e => { e.stopPropagation(); const o = ORDERS.find(x => x.id === +b.dataset.dl); Prospex.baixarCSV(o.id, `prospex_${o.nicho}_${o.reg}`).catch(() => toast('Falha no download')); });
  $$('[data-xl]').forEach(b => b.onclick = e => { e.stopPropagation(); const o = ORDERS.find(x => x.id === +b.dataset.xl); Prospex.baixarExcel(o.id, `prospex_${o.nicho}_${o.reg}`).catch(() => toast('Falha no download')); });
  $$('[data-kit]').forEach(b => b.onclick = e => { e.stopPropagation(); const o = ORDERS.find(x => x.id === +b.dataset.kit); try { Prospex.baixarKit({ id: o.id, nicho: o.nicho, kit: o.kit }); } catch (err) { toast(err.message); } });
}

function leads() {
  const f = { o: store.get('filtroO', 0), p: store.get('filtroP', ''), q: store.get('q', ''), c: '' };
  store.set('filtroP', ''); store.set('q', '');
  $('#page').innerHTML = head('Leads', 'Clique numa empresa para abrir ações e anotações.', '<button class="btn btn-ghost" id="exp">⬇ Exportar</button>') + `
    <div class="filters">
      <div class="search" style="margin:0;flex:1;min-width:200px;padding:0 12px">🔎<input id="lq" placeholder="Filtrar por nome ou bairro" value="${f.q}" style="padding:10px 0;font-size:14px"></div>
      <select class="input" id="lo"><option value="0">Todas as listas</option>${ORDERS.filter(o => o.st === 'ok').map(o => `<option value="${o.id}" ${f.o === o.id ? 'selected' : ''}>${o.nicho} · ${o.reg}</option>`).join('')}</select>
      ${['A', 'B', 'C'].map(p => `<span class="chip ${f.p === p ? 'on' : ''}" data-p="${p}" style="cursor:pointer">Prioridade ${p}</span>`).join('')}
      <span class="chip" data-c="wa" style="cursor:pointer">💬 WhatsApp</span><span class="chip" data-c="mail" style="cursor:pointer">✉️ E-mail</span>
    </div>
    <div class="table-wrap"><table><thead><tr><th></th><th>Empresa</th><th>Bairro</th><th>Avaliação</th><th>Contatos</th><th>Etapa</th></tr></thead><tbody id="tb"></tbody></table></div>
    <p class="sub" id="cnt" style="margin-top:12px;color:var(--muted);font-size:13px"></p>`;
  const draw = () => {
    const q = f.q.toLowerCase();
    const rows = LEADS.filter(l => (!f.o || l.o === f.o) && (!f.p || l.p === f.p) && (!f.c || l[f.c]) && (!q || (l.nome + l.bairro).toLowerCase().includes(q)));
    $('#tb').innerHTML = rows.map(l => `<tr data-l="${l.id}" style="cursor:pointer"><td><span class="prio ${l.p}">${l.p}</span></td><td><b>${l.nome}</b><br><small style="color:var(--muted)">${l.cidade}</small></td><td>${l.bairro}</td><td>★ ${String(l.nota).replace('.', ',')} <small style="color:var(--muted)">(${l.rev})</small></td>
      <td>${l.wa ? '<span class="wa">WhatsApp</span> ' : ''}${l.mail ? '· E-mail ' : ''}${l.ig ? '· IG' : ''}</td><td><span class="status ${l.stage === 'ganho' ? 'ok' : l.stage === 'novo' ? 'q' : 'run'}">${STAGES.find(s => s[0] === l.stage)[1]}</span></td></tr>`).join('')
      || `<tr><td colspan="6"><div class="empty">Nenhum lead com esses filtros.</div></td></tr>`;
    $('#cnt').textContent = `${rows.length} de ${LEADS.length} leads`;
    $$('[data-l]').forEach(r => r.onclick = () => leadDrawer(+r.dataset.l));
  };
  $('#lq').oninput = e => { f.q = e.target.value; draw(); };
  $('#lo').onchange = e => { f.o = +e.target.value; store.set('filtroO', f.o); draw(); };
  $$('[data-p]').forEach(c => c.onclick = () => { f.p = f.p === c.dataset.p ? '' : c.dataset.p; $$('[data-p]').forEach(x => x.classList.toggle('on', x.dataset.p === f.p)); draw(); });
  $$('[data-c]').forEach(c => c.onclick = () => { f.c = f.c === c.dataset.c ? '' : c.dataset.c; $$('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === f.c)); draw(); });
  $('#exp').onclick = () => { const o = f.o || (ORDERS.find(x => x.st === 'ok') || {}).id; o ? Prospex.baixarCSV(o).catch(() => toast('Falha no download')) : toast('Nenhuma lista pronta ainda'); };
  draw();
}

function pipeline() {
  $('#page').innerHTML = head('Pipeline', 'Arraste os cards entre as etapas. Tudo fica salvo.') + `<div class="kanban">${STAGES.map(s => {
    const ls = LEADS.filter(l => l.stage === s[0]).slice(0, s[0] === 'novo' ? 12 : 99);
    const tot = LEADS.filter(l => l.stage === s[0]).length;
    return `<div class="kcol" data-s="${s[0]}"><h4><span><i style="--c:${s[2]}"></i>${s[1]}</span><span>${tot}</span></h4>${ls.map(l => `<div class="kcard" draggable="true" data-k="${l.id}"><b>${l.nome}<span class="prio ${l.p}" style="width:20px;height:20px;font-size:10px">${l.p}</span></b><small>${l.bairro} · ★ ${String(l.nota).replace('.', ',')}</small><div class="tags">${l.wa ? '<span>WhatsApp</span>' : ''}${l.mail ? '<span>E-mail</span>' : ''}${l.notas ? '<span>📝</span>' : ''}</div></div>`).join('')}${tot > ls.length ? `<div class="sub" style="text-align:center;font-size:12px;padding:8px">+${tot - ls.length} leads</div>` : ''}</div>`;
  }).join('')}</div>`;
  let dragId = null;
  $$('.kcard').forEach(c => {
    c.ondragstart = () => { dragId = +c.dataset.k; c.classList.add('drag'); };
    c.ondragend = () => c.classList.remove('drag');
    c.onclick = () => leadDrawer(+c.dataset.k);
  });
  $$('.kcol').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = () => { col.classList.remove('over'); const l = LEADS.find(x => x.id === dragId); if (!l || l.stage === col.dataset.s) return;
      setLead(l, { stage: col.dataset.s }); pipeline(); if (l.stage === 'ganho') toast('🎉 Negócio fechado: ' + l.nome); };
  });
}

const TPLS = [
  ['Saúde', '🩺', 'Menos faltas e agenda sem planilha', 'Sua agenda cheia, sem faltas.', 'Vi o perfil da {{empresa}} no Google Maps e notei a ótima avaliação ({{nota}} estrelas). Clínicas como a de vocês costumam perder horários por falta de confirmação — temos uma forma simples de resolver isso.'],
  ['Escritórios', '⚖️', 'Prazos da {{empresa}} sob controle', 'Nenhum prazo perdido.', 'Olá, equipe da {{empresa}}! Escritórios no {{bairro}} costumam controlar prazos e documentos em planilhas. Posso mostrar em 15 minutos como automatizar isso?'],
  ['Genérico', '✨', 'Uma ideia rápida para a {{empresa}}', 'Seu processo, num sistema só.', 'Olá! Encontrei a {{empresa}} no Google Maps e acredito que podemos ajudar a ganhar tempo no dia a dia. Topa uma conversa rápida?'],
];
function modelos() {
  let sel = 0;
  $('#page').innerHTML = head('Modelos de e-mail', 'Use variáveis como <span class="var">{{empresa}}</span>, <span class="var">{{bairro}}</span> e <span class="var">{{nota}}</span> — preenchidas para cada lead.', '<button class="btn btn-primary" id="useTpl">Usar com leads A →</button>') +
    `<div class="tpl"><div class="card tpl-list" id="tl"></div><div class="card"><div class="field"><label>Assunto</label><input class="input" id="ts"></div><div class="field"><label>Mensagem</label><textarea class="input notes" id="tb2" style="min-height:120px"></textarea></div>
     <div class="sub" style="margin:6px 0 10px">Prévia com um lead real da sua lista</div><div class="mail-prev" id="mp"></div></div></div>`;
  const ex = LEADS[0];
  const fill = s => s.replace(/\{\{empresa\}\}/g, ex.nome).replace(/\{\{bairro\}\}/g, ex.bairro).replace(/\{\{nota\}\}/g, String(ex.nota).replace('.', ','));
  const prev = () => { const t = TPLS[sel]; $('#mp').innerHTML = `<div class="h"><span class="logo" style="font-size:15px"><span class="logo-mark" style="width:22px;height:22px;font-size:12px">P</span>Sua empresa</span><b>${t[3]}</b></div><div class="b"><b>${fill($('#ts').value)}</b><p style="margin-top:10px">${fill($('#tb2').value)}</p><span class="cta">Agendar conversa →</span></div>`; };
  const list = () => { $('#tl').innerHTML = TPLS.map((t, i) => `<div class="it list ${i === sel ? 'on' : ''}" data-i="${i}" style="display:flex;gap:12px;align-items:center"><div class="ic">${t[1]}</div><div class="tx"><b>${t[0]}</b><small>${t[2].replace('{{empresa}}', '…')}</small></div></div>`).join('');
    $$('[data-i]').forEach(d => d.onclick = () => { sel = +d.dataset.i; load(); }); };
  const load = () => { $('#ts').value = TPLS[sel][2]; $('#tb2').value = TPLS[sel][4]; list(); prev(); };
  $('#ts').oninput = e => { TPLS[sel][2] = e.target.value; prev(); }; $('#tb2').oninput = e => { TPLS[sel][4] = e.target.value; prev(); };
  $('#useTpl').onclick = () => toast(`Modelo pronto para ${LEADS.filter(l => l.p === 'A' && l.mail).length} leads A com e-mail`);
  load();
}

function config() {
  const prefs = { mail: true, wa: false, weekly: true, ...(user.prefs || {}) };
  $('#page').innerHTML = head('Configurações', 'Sua conta, notificações e integrações.') + `<div class="settings">
    <div class="card"><h3 style="margin-bottom:16px">Perfil</h3><div class="row2"><div class="field"><label>Nome</label><input class="input" id="cn" value="${user.nome}"></div><div class="field"><label>E-mail</label><input class="input" id="ce" value="${user.email}"></div></div><button class="btn btn-primary" id="cs">Salvar perfil</button></div>
    <div class="card"><h3>Notificações</h3>${[['mail', 'E-mail quando uma prospecção terminar', 'Recomendado'], ['wa', 'Aviso por WhatsApp', 'Mensagem curta com o link da lista'], ['weekly', 'Resumo semanal', 'Seu funil e sugestões de próximos passos']].map(([k, t, d]) => `<div class="set-row"><div>${t}<small>${d}</small></div><button class="toggle ${prefs[k] ? 'on' : ''}" data-pf="${k}"></button></div>`).join('')}</div>
    <div class="card"><h3>Integrações</h3>${[['RD Station', 'Enviar leads como contatos'], ['Pipedrive', 'Criar negócios automaticamente'], ['HubSpot', 'Sincronizar empresas']].map(([n, d]) => `<div class="set-row"><div>${n}<small>${d}</small></div><button class="btn btn-ghost" style="padding:8px 14px;font-size:13px" data-int>Conectar</button></div>`).join('')}</div>
    <div class="card"><h3>Compras</h3>${ORDERS.filter(o => o.st !== 'q').map(o => `<div class="set-row"><div>${o.nicho} · ${o.reg}<small>${o.data} · ${o.escopo}</small></div><a href="#" style="color:var(--lime);font-size:13px">Recibo</a></div>`).join('')}</div>
  </div>`;
  $('#ce').disabled = true;
  $('#cs').onclick = async () => { try { user = await Prospex.atualizarPerfil({ nome: $('#cn').value }); } catch (e) { return toast(e.message); } $('#meNome').textContent = user.nome; $('#meEmail').textContent = user.email; toast('Perfil salvo'); };
  $$('[data-pf]').forEach(t => t.onclick = () => { prefs[t.dataset.pf] = !prefs[t.dataset.pf]; t.classList.toggle('on'); Prospex.atualizarPerfil({ prefs }).catch(() => toast('Não foi possível salvar')); });
  $$('[data-int]').forEach(b => b.onclick = () => toast('Integrações chegam com o backend'));
}

async function boot() {
  user = await Prospex.exigirLogin(); primeiro = (user.nome || 'Você').split(' ')[0];
  $('#meNome').textContent = user.nome; $('#meEmail').textContent = user.email; $('#meAv').textContent = primeiro[0].toUpperCase();
  await loadOrders(); await loadLeads(); route();
  let t;  // progresso em tempo real (Supabase Realtime), com debounce
  Prospex.ouvirPedidos(user.id, () => { clearTimeout(t); t = setTimeout(async () => {
    const antes = ORDERS.filter(o => o.raw === 'pronta').length;
    await loadOrders(); if (ORDERS.filter(o => o.raw === 'pronta').length !== antes) { await loadLeads(); toast('✅ Uma lista acabou de ficar pronta'); }
    const r = location.hash.slice(1) || 'inicio'; if (r === 'inicio' || r === 'prospeccoes') route();
  }, 400); });
}
boot();
