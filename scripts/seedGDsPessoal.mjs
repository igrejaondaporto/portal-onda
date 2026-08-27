/**
 * Semeia o catálogo de GDs da Base Pessoal (bases/pessoal/gds/{id})
 * com a lista real passada pelo dono do produto. Região inferida do
 * nome quando não é óbvia (ex.: "Brito Capelo" é uma rua de
 * Matosinhos, "São Mamede" é freguesia de Matosinhos) — a líder pode
 * corrigir depois pela interface, se algum estiver errado.
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
  ["brito-capelo", "Brito Capelo", "Matosinhos"],
  ["arca-dagua", "Arca d'Água", "Porto"],
  ["barcelos", "Barcelos", "Barcelos"],
  ["fanzeres", "Fânzeres", "Gondomar"],
  ["gaia", "Gaia", "Vila Nova de Gaia"],
  ["lisboa", "Lisboa", "Lisboa"],
  ["new-sines", "New - Sines", "Sines"],
  ["piscina-sines", "Piscina - Sines", "Sines"],
  ["povoa-de-varzim", "Póvoa de Varzim", "Póvoa de Varzim"],
  ["santo-andre-sines", "Santo André - Sines", "Sines"],
  ["sao-joao-da-madeira", "São João da Madeira", "São João da Madeira"],
  ["sao-mamede", "São Mamede", "Matosinhos"],
  ["vila-do-conde", "Vila do Conde", "Vila do Conde"],
  ["vila-do-conde-unvt", "Vila do Conde UNVT", "Vila do Conde"],
];

async function main() {
  console.log("A semear os GDs da Base Pessoal…\n");
  for (const [id, nome, regiao] of GDS) {
    await db.doc(`bases/pessoal/gds/${id}`).set({ nome, regiao }, { merge: true });
  }
  console.log(`${GDS.length} GDs`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
