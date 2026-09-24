/**
 * Importa o export do LouveApp (.xlsx) para a biblioteca da Base
 * Louvor — ver apps/louvor/CLAUDE.md, "Importação do LouveApp".
 * Serve também a biblioteca infantil do Louvor Kinder com
 * --base=louvorkinder (ver apps/louvorkinder/CLAUDE.md) — cada base
 * tem a sua coleção `bases/{base}/musicas`, nunca se misturam.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/importarLouveAppLouvor.mjs caminho/para/export.xlsx [--base=louvorkinder]
 *
 * Aceita os dois cabeçalhos que o LouveApp já exportou: o técnico
 * (nomeMusica | nomeArtista | …) e o legível ("Nome da música" |
 * "Artista" | "Álbum" | …). "Álbum" e "Referências" são ignorados.
 * Duração em segundos ou "m:ss"; BPM/duração a 0 contam como vazio.
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
const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) || "louvor";
if (!CAMINHO) {
  console.error("Uso: node scripts/importarLouveAppLouvor.mjs caminho/export.xlsx [--base=louvorkinder] [--dry-run]");
  process.exit(1);
}

/** Por base: quem fica como `criadoPor` e as classificações que a app
 *  dessa base conhece (o mesmo `CLASSIFICACOES` de
 *  apps/<base>/src/lib/biblioteca.js — um id fora daqui nem aparece). */
const LOUVOR = ["adoracao", "alegria", "consagracao", "contemplacao", "especiais", "louvor"];
const POR_BASE = {
  louvor: { importadoPor: "adriel-louvor", classificacoes: LOUVOR },
  louvorkinder: { importadoPor: "adriel-louvor", classificacoes: [...LOUVOR, "infantil", "animada", "calma", "biblica", "antiga"] },
};
if (!POR_BASE[BASE]) {
  console.error(`Base "${BASE}" desconhecida — acrescenta-a a POR_BASE primeiro.`);
  process.exit(1);
}

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave), storageBucket: "painel-onda.firebasestorage.app" });
const db = admin.firestore();
const IMPORTADO_POR = POR_BASE[BASE].importadoPor;

/** Campo → nomes de coluna aceites (comparados sem acentos, maiúsculas,
 *  espaços nem pontuação). */
const CABECALHO = {
  nomeMusica: ["nomeMusica", "Nome da música"],
  nomeArtista: ["nomeArtista", "Artista"],
  observacaoMusica: ["observacaoMusica", "Observação da música"],
  nomeVersao: ["nomeVersao", "Nome da versão"],
  observacaoVersao: ["observacaoVersao", "Observação da versão"],
  tom: ["tom"], bpm: ["bpm"], duracao: ["duracao"],
  classificacoes: ["classificacoes"],
  letra: ["letra"], cifra: ["cifra"], audio: ["audio"], video: ["video"],
};

const CLASSIFICACOES = POR_BASE[BASE].classificacoes;
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const normColuna = (s) => norm(s).replace(/[^a-z0-9]/g, "");

/** O ExcelJS devolve um link como {text, hyperlink} e texto formatado
 *  como {richText: [...]} — nunca deixar isso virar "[object Object]". */
function textoCelula(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (v.hyperlink) return String(v.hyperlink);
    if (v.richText) return v.richText.map((p) => p.text).join("");
    if (v.text != null) return textoCelula(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v).trim();
}

/** Segundos, a partir de "310", "3:22" ou "1:03:22". 0 = sem duração. */
function segundos(v) {
  if (!v) return null;
  const partes = v.split(":").map(Number);
  if (partes.some((n) => !Number.isFinite(n))) return null;
  const s = partes.reduce((acc, n) => acc * 60 + n, 0);
  return s > 0 ? Math.round(s) : null;
}
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

  const cabecalhoLinha = folha.getRow(1).values.slice(1).map(textoCelula);
  const indice = {};
  Object.entries(CABECALHO).forEach(([campo, nomes]) => {
    const aceites = nomes.map(normColuna);
    const i = cabecalhoLinha.findIndex((c) => aceites.includes(normColuna(c)));
    if (i === -1) console.warn(`⚠ coluna "${campo}" não encontrada no cabeçalho — a ignorar.`);
    indice[campo] = i;
  });

  const linhas = [];
  folha.eachRow((row, n) => {
    if (n === 1) return;
    const valores = row.values.slice(1);
    const get = (campo) => (indice[campo] >= 0 ? textoCelula(valores[indice[campo]]) : "");
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
  // A busca avançada (track:/artist:) passou a vir vazia para muitas
  // músicas (2026-09, importação do Louvor Kinder: 0 de 19) — cai na
  // busca simples, a mesma que `pesquisarMusicaPorNome` usa na app.
  // Nas duas, só aceita um resultado com título E artista a bater:
  // nunca o primeiro da lista às cegas (dava a capa de outra música).
  // Faixas de ruído/instrumental/playback nunca são "a" música (têm
  // outra capa e outra duração), a não ser que o título as peça.
  const variante = /ruido|instrumental|playback|karaoke/;
  const bate = (t) => norm(t.title).includes(norm(titulo).slice(0, 8))
    && norm(t.artist?.name).includes(norm(artista).slice(0, 4))
    && (!variante.test(norm(t.title)) || variante.test(norm(titulo)));
  let candidato = null;
  for (const q of [`track:"${titulo}" artist:"${artista}"`, `${titulo} ${artista}`]) {
    const resp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`);
    if (!resp.ok) continue;
    const json = await resp.json();
    const validos = (json.data || []).filter((t) => bate(t) && t.album?.cover_medium);
    // título exatamente igual primeiro — "Eu preciso de você" apanhava
    // "Eu Preciso De Você (Ruído Marrom)", com outra duração.
    candidato = validos.find((t) => norm(t.title) === norm(titulo)) ?? validos[0];
    if (candidato) break;
  }
  if (!candidato) return null;
  return {
    deezerId: String(candidato.id), capaUrl: candidato.album.cover_medium, duracao: candidato.duration || null, preview: candidato.preview || null,
    encontrado: `${candidato.title} · ${candidato.artist?.name ?? "?"}`,
  };
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
      console.log(`+ música  ${primeira.nomeMusica} · ${primeira.nomeArtista}${capa ? ` (capa: ${capa.encontrado})` : " (sem capa)"}`);
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
        nome: l.nomeVersao, tom: l.tom || "", bpm: Number(l.bpm) > 0 ? Math.round(Number(l.bpm)) : null,
        duracao: segundos(l.duracao),
        observacao: [l.observacaoMusica, l.observacaoVersao].filter(Boolean).join(" — "),
        fonteTom: "louveapp", fonteBpm: "louveapp", criadoPor: IMPORTADO_POR,
      };
      if (!DRY_RUN) {
        await db.doc(`bases/${BASE}/musicas/${musicaId}/versoes/${versaoId}`).set({ ...dadosVersao, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
      nomesVersoesExistentes.add(norm(l.nomeVersao));
      resumo.versoesCriadas++;
      console.log(`  + versão "${l.nomeVersao}"${dadosVersao.tom ? ` · tom ${dadosVersao.tom}` : ""}${dadosVersao.bpm ? ` · ${dadosVersao.bpm} BPM` : ""}${dadosVersao.duracao ? ` · ${dadosVersao.duracao}s` : ""}`);
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
