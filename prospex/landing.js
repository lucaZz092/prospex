const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('pt-BR');

// cursor glow
const glow = $('#glow');
addEventListener('pointermove', e => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; });

// nav border on scroll
addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 10));

// typing rotator
const words = ['clínicas', 'escritórios', 'imobiliárias', 'oficinas', 'academias', 'distribuidoras', 'construtoras'];
let wi = 0, ci = words[0].length, del = true;
const rot = $('#rotator');
(function type() {
  const w = words[wi];
  ci += del ? -1 : 1;
  rot.textContent = w.slice(0, ci);
  let d = del ? 45 : 85;
  if (!del && ci === w.length) { del = true; d = 1800; }
  else if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; d = 250; }
  setTimeout(type, d);
})();

// live counter
let live = 1284392;
setInterval(() => { live += Math.floor(Math.random() * 9) + 1; $('#liveCount').textContent = fmt(live); }, 700);

// marquee
const niches = ['Clínicas médicas', 'Odontologia', 'Contabilidade', 'Advocacia', 'Transportadoras', 'Imobiliárias', 'Oficinas', 'Academias', 'Escolas de idiomas', 'Construtoras', 'Indústrias', 'Restaurantes', 'Pet shops', 'Salões de beleza', 'Estética'];
$('#marquee').innerHTML = [...niches, ...niches].map(n => `<span>${n}</span>`).join('');

// radar pings + floating lead cards
const radar = $('#radar'), wrap = $('#radarWrap');
const sample = [
  ['Clínica Bem Estar', 'Saúde', '★ 4,9', 'WhatsApp'], ['Contábil Prisma', 'Contábil', '★ 4,8', 'E-mail'],
  ['Rota Express', 'Logística', '★ 4,6', 'WhatsApp'], ['Imob. Nova Casa', 'Imóveis', '★ 4,7', 'Telefone'],
  ['Studio Fit 24h', 'Academia', '★ 4,9', 'Instagram'], ['Auto Center Prime', 'Oficina', '★ 4,5', 'WhatsApp'],
  ['Odonto Sorriso', 'Saúde', '★ 5,0', 'E-mail'], ['Construtora Alicerce', 'Obras', '★ 4,4', 'Telefone'],
];
let si = 0, cards = [];
function ping() {
  const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 34;
  const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
  const p = document.createElement('div');
  p.className = 'ping ' + ['', 'v', 'c'][Math.floor(Math.random() * 3)];
  p.style.left = x + '%'; p.style.top = y + '%';
  radar.appendChild(p);
  setTimeout(() => p.remove(), 5000);
}
function card() {
  const [n, t, s, c] = sample[si++ % sample.length];
  const el = document.createElement('div');
  el.className = 'lead-card';
  const pos = [[-6, 8], [58, 18], [-2, 62], [56, 70]][cards.length % 4];
  el.style.left = pos[0] + '%'; el.style.top = pos[1] + '%';
  el.innerHTML = `<div class="t">${n}<span class="tag">A</span></div><div class="m"><span>${t}</span><span>${s}</span><span style="color:#3DDC84">${c}</span></div>`;
  wrap.appendChild(el); cards.push(el);
  if (cards.length > 3) { const o = cards.shift(); o.style.transition = '.4s'; o.style.opacity = 0; setTimeout(() => o.remove(), 400); }
}
setInterval(ping, 450); setInterval(card, 1900); card();

// reveal on scroll + counters
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count; let v = 0;
    const t = setInterval(() => { v += 2; el.textContent = Math.min(v, to) + '%'; if (v >= to) clearInterval(t); }, 20);
  });
  io.unobserve(e.target);
}), { threshold: .15 });
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });

// spotlight on bento tiles
document.querySelectorAll('.tile').forEach(t => t.addEventListener('pointermove', e => {
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', e.clientX - r.left + 'px'); t.style.setProperty('--my', e.clientY - r.top + 'px');
}));
