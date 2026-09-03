/**
 * Confirmação de presença — só depois de a escala estar `publicado`
 * (ver lib/rascunho.js) é que faz sentido pedir. Primeira base a sair
 * do "sem confirmação de presença" (ver CLAUDE.md desta base).
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";

const refConfirmacao = (eventoId, pessoaId) =>
  doc(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoes/${pessoaId}`);

export function ouvirConfirmacao(eventoId, pessoaId, cb) {
  if (!eventoId || !pessoaId) return () => {};
  return onSnapshot(refConfirmacao(eventoId, pessoaId), (s) => cb(s.exists()));
}

/** Um listener por culto onde a pessoa está escalada E publicado —
 *  devolve o conjunto de eventoIds já confirmados, ao vivo. Usado
 *  pelo Calendário (o 4º estado, vermelho: escalado + publicado +
 *  por confirmar). `eventos` já vem de ouvirEventosDoMes/
 *  obterEventosDoMes (cada um já com `.escala.pessoas`/`.publicado`). */
export function ouvirConfirmacoesDoMes(eventos, pessoaId, cb) {
  const alvos = (eventos || []).filter(
    (ev) => ev.escala?.publicado && (ev.escala.pessoas || []).includes(pessoaId)
  );
  if (!alvos.length) { cb(new Set()); return () => {}; }

  const confirmados = new Set();
  const paragens = alvos.map((ev) =>
    onSnapshot(refConfirmacao(ev.id, pessoaId), (s) => {
      if (s.exists()) confirmados.add(ev.id);
      else confirmados.delete(ev.id);
      cb(new Set(confirmados));
    })
  );
  return () => paragens.forEach((p) => p());
}

export const confirmarPresenca = (eventoId, pessoaId = null) =>
  chamar("confirmarPresencaLouvor")({ eventoId, pessoaId, confirmado: true }).then((r) => r.data);
export const desfazerConfirmacao = (eventoId, pessoaId = null) =>
  chamar("confirmarPresencaLouvor")({ eventoId, pessoaId, confirmado: false }).then((r) => r.data);
