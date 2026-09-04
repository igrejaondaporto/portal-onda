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

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "2026-09-06" → "Dom" — sempre `new Date(ano, mes, dia)` local, nunca
 *  `new Date(iso)` direto (isso interpreta a string como UTC meia-noite
 *  e pode devolver o dia de semana errado em fusos negativos). */
export function diaSemanaAbrev(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Líder de escala primeiro, depois o resto — sem repetir ninguém. */
export const ordenarEscala = (escala) =>
  [escala.liderEscala, ...escala.pessoas.filter((id) => id !== escala.liderEscala)].filter(Boolean);

export const eur = (v) => v.toFixed(2).replace(".", ",") + " €";

/** "912 345 678" → "https://wa.me/351912345678". null se não houver número.
 *  Limpa espaços, traços e parênteses, e junta o indicativo se faltar.
 *  `texto` opcional pré-preenche a mensagem (ex.: enviar um contacto
 *  já formatado, sem a pessoa ter de escrever nada). */
export function linkWhatsApp(telefone, texto) {
  if (!telefone?.trim()) return null;
  let n = telefone.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (!n.startsWith("351")) n = "351" + n;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

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

/** Timestamp do Firestore → "agora" / "há 2h" / "há 3 dias" / a data,
 *  passado uma semana. É duração (agora − então), não calendário —
 *  não tem o problema de fuso do resto deste ficheiro. */
export function haAtras(ts) {
  if (!ts?.toDate) return "agora";
  const ms = Date.now() - ts.toDate().getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.round(h / 24);
  if (dias < 7) return `há ${dias} dia${dias === 1 ? "" : "s"}`;
  return dataTimestamp(ts);
}

/** Concordância de género — `pessoa.genero` é "f"/"m", opcional (ver
 *  `bases/{b}/pessoas/{uid}.genero`). Sem género definido, mantém a
 *  forma masculina — é o que a interface já mostrava antes de o campo
 *  existir, para ninguém que ainda não preencheu isto ver a app mudar
 *  de repente. */
export const concordar = (pessoa, masculino, feminino) =>
  pessoa?.genero === "f" ? feminino : masculino;
