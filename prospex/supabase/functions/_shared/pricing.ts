// Preços calculados no servidor. Manter igual ao que o front exibe (app.js).
export const ESCOPO: Record<string, [number, number]> = { cidade: [9700, 900], estado: [39700, 12000], pais: [149700, 150000] };
export const EXTRAS: Record<string, number> = { emails: 0.25, socials: 0.15, roteiro: 4700, crm: 6700 }; // <1 = % do base
export const NICHO_MULT: Record<string, number> = {
  "Clínicas médicas": 1.0, "Odontologia": .9, "Estética": .8, "Contabilidade": .7, "Advocacia": .85, "Transportadoras": .5,
  "Distribuidoras": .45, "Construtoras": .55, "Indústrias": .4, "Imobiliárias": .75, "Oficinas mecânicas": .9, "Academias": .6,
  "Escolas de idiomas": .5, "Restaurantes": 1.2, "Pet shops": .7, "Salões de beleza": 1.1,
};
export const ESTADOS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

export function calcular(nicho: string, escopo: string, extras: string[], metodo: string) {
  const [base, leads] = ESCOPO[escopo];
  let total = base;
  for (const e of new Set(extras)) { const v = EXTRAS[e]; total += v < 1 ? Math.round(base * v) : v; }
  if (metodo === "pix") total = Math.round(total * 0.95);
  return { valor: total, estimativa: Math.round(leads * (NICHO_MULT[nicho] ?? 0.6)) };
}
