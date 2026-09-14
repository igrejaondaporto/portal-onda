/**
 * Caminhos do Firestore, num sítio só.
 * Multi-base desde o dia 1: replicar para a Base Técnica é criar
 * um documento em /bases, não reescrever o sistema.
 *
 *   bases/{base}
 *   bases/{base}/pessoas/{pessoa}
 *   bases/{base}/pessoas/{pessoa}/privado/auth      ← hash do PIN, ilegível
 *   bases/{base}/funcoes/{funcao}                    ← eventoId=null → catálogo
 *                                                       "drive" é id fixo, reservado
 *   bases/{base}/inventario/{item}/movimentos/{mov}
 *   bases/{base}/listasCompras/{lista}               ← estado: aberta|fechada|enviada
 *   bases/{base}/reembolsos/{r}
 *   bases/{base}/acomodacao/planta                   ← config do mapa do auditório
 *   bases/{base}/acomodacaoResumos/{AAAA-MM-DD}      ← arquivo pós-fecho de cada culto
 *                                                       (coleção irmã, não subcoleção —
 *                                                       ver nota em fecharAcomodacao)
 *   eventos/{AAAA-MM-DD}                             ← global, a igreja toda
 *   eventos/{e}/escalas/{base}                       ← pessoas[] + liderEscala
 *   eventos/{e}/atribuicoes/{funcao}                 ← pessoas[]
 *   eventos/{e}/acomodacao/mapa                       ← estado ao vivo dos 144 lugares
 *   eventos/{e}/checklist/{funcao}                   ← feito por quem, a que horas
 *   eventos/{e}/contagem/geral                       ← nove categorias, autoria e origem por categoria
 *   bases/{base}/enquetes/{AAAA-MM}                  ← indisponibilidade, igual a Técnica/Backstage
 *   bases/{base}/enquetes/{AAAA-MM}/respostas/{pessoa}
 *   bases/{base}/gds/{gd}                            ← catálogo de GDs, sugerido no Formulário
 *   bases/{base}/config/contactoPastor               ← whatsapp do pastor (não vai no doc bases/{base},
 *                                                       que é lido por autenticado() de QUALQUER base)
 *   contactos/{contacto}                             ← GLOBAL (fora de bases/) — Formulário de contacto
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase        = () => doc(db, "bases", BASE_ID);
export const cContactoPastor = () => doc(db, `bases/${BASE_ID}/config/contactoPastor`);
export const cPessoas     = () => collection(db, `bases/${BASE_ID}/pessoas`);
export const cFuncoes     = () => collection(db, `bases/${BASE_ID}/funcoes`);
export const cInventario  = () => collection(db, `bases/${BASE_ID}/inventario`);
export const cListasCompras = () => collection(db, `bases/${BASE_ID}/listasCompras`);
export const cListaCompras  = (id) => doc(db, `bases/${BASE_ID}/listasCompras/${id}`);
export const cReembolsos  = () => collection(db, `bases/${BASE_ID}/reembolsos`);
export const cEventos     = () => collection(db, "eventos");
export const cEscala      = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);
export const cAtribuicoes = (ev) => collection(db, `eventos/${ev}/atribuicoes`);
export const cAtribuicaoDrive = (ev) => doc(db, `eventos/${ev}/atribuicoes/drive`);
export const cChecklist   = (ev) => collection(db, `eventos/${ev}/checklist`);
export const cContagem    = (ev) => doc(db, `eventos/${ev}/contagem/geral`);
export const cEnquetes    = () => collection(db, `bases/${BASE_ID}/enquetes`);
export const cRespostasEnquete = (mes) => collection(db, `bases/${BASE_ID}/enquetes/${mes}/respostas`);
export const cGDs         = () => collection(db, `bases/${BASE_ID}/gds`);
// global, fora de bases/ — ver comentário em firestore.rules
export const cContactos   = () => collection(db, "contactos");
export const cContacto    = (id) => doc(db, `contactos/${id}`);

// ── Acomodação (mapa do auditório) ─────────────────────────────
export const cPlanta = () => doc(db, `bases/${BASE_ID}/acomodacao/planta`);
export const cMapaAcomodacao = (ev) => doc(db, `eventos/${ev}/acomodacao/mapa`);
export const cResumosAcomodacao = () => collection(db, `bases/${BASE_ID}/acomodacaoResumos`);
export const cResumoAcomodacao = (ev) => doc(db, `bases/${BASE_ID}/acomodacaoResumos/${ev}`);

export const ESTADOS_LUGAR = ["livre", "ocupado", "visitante", "reservado", "bloqueado"];
export const CORES_LUGAR = {
  livre: "#8E2028", ocupado: "#C8F02E", visitante: "#F5C518",
  reservado: "#3B82F6", bloqueado: "#5A6072",
};

export const FASES = [
  ["pre",     "Pré-culto",      "Antes de abrir as portas"],
  ["durante", "Durante o culto", "A partir das 10:30"],
  ["pos",     "Pós-culto",      "Depois de todos saírem"],
];

/** Uma função entra num culto se for do catálogo ou se for dele. */
export const funcoesDoCulto = (funcoes, eventoId) =>
  funcoes.filter((f) => !f.eventoId || f.eventoId === eventoId);

/** A regra do responsável, replicada no cliente só para esconder botões.
 *  A que conta é a da Cloud Function atribuirFuncao. */
export const podeDistribuir = (papel, uid, escala) =>
  papel === "lider_base" || escala?.liderEscala === uid;
