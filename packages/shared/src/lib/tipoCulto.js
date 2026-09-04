/**
 * Tipo do culto (Ceia/Contribua/Culto da Família) — global
 * (`eventos/{eventoId}.tipoCulto`), escrito só pela Backstage ao
 * publicar a Ordem do Culto (`publicarOrdemCulto`, obrigatório —
 * ver functions/index.js), lido por qualquer base. Era um campo só
 * da Louvor (`eventos/{e}/escalas/louvor.enfase`) até 2026-09, movido
 * para aqui a pedido do líder da Louvor para ter um dono só.
 *
 * `tipoCultoDefault` é só uma sugestão para quando ainda não há
 * `tipoCulto` gravado nenhum (a Backstage ainda não publicou a Ordem
 * deste culto) — nunca grava sozinho, cada base decide se mostra.
 */
export const TIPOS_CULTO = [
  { id: "ceia", nome: "Ceia" },
  { id: "contribua", nome: "Contribua" },
  { id: "familia", nome: "Culto da Família" },
];
export const nomeTipoCulto = (id) => TIPOS_CULTO.find((t) => t.id === id)?.nome ?? id;
export const tipoCultoDefault = (dataISO) => (Number(dataISO.slice(8, 10)) <= 7 ? "ceia" : "familia");
