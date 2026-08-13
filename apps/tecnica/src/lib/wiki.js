/**
 * Wiki: o líder cria esqueletos (só título + ministérios) e qualquer
 * voluntário reclama e escreve; há também "Dúvida" — pergunta livre,
 * respostas, quem perguntou marca a certa e pode transformar em artigo.
 * Toda escrita passa por Cloud Function (ver functions/index.js) porque
 * a autoria é mista e cada mudança recalcula o índice de busca —
 * ao contrário de funcoes/ministerios, aqui não há escrita direta.
 */
import { doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cWiki, cRespostasWiki, cWikiIndiceDoc } from "./modelo";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

/** Índice leve (sem imagens/corpo) — um doc só, sem query nem índice
 *  do Firestore a criar. A busca em si é feita no cliente. */
export function ouvirIndiceWiki(cb) {
  return onSnapshot(cWikiIndiceDoc(), (s) => cb(s.exists() ? s.data().itens || [] : []));
}

export function ouvirArtigo(wikiId, cb) {
  return onSnapshot(doc(db, `bases/${BASE_ID}/wiki/${wikiId}`), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export function ouvirRespostas(wikiId, cb) {
  const q = query(cRespostasWiki(wikiId), orderBy("criadoEm"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — precisa de existir antes de guardar, para as
 *  fotos dos passos (em Storage) apontarem para o artigo certo mesmo
 *  antes do primeiro "Guardar" (mesmo padrão de novoFuncaoId). */
export const novoWikiId = () => doc(cWiki()).id;

export async function enviarFotoWikiPasso(wikiId, indice, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/wiki/${wikiId}-${indice}-${Date.now()}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

export const criarEsqueletoWiki = (dados) => chamar("criarEsqueletoWiki")(dados).then((r) => r.data);
export const guardarArtigoWiki = (dados) => chamar("guardarArtigoWiki")(dados).then((r) => r.data);
export const desativarWiki = (wikiId) => chamar("desativarWiki")({ wikiId }).then((r) => r.data);
export const criarDuvida = (dados) => chamar("criarDuvida")(dados).then((r) => r.data);
export const responderDuvida = (wikiId, texto) => chamar("responderDuvida")({ wikiId, texto }).then((r) => r.data);
export const marcarRespostaCerta = (wikiId, respostaId) =>
  chamar("marcarRespostaCerta")({ wikiId, respostaId }).then((r) => r.data);
export const transformarDuvidaEmArtigo = (wikiId) =>
  chamar("transformarDuvidaEmArtigo")({ wikiId }).then((r) => r.data);
