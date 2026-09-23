import { onSnapshot } from "firebase/firestore";
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
