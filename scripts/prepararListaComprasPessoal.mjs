/**
 * Duas coisas de uma vez, pedidas juntas:
 *  1) Mínimo 1 em todos os itens do inventário da Pessoal (estavam a 0).
 *  2) A primeira lista de compras aberta — sem isto o módulo não tem
 *     onde acrescentar itens (fechar já cria a seguinte sozinho, mas
 *     a primeira precisa de nascer por aqui).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/prepararListaComprasPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";

async function main() {
  console.log("1) Mínimo 1 em todos os itens…");
  const itens = await db.collection(`bases/${BASE}/inventario`).where("ativo", "==", true).get();
  for (const doc of itens.docs) {
    await doc.ref.set({ minimo: 1 }, { merge: true });
    console.log(`  ${doc.data().nome}: mínimo 1`);
  }

  console.log("\n2) Lista de compras aberta…");
  const existente = await db.collection(`bases/${BASE}/listasCompras`).where("estado", "==", "aberta").limit(1).get();
  if (!existente.empty) {
    console.log("  já existe uma lista aberta, nada a fazer.");
  } else {
    await db.collection(`bases/${BASE}/listasCompras`).doc().set({
      estado: "aberta", itens: [], criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("  criada.");
  }

  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
