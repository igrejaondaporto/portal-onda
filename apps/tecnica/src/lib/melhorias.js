/**
 * Melhorias: qualquer voluntário reporta uma avaria ou sugere uma
 * melhoria, comenta e resolve; só o líder da base define a meta
 * (data-limite) e reabre uma melhoria já resolvida — a previsão é
 * sempre de quem está a tratar, não precisa de ser líder.
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

export const abrirMelhoria = (dados) => chamar("abrirMelhoria")(dados).then((r) => r.data);
export const comentarMelhoria = (melhoriaId, texto) => chamar("comentarMelhoria")({ melhoriaId, texto }).then((r) => r.data);
export const definirEstadoMelhoria = (melhoriaId, estado) =>
  chamar("definirEstadoMelhoria")({ melhoriaId, estado }).then((r) => r.data);
export const definirMetaPrevisao = (melhoriaId, campos) =>
  chamar("definirMetaPrevisao")({ melhoriaId, ...campos }).then((r) => r.data);
export const resolverMelhoria = (melhoriaId, notaResolucao) =>
  chamar("resolverMelhoria")({ melhoriaId, notaResolucao }).then((r) => r.data);
export const transformarMelhoriaEmArtigoWiki = (melhoriaId) =>
  chamar("transformarMelhoriaEmArtigoWiki")({ melhoriaId }).then((r) => r.data);
export const desativarMelhoria = (melhoriaId) => chamar("desativarMelhoria")({ melhoriaId }).then((r) => r.data);

export const GRAVIDADES = [
  ["impede_culto", "Impede o culto"],
  ["atrapalha", "Atrapalha"],
  ["melhoria", "Só uma melhoria"],
];

/** Regra de cor do CLAUDE.md: previsão ≤ meta → verde; previsão >
 *  meta → amarelo; hoje > previsão e ainda aberta → vermelho; sem
 *  meta → cinza. Só para o cliente decidir a cor, nada é validado
 *  aqui — quem decide o que pode gravar é a Cloud Function. */
export function corMelhoria({ estado, meta, previsao }) {
  if (estado === "resolvida") return { cor: "verd", texto: "Resolvida" };
  if (!meta) return { cor: "cinz", texto: previsao ? `Previsão ${previsao}` : "Sem meta" };
  const hoje = new Date().toISOString().slice(0, 10);
  if (previsao && hoje > previsao) {
    const dias = Math.round((new Date(hoje) - new Date(previsao)) / 86400000);
    return { cor: "", texto: `Atrasada há ${dias} dia${dias === 1 ? "" : "s"}` };
  }
  if (previsao && previsao > meta) {
    const dias = Math.round((new Date(previsao) - new Date(meta)) / 86400000);
    return { cor: "lim", texto: `${dias} dia${dias === 1 ? "" : "s"} além da meta` };
  }
  return { cor: "verd", texto: `Meta ${meta}` };
}
