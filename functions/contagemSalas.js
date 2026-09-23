/**
 * Contagem de crianças por sala — Kinder (Baby/Fun/Júnior), SHIFT e
 * New — escrita direto em `eventos/{e}/contagem/geral.categorias`, o
 * MESMO documento que a Base Pessoal já usa (ver `apps/pessoal/src/
 * lib/contagem.js`). Ficheiro próprio pelo mesmo motivo de kinder.js/
 * mural.js/pastoral.js: uma fronteira nítida, sem inchar index.js.
 *
 * Cloud Function em vez de regra aberta: cada base só pode escrever a
 * sua própria categoria dentro do mapa `categorias` — uma regra do
 * Firestore distingue documentos, não campos dentro do mesmo mapa, e
 * abrir a escrita a três bases mais nessa coleção deixaria qualquer
 * uma escrever por cima de qualquer categoria de outra base ou da
 * própria Pessoal, por engano.
 *
 * Pedido 2026-09: "quero que logo NA TELA inicial do domingo já
 * apareça um POP UP GRANDE perguntando quantas crianças estão
 * presentes... e essa contagem JA VA direto pra contagem da base
 * pessoal, que tbm ja apareça na contagem do Painel Pastoral."
 */
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

const db = () => admin.firestore();

/** Que categorias cada base pode escrever. A Kinder tem três salas —
 *  as outras duas só a sua própria (sem "auxiliar" em SHIFT/New,
 *  `BASES_COM_AUXILIAR` em index.js, por isso não têm líder de sala
 *  nenhuma para isolar). */
const CATEGORIAS_POR_BASE = {
  kinder: ["baby", "fun", "junior"],
  shift: ["shift"],
  new: ["new"],
};

export const registarContagemSala = onCall(async (req) => {
  const baseId = req.auth?.token?.baseId;
  const papel = req.auth?.token?.papel;
  const permitidas = CATEGORIAS_POR_BASE[baseId];
  if (!permitidas) throw new HttpsError("permission-denied", "Esta base não regista contagem de crianças.");

  const { eventoId, categoria, valor } = req.data || {};
  if (!eventoId || !permitidas.includes(categoria)) {
    throw new HttpsError("invalid-argument", "Categoria inválida para esta base.");
  }

  // Kinder: a líder geral preenche as três salas; uma líder de sala
  // (papel "auxiliar", ver BASES_COM_AUXILIAR em index.js) só a
  // própria — mesmo isolamento por sala do resto da Kinder (CLAUDE.md
  // dela: "Baby não vê nada do Fun..."). SHIFT/New não têm papel
  // "auxiliar" nenhum, por isso é sempre a líder da base.
  if (baseId === "kinder" && papel !== "lider_base") {
    if (papel !== "auxiliar") throw new HttpsError("permission-denied", "Só a líder pode preencher esta contagem.");
    const pessoaSnap = await db().doc(`bases/kinder/pessoas/${req.auth.uid}`).get();
    if (!pessoaSnap.exists || pessoaSnap.data().categoria !== categoria) {
      throw new HttpsError("permission-denied", "Só a líder da tua sala pode preencher esta contagem.");
    }
  } else if (baseId !== "kinder" && papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só a líder da base pode preencher esta contagem.");
  }

  let valorNormalizado = null;
  if (valor !== null && valor !== undefined) {
    valorNormalizado = Number(valor);
    if (!Number.isInteger(valorNormalizado) || valorNormalizado < 0) {
      throw new HttpsError("invalid-argument", "Introduz um número inteiro igual ou superior a zero.");
    }
  }

  await db().doc(`eventos/${eventoId}/contagem/geral`).set({
    eventoId,
    categorias: {
      [categoria]: {
        valor: valorNormalizado,
        origem: "automatica",
        preenchidoPor: req.auth.uid,
        preenchidoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});
