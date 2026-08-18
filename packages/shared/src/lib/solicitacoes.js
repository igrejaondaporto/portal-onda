/**
 * Abrir uma solicitação à Comunicação — genuinamente igual em
 * qualquer base (é para isso que packages/shared existe, ver
 * CLAUDE.md raiz). O resto da gestão (assumir, mudar estado,
 * filtros, histórico) é só da Comunicação — ver apps/comunicacao.
 */
import { doc, getDoc } from "firebase/firestore";
import { db, chamar } from "./firebase.js";

export const abrirSolicitacao = (dados) => chamar("abrirSolicitacao")(dados).then((r) => r.data);

/** bases/comunicacao é público a quem tem sessão (ver firestore.rules)
 *  — só para mostrar o aviso de prazo curto antes de enviar. */
export async function obterSlaDiasMinimos() {
  const s = await getDoc(doc(db, "bases/comunicacao"));
  return s.exists() ? (s.data().slaDiasMinimos ?? 10) : 10;
}

export function diasAte(prazoISO) {
  const hoje = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hoje}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}
