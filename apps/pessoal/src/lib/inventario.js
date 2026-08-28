/**
 * Inventário: qualquer voluntário mexe na quantidade diretamente. Criar,
 * editar ou desativar itens passa sempre pelas Cloud Functions — só assim
 * o responsável também pode geri-lo no dia do culto dele, sem abrir
 * essa porta a toda a gente (a Cloud Function é que decide quem pode).
 * Cada alteração de quantidade fica registada em movimentos. Nada é
 * apagado, só ativo:false.
 */
import {
  collection, doc, addDoc, onSnapshot, orderBy, query, where, limit,
  runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID, chamar } from "@portal/shared/lib/firebase.js";
import { cInventario, cListasCompras, cListaCompras } from "./modelo";
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

/**
 * Lista de compras: qualquer pessoa da base vê e acrescenta itens à
 * lista aberta (regras: só o campo `itens` muda, só enquanto
 * `estado === "aberta"`) — fechar e enviar são as únicas ações
 * restritas (líder da base, ou o responsável do culto de hoje),
 * por isso passam pela Cloud Function (mesma regra de
 * `exigeGestorInventario`, ver functions/index.js).
 */
export function ouvirListaCompraAberta(cb) {
  const q = query(cListasCompras(), where("estado", "==", "aberta"), orderBy("criadaEm", "desc"), limit(1));
  return onSnapshot(q, (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
}

export function ouvirListasComprasSalvas(cb) {
  const q = query(cListasCompras(), where("estado", "in", ["fechada", "enviada"]), orderBy("criadaEm", "desc"), limit(20));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Transação (não arrayUnion) porque precisamos de saber já se o item
 *  estava lá — é o que decide se o botão mostra "adicionado" ou
 *  "já estava". `serverTimestamp()` não é permitido dentro de um
 *  array, por isso cada entrada leva `Timestamp.now()` (hora do
 *  cliente) em vez disso — só para mostrar "há 2 min", não é usado
 *  para nenhuma decisão sensível. */
export async function adicionarItemListaCompras(listaId, item, uid) {
  const ref = cListaCompras(listaId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const itens = snap.data()?.itens || [];
    if (itens.some((i) => i.itemId === item.itemId)) return { jaAdicionado: true };
    tx.update(ref, {
      itens: [...itens, { itemId: item.itemId, nome: item.nome, adicionadoPor: uid, adicionadoEm: Timestamp.now() }],
    });
    return { jaAdicionado: false };
  });
}

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
