/**
 * Confirmação de presença — só depois de a escala estar `publicado`
 * (ver lib/rascunho.js) é que faz sentido pedir. Primeira base a sair
 * do "sem confirmação de presença" (ver CLAUDE.md desta base).
 * `resposta: "vai" | "nao_vai"` — quem não pode já deixa a
 * justificativa no mesmo gesto, não é só um confirmar/desfazer.
 */
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";

const refConfirmacao = (eventoId, pessoaId) =>
  doc(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoes/${pessoaId}`);
const cConfirmacoes = (eventoId) =>
  collection(db, `eventos/${eventoId}/escalas/${BASE_ID}/confirmacoes`);

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

/** Contagem de "vai" por culto, para o líder (Escala geral, ver
 *  Escala.jsx) — ao contrário de ouvirConfirmacoesDoMes (uma pessoa,
 *  vários cultos), aqui é o inverso: todas as pessoas de um culto só.
 *  Um listener por culto publicado (a regra só deixa o líder ler
 *  confirmações de outra pessoa, ver CLAUDE.md desta base — para um
 *  voluntário comum a subcoleção vem vazia, sem erro). Cultos sem
 *  escala publicada nem entram — sem confirmação pedida ainda, "0
 *  confirmados" seria enganoso. */
export function ouvirContagemConfirmados(eventos, cb) {
  const alvos = (eventos || []).filter((ev) => ev.escala?.publicado);
  if (!alvos.length) { cb(new Map()); return () => {}; }

  const contagens = new Map();
  const paragens = alvos.map((ev) =>
    onSnapshot(cConfirmacoes(ev.id), (snap) => {
      const vao = snap.docs.filter((d) => d.data().resposta === "vai").length;
      contagens.set(ev.id, vao);
      cb(new Map(contagens));
    })
  );
  return () => paragens.forEach((p) => p());
}

export const confirmarPresenca = (eventoId, pessoaId, resposta, justificativa = "") =>
  chamar("confirmarPresencaLouvor")({ eventoId, pessoaId, resposta, justificativa }).then((r) => r.data);

/** "Ainda não sei" no popup automático (ConfirmacaoAutoStart) — mesmo
 *  esquema de dispensarEnquete/enqueteDispensada em lib/enquetes.js:
 *  fecha o popup sem gravar resposta nenhuma (não é voto, é só "agora
 *  não"), guardado no localStorage — sobrevive a recarregar a página,
 *  a pessoa continua a ver o balão fixo no Início até responder a
 *  valer. */
const chaveDispensada = (eventoId) => `louvor-confirmacao-dispensada-${eventoId}`;
export function confirmacaoDispensada(eventoId) {
  try { return localStorage.getItem(chaveDispensada(eventoId)) === "1"; }
  catch { return false; }
}
export function dispensarConfirmacao(eventoId) {
  try { localStorage.setItem(chaveDispensada(eventoId), "1"); } catch { /* privado/bloqueado — tudo bem, só perde o "lembrete" */ }
}
