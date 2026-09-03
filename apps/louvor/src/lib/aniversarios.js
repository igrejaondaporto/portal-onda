/**
 * Aniversário só mês+dia ("MM-DD", sem ano — minimização de dados,
 * nada aqui usa idade). Datas construídas com getters locais, nunca
 * toISOString/UTC — o mesmo desvio de fuso já causou bug de "um dia a
 * mais/a menos" noutra parte do projeto.
 */
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Dias até o próximo aniversário a partir de hoje — 0 se for hoje,
 *  vira para o ano seguinte se a data deste ano já passou. */
export function diasAte(mesDia, hoje = new Date()) {
  if (!mesDia) return null;
  const [mes, dia] = mesDia.split("-").map(Number);
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia);
  if (proximo < hojeSemHora) proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return Math.round((proximo - hojeSemHora) / 86400000);
}

export function dataCurtaAniversario(mesDia) {
  if (!mesDia) return "";
  const [mes, dia] = mesDia.split("-").map(Number);
  return `${dia} ${MESES_CURTOS[mes - 1]}`;
}

export function fraseDiasAte(dias) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `daqui a ${dias} dias`;
}
