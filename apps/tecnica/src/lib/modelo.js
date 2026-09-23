/**
 * Caminhos do Firestore, num sítio só.
 * Multi-base desde o dia 1: replicar para a Base Técnica é criar
 * um documento em /bases, não reescrever o sistema.
 *
 *   bases/{base}
 *   bases/{base}/pessoas/{pessoa}
 *   bases/{base}/pessoas/{pessoa}/privado/auth      ← hash do PIN, ilegível
 *   bases/{base}/funcoes/{funcao}                    ← eventoId=null → catálogo
 *   bases/{base}/inventario/{item}/movimentos/{mov}
 *   bases/{base}/reembolsos/{r}
 *   eventos/{AAAA-MM-DD}                             ← global, a igreja toda
 *   eventos/{e}/escalas/{base}                       ← pessoas[] + liderEscala
 *   eventos/{e}/atribuicoes/{funcao}                 ← pessoas[]
 *   eventos/{e}/checklist/{funcao}                   ← feito por quem, a que horas
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase        = () => doc(db, "bases", BASE_ID);
export const cPessoas     = () => collection(db, `bases/${BASE_ID}/pessoas`);
export const cFuncoes     = () => collection(db, `bases/${BASE_ID}/funcoes`);
export const cMinisterios = () => collection(db, `bases/${BASE_ID}/ministerios`);
export const cWiki         = () => collection(db, `bases/${BASE_ID}/wiki`);
export const cRespostasWiki = (wikiId) => collection(db, `bases/${BASE_ID}/wiki/${wikiId}/respostas`);
export const cWikiIndiceDoc = () => doc(db, "wikiIndice", BASE_ID);
export const cInventario  = () => collection(db, `bases/${BASE_ID}/inventario`); // equipamentos, modo património
export const cMelhorias   = () => collection(db, `bases/${BASE_ID}/melhorias`);
export const cEventosMelhoria = (melhoriaId) => collection(db, `bases/${BASE_ID}/melhorias/${melhoriaId}/eventos`);
export const cReembolsos  = () => collection(db, `bases/${BASE_ID}/reembolsos`);
export const cEnquetes    = () => collection(db, `bases/${BASE_ID}/enquetes`);
export const cRespostasEnquete = (mes) => collection(db, `bases/${BASE_ID}/enquetes/${mes}/respostas`);
export const cEventos     = () => collection(db, "eventos");
export const cEscala      = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);
export const cAtribuicoes = (ev) => collection(db, `eventos/${ev}/atribuicoes`);
export const cChecklist   = (ev) => collection(db, `eventos/${ev}/checklist`);

export const FASES = [
  ["pre",     "Pré-culto",      "Antes de abrir as portas"],
  ["durante", "Durante o culto", "A partir das 10:30"],
  ["pos",     "Pós-culto",      "Depois de todos saírem"],
];

/** Uma função entra num culto se for do catálogo ou se for dele. */
export const funcoesDoCulto = (funcoes, eventoId) =>
  funcoes.filter((f) => !f.eventoId || f.eventoId === eventoId);

/** A regra do líder de escala, replicada no cliente só para esconder botões.
 *  A que conta é a da Cloud Function atribuirFuncao. */
export const podeDistribuir = (papel, uid, escala) =>
  papel === "lider_base" || escala?.liderEscala === uid;

/** O(s) lugar(es) em que a pessoa serve naquele culto — titular ou
 *  aprendiz. Normalmente um só; a regra de "uma pessoa, um ministério
 *  por culto" já é validada em guardarEscalaTecnica. */
export const meusLugares = (escala, uid) =>
  (escala?.lugares || []).filter((l) => l.titularId === uid || l.aprendizId === uid);

/** A checklist do líder da base não é de um ministério — é do papel.
 *  Guarda-se em `funcoes` como as outras, com este `ministerioId`
 *  reservado, para não ter de existir um ministério "Líder" a poluir
 *  a tabela da escala e o seletor de quem serve. */
export const MINISTERIO_LIDER_BASE = "lider_base";

/** Funções (itens da checklist) dos ministérios em que a pessoa serve
 *  naquele culto — é o que substitui "todas as funções" na Técnica.
 *  O líder da base recebe ainda a checklist do papel dele, sirva ou
 *  não nesse domingo: as tarefas dele são de preparar a semana, não
 *  de estar na cabine. */
export const funcoesDosMeusMinisterios = (funcoes, eventoId, escala, uid, souLiderBase = false, ministerioFingido = undefined) => {
  const doCulto = funcoesDoCulto(funcoes, eventoId);
  // "ver como voluntário da Projeção": o ministério passa a vir da
  // escolha do líder, não da escala. `null` é uma escolha válida —
  // "sem ministério", o painel de quem não serve nesse domingo — e por
  // isso o desligado é `undefined`, nunca um valor falsy qualquer.
  if (ministerioFingido !== undefined) {
    return ministerioFingido ? doCulto.filter((f) => f.ministerioId === ministerioFingido) : [];
  }
  return doCulto.filter((f) =>
    (souLiderBase && f.ministerioId === MINISTERIO_LIDER_BASE)
    || meusLugares(escala, uid).some((l) => l.ministerioId === f.ministerioId));
};
