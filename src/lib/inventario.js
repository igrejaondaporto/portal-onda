/**
 * Inventário: qualquer voluntário mexe na quantidade diretamente. Criar,
 * editar ou desativar itens passa sempre pelas Cloud Functions — só assim
 * o líder de escala também pode geri-lo no dia do culto dele, sem abrir
 * essa porta a toda a gente (a Cloud Function é que decide quem pode).
 * Cada alteração de quantidade fica registada em movimentos. Nada é
 * apagado, só ativo:false.
 */
import { collection, doc, addDoc, onSnapshot, query, where, runTransaction, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID, chamar } from "./firebase";
import { cInventario } from "./modelo";
import { comprimirImagem } from "./imagem";

export function ouvirInventario(cb) {
  const q = query(cInventario(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — precisamos dele antes de gravar, para a foto
 *  (em Storage) e o documento (no Firestore) apontarem ao mesmo sítio. */
export const novoItemInventarioId = () => doc(cInventario()).id;

export const criarItemInventario = (itemId, dados) =>
  chamar("criarItemInventario")({ itemId, ...dados }).then(() => itemId);

export const guardarItemInventario = (itemId, dados) =>
  chamar("guardarItemInventario")({ itemId, ...dados }).then((r) => r.data);

export const desativarItemInventario = (itemId) =>
  chamar("desativarItemInventario")({ itemId }).then((r) => r.data);

export async function enviarFotoItemInventario(itemId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
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
