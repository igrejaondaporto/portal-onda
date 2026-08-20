/**
 * Gestão de Solicitações — só existe na Comunicação. Abrir um pedido
 * é genérico (packages/shared/lib/solicitacoes.js); assumir, mudar
 * estado e listar por status é só daqui.
 */
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

export { abrirSolicitacao, obterSlaDiasMinimos, diasAte } from "@portal/shared/lib/solicitacoes.js";

const cSolicitacoes = () => collection(db, "solicitacoes");

/** Nome de exibição de cada base solicitante — `baseSolicitanteId` na
 *  solicitação é sempre a chave interna (bases/{id}), nunca o que se
 *  mostra. Lista fixa (não muda com frequência) em vez de ler
 *  bases/{id} uma a uma só para isto. */
export const NOMES_BASE = {
  apoio: "Apoio",
  tecnica: "Técnica",
  backstage: "Backstage",
  comunicacao: "Comunicação",
};
export const nomeBase = (id) => NOMES_BASE[id] || id;

/** Todas as solicitações endereçadas à Comunicação — a rule só deixa
 *  ler quem é membro da Comunicação ou da base que pediu; aqui é
 *  sempre a Comunicação a olhar para tudo. */
export function ouvirSolicitacoes(cb) {
  const q = query(cSolicitacoes(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Transferências à minha espera — para o banner no Início. Uma
 *  equality num campo do mapa (transferePendente.paraId), sem
 *  orderBy, não precisa de índice composto. */
export function ouvirTransferenciasPendentes(uid, cb) {
  const q = query(cSolicitacoes(), where("transferePendente.paraId", "==", uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const assumirSolicitacao = (id) => chamar("assumirSolicitacao")({ id }).then((r) => r.data);
export const mudarStatusSolicitacao = (dados) => chamar("mudarStatusSolicitacao")(dados).then((r) => r.data);
export const transferirSolicitacao = (id, paraId) => chamar("transferirSolicitacao")({ id, paraId }).then((r) => r.data);
export const aceitarTransferencia = (id) => chamar("aceitarTransferencia")({ id }).then((r) => r.data);
export const recusarTransferencia = (id) => chamar("recusarTransferencia")({ id }).then((r) => r.data);
