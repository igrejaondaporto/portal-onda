import { getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { cContagem } from "./modelo";

/**
 * As categorias não formam um total. Cada uma é guardada separadamente
 * para preservar o significado que já tem no relatório do culto.
 *
 * "Membros" saiu (pedido 2026-09) — sem padrão de preenchimento a
 * sério, ninguém contava.
 *
 * "Junior Fun" era uma categoria só porque os painéis das salas ainda
 * não existiam; separada em "junior"/"fun" (pedido 2026-09, no mesmo
 * lote em que as quatro últimas passam a `origem: "automatica"`, ver
 * `CATEGORIA_SALA` em cada painel de sala — Kinder, SHIFT, New).
 */
export const CATEGORIAS_CONTAGEM = [
  { id: "visitantes", nome: "Visitantes", grupo: "Auditório", descricao: "Quem visita pela primeira vez" },
  { id: "voluntarios", nome: "Voluntários", grupo: "Auditório", descricao: "Equipa a servir neste culto" },
  { id: "mensagem", nome: "Mensagem", grupo: "Resposta", descricao: "Pessoas que estavam presentes durante a mensagem" },
  { id: "apelo", nome: "Apelo", grupo: "Resposta", descricao: "Pessoas que responderam ao apelo" },
  { id: "new", nome: "New", grupo: "Salas", descricao: "Preenchido pelo painel da New" },
  { id: "shift", nome: "Shift", grupo: "Salas", descricao: "Preenchido pelo painel do SHIFT" },
  { id: "junior", nome: "Júnior", grupo: "Salas", descricao: "Preenchido pelo painel da Kinder" },
  { id: "fun", nome: "Fun", grupo: "Salas", descricao: "Preenchido pelo painel da Kinder" },
  { id: "baby", nome: "Baby", grupo: "Salas", descricao: "Preenchido pelo painel da Kinder" },
];

/** Documento único por culto, ouvido ao vivo como o mapa de Acomodação. */
export function ouvirContagem(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cContagem(eventoId), (snap) => cb(snap.exists() ? snap.data() : null));
}

/** Leitura pontual (não ao vivo) — para o histórico, que lista vários cultos de uma vez. */
export async function obterContagem(eventoId) {
  const snap = await getDoc(cContagem(eventoId));
  return snap.exists() ? snap.data() : null;
}

/** Campo vazio é válido; os restantes valores têm de ser inteiros positivos ou zero. */
export function normalizarValorContagem(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error("Introduz um número inteiro igual ou superior a zero.");
  }
  return numero;
}

/**
 * Atualiza só uma categoria, mantendo os restantes campos do documento.
 * O setDoc com merge permite criar a contagem no primeiro toque e continua
 * a funcionar com a escrita offline do Firestore.
 */
export async function guardarCategoriaContagem(eventoId, categoriaId, valor, uid) {
  const valorNormalizado = normalizarValorContagem(valor);
  await setDoc(cContagem(eventoId), {
    eventoId,
    categorias: {
      [categoriaId]: {
        valor: valorNormalizado,
        origem: "manual",
        preenchidoPor: uid,
        preenchidoEm: serverTimestamp(),
      },
    },
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

/**
 * Repõe as nove categorias a "por contar" — para recomeçar a
 * contagem de um culto. As regras não deixam apagar o documento
 * (histórico do culto), por isso volta cada campo a `valor: null`
 * em vez de um `delete`.
 */
export async function limparContagem(eventoId) {
  const categorias = Object.fromEntries(CATEGORIAS_CONTAGEM.map((c) => [
    c.id,
    { valor: null, origem: "manual", preenchidoPor: null, preenchidoEm: null },
  ]));
  await setDoc(cContagem(eventoId), {
    eventoId, categorias, finalizadoEm: null, finalizadoPor: null, atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

/**
 * Cada categoria já grava sozinha, ao toque — este botão não é o que
 * torna a contagem persistente, é a confirmação de "terminei", que é
 * o que a faz aparecer no histórico de cultos contados (mesmo padrão
 * do Formulário/Acomodação: um marco explícito, não um rascunho).
 */
export async function finalizarContagem(eventoId, uid) {
  await setDoc(cContagem(eventoId), {
    eventoId, finalizadoEm: serverTimestamp(), finalizadoPor: uid,
  }, { merge: true });
}
