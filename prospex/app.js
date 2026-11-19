const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const brl = n => 'R$ ' + n.toLocaleString('pt-BR');

const NICHOS = [
  ['🩺', 'Clínicas médicas', 'Saúde', 1.0], ['🦷', 'Odontologia', 'Saúde', .9], ['💆', 'Estética', 'Saúde', .8],
  ['📊', 'Contabilidade', 'Serviços B2B', .7], ['⚖️', 'Advocacia', 'Serviços B2B', .85], ['🚚', 'Transportadoras', 'Logística', .5],
  ['📦', 'Distribuidoras', 'Logística', .45], ['🏗️', 'Construtoras', 'Obras', .55], ['🏭', 'Indústrias', 'Indústria', .4],
  ['🏠', 'Imobiliárias', 'Imóveis', .75], ['🔧', 'Oficinas mecânicas', 'Automotivo', .9], ['🏋️', 'Academias', 'Fitness', .6],
  ['🗣️', 'Escolas de idiomas', 'Educação', .5], ['🍽️', 'Restaurantes', 'Alimentação', 1.2], ['🐾', 'Pet shops', 'Pets', .7],
  ['✂️', 'Salões de beleza', 'Beleza', 1.1],
];
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CIDADES_POP = ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG', 'Campinas, SP', 'Curitiba, PR', 'Porto Alegre, RS', 'Brasília, DF', 'Salvador, BA', 'Recife, PE', 'Fortaleza, CE'];
const ESCOPO = {
  cidade: { label: 'Cidade', preco: 97, base: 900 },
  estado: { label: 'Estado', preco: 397, base: 12000 },
  pais: { label: 'Brasil', preco: 1497, base: 150000 },
};
const EXTRAS = [
  ['emails', 'Busca profunda de e-mails', 'Visita páginas de contato e “sobre” de cada site', 0.25],
  ['socials', 'Instagram e LinkedIn', 'Perfis sociais de cada empresa', 0.15],
  ['roteiro', 'Kit de abordagem do nicho', 'Roteiro de ligação + 3 modelos de e-mail', 47],
  ['crm', 'Envio direto para CRM', 'RD Station, Pipedrive ou HubSpot', 67],
];

const st = { step: 0, nicho: null, custom: '', escopo: new URLSearchParams(location.search).get('escopo') || 'cidade',
  cidade: '', estado: 'SP', extras: new Set(['emails']), pay: 'pix', email: '', nome: '' };
const STEPS = ['Nicho', 'Região', 'Extras', 'Pagamento'];

const nichoMult = () => st.nicho ? st.nicho[3] : (st.custom ? .6 : 0);
const regiaoOk = () => st.escopo === 'pais' || (st.escopo === 'estado' && st.estado) || (st.escopo === 'cidade' && st.cidade.length > 2);
const estimate = () => (nichoMult() && regiaoOk()) ? ESCOPO[st.escopo].base * nichoMult() : 0;
function total() {
  const base = ESCOPO[st.escopo].preco;
  let t = base;
  EXTRAS.forEach(([k, , , v]) => { if (st.extras.has(k)) t += v < 1 ? Math.round(base * v) : v; });
  return st.pay === 'pix' ? Math.round(t * .95) : t;
}

function summary() {
  $('#sNicho').textContent = st.nicho ? st.nicho[1] : (st.custom || '—');
  $('#sRegiao').textContent = !regiaoOk() ? '—' : st.escopo === 'pais' ? 'Brasil inteiro' : st.escopo === 'estado' ? 'Estado de ' + st.estado : st.cidade;
  $('#sExtras').textContent = st.extras.size ? [...st.extras].map(k => EXTRAS.find(e => e[0] === k)[1].split(' ')[0]).join(', ') : 'Nenhum';
  const e = estimate();
  animateNum($('#sEst'), e, v => '~' + fmt(v));
  $('#sEstSub').textContent = e ? `empresas · ~${fmt(e * .4)} com WhatsApp` : 'escolha nicho e região';
  $('#sMeter').style.width = Math.min(100, e / 1500) + (e ? 8 : 0) + '%';
  animateNum($('#sTotal'), total(), v => brl(Math.round(v)));
}
function animateNum(el, to, f) {
  const from = +(el.dataset.v || 0); el.dataset.v = to;
  const t0 = performance.now();
  (function tick(t) { const p = Math.min(1, (t - t0) / 500), e = 1 - Math.pow(1 - p, 3);
    el.textContent = f(from + (to - from) * e); if (p < 1) requestAnimationFrame(tick); })(t0);
}

