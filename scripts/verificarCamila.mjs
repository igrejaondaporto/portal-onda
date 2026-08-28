/**
 * Verificação só de leitura: confirma que a colisão de identidade da
 * Camila (Apoio vs Pessoal) está mesmo corrigida em produção — sem
 * escrever nada. Script de uso único; apagar depois de correr.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/verificarCamila.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function mostrar(id) {
  const global = await db.doc(`pessoas/${id}`).get();
  console.log(`\npessoas/${id}:`, global.exists ? global.data() : "não existe");
}

async function mostrarBase(baseId, id) {
  const doc = await db.doc(`bases/${baseId}/pessoas/${id}`).get();
  console.log(`bases/${baseId}/pessoas/${id}:`, doc.exists ? doc.data() : "não existe");
}

async function main() {
  await mostrar("camila");
  await mostrarBase("apoio", "camila");
  await mostrarBase("pessoal", "camila");

  await mostrar("camila-pessoal");
  await mostrarBase("pessoal", "camila-pessoal");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
