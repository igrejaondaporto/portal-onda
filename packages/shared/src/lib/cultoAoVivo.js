/**
 * Leitura do registo ao vivo da ordem do culto — igual em qualquer
 * base, todas só leem. A escrita (iniciar/descartar/editar/
 * correspondência) é exclusiva da Base Técnica e fica em
 * apps/tecnica/src/lib/cultoAoVivo.js, não aqui.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

export function ouvirCultoAoVivo(eventoId, cb) {
  return onSnapshot(doc(db, `eventos/${eventoId}/cultoAoVivo/registo`), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}
