/**
 * Inventário: qualquer voluntário mexe na quantidade diretamente. Criar,
 * editar ou desativar itens passa sempre pelas Cloud Functions — só assim
 * o líder de escala também pode geri-lo no dia do culto dele, sem abrir
 * essa porta a toda a gente (a Cloud Function é que decide quem pode).
 * Cada alteração de quantidade fica registada em movimentos. Nada é
 * apagado, só ativo:false.
 */
import {
  collection, doc, addDoc, onSnapshot, orderBy, query, where,
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
 * enviar são as únicas ações restritas (líder da base, ou o líder
 * de escala do culto de hoje — mesma regra de
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

/** Listas fechadas/enviadas de um mês — mesmo filtro de
 *  `HistoricoContagem`/Formulário, mas por `criadaEm` (Timestamp) em
 *  vez de `eventoId` (string). Igualdade/intervalo e `orderBy` no
 *  MESMO campo (`criadaEm`) não pede índice composto — ao contrário
 *  de `ouvirListaCompraAberta` acima, que junta `estado` (outro
 *  campo) com `orderBy`. */
export function ouvirListasComprasDoMes(ano, mesIndex, cb) {
  const inicio = new Date(ano, mesIndex, 1);
  const fim = new Date(ano, mesIndex + 1, 1);
  const q = query(
    cListasCompras(),
    where("criadaEm", ">=", inicio), where("criadaEm", "<", fim),
    orderBy("criadaEm", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.estado !== "aberta")),
    (erro) => console.error("ouvirListasComprasDoMes:", erro));
}

/**
 * Acrescentar/tirar/mexer quantidade são escrita direta do cliente
 * (rules: só o campo `itens`, só enquanto `estado == "aberta"`) —
 * rápido, como o resto do inventário (`mexerQuantidade` acima). A
 * Cloud Function só entra quando NÃO há lista aberta ainda (a lista
 * tem de "nascer sozinha") — é por isso que só o primeiro item de
 * uma lista nova demora mais (round-trip a uma função na nuvem);
 * todo o resto é local-first, com a mesma sensação instantânea do
 * +/- da quantidade. `listaAbertaId` vem do que já está no ecrã
 * (`ouvirListaCompraAberta`) — quando `null`, cai para a função. */
export async function adicionarItemListaCompras(item, listaAbertaId, uid) {
  if (!listaAbertaId) {
    return chamar("adicionarItemListaCompras")({ itemId: item.id, nome: item.nome }).then((r) => r.data);
  }
  const ref = cListaCompras(listaAbertaId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const itens = snap.data()?.itens || [];
    if (itens.some((i) => i.itemId === item.id)) return { jaAdicionado: true };
    tx.update(ref, {
      itens: [...itens, { itemId: item.id, nome: item.nome, quantidade: 1, adicionadoPor: uid, adicionadoEm: Timestamp.now() }],
    });
    return { jaAdicionado: false };
  });
}

export async function alterarQuantidadeItemListaCompras(listaId, itemId, delta) {
  const ref = cListaCompras(listaId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const itens = (snap.data()?.itens || []).map((i) =>
      i.itemId === itemId ? { ...i, quantidade: Math.max(1, (i.quantidade || 1) + delta) } : i);
    tx.update(ref, { itens });
  });
}

export async function removerItemListaCompras(listaId, itemId) {
  const ref = cListaCompras(listaId);
  await runTransaction(db, async (tx) => {
    const itens = ((await tx.get(ref)).data()?.itens || []).filter((i) => i.itemId !== itemId);
    tx.update(ref, { itens });
  });
}

export const fecharListaCompras = (listaId) =>
  chamar("fecharListaCompras")({ listaId }).then((r) => r.data);

export const enviarListaCompras = (listaId) =>
  chamar("enviarListaCompras")({ listaId }).then((r) => r.data);

/** Texto simples, um item por linha (com a quantidade quando > 1) —
 *  sem número de destino: abre o seletor de contacto do WhatsApp,
 *  porque quem faz a compra varia de semana para semana (não há um
 *  número fixo certo para isto). */
export function textoListaCompras(lista) {
  return [
    "Lista de compras — Base de Apoio",
    ...(lista.itens || []).map((i) => `• ${i.nome}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ""}`),
  ].join("\n");
}

export const linkListaComprasWhatsApp = (lista) =>
  `https://wa.me/?text=${encodeURIComponent(textoListaCompras(lista))}`;
