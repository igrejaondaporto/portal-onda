/**
 * Reembolsos: qualquer voluntário submete o seu; o líder da base vê
 * todos e é quem marca como pago (as regras só deixam a ele). O anexo
 * (nota ou fatura) fica no Storage, o documento no Firestore.
 */
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID } from "./firebase";
import { cReembolsos } from "./modelo";

export function ouvirReembolsos(souLiderBase, uid, cb) {
  const q = souLiderBase
    ? query(cReembolsos(), orderBy("criadoEm", "desc"))
    : query(cReembolsos(), where("pessoaId", "==", uid), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function criarReembolso(uid, { descricao, valor, ficheiro }) {
  const ref = doc(cReembolsos());
  let anexo = null;
  if (ficheiro) {
    const destino = refStorage(storage, `bases/${BASE_ID}/reembolsos/${ref.id}`);
    await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
    anexo = await getDownloadURL(destino);
  }
  await setDoc(ref, {
    pessoaId: uid, descricao, valor, anexo, estado: "submetido", criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export const marcarPago = (reembolsoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/reembolsos/${reembolsoId}`), { estado: "pago" });
