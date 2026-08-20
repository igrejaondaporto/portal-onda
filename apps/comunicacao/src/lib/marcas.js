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
import { cMarcas, cRecursos, cCategoriasRecurso } from "./modelo";

/** Fixadas primeiro (a mais recente a ser fixada fica na frente das
 *  outras — "vai fixando cada uma no início"), o resto pela ordem que
 *  já existia. Reordenar no cliente evita um índice composto só para
 *  isto — a lista de marcas é sempre pequena (um kit por marca, não
 *  centenas de itens). */
export function ouvirMarcas(cb) {
  const q = query(cMarcas(), where("ativo", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => {
    const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const fixadas = todas
      .filter((m) => m.fixado)
      .sort((a, b) => (b.fixadoEm?.toMillis?.() ?? 0) - (a.fixadoEm?.toMillis?.() ?? 0));
    const resto = todas.filter((m) => !m.fixado);
    cb([...fixadas, ...resto]);
  });
}

export const novaMarcaId = () => doc(cMarcas()).id;

export async function criarMarca(id, dados) {
  await setDoc(doc(db, `marcas/${id}`), { ...dados, ordem: 0, ativo: true, criadoEm: serverTimestamp() });
  return id;
}

export const guardarMarca = (id, dados) => updateDoc(doc(db, `marcas/${id}`), dados);
export const desativarMarca = (id) => updateDoc(doc(db, `marcas/${id}`), { ativo: false });

export const fixarMarca = (id) =>
  updateDoc(doc(db, `marcas/${id}`), { fixado: true, fixadoEm: serverTimestamp() });
export const desafixarMarca = (id) =>
  updateDoc(doc(db, `marcas/${id}`), { fixado: false, fixadoEm: null });

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

/** Categorias de recurso, uma seção antes dos links em si (Logos,
 *  Fontes, Cores, Outros por omissão — o líder cria mais por marca).
 *  Substitui o antigo enum fixo `tipo`: cada marca gere as suas. */
export function ouvirCategoriasRecurso(marcaId, cb) {
  const q = query(cCategoriasRecurso(marcaId), where("ativo", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

const CATEGORIAS_RECURSO_PADRAO = [
  { id: "logos", nome: "Logos" },
  { id: "fontes", nome: "Fontes" },
  { id: "cores", nome: "Cores" },
  { id: "outros", nome: "Outros" },
];

/** Chamado ao abrir o kit de uma marca — se ainda não tem nenhuma
 *  categoria (marca de antes desta funcionalidade existir, ou recém-
 *  criada), semeia as 4 por omissão com IDs fixos (iguais aos valores
 *  do antigo `tipo`) para os recursos já existentes continuarem no
 *  sítio certo sem migração nenhuma. Idempotente e sem custo depois
 *  da primeira vez. */
export async function garantirCategoriasPadrao(marcaId) {
  const snap = await getDocs(cCategoriasRecurso(marcaId));
  if (!snap.empty) return;
  await Promise.all(CATEGORIAS_RECURSO_PADRAO.map((c, i) =>
    setDoc(doc(db, `marcas/${marcaId}/categoriasRecurso/${c.id}`), {
      nome: c.nome, ordem: i, ativo: true, criadoEm: serverTimestamp(),
    })
  ));
}

export async function criarCategoriaRecurso(marcaId, nome) {
  const ref = doc(cCategoriasRecurso(marcaId));
  await setDoc(ref, { nome, ordem: 99, ativo: true, criadoEm: serverTimestamp() });
  return ref.id;
}

export const renomearCategoriaRecurso = (marcaId, id, nome) =>
  updateDoc(doc(db, `marcas/${marcaId}/categoriasRecurso/${id}`), { nome });

export const desativarCategoriaRecurso = (marcaId, id) =>
  updateDoc(doc(db, `marcas/${marcaId}/categoriasRecurso/${id}`), { ativo: false });

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
