/**
 * Migração única: acrescenta a fileira M (4 lugares, atrás da L) à
 * planta do auditório da Base Pessoal — pedido do dono do produto,
 * 2026-09. M1/M2 ficam atrás de L1/L2, M3/M4 atrás de L11/L12 — dois
 * pares nos cantos, não uma fileira inteira nova. Ver
 * `gerarLugaresExtra`/`fileirasExtraDaPlanta` em
 * apps/pessoal/src/lib/geometriaAuditorio.js para a geometria.
 *
 * Corre uma vez. Repetir não duplica (merge no mesmo campo).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "pessoal";

async function main() {
  const ref = db.doc(`bases/${BASE}/acomodacao/planta`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Planta do auditório da Pessoal ainda não existe — corre scripts/seedPessoal.mjs primeiro.");

  await ref.set({
    fileirasExtra: [
      { id: "M", atras: "L", colunas: [1, 2, 11, 12] },
    ],
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: "migracao-fileira-m",
  }, { merge: true });

  console.log("fileira M acrescentada à planta (M1/M2 atrás de L1/L2, M3/M4 atrás de L11/L12)");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
