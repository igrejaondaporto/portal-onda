/**
 * Melhorias: qualquer voluntário reporta uma avaria ou sugere uma
 * melhoria, comenta, resolve e ajusta a previsão (estimativa de quem
 * está a tratar) a qualquer momento. Só o líder reabre uma melhoria
 * já resolvida.
 */
import { doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cMelhorias, cEventosMelhoria } from "./modelo";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

export function ouvirMelhorias(cb) {
  const q = query(cMelhorias(), where("ativo", "==", true), orderBy("abertaEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirMelhoria(melhoriaId, cb) {
  return onSnapshot(doc(db, `bases/${BASE_ID}/melhorias/${melhoriaId}`), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export function ouvirEventosMelhoria(melhoriaId, cb) {
  const q = query(cEventosMelhoria(melhoriaId), orderBy("quando"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — a foto precisa dele antes de gravar
 *  (mesmo padrão de novoFuncaoId/novoWikiId/novoEquipamentoId). */
export const novaMelhoriaId = () => doc(cMelhorias()).id;

export async function enviarFotoMelhoria(melhoriaId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/melhorias/${melhoriaId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

/** Foto de quando a melhoria é resolvida — caminho diferente da foto
 *  de abertura, para não sobrescrever uma com a outra. */
export async function enviarFotoResolucaoMelhoria(melhoriaId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/melhorias/${melhoriaId}-resolucao`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

export const abrirMelhoria = (dados) => chamar("abrirMelhoria")(dados).then((r) => r.data);
export const comentarMelhoria = (melhoriaId, texto) => chamar("comentarMelhoria")({ melhoriaId, texto }).then((r) => r.data);
export const definirEstadoMelhoria = (melhoriaId, estado) =>
  chamar("definirEstadoMelhoria")({ melhoriaId, estado }).then((r) => r.data);
export const definirPrevisao = (melhoriaId, previsao) =>
  chamar("definirPrevisao")({ melhoriaId, previsao }).then((r) => r.data);
export const resolverMelhoria = (melhoriaId, notaResolucao, fotoResolucao) =>
  chamar("resolverMelhoria")({ melhoriaId, notaResolucao, fotoResolucao }).then((r) => r.data);
export const transformarMelhoriaEmArtigoWiki = (melhoriaId) =>
  chamar("transformarMelhoriaEmArtigoWiki")({ melhoriaId }).then((r) => r.data);
export const desativarMelhoria = (melhoriaId) => chamar("desativarMelhoria")({ melhoriaId }).then((r) => r.data);

export const GRAVIDADES = [
  ["impede_culto", "Impede o culto"],
  ["atrapalha", "Atrapalha"],
  ["melhoria", "Só uma melhoria"],
];

// Cor própria para gravidade (nunca a mesma família de cor do estado,
// pra não misturar as duas etiquetas) e para o estado da melhoria.
export const GRAVIDADE_INFO = {
  impede_culto: { cor: "alta", texto: "Impede o culto" },
  atrapalha: { cor: "media", texto: "Atrapalha" },
  melhoria: { cor: "baixa", texto: "Melhoria" },
};
export const ESTADO_INFO = {
  aberta: { cor: "aberta", texto: "Aberta" },
  em_curso: { cor: "curso", texto: "Em curso" },
  resolvida: { cor: "resolvida", texto: "Resolvida" },
};

/** Cor/texto da previsão: sem previsão → cinza; hoje > previsão e
 *  ainda aberta → vermelho ("atrasada"); resto → neutro. Só para o
 *  cliente decidir a cor, nada é validado aqui. */
export function corPrevisao({ estado, previsao }) {
  if (!previsao) return { atrasada: false, texto: "Sem previsão" };
  if (estado !== "resolvida") {
    const hoje = new Date().toISOString().slice(0, 10);
    if (hoje > previsao) {
      const dias = Math.round((new Date(hoje) - new Date(previsao)) / 86400000);
      return { atrasada: true, texto: `Atrasada há ${dias} dia${dias === 1 ? "" : "s"}` };
    }
  }
  return { atrasada: false, texto: `Previsão ${previsao}` };
}

/** Quem trata de quê. Vários por melhoria: "comprei os cabos" e
 *  "testa-os no domingo" são duas pessoas no mesmo assunto. */
export const definirResponsaveisMelhoria = (melhoriaId, responsaveis) =>
  chamar("definirResponsaveisMelhoria")({ melhoriaId, responsaveis }).then((r) => r.data);

/** As melhorias por fazer de uma pessoa — para o Início dela. Não vai
 *  ao Firestore: filtra a lista que a tela já ouve. */
export const minhasTarefas = (melhorias, uid) =>
  (melhorias || []).filter((m) => m.estado !== "resolvida" && (m.responsaveis || []).includes(uid));
