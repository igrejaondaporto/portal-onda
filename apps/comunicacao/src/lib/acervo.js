/**
 * Acervo — os mesmos cards de link do Brand, sem nível intermediário
 * (ver CLAUDE-comunicacao.md §6.7). Raiz, leitura de qualquer base.
 *
 * Categorias (`acervoCategorias`) são para agrupar a lista, nada mais
 * — sem elas ligadas a permissões ou a outro sítio do sistema. Um
 * item sem `categoriaId` (ou apontando para uma categoria entretanto
 * desativada) cai no grupo "Sem categoria", nunca desaparece.
 */
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
import { cAcervo, cAcervoCategorias } from "./modelo";

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

export function ouvirCategoriasAcervo(cb) {
  const q = query(cAcervoCategorias(), where("ativo", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaCategoriaAcervoId = () => doc(collection(db, "acervoCategorias")).id;

export async function criarCategoriaAcervo(id, dados) {
  await setDoc(doc(db, `acervoCategorias/${id}`), { ...dados, ordem: 0, ativo: true, criadoEm: serverTimestamp() });
  return id;
}

export const guardarCategoriaAcervo = (id, dados) =>
  updateDoc(doc(db, `acervoCategorias/${id}`), dados);

export const desativarCategoriaAcervo = (id) =>
  updateDoc(doc(db, `acervoCategorias/${id}`), { ativo: false });

/** Só teste visual por agora, a pedido do líder ("quero testar pra
 *  ver como fica") — foto só na barra da categoria (altura fixa),
 *  nunca atrás dos itens, que é o que teria de "esticar" para
 *  categorias com mais de 3. Mesmo padrão de enviarFotoMarca. */
export async function enviarFotoCategoriaAcervo(id, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro, { maxDimensao: 900 });
  const destino = refStorage(storage, `acervoCategorias/${id}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}
