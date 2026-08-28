/**
 * Verificação só de leitura antes de semear a escala da Base Pessoal:
 * confirma os ids reais de Robson/Miqueias (Apoio) e Hans (Técnica),
 * e que os 5 eventos de agosto existem. Script de uso único.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/verificarPessoasEscalaPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function acharPorNome(nomeAprox) {
  const snap = await db.collection("pessoas").get();
  return snap.docs
    .filter((d) => (d.data().nome || "").toLowerCase().includes(nomeAprox.toLowerCase()))
    .map((d) => ({ id: d.id, nome: d.data().nome, bases: d.data().bases }));
}

async function main() {
  console.log("=== Robson ===");
  console.log(await acharPorNome("robson"));
  console.log("\n=== Miqueias ===");
  console.log(await acharPorNome("miqueias"));
  console.log("\n=== Hans ===");
  console.log(await acharPorNome("hans"));

  console.log("\n=== Eventos de agosto 2026 ===");
  for (const dia of ["02", "09", "16", "23", "30"]) {
    const id = `2026-08-${dia}`;
    const doc = await db.doc(`eventos/${id}`).get();
    console.log(`${id}: ${doc.exists ? "existe" : "NÃO EXISTE"}`);
  }

  console.log("\n=== Funções já existentes na Pessoal ===");
  const funcoes = await db.collection("bases/pessoal/funcoes").get();
  funcoes.forEach((d) => console.log(`${d.id}: ${d.data().nome}`));

  console.log("\n=== Pessoas já na Pessoal ===");
  const pessoas = await db.collection("bases/pessoal/pessoas").get();
  pessoas.forEach((d) => console.log(`${d.id}: ${d.data().nome}`));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
