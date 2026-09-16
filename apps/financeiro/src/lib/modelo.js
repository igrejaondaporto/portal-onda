/**
 * Caminhos do Firestore usados por esta app.
 *
 * O Financeiro não tem escala, funções nem culto — só gente
 * (`bases/financeiro/pessoas`, para entrar por PIN, como qualquer
 * base) e os reembolsos de TODAS as bases, lidos por
 * `lib/reembolsosFinanceiro.js` (collectionGroup, não por aqui).
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase    = () => doc(db, "bases", BASE_ID);
export const cPessoas = () => collection(db, `bases/${BASE_ID}/pessoas`);
