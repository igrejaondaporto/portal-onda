/**
 * Resíduo do incidente da colisão de identidade da Camila
 * (scripts/corrigirColisaoCamila.mjs corrigiu `bases` e o PIN, mas
 * deixou `tourVisto.pessoal:true` na Camila real da Apoio — ela nunca
 * chegou a ver o tour da Pessoal, foi só a colisão a marcar isso).
 * Tira só essa chave, sem tocar em mais nada. Script de uso único.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/limparTourVistoCamila.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  await db.doc("pessoas/camila").update({
    "tourVisto.pessoal": admin.firestore.FieldValue.delete(),
  });
  console.log("tourVisto.pessoal removido de pessoas/camila.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
