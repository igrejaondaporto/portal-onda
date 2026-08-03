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
