/**
 * Nome e cor de cada base — `bases/{id}` é público a qualquer pessoa
 * autenticada (ver firestore.rules), por isso dá para resolver aqui
 * sem Cloud Function nenhuma. É só para etiquetar cada reembolso
 * ("Técnica", quadradinho azul); nada específico de uma base entra
 * por aqui.
 */
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";

export function ouvirBases(cb) {
  return onSnapshot(collection(db, "bases"), (snap) => {
    cb(Object.fromEntries(snap.docs.map((d) => [d.id, { nome: d.data().nome ?? d.id, cor: d.data().cor ?? "#6a7192" }])));
  });
}
