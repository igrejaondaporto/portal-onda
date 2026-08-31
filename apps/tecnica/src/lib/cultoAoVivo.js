/**
 * Ordem do culto ao vivo — as ações que só a Técnica pode pedir
 * (iniciar, descartar, editar uma hora, configurar a correspondência
 * de nomes). A leitura (ouvirCultoAoVivo) é igual em qualquer base,
 * por isso vive em @portal/shared/lib/cultoAoVivo.js — reexportada
 * aqui para quem já importava daqui não ter de mudar nada. Ver
 * functions/freeshow.js e o plano da funcionalidade para o desenho
 * completo — este ficheiro só espelha o padrão de culto.js.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

export { ouvirCultoAoVivo, sondarFreeshowAgora } from "@portal/shared/lib/cultoAoVivo.js";

export function ouvirCorrespondencia(cb) {
  return onSnapshot(doc(db, "bases/tecnica/config/correspondenciaFreeshow"), (snap) => {
    cb(snap.exists() ? snap.data().mapa || {} : {});
  });
}

export const iniciarCultoAoVivo = (eventoId) =>
  chamar("iniciarCultoAoVivo")({ eventoId }).then((r) => r.data);

export const descartarCultoAoVivo = (eventoId) =>
  chamar("descartarCultoAoVivo")({ eventoId }).then((r) => r.data);

/** Fecha o culto na hora — em vez de esperar os 30 min de silêncio do
 *  fecho automático. Grava o arquivo para o Painel do Pastor e liberta
 *  o ponteiro já. */
export const finalizarCultoAoVivo = (eventoId) =>
  chamar("finalizarCultoAoVivo")({ eventoId }).then((r) => r.data);

export const editarSecaoAoVivo = (eventoId, nomeCorrespondente, horaReal) =>
  chamar("editarSecaoAoVivo")({ eventoId, nomeCorrespondente, horaReal }).then((r) => r.data);

/** Corrige uma secção "não previsto" (nome do FreeShow sem
 *  correspondência) para o momento certo, em vez de criar uma entrada
 *  nova a mão — ver o comentário de reassociarSecaoAoVivo em
 *  functions/index.js. */
export const reassociarSecaoAoVivo = (eventoId, idFreeshow, nomeCorrespondente) =>
  chamar("reassociarSecaoAoVivo")({ eventoId, idFreeshow, nomeCorrespondente }).then((r) => r.data);

export const definirCorrespondenciaFreeshow = (mapa) =>
  chamar("definirCorrespondenciaFreeshow")({ mapa }).then((r) => r.data);
