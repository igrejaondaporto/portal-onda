/**
 * Substitui o inventário de exemplo da Base Pessoal pelos itens reais
 * levantados pela líder — quantidade, categoria e observações tal
 * como contadas fisicamente. Itens antigos que não estão nesta lista
 * ficam desativados (ativo:false), nunca apagados.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedInventarioPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";

const ITENS = [
  ["Copo de café descartável (papel)", "Consumíveis", 150, null],
  ["Copo de sumo descartável (papel)", "Consumíveis", 0, null],
  ["Copo de sumo descartável (plástico)", "Consumíveis", 80, null],
  ["Copo de sumo reutilizável", "Consumíveis", 30, null],
  ["Palito de café", "Consumíveis", 550, "4 pacotes de 100un fechados — um pote com vários abertos"],
  ["Guardanapo", "Consumíveis", 2, "1 pacote com 250un fechado — um pacote aberto"],
  ["Lenço de papel", "Consumíveis", 8, null],
  ["Fósforo", "Consumíveis", 5, null],
  ["Canudos de papel", "Consumíveis", 200, "2 pacotes fechados"],
  ["Copo de ceia", "Ceia", 120, "COMPRAR MAIS"],
  ["Tampa do copo de ceia", "Ceia", 120, "COMPRAR MAIS"],
  ["Plástico filme", "Ceia", 3, "2 rolos com cortador e um rolo sem caixa e sem cortador"],
  ["Água", "Alimentação", 17, "63 unidades — 7 fardos"],
  ["Café", "Alimentação", 3, "2 fechados e um pouco no pote de tampa verde"],
  ["Açúcar", "Alimentação", 2, "1 fechado e 1 aberto"],
  ["Pão", "Alimentação", 0, "Não há mais pão"],
  ["Bolacha doce", "Alimentação", 2, "2 pacotes — dentro de um saco do Continente"],
  ["Bolacha salgada", "Alimentação", 3, "1 pote + 1 pacote de cream cracker — dentro de um saco do Continente"],
  ["Bolachas sortidas", "Alimentação", 0, null],
  ["Bolinhos individual", "Alimentação", 0, "Dentro de uma sacola da Normal (verde)"],
  ["Tostas", "Alimentação", 1, null],
  ["Queijo", "Alimentação", 0, null],
  ["Fiambre", "Alimentação", 0, null],
  ["Maionese", "Alimentação", 0, "Com a Lunalva"],
  ["Atum", "Alimentação", 1, null],
  ["Sumo", "Alimentação", 0, null],
  ["Ice Tea", "Alimentação", 1, "Com a Lunalva"],
  ["Leite", "Alimentação", 8, "Caixas"],
  ["Balas", "Alimentação", 1, "Dois pacotes abertos"],
  ["Chocolate em pó", "Alimentação", 1, "Aberto"],
  ["Pulseiras", "Branding", 69, "Novas pulseiras"],
  ["Flyer Amarelo", "Branding", 196, null],
  ["Flyer Roxo", "Branding", 182, null],
  ["Envelope", "Branding", 120, null],
  ["Flyer branco (apelo)", "Branding", 250, null],
  ["Flyer azul (visitantes)", "Branding", 450, null],
  ["Envelopes novos", "Branding", 100, null],
];

function slug(nome) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("1) Desativar itens antigos que não estão na lista real…");
  const idsNovos = new Set(ITENS.map(([nome]) => slug(nome)));
  const antigos = await db.collection(`bases/${BASE}/inventario`).where("ativo", "==", true).get();
  for (const doc of antigos.docs) {
    if (!idsNovos.has(doc.id)) {
      await doc.ref.set({ ativo: false }, { merge: true });
      console.log(`  desativado: ${doc.id}`);
    }
  }

  console.log("\n2) Escrever os itens reais…");
  for (const [nome, categoria, quantidade, observacoes] of ITENS) {
    const id = slug(nome);
    await db.doc(`bases/${BASE}/inventario/${id}`).set({
      nome, categoria, unidade: "unidades", minimo: 0, quantidade,
      observacoes, foto: null, ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ${nome}: ${quantidade}`);
  }

  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
