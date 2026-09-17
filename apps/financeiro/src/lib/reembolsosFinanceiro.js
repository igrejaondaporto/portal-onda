/**
 * Reembolsos de TODAS as bases, para quem tem a claim
 * ve_todos_reembolsos (bases/financeiro.veReembolsos === "todas" — ver
 * claimsExtraDaBase em functions/index.js). É uma collectionGroup, não
 * `cReembolsos()` de uma base: lê `bases/*\/reembolsos` de uma vez,
 * ao vivo, autorizado pelo bloco `match /{path=**}/reembolsos/{r}` em
 * firestore.rules — pensado exatamente para isto.
 *
 * Pagar e devolver NÃO são escrita direta — são Cloud Function
 * (marcarReembolsosPagos/devolverReembolso), porque mexem em dinheiro
 * e cruzam bases (ver CLAUDE.md raiz, regra 3).
 */
import { collectionGroup, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

export function ouvirReembolsosPorEstado(estado, cb) {
  const q = query(collectionGroup(db, "reembolsos"), where("estado", "==", estado), orderBy("criadoEm", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, baseId: d.data().baseId, ...d.data() }))));
}

export function ouvirReembolsosPagos(cb) {
  const q = query(collectionGroup(db, "reembolsos"), where("estado", "==", "pago"), orderBy("pagoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, baseId: d.data().baseId, ...d.data() }))));
}

/** Sobe o comprovativo para a mesma pasta da fatura original — a
 *  regra de Storage já deixa o Financeiro escrever ali (vejoTodosReembolsos),
 *  distinguido pelo sufixo, nunca pela pasta. Usa o primeiro pedido do
 *  lote como âncora do nome; o mesmo ficheiro cobre todos (uma
 *  transferência, um extrato). Opcional — nunca bloqueia o pagamento. */
export async function subirComprovativoPagamento(pedidoAncora, ficheiro) {
  const paraEnviar = ficheiro.type.startsWith("image/")
    ? await comprimirImagem(ficheiro, { maxDimensao: 2000, qualidade: 0.9 })
    : ficheiro;
  const destino = refStorage(storage, `bases/${pedidoAncora.baseId}/reembolsos/${pedidoAncora.id}-comprovativo`);
  await uploadBytes(destino, paraEnviar, { contentType: paraEnviar.type });
  return getDownloadURL(destino);
}

export const marcarReembolsosPagos = (pedidos, metodo, referencia, comprovativo) =>
  chamar("marcarReembolsosPagos")({ pedidos: pedidos.map((p) => ({ baseId: p.baseId, id: p.id })), metodo, referencia, comprovativo: comprovativo ?? null });

export const devolverReembolso = (baseId, id, motivo) =>
  chamar("devolverReembolso")({ baseId, id, motivo });

/** Confere a fatura EM PAPEL, pedido a pedido — o líder pode ter
 *  entregue quatro de cinco. Também por função: daqui só se lê
 *  bases/{b}/reembolsos (ver o comentário no topo). */
export const marcarFaturaFisica = (baseId, id, recebida) =>
  chamar("marcarFaturaFisica")({ baseId, id, recebida });

/** Um pedido só está "em papel" fechado quando o Financeiro confirmou.
 *  O que o líder declarou (`paraFinanceiro`) é intenção, não prova. */
export const faturaPorReceber = (r) => !r.fatura?.recebida;

export const ROTULO_FATURA = {
  entregue: "O líder diz que já entregou",
  proximo_culto: "O líder traz no próximo culto",
};

/** Mesma formatação de apps/*\/src/lib/reembolsos.js (mostrarDestino)
 *  — sem partilhar módulo porque essa lib vive dentro de cada base,
 *  não em packages/shared; é só apresentação, sem risco de divergir. */
export const mostrarDestino = (metodo, destino) =>
  metodo === "mbway"
    ? String(destino).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : String(destino).replace(/(.{4})/g, "$1 ").trim();

export const ROTULO_METODO = { mbway: "MB Way", transferencia: "Transferência" };

