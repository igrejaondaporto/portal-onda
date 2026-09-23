/**
 * Define (ou troca) a senha do gesto que concede acesso ao painel de
 * moderação do Mural — ver `desbloquearModeracaoMural` em
 * functions/mural.js e `GatilhoModeracao`/`SheetDesbloquearModeracao`
 * em apps/mural/src/components (5 toques no logo "mural onda").
 *
 * Diferente de `definirSenhaDev.mjs`: aquela senha (config/devAccess)
 * cria uma sessão de teste sem pessoa nenhuma por trás; esta
 * (config/moderacaoMural) só marca quem JÁ está autenticado como
 * admin do Mural — por isso continua a precisar que a pessoa entre
 * primeiro (base+PIN ou telemóvel+PIN), e o gesto só CONCEDE, nunca
 * revoga (para tirar, `scripts/definirAdminMural.mjs <id> --tirar`).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/definirSenhaModeracaoMural.mjs "a-senha-nova"
 *
 * Corre uma vez para criar, e sempre que quiseres trocar a senha.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const senha = process.argv[2];
if (!senha || senha.length < 8) {
  console.error("Uso: node scripts/definirSenhaModeracaoMural.mjs \"uma-senha-com-8+-caracteres\"");
  process.exit(1);
}

function hash(valor) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(valor, sal, 64).toString("hex")}`;
}

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

await db.doc("config/moderacaoMural/privado/auth").set({
  hash: hash(senha),
  falhas: 0,
  jaBloqueou: false,
  bloqueadoAte: null,
  definidaEm: admin.firestore.FieldValue.serverTimestamp(),
});

console.log("✓ Senha do gesto de moderação do Mural definida.");
process.exit(0);
