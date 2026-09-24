/**
 * "Presença na igreja" de um culto — auditório + voluntários +
 * crianças, com os visitantes à parte. Um sítio só para esta conta:
 * Números (o gráfico e os cartões) e o Mapa de Calor mostravam cada um
 * a sua versão, e duas "Presença na igreja" diferentes no mesmo painel
 * foi exatamente o que já foi reportado como bug (2026-09).
 *
 * DE ONDE VEM CADA PARTE — decisão do dono do produto, 2026-09:
 *
 * - **Auditório e visitantes: do MAPA a partir de `MAPA_DESDE`** (o
 *   primeiro culto depois do pedido — "coloca para pegar do MAPA a
 *   partir do próximo culto"). Até lá, da Contagem da Base Pessoal:
 *   auditório = `mensagem` ("pessoas presentes durante a mensagem"),
 *   visitantes = `visitantes`. Nos domingos antigos o mapa ainda
 *   estava a ser adotado e ficava muito abaixo da contagem à mão
 *   (13/9: 112 lugares marcados contra 129 contados) — trocar a fonte
 *   para trás fazia esses domingos parecerem fracos sem o serem.
 *   **Sem mistura dentro de um domingo e sem recurso à outra fonte**:
 *   um domingo sem a fonte do seu período fica de fora do gráfico, em
 *   vez de aparecer com um número de outro sistema a fingir que é
 *   comparável.
 * - **Voluntários: as escalas publicadas das dez bases** (`c.voluntarios`,
 *   somado em `historicoPastoral`) — nunca a categoria "voluntários"
 *   digitada na Contagem.
 * - **Crianças: as salas da Contagem** (Baby/Fun/Júnior da Kinder,
 *   SHIFT, New) — o contador no Início de cada uma dessas bases grava
 *   lá (`registarContagemSala`). `juniorFun` é a categoria antiga,
 *   de antes de Júnior e Fun se separarem (dados até 13/9).
 *
 * No mapa, o auditório é TODA a gente sentada: lugares marcados
 * (ocupados + visitantes) e também os reservados/bloqueados — quem
 * está num lugar reservado está na igreja na mesma (pedido 2026-09).
 * Um mapa sem nenhum lugar marcado conta como "não há mapa" — só os
 * reservados fixos (A1–A4) não são um domingo com quatro pessoas.
 */
export const MAPA_DESDE = "2026-09-27";
/** O último domingo contado pela Contagem — só para o texto do ecrã. */
export const CONTAGEM_ATE = "2026-09-20";

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
  const fonte = c.data >= MAPA_DESDE ? "mapa" : "contagem";
  let auditorio = null;
  let visitantes = null;
  if (fonte === "mapa") {
    const a = c.acomodacao;
    if (a && a.ocupados + a.visitantes > 0) {
      auditorio = a.ocupados + a.visitantes + a.reservados + a.bloqueados;
      visitantes = a.visitantes;
    }
  } else {
    auditorio = num(c.contagem?.mensagem);
    visitantes = num(c.contagem?.visitantes);
  }
  const voluntarios = c.voluntarios ?? 0;
  const criancas = criancasDoCulto(c);
  const total = auditorio === null ? null : auditorio + voluntarios + (criancas ?? 0);
  return { auditorio, visitantes, voluntarios, criancas, total, fonte };
}

/** Ocupação do auditório: PESSOAS no auditório / CAPACIDADE do
 *  auditório (todos os lugares, reservados incluídos). Pedido 2026-09:
 *  "tem de ser o número de pessoas no auditório / lugares no auditório"
 *  — antes era `percentagem` do resumo do mapa (lugares marcados sobre
 *  a capacidade ÚTIL, sem reservados), que em 6/9 dava 64% com 130
 *  pessoas em 144 lugares. As pessoas são o MESMO número do auditório
 *  da "Presença na igreja" (`presencaDoCulto`), para os dois ecrãs
 *  nunca discordarem; sem esse número, as do mapa. Pode passar de 100%
 *  (gente de pé) — é informação, não erro. */
export function ocupacaoDoCulto(c) {
  const a = c.acomodacao;
  if (!a) return null;
  const lugares = a.capacidadeUtil + a.reservados + a.bloqueados;
  const doMapa = a.ocupados + a.visitantes + a.reservados + a.bloqueados;
  const pessoas = presencaDoCulto(c).auditorio ?? doMapa;
  return { pessoas, lugares, pct: lugares ? pessoas / lugares : 0 };
}

export const media = (vals) => {
  const v = vals.filter((n) => typeof n === "number");
  return v.length ? Math.round(v.reduce((t, n) => t + n, 0) / v.length) : null;
};
