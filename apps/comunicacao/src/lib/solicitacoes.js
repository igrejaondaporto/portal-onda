/**
 * Gestão de Solicitações — só existe na Comunicação. Abrir um pedido
 * é genérico (packages/shared/lib/solicitacoes.js); assumir, mudar
 * estado e listar por status é só daqui.
 */
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

export { abrirSolicitacao, obterSlaDiasMinimos, diasAte } from "@portal/shared/lib/solicitacoes.js";

const cSolicitacoes = () => collection(db, "solicitacoes");

/** Todas as solicitações endereçadas à Comunicação — a rule só deixa
 *  ler quem é membro da Comunicação ou da base que pediu; aqui é
 *  sempre a Comunicação a olhar para tudo. */
export function ouvirSolicitacoes(cb) {
  const q = query(cSolicitacoes(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Só as que estou a produzir eu — para a aba Produção dentro da
 *  Escala/Agenda (ver CLAUDE-comunicacao.md §5.6: é uma consulta,
 *  nunca uma coleção própria). */
export function ouvirMinhaProducao(uid, cb) {
  const q = query(
    cSolicitacoes(),
    where("responsavelId", "==", uid),
    where("status", "in", ["fila", "producao", "revisao"]),
    orderBy("prazo")
  );
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
