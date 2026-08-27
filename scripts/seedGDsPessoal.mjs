/**
 * Semeia o catálogo de GDs da Base Pessoal (bases/pessoal/gds/{id})
 * com a lista real passada pelo dono do produto. Região é só uma de
 * três macro-zonas (Norte, Lisboa, Sines) — pedido explícito, para
 * não fragmentar o select em muitos grupos pequenos.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedGDsPessoal.mjs
 *
 * Id determinístico (slug do nome) — repetir não duplica, merge:true.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const GDS = [
  ["brito-capelo", "Brito Capelo", "Norte"],
  ["arca-dagua", "Arca d'Água", "Norte"],
  ["barcelos", "Barcelos", "Norte"],
  ["fanzeres", "Fânzeres", "Norte"],
  ["gaia", "Gaia", "Norte"],
  ["lisboa", "Lisboa", "Lisboa"],
  ["new-sines", "New - Sines", "Sines"],
  ["piscina-sines", "Piscina - Sines", "Sines"],
  ["povoa-de-varzim", "Póvoa de Varzim", "Norte"],
  ["santo-andre-sines", "Santo André - Sines", "Sines"],
  ["sao-joao-da-madeira", "São João da Madeira", "Norte"],
  ["sao-mamede", "São Mamede", "Norte"],
  ["vila-do-conde", "Vila do Conde", "Norte"],
  ["vila-do-conde-unvt", "Vila do Conde UNVT", "Norte"],
];

async function main() {
  console.log("A semear os GDs da Base Pessoal…\n");
  for (const [id, nome, regiao] of GDS) {
    await db.doc(`bases/pessoal/gds/${id}`).set({ nome, regiao }, { merge: true });
  }
  console.log(`${GDS.length} GDs`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
