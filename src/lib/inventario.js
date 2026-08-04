/**
 * Inventário: qualquer voluntário mexe na quantidade, só o líder da
 * base cria, edita ou desativa itens (regras já tratam disso). Cada
 * alteração de quantidade fica registada em movimentos — é a promessa
 * que a própria página faz. Nada é apagado, só ativo:false.
 */
import { collection, doc, addDoc, onSnapshot, query, where, runTransaction, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID } from "./firebase";
import { cInventario } from "./modelo";

export function ouvirInventario(cb) {
  const q = query(cInventario(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — precisamos dele antes de gravar, para a foto
 *  (em Storage) e o documento (no Firestore) apontarem ao mesmo sítio. */
export const novoItemInventarioId = () => doc(cInventario()).id;

export async function criarItemInventario(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/inventario/${id}`), {
    ...dados, ativo: true, criadoEm: serverTimestamp(),
  });
  return id;
}

export const guardarItemInventario = (itemId, dados) =>
  updateDoc(doc(db, `bases/${BASE_ID}/inventario/${itemId}`), dados);

export const desativarItemInventario = (itemId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/inventario/${itemId}`), { ativo: false });

export async function enviarFotoItemInventario(itemId, ficheiro) {
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}`);
  await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
  return getDownloadURL(destino);
}

/** increment() é atómico no servidor — duas pessoas a mexer ao mesmo
 *  tempo não se pisam, ao contrário de ler a quantidade e escrever
 *  a soma calculada no cliente. */
export async function mexerQuantidade(item, delta, uid) {
  const ref = doc(db, `bases/${BASE_ID}/inventario/${item.id}`);
  const quantidade = await runTransaction(db, async (tx) => {
    const atual = (await tx.get(ref)).data()?.quantidade ?? 0;
    const nova = Math.max(0, atual + delta);
    tx.update(ref, { quantidade: nova, atualizadoEm: serverTimestamp(), atualizadoPor: uid });
    return nova;
  });
  await addDoc(collection(db, `bases/${BASE_ID}/inventario/${item.id}/movimentos`), {
    pessoaId: uid, delta, quantidade, criadoEm: serverTimestamp(),
  });
  return quantidade;
}
