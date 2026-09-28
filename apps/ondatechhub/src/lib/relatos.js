/**
 * Lado do Onda Tech Hub: vê e tria os relatos de TODAS as bases — o
 * lado "qualquer pessoa reporta" vive em packages/shared/lib/relatos.js
 * (genuinamente igual em qualquer base, usado pelo MenuEu).
 */
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

/** Sem `where`: a rule (minhaBase('ondatechhub')) já deixa esta base
 *  ler a coleção inteira — é para isso que ela existe. */
export function ouvirTodosRelatos(cb) {
  const q = query(collection(db, "relatos"), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.ativo !== false)));
}

export const mudarStatusRelato = (dados) => chamar("mudarStatusRelato")(dados).then((r) => r.data);

/** Nome de exibição de cada base — `baseOrigemId` no relato é sempre
 *  a chave interna, nunca o que se mostra. Lista fixa (mesmo padrão
 *  de NOMES_BASE em apps/comunicacao/src/lib/solicitacoes.js), mas
 *  com as 12 — um relato pode vir de qualquer base, ao contrário de
 *  uma solicitação à Comunicação. */
export const NOMES_BASE = {
  apoio: "Apoio", tecnica: "Técnica", backstage: "Backstage", comunicacao: "Comunicação",
  pessoal: "Pessoal", louvor: "Louvor", louvorkinder: "Louvor Kinder", new: "New",
  shift: "SHIFT", kinder: "Kinder", financeiro: "Financeiro", pastoral: "Pastoral",
};
export const nomeBase = (id) => NOMES_BASE[id] || id;
