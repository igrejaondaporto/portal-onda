/**
 * Dá (ou tira) acesso ao painel de moderação do Mural Onda a uma
 * pessoa — ver `souAdminMural`/`exigirAdminMural` em functions/mural.js
 * e o ecrã "Painel" em apps/mural.
 *
 * Não é uma claim do token (como papel/baseId nas bases): é só um
 * documento em config/muralAdmins/{pessoaId}, fechado pelo catch-all
 * do firestore.rules — cada Cloud Function do painel lê-o na hora,
 * por isso dar ou tirar acesso funciona sem a pessoa ter de voltar a
 * entrar. `pessoaId` é o mesmo id de sempre: `pessoas/{id}` — o de
 * quem já é voluntário nalguma base, ou `tel_<telefone>` para quem só
 * existe pelo Mural (ver `idParaTelefone` em functions/mural.js).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/definirAdminMural.mjs <pessoaId>            (dar)
 *      node scripts/definirAdminMural.mjs <pessoaId> --tirar    (tirar)
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const pessoaId = process.argv[2];
const tirar = process.argv.includes("--tirar");
if (!pessoaId) {
  console.error("Uso: node scripts/definirAdminMural.mjs <pessoaId> [--tirar]");
  process.exit(1);
}

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const pessoaSnap = await db.doc(`pessoas/${pessoaId}`).get();
if (!pessoaSnap.exists) {
  console.error(`Não existe pessoas/${pessoaId} — confirma o id antes de continuar.`);
  process.exit(1);
}

const ref = db.doc(`config/muralAdmins/${pessoaId}`);
if (tirar) {
  await ref.delete();
  console.log(`✓ ${pessoaSnap.data().nome || pessoaId} deixou de moderar o Mural.`);
} else {
  await ref.set({ desde: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`✓ ${pessoaSnap.data().nome || pessoaId} já pode moderar o Mural.`);
}
process.exit(0);
