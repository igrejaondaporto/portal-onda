/**
 * Migração única: copia bases/pessoal/gds/{id} → gds/{id} (coleção
 * global — ver a nota "GLOBAL" em apps/pessoal/src/lib/modelo.js).
 *
 * Corre isto UMA VEZ em produção, depois de fazer deploy destas
 * `firestore.rules`, e antes (ou junto) do primeiro deploy do Mural
 * Onda. `merge:true` + id igual ao original: correr duas vezes não
 * duplica nem perde nada, só reescreve os mesmos campos.
 *
 * Não apaga bases/pessoal/gds/{id} — por agora os dois caminhos
 * coexistem sem mal nenhum (a Pessoal já lê só do global depois deste
 * deploy); a coleção antiga fica como cópia de segurança até
 * confirmarmos que está tudo bem, e pode ser limpa à mão mais tarde.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/migrarGDsParaGlobal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("bases/pessoal/gds").get();
  if (snap.empty) {
    console.log("bases/pessoal/gds está vazia — nada para migrar (já correu antes, ou o seed ainda não foi feito).");
    return;
  }
  console.log(`A migrar ${snap.size} GDs para a coleção global…\n`);
  for (const doc of snap.docs) {
    await db.doc(`gds/${doc.id}`).set(doc.data(), { merge: true });
    console.log(`  ✓ ${doc.id}`);
  }
  console.log(`\n${snap.size} GDs copiados para gds/{id}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
