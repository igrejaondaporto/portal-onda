/**
 * Inventário: qualquer voluntário mexe na quantidade diretamente. Criar,
 * editar ou desativar itens passa sempre pelas Cloud Functions — só assim
 * o responsável também pode geri-lo no dia do culto dele, sem abrir
 * essa porta a toda a gente (a Cloud Function é que decide quem pode).
 * Cada alteração de quantidade fica registada em movimentos. Nada é
 * apagado, só ativo:false.
 */
import {
  collection, doc, addDoc, onSnapshot, query, where,
  runTransaction, serverTimestamp,
} from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID, chamar } from "@portal/shared/lib/firebase.js";
import { cInventario, cListasCompras } from "./modelo";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

export function ouvirInventario(cb) {
  const q = query(cInventario(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — precisamos dele antes de gravar, para a foto
 *  (em Storage) e o documento (no Firestore) apontarem ao mesmo sítio. */
export const novoItemInventarioId = () => doc(cInventario()).id;

export const criarItemInventario = (itemId, dados) =>
  chamar("criarItemInventario")({ itemId, ...dados }).then(() => itemId);

export const guardarItemInventario = (itemId, dados) =>
  chamar("guardarItemInventario")({ itemId, ...dados }).then((r) => r.data);

export const desativarItemInventario = (itemId) =>
  chamar("desativarItemInventario")({ itemId }).then((r) => r.data);

export async function enviarFotoItemInventario(itemId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

/** increment() é atómico no servidor — duas pessoas a mexer ao mesmo
 *  tempo não se pisam, ao contrário de ler a quantidade e escrever
 *  a soma calculada no cliente. */
export async function mexerQuantidade(item, delta, uid) {
  const ref = doc(db, `bases/${BASE_ID}/inventario/${item.id}`);
  const quantidade = await runTransaction(db, async (tx) => {
    const atual = (await tx.get(ref)).data()?.quantidade ?? 0;
    const nova = Math.max(0, atual + delta);
    tx.update(ref, { quantidade: nova, atualizadoEm: serverTimestamp(), atualizadoPor: uid });
    return nova;
  });
  await addDoc(collection(db, `bases/${BASE_ID}/inventario/${item.id}/movimentos`), {
    pessoaId: uid, delta, quantidade, criadoEm: serverTimestamp(),
  });
  return quantidade;
}

/** Escrever o número direto (em vez de +/- um de cada vez) — toque no
 *  próprio número, para quem acabou de contar tudo não precisar de
 *  clicar dezenas de vezes. Mesmo registo em movimentos, com o delta
 *  calculado (pode ser negativo). */
export async function definirQuantidade(item, novaQuantidade, uid) {
  const nova = Math.max(0, Math.round(novaQuantidade));
  const ref = doc(db, `bases/${BASE_ID}/inventario/${item.id}`);
  const delta = await runTransaction(db, async (tx) => {
    const atual = (await tx.get(ref)).data()?.quantidade ?? 0;
    tx.update(ref, { quantidade: nova, atualizadoEm: serverTimestamp(), atualizadoPor: uid });
    return nova - atual;
  });
  if (delta !== 0) {
    await addDoc(collection(db, `bases/${BASE_ID}/inventario/${item.id}/movimentos`), {
      pessoaId: uid, delta, quantidade: nova, criadoEm: serverTimestamp(),
    });
  }
  return nova;
}

/**
 * Lista de compras: qualquer pessoa da base vê a lista aberta e
 * acrescenta itens (via Cloud Function — não é escrita direta do
 * cliente, porque precisa de "abrir-se sozinha" quando não há
 * nenhuma lista aberta ainda, ver functions/index.js). Fechar e
 * enviar são as únicas ações restritas (líder da base, ou o
 * responsável do culto de hoje — mesma regra de
 * `exigeGestorInventario`).
 *
 * Sem `orderBy` de propósito: juntar uma igualdade (`estado==`/`in`)
 * com `orderBy` noutro campo pede um índice composto que não existe
 * — e sem um `onError` no `onSnapshot`, essa falha é muda: o pedido
 * para escrever (a Cloud Function) funciona à mesma, só a LEITURA no
 * cliente nunca chega a chamar `cb`, e a lista parece vazia para
 * sempre mesmo depois de "adicionado com sucesso". Ordenar do lado
 * do cliente evita precisar do índice; o `onError` fica como rede de
 * segurança para a próxima vez que uma leitura destas falhar. */
export function ouvirListaCompraAberta(cb) {
  const q = query(cListasCompras(), where("estado", "==", "aberta"));
  return onSnapshot(q, (snap) => {
    const listas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadaEm?.toMillis() ?? 0) - (a.criadaEm?.toMillis() ?? 0));
    cb(listas[0] ?? null);
  }, (erro) => console.error("ouvirListaCompraAberta:", erro));
}

export function ouvirListasComprasSalvas(cb) {
  const q = query(cListasCompras(), where("estado", "in", ["fechada", "enviada"]));
  return onSnapshot(q, (snap) => {
    const listas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadaEm?.toMillis() ?? 0) - (a.criadaEm?.toMillis() ?? 0))
      .slice(0, 20);
    cb(listas);
  }, (erro) => console.error("ouvirListasComprasSalvas:", erro));
}

export const adicionarItemListaCompras = (item) =>
  chamar("adicionarItemListaCompras")({ itemId: item.id, nome: item.nome }).then((r) => r.data);

export const fecharListaCompras = (listaId) =>
  chamar("fecharListaCompras")({ listaId }).then((r) => r.data);

export const enviarListaCompras = (listaId) =>
  chamar("enviarListaCompras")({ listaId }).then((r) => r.data);

/** Texto simples, um item por linha — sem número de destino: abre o
 *  seletor de contacto do WhatsApp, porque quem faz a compra varia
 *  de semana para semana (não há um número fixo certo para isto). */
export function textoListaCompras(lista) {
  return [
    "Lista de compras — Base Pessoal",
    ...(lista.itens || []).map((i) => `• ${i.nome}`),
  ].join("\n");
}

export const linkListaComprasWhatsApp = (lista) =>
  `https://wa.me/?text=${encodeURIComponent(textoListaCompras(lista))}`;
