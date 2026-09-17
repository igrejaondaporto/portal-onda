/**
 * Contagem da oferta — nota a nota, moeda a moeda, como se conta em
 * cima da mesa depois do culto. Coleção própria do Financeiro
 * (nenhuma outra base regista isto).
 *
 * Tudo em CÊNTIMOS, inteiros, do princípio ao fim: somar 0.1 + 0.2 em
 * vírgula flutuante dá 0.30000000000000004, e uma contagem de
 * dinheiro que não fecha ao cêntimo não serve para nada. Só na
 * apresentação é que se divide por 100.
 */
import {
  query, orderBy, onSnapshot, collection, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cContagens = () => collection(db, `bases/${BASE_ID}/contagensOferta`);

/** Notas de euro em circulação, da maior para a menor. A de 500 saiu
 *  de emissão em 2019 mas continua a ter curso legal — aparece na
 *  lista de propósito, é raro mas acontece. */
export const NOTAS = [50000, 20000, 10000, 5000, 2000, 1000, 500];
export const MOEDAS = [200, 100, 50, 20, 10, 5, 2, 1];

export const rotuloDenominacao = (centimos) =>
  centimos >= 100 ? `${centimos / 100} €` : `${centimos} cênt.`;

/** Soma um mapa {denominacaoEmCentimos: quantidade} → total em cêntimos. */
export function totalDe(mapa) {
  let total = 0;
  for (const [denominacao, quantidade] of Object.entries(mapa || {})) {
    total += Number(denominacao) * (Number(quantidade) || 0);
  }
  return total;
}

export const emEuros = (centimos) => (centimos || 0) / 100;

export function ouvirContagens(cb) {
  const q = query(cContagens(), orderBy("data", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaContagemId = () => doc(cContagens()).id;

/**
 * Grava (ou corrige) uma contagem. Ao contrário dos lançamentos de
 * dinheiro que já saíram, uma contagem PODE ser corrigida — contar
 * mal acontece, e obrigar a criar uma segunda contagem do mesmo culto
 * só faria o histórico mentir. Nunca se apaga (regra 5 do CLAUDE.md
 * raiz): corrige-se por cima, no mesmo documento.
 */
export async function guardarContagem(uid, id, { data, notas, moedas, observacao }) {
  const totalNotas = totalDe(notas);
  const totalMoedas = totalDe(moedas);
  await setDoc(doc(db, `bases/${BASE_ID}/contagensOferta/${id}`), {
    data, notas, moedas,
    totalNotas, totalMoedas, total: totalNotas + totalMoedas,
    observacao: observacao || "",
    contadoPor: uid, contadoEm: serverTimestamp(),
  }, { merge: true });
  return id;
}

/** O domingo mais recente (ou hoje, se hoje for domingo) em ISO — é o
 *  culto que se acabou de contar em 99% dos casos. */
export function domingoMaisRecente(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
