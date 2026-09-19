/**
 * Cria bases/pastoral + a primeira pessoa da equipa pastoral.
 *
 * Sem escala, sem funções, sem inventário — o Painel Pastoral só LÊ as
 * dez bases (ver `functions/pastoral.js`) e escreve em três sítios
 * muito estreitos: a ordem do culto, a etapa de um visitante e o
 * recado a uma base. Ver `apps/pastoral/CLAUDE.md`.
 *
 * As capacidades abaixo viram claims em `entrar`/`trocarBase` (ver
 * `claimsExtraDaBase`, `functions/index.js`). Quatro das cinco já
 * existiam para a Backstage e o Financeiro; só `visaoPastoral` é nova.
 * **Não há papel "admin_igreja"** — é uma capacidade de base, como
 * sempre (regra 4 do `CLAUDE.md` raiz).
 *
 * Troca `NOME_RESPONSAVEL` pelo nome real antes de correr. O id fica
 * genérico ("pastoral-1") de propósito: regra 9 do `CLAUDE.md` raiz —
 * nunca um id "cru" tipo primeiro nome, que colidiria com alguém do
 * mesmo nome noutra base e reescrevia a identidade e o PIN dessa
 * pessoa em silêncio.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedPastoral.mjs
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

const BASE = "pastoral";
const NOME_RESPONSAVEL = "Pastor";
const PESSOA_ID = "pastoral-1";
const PIN_PADRAO = "123456"; // 6 dígitos, como qualquer líder de base — força troca no primeiro acesso

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

async function main() {
  await db.doc(`bases/${BASE}`).set({
    nome: "Pastoral", slug: BASE, cor: "#0F766E",
    horaChegada: null, horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,

    // ── as capacidades desta base ──────────────────────────────
    veEscalas: "todas",                  // → ve_todas_escalas    (já existia: Backstage)
    veReembolsos: "todas",               // → ve_todos_reembolsos (já existia: Financeiro)
    culto: { podePublicar: true },       // → pode_publicar_culto (já existia: Backstage)
    eventos: { podeCriarGlobal: true },  // → pode_criar_evento_global
    visaoPastoral: true,                 // → ve_tudo_pastoral    ← a única nova
  }, { merge: true });
  console.log("bases/pastoral criada/atualizada");

  await garantirIdSemColisao(db, PESSOA_ID, BASE);
  await db.doc(`bases/${BASE}/pessoas/${PESSOA_ID}`).set(
    { nome: NOME_RESPONSAVEL, papel: "lider_base", ativo: true, foto: null, telefone: "" }, { merge: true });

  // identidade + PIN são GLOBAIS (pessoas/{id}, não bases/{b}/pessoas/{id}) —
  // é aqui que `dadosEntrada`/`entrar` (functions/index.js, refGlobal/
  // refSegredo) vão ler. Escrever o hash em bases/{b}/pessoas/{id}/privado/
  // auth é um engano que já aconteceu duas vezes neste repo (a pessoa fica
  // sem hash no sítio certo, `dadosEntrada` cai no default de 4 dígitos, e
  // o PIN nunca bate certo). A linha do delete abaixo existe por isso.
  await db.doc(`pessoas/${PESSOA_ID}`).set(
    { nome: NOME_RESPONSAVEL, foto: null, bases: { [BASE]: true } }, { merge: true });
  await db.doc(`pessoas/${PESSOA_ID}/privado/auth`).set(
    { pinHash: hash(PIN_PADRAO), pinDigitos: PIN_PADRAO.length, provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  await db.doc(`bases/${BASE}/pessoas/${PESSOA_ID}/privado/auth`).delete().catch(() => {});
  console.log(`pessoa ${PESSOA_ID} criada — PIN provisório ${PIN_PADRAO}`);

  console.log("\nFalta ainda, e não é este script que faz:");
  console.log("  • npm run seed:tour   (o tour de primeiro login desta base)");
  console.log("  • ligar pastoral.igrejaonda.pt ao Worker portal-pastoral, na Cloudflare");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
