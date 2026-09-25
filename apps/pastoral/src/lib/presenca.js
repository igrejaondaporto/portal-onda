/**
 * "Presença na igreja" de um culto — auditório + voluntários +
 * crianças, com os visitantes à parte. Um sítio só para esta conta:
 * Números (o gráfico e os cartões) e o Mapa de Calor mostravam cada um
 * a sua versão, e duas "Presença na igreja" diferentes no mesmo painel
 * foi exatamente o que já foi reportado como bug (2026-09).
 *
 * DE ONDE VEM CADA PARTE — decisão do dono do produto, 2026-09:
 *
 * - **Auditório e visitantes: do MAPA da Base Pessoal, em todos os
 *   domingos.** Pessoas no auditório = lugares OCUPADOS + VISITANTES
 *   marcados ("são 85 ocupados + 5 visitantes, e só" — os reservados e
 *   bloqueados não entram). Já foi a Contagem manual (`mensagem`) até
 *   20/9 e o mapa só a partir de 27/9, e o mapa com os reservados
 *   somados — as duas coisas foram desfeitas a pedido. Um mapa sem
 *   nenhum lugar marcado conta como "não há mapa" (fica de fora do
 *   gráfico), nunca como zero.
 * - **Voluntários: as escalas publicadas das dez bases** (`c.voluntarios`,
 *   somado em `historicoPastoral`) — nunca a categoria "voluntários"
 *   digitada na Contagem.
 * - **Crianças: as salas da Contagem** (Baby/Fun/Júnior da Kinder,
 *   SHIFT, New) — o contador no Início de cada uma dessas bases grava
 *   lá (`registarContagemSala`).
 */

/** As cinco salas. O `juniorFun` antigo (Júnior e Fun contados juntos,
 *  até 13/9) já não entra em conta nenhuma — pedido 2026-09: "pode
 *  tirar o campo junto, na Contagem já coloquei os dados separados". */
export const SALAS_CRIANCAS = ["baby", "fun", "junior", "shift", "new"];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function criancasDoCulto(c) {
  const vals = SALAS_CRIANCAS.map((s) => num(c.contagem?.[s])).filter((v) => v !== null);
  return vals.length ? vals.reduce((t, n) => t + n, 0) : null;
}

/** `{ auditorio, visitantes, voluntarios, criancas, total, fonte }`.
 *  `auditorio`/`visitantes`/`criancas` são `null` quando não se sabe
 *  (≠ zero); `total` só existe quando o auditório existe — é a maior
 *  parte, e um total sem ela seria um domingo "fraco" que não foi. */
export function presencaDoCulto(c) {
  const a = c.acomodacao;
  const pessoasMapa = a ? a.ocupados + a.visitantes : 0;
  const auditorio = pessoasMapa > 0 ? pessoasMapa : null;
  const visitantes = auditorio === null ? null : a.visitantes;
  const voluntarios = c.voluntarios ?? 0;
  const criancas = criancasDoCulto(c);
  const total = auditorio === null ? null : auditorio + voluntarios + (criancas ?? 0);
  return { auditorio, visitantes, voluntarios, criancas, total, fonte: "mapa" };
}

/** Ocupação do auditório: pessoas no auditório (ocupados +
 *  visitantes, do mapa) / capacidade do auditório (os lugares úteis —
 *  sem os reservados e os bloqueados). Pedido 2026-09: "Pessoas no
 *  auditório: 90 de 144". As pessoas são o MESMO número do auditório
 *  da "Presença na igreja" (`presencaDoCulto`). */
export function ocupacaoDoCulto(c) {
  const a = c.acomodacao;
  if (!a) return null;
  const pessoas = a.ocupados + a.visitantes;
  const lugares = a.capacidadeUtil;
  return { pessoas, lugares, pct: lugares ? pessoas / lugares : 0 };
}

/** O Mapa só passou a marcar o apelo (manter o dedo) a 24/9/2026 —
 *  o primeiro domingo com ele é 27/9. Antes disso o número do apelo
 *  só existe na Contagem manual (categoria `apelo`). */
export const APELO_MAPA_DESDE = "2026-09-27";

/** Quantas pessoas responderam ao apelo neste culto, ou `null` (não
 *  se sabe — nunca zero inventado). Do Mapa a partir de
 *  `APELO_MAPA_DESDE`; antes, da Contagem manual. Um culto nunca
 *  mistura as duas. */
export function apeloDoCulto(c) {
  if (c.data >= APELO_MAPA_DESDE) {
    const a = c.acomodacao;
    return a && a.ocupados + a.visitantes > 0 ? num(a.apelo) : null;
  }
  return num(c.contagem?.apelo);
}

export const media = (vals) => {
  const v = vals.filter((n) => typeof n === "number");
  return v.length ? Math.round(v.reduce((t, n) => t + n, 0) / v.length) : null;
};
