/**
 * Confirmação final, só leitura: mostra a escala + atribuições de
 * 2026-08-23 (o dia com o lugar extra) e a lista de funções da Base
 * Pessoal, para conferir visualmente que o seed ficou certo.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  console.log("=== Funções da Pessoal ===");
  const funcoes = await db.collection("bases/pessoal/funcoes").get();
  funcoes.forEach((d) => console.log(`${d.id}: ${d.data().nome}`));

  console.log("\n=== Escala 2026-08-23 ===");
  const escala = await db.doc("eventos/2026-08-23/escalas/pessoal").get();
  console.log(JSON.stringify(escala.data()));

  console.log("\n=== Atribuições 2026-08-23 ===");
  const atrib = await db.collection("eventos/2026-08-23/atribuicoes").get();
  atrib.forEach((d) => console.log(`${d.id}: ${JSON.stringify(d.data().pessoas)}`));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
