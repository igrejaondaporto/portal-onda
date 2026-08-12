/**
 * Enquetes de indisponibilidade: "Tens alguma indisponibilidade este
 * mês?" — um documento por mês (AAAA-MM), aberto/fechado só pelo
 * líder. Voto privado: cada voluntário só lê a própria resposta
 * (ver firestore.rules); o líder vê o conjunto em ouvirRespostas.
 */
import { doc, getDoc, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cEnquetes, cRespostasEnquete } from "./modelo";

/** A enquete aberta agora, se houver — normalmente só uma de cada vez. */
export function ouvirEnqueteAberta(cb) {
  const q = query(cEnquetes(), where("estado", "==", "aberta"), orderBy("abertaEm", "desc"), limit(1));
  return onSnapshot(q, (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
}

export function ouvirEnquete(mes, cb) {
  return onSnapshot(doc(db, `bases/${BASE_ID}/enquetes/${mes}`), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
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

export const abrirEnquete = (dados) => chamar("abrirEnquete")(dados).then((r) => r.data);
export const fecharEnquete = (mes) => chamar("fecharEnquete")({ mes }).then((r) => r.data);
export const responderEnquete = (dados) => chamar("responderEnquete")(dados).then((r) => r.data);

/** Texto pronto para o wa.me — o líder cola o link e o WhatsApp abre
 *  já com a mensagem escrita, só falta escolher o grupo. */
export function textoWhatsApp(mes, prazo) {
  const [ano, m] = mes.split("-");
  const nomeMes = new Date(Number(ano), Number(m) - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
  const prazoTexto = prazo ? new Date(prazo).toLocaleDateString("pt-PT", { day: "numeric", month: "long" }) : "";
  return `Pessoal, já está aberta a enquete de indisponibilidades de ${nomeMes}! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal. Prazo: até ${prazoTexto}.\n\ntecnica.painelonda.pt 🙏`;
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
