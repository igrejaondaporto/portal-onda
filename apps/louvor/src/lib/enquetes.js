/**
 * Enquetes de indisponibilidade: "Tens alguma indisponibilidade este
 * mês?" — um documento por mês (AAAA-MM), aberto/fechado só pelo
 * líder/auxiliar. Voto privado: cada voluntário só lê a própria
 * resposta (ver firestore.rules); o líder vê o conjunto em
 * ouvirRespostas. Backend (abrirEnquete/fecharEnquete/...) já é
 * genérico por baseId — nada de novo em functions/index.js, ver
 * CLAUDE.md raiz. Copiado do mesmo padrão da Backstage.
 */
import { doc, documentId, getDoc, getDocs, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cEnquetes, cRespostasEnquete } from "./modelo";

const pad2 = (n) => String(n).padStart(2, "0");

/** As enquetes abertas agora — normalmente uma, mas o líder pode abrir
 *  duas de uma vez (ver SheetAbrirEnquete, "também o mês seguinte").
 *  Vem sempre ordenada por mês (a mais próxima primeiro). */
export function ouvirEnquetesAbertas(cb) {
  const q = query(cEnquetes(), where("ativo", "==", true), where("estado", "==", "aberta"), orderBy("abertaEm", "desc"));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));
    cb(lista);
  });
}

/** Tudo que ainda "pertence" à gestão de enquetes no Painel do líder:
 *  as abertas e as fechadas cuja escala ainda não foi publicada — a
 *  enquete só sai da lista depois de virar escala a valer (ver
 *  marcarEscalaPublicada). Sem where de estado/escalaPublicada aqui
 *  de propósito, porque combinado com `ativo` pediria outro índice —
 *  filtra-se no cliente, e são poucos documentos por base. */
export function ouvirEnquetesGestao(cb) {
  const q = query(cEnquetes(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => e.estado === "aberta" || !e.escalaPublicada)
      .sort((a, b) => a.id.localeCompare(b.id));
    cb(lista);
  });
}

/** As últimas enquetes, sejam quais forem os estados — fica sempre
 *  algo pra olhar na gestão, mesmo depois de a escala já ter sido
 *  publicada (ao contrário de ouvirEnquetesGestao, que some assim que
 *  a escala sai). */
