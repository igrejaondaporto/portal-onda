/**
 * Presença dos adolescentes na Lição — quem participa não é
 * voluntário nem tem login (são os jovens, não a equipa), por isso é
 * um catálogo à parte, sem PIN nenhum: `adolescentes` é só uma
 * lista de nomes que qualquer voluntário mantém, e `presencasLicao`
 * marca quem esteve em cada domingo. Independente de existir lição
 * enviada nesse domingo ou não — dá para marcar presença mesmo sem
 * documento (ex.: a lição foi passada oralmente essa semana).
 */
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cAdolescentes = () => collection(db, `bases/${BASE_ID}/adolescentes`);
const cPresencas = () => collection(db, `bases/${BASE_ID}/presencasLicao`);
const refPresenca = (eventoId) => doc(db, `bases/${BASE_ID}/presencasLicao/${eventoId}`);

/** Só os ativos — "remover" um adolescente é ativo:false (regra 5 do
 *  CLAUDE.md raiz, nada se apaga a sério), nunca some do histórico
 *  de presenças já registadas. */
export function ouvirAdolescentes(cb) {
  return onSnapshot(cAdolescentes(), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.ativo !== false)));
}

export function criarAdolescente(nome) {
  return setDoc(doc(cAdolescentes()), { nome: nome.trim(), ativo: true, criadoEm: serverTimestamp() });
}

export function removerAdolescente(id) {
  return updateDoc(doc(db, `bases/${BASE_ID}/adolescentes/${id}`), { ativo: false });
}

/** Mapa eventoId → array de ids presentes nesse domingo. Um
 *  documento só (não uma subcoleção por adolescente): a lista de
 *  presentes num domingo é pequena, e ler/mostrar todos os domingos
 *  de uma vez (para o resumo) precisa disto num pedido só, não N. */
export function ouvirPresencas(cb) {
  return onSnapshot(cPresencas(), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data().presentes || []; });
    cb(mapa);
  });
}

export function marcarPresenca(eventoId, adolescenteId, presente) {
  return setDoc(refPresenca(eventoId), {
    presentes: presente ? arrayUnion(adolescenteId) : arrayRemove(adolescenteId),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}
