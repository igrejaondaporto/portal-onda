/**
 * Marca `bases/{financeiro,pastoral}.semEscalaDeCulto = true`.
 *
 * As duas nunca escalam ninguém para o culto de domingo (Financeiro:
 * "não tem escala, funções nem culto — só gente", ver
 * apps/financeiro/src/lib/modelo.js; Pastoral: ver
 * apps/pastoral/CLAUDE.md). Sem esta marca, "sem escala" ficava
 * permanentemente vermelho para as duas em qualquer ecrã cruzado —
 * `Bases.jsx` e `Domingo.jsx` do Painel Pastoral, e a própria
 * `Escala.jsx` da Backstage — reportado 2026-09 ("nunca vai ter
 * escala mesmo. Nem o Financeiro").
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/marcarBasesSemEscalaDeCulto.mjs
 *
 * Idempotente (merge) — repetir não faz mal nenhum.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASES = ["financeiro", "pastoral"];

async function main() {
  for (const baseId of BASES) {
    await db.doc(`bases/${baseId}`).set({ semEscalaDeCulto: true }, { merge: true });
    console.log(`bases/${baseId}.semEscalaDeCulto = true`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
