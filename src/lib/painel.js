/**
 * Dados e ações do Painel do líder.
 *
 * Escala e catálogo de funções escrevem-se diretamente no Firestore —
 * as regras já só deixam o líder da base fazê-lo (ver firestore.rules).
 * Criar/editar/remover pessoas e criar cultos especiais passam sempre
 * pelas Cloud Functions: o papel e a existência de um culto são coisas
 * que o cliente não pode decidir sozinho.
 */
import {
  query, where, orderBy, onSnapshot, getDocs, getDoc,
  doc, setDoc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db, chamar, BASE_ID } from "./firebase";
import { cPessoas, cFuncoes, cEventos, cEscala } from "./modelo";
import { corPara } from "./cores";

/* ── voluntários ──────────────────────────────────────────── */
export function ouvirVoluntarios(cb) {
  const q = query(cPessoas(), where("ativo", "==", true), orderBy("nome"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d, i) => ({ id: d.id, ...d.data(), cor: corPara(i) })));
  });
}

export const criarVoluntario = (dados) => chamar("criarVoluntario")(dados).then((r) => r.data);
export const editarVoluntario = (dados) => chamar("editarVoluntario")(dados).then((r) => r.data);
export const removerVoluntario = (pessoaId) => chamar("removerVoluntario")({ pessoaId }).then((r) => r.data);
export const reporPin = (pessoaId) => chamar("reporPin")({ pessoaId }).then((r) => r.data);

/* ── catálogo de funções ──────────────────────────────────── */
export function ouvirFuncoes(cb) {
  const q = query(cFuncoes(), where("ativa", "==", true), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function guardarFuncao(funcaoId, dados) {
  if (funcaoId) {
    await updateDoc(doc(db, `bases/${BASE_ID}/funcoes/${funcaoId}`), dados);
    return funcaoId;
  }
  const ref = await addDoc(cFuncoes(), {
    ...dados, ativa: true, ordem: 0, criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export const desativarFuncao = (funcaoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/funcoes/${funcaoId}`), { ativa: false });

/* ── escala do mês ────────────────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, "0");

export async function obterEventosDoMes(ano, mesIndex) {
  const inicio = `${ano}-${pad2(mesIndex + 1)}-01`;
  const fim = new Date(Date.UTC(ano, mesIndex + 1, 1)).toISOString().slice(0, 10);
  const q = query(cEventos(), where("data", ">=", inicio), where("data", "<", fim), orderBy("data"));
  const snap = await getDocs(q);
  const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Promise.all(
    eventos.map(async (ev) => {
      const esc = await getDoc(cEscala(ev.id));
      return { ...ev, escala: esc.exists() ? esc.data() : { pessoas: [], liderEscala: null } };
    })
  );
}

export const guardarEscala = (eventoId, { pessoas, liderEscala }) =>
  setDoc(cEscala(eventoId), { pessoas, liderEscala, baseId: BASE_ID }, { merge: true });

export const criarCultoEspecial = (dados) => chamar("criarCultoEspecial")(dados).then((r) => r.data);
