import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, BASE_ID } from "./firebase.js";

/** Bases fora da regra "uma base por culto" — espelho de
 *  BASES_SEM_CONFLITO_CROSS_BASE (functions/index.js), que é quem
 *  decide a sério. A Apoio pode escalar quem já serve noutra base
 *  (e vice-versa); o Louvor Kinder toca no culto das crianças. */
export const BASES_SEM_CONFLITO = new Set(["louvorkinder", "apoio"]);

/** Esta base pode escalar quem já serve noutra no mesmo culto? */
export const podeEscalarMesmoAssim = BASES_SEM_CONFLITO.has(BASE_ID);

const nomesBases = {};
async function nomeDaBase(id) {
  if (!nomesBases[id]) {
    nomesBases[id] = getDoc(doc(db, `bases/${id}`))
      .then((s) => (s.data()?.nome ?? id).replace(/^Base (de |da |do )?/, ""))
      .catch(() => id);
  }
  return nomesBases[id];
}

/** uid → [nome da base] onde essa pessoa já está escalada neste culto,
 *  fora esta base — lido de `eventos/{e}/indisponibilidades` (leitura
 *  aberta a qualquer sessão), ao vivo. Só aparece quem serve em mais
 *  do que uma base: é só para esses que o servidor grava a marca. */
export function useOndeServe(eventoId) {
  const [mapa, setMapa] = useState({});
  useEffect(() => {
    if (!eventoId) return undefined;
    let vivo = true;
    const parar = onSnapshot(collection(db, `eventos/${eventoId}/indisponibilidades`), async (snap) => {
      const pares = await Promise.all(snap.docs.map(async (d) => {
        const outras = Object.keys(d.data().origens || {}).filter((b) => b !== BASE_ID && !BASES_SEM_CONFLITO.has(b));
        return [d.id, await Promise.all(outras.map(nomeDaBase))];
      }));
      if (vivo) setMapa(Object.fromEntries(pares.filter(([, bases]) => bases.length)));
    }, () => {});
    return () => { vivo = false; parar(); };
  }, [eventoId]);
  return mapa;
}

/** O texto que o líder lê por baixo do nome. */
export function textoOndeServe(bases) {
  if (!bases?.length) return null;
  const onde = bases.join(" e ");
  return podeEscalarMesmoAssim
    ? `Servirá na ${onde} neste dia`
    : `Já escalado(a) na ${onde} — não pode servir em duas bases no mesmo culto`;
}
