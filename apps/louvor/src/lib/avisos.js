/**
 * Avisos do líder para a equipa — mostrados no Início. Escrita direta
 * do cliente (sem Cloud Function, ver firestore.rules), como
 * funcoes/gds noutras bases. "Excluir" é sempre ativo:false, nunca um
 * delete a sério (regra 5 do CLAUDE.md raiz) — vale para avisos e
 * para os modelos reutilizáveis.
 */
import { addDoc, collection, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cAvisos = () => collection(db, `bases/${BASE_ID}/avisos`);
const cAvisosModelos = () => collection(db, `bases/${BASE_ID}/avisosModelos`);

/** Só os avisos ainda ativos e dentro do prazo — filtrado no cliente,
 *  como ouvirMusicas/ouvirEnquetesAbertas já fazem noutras bases.
 *  Urgentes primeiro, depois os normais, por ordem de chegada. */
export function ouvirAvisos(cb) {
  return onSnapshot(cAvisos(), (snap) => {
    const agora = Date.now();
    const ativos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => a.ativo !== false && (!a.expiraEm || a.expiraEm.toMillis() > agora))
      .sort((a, b) => (a.urgencia === b.urgencia ? 0 : a.urgencia === "urgente" ? -1 : 1));
    cb(ativos);
  });
}

export function ouvirAvisosModelos(cb) {
  return onSnapshot(cAvisosModelos(), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.ativo !== false));
  });
}

/** expiraEm calculado no cliente (relógio do líder) — baixo risco de
 *  desvio de relógio para um banner que se auto-esconde, não vale uma
 *  Cloud Function só por isto. */
export async function criarAviso(uid, { texto, urgencia, duracaoDias }) {
  await addDoc(cAvisos(), {
    texto, urgencia, duracaoDias,
    expiraEm: Timestamp.fromMillis(Date.now() + duracaoDias * 86400000),
    criadoPor: uid,
    criadoEm: serverTimestamp(),
    ativo: true,
  });
}

export const excluirAviso = (id) =>
  updateDoc(doc(db, `bases/${BASE_ID}/avisos/${id}`), { ativo: false });

export async function criarModelo(uid, { nome, texto, urgencia, duracaoDias }) {
  await addDoc(cAvisosModelos(), {
    nome, texto, urgencia, duracaoDias,
    criadoPor: uid,
    criadoEm: serverTimestamp(),
    ativo: true,
  });
}

export const excluirModelo = (id) =>
  updateDoc(doc(db, `bases/${BASE_ID}/avisosModelos/${id}`), { ativo: false });
