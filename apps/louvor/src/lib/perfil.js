/**
 * `aniversario` (MM-DD) é só desta base — fica aqui, não em
 * @portal/shared/lib/perfil.js, para não obrigar as outras cinco a
 * carregar um campo que não usam (ver CLAUDE.md desta base).
 */
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const guardarAniversario = (uid, aniversario) =>
  updateDoc(doc(db, `bases/${BASE_ID}/pessoas/${uid}`), { aniversario, atualizadoEm: serverTimestamp() });
