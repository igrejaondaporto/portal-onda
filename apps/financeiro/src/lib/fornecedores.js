/**
 * Fornecedores e despesas fixas — gastos recorrentes (renda,
 * subscrições, contrato de limpeza…) que não nascem de um pedido de
 * reembolso de nenhuma base. Dado só do Financeiro, sem cruzamento de
 * base nem autoria mista, por isso escrita direta do cliente (ver
 * firestore.rules). `despesasFixas` é o histórico de pagamento —
 * só cria, nunca edita nem apaga, como inventario/movimentos.
 */
import {
  query, orderBy, onSnapshot, collection, doc, setDoc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

const cFornecedores = () => collection(db, `bases/${BASE_ID}/fornecedores`);
const cDespesasFixas = () => collection(db, `bases/${BASE_ID}/despesasFixas`);

export function ouvirFornecedores(cb) {
  const q = query(cFornecedores(), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirDespesasFixas(cb) {
  const q = query(cDespesasFixas(), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novoFornecedorId = () => doc(cFornecedores()).id;

export async function criarFornecedor(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/fornecedores/${id}`), {
    ...dados, ativo: true, criadoEm: serverTimestamp(),
  });
  return id;
}

export async function editarFornecedor(id, dados) {
  await updateDoc(doc(db, `bases/${BASE_ID}/fornecedores/${id}`), dados);
}

export const desativarFornecedor = (id) => editarFornecedor(id, { ativo: false });
export const reativarFornecedor = (id) => editarFornecedor(id, { ativo: true });

export async function registarDespesaFixa(uid, { fornecedorId, fornecedorNome, categoria, valor, metodo, referencia }) {
  await addDoc(cDespesasFixas(), {
    fornecedorId, fornecedorNome, categoria, valor,
    metodo, referencia: referencia || "",
    criadoPor: uid, criadoEm: serverTimestamp(),
  });
}
