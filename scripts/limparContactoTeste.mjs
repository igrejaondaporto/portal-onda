/**
 * Apaga o contacto de teste "Ana Teste Silva" (nome inequivocamente
 * fictício, ver commit da funcionalidade) criado ao testar o
 * Formulário localmente contra o Firestore de produção — as regras
 * bloqueiam delete pelo cliente de propósito ("nada é apagado, é
 * desativado"), por isso este script admin, de uso único.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/limparContactoTeste.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("contactos").where("nome", "==", "Ana Teste Silva").get();
  if (snap.empty) { console.log("Nenhum contacto de teste encontrado — nada a fazer."); return; }
  for (const doc of snap.docs) {
    await doc.ref.delete();
    console.log(`Apagado: contactos/${doc.id}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
