/**
 * Inventário: qualquer voluntário mexe na quantidade, só o líder da
 * base cria ou apaga itens (regras já tratam disso). Cada alteração
 * fica registada em movimentos — é a promessa que a própria página faz.
 */
import { collection, doc, addDoc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "./firebase";
import { cInventario } from "./modelo";

export function ouvirInventario(cb) {
  return onSnapshot(cInventario(), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
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
