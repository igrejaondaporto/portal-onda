/**
 * Migração única: grava os sete papéis que já existiam em código
 * (`PAPEIS_PADRAO`, apps/louvor/src/lib/modelo.js) em
 * `bases/louvor/definicoes/papeisEscala`, para a Base Louvor arrancar
 * com o mesmo catálogo de sempre no editor novo (Definições da base →
 * Papéis da escala, pedido do líder 2026-09 — ver CLAUDE.md dessa
 * base). Sem isto, a app já funciona igual (cai em PAPEIS_PADRAO
 * enquanto o doc não existir), mas o líder só vê a lista a sério
 * DEPOIS de este script correr — antes disso, "Editar" mostraria uma
 * lista vazia (o doc ainda não existe).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedPapeisEscalaLouvor.mjs
 *
 * Idempotente por desenho: só escreve se o documento ainda não
 * existir — nunca sobrescreve uma lista que o líder já tenha editado
 * pela app (correr duas vezes, ou depois de o líder já ter mexido, é
 * inofensivo).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "louvor";
const PAPEIS_PADRAO = [
  { id: "lead",     nome: "Lead",     cor: "#D62069", emoji: "🎤" },
  { id: "colead",   nome: "Co-lead",  cor: "#E85D8F", emoji: "🎤" },
  { id: "back",     nome: "Back",     cor: "#B565D8", emoji: "🎤" },
  { id: "teclado",  nome: "Teclado",  cor: "#7B5CFF", emoji: "🎹" },
  { id: "guitarra", nome: "Guitarra", cor: "#0092D4", emoji: "🎸" },
  { id: "baixo",    nome: "Baixo",    cor: "#F5A300", emoji: "🎸" },
  { id: "bateria",  nome: "Bateria",  cor: "#00A88F", emoji: "🥁" },
];

async function main() {
  const ref = db.doc(`bases/${BASE}/definicoes/papeisEscala`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`bases/${BASE}/definicoes/papeisEscala já existe (${(snap.data().lista || []).length} papéis) — nada a fazer.`);
    return;
  }
  await ref.set({ lista: PAPEIS_PADRAO, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`bases/${BASE}/definicoes/papeisEscala criado com ${PAPEIS_PADRAO.length} papéis (os sete de sempre).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