function progress() {
  $('#progress').innerHTML = STEPS.map((_, i) => `<div class="p ${i <= st.step ? 'done' : ''}"></div>`).join('');
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }

const views = {
  0() {
    return `<div class="panel">
      <div class="step-label">Passo 1 de 4</div>
      <h2>Quem você quer como <span class="grad-text">cliente</span>?</h2>
      <p>Escolha um nicho ou digite o seu.</p>
      <div class="search">🔎<input id="q" placeholder="Buscar ou digitar um nicho (ex.: clínicas veterinárias)" value="${st.custom}"></div>
      <div class="niches" id="niches"></div>
      <div class="nav-btns"><span></span><button class="btn btn-primary" id="next">Continuar →</button></div></div>`;
  },
  1() {
    return `<div class="panel">
      <div class="step-label">Passo 2 de 4</div>
      <h2>Onde estão esses <span class="grad-text">clientes</span>?</h2>
      <p>Quanto maior a região, mais leads — o preço continua sendo único.</p>
      <div class="scope-tabs">${Object.entries(ESCOPO).map(([k, v]) => `<button data-s="${k}" class="${st.escopo === k ? 'on' : ''}">${v.label} · ${brl(v.preco)}</button>`).join('')}</div>
      <div id="regiao"></div>
      <div class="nav-btns"><button class="btn btn-ghost" id="back">← Voltar</button><button class="btn btn-primary" id="next">Continuar →</button></div></div>`;
  },
  2() {
    return `<div class="panel">
      <div class="step-label">Passo 3 de 4</div>
      <h2>Turbine sua <span class="grad-text">lista</span></h2>
      <p>Opcional. Já incluso em todos: telefone, WhatsApp, site, avaliação e prioridade A/B/C.</p>
      <div class="opts">${EXTRAS.map(([k, t, d, v]) => `<label class="opt"><input type="checkbox" data-x="${k}" ${st.extras.has(k) ? 'checked' : ''}>
        <div><b>${t}</b><small>${d}</small></div><span class="plus">+ ${v < 1 ? brl(Math.round(ESCOPO[st.escopo].preco * v)) : brl(v)}</span></label>`).join('')}</div>
      <div class="nav-btns"><button class="btn btn-ghost" id="back">← Voltar</button><button class="btn btn-primary" id="next">Ir para pagamento →</button></div></div>`;
  },
  3() {
    return `<div class="panel">
      <div class="step-label">Passo 4 de 4</div>
      <h2>Falta <span class="grad-text">pouco</span>.</h2>
      <p>A lista fica na sua área de trabalho assim que ficar pronta.</p>
      <div class="opt" style="cursor:default;margin-bottom:18px" id="conta"><span style="font-size:22px">👤</span><div><b>Verificando sua conta…</b></div></div>
      <div class="pay-methods">${[['pix', '⚡ Pix'], ['card', '💳 Cartão'], ['boleto', '🧾 Boleto']].map(([k, l]) => `<button class="pm ${st.pay === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('')}</div>
      <div id="payBox"></div>
      <div class="nav-btns"><button class="btn btn-ghost" id="back">← Voltar</button><button class="btn btn-primary btn-lg" id="pay">Pagar ${brl(total())} →</button></div></div>`;
  },
};

function render() {
  progress(); summary();
  $('#view').innerHTML = views[st.step]();
  bind[st.step]();
  scrollTo({ top: 0, behavior: 'smooth' });
}
function go(d) { st.step += d; render(); }

const bind = {
  0() {
    const draw = () => {
      const q = st.custom.toLowerCase();
      const list = NICHOS.filter(n => !q || n[1].toLowerCase().includes(q) || n[2].toLowerCase().includes(q));
      $('#niches').innerHTML = list.map(n => `<button class="niche ${st.nicho === n ? 'sel' : ''}" data-n="${NICHOS.indexOf(n)}"><span class="ic">${n[0]}</span><b>${n[1]}</b><small>${n[2]}</small></button>`).join('')
        + (q && !list.length ? `<button class="niche sel"><span class="ic">✨</span><b>${st.custom}</b><small>Nicho personalizado</small></button>` : '');
      document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { st.nicho = NICHOS[b.dataset.n]; draw(); summary(); });
    };
    $('#q').oninput = e => { st.custom = e.target.value; if (st.custom) st.nicho = null; draw(); summary(); };
    draw();
    $('#next').onclick = () => (st.nicho || st.custom.trim().length > 2) ? go(1) : toast('Escolha um nicho para continuar');
  },
  1() {
    const draw = () => {
      const r = $('#regiao');
      if (st.escopo === 'cidade') r.innerHTML = `<div class="field"><label>Cidade</label><input class="input" id="cid" list="cl" value="${st.cidade}" placeholder="Ex.: Campinas, SP"><datalist id="cl">${CIDADES_POP.map(c => `<option>${c}</option>`).join('')}</datalist></div>
        <div class="chips">${CIDADES_POP.slice(0, 6).map(c => `<button class="chip ${st.cidade === c ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>`;
      else if (st.escopo === 'estado') r.innerHTML = `<div class="field"><label>Estado</label></div><div class="chips">${ESTADOS.map(u => `<button class="chip ${st.estado === u ? 'on' : ''}" data-u="${u}">${u}</button>`).join('')}</div>`;
      else r.innerHTML = `<div class="opt" style="cursor:default"><span style="font-size:28px">🇧🇷</span><div><b>Brasil inteiro — 27 estados</b><small>Entregue segmentado por estado e cidade. Prazo de até 48 h.</small></div></div>`;
      const c = $('#cid'); if (c) c.oninput = e => { st.cidade = e.target.value; summary(); };
      document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st.cidade = b.dataset.c; draw(); summary(); });
      document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { st.estado = b.dataset.u; draw(); summary(); });
    };
    document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      st.escopo = b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); draw(); summary(); });
    draw();
    $('#back').onclick = () => go(-1);
    $('#next').onclick = () => regiaoOk() ? go(1) : toast('Informe a cidade');
  },
  2() {
    document.querySelectorAll('[data-x]').forEach(c => c.onchange = () => { c.checked ? st.extras.add(c.dataset.x) : st.extras.delete(c.dataset.x); summary(); });
    $('#back').onclick = () => go(-1); $('#next').onclick = () => go(1);
  },
  3() {
    const box = () => {
      $('#payBox').innerHTML = st.pay === 'pix'
        ? `<div class="pix-box"><div class="qr"><div>${qr()}</div></div><div><b>Pix com aprovação na hora</b><p style="color:var(--muted);font-size:14px;margin:6px 0 12px">O QR Code real é gerado ao confirmar. A prospecção começa assim que o pagamento cair.</p><span class="chip on">5% de desconto no Pix</span></div></div>`
        : st.pay === 'card'
        ? `<div class="opt" style="cursor:default"><span style="font-size:24px">💳</span><div><b>Cartão em até 12x</b><small>Você digita os dados do cartão no ambiente seguro do Mercado Pago. Nada passa pelos nossos servidores.</small></div></div>`
        : `<div class="opt" style="cursor:default"><span style="font-size:24px">🧾</span><div><b>Boleto bancário</b><small>Compensação em até 2 dias úteis. A prospecção começa após a confirmação.</small></div></div>`;
    };
    document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { st.pay = b.dataset.p; document.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); box(); summary(); $('#pay').textContent = `Pagar ${brl(total())} →`; });
    Prospex.me().then(u => {
      st.logado = !!u;
      $('#conta').innerHTML = u ? `<span style="font-size:22px">👤</span><div><b>${u.nome}</b><small>${u.email} · a lista vai para esta conta</small></div>`
        : `<span style="font-size:22px">👤</span><div><b>Crie sua conta para pagar</b><small>Leva 20 segundos — é nela que você recebe e trabalha os leads.</small></div>`;
      if (!u) $('#pay').textContent = 'Criar conta e pagar →';
    });
    box();
    $('#back').onclick = () => go(-1);
    $('#pay').onclick = checkout;
  },
};

