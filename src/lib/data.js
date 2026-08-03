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

/** "2026-08-02" → "02 ago" — para cabeçalhos estreitos (tabela da escala) */
export function dataCurta(iso) {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1].slice(0, 3).toLowerCase()}`;
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Líder de escala primeiro, depois o resto — sem repetir ninguém. */
export const ordenarEscala = (escala) =>
  [escala.liderEscala, ...escala.pessoas.filter((id) => id !== escala.liderEscala)].filter(Boolean);
