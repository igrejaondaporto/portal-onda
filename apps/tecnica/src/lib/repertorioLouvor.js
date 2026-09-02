/**
 * Leitura do repertório da Base Louvor, só para a projeção — as
 * regras já permitem a Técnica ler bases/louvor/repertorios (ver
 * firestore.rules), mas não bases/louvor/musicas: por isso cada item
 * de música já vem com título/artista/capa/links copiados na hora em
 * que a Louvor grava (ver apps/louvor/src/pages/Repertorio.jsx) — o
 * que garante que nunca se vê tom, BPM nem observações daquela base,
 * só o que a decisão 8 do CLAUDE.md da Louvor deixa passar.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";

export function ouvirRepertorioLouvor(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(doc(db, `bases/louvor/repertorios/${eventoId}`), (s) => cb(s.exists() ? s.data() : null));
}
