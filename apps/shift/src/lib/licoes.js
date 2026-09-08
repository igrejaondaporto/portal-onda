/**
 * Lição: um documento .docx por domingo (culto) — o líder sobe a
 * lição da semana, os voluntários abrem para passar aos jovens. Uma
 * lição por `eventoId` (id do próprio culto, "AAAA-MM-DD"), não uma
 * lista solta — pedido do líder, 2026-09: "dividir por domingos de
 * cada mês uma lição". Reenviar no mesmo domingo substitui a lição
 * desse domingo (o ficheiro antigo é apagado do Storage), não
 * acumula várias por semana.
 *
 * Um só listener na coleção inteira (não um por domingo do mês) —
 * o volume é baixo (uma lição por semana, nunca vai ter centenas de
 * documentos), mais simples do que N listeners por mês visível.
 */
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, BASE_ID } from "@portal/shared/lib/firebase.js";

const cLicoes = () => collection(db, `bases/${BASE_ID}/licoes`);
const refLicao = (eventoId) => doc(db, `bases/${BASE_ID}/licoes/${eventoId}`);
const refFicheiro = (eventoId) => refStorage(storage, `bases/${BASE_ID}/licoes/${eventoId}.docx`);

/** Mapa eventoId → lição (ou sem entrada, se aquele domingo ainda não tiver). */
export function ouvirLicoes(cb) {
  return onSnapshot(cLicoes(), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = { id: d.id, ...d.data() }; });
    cb(mapa);
  });
}

/** `ficheiro` é sempre um .docx (ver aceita=".docx" no <input>, e a
 *  regra do Storage recusa outro contentType). Reenviar no mesmo
 *  domingo troca o ficheiro (o nome no Storage é sempre o eventoId). */
export async function enviarLicao(uid, eventoId, { titulo, ficheiro }) {
  await uploadBytes(refFicheiro(eventoId), ficheiro, { contentType: ficheiro.type });
  const arquivoUrl = await getDownloadURL(refFicheiro(eventoId));
  await setDoc(refLicao(eventoId), {
    titulo: titulo.trim() || ficheiro.name,
    arquivoUrl, arquivoNome: ficheiro.name,
    enviadoPor: uid, criadoEm: serverTimestamp(),
  });
}

export async function excluirLicao(eventoId) {
  await deleteDoc(refLicao(eventoId));
  // best-effort — se o ficheiro já não existir no Storage por algum
  // motivo, não vale a pena impedir o documento de sair da lista.
  try { await deleteObject(refFicheiro(eventoId)); } catch { /* ignorado de propósito */ }
}
