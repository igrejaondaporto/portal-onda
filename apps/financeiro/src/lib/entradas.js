/**
 * Dinheiro que entra — dízimos, ofertas e outras receitas da igreja,
 * lançadas pelo próprio Financeiro (nenhuma outra base regista isto,
 * ao contrário dos reembolsos). Registo imutável, mesmo padrão de
 * despesasFixas: corrige-se com um lançamento novo, nunca editando
 * o antigo.
 *
 * `fontesEntrada` é o equivalente, do lado da receita, de
 * `fornecedores` do lado da despesa — receita recorrente que não é
 * dízimo/oferta de culto (aluguel de uma sala, uma doação mensal já
 * combinada). Só serve para pré-preencher o registo em `entradas`;
 * a fonte em si não é uma entrada.
 */
import {
  query, orderBy, onSnapshot, collection, doc, setDoc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cEntradas = () => collection(db, `bases/${BASE_ID}/entradas`);
const cFontesEntrada = () => collection(db, `bases/${BASE_ID}/fontesEntrada`);

// Tipos de receita comuns numa igreja local — dízimo/oferta são o
// grosso do domingo; os demais cobrem o resto do que costuma aparecer
// num caixa: campanhas pontuais, aluguel de espaço, um evento pago.
export const FUNDOS = [
  ["dizimo", "Dízimo"],
  ["oferta", "Oferta"],
  ["oferta_especial", "Oferta especial / campanha"],
  ["missoes", "Missões"],
  ["obras", "Obras / construção"],
  ["aluguel", "Aluguel de espaço"],
  ["evento", "Evento"],
  ["outro", "Outro"],
];
export const ROTULO_FUNDO = Object.fromEntries(FUNDOS);

export const METODOS_ENTRADA = [
  ["dinheiro", "Dinheiro"],
  ["mbway", "MB Way"],
  ["transferencia", "Transferência"],
];
export const ROTULO_METODO_ENTRADA = Object.fromEntries(METODOS_ENTRADA);

export function ouvirEntradas(cb) {
  const q = query(cEntradas(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function registarEntrada(uid, { valor, fundo, metodo, referencia, fonteId, fonteNome }) {
  await addDoc(cEntradas(), {
    valor, fundo, metodo, referencia: referencia || "",
    fonteId: fonteId || null, fonteNome: fonteNome || null,
    criadoPor: uid, criadoEm: serverTimestamp(),
  });
}

/* ── fontes fixas de entrada (receita recorrente) ──────────────── */
export function ouvirFontesEntrada(cb) {
  const q = query(cFontesEntrada(), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaFonteEntradaId = () => doc(cFontesEntrada()).id;

export async function criarFonteEntrada(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/fontesEntrada/${id}`), {
    ...dados, ativo: true, criadoEm: serverTimestamp(),
  });
  return id;
}

export async function editarFonteEntrada(id, dados) {
  await updateDoc(doc(db, `bases/${BASE_ID}/fontesEntrada/${id}`), dados);
}

export const desativarFonteEntrada = (id) => editarFonteEntrada(id, { ativo: false });
export const reativarFonteEntrada = (id) => editarFonteEntrada(id, { ativo: true });
