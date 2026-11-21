const $ = s => document.querySelector(s);

// nav border on scroll
addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 10), { passive: true });

// niche word swap (rests under reduced motion)
const words = ['clínicas', 'escritórios', 'imobiliárias', 'oficinas', 'academias', 'distribuidoras', 'construtoras'];
const rot = $('#rotator');
if (rot && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let wi = 0;
  setInterval(() => {
    rot.classList.add('out');
    setTimeout(() => { wi = (wi + 1) % words.length; rot.textContent = words[wi]; rot.classList.remove('out'); }, 300);
  }, 2800);
}

// niches strip
const niches = ['Clínicas médicas', 'Odontologia', 'Contabilidade', 'Advocacia', 'Transportadoras', 'Imobiliárias', 'Oficinas', 'Academias', 'Escolas de idiomas', 'Construtoras', 'Indústrias', 'Restaurantes', 'Pet shops', 'Salões de beleza', 'Estética'];
$('#marquee').innerHTML = [...niches, ...niches].map((n, i) => `<span${i >= niches.length ? ' aria-hidden="true"' : ''}>${n}</span>`).join('');
