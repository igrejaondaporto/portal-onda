/**
 * Semeia o Louvor Kinder: o documento da base e o primeiro líder.
 *
 * O primeiro líder é o líder da Louvor — a MESMA pessoa, ligada, nunca
 * criada de novo (regra 9 do CLAUDE.md raiz: identidade e PIN são
 * globais). É o arranque que o Painel do líder não consegue fazer:
 * sem ninguém nesta base, não há quem toque em "Adicionar → já é
 * voluntário(a) noutra base?". Por isso este script grava exatamente o
 * que esse fluxo grava (`criarVoluntario` com `pessoaExistenteId`,
 * functions/index.js): o documento da pessoa nesta base e
 * `pessoas/{id}.bases.louvorkinder = true`. Nunca toca no PIN nem no
 * nome global — o líder entra com o código de sempre e troca de base
 * pelo menu. Restantes voluntários entram pelo Painel do líder.
 *
 *   node scripts/seedLouvorKinder.mjs
 *   (ou pelo workflow "Correr script admin", que escreve o
 *   service-account.json)
 *
 * Repetir não duplica: a base usa merge, e um líder já ligado é
 * deixado como está.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "louvorkinder";
const BASE_ORIGEM = "louvor";

async function main() {
  console.log("A semear o Louvor Kinder…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Louvor Kinder", slug: BASE, cor: "#FF7A59",
    horaChegada: "08:30", horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
    feedbackAberto: true,
  }, { merge: true });
  console.log("documento da base criado (cor #FF7A59, chegada 08:30 — a confirmar com o líder)");

  const lideres = await db.collection(`bases/${BASE_ORIGEM}/pessoas`)
    .where("papel", "==", "lider_base").where("ativo", "==", true).get();
  if (lideres.size !== 1) {
    throw new Error(`Esperava um líder ativo em bases/${BASE_ORIGEM}, encontrei ${lideres.size} — liga à mão.`);
  }
  const lider = lideres.docs[0];
  const origem = lider.data();

  const aqui = await db.doc(`bases/${BASE}/pessoas/${lider.id}`).get();
  if (aqui.exists && aqui.data().ativo !== false) {
    console.log(`${origem.nome} (${lider.id}) já está ligado ao Louvor Kinder — nada a fazer.`);
    return;
  }

  await db.doc(`bases/${BASE}/pessoas/${lider.id}`).set({
    nome: origem.nome, telefone: origem.telefone ?? "", papel: "lider_base", ativo: true,
    genero: origem.genero ?? null, foto: origem.foto ?? null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`pessoas/${lider.id}`).set({ bases: { [BASE]: true } }, { merge: true });
  console.log(`${origem.nome} (${lider.id}) ligado como líder do Louvor Kinder.`);
  console.log("\nEntra com o mesmo código da Louvor e troca de base pelo menu.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
