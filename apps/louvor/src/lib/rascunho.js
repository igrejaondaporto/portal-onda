/**
 * Rascunho de escala — cobre vários domingos de uma vez, escondido
 * dos voluntários por desenho (só existe "escala" de verdade quando
 * publicado). Sempre por Cloud Function, sempre líder/auxiliar — ver
 * functions/index.js e CLAUDE.md desta base.
 */
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { cRascunhosEscala } from "./modelo";

export function ouvirRascunhos(cb) {
  const q = query(cRascunhosEscala(), where("ativo", "==", true), orderBy("atualizadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const guardarRascunho = (dados) => chamar("guardarRascunhoEscala")(dados).then((r) => r.data);
export const publicarRascunho = (rascunhoId) => chamar("publicarRascunhoEscala")({ rascunhoId }).then((r) => r.data);
export const excluirRascunho = (rascunhoId) => chamar("excluirRascunhoEscala")({ rascunhoId }).then((r) => r.data);

/** Publica a escala já gravada pela tabela rápida de sempre
 *  (SheetEscala.jsx), sem passar por rascunho. */
export const publicarEscala = (eventoId) => chamar("publicarEscalaLouvor")({ eventoId }).then((r) => r.data);
