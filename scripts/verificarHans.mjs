import { readFileSync } from "node:fs";
import admin from "firebase-admin";
const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const global = await db.doc("pessoas/hans").get();
console.log("pessoas/hans:", JSON.stringify(global.data()));

const local = await db.doc("bases/pessoal/pessoas/hans").get();
console.log("bases/pessoal/pessoas/hans existe?", local.exists);
if (local.exists) console.log(JSON.stringify(local.data()));

process.exit(0);
