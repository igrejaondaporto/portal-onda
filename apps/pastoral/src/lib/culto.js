/**
 * O domingo, ao vivo.
 *
 * Nada aqui passa por uma Cloud Function do painel: tudo o que este
 * ficheiro lê já era legível por qualquer pessoa autenticada antes
 * deste painel existir (`eventos/**`, `config/cultoAoVivo`) ou está
 * coberto pela capacidade que a Backstage já tinha
 * (`ve_todas_escalas`, para a escala de outra base). Duas exceções que
 * SÃO chamadas de função, e as mesmas que a Backstage usa desde 2026-08:
 * `escalasCrossBase` e `checklistCrossBase`, porque `bases/{b}/funcoes`
 * e `/pessoas` continuam fechados a cada base, de propósito.
 *
 * A divisão é sempre a mesma, e é o que faz o ecrã de domingo valer
 * alguma coisa: o CATÁLOGO (que função existe, quem está ativo) vem
 * de uma função, uma vez; o ESTADO (feito, por quem, a que hora) vem
 * em `onSnapshot`, ao vivo. Chamar a função a cada toque de checkbox
 * das dez bases seria caro e lento — o raciocínio já estava escrito em
 * `checklistCrossBase` e vale igual aqui.
 */
import { collection, documentId, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "@portal/shared/lib/firebase.js";
import {
  cChecklist, cContagem, cCultoAoVivo, cEvento, cEventos, cPonteiroAoVivo,
} from "./modelo";

/* ── cultos ────────────────────────────────────────────────── */

/** Os eventos de uma janela de datas, ao vivo. `eventos/{AAAA-MM-DD}`
 *  tem o id igual à data, mas a query é pelo campo `data` (e não pelo
 *  id) para ficar igual à das outras bases — é a que já tem índice. */
export function ouvirEventos(desde, ate, cb) {
  const q = query(cEventos(), where("data", ">=", desde), where("data", "<=", ate), orderBy("data"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.ativo !== false));
  });
}

export function ouvirEvento(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cEvento(eventoId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

/** O culto de hoje, ou o próximo que vier. Nunca devolve um domingo já
 *  passado quando há um pela frente — o painel abre sempre no domingo
 *  que interessa, sem ninguém ter de escolher. */
export function proximoCulto(eventos, hojeISO) {
  return eventos.find((e) => e.data >= hojeISO) ?? eventos.at(-1) ?? null;
}

/* ── ao vivo ───────────────────────────────────────────────── */

/** `config/cultoAoVivo.eventoIdAtivo` é o ponteiro que diz à sonda do
 *  FreeShow qual culto seguir — e aqui diz ao painel se há culto a
 *  acontecer AGORA, seja qual for a data dele (o botão "Começou o
 *  culto" da Técnica não olha para o calendário, de propósito). */
export function ouvirPonteiroAoVivo(cb) {
  return onSnapshot(cPonteiroAoVivo(), (s) => cb(s.exists() ? s.data().eventoIdAtivo ?? null : null));
}

export function ouvirCultoAoVivo(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cCultoAoVivo(eventoId), (s) => cb(s.exists() ? s.data() : null));
}

/* ── checklist e contagem ──────────────────────────────────── */

export function ouvirChecklist(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cChecklist(eventoId), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data(); });
    cb(mapa);
  });
}

export function ouvirContagem(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cContagem(eventoId), (s) => cb(s.exists() ? s.data() : null));
}

/** A checklist de um culto para VÁRIOS cultos de uma vez — para a
 *  percentagem cumprida entrar nas tendências sem N subscrições
 *  abertas ao mesmo tempo. Leitura pontual: é histórico, não é o
 *  domingo a acontecer. */
export function ouvirChecklistsDeVarios(eventoIds, cb) {
  const paragens = eventoIds.map((id) =>
    onSnapshot(cChecklist(id), (snap) => {
      cb(id, Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])));
    })
  );
  return () => paragens.forEach((p) => p());
}

/* ── as outras bases (capacidade ve_todas_escalas) ─────────── */

export const obterEscalasDeTodasAsBases = (eventoId) =>
  chamar("escalasCrossBase")({ eventoId }).then((r) => r.data.bases);

export const obterCatalogoChecklist = (eventoId) =>
  chamar("checklistCrossBase")({ eventoId }).then((r) => r.data.bases);

/* ── o arquivo do culto (capacidade ve_tudo_pastoral) ──────── */

/** `eventos/{e}/estatisticasCulto/registo` esteve fechado a toda a
 *  gente desde que nasceu, com um comentário nas regras a dizer que
 *  era "para o futuro Painel do Pastor". A leitura em si vem resumida
 *  pela `historicoPastoral` (é lá que o previsto se cruza com o real);
 *  isto aqui é só para o culto que se está a ver agora. */
export function ouvirEstatisticasCulto(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(collection(db, `eventos/${eventoId}/estatisticasCulto`), (snap) => {
    const registo = snap.docs.find((d) => d.id === "registo");
    cb(registo ? registo.data() : null);
  });
}

/* ── recados enviados, ao vivo ─────────────────────────────── */

/** A regra de `recados` deixa o painel ler todos (`vejoTudoPastoral`).
 *  Ao vivo, para o "por ler" descer sozinho quando um líder dispensa —
 *  é a única confirmação que existe de que o recado chegou, já que não
 *  há resposta nem estado. */
export function ouvirRecadosEnviados(cb) {
  const q = query(collection(db, "recados"), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Os cultos de uma janela, pelo id (que é a data) — usado pelo ecrã
 *  de Números para saber que domingos existiram no período sem
 *  depender do índice do campo `data`. */
export function consultaEventosPorId(desde, ate) {
  return query(cEventos(), where(documentId(), ">=", desde), where(documentId(), "<=", ate));
}
