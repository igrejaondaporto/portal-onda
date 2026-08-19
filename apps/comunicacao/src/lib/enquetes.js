/**
 * Enquetes de indisponibilidade: "Tens alguma indisponibilidade este
 * mês?" — um documento por mês (AAAA-MM), aberto/fechado só pelo
 * líder. Voto privado: cada voluntário só lê a própria resposta
 * (ver firestore.rules); o líder vê o conjunto em ouvirRespostas.
 *
 * Sempre por Cloud Function (abrirEnquete/fecharEnquete/...) — já
 * genéricas por baseId em functions/index.js, nada foi mudado lá para
 * a Comunicação usar. É o que alimenta a Escala sugerida (ver
 * lib/sugestor.js): sem isto, "sugestão automática" não sabe quem
 * está de fora naquele domingo.
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

/** Tudo que ainda "pertence" ao Painel: as abertas e as fechadas cuja
 *  escala ainda não foi publicada. */
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

export function ouvirUltimasEnquetes(quantas, cb) {
  const q = query(cEnquetes(), where("ativo", "==", true), orderBy(documentId(), "desc"), limit(quantas));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

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

/** Respostas de um mês, uma vez só (não ao vivo) — usado pelo
 *  sugestor, que só precisa do retrato do momento em que se clica
 *  "Sugestão automática", não de manter isso sincronizado. */
export async function obterRespostas(mes) {
  const snap = await getDocs(query(cRespostasEnquete(mes), orderBy("respondidoEm")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
 *  já usada. */
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

const nomeDoMes = (mes) => {
  const [ano, m] = mes.split("-");
  return new Date(Number(ano), Number(m) - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
};
const dataPorExtensoTexto = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long" }) : "";

/** Texto pronto para o wa.me — o líder cola o link e o WhatsApp abre
 *  já com a mensagem escrita, só falta escolher o grupo. */
export function textoWhatsApp(enquetes) {
  const lista = Array.isArray(enquetes) ? enquetes : [enquetes];
  if (lista.length === 1) {
    const { mes, prazo } = lista[0];
    return `Pessoal, já está aberta a enquete de indisponibilidades de ${nomeDoMes(mes)}! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal. Prazo: até ${dataPorExtensoTexto(prazo)}.\n\ncomunicacao.igrejaonda.pt 🙏`;
  }
  const nomes = lista.map((e) => nomeDoMes(e.mes)).join(" e ");
  const prazos = lista.map((e) => `${nomeDoMes(e.mes)}: até ${dataPorExtensoTexto(e.prazo)}`).join("\n");
  return `Pessoal, já estão abertas as enquetes de indisponibilidade de ${nomes}! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal — vai pedir os dois meses seguidos.\n\nPrazos:\n${prazos}\n\ncomunicacao.igrejaonda.pt 🙏`;
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
