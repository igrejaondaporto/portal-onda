import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";

/** Catálogo global de GDs (ver a nota "GLOBAL" em
 *  apps/pessoal/src/lib/modelo.js) — o mesmo que a Base Pessoal usa,
 *  só que aqui é só para o ecrã de entrada saber "onde" colocar quem
 *  não é voluntário. */
export function ouvirGDs(cb) {
  return onSnapshot(query(collection(db, "gds"), orderBy("regiao"), orderBy("nome")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
