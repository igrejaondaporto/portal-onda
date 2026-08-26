/**
 * Semeia alguns itens de exemplo no Inventário do café da Base
 * Pessoal (bases/pessoal/inventario/{id}) — ~30 itens é a
 * especificação final (ver apps/pessoal/CLAUDE.md), isto é só um
 * ponto de partida real para a Camila não começar do ecrã vazio.
 *
 * Escreve direto no Firestore (mesmo padrão de scripts/seed.mjs para
 * a Apoio) em vez de passar pela Cloud Function `criarItemInventario`
 * — é um script admin de seed, não uma escrita de utilizador.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedInventarioPessoal.mjs
 *
 * Corre quantas vezes for preciso — id fixo por item, `merge:true`,
 * nunca duplica.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "pessoal";

const ITENS = [
  ["cafe-moido", "Café moído", "Café", 4, "kg", 2],
  ["acucar", "Açúcar", "Café", 3, "kg", 1],
  ["adocante", "Adoçante", "Café", 6, "caixas", 2],
  ["copos-plastico", "Copos de plástico", "Copos e loiça", 180, "un", 100],
  ["guardanapos", "Guardanapos", "Copos e loiça", 8, "pacotes", 3],
  ["palitos", "Palitos", "Copos e loiça", 5, "caixas", 2],
  ["agua-engarrafada", "Água engarrafada", "Bebidas", 24, "garrafas", 12],
  ["sumo", "Sumo", "Bebidas", 6, "embalagens", 3],
  ["pao", "Pão", "Padaria", 20, "unidades", 15],
  ["bolachas", "Bolachas", "Padaria", 10, "pacotes", 4],
  ["sacos-lixo", "Sacos do lixo", "Descartáveis", 15, "un", 8],
  ["toalhitas", "Toalhitas", "Descartáveis", 4, "pacotes", 2],
];

async function main() {
  console.log("A semear o Inventário da Base Pessoal…\n");
  for (const [id, nome, categoria, quantidade, unidade, minimo] of ITENS) {
    await db.doc(`bases/${BASE}/inventario/${id}`).set({
      nome, categoria, quantidade, unidade, minimo, foto: null, ativo: true,
    }, { merge: true });
  }
  console.log(`${ITENS.length} itens no inventário`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
