/**
 * Acervo — os mesmos cards de link do Brand, sem nível intermediário
 * (ver CLAUDE-comunicacao.md §6.7). Raiz, leitura de qualquer base.
 */
import { doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { cAcervo } from "./modelo";

export function ouvirAcervo(cb) {
  const q = query(cAcervo(), where("ativo", "==", true), orderBy("ordem"), orderBy("titulo"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novoItemAcervoId = () => doc(cAcervo()).id;

export async function criarItemAcervo(id, dados) {
  await setDoc(doc(db, `acervo/${id}`), { ...dados, ordem: 0, ativo: true, criadoEm: serverTimestamp() });
  return id;
}

export const guardarItemAcervo = (id, dados) => updateDoc(doc(db, `acervo/${id}`), dados);
export const desativarItemAcervo = (id) => updateDoc(doc(db, `acervo/${id}`), { ativo: false });
