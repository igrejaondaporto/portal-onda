/**
 * A agenda do painel (aba Domingo, em cima) — duas camadas:
 *
 *  - Eventos da IGREJA: os mesmos `eventos/{data}` que as dez bases
 *    leem. Criar/editar/apagar passa por `guardarEventoIgreja`/
 *    `apagarEventoIgreja` (functions/pastoral.js) — eventos é
 *    write:false nas regras.
 *  - Eventos PRIVADOS: `bases/pastoral/agenda/{id}`, escrita direta.
 *    Só quem está em `participantes` os lê (firestore.rules) — por
 *    isso a query TEM de ser `array-contains uid`: as regras não
 *    filtram, recusam a query inteira.
 */
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";

const cAgenda = () => collection(db, "bases/pastoral/agenda");

/** Todos os privados em que esta pessoa participa. Sem filtro por data
 *  nem por `ativo` na query: juntar qualquer um dos dois a um
 *  array-contains pedia um índice composto, e são poucos documentos. */
export function ouvirAgendaPrivada(uid, cb) {
  const q = query(cAgenda(), where("participantes", "array-contains", uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.ativo !== false)));
}

const limpar = (d) => ({
  titulo: d.titulo.trim(),
  data: d.data,
  hora: d.hora || null,
  horaFim: d.horaFim || null,
  local: d.local?.trim() || null,
  nota: d.nota?.trim() || null,
  participantes: d.participantes,
});

/** `semanas` > 1 cria o mesmo evento em N semanas seguidas, numa
 *  escrita só (ou todos, ou nenhum). */
export async function criarPrivado(uid, dados, semanas = 1) {
  const lote = writeBatch(db);
  for (const data of datasRepetidas(dados.data, semanas)) {
    lote.set(doc(cAgenda()), { ...limpar({ ...dados, data }), criadoPor: uid, ativo: true, criadoEm: serverTimestamp() });
  }
  await lote.commit();
}

export const editarPrivado = (id, dados) =>
  updateDoc(doc(cAgenda(), id), { ...limpar(dados), atualizadoEm: serverTimestamp() });

/** Nunca um delete (regra 5) — as regras nem o deixam. */
export const desativarPrivado = (id) => updateDoc(doc(cAgenda(), id), { ativo: false, atualizadoEm: serverTimestamp() });

/** A equipa pastoral, para escolher quem participa num privado. */
export function ouvirEquipa(cb) {
  const q = query(collection(db, "bases/pastoral/pessoas"), where("ativo", "==", true), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, nome: d.data().nome ?? d.id }))));
}

/** As bases que podem servir num evento — o mesmo filtro que
 *  `basesQueServem` faz no servidor (sem a Pastoral, sem inativas,
 *  sem as que não têm escala de culto, como o Financeiro). */
export function ouvirBasesQueServem(cb) {
  return onSnapshot(collection(db, "bases"), (snap) => {
    cb(snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((b) => b.ativa !== false && b.visaoPastoral !== true && b.semEscalaDeCulto !== true)
      .map((b) => ({ id: b.id, nome: b.nome ?? b.id, cor: b.cor ?? "#6a7192" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
  });
}

/** As bases que já escalaram alguém para este evento — para avisar
 *  antes de apagar (apagar leva as escalas de todas). A Pastoral lê
 *  qualquer escala pela capacidade `ve_todas_escalas`. */
export async function basesComEscala(eventoId) {
  const snap = await getDocs(collection(db, `eventos/${eventoId}/escalas`));
  return snap.docs
    .filter((d) => {
      const e = d.data();
      return (e.pessoas?.length ?? 0) > 0 || (e.lugares ?? []).some((l) => l.titularId);
    })
    .map((d) => d.id);
}

/** A data e as N-1 semanas seguintes, no mesmo dia da semana. */
export function datasRepetidas(data, semanas = 1) {
  return Array.from({ length: Math.max(1, semanas) }, (_, k) => {
    const d = new Date(`${data}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * k);
    return d.toISOString().slice(0, 10);
  });
}

/** Que eventos já estão nestas datas À MESMA HORA — bloqueia sempre
 *  (pedido 2026-09). Olha para os da igreja (uma query ao intervalo) e
 *  para os privados que esta pessoa vê. Os da igreja também são
 *  bloqueados no servidor (guardarEventoIgreja); os privados só aqui,
 *  porque o servidor não vê a agenda de ninguém. `ignorar` é o id do
 *  próprio evento, ao editar. */
export async function conflitosDeHora({ datas, hora, privados, ignorar }) {
  if (!hora || !datas.length) return [];
  const q = query(collection(db, "eventos"), where("data", ">=", datas[0]), where("data", "<=", datas.at(-1)), orderBy("data"));
  const alvo = new Set(datas);
  const daIgreja = (await getDocs(q)).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.ativo !== false && e.id !== ignorar && alvo.has(e.data) && e.horaCulto === hora)
    .map((e) => ({ data: e.data, nome: e.tipo || "Culto de domingo" }));
  const meus = privados
    .filter((p) => p.id !== ignorar && alvo.has(p.data) && p.hora === hora)
    .map((p) => ({ data: p.data, nome: p.titulo }));
  return [...daIgreja, ...meus].sort((a, b) => a.data.localeCompare(b.data));
}
