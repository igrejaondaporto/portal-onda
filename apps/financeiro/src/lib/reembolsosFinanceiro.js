/**
 * Reembolsos de TODAS as bases, para quem tem a claim
 * ve_todos_reembolsos (bases/financeiro.veReembolsos === "todas" — ver
 * claimsExtraDaBase em functions/index.js). É uma collectionGroup, não
 * `cReembolsos()` de uma base: lê `bases/*\/reembolsos` de uma vez,
 * ao vivo, autorizado pelo bloco `match /{path=**}/reembolsos/{r}` em
 * firestore.rules — pensado exatamente para isto.
 *
 * Pagar e devolver NÃO são escrita direta — são Cloud Function
 * (marcarReembolsosPagos/devolverReembolso), porque mexem em dinheiro
 * e cruzam bases (ver CLAUDE.md raiz, regra 3).
 */
import { collectionGroup, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

export function ouvirReembolsosPorEstado(estado, cb) {
  const q = query(collectionGroup(db, "reembolsos"), where("estado", "==", estado), orderBy("criadoEm", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, baseId: d.data().baseId, ...d.data() }))));
}

export function ouvirReembolsosPagos(cb) {
  const q = query(collectionGroup(db, "reembolsos"), where("estado", "==", "pago"), orderBy("pagoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, baseId: d.data().baseId, ...d.data() }))));
}

export const marcarReembolsosPagos = (pedidos, metodo, referencia) =>
  chamar("marcarReembolsosPagos")({ pedidos: pedidos.map((p) => ({ baseId: p.baseId, id: p.id })), metodo, referencia });

export const devolverReembolso = (baseId, id, motivo) =>
  chamar("devolverReembolso")({ baseId, id, motivo });

/** Mesma formatação de apps/*\/src/lib/reembolsos.js (mostrarDestino)
 *  — sem partilhar módulo porque essa lib vive dentro de cada base,
 *  não em packages/shared; é só apresentação, sem risco de divergir. */
export const mostrarDestino = (metodo, destino) =>
  metodo === "mbway"
    ? String(destino).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : String(destino).replace(/(.{4})/g, "$1 ").trim();

export const ROTULO_METODO = { mbway: "MB Way", transferencia: "Transferência" };

