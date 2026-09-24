/**
 * Quantas crianças/adolescentes estão presentes — pedido 2026-09
 * ("quero o mesmo no painel do SHIFT e do New"), mesmo mecanismo da
 * Kinder (ver `apps/kinder/src/lib/contagemCriancas.js`): escreve em
 * `eventos/{e}/contagem/geral` (a Contagem da Base Pessoal) pela
 * Cloud Function `registarContagemSala` — nunca escrita direta, esta
 * base só pode tocar na sua própria categoria ("shift") dentro do
 * mapa `categorias`.
 *
 * A LEITURA não passa por função nenhuma — `eventos/{e}/contagem/
 * geral` já é `allow read: if autenticado()`.
 */
import { onSnapshot } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { cContagemPessoal } from "./modelo";

export const ouvirContagemPessoal = (eventoId, cb) => {
  if (!eventoId) return () => {};
  return onSnapshot(cContagemPessoal(eventoId), (s) => cb(s.exists() ? s.data() : null));
};

export const registarContagemSala = (eventoId, categoria, valor) =>
  chamar("registarContagemSala")({ eventoId, categoria, valor }).then((r) => r.data);

/** O domingo cuja contagem se pergunta: o mais recente até hoje (hoje,
 *  se for domingo). O id do culto de domingo é a própria data
 *  (`gerarDomingos`) — o primeiro evento de cada dia fica sempre com
 *  id = data, por isso não é preciso procurar nos eventos do mês (que
 *  na segunda-feira dia 1 já nem teriam o domingo anterior). */
export function domingoDaContagem(agora = new Date()) {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - agora.getDay());
  const eventoId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { eventoId, hoje: agora.getDay() === 0 };
}