function qr() {
  let s = ''; let seed = 7;
  for (let i = 0; i < 441; i++) { const x = i % 21, y = i / 21 | 0;
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    let on; if (finder) { const fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y; on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5); }
    else { seed = (seed * 9301 + 49297) % 233280; on = seed / 233280 > .5; }
    s += `<i class="${on ? '' : 'w'}"></i>`; }
  return s;
}

// ---------- checkout real ----------
const salvar = () => { try { sessionStorage.setItem('prospex_pedido', JSON.stringify({ ...st, extras: [...st.extras], nicho: st.nicho ? st.nicho[1] : null })); } catch (e) {} };
function restaurar() {
  try { const d = JSON.parse(sessionStorage.getItem('prospex_pedido')); if (!d) return;
    Object.assign(st, d, { extras: new Set(d.extras), nicho: NICHOS.find(n => n[1] === d.nicho) || null, step: 3 }); } catch (e) {}
}
async function checkout() {
  if (!st.logado) { salvar(); location.href = 'login.html?next=app#signup'; return; }
  const btn = $('#pay'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  const body = { nicho: st.nicho ? st.nicho[1] : st.custom.trim(), escopo: st.escopo, extras: [...st.extras], metodo: st.pay,
    regiao: st.escopo === 'cidade' ? st.cidade : st.escopo === 'estado' ? st.estado : '' };
  try {
    const j = await Prospex.criarPedido(body);
    try { sessionStorage.removeItem('prospex_pedido'); } catch (e) {}
    const pg = j.pagamento;
    if (pg.checkout_url) { location.href = pg.checkout_url; return; }
    if (pg.pix_copia_cola) return aguardarPix(j.order, pg);
    processing(j.order);
  } catch (e) { toast(e.message); btn.disabled = false; btn.textContent = `Pagar ${brl(total())} →`; }
}
function aguardarPix(order, pg) {
  $('#payBox').innerHTML = `<div class="pix-box">${pg.pix_qr ? `<img class="qr" src="data:image/png;base64,${pg.pix_qr}" alt="QR Code Pix">` : ''}
    <div><b>Escaneie o QR Code ou copie o código</b><p style="color:var(--muted);font-size:13px;margin:6px 0 12px;word-break:break-all">${pg.pix_copia_cola.slice(0, 60)}…</p>
    <button class="btn btn-ghost" id="copiar">Copiar código Pix</button><p style="color:var(--muted);font-size:13px;margin-top:10px">⏳ Aguardando pagamento…</p></div></div>`;
  $('#copiar').onclick = () => navigator.clipboard.writeText(pg.pix_copia_cola).then(() => toast('Código copiado'));
  $('#pay').style.display = 'none';
  const t = setInterval(async () => {
    const o = await Prospex.pedido(order.id);
    if (o.status !== 'aguardando_pagamento') { clearInterval(t); processing(o); }
  }, 3000);
}

function processing(order) {
  $('#summary').style.display = 'none'; $('#shell').style.gridTemplateColumns = '1fr';
  $('#progress').innerHTML = STEPS.map(() => '<div class="p done"></div>').join('');
  confetti();
  const regiao = order.escopo === 'estado' ? 'Estado de ' + order.regiao : order.regiao;
  $('#view').innerHTML = `<div class="panel processing"><div class="orb"></div>
    <div class="step-label">Pagamento aprovado ✓</div>
    <h2>Caçando <span class="grad-text">${order.nicho.toLowerCase()}</span><br>em ${regiao}</h2>
    <p style="color:var(--muted)">Pode fechar esta página — a lista aparece na sua área quando terminar.</p>
    <div style="font-family:var(--display);font-size:56px;font-weight:700;letter-spacing:-2px;margin-top:20px" class="grad-text" id="pc">0%</div>
    <div class="log" id="log"></div>
    <a href="workspace.html#prospeccoes" class="btn btn-ghost" style="margin-top:20px">Ir para minha área →</a></div>`;
  const msgs = [[2, 'Pedido na fila de processamento'], [5, 'Mapeando a região e buscando no Google Maps…'], [40, 'Removendo duplicados e empresas fechadas…'],
    [60, 'Visitando sites para encontrar e-mails e redes…'], [85, 'Calculando prioridade A/B/C…'], [100, 'Lista pronta!']];
  let shown = 0;
  const t = setInterval(async () => {
    const o = await Prospex.pedido(order.id);
    $('#pc').textContent = (o.progresso || 0) + '%';
    while (shown < msgs.length && (o.progresso || 0) >= msgs[shown][0]) $('#log').insertAdjacentHTML('beforeend', `<div><b>✓</b> ${msgs[shown++][1]}</div>`);
    if (o.status === 'pronta') { clearInterval(t); setTimeout(() => location.href = 'workspace.html#prospeccoes', 1200); }
    if (o.status === 'erro') { clearInterval(t); $('#log').insertAdjacentHTML('beforeend', `<div style="color:var(--pink)">✕ ${o.erro || 'Falha na busca'} — nossa equipe foi avisada.</div>`); }
  }, 2000);
}

function confetti() {
  const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#C6FF3D', '#33E1FF', '#7B5CFF', '#FF4FB8'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 4, s: Math.random() * 6 + 3, c: cols[Math.random() * 4 | 0], r: Math.random() * 6 }));
  let f = 0;
  (function loop() { x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
    if (++f < 150) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height); })();
}

if (location.hash === '#pagar') restaurar();
render();
