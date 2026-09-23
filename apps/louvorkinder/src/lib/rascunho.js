/**
 * Rascunho de escala — cobre vários domingos de uma vez, escondido
 * dos voluntários por desenho (só existe "escala" de verdade quando
 * publicado). Sempre por Cloud Function, sempre líder/auxiliar — ver
 * functions/index.js e CLAUDE.md desta base.
 */
import { doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";
import { cRascunhosEscala, cEscala } from "./modelo";

const ESCALA_VAZIA = { pessoas: [], liderEscala: null, escalados: [] };

export function ouvirRascunhos(cb) {
  const q = query(cRascunhosEscala(), where("ativo", "==", true), orderBy("atualizadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Como obterEventosPorIds (lib/enquetes.js), mas também traz a
 *  escala ao vivo de cada culto — o editor de rascunho precisa disto
 *  para saber se já tem ensaio marcado (dataEnsaio vive na escala ao
 *  vivo, é escrita direta via definirDetalhesCultoLouvor mesmo a
 *  meio de um rascunho — ensaio não é "quem serve", pode ficar
 *  visível cedo). Usado só ao abrir um rascunho já existente. */
export async function obterDetalhesCultos(ids) {
  const pares = await Promise.all(ids.map(async (id) => {
    const [evSnap, escSnap] = await Promise.all([getDoc(doc(db, `eventos/${id}`)), getDoc(cEscala(id))]);
    const ev = evSnap.exists() ? { id, ...evSnap.data() } : { id, data: id };
    const escala = escSnap.exists() ? { ...ESCALA_VAZIA, ...escSnap.data() } : ESCALA_VAZIA;
    return [id, { ...ev, escala }];
  }));
  return Object.fromEntries(pares);
}

export const guardarRascunho = (dados) => chamar("guardarRascunhoEscala")(dados).then((r) => r.data);
export const publicarRascunho = (rascunhoId) => chamar("publicarRascunhoEscala")({ rascunhoId }).then((r) => r.data);
export const excluirRascunho = (rascunhoId) => chamar("excluirRascunhoEscala")({ rascunhoId }).then((r) => r.data);

/** Publica a escala já gravada pela tabela rápida de sempre
 *  (SheetEscala.jsx), sem passar por rascunho. */
export const publicarEscala = (eventoId) => chamar("publicarEscalaLouvor")({ eventoId }).then((r) => r.data);
