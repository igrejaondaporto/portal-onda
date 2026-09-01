/**
 * Importa o export do LouveApp (.xlsx) para a biblioteca da Base
 * Louvor — ver apps/louvor/CLAUDE.md, "Importação do LouveApp".
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/importarLouveAppLouvor.mjs caminho/para/export.xlsx
 *
 * Usa --dry-run para conferir tudo primeiro sem escrever nada no
 * Firestore/Storage — imprime o resumo (músicas, versões, capas,
 * avisos) exatamente como sairia, sem tocar em produção.
 *
 * Idempotente: corre quantas vezes precisares. Música já existente
 * (mesma chaveIdentidade) só ganha as versões que ainda não tinha
 * (mesmo `nome`); nunca duplica.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import sharp from "sharp";
import admin from "firebase-admin";

const CAMINHO = process.argv.slice(2).find((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");
if (!CAMINHO) {
  console.error("Uso: node scripts/importarLouveAppLouvor.mjs caminho/export.xlsx [--dry-run]");
  process.exit(1);
}

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave), storageBucket: "painel-onda.firebasestorage.app" });
const db = admin.firestore();
const BASE = "louvor";
const IMPORTADO_POR = "adriel-louvor";

const CABECALHO = [
  "nomeMusica", "nomeArtista", "observacaoMusica", "nomeVersao", "observacaoVersao",
  "tom", "bpm", "duracao", "classificacoes", "letra", "cifra", "audio", "video", "referencias",
];

const CLASSIFICACOES = ["adoracao", "alegria", "consagracao", "contemplacao", "especiais", "louvor"];
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const chaveIdentidade = (titulo, artista) => `${norm(artista)}__${norm(titulo)}`;
const slugMusica = (titulo, artista) => {
  const s = (v) => norm(v).replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return `${s(artista)}/${s(titulo)}`;
};
const classifPorNome = (nome) => CLASSIFICACOES.find((id) => norm(id) === norm(nome).replace(/[^a-z0-9]/g, ""));

async function lerPlanilha(caminho) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const folha = wb.worksheets[0];
  if (!folha) throw new Error("A planilha não tem nenhuma folha.");

  const cabecalhoLinha = folha.getRow(1).values.slice(1).map((v) => (v || "").toString().trim());
  const indice = {};
  CABECALHO.forEach((campo) => {
    const i = cabecalhoLinha.findIndex((c) => norm(c) === norm(campo));
    if (i === -1) console.warn(`⚠ coluna "${campo}" não encontrada no cabeçalho — a ignorar.`);
    indice[campo] = i;
  });

  const linhas = [];
  folha.eachRow((row, n) => {
    if (n === 1) return;
    const valores = row.values.slice(1);
    const get = (campo) => (indice[campo] >= 0 ? (valores[indice[campo]] ?? "").toString().trim() : "");
    const nomeMusica = get("nomeMusica");
    if (!nomeMusica) return; // linha vazia
    linhas.push({
      nomeMusica, nomeArtista: get("nomeArtista"),
      observacaoMusica: get("observacaoMusica"),
      nomeVersao: get("nomeVersao") || "Onda",
      observacaoVersao: get("observacaoVersao"),
      tom: get("tom"), bpm: get("bpm"), duracao: get("duracao"),
      classificacoes: get("classificacoes"),
      letra: get("letra"), cifra: get("cifra"), audio: get("audio"), video: get("video"),
    });
  });
  return linhas;
}

/** Mesma lógica de buscarCapaDeezer/processarCapaMusica (functions/index.js),
 *  chamada direto — o script não tem sessão de utilizador para passar
 *  pelas Cloud Functions onCall. Só aceita o resultado se título e
 *  artista batem (normalizados); senão fica placeholder. */
