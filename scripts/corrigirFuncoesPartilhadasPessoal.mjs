/**
 * Corrige o excesso da atribuição automática anterior:
 * - "Ceia" só existia no dia 02/08 na folha — esvazia nos outros 4.
 * - "Contribua" em 30/08 não incluía a Géssica — tira-a de lá.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/corrigirFuncoesPartilhadasPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";
const LIDER = "camila-pessoal";

async function esvaziar(eventoId, funcaoId, nomeFuncao) {
  await db.doc(`eventos/${eventoId}/atribuicoes/${funcaoId}`).set({
    baseId: BASE, funcaoId, pessoas: [], nomeFuncao,
    atualizadoPor: LIDER, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ${eventoId} · ${funcaoId}: esvaziado`);
}

async function main() {
  console.log("Ceia — só existia em 02/08:");
  for (const eventoId of ["2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30"]) {
    await esvaziar(eventoId, "ceia", "Ceia");
  }

  console.log("\nContribua 30/08 — tirar a Géssica:");
  const ref = db.doc("eventos/2026-08-30/atribuicoes/contribua");
  const doc = await ref.get();
  const pessoas = (doc.data()?.pessoas || []).filter((id) => id !== "gessica");
  await ref.set({ pessoas }, { merge: true });
  console.log(`  ficou: ${JSON.stringify(pessoas)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
