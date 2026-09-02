/**
 * Corrida única: preenche titulo/artista/capaUrl/links nos itens de
 * música dos repertórios já existentes, gravados antes de
 * Repertorio.jsx passar a denormalizar esses campos (a Técnica lê o
 * repertório mas não bases/louvor/musicas — de propósito, ver decisão
 * 8 do CLAUDE.md da Louvor). Idempotente: só toca em itens sem
 * `titulo`, nunca sobrescreve o que já está lá.
 *
 *   node scripts/backfillDenormRepertorioLouvor.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const DRY_RUN = process.argv.includes("--dry-run");
const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "louvor";

async function main() {
  const musicasSnap = await db.collection(`bases/${BASE}/musicas`).get();
  const musicaPorId = new Map(musicasSnap.docs.map((d) => [d.id, d.data()]));

  const repSnap = await db.collection(`bases/${BASE}/repertorios`).get();
  let repositoriosTocados = 0, itensCorrigidos = 0;

  for (const doc of repSnap.docs) {
    const dados = doc.data();
    let mudou = false;
    const novosItens = (dados.itens || []).map((item) => {
      if (item.tipo !== "musica" || item.titulo) return item;
      const m = musicaPorId.get(item.musicaId);
      if (!m) return item;
      mudou = true;
      itensCorrigidos++;
      return { ...item, titulo: m.titulo, artista: m.artista, capaUrl: m.capaUrl || null, links: m.links || null };
    });
    if (!mudou) continue;
    repositoriosTocados++;
    console.log(`${doc.id}: ${novosItens.filter((i) => i.tipo === "musica").length} músicas corrigidas nesta corrida`);
    if (!DRY_RUN) await doc.ref.set({ itens: novosItens }, { merge: true });
  }

  console.log(`\nRepertórios corrigidos: ${repositoriosTocados} · itens: ${itensCorrigidos}`);
  if (DRY_RUN) console.log("Nada foi escrito (--dry-run).");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
