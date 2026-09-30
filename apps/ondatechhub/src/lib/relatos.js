/**
 * Lado do Onda Tech Hub: vê e tria os relatos de TODAS as bases — o
 * lado "qualquer pessoa reporta" vive em packages/shared/lib/relatos.js
 * (genuinamente igual em qualquer base, usado pelo MenuEu).
 */
import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";

/** Sem `where`: a rule (minhaBase('ondatechhub')) já deixa esta base
 *  ler a coleção inteira — é para isso que ela existe. */
export function ouvirTodosRelatos(cb) {
  const q = query(collection(db, "relatos"), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.ativo !== false)));
}

export const mudarStatusRelato = (dados) => chamar("mudarStatusRelato")(dados).then((r) => r.data);

/** Sem `paraUid`: assumir (fica quem chama). Com ele: passar a outra
 *  pessoa do Onda Tech Hub. */
export const atribuirRelato = (dados) => chamar("atribuirRelato")(dados).then((r) => r.data);

/** Os membros ativos do Onda Tech Hub — para "passar a outra pessoa". */
export async function membrosTechHub() {
  const snap = await getDocs(collection(db, "bases/ondatechhub/pessoas"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.ativo !== false)
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
}

/** Nome de exibição de cada base — `baseOrigemId` no relato é sempre
 *  a chave interna, nunca o que se mostra. Lista fixa (mesmo padrão
 *  de NOMES_BASE em apps/comunicacao/src/lib/solicitacoes.js), mas
 *  com as 12 — um relato pode vir de qualquer base, ao contrário de
 *  uma solicitação à Comunicação. */
export const NOMES_BASE = {
  apoio: "Apoio", tecnica: "Técnica", backstage: "Backstage", comunicacao: "Comunicação",
  pessoal: "Pessoal", louvor: "Louvor", louvorkinder: "Louvor Kinder", new: "New",
  shift: "SHIFT", kinder: "Kinder", financeiro: "Financeiro", pastoral: "Pastoral",
  ondatechhub: "Onda Tech Hub",
};
export const nomeBase = (id) => NOMES_BASE[id] || id;
