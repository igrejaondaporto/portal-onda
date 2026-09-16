/**
 * Dinheiro que entra — dízimos e ofertas do culto, lançados pelo
 * próprio Financeiro (nenhuma outra base regista isto, ao contrário
 * dos reembolsos). Registo imutável, mesmo padrão de despesasFixas:
 * corrige-se com um lançamento novo, nunca editando o antigo.
 */
import { query, orderBy, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cEntradas = () => collection(db, `bases/${BASE_ID}/entradas`);

export const FUNDOS = [
  ["dizimo", "Dízimo"],
  ["oferta", "Oferta"],
  ["missoes", "Missões"],
  ["obras", "Obras"],
  ["outro", "Outro"],
];
export const ROTULO_FUNDO = Object.fromEntries(FUNDOS);

export const METODOS_ENTRADA = [
  ["dinheiro", "Dinheiro"],
  ["mbway", "MB Way"],
  ["transferencia", "Transferência"],
];
export const ROTULO_METODO_ENTRADA = Object.fromEntries(METODOS_ENTRADA);

export function ouvirEntradas(cb) {
  const q = query(cEntradas(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function registarEntrada(uid, { valor, fundo, metodo, referencia }) {
  await addDoc(cEntradas(), {
    valor, fundo, metodo, referencia: referencia || "",
    criadoPor: uid, criadoEm: serverTimestamp(),
  });
}
