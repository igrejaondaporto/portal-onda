import { readFileSync } from "node:fs";
import admin from "firebase-admin";
const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const snap = await db.collection("pessoas").where("nome", ">=", "Hans").where("nome", "<", "Hant").get();
for (const doc of snap.docs) {
  console.log(doc.id, JSON.stringify(doc.data(), null, 2));
}
if (snap.empty) console.log("Nenhuma pessoa com nome começado por Hans encontrada por range query — a tentar id direto 'hans'...");
const direto = await db.doc("pessoas/hans").get();
console.log("pessoas/hans existe?", direto.exists, direto.exists ? JSON.stringify(direto.data()) : "");
process.exit(0);
