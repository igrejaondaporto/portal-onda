/**
 * Migra eventos/{e}/escalas/comunicacao.lugares do formato antigo
 * ({ministerioId, titularId, aprendizId}) para o novo, de lista aberta
 * ({ministerioId, pessoas:[id]}) — ver commit "Escala da Comunicação:
 * lista aberta por ministério, não titular+aprendiz".
 *
 * Sem isto, qualquer escala já guardada antes da alteração ficaria
 * invisível na nova interface (lê `l.pessoas`, que não existe nos
 * docs antigos) até o líder a reeditar do zero — um "apagão" visual
 * de dados que já lá estavam.
 *
 * Só toca em `lugares` que ainda tenham `titularId`/`aprendizId` —
 * correr duas vezes não faz mal (idempotente).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/migrarEscalaComunicacao.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  // Sem índice de collectionGroup para "escalas" — em vez de pedir um
  // só para este script de uso único, percorre eventos/{id}/escalas/
  // comunicacao diretamente (eventos são poucos, um por domingo).
  const eventosSnap = await db.collection("eventos").get();
  console.log(`${eventosSnap.size} evento(s) a verificar.\n`);

  let migradas = 0;
  for (const ev of eventosSnap.docs) {
    const ref = db.doc(`eventos/${ev.id}/escalas/comunicacao`);
    const doc = await ref.get();
    if (!doc.exists) continue;

    const dados = doc.data();
    const lugares = dados.lugares || [];
    const precisaMigrar = lugares.some((l) => "titularId" in l || "aprendizId" in l);
    if (!precisaMigrar) continue;

    const lugaresNovos = lugares.map((l) => {
      if (!("titularId" in l) && !("aprendizId" in l)) return l; // já no formato novo
      const pessoas = [l.titularId, l.aprendizId].filter(Boolean);
      return { ministerioId: l.ministerioId, pessoas };
    });

    await ref.update({ lugares: lugaresNovos });
    migradas++;
    console.log(`migrada: ${ref.path}`);
  }

  console.log(`\n${migradas} escala(s) migrada(s).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
