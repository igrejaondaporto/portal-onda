/**
 * Sonda solta contra o FreeShow, sem Firebase — só para validar a
 * deteção de secção (ver functions/freeshow.js) antes de tocar em
 * Firestore. Nunca escreve nada no FreeShow — só get_projects/
 * get_output.
 *
 * Uso:
 *   node scripts/sonda-freeshow.mjs [url] [intervalo_segundos]
 * Sem argumentos, liga a https://fs.painelonda.pt a cada 5s.
 * Para testar com o FreeShow a correr no Mac: node scripts/sonda-freeshow.mjs http://localhost:5505
 * Para testar com um túnel próprio: node scripts/sonda-freeshow.mjs https://algo.trycloudflare.com
 */
import { sondarUmaVez } from "../functions/freeshow.js";

const url = process.argv[2] || "https://fs.painelonda.pt";
const intervaloSeg = Number(process.argv[3]) || 5;

console.log(`A sondar ${url} a cada ${intervaloSeg}s (Ctrl+C para parar)…\n`);

let ultimaSecaoId; // undefined até à primeira sonda

async function ciclo() {
  const agora = new Date().toLocaleTimeString("pt-PT");
  const r = await sondarUmaVez(url);

  if (!r.ok) {
    console.log(`[${agora}] ✘ ${r.motivo}${r.erro ? " — " + r.erro : ""}`);
    return;
  }
  if (!r.secao) {
    if (ultimaSecaoId !== null) {
      console.log(`[${agora}] — nada no ar${r.motivo ? ` (${r.motivo})` : ""}`);
    }
    ultimaSecaoId = null;
    return;
  }
  if (r.secao.id !== ultimaSecaoId) {
    console.log(`[${agora}] ▶ ${r.secao.nome}  (secção ${r.secao.id}, projeto ${r.projetoId})`);
    ultimaSecaoId = r.secao.id;
  }
}

await ciclo();
setInterval(ciclo, intervaloSeg * 1000);
