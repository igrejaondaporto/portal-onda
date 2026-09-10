/**
 * Semeia o mínimo da Base Kinder: o documento da base e as quatro
 * líderes (Maria, geral; Thamirys/Carol/Larissa, uma por sala), com
 * PIN provisório — sem voluntários/capacitações/inventário reais
 * ainda (mesmo padrão do arranque da New/Louvor/SHIFT, ver CLAUDE.md
 * raiz). Os voluntários reais entram pelo Painel do líder →
 * Adicionar, nunca por seed (evita colisão de id com outra base, ver
 * CLAUDE.md raiz, regra 9) — por isso os ids aqui já vêm namespaced
 * ("maria-kinder", não "maria" cru).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedKinder.mjs
 *
 * Corre uma vez. Repetir não duplica (usa merge), mas repõe o PIN de
 * quem já lá estava.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";
import { garantirIdSemColisao } from "./lib/semearPessoaSegura.mjs";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "kinder";
const PESSOAS = [
  // { id (namespaced), nome, papel, categoria, pin }
  { id: "maria-kinder", nome: "Maria", papel: "lider_base", categoria: null, pin: "123456" },
  { id: "thamirys-kinder", nome: "Thamirys", papel: "auxiliar", categoria: "baby", pin: "123456" },
  { id: "carol-kinder", nome: "Carol", papel: "auxiliar", categoria: "fun", pin: "123456" },
  { id: "larissa-kinder", nome: "Larissa", papel: "auxiliar", categoria: "junior", pin: "123456" },
];

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

async function main() {
  console.log("A semear a Base Kinder…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Kinder", slug: BASE, cor: "#7B5CFF",
    horaChegada: "09:00", horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
  }, { merge: true });
  console.log("documento da base gravado (nome/cor/horas — ajustar com a Maria)\n");

  // capacitações de arranque — a líder ajusta/acrescenta pelo Painel
  await db.collection(`bases/${BASE}/capacitacoes`).doc("primeiros-socorros").set({
    titulo: "Primeiros socorros", obrigatoria: true, temValidade: false, ativo: true, ordem: 1,
  }, { merge: true });
  await db.collection(`bases/${BASE}/capacitacoes`).doc("registo-criminal").set({
    titulo: "Certificado de registo criminal", descricao: "Obrigatório por lei para quem trabalha com menores.",
    obrigatoria: true, temValidade: true, ativo: true, ordem: 0,
  }, { merge: true });
  console.log("capacitações de arranque criadas (primeiros socorros, registo criminal)\n");

  for (const p of PESSOAS) {
    await garantirIdSemColisao(db, p.id, BASE);
    await db.doc(`bases/${BASE}/pessoas/${p.id}`).set(
      { nome: p.nome, papel: p.papel, categoria: p.categoria, ativo: true, foto: null, telefone: "" }, { merge: true });
    // Identidade/PIN são globais (pessoas/{id}), nunca por base — ver
    // CLAUDE.md raiz, regra 2/6.
    await db.doc(`pessoas/${p.id}`).set(
      { nome: p.nome, foto: null, bases: { [BASE]: true } }, { merge: true });
    await db.doc(`pessoas/${p.id}/privado/auth`).set(
      { pinHash: hash(p.pin), pinDigitos: p.pin.length, provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
    console.log(`"${p.nome}" criada (id: ${p.id}, papel: ${p.papel}${p.categoria ? `, sala: ${p.categoria}` : ""})`);
  }

  console.log("\n── CÓDIGOS PROVISÓRIOS ───────────────────────");
  console.log("Todas as líderes: PIN 123456 (força troca no 1º acesso)");
  console.log("Sem voluntários ainda — cada líder adiciona a sua sala pelo Painel do líder.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
