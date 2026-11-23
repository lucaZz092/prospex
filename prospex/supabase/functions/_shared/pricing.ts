// Preços calculados no servidor. Manter igual ao que o front exibe (app.js) e à landing (index.html).
// [preço em centavos, leads no teto do plano]
export const ESCOPO: Record<string, [number, number]> = { cidade: [9700, 900], estado: [39700, 12000], pais: [149700, 150000] };
// E-mail e roteiro de abordagem vêm em todos os planos; redes sociais vêm no Estado e no Brasil.
// No plano Cidade, as redes sociais são o único extra: % do preço base.
export const EXTRAS: Record<string, number> = { socials: 0.15 };
export const PIX_DESCONTO = 0.05;
export const CLIENTE_DESCONTO = 0.20; // quem já recebeu uma lista paga
export const NICHO_MULT: Record<string, number> = {
  "Clínicas médicas": 1.0, "Odontologia": .9, "Estética": .8, "Contabilidade": .7, "Advocacia": .85, "Transportadoras": .5,
  "Distribuidoras": .45, "Construtoras": .55, "Indústrias": .4, "Imobiliárias": .75, "Oficinas mecânicas": .9, "Academias": .6,
  "Escolas de idiomas": .5, "Restaurantes": 1.0, "Pet shops": .7, "Salões de beleza": 1.0,
};
export const ESTADOS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

export function calcular(nicho: string, escopo: string, extras: string[], metodo: string, cliente: boolean) {
  const [base, leads] = ESCOPO[escopo];
  let total = base;
  if (escopo === "cidade") for (const e of new Set(extras)) total += Math.round(base * EXTRAS[e]);
  const cheio = total;
  if (cliente) total = Math.round(total * (1 - CLIENTE_DESCONTO));
  if (metodo === "pix") total = Math.round(total * (1 - PIX_DESCONTO));
  const mult = Math.min(1, NICHO_MULT[nicho] ?? 0.6);
  return { valor: total, desconto: cheio - total, estimativa: Math.round(leads * mult) };
}
