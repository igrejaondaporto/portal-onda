/**
 * Limpeza única: tira `origens.apoio` de todas as
 * `eventos/{e}/indisponibilidades/{uid}` — as marcas "já está escalado
 * na Apoio neste culto" gravadas antes de a Apoio sair
 * da regra de conflito entre bases (pedido 2026-10: quem serve na Apoio faz o começo e o fim do culto;
 * servir lá não
 * impede servir noutra base). O servidor já as ignora
 * (BASES_SEM_CONFLITO_CROSS_BASE, functions/index.js), mas as outras
 * bases leem estas marcas no cliente para acinzentar pessoas ao montar
 * a escala — sem limpar, continuavam a aparecer indisponíveis.
 *
 *   1. guardar a chave de serviço como service-account.json na raiz
 *   2. node scripts/limparIndisponibilidadesApoio.mjs           (só mostra)
 *   3. node scripts/limparIndisponibilidadesApoio.mjs --aplicar
 *
 * Idempotente: só toca documentos que ainda têm a entrada. Quando o
 * documento fica sem origem nenhuma, fica vazio (é o que
 * desmarcarIndisponivel já deixa hoje) — nada é apagado.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const aplicar = process.argv.includes("--aplicar");

const snap = await db.collectionGroup("indisponibilidades").get();
const alvos = snap.docs.filter((d) => d.data().origens?.apoio);
console.log(`${snap.size} indisponibilidades lidas; ${alvos.length} com entrada da Apoio.`);
for (const d of alvos) {
  const outras = Object.keys(d.data().origens).filter((b) => b !== "apoio");
  console.log(`  ${d.ref.path}${outras.length ? `  (fica: ${outras.join(", ")})` : ""}`);
}
if (!aplicar) {
  console.log(alvos.length ? "\nSó a mostrar — corre com --aplicar para limpar." : "\nNada a fazer.");
  process.exit(0);
}
for (let i = 0; i < alvos.length; i += 400) {
  const lote = db.batch();
  alvos.slice(i, i + 400).forEach((d) =>
    lote.update(d.ref, { "origens.apoio": admin.firestore.FieldValue.delete() }));
  await lote.commit();
}
console.log(`\n${alvos.length} limpas.`);