export function ouvirUltimasEnquetes(quantas, cb) {
  const q = query(cEnquetes(), where("ativo", "==", true), orderBy(documentId(), "desc"), limit(quantas));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Uma enquete excluída conta como se não existisse — nunca é
 *  apagada a valer (ver CLAUDE.md), só fica ativo:false. Docs
 *  antigos sem o campo `ativo` continuam a contar como ativos. */
export function ouvirEnquete(mes, cb) {
  return onSnapshot(doc(db, `bases/${BASE_ID}/enquetes/${mes}`), (s) => {
    cb(s.exists() && s.data().ativo !== false ? { id: s.id, ...s.data() } : null);
  });
}

/** Só o líder consegue mesmo ler todas — as regras limitam cada
 *  voluntário à própria resposta. */
export function ouvirRespostas(mes, cb) {
  const q = query(cRespostasEnquete(mes), orderBy("respondidoEm"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirMinhaResposta(mes, uid, cb) {
  return onSnapshot(doc(db, `bases/${BASE_ID}/enquetes/${mes}/respostas/${uid}`), (s) => cb(s.exists() ? s.data() : null));
}

/** enquete.domingos são só ids de eventos/{id} — os cultos são
 *  globais, não moram na base, por isso é preciso buscá-los à parte. */
/** Junta o evento global (data/tipo) com dataEnsaio/horaEnsaio/
 *  localEnsaio, que o líder já define em Escala.jsx/DetalhesCulto
 *  (definirDetalhesCultoLouvor) e vivem em `eventos/{id}/escalas/
 *  louvor`, não no documento global — é o que SheetResponderEnquete
 *  usa para saber se mostra a pergunta do ensaio (pedido do líder,
 *  2026-09: votar indisponibilidade de culto já existia, faltava o
 *  ensaio da mesma semana). */
export async function obterEventosPorIds(ids) {
  const pares = await Promise.all(ids.map(async (id) => {
    const s = await getDoc(doc(db, `eventos/${id}`));
    return [id, s.exists() ? { id, ...s.data() } : { id, data: id }];
  }));
  return Object.fromEntries(pares);
}

/** O mês certo pra sugerir por defeito ao abrir a folha de resposta:
 *  o da enquete que está em curso ou mais próxima do presente — nunca
 *  uma antiga já usada. */
export async function obterMesEnqueteRelevante() {
  const hoje = new Date();
  const piso = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}`;
  const q = query(cEnquetes(), where("ativo", "==", true), where(documentId(), ">=", piso), orderBy(documentId()), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}

export const abrirEnquete = (dados) => chamar("abrirEnquete")(dados).then((r) => r.data);
export const fecharEnquete = (mes) => chamar("fecharEnquete")({ mes }).then((r) => r.data);
export const reabrirEnquete = (mes) => chamar("reabrirEnquete")({ mes }).then((r) => r.data);
export const excluirEnquete = (mes) => chamar("excluirEnquete")({ mes }).then((r) => r.data);
export const marcarEscalaPublicada = (mes) => chamar("marcarEscalaPublicada")({ mes }).then((r) => r.data);
export const responderEnquete = (dados) => chamar("responderEnquete")(dados).then((r) => r.data);

/** "3 dias restantes"/"último dia" até ao fim do dia do prazo —
 *  mesmo relógio mostrado no popup obrigatório e no balão fixo do
 *  Início (pedido do líder). `new Date(ano,mes,dia,23,59,59)` local,
 *  nunca `new Date(iso)` direto (regra do CLAUDE.md raiz). */
export function tempoRestanteVoto(prazoISO) {
  if (!prazoISO) return null;
  const [a, m, d] = prazoISO.split("-").map(Number);
  const fim = new Date(a, m - 1, d, 23, 59, 59);
  const ms = fim.getTime() - Date.now();
  if (ms <= 0) return null;
  const dias = Math.ceil(ms / 86400000);
  return dias <= 1 ? "último dia para votar" : `${dias} dias para votar`;
}

/** 0–100, quanto JÁ PASSOU do prazo de voto — mesma base de
 *  tempoRestanteVoto, em percentagem, mas ENCHENDO conforme o prazo
 *  se aproxima (0 = enquete acabada de abrir, 100 = último instante)
 *  — para a barrinha de progresso no Início (pedido do líder: a
 *  primeira versão, "tempo que falta", lia-se ao contrário — uma
 *  enquete com semanas pela frente parecia mais urgente que uma a
 *  horas do fim). Precisa de abertaEm (quando a enquete foi aberta)
 *  para saber o intervalo TOTAL, não só o que falta. */
export function percentagemDecorridaVoto(abertaEm, prazoISO) {
  if (!abertaEm?.toMillis || !prazoISO) return null;
  const [a, m, d] = prazoISO.split("-").map(Number);
  const fimMs = new Date(a, m - 1, d, 23, 59, 59).getTime();
  const inicioMs = abertaEm.toMillis();
  const totalMs = fimMs - inicioMs;
  if (totalMs <= 0) return 100;
  const restanteMs = fimMs - Date.now();
  if (restanteMs <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(100 - (restanteMs / totalMs) * 100)));
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** "Não sei ainda" no popup obrigatório — dispensa sem contar como
 *  resposta (a pessoa continua a ver o balão fixo no Início até ao
 *  prazo, ver Inicio.jsx). Guardado no localStorage, por dispositivo:
 *  não é um voto, não teria sentido sincronizar entre aparelhos, e
 *  fica a sobreviver a recarregar a página — o que um `useState`
 *  local em EnqueteAutoStart não fazia. */
const chaveDispensada = (enqueteId) => `louvor-enquete-dispensada-${enqueteId}`;
export function enqueteDispensada(enqueteId) {
  try { return localStorage.getItem(chaveDispensada(enqueteId)) === "1"; }
  catch { return false; }
}
export function dispensarEnquete(enqueteId) {
  try { localStorage.setItem(chaveDispensada(enqueteId), "1"); } catch { /* privado/bloqueado — tudo bem, só perde o "lembrete" */ }
}
