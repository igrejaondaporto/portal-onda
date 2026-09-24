/**
 * Migração única: grava os três tipos de culto que já existiam em
 * código (`TIPOS_CULTO_PADRAO`, packages/shared/src/lib/tipoCulto.js)
 * em `config/tiposCulto`, global — para o catálogo editável (Painel
 * Pastoral → Ordem → Tipo de culto, pedido do dono do produto,
 * 2026-09) arrancar com a mesma lista de sempre. Sem isto, a app já
 * funciona igual (cai em TIPOS_CULTO_PADRAO enquanto o doc não
 * existir), mas "+ Adicionar" só passa a acrescentar à lista a sério
 * DEPOIS de este script correr — antes disso, o primeiro tipo
 * adicionado criaria o doc com só esse tipo lá dentro (perdia Ceia/
 * Contribua/Culto da Família).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedTiposCulto.mjs
 *
 * Idempotente por desenho: só escreve se o documento ainda não
 * existir — nunca sobrescreve uma lista já editada pela app.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const TIPOS_CULTO_PADRAO = [
  { id: "ceia", nome: "Ceia" },
  { id: "contribua", nome: "Contribua" },
  { id: "familia", nome: "Culto da Família" },
];

async function main() {
  const ref = db.doc("config/tiposCulto");
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`config/tiposCulto já existe (${(snap.data().lista || []).length} tipos) — nada a fazer.`);
    return;
  }
  await ref.set({ lista: TIPOS_CULTO_PADRAO, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`config/tiposCulto criado com ${TIPOS_CULTO_PADRAO.length} tipos (os três de sempre).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