async function resolverCapa(titulo, artista) {
  const q = `track:"${titulo}" artist:"${artista}"`;
  const resp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`);
  if (!resp.ok) return null;
  const json = await resp.json();
  const candidato = (json.data || []).find(
    (t) => norm(t.title).includes(norm(titulo).slice(0, 8)) && norm(t.artist?.name).includes(norm(artista).slice(0, 4))
  ) ?? (json.data || [])[0];
  if (!candidato?.album?.cover_medium) return null;
  return { deezerId: String(candidato.id), capaUrl: candidato.album.cover_medium, duracao: candidato.duration || null, preview: candidato.preview || null };
}

async function processarCapa(musicaId, deezerCapaUrl) {
  const imgResp = await fetch(deezerCapaUrl);
  if (!imgResp.ok) return null;
  const buffer = Buffer.from(await imgResp.arrayBuffer());
  const webp = await sharp(buffer).resize(250, 250, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  const token = randomUUID();
  const bucket = admin.storage().bucket();
  const file = bucket.file(`bases/${BASE}/capas/${musicaId}.webp`);
  await file.save(webp, { metadata: { contentType: "image/webp", metadata: { firebaseStorageDownloadTokens: token } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
}

async function main() {
  console.log(`A ler ${CAMINHO}${DRY_RUN ? " (modo --dry-run, nada será escrito)" : ""}…\n`);
  const linhas = await lerPlanilha(CAMINHO);
  console.log(`${linhas.length} linhas lidas.\n`);

  const musicasExistentesSnap = await db.collection(`bases/${BASE}/musicas`).get();
  const porChave = new Map(musicasExistentesSnap.docs.map((d) => [d.data().chaveIdentidade, { id: d.id, ...d.data() }]));

  const avisos = [];
  const resumo = { musicasCriadas: 0, musicasExistentes: 0, versoesCriadas: 0, versoesJaExistiam: 0, capasResolvidas: 0, capasSemCorrespondencia: 0 };

  // agrupar por música
  const porMusica = new Map();
  for (const l of linhas) {
    const chave = chaveIdentidade(l.nomeMusica, l.nomeArtista);
    if (!porMusica.has(chave)) porMusica.set(chave, []);
    porMusica.get(chave).push(l);
  }

  for (const [chave, versoesLinha] of porMusica) {
    const primeira = versoesLinha[0];
    let musica = porChave.get(chave);
    let musicaId;

    if (musica) {
      musicaId = musica.id;
      resumo.musicasExistentes++;
    } else {
      musicaId = db.collection(`bases/${BASE}/musicas`).doc().id;
      const classificacoes = (primeira.classificacoes || "")
        .split(",").map((c) => classifPorNome(c)).filter(Boolean);
      const naoReconhecidas = (primeira.classificacoes || "").split(",").map((c) => c.trim()).filter((c) => c && !classifPorNome(c));
      if (naoReconhecidas.length) avisos.push(`"${primeira.nomeMusica}": classificação(ões) não reconhecida(s): ${naoReconhecidas.join(", ")}`);

      let capa = null;
      try {
        capa = await resolverCapa(primeira.nomeMusica, primeira.nomeArtista);
      } catch (e) {
        avisos.push(`"${primeira.nomeMusica}": falha a procurar capa no Deezer (${e.message})`);
      }
      if (capa) resumo.capasResolvidas++; else { resumo.capasSemCorrespondencia++; avisos.push(`"${primeira.nomeMusica}" · ${primeira.nomeArtista}: sem capa correspondente no Deezer — fica placeholder.`); }

      const dados = {
        titulo: primeira.nomeMusica, artista: primeira.nomeArtista,
        chaveIdentidade: chave, slug: slugMusica(primeira.nomeMusica, primeira.nomeArtista),
        classificacoes, duracao: capa?.duracao ?? null,
        capaUrl: null, capaOrigem: "placeholder", deezerId: capa?.deezerId ?? null, previewUrl: capa?.preview ?? null,
        links: { letra: primeira.letra, cifra: primeira.cifra, audio: primeira.audio, video: primeira.video },
        autoral: false, criadoPor: IMPORTADO_POR,
        ultimaVezTocada: null, vezes90d: 0, versaoPadraoId: null,
      };

      if (!DRY_RUN) {
        await db.doc(`bases/${BASE}/musicas/${musicaId}`).set({ ...dados, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
        if (capa) {
          const capaUrl = await processarCapa(musicaId, capa.capaUrl).catch((e) => { avisos.push(`"${primeira.nomeMusica}": falha a processar capa (${e.message})`); return null; });
          if (capaUrl) await db.doc(`bases/${BASE}/musicas/${musicaId}`).set({ capaUrl, capaOrigem: "deezer" }, { merge: true });
        }
      }
      musica = { id: musicaId, chaveIdentidade: chave, versoesExistentes: new Set() };
      resumo.musicasCriadas++;
      console.log(`+ música  ${primeira.nomeMusica} · ${primeira.nomeArtista}${capa ? " (capa resolvida)" : " (sem capa)"}`);
    }

    // versões — buscar as já existentes só quando a música já existia
    let nomesVersoesExistentes = musica.versoesExistentes;
    if (!nomesVersoesExistentes) {
      const versoesSnap = await db.collection(`bases/${BASE}/musicas/${musicaId}/versoes`).get();
      nomesVersoesExistentes = new Set(versoesSnap.docs.map((d) => norm(d.data().nome)));
    }

    for (const l of versoesLinha) {
      if (nomesVersoesExistentes.has(norm(l.nomeVersao))) { resumo.versoesJaExistiam++; continue; }
      const versaoId = db.collection(`bases/${BASE}/musicas/${musicaId}/versoes`).doc().id;
      const dadosVersao = {
        nome: l.nomeVersao, tom: l.tom || "", bpm: l.bpm ? Number(l.bpm) || null : null,
        duracao: l.duracao ? Number(l.duracao) || null : null,
        observacao: [l.observacaoMusica, l.observacaoVersao].filter(Boolean).join(" — "),
        fonteTom: "louveapp", fonteBpm: "louveapp", criadoPor: IMPORTADO_POR,
      };
      if (!DRY_RUN) {
        await db.doc(`bases/${BASE}/musicas/${musicaId}/versoes/${versaoId}`).set({ ...dadosVersao, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
      nomesVersoesExistentes.add(norm(l.nomeVersao));
      resumo.versoesCriadas++;
      console.log(`  + versão "${l.nomeVersao}"${l.tom ? ` · tom ${l.tom}` : ""}${l.bpm ? ` · ${l.bpm} BPM` : ""}`);
    }
  }

  // segunda passagem: músicas com deezerId mas sem capa a sério — cobre
  // tanto as desta corrida como sobras de uma corrida anterior que
  // falhou a meio (ex.: erro de configuração do Storage).
  if (!DRY_RUN) {
    const pendentesSnap = await db.collection(`bases/${BASE}/musicas`)
      .where("capaOrigem", "==", "placeholder").get();
    for (const doc of pendentesSnap.docs) {
      const m = doc.data();
      if (!m.deezerId) continue;
      try {
        const capaResp = await fetch(`https://api.deezer.com/track/${m.deezerId}`);
        const track = await capaResp.json();
        const capaOrigemUrl = track.album?.cover_medium;
        if (!capaOrigemUrl) continue;
        const capaUrl = await processarCapa(doc.id, capaOrigemUrl);
        if (capaUrl) {
          await doc.ref.set({ capaUrl, capaOrigem: "deezer" }, { merge: true });
          resumo.capasResolvidas++;
          console.log(`✓ capa reprocessada: ${m.titulo}`);
        }
      } catch (e) {
        avisos.push(`"${m.titulo}": segunda tentativa de capa falhou (${e.message})`);
      }
    }
  }

  console.log("\n── RESUMO ─────────────────────────────────────");
  console.log(`Músicas novas: ${resumo.musicasCriadas} · já existiam: ${resumo.musicasExistentes}`);
  console.log(`Versões novas: ${resumo.versoesCriadas} · já existiam: ${resumo.versoesJaExistiam}`);
  console.log(`Capas resolvidas automaticamente: ${resumo.capasResolvidas} · sem correspondência: ${resumo.capasSemCorrespondencia}`);
  if (avisos.length) {
    console.log(`\n── AVISOS (${avisos.length}) ───────────────────────────`);
    avisos.forEach((a) => console.log(`  ⚠ ${a}`));
  }
  if (DRY_RUN) console.log("\nNada foi escrito (--dry-run). Corre sem essa flag para gravar a sério.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
