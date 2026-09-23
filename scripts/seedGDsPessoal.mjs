/**
 * Semeia o catálogo global de GDs (gds/{id}) com a lista real passada
 * pelo dono do produto. Região é só uma de três macro-zonas (Norte,
 * Lisboa, Sines) — pedido explícito, para não fragmentar o select em
 * muitos grupos pequenos.
 *
 * Global desde 2026-09 (era bases/pessoal/gds) — o Mural Onda
 * (apps/mural) passa a ler daqui também; ver a nota "GLOBAL" em
 * apps/pessoal/src/lib/modelo.js e scripts/migrarGDsParaGlobal.mjs
 * (a migração de uma base já semeada pelo caminho antigo).
 *
 * `lat`/`lng` (aproximados, centro da localidade) alimentam o
 * sugestor automático — o Formulário sugere o GD mais perto do
 * concelho que a pessoa preencher (ver gdMaisProximo em
 * apps/pessoal/src/lib/contactos.js). Um GD sem coordenadas continua
 * escolhível à mão, só não entra nessa conta.
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
  ["brito-capelo", "Brito Capelo", "Norte", 41.1795, -8.6870],
  ["arca-dagua", "Arca d'Água", "Norte", 41.1610, -8.6520],
  ["barcelos", "Barcelos", "Norte", 41.5388, -8.6151],
  ["fanzeres", "Fânzeres", "Norte", 41.1662, -8.5325],
  ["gaia", "Gaia", "Norte", 41.1239, -8.6118],
  ["lisboa", "Lisboa", "Lisboa", 38.7223, -9.1393],
  ["new-sines", "New - Sines", "Sines", 37.9564, -8.8647],
  ["piscina-sines", "Piscina - Sines", "Sines", 37.9564, -8.8647],
  ["povoa-de-varzim", "Póvoa de Varzim", "Norte", 41.3818, -8.7658],
  ["santo-andre-sines", "Santo André - Sines", "Sines", 37.9564, -8.8647],
  ["sao-joao-da-madeira", "São João da Madeira", "Norte", 40.8907, -8.4864],
  ["sao-mamede", "São Mamede", "Norte", 41.1892, -8.6103],
  ["vila-do-conde", "Vila do Conde", "Norte", 41.3515, -8.7436],
  ["vila-do-conde-unvt", "Vila do Conde UNVT", "Norte", 41.3515, -8.7436],
];

async function main() {
  console.log("A semear os GDs da Base Pessoal…\n");
  for (const [id, nome, regiao, lat, lng] of GDS) {
    await db.doc(`gds/${id}`).set({ nome, regiao, lat, lng }, { merge: true });
  }
  console.log(`${GDS.length} GDs`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
