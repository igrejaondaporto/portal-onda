/**
 * Ordem do culto ao vivo — o registo que a Cloud Function agendada
 * sondarFreeshow escreve em eventos/{eventoId}/cultoAoVivo/registo, e
 * as ações que o cliente pode pedir (iniciar, descartar, editar uma
 * hora, configurar a correspondência de nomes). Ver
 * functions/freeshow.js e o plano da funcionalidade para o desenho
 * completo — este ficheiro só espelha o padrão de culto.js.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

export function ouvirCultoAoVivo(eventoId, cb) {
  return onSnapshot(doc(db, `eventos/${eventoId}/cultoAoVivo/registo`), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

export function ouvirCorrespondencia(cb) {
  return onSnapshot(doc(db, "bases/tecnica/config/correspondenciaFreeshow"), (snap) => {
    cb(snap.exists() ? snap.data().mapa || {} : {});
  });
}

export const iniciarCultoAoVivo = (eventoId) =>
  chamar("iniciarCultoAoVivo")({ eventoId }).then((r) => r.data);

export const descartarCultoAoVivo = (eventoId) =>
  chamar("descartarCultoAoVivo")({ eventoId }).then((r) => r.data);

export const editarSecaoAoVivo = (eventoId, nomeCorrespondente, horaReal) =>
  chamar("editarSecaoAoVivo")({ eventoId, nomeCorrespondente, horaReal }).then((r) => r.data);

export const definirCorrespondenciaFreeshow = (mapa) =>
  chamar("definirCorrespondenciaFreeshow")({ mapa }).then((r) => r.data);
