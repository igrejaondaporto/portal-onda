import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, chamar, db, storage } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const MAX_ATIVOS = 5;

/** Feed público — só ativos, filtrado/ordenado no cliente (ver o
 *  comentário em functions/mural.js: com o volume real do mural,
 *  filtrar em JS poupa índices compostos sem perder nada). */
export function ouvirAnunciosAtivos(cb) {
  return onSnapshot(query(collection(db, "anuncios"), where("ativo", "==", true)), (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
    cb(lista);
  });
}

/** Os meus — todos, incluindo removidos/vendidos (regra 5 do CLAUDE.md
 *  raiz: nada se apaga a sério, o histórico fica visível ao dono). */
export function ouvirMeusAnuncios(cb) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  return onSnapshot(query(collection(db, "anuncios"), where("autorId", "==", uid)), (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
    cb(lista);
  });
}

/** Painel de moderação — todos, sem filtro (coleção pequena; ver o
 *  mesmo raciocínio acima). */
export function ouvirTodosAnuncios(cb) {
  return onSnapshot(collection(db, "anuncios"), (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
    cb(lista);
  });
}

export const criarAnuncio = (dados) => chamar("criarAnuncio")(dados).then((r) => r.data);
export const editarAnuncio = (dados) => chamar("editarAnuncio")(dados).then((r) => r.data);
export const alterarEstadoAnuncio = (id, estado) => chamar("alterarEstadoAnuncio")({ id, estado }).then((r) => r.data);
export const renovarAnuncio = (id) => chamar("renovarAnuncio")({ id }).then((r) => r.data);
export const removerAnuncio = (id) => chamar("removerAnuncio")({ id }).then((r) => r.data);
export const reportarAnuncio = (id, motivo) => chamar("reportarAnuncio")({ id, motivo }).then((r) => r.data);
export const moderarAnuncio = (id, acao) => chamar("moderarAnuncio")({ id, acao }).then((r) => r.data);
export const resumoSemanalMural = () => chamar("resumoSemanalMural")().then((r) => r.data);
export const souAdminMuralAgora = () => chamar("souAdminMuralAgora")().then((r) => r.data.admin);

/** Gesto de 5 toques no logo (GatilhoModeracao/SheetDesbloquearModeracao)
 *  — mesmo formato de retorno do `entrarComoDev` partilhado, mas sem
 *  token nenhum: só marca quem já está autenticado como admin. */
export async function desbloquearModeracaoMural(senha) {
  try {
    await chamar("desbloquearModeracaoMural")({ senha });
    return { ok: true };
  } catch (e) {
    const d = e.details || {};
    if (e.message === "bloqueado" || d.bloqueado) {
      return { ok: false, bloqueado: true, faltamSegundos: d.faltamSegundos ?? 900 };
    }
    return { ok: false, restam: d.restam ?? null };
  }
}
export const pedirContactoAnuncio = (id) => chamar("pedirContactoAnuncio")({ id }).then((r) => r.data.telefone);

/** Sobe até 4 fotos para `anuncios/{uid}/{anuncioId}/` (ver
 *  storage.rules) e grava a lista de URLs no anúncio — a mesma
 *  compressão (comprimirImagem) de qualquer foto no resto do portal. */
export async function subirFotosAnuncio(anuncioId, ficheiros) {
  const uid = auth.currentUser?.uid;
  const urls = [];
  for (let i = 0; i < Math.min(ficheiros.length, 4); i++) {
    const comprimido = await comprimirImagem(ficheiros[i]);
    const caminho = `anuncios/${uid}/${anuncioId}/${i}.jpg`;
    await uploadBytes(ref(storage, caminho), comprimido);
    urls.push(await getDownloadURL(ref(storage, caminho)));
  }
  await chamar("definirFotosAnuncio")({ id: anuncioId, fotos: urls });
  return urls;
}
