/**
 * Lição: o líder sobe um documento .docx e fica visível para toda a
 * base — sem histórico separado por semana explícito, é só uma lista
 * (mais recente primeiro); quem quiser guardar as antigas como
 * referência, o líder decide quando excluir. O ficheiro em si vive no
 * Storage; o Firestore só guarda o link e quem/quando enviou.
 */
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, BASE_ID } from "@portal/shared/lib/firebase.js";

const cLicoes = () => collection(db, `bases/${BASE_ID}/licoes`);

export function ouvirLicoes(cb) {
  return onSnapshot(query(cLicoes(), orderBy("criadoEm", "desc")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** `ficheiro` é sempre um .docx (ver aceita=".docx" no <input>, e a
 *  regra do Storage recusa outro contentType) — sem conversão nem
 *  pré-visualização aqui, é só guardar e dar o link para abrir. */
export async function enviarLicao(uid, { titulo, ficheiro }) {
  const ref = doc(cLicoes());
  const destino = refStorage(storage, `bases/${BASE_ID}/licoes/${ref.id}.docx`);
  await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
  const arquivoUrl = await getDownloadURL(destino);
  await setDoc(ref, {
    titulo: titulo.trim() || ficheiro.name,
    arquivoUrl, arquivoNome: ficheiro.name,
    enviadoPor: uid, criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function excluirLicao(licaoId) {
  await deleteDoc(doc(db, `bases/${BASE_ID}/licoes/${licaoId}`));
  // best-effort — se o ficheiro já não existir no Storage por algum
  // motivo, não vale a pena impedir o documento de sair da lista.
  try {
    await deleteObject(refStorage(storage, `bases/${BASE_ID}/licoes/${licaoId}.docx`));
  } catch { /* ignorado de propósito */ }
}
