/**
 * Perfil: cada um só edita o seu — nome, telefone e foto. As regras do
 * Firestore limitam a escrita exatamente a estes campos (ver
 * firestore.rules), por isso os updates aqui nunca tocam noutra coisa.
 */
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID } from "./firebase";

export const guardarPerfil = (uid, { nome, telefone }) =>
  updateDoc(doc(db, `bases/${BASE_ID}/pessoas/${uid}`), { nome, telefone, atualizadoEm: serverTimestamp() });

export async function enviarFotoPerfil(uid, ficheiro) {
  const destino = refStorage(storage, `bases/${BASE_ID}/pessoas/${uid}`);
  await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
  const url = await getDownloadURL(destino);
  await updateDoc(doc(db, `bases/${BASE_ID}/pessoas/${uid}`), { foto: url, atualizadoEm: serverTimestamp() });
  return url;
}

export const removerFotoPerfil = (uid) =>
  updateDoc(doc(db, `bases/${BASE_ID}/pessoas/${uid}`), { foto: null, atualizadoEm: serverTimestamp() });
