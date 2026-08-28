/**
 * Corrige a foto do Hans na Pessoal, que ficou null ao ser religado
 * (criarVoluntario puxava do documento global, que nunca tem a foto
 * atualizada — ver comentário em functions/index.js). Copia da
 * Técnica, onde a conta nasceu, e aproveita para também guardar no
 * documento global — evita o mesmo problema numa terceira base.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/corrigirFotoHansPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  const tecnica = await db.doc("bases/tecnica/pessoas/hans").get();
  const foto = tecnica.data()?.foto;
  console.log("Foto na Técnica:", foto || "(nenhuma)");
  if (!foto) {
    console.log("Sem foto na Técnica também — nada para copiar.");
    return;
  }
  await db.doc("bases/pessoal/pessoas/hans").set({ foto }, { merge: true });
  await db.doc("pessoas/hans").set({ foto }, { merge: true });
  console.log("Foto copiada para bases/pessoal/pessoas/hans e pessoas/hans.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
