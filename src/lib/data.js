export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-08-02" → "2 de agosto" */
export function dataPorExtenso(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${Number(d)} de ${MESES[m - 1].toLowerCase()}`;
}

export const nomeEvento = (ev) => (ev.tipo ? `${ev.tipo} · ${dataPorExtenso(ev.data)}` : dataPorExtenso(ev.data));

/** Nome completo se couber num cabeçalho de uma linha; senão só o
 *  primeiro nome, para o "Olá, ___" nunca quebrar para a linha de baixo. */
export const nomeCurto = (nome) => (!nome || nome.length <= 14 ? nome : nome.split(" ")[0]);

/** "2026-08-02" → "02 ago" — para cabeçalhos estreitos (tabela da escala) */
export function dataCurta(iso) {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1].slice(0, 3).toLowerCase()}`;
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Líder de escala primeiro, depois o resto — sem repetir ninguém. */
export const ordenarEscala = (escala) =>
  [escala.liderEscala, ...escala.pessoas.filter((id) => id !== escala.liderEscala)].filter(Boolean);

export const eur = (v) => v.toFixed(2).replace(".", ",") + " €";

/** "unidades" → "unidade" quando a quantidade é 1. As unidades do
 *  inventário são texto livre, por isso o singular é só tirar o "s". */
export const singularizar = (qtd, unidade) =>
  qtd === 1 && unidade?.endsWith("s") ? unidade.slice(0, -1) : unidade;

/** Timestamp do Firestore (ou null, logo a seguir a criar) → "3 ago". */
export function dataTimestamp(ts) {
  if (!ts?.toDate) return "agora";
  const d = ts.toDate();
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
}
