/**
 * Repertório do domingo — um por culto (o próprio eventoId é o id do
 * documento), sem estado rascunho: fica visível para quem lê assim
 * que existe, com o selo "atualizado há X" (ver CLAUDE.md desta
 * base). Escrita direta do cliente — as regras já só deixam a base
 * Louvor escrever, e a Técnica lê para a projeção.
 */
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const refRepertorio = (eventoId) => doc(db, `bases/${BASE_ID}/repertorios/${eventoId}`);

export function ouvirRepertorio(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(refRepertorio(eventoId), (s) => cb(s.exists() ? s.data() : null));
}

/** Id local do item na lista (arrasto/edição) — nunca vai para outra
 *  coleção, só existe dentro do array `itens`. */
export const novoItemId = () => Math.random().toString(36).slice(2, 10);

/** `medley`: passa { observacaoMedley } quando esta música entra
 *  colada na anterior (mesmo bloco, sem parar) — ver Repertorio.jsx,
 *  que desenha as duas juntas, sem o espaço normal entre itens. A
 *  observação (ex.: "entra depois do refrão da anterior") é o que a
 *  Técnica lê para saber a hora certa de trocar o slide. */
export const itemMusica = (musicaId, versaoId, medley) => ({
  tipo: "musica", id: novoItemId(), musicaId, versaoId,
  ...(medley ? { medley: true, observacaoMedley: medley.observacaoMedley || null } : {}),
});
export const itemMomento = (nome) => ({ tipo: "momento", id: novoItemId(), nome });

/** Grava a lista inteira de uma vez (~20 itens, uma escrita só) —
 *  é assim que a reordenação por arrasto funciona sem N escritas. */
export async function guardarRepertorio(eventoId, itens, uid) {
  await setDoc(refRepertorio(eventoId), {
    baseId: BASE_ID,
    data: eventoId,
    itens,
    montadoPor: uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  }, { merge: true });
}
