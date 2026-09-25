/**
 * Liga (ou desliga) as notificações por e-mail — ver functions/email.js.
 *
 * O que faz:
 *   - grava a chave do Resend em `config/emailEnvio` (documento que
 *     nenhuma regra abre — só o Admin SDK lê);
 *   - liga/desliga o pop-up "qual é o teu e-mail?" do primeiro login
 *     (`config/email.pedirNoLogin`, lido pelas apps);
 *   - opcionalmente, manda um e-mail de teste para confirmar que a
 *     chave e o domínio estão bons ANTES de toda a gente começar a
 *     receber.
 *
 * A chave NUNCA vai na linha de comando (ficaria no histórico do
 * terminal): lê-se da variável de ambiente RESEND_API_KEY.
 *
 *   1. service-account.json na raiz (Firebase → Definições → Contas de
 *      serviço → Gerar chave privada; está no .gitignore)
 *   2. RESEND_API_KEY=re_xxx node scripts/definirEnvioEmail.mjs --teste o-teu@email.pt
 *        → só manda um e-mail de teste; não grava nada
 *   3. RESEND_API_KEY=re_xxx node scripts/definirEnvioEmail.mjs --ligar
 *        → grava a chave, liga o envio e o pop-up
 *
 *   Outras opções:
 *     --remetente "Igreja Onda <avisos@igrejaonda.pt>"   (é o que vem por omissão;
 *                                 o domínio tem de estar verificado no Resend)
 *     --sem-popup     liga o envio mas não pede o e-mail no login
 *     --desligar      desliga o envio e o pop-up (a chave fica, inativa)
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const opcao = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const remetente = valor("--remetente") || "Igreja Onda <avisos@igrejaonda.pt>";
const chave = process.env.RESEND_API_KEY || "";

async function testar(para) {
  if (!chave) throw new Error("Falta RESEND_API_KEY no ambiente.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente, to: [para],
      subject: "Teste — Portal do Voluntário",
      text: "Se estás a ler isto, os e-mails do Portal do Voluntário estão a funcionar.",
    }),
  });
  const corpo = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${corpo}`);
  console.log(`✓ E-mail de teste enviado para ${para} (${corpo})`);
}

const teste = valor("--teste");
if (teste) {
  await testar(teste);
  if (!opcao("--ligar")) process.exit(0);
}

if (!opcao("--ligar") && !opcao("--desligar")) {
  console.error("Uso: RESEND_API_KEY=re_xxx node scripts/definirEnvioEmail.mjs [--teste email] [--ligar | --desligar] [--sem-popup] [--remetente \"Nome <x@dominio>\"]");
  process.exit(1);
}

const conta = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(conta) });
const db = admin.firestore();
const agora = admin.firestore.FieldValue.serverTimestamp();

if (opcao("--desligar")) {
  await db.doc("config/emailEnvio").set({ ativo: false, atualizadoEm: agora }, { merge: true });
  await db.doc("config/email").set({ pedirNoLogin: false, atualizadoEm: agora }, { merge: true });
  console.log("✓ Envio de e-mail e pop-up DESLIGADOS.");
  process.exit(0);
}

if (!chave.startsWith("re_")) {
  console.error("RESEND_API_KEY em falta ou não parece uma chave do Resend (começa por re_).");
  process.exit(1);
}
await db.doc("config/emailEnvio").set({ chave, remetente, ativo: true, atualizadoEm: agora });
await db.doc("config/email").set({ pedirNoLogin: !opcao("--sem-popup"), atualizadoEm: agora }, { merge: true });
console.log(`✓ Envio LIGADO (remetente: ${remetente}). Pop-up no login: ${opcao("--sem-popup") ? "não" : "sim"}.`);
process.exit(0);
