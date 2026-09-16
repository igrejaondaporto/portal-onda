/**
 * Cria bases/financeiro + a primeira pessoa que vai tratar os
 * reembolsos. Sem escala, sem funções, sem inventário — o Financeiro
 * só lê e paga reembolsos de todas as bases (ver `firestore.rules`,
 * bloco `match /{path=**}/reembolsos/{r}`, e `veReembolsos: "todas"`
 * abaixo, que vira a claim `ve_todos_reembolsos` em `entrar`/
 * `trocarBase`, ver `claimsExtraDaBase` em `functions/index.js`).
 *
 * Troca `NOME_RESPONSAVEL` pelo nome real antes de correr — o id fica
 * genérico ("financeiro-1") de propósito: ver `CLAUDE.md` raiz, regra
 * 9 — nunca um id "cru" tipo primeiro nome, evita colidir com alguém
 * do mesmo nome noutra base.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedFinanceiro.mjs
 *
 * Repetir não duplica (usa merge), mas repõe o PIN provisório.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";
import { garantirIdSemColisao } from "./lib/semearPessoaSegura.mjs";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "financeiro";
const NOME_RESPONSAVEL = "Edgar";
const PESSOA_ID = "financeiro-1";
const PIN_PADRAO = "123456"; // 6 dígitos, como qualquer líder de base — força troca no primeiro acesso

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

async function main() {
  await db.doc(`bases/${BASE}`).set({
    nome: "Financeiro", slug: BASE, cor: "#7b5cff",
    horaChegada: null, horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
    // única capacidade que esta base precisa — ver comentário no topo
    veReembolsos: "todas",
  }, { merge: true });
  console.log("bases/financeiro criada/atualizada");

  await garantirIdSemColisao(db, PESSOA_ID, BASE);
  await db.doc(`bases/${BASE}/pessoas/${PESSOA_ID}`).set(
    { nome: NOME_RESPONSAVEL, papel: "lider_base", ativo: true, foto: null, telefone: "" }, { merge: true });

  // identidade + PIN são GLOBAIS (pessoas/{id}, não bases/{b}/pessoas/{id}) —
  // é aqui que `dadosEntrada`/`entrar` (functions/index.js, refGlobal/
  // refSegredo) vão ler, não em bases/{b}/pessoas/{id}/privado/auth. Um
  // seed anterior escreveu no caminho errado (copiado de scripts/seed.mjs,
  // que tem o mesmo engano) — a pessoa ficava sem hash nenhum no sítio
  // certo, `dadosEntrada` caía no default de 4 dígitos, e o PIN nunca
  // batia certo. Isto corrige e limpa o documento a mais.
  await db.doc(`pessoas/${PESSOA_ID}`).set(
    { nome: NOME_RESPONSAVEL, foto: null, bases: { [BASE]: true } }, { merge: true });
  await db.doc(`pessoas/${PESSOA_ID}/privado/auth`).set(
    { pinHash: hash(PIN_PADRAO), pinDigitos: PIN_PADRAO.length, provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  await db.doc(`bases/${BASE}/pessoas/${PESSOA_ID}/privado/auth`).delete().catch(() => {});
  console.log(`pessoa ${PESSOA_ID} criada — PIN provisório ${PIN_PADRAO}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
