/**
 * Quantas crianças estão presentes, por sala — pedido 2026-09: "logo
 * NA TELA inicial do domingo já apareça um POP UP GRANDE perguntando
 * quantas crianças estão presentes... e essa contagem já vai direto
 * pra contagem da base pessoal". Escreve em `eventos/{e}/contagem/
 * geral` (a Contagem da Base Pessoal, `apps/pessoal/src/lib/
 * contagem.js`) pela Cloud Function `registarContagemSala` — nunca
 * escrita direta, cada base só pode tocar na sua própria categoria
 * dentro do mapa `categorias` (ver `functions/contagemSalas.js`).
 *
 * A LEITURA não passa por função nenhuma — `eventos/{e}/contagem/
 * geral` já é `allow read: if autenticado()`, o mesmo padrão de
 * sempre ("função para escrever o que exige regra fina, onSnapshot
 * para o resto").
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
