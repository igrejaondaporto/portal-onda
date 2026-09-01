/**
 * Semeia a Base Louvor: só o documento da base e o líder (Adriel).
 * Sem funções de catálogo (a Louvor não tem checklist de preparação)
 * nem inventário inicial — equipamento entra pelo Painel do líder
 * depois. Restantes voluntários entram pela interface (Painel do
 * líder → Adicionar), nunca por seed.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedLouvor.mjs
 *
 * Corre uma vez. Repetir não duplica (usa merge), mas repõe o PIN do líder.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";
import { garantirIdSemColisao } from "./lib/semearPessoaSegura.mjs";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "louvor";
const PIN_PADRAO = { lider_base: "593184" };
const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

// id namespaced de propósito (ver CLAUDE.md raiz, regra 9) — "adriel"
// cru arriscaria colidir com uma pessoa de outra base no futuro; a
// identidade e o PIN são globais, uma colisão reescreve-os em silêncio.
const LIDER = { id: "adriel-louvor", nome: "Adriel", papel: "lider_base" };

async function main() {
  console.log("A semear a Base Louvor…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Base Louvor", slug: BASE, cor: "#C8F02E",
    horaChegada: "07:00", horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
    feedbackAberto: true,
  }, { merge: true });
  console.log("documento da base criado (cor #C8F02E, chegada 07:00)");

  await garantirIdSemColisao(db, LIDER.id, BASE);

  await db.doc(`bases/${BASE}/pessoas/${LIDER.id}`).set(
    { nome: LIDER.nome, papel: LIDER.papel, ativo: true, foto: null, telefone: "" }, { merge: true });
  await db.doc(`pessoas/${LIDER.id}`).set(
    { nome: LIDER.nome, foto: null, bases: { [BASE]: true } }, { merge: true });
  await db.doc(`pessoas/${LIDER.id}/privado/auth`).set(
    { pinHash: hash(PIN_PADRAO.lider_base), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  console.log(`líder ${LIDER.nome} criado`);

  console.log("\n── CÓDIGO PROVISÓRIO ─────────────────────────");
  console.log(`  Líder da base (Adriel): ${PIN_PADRAO.lider_base}`);
  console.log("\nA app obriga a trocar por um código próprio logo no");
  console.log("primeiro acesso. Os restantes voluntários entram pelo");
  console.log("Painel do líder → Adicionar.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
