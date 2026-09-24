/**
 * Enquetes de indisponibilidade: "Tens alguma indisponibilidade este
 * mês?" — um documento por mês (AAAA-MM), aberto/fechado só pelo
 * líder. Voto privado: cada voluntário só lê a própria resposta
 * (ver firestore.rules); o líder vê o conjunto em ouvirRespostas.
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

/** Tudo que ainda "pertence" ao Montar: as abertas e as fechadas cuja
 *  escala ainda não foi publicada — a enquete só sai da tela depois
 *  de virar escala a valer (ver marcarEscalaPublicada). Sem where de
 *  estado/escalaPublicada aqui de propósito, porque combinado com
 *  `ativo` pediria outro índice — filtra-se no cliente, e são poucos
 *  documentos por base. */
export function ouvirEnquetesMontar(cb) {
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
 *  algo pra olhar em baixo do Montar, mesmo depois de a escala já
 *  ter sido publicada (ao contrário de ouvirEnquetesMontar, que some
 *  assim que a escala sai). */
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
export async function obterEventosPorIds(ids) {
  const pares = await Promise.all(ids.map(async (id) => {
    const s = await getDoc(doc(db, `eventos/${id}`));
    return [id, s.exists() ? { id, ...s.data() } : { id, data: id }];
  }));
  return Object.fromEntries(pares);
}

/** O mês certo pra abrir a Escala sugerida por defeito: o da enquete
 *  que está em curso ou mais próxima do presente — nunca uma antiga
 *  já usada. Se houver mais do que um mês de enquete daqui pra
 *  frente, fica o que vem primeiro (o id "AAAA-MM" ordena certinho). */
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

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
