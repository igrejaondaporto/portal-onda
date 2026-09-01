/**
 * Biblioteca de músicas — título+artista é a identidade (um cover de
 * outro artista é música separada, nunca uma versão). Versões guardam
 * tom/BPM/duração por arranjo; só o Adriel marca a versão padrão da
 * Onda (ver CLAUDE.md desta base).
 *
 * Fase 1: sem resolução automática de tom/BPM/links — isso fica para
 * quando houver chaves do GetSongBPM/YouTube. Só a capa é automática
 * (Deezer, API pública sem chave), via as Cloud Functions
 * buscarCapaDeezer/processarCapaMusica.
 *
 * A biblioteca fica abaixo de 500 músicas — carrega tudo com
 * onSnapshot uma vez; busca e filtros correm no cliente contra essa
 * cache, nunca uma leitura por tecla digitada.
 */
import { doc, onSnapshot, orderBy, query, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cMusicas, cVersoes } from "./modelo";

export const CLASSIFICACOES = [
  { id: "adoracao", nome: "Adoração", ajuda: "Cânticos cujas letras expressam reconhecimento a Deus por aquilo que Ele é." },
  { id: "alegria", nome: "Alegria", ajuda: "Expressam alegria pelo Senhor e pelos Seus feitos." },
  { id: "consagracao", nome: "Consagração", ajuda: "Tratam da dedicação de nossas vidas a Deus e da santificação." },
  { id: "contemplacao", nome: "Contemplação", ajuda: "Concentram-se em meditar na Pessoa de Deus, Seu caráter e Suas qualidades." },
  { id: "especiais", nome: "Especiais", ajuda: "Temas como casamento, batizados e datas." },
  { id: "louvor", nome: "Louvor", ajuda: "Expressam elogio e agradecimento por aquilo que Deus fez, faz ou fará." },
];

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** letras.mus.br e cifraclub.com.br partilham o padrão {artista}/{musica}. */
export function slugMusica(titulo, artista) {
  const s = (v) => norm(v).replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return `${s(artista)}/${s(titulo)}`;
}
export const chaveIdentidade = (titulo, artista) => `${norm(artista)}__${norm(titulo)}`;

export function ouvirMusicas(cb) {
  const q = query(cMusicas(), orderBy("ultimaVezTocada"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirVersoes(musicaId, cb) {
  return onSnapshot(cVersoes(musicaId), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novaMusicaId = () => doc(cMusicas()).id;

/** Nunca bloqueia — só avisa "é uma versão nova?" e mostra a existente
 *  (ver CLAUDE.md desta base, decisão 9). */
export function encontrarDuplicata(musicas, titulo, artista) {
  const chave = chaveIdentidade(titulo, artista);
  return musicas.find((m) => m.chaveIdentidade === chave) ?? null;
}

export async function criarMusica(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/musicas/${id}`), {
    titulo: dados.titulo.trim(),
    artista: dados.artista.trim(),
    chaveIdentidade: chaveIdentidade(dados.titulo, dados.artista),
    slug: slugMusica(dados.titulo, dados.artista),
    classificacoes: dados.classificacoes ?? [],
    duracao: dados.duracao ?? null,
    capaUrl: dados.capaUrl ?? null,
    capaOrigem: dados.capaOrigem ?? "placeholder",
    deezerId: dados.deezerId ?? null,
    previewUrl: dados.previewUrl ?? null,
    links: {
      letra: dados.links?.letra || "", cifra: dados.links?.cifra || "",
      audio: dados.links?.audio || "", video: dados.links?.video || "",
    },
    autoral: !!dados.autoral,
    criadoPor: dados.criadoPor,
    criadoEm: serverTimestamp(),
    ultimaVezTocada: null,
    vezes90d: 0,
    versaoPadraoId: null,
  });
  return id;
}

export const guardarMusica = (id, dados) => updateDoc(doc(db, `bases/${BASE_ID}/musicas/${id}`), dados);

/** Só o líder pode chamar isto de facto — as regras do Firestore
 *  recusam a outra gente escrever versaoPadraoId (ver firestore.rules). */
export const definirVersaoPadrao = (musicaId, versaoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}`), { versaoPadraoId: versaoId });

export const novaVersaoId = (musicaId) => doc(cVersoes(musicaId)).id;

export async function criarVersao(musicaId, id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${id}`), {
    nome: dados.nome?.trim() || "Onda",
    tom: dados.tom?.trim() || "",
    bpm: dados.bpm || null,
    duracao: dados.duracao || null,
    observacao: dados.observacao?.trim() || "",
    fonteTom: dados.fonteTom || "manual",
    fonteBpm: dados.fonteBpm || "manual",
    criadoPor: dados.criadoPor,
    criadoEm: serverTimestamp(),
  });
  return id;
}

export const guardarVersao = (musicaId, versaoId, dados) =>
  updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), dados);

/* ── Deezer (Fase 1 — só a capa é automática) ──────────────── */
export const buscarCapaDeezer = (titulo, artista) =>
  chamar("buscarCapaDeezer")({ titulo, artista }).then((r) => r.data.resultados);

/** Baixa a capa escolhida, converte para WebP 250px e copia para o
 *  Storage — a própria função grava capaUrl/capaOrigem/deezerId/
 *  previewUrl no Firestore (ver functions/index.js). */
export const aplicarCapaDeezer = (musicaId, deezerId) =>
  chamar("processarCapaMusica")({ musicaId, deezerId }).then((r) => r.data);

/** O link de prévia do Deezer expira em poucas horas — nunca tocar
 *  direto o que estiver gravado (`previewUrl`/`preview`), pedir
 *  sempre um novo aqui pelo `deezerId` (esse não expira) na hora de
 *  tocar. Ver obterPreviaDeezer em functions/index.js. */
export const obterPreviaDeezer = (deezerId) =>
  chamar("obterPreviaDeezer")({ deezerId }).then((r) => r.data.preview);

/** Fase 2 — pesquisa só pelo nome e devolve vários candidatos já
 *  enriquecidos (capa, tom via Cifra Club, BPM via GetSongBPM quando
 *  a chave estiver definida, links de cifra/letra/áudio). Nunca falha
 *  por um candidato não se conseguir enriquecer — só vem com menos
 *  dados. `pagina` (0, 1, 2…) pede mais resultados do Deezer; devolve
 *  também `temMais`, para o "Ver mais" só aparecer quando faz sentido. */
export const pesquisarMusica = (nome, pagina = 0) =>
  chamar("pesquisarMusicaLouvor")({ nome, pagina }).then((r) => r.data);

/** Só o líder — puxa o repertório inteiro da parceria oficial com o
 *  LouveApp (tom/BPM/links já curados pela igreja) e atualiza a
 *  Biblioteca. Ver functions/index.js, sincronizarLouveAppLouvor. */
export const sincronizarLouveApp = () =>
  chamar("sincronizarLouveAppLouvor")({}).then((r) => r.data);
