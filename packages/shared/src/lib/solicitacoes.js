/**
 * Abrir uma solicitação à Comunicação — genuinamente igual em
 * qualquer base (é para isso que packages/shared existe, ver
 * CLAUDE.md raiz). O resto da gestão (assumir, mudar estado,
 * filtros, histórico) é só da Comunicação — ver apps/comunicacao.
 */
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar, BASE_ID } from "./firebase.js";

export const abrirSolicitacao = (dados) => chamar("abrirSolicitacao")(dados).then((r) => r.data);

/** Os pedidos desta base à Comunicação, para o líder acompanhar o
 *  estado sem ter de perguntar (ver `CardSolicitarComunicacao`) — a
 *  rule só deixa ler quem é da própria base ou da Comunicação (ver
 *  firestore.rules, minhaBase(baseSolicitanteId)). Excluídos
 *  (`ativo: false`, ver `excluirSolicitacao`) ficam de fora — filtro
 *  no cliente, não `where`, porque pedidos de antes dessa
 *  funcionalidade não têm o campo `ativo` nenhum. */
export function ouvirMinhasSolicitacoes(cb) {
  const q = query(
    collection(db, "solicitacoes"),
    where("baseSolicitanteId", "==", BASE_ID), orderBy("criadoEm", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.ativo !== false)));
}

/** bases/comunicacao é público a quem tem sessão (ver firestore.rules)
 *  — só para mostrar o aviso de prazo curto antes de enviar. */
export async function obterSlaDiasMinimos() {
  const s = await getDoc(doc(db, "bases/comunicacao"));
  return s.exists() ? (s.data().slaDiasMinimos ?? 3) : 3;
}

/** Ministérios da Comunicação (Fotografia, Social Media…), lidos por
 *  quem NÃO é da Comunicação — para escolher, ao abrir um pedido,
 *  para que ministério é (ver firestore.rules: carve-out em
 *  ministerios/{id} para base=='comunicacao'). Só uma vez, não é
 *  preciso onSnapshot num formulário que se preenche e fecha. */
export async function obterMinisteriosComunicacao() {
  const q = query(
    collection(db, "bases/comunicacao/ministerios"),
    where("ativo", "==", true), orderBy("ordem")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Cancelar o próprio pedido, "abriu errado" ou já não precisa — só
 *  enquanto ainda está na fila (ver `excluirMinhaSolicitacao`, a
 *  Cloud Function recusa depois disso: uma vez assumido, é conversa
 *  com a Comunicação, não um botão). */
export const excluirMinhaSolicitacao = (id) => chamar("excluirMinhaSolicitacao")({ id }).then((r) => r.data);

export function diasAte(prazoISO) {
  const hoje = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hoje}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}
