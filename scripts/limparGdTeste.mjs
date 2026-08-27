/**
 * Apaga o GD de teste "GD Teste Verificação" criado ao validar o
 * Formulário — uso único.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/limparGdTeste.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("bases/pessoal/gds").where("nome", "==", "GD Teste Verificação").get();
  if (snap.empty) { console.log("Nenhum GD de teste encontrado — nada a fazer."); return; }
  for (const doc of snap.docs) {
    await doc.ref.delete();
    console.log(`Apagado: bases/pessoal/gds/${doc.id}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
