/**
 * Brand — marcas + os recursos de cada uma. Raiz (não bases/comunicacao):
 * leitura para qualquer base autenticada, escrita só do líder da
 * Comunicação (ver firestore.rules) — direto do cliente, sem Cloud
 * Function, porque não há autoria mista nem histórico a garantir
 * (ao contrário de Solicitações).
 */
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
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

/** Único upload de Brand/Acervo — decisão explícita do líder, reverte
 *  a regra "sem upload" só para este campo (ver CLAUDE.md desta base).
 *  900px chega de sobra: é uma foto de fundo de card pequeno, não um
 *  ficheiro de trabalho como os do Acervo (esses continuam por link). */
export async function enviarFotoMarca(marcaId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro, { maxDimensao: 900 });
  const destino = refStorage(storage, `marcas/${marcaId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

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
