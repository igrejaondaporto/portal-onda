/**
 * Renomeia a função "Drive" (id fixo "drive", ver apps/pessoal/CLAUDE.md)
 * para "Mapa" — o nome antigo colidia com a função "Acomodação" (papel
 * diferente: leva as pessoas até ao lugar) e causava confusão real sobre
 * qual função desbloqueia o mapa do auditório. O id "drive" fica igual
 * (reservado, rules/Cloud Functions apontam para ele) — só o nome visível
 * muda. Script de uso único; apagar depois de correr.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/renomearFuncaoMapa.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  await db.doc("bases/pessoal/funcoes/drive").set({ nome: "Mapa" }, { merge: true });
  console.log('Função "drive" renomeada para "Mapa".');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
