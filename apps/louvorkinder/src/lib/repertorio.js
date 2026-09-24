/**
 * Repertório do domingo — um por culto (o próprio eventoId é o id do
 * documento), sem estado rascunho: fica visível para quem lê assim
 * que existe, com o selo "atualizado há X" (ver CLAUDE.md desta
 * base). Escrita direta do cliente — as regras só deixam a própria
 * base escrever. Ao contrário da Louvor, a Técnica não lê este
 * repertório (não há projeção no culto das crianças).
 */
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";
import { registarUsoVersao, desfazerUsoVersao } from "./biblioteca";

const refRepertorio = (eventoId) => doc(db, `bases/${BASE_ID}/repertorios/${eventoId}`);

export function ouvirRepertorio(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(refRepertorio(eventoId), (s) => cb(s.exists() ? s.data() : null));
}

/** Id local do item na lista (arrasto/edição) — nunca vai para outra
 *  coleção, só existe dentro do array `itens`. */
export const novoItemId = () => Math.random().toString(36).slice(2, 10);

/** `medley`: passa { observacaoMedley } quando esta música entra
 *  colada na anterior (mesmo bloco, sem parar) — ver Repertorio.jsx,
 *  que desenha as duas juntas, sem o espaço normal entre itens. A
 *  observação (ex.: "entra depois do refrão da anterior") é o que a
 *  Técnica lê para saber a hora certa de trocar o slide. */
export const itemMusica = (musicaId, versaoId, medley) => ({
  tipo: "musica", id: novoItemId(), musicaId, versaoId,
  ...(medley ? { medley: true, observacaoMedley: medley.observacaoMedley || null } : {}),
});
export const itemMomento = (nome) => ({ tipo: "momento", id: novoItemId(), nome });

/** Agrupa os itens de música em blocos por medley — uma continuação
 *  (`medley:true` logo depois de outra música) entra no mesmo bloco
 *  em vez de abrir um número novo. Mesma regra usada para numerar em
 *  Repertorio.jsx; aqui serve as prévias resumidas (Escala.jsx). */
export function agruparItensMedley(itens) {
  const blocos = [];
  (itens || []).forEach((item, i) => {
    if (item.tipo !== "musica") return;
    const continuaMedley = item.medley === true && itens[i - 1]?.tipo === "musica";
    if (continuaMedley && blocos.length) {
      blocos.at(-1).itens.push(item);
    } else {
      blocos.push({ numero: blocos.length + 1, itens: [item] });
    }
  });
  return blocos;
}

/** Grava a lista inteira de uma vez (~20 itens, uma escrita só) —
 *  é assim que a reordenação por arrasto funciona sem N escritas. */
export async function guardarRepertorio(eventoId, itens, uid) {
  await setDoc(refRepertorio(eventoId), {
    baseId: BASE_ID,
    data: eventoId,
    itens,
    montadoPor: uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  }, { merge: true });
}

/** Atalho da Biblioteca — "+ repertório" numa música já cadastrada,
 *  sem passar pela busca. Lê o que já lá está (a Biblioteca não tem o
 *  repertório carregado como o Repertorio.jsx tem) e acrescenta no
 *  fim, já denormalizado (ver Repertorio.jsx, persistir — a Técnica
 *  lê estes campos, nunca bases/louvor/musicas). */
export async function adicionarMusicaAoRepertorio(eventoId, musica, versaoId, uid) {
  const ref = refRepertorio(eventoId);
  const snap = await getDoc(ref);
  const itensAtuais = snap.exists() ? (snap.data().itens || []) : [];
  const novoItem = {
    tipo: "musica", id: novoItemId(), musicaId: musica.id, versaoId,
    titulo: musica.titulo, artista: musica.artista, capaUrl: musica.capaUrl || null, links: musica.links || null,
  };
  await setDoc(ref, {
    baseId: BASE_ID,
    data: eventoId,
    itens: [...itensAtuais, novoItem],
    montadoPor: uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  }, { merge: true });
  registarUsoVersao({ eventoId, musicaId: musica.id, versaoId });
}

/** O contrário do atalho acima — "tirar do repertório" direto da
 *  Biblioteca (pedido do líder, 2026-09: havia o "+" mas nada para
 *  voltar atrás sem ir ao Repertório). Tira TODAS as entradas dessa
 *  música (a mesma música pode estar lá duas vezes, noutra versão —
 *  decisão 7 do CLAUDE.md) e desfaz o uso de cada versão, exatamente
 *  como o ✕ de Repertorio.jsx. Lê o que lá está na hora, como
 *  adicionarMusicaAoRepertorio. Devolve quantas entradas tirou. */
export async function removerMusicaDoRepertorio(eventoId, musicaId, uid) {
  const ref = refRepertorio(eventoId);
  const snap = await getDoc(ref);
  const itensAtuais = snap.exists() ? (snap.data().itens || []) : [];
  const tirados = itensAtuais.filter((it) => it.tipo === "musica" && it.musicaId === musicaId);
  if (!tirados.length) return 0;
  await setDoc(ref, {
    itens: itensAtuais.filter((it) => !tirados.includes(it)),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  }, { merge: true });
  for (const it of tirados) desfazerUsoVersao({ eventoId, musicaId, versaoId: it.versaoId });
  return tirados.length;
}
