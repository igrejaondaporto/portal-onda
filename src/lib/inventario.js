/**
 * Inventário: qualquer voluntário mexe na quantidade, só o líder da
 * base cria ou apaga itens (regras já tratam disso). Cada alteração
 * fica registada em movimentos — é a promessa que a própria página faz.
 */
import { collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "./firebase";
import { cInventario } from "./modelo";

export function ouvirInventario(cb) {
  return onSnapshot(cInventario(), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function mexerQuantidade(item, delta, uid) {
  const quantidade = Math.max(0, item.quantidade + delta);
  await updateDoc(doc(db, `bases/${BASE_ID}/inventario/${item.id}`), {
    quantidade, atualizadoEm: serverTimestamp(), atualizadoPor: uid,
  });
  await addDoc(collection(db, `bases/${BASE_ID}/inventario/${item.id}/movimentos`), {
    pessoaId: uid, delta, quantidade, criadoEm: serverTimestamp(),
  });
  return quantidade;
}
