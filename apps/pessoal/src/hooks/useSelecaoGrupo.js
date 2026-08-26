import { useState } from "react";
import { melhorBloco } from "../lib/geometriaAuditorio";

/** "Chegou grupo de N" — seleção local (não escreve no Firestore até confirmar). */
export function useSelecaoGrupo(planta, lugaresEstado) {
  const [sel, setSel] = useState([]);
  const [n, setN] = useState(null);

  function pedir(tamanho) {
    const ids = melhorBloco(planta, lugaresEstado, tamanho);
    if (!ids) { setSel([]); setN(null); return { ok: false }; }
    setSel(ids); setN(tamanho);
    return { ok: true, ids };
  }

  function limpar() { setSel([]); setN(null); }

  return { sel, n, pedir, limpar };
}
