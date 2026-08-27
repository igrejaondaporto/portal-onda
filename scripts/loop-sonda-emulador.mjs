/**
 * Chama sondarFreeshow repetidamente contra os Emuladores — para
 * testar a ordem do culto ao vivo no Mac sem esperar pelo minuto do
 * Cloud Scheduler. Precisa dos emuladores já a correr (ver o plano da
 * funcionalidade) e do FreeShow local (ou de um túnel para ele).
 *
 * Uso, a partir da raiz do repo:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=painel-onda \
 *   TUNEL_FREESHOW=http://localhost:5505 \
 *   node scripts/loop-sonda-emulador.mjs
 */
import * as fns from "../functions/index.js";

const INTERVALO_MS = 5000;
console.log(`A sondar o FreeShow a cada ${INTERVALO_MS / 1000}s (Ctrl+C para parar)…`);

setInterval(async () => {
  try {
    await fns.sondarFreeshow.run();
    process.stdout.write(".");
  } catch (e) {
    console.error("\nerro:", e.message);
  }
}, INTERVALO_MS);
