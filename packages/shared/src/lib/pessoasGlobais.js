/**
 * Ligar um voluntário que já existe noutra base, em vez de criar uma
 * identidade duplicada (ex.: o Vitor já está na Apoio e vai servir
 * também na Técnica) — ver CLAUDE.md da raiz, regra 6.
 */
import { collection, getDocs } from "firebase/firestore";
import { db, chamar, BASE_ID } from "./firebase.js";

/** bases/{id} é legível por qualquer pessoa autenticada (só
 *  nome/horas/cor, nada sensível — ver firestore.rules) — dá para
 *  listar direto do cliente, sem Cloud Function. */
export async function listarBasesParaLigar() {
  const snap = await getDocs(collection(db, "bases"));
  return snap.docs
    .filter((d) => d.id !== BASE_ID)
    .map((d) => ({ id: d.id, nome: d.data().nome || d.id }));
}

/** bases/{outra}/pessoas é fechado à própria base (ver firestore.rules)
 *  — isto passa pela Cloud Function, que devolve só nome e foto. */
export const listarPessoasDaBase = (baseId) =>
  chamar("listarPessoasDaBase")({ baseId }).then((r) => r.data.pessoas);
