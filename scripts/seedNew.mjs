/**
 * Semeia o mínimo da Base New: o documento da base e a líder, com PIN
 * provisório — sem pessoas/funções/inventário reais ainda (mesmo
 * padrão do arranque da Louvor, ver CLAUDE.md raiz). Os voluntários
 * reais entram pelo Painel do líder → Adicionar, nunca por seed (evita
 * colisão de id com outra base, ver CLAUDE.md raiz, regra 9).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedNew.mjs
 *
 * Corre uma vez. Repetir não duplica (usa merge), mas repõe o PIN da líder.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";
import { garantirIdSemColisao } from "./lib/semearPessoaSegura.mjs";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "new";
const PIN_PROVISORIO = "123456";
const LIDER = { id: "lider-new", nome: "Líder da New" }; // trocar o nome no Painel logo no 1º acesso

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

async function main() {
  console.log("A semear a Base New…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Base New", slug: BASE, cor: "#F5A300",
    horaChegada: "09:00", horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
  }, { merge: true });
  console.log("documento da base gravado (nome/cor/horas — ajustar com o líder)");

  await garantirIdSemColisao(db, LIDER.id, BASE);
  await db.doc(`bases/${BASE}/pessoas/${LIDER.id}`).set(
    { nome: LIDER.nome, papel: "lider_base", ativo: true, foto: null, telefone: "" }, { merge: true });
  // Identidade/PIN são globais (pessoas/{id}), nunca por base — ver
  // CLAUDE.md raiz, regra 2/6.
  await db.doc(`pessoas/${LIDER.id}`).set(
    { nome: LIDER.nome, foto: null, bases: { [BASE]: true } }, { merge: true });
  await db.doc(`pessoas/${LIDER.id}/privado/auth`).set(
    { pinHash: hash(PIN_PROVISORIO), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  console.log(`líder "${LIDER.nome}" criada (id: ${LIDER.id})`);

  console.log("\n── CÓDIGO PROVISÓRIO ─────────────────────────");
  console.log(`Líder da base: PIN ${PIN_PROVISORIO} (força troca no 1º acesso)`);
  console.log("Sem funções/inventário/voluntários ainda — adiciona pelo Painel do líder.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
