/**
 * Enquetes genéricas (pergunta + opções) — só da Comunicação. Não
 * confundir com a enquete de indisponibilidade de Técnica/Backstage,
 * que vive na mesma coleção (`enquetes`) mas noutra base, com outro
 * schema e sempre por Cloud Function (ver firestore.rules). Aqui é
 * escrita direta — sem efeito colateral a limpar, a regra já chega.
 */
import { doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { cEnquetes, cRespostasEnquete } from "./modelo";

export function ouvirEnquetes(cb) {
  const q = query(cEnquetes(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirEnquetesAbertas(cb) {
  const q = query(cEnquetes(), where("ativa", "==", true), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaEnqueteId = () => doc(cEnquetes()).id;

export async function criarEnquete(id, { pergunta, opcoes, multiplaEscolha, prazo }, uid) {
  await setDoc(doc(db, `bases/comunicacao/enquetes/${id}`), {
    pergunta, opcoes, multiplaEscolha: !!multiplaEscolha, prazo: prazo || null,
    criadoPorId: uid, ativa: true, criadoEm: serverTimestamp(),
  });
  return id;
}

export const fecharEnquete = (id) => updateDoc(doc(db, `bases/comunicacao/enquetes/${id}`), { ativa: false });
export const reabrirEnquete = (id) => updateDoc(doc(db, `bases/comunicacao/enquetes/${id}`), { ativa: true });

export function ouvirRespostas(enqueteId, cb) {
  return onSnapshot(cRespostasEnquete(enqueteId), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function obterMinhaResposta(enqueteId, uid) {
  const s = await getDoc(doc(db, `bases/comunicacao/enquetes/${enqueteId}/respostas/${uid}`));
  return s.exists() ? s.data() : null;
}

export function ouvirMinhaResposta(enqueteId, uid, cb) {
  return onSnapshot(doc(db, `bases/comunicacao/enquetes/${enqueteId}/respostas/${uid}`), (s) => cb(s.exists() ? s.data() : null));
}

export const responderEnquete = (enqueteId, uid, opcoes) =>
  setDoc(doc(db, `bases/comunicacao/enquetes/${enqueteId}/respostas/${uid}`), { opcoes, em: serverTimestamp() });

/** Contagem por opção — só para o líder ver o resultado, sem abrir
 *  cada resposta uma a uma. */
export function contarPorOpcao(opcoes, respostas) {
  const contagem = Object.fromEntries(opcoes.map((o) => [o, 0]));
  respostas.forEach((r) => (r.opcoes || []).forEach((o) => { if (o in contagem) contagem[o] += 1; }));
  return contagem;
}
