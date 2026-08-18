/**
 * Repõe os PINs de toda a gente (volta ao provisório — 4 dígitos
 * voluntário, 6 líder, força troca no próximo login) e limpa o tour
 * de primeiro login de todos, em qualquer base. Usar antes de
 * entregar uma base ao líder — ninguém herda os códigos de teste, e
 * o primeiro login de cada um volta a mostrar a visita guiada.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/repor-para-entrega.mjs apoio tecnica backstage
 *
 * O tour é limpo para TODA a gente (campo global pessoas/{uid}.tourVisto),
 * não só de quem está nas bases passadas como argumento — os PINs, esses,
 * só das bases pedidas (é a lista de pessoas ativas dessa base).
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const bases = process.argv.slice(2);
if (!bases.length) {
  console.error("Uso: node scripts/repor-para-entrega.mjs <base> [<base> ...]");
  process.exit(1);
}

function hash(valor) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(valor, sal, 64).toString("hex")}`;
}

const PIN_PADRAO = { lider_base: "123456", voluntario: "1234" };
const pinProvisorio = (papel) => PIN_PADRAO[papel] ?? PIN_PADRAO.voluntario;

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

for (const baseId of bases) {
  const snap = await db.collection(`bases/${baseId}/pessoas`).where("ativo", "==", true).get();
  const lote = db.batch();
  snap.forEach((doc) => {
    const provisorio = pinProvisorio(doc.data().papel);
    lote.set(db.doc(`pessoas/${doc.id}/privado/auth`), {
      pinHash: hash(provisorio), pinDigitos: provisorio.length,
      provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
    }, { merge: true });
  });
  await lote.commit();
  console.log(`✓ ${baseId}: ${snap.size} PIN(s) repostos ao provisório`);
}

const pessoasSnap = await db.collection("pessoas").get();
const loteTour = db.batch();
pessoasSnap.forEach((doc) => loteTour.set(doc.ref, { tourVisto: {} }, { merge: true }));
await loteTour.commit();
console.log(`✓ tour: ${pessoasSnap.size} pessoa(s) voltam a ver a visita guiada no próximo login`);

process.exit(0);
