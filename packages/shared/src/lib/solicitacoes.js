/**
 * Abrir uma solicitação à Comunicação — genuinamente igual em
 * qualquer base (é para isso que packages/shared existe, ver
 * CLAUDE.md raiz). O resto da gestão (assumir, mudar estado,
 * filtros, histórico) é só da Comunicação — ver apps/comunicacao.
 */
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "./firebase.js";

export const abrirSolicitacao = (dados) => chamar("abrirSolicitacao")(dados).then((r) => r.data);

/** bases/comunicacao é público a quem tem sessão (ver firestore.rules)
 *  — só para mostrar o aviso de prazo curto antes de enviar. */
export async function obterSlaDiasMinimos() {
  const s = await getDoc(doc(db, "bases/comunicacao"));
  return s.exists() ? (s.data().slaDiasMinimos ?? 10) : 10;
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

export function diasAte(prazoISO) {
  const hoje = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hoje}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}
