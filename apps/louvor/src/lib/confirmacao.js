/**
 * Confirmação de presença no ENSAIO — "vais ao ensaio?" (ver
 * confirmarPresencaEnsaioLouvor em functions/index.js).
 *
 * A confirmação de ESCALA ("vais servir?", `confirmacoes/{pessoa}`,
 * confirmarPresencaLouvor) saiu da app em 2026-09 — pedido do líder:
 * "não é necessário, deixa só um lembrete do ensaio da semana e se a
 * pessoa vai participar" (ver LembreteEnsaio.jsx e o CLAUDE.md desta
 * base). As respostas antigas ficam gravadas (regra 5: nada se
 * apaga) e a Cloud Function continua a existir — só deixou de haver
 * quem a chame daqui.
 */
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";

const refConfirmacaoEnsaio = (eventoId, pessoaId) =>
  doc(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoesEnsaio/${pessoaId}`);
const cConfirmacoesEnsaio = (eventoId) =>
  collection(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoesEnsaio`);

/** As MINHAS respostas ao ensaio, por culto — `Map<eventoId,
 *  {resposta, justificativa}>`, ao vivo. Só cultos com `dataEnsaio`
 *  marcada em que a pessoa serve — o ensaio pode ser marcado antes ou
 *  depois de a escala do culto em si estar pública. */
export function ouvirConfirmacoesEnsaioDoMes(eventos, pessoaId, cb) {
  const alvos = (eventos || []).filter(
    (ev) => ev.escala?.dataEnsaio && (ev.escala.pessoas || []).includes(pessoaId)
  );
  if (!alvos.length) { cb(new Map()); return () => {}; }

  const respostas = new Map();
  const paragens = alvos.map((ev) =>
    onSnapshot(refConfirmacaoEnsaio(ev.id, pessoaId), (s) => {
      if (s.exists()) respostas.set(ev.id, s.data());
      else respostas.delete(ev.id);
      cb(new Map(respostas));
    })
  );
  return () => paragens.forEach((p) => p());
}

export const confirmarPresencaEnsaio = (eventoId, pessoaId, resposta, justificativa = "") =>
  chamar("confirmarPresencaEnsaioLouvor")({ eventoId, pessoaId, resposta, justificativa }).then((r) => r.data);

/** Quem já
 *  confirmou "vai" ao ensaio, por culto. Devolve `Map<eventoId,
 *  Set<pessoaId>>`; o líder usa o Set para mostrar as mini-fotos de
 *  quem já confirmou dentro do próprio cartão de "Ensaio" em
 *  Escala.jsx (pedido do líder — "não uma lista grande", só as
 *  fotinhas ao lado do título). Só cultos com `dataEnsaio` marcada
 *  entram — sem ensaio marcado ainda, não há nada para confirmar. */
export function ouvirConfirmacoesEnsaioPorCulto(eventos, cb) {
  const alvos = (eventos || []).filter((ev) => ev.escala?.dataEnsaio);
  if (!alvos.length) { cb(new Map()); return () => {}; }

  const porCulto = new Map();
  const paragens = alvos.map((ev) =>
    onSnapshot(cConfirmacoesEnsaio(ev.id), (snap) => {
      const confirmados = new Set(snap.docs.filter((d) => d.data().resposta === "vai").map((d) => d.id));
      porCulto.set(ev.id, confirmados);
      cb(new Map(porCulto));
    })
  );
  return () => paragens.forEach((p) => p());
}
