/**
 * Lição: um link do Google Drive por domingo (culto) — a líder cola
 * o link do documento já existente no Drive, os voluntários abrem
 * (ou veem a pré-visualização ali mesmo) para passar aos jovens. Uma
 * lição por `eventoId` (id do próprio culto, "AAAA-MM-DD"), não uma
 * lista solta — pedido do líder, 2026-09: "dividir por domingos de
 * cada mês uma lição". Colar um link novo no mesmo domingo substitui
 * o anterior, não acumula várias por semana.
 *
 * Sem upload nem Storage — é só o link, a equipa já trabalha sempre
 * a partir do Drive (2026-09, pedido da líder). `enviadoPor`/
 * `criadoEm` continuam a existir para o cartão mostrar quem colou o
 * link e há quanto tempo.
 *
 * Um só listener na coleção inteira (não um por domingo do mês) —
 * o volume é baixo (uma lição por semana, nunca vai ter centenas de
 * documentos), mais simples do que N listeners por mês visível.
 */
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cLicoes = () => collection(db, `bases/${BASE_ID}/licoes`);
const refLicao = (eventoId) => doc(db, `bases/${BASE_ID}/licoes/${eventoId}`);

/** Mapa eventoId → lição (ou sem entrada, se aquele domingo ainda não tiver). */
export function ouvirLicoes(cb) {
  return onSnapshot(cLicoes(), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = { id: d.id, ...d.data() }; });
    cb(mapa);
  });
}

export async function guardarLicao(uid, eventoId, { titulo, link }) {
  await setDoc(refLicao(eventoId), {
    titulo: titulo.trim() || "Lição",
    link: link.trim(),
    enviadoPor: uid, criadoEm: serverTimestamp(),
  });
}

export async function excluirLicao(eventoId) {
  await deleteDoc(refLicao(eventoId));
}
