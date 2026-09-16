/**
 * Tipo do item de património (Técnica, Louvor — inventário em modo
 * património). Opcional em cada equipamento; serve o Relatório do
 * Financeiro para somar "quanto temos em quê" entre as duas bases,
 * em vez de só "quanto tem cada base" (ver valorCompra,
 * criarEquipamento/guardarEquipamento em functions/index.js).
 */
export const TIPOS_PATRIMONIO = [
  ["equipamento", "Equipamento técnico"],
  ["instrumento", "Instrumento musical"],
  ["mobiliario", "Mobiliário"],
  ["outro", "Outro"],
];

export const ROTULO_TIPO_PATRIMONIO = Object.fromEntries(TIPOS_PATRIMONIO);
