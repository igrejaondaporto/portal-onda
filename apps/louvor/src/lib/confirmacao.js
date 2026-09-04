/**
 * Confirmação de presença — só depois de a escala estar `publicado`
 * (ver lib/rascunho.js) é que faz sentido pedir. Primeira base a sair
 * do "sem confirmação de presença" (ver CLAUDE.md desta base).
 * `resposta: "vai" | "nao_vai"` — quem não pode já deixa a
 * justificativa no mesmo gesto, não é só um confirmar/desfazer.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";

const refConfirmacao = (eventoId, pessoaId) =>
  doc(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoes/${pessoaId}`);

/** null enquanto não respondeu; senão {resposta, justificativa, ...}. */
export function ouvirConfirmacao(eventoId, pessoaId, cb) {
  if (!eventoId || !pessoaId) return () => {};
  return onSnapshot(refConfirmacao(eventoId, pessoaId), (s) => cb(s.exists() ? s.data() : null));
}

/** Um listener por culto onde a pessoa está escalada E publicado —
 *  devolve o conjunto de eventoIds já RESPONDIDOS (vai ou não vai),
 *  ao vivo. Usado pelo Calendário (o 4º estado, vermelho: escalado +
 *  publicado + por responder) e pelo popup automático, para saber
 *  quais cultos ainda faltam. `eventos` já vem de ouvirEventosDoMes/
 *  obterEventosDoMes (cada um já com `.escala.pessoas`/`.publicado`). */
export function ouvirConfirmacoesDoMes(eventos, pessoaId, cb) {
  const alvos = (eventos || []).filter(
    (ev) => ev.escala?.publicado && (ev.escala.pessoas || []).includes(pessoaId)
  );
  if (!alvos.length) { cb(new Map()); return () => {}; }

  const respostas = new Map();
  const paragens = alvos.map((ev) =>
    onSnapshot(refConfirmacao(ev.id, pessoaId), (s) => {
      if (s.exists()) respostas.set(ev.id, s.data());
      else respostas.delete(ev.id);
      cb(new Map(respostas));
    })
  );
  return () => paragens.forEach((p) => p());
}

export const confirmarPresenca = (eventoId, pessoaId, resposta, justificativa = "") =>
  chamar("confirmarPresencaLouvor")({ eventoId, pessoaId, resposta, justificativa }).then((r) => r.data);
