import { readFileSync } from "node:fs";
import admin from "firebase-admin";
const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
async function main() {
  const funcoes = await db.collection("bases/pessoal/funcoes").get();
  funcoes.forEach((d) => console.log(`${d.id}: ${d.data().nome}`));
  const atrib = await db.doc("eventos/2026-08-02/atribuicoes/visitantes").get();
  console.log("visitantes 02/08:", JSON.stringify(atrib.data()));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
