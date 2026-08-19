/**
 * Brand — marcas + os recursos de cada uma. Raiz (não bases/comunicacao):
 * leitura para qualquer base autenticada, escrita só do líder da
 * Comunicação (ver firestore.rules) — direto do cliente, sem Cloud
 * Function, porque não há autoria mista nem histórico a garantir
 * (ao contrário de Solicitações).
 */
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { cMarcas, cRecursos } from "./modelo";

export function ouvirMarcas(cb) {
  const q = query(cMarcas(), where("ativo", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaMarcaId = () => doc(cMarcas()).id;

export async function criarMarca(id, dados) {
  await setDoc(doc(db, `marcas/${id}`), { ...dados, ordem: 0, ativo: true, criadoEm: serverTimestamp() });
  return id;
}

export const guardarMarca = (id, dados) => updateDoc(doc(db, `marcas/${id}`), dados);
export const desativarMarca = (id) => updateDoc(doc(db, `marcas/${id}`), { ativo: false });

export function ouvirRecursos(marcaId, cb) {
  const q = query(cRecursos(marcaId), orderBy("ordem"), orderBy("titulo"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novoRecursoId = (marcaId) => doc(cRecursos(marcaId)).id;

export async function criarRecurso(marcaId, id, dados) {
  await setDoc(doc(db, `marcas/${marcaId}/recursos/${id}`), { ...dados, ordem: 0, criadoEm: serverTimestamp() });
  return id;
}

export const guardarRecurso = (marcaId, id, dados) =>
  updateDoc(doc(db, `marcas/${marcaId}/recursos/${id}`), dados);

export const removerRecurso = (marcaId, id) =>
  deleteDoc(doc(db, `marcas/${marcaId}/recursos/${id}`));

/** Só para o líder confirmar "tens a certeza" antes de desativar uma
 *  marca com recursos lá dentro — não bloqueia, só avisa. */
export async function contarRecursos(marcaId) {
  const snap = await getDocs(collection(db, `marcas/${marcaId}/recursos`));
  return snap.size;
}
