import { onSnapshot } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { cRepertorioLouvorKinder } from "./modelo";

/** Ao vivo — o Louvor Kinder pode mexer no repertório até ao domingo.
 *  Um erro (ex.: sem permissão) mostra o mesmo que "ainda sem
 *  repertório", em vez de partir o Início. */
export function ouvirRepertorioLouvorKinder(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(
    cRepertorioLouvorKinder(eventoId),
    (s) => cb(s.exists() ? s.data() : null),
    () => cb(null),
  );
}

/** Quem toca no Louvor Kinder nesse culto — `[{ nome, papeis[] }]`,
 *  uma entrada por pessoa. Por Cloud Function (escalaLouvorKinderDoCulto),
 *  porque a Kinder não lê a escala nem os perfis do Louvor Kinder:
 *  a função devolve só o nome e os papéis. Leitura única (não ao vivo);
 *  um erro devolve lista vazia — nunca parte o ecrã. */
export async function obterEscalaLouvorKinder(eventoId) {
  if (!eventoId) return [];
  try {
    const r = await chamar("escalaLouvorKinderDoCulto")({ eventoId });
    return r.data?.escalados ?? [];
  } catch {
    return [];
  }
}

/** Os papéis da escala do Louvor Kinder — cópia de `PAPEIS` em
 *  apps/louvorkinder/src/lib/modelo.js (outra app, não dá para
 *  importar). Um papel novo lá sem linha aqui aparece pelo id. */
const PAPEIS_LOUVOR_KINDER = { voz: "🎤 Voz", violao: "🎸 Violão", cajon: "🥁 Cajón" };
export const nomePapelLouvorKinder = (id) => PAPEIS_LOUVOR_KINDER[id] ?? id;
