/**
 * Limpeza única: tira `origens.louvorkinder` de todas as
 * `eventos/{e}/indisponibilidades/{uid}` — as marcas "já está escalado
 * no Louvor Kinder neste culto" gravadas antes de o Louvor Kinder sair
 * da regra de conflito entre bases (pedido 2026-09: servir lá não
 * impede servir noutra base). O servidor já as ignora
 * (BASES_SEM_CONFLITO_CROSS_BASE, functions/index.js), mas as outras
 * bases leem estas marcas no cliente para acinzentar pessoas ao montar
 * a escala — sem limpar, continuavam a aparecer indisponíveis.
 *
 *   1. guardar a chave de serviço como service-account.json na raiz
 *   2. node scripts/limparIndisponibilidadesLouvorKinder.mjs           (só mostra)
 *   3. node scripts/limparIndisponibilidadesLouvorKinder.mjs --aplicar
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
const alvos = snap.docs.filter((d) => d.data().origens?.louvorkinder);
console.log(`${snap.size} indisponibilidades lidas; ${alvos.length} com entrada do Louvor Kinder.`);
for (const d of alvos) {
  const outras = Object.keys(d.data().origens).filter((b) => b !== "louvorkinder");
  console.log(`  ${d.ref.path}${outras.length ? `  (fica: ${outras.join(", ")})` : ""}`);
}
if (!aplicar) {
  console.log(alvos.length ? "\nSó a mostrar — corre com --aplicar para limpar." : "\nNada a fazer.");
  process.exit(0);
}
for (let i = 0; i < alvos.length; i += 400) {
  const lote = db.batch();
  alvos.slice(i, i + 400).forEach((d) =>
    lote.update(d.ref, { "origens.louvorkinder": admin.firestore.FieldValue.delete() }));
  await lote.commit();
}
console.log(`\n${alvos.length} limpas.`);
