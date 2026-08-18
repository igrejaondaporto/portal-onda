/**
 * Define (ou troca) a senha do acesso de dev — ver `entrarComoDev` em
 * functions/index.js e `GatilhoDev`/`SheetAcessoDev` no ecrã de
 * entrada de cada base (5 toques no logo "igrejaonda").
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/definirSenhaDev.mjs "a-senha-nova"
 *
 * Corre uma vez para criar, e sempre que quiseres trocar a senha.
 * O hash é o mesmo scrypt do PIN (ver hash()/confere() em
 * functions/index.js) — copiado aqui só porque scripts/ não importa
 * de functions/ (pacotes npm separados).
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const senha = process.argv[2];
if (!senha || senha.length < 8) {
  console.error("Uso: node scripts/definirSenhaDev.mjs \"uma-senha-com-8+-caracteres\"");
  process.exit(1);
}

function hash(valor) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(valor, sal, 64).toString("hex")}`;
}

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

await db.doc("config/devAccess/privado/auth").set({
  hash: hash(senha),
  falhas: 0,
  jaBloqueou: false,
  bloqueadoAte: null,
  definidaEm: admin.firestore.FieldValue.serverTimestamp(),
});

console.log("✓ Senha do acesso de dev definida.");
process.exit(0);
