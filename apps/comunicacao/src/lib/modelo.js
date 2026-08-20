/**
 * Caminhos do Firestore, num sítio só.
 * Multi-base desde o dia 1: replicar para uma base nova é criar
 * um documento em /bases, não reescrever o sistema.
 *
 *   bases/{base}
 *   bases/{base}/pessoas/{pessoa}
 *   bases/{base}/pessoas/{pessoa}/privado/auth      ← hash do PIN, ilegível
 *   bases/{base}/funcoes/{funcao}                    ← eventoId=null → catálogo
 *   bases/{base}/ministerios/{ministerio}
 *   bases/{base}/equipamentos/{item}/historico/{h}   ← custódia, não stock (ver CLAUDE.md desta base)
 *   bases/{base}/wiki/{id}/respostas/{id}            ← mesmo modelo da Técnica (artigos+dúvidas)
 *   bases/{base}/enquetes/{id}/respostas/{pessoa}    ← indisponibilidade, igual a Técnica/Backstage
 *   bases/{base}/reembolsos/{r}
 *   marcas/{marca}/categoriasRecurso/{categoria}      ← Logos/Fontes/Cores/Outros por omissão, o líder cria mais
 *   marcas/{marca}/recursos/{recurso}                ← raiz, leitura de TODAS as bases (Brand)
 *   acervo/{item}                                    ← raiz, leitura de TODAS as bases
 *   acervoCategorias/{categoria}                      ← raiz, agrupa o acervo (nome, ordem, ativo)
 *   eventos/{AAAA-MM-DD}                             ← global, a igreja toda
 *   eventos/{e}/escalas/{base}                       ← lugares[] (titular/aprendiz por ministério) + liderEscala
 *   eventos/{e}/atribuicoes/{funcao}                 ← pessoas[]
 *   eventos/{e}/checklist/{funcao}                   ← feito por quem, a que horas
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase        = () => doc(db, "bases", BASE_ID);
export const cPessoas     = () => collection(db, `bases/${BASE_ID}/pessoas`);
export const cFuncoes     = () => collection(db, `bases/${BASE_ID}/funcoes`);
export const cMinisterios = () => collection(db, `bases/${BASE_ID}/ministerios`);
export const cEquipamentos = () => collection(db, `bases/${BASE_ID}/equipamentos`);
export const cHistoricoEquipamento = (itemId) => collection(db, `bases/${BASE_ID}/equipamentos/${itemId}/historico`);
export const cWiki         = () => collection(db, `bases/${BASE_ID}/wiki`);
export const cRespostasWiki = (wikiId) => collection(db, `bases/${BASE_ID}/wiki/${wikiId}/respostas`);
export const cWikiIndiceDoc = () => doc(db, "wikiIndice", BASE_ID);
export const cEnquetes    = () => collection(db, `bases/${BASE_ID}/enquetes`);
export const cRespostasEnquete = (enqueteId) => collection(db, `bases/${BASE_ID}/enquetes/${enqueteId}/respostas`);
export const cReembolsos  = () => collection(db, `bases/${BASE_ID}/reembolsos`);
export const cMarcas      = () => collection(db, "marcas");
export const cRecursos    = (marcaId) => collection(db, `marcas/${marcaId}/recursos`);
export const cCategoriasRecurso = (marcaId) => collection(db, `marcas/${marcaId}/categoriasRecurso`);
export const cAcervo      = () => collection(db, "acervo");
export const cAcervoCategorias = () => collection(db, "acervoCategorias");
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
 *  por culto" é validada em guardarEscalaComunicacao. */
export const meusLugares = (escala, uid) =>
  (escala?.lugares || []).filter((l) => l.titularId === uid || l.aprendizId === uid);

/** Funções (itens da checklist/atribuição) dos ministérios em que a
 *  pessoa serve naquele culto. */
export const funcoesDosMeusMinisterios = (funcoes, eventoId, escala, uid) =>
  funcoesDoCulto(funcoes, eventoId).filter((f) =>
    meusLugares(escala, uid).some((l) => l.ministerioId === f.ministerioId));

/** Dos sete ministérios da Comunicação, só três têm gente escalada na
 *  hora do culto — os outros são produção/edição, sem posto ao vivo
 *  no domingo. Pedido do líder: tirar os outros da Escala (ver
 *  Culto.jsx) e de "montar escala" (SheetEscalaMinisterios) — em
 *  todo o resto (Ministérios do Painel, Wiki, Funções…) continuam
 *  intactos, isto filtra só nestas duas telas. Por nome, não por id
 *  fixo: "Responsável" foi criado pelo líder pelo próprio painel,
 *  sem slug conhecido de antemão. */
const NOMES_MINISTERIOS_ESCALA = ["Storymaker", "Fotografia", "Responsável"];
export const ministeriosDaEscala = (ministerios) =>
  ministerios.filter((m) => NOMES_MINISTERIOS_ESCALA.includes(m.nome));
