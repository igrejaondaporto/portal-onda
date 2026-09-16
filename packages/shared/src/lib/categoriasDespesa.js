/**
 * Categorias de despesa do reembolso — a mesma lista em qualquer
 * base, para o Financeiro conseguir somar "quanto gastámos em quê"
 * entre bases diferentes. Se um dia uma categoria nova fizer falta,
 * muda-se aqui uma vez só; nunca por base.
 */
export const CATEGORIAS_DESPESA = [
  ["limpeza", "Limpeza e manutenção"],
  ["equipamento", "Equipamento e material técnico"],
  ["alimentacao", "Alimentação e hospitalidade"],
  ["escritorio", "Material de escritório e impressão"],
  ["decoracao", "Decoração e eventos"],
  ["transporte", "Transporte"],
  ["outro", "Outro"],
];

export const ROTULO_CATEGORIA_DESPESA = Object.fromEntries(CATEGORIAS_DESPESA);
