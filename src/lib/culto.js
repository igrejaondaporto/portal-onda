/**
 * Checklist e atribuições de um culto, e a frase do líder de escala.
 *
 * Checklist escreve-se direto no Firestore — as regras já só deixam
 * quem está na escala desse culto fazê-lo. Atribuições passam pela
 * Cloud Function atribuirFuncao: é lá que se confirma que quem manda
 * é o líder de escala DESTE culto (ou o líder da base). A frase mexe
 * no documento do evento, que é global e write:false — por isso passa
 * pela Cloud Function definirFrase.
 */
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db, chamar } from "./firebase";
import { obterEventosDoMes } from "./painel";

export function ouvirChecklist(eventoId, cb) {
  return onSnapshot(collection(db, `eventos/${eventoId}/checklist`), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data(); });
    cb(mapa);
  });
}

export function ouvirAtribuicoes(eventoId, cb) {
  return onSnapshot(collection(db, `eventos/${eventoId}/atribuicoes`), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data().pessoas || []; });
    cb(mapa);
  });
}

const horaAgora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const marcarFeito = (eventoId, funcaoId, uid) =>
  setDoc(doc(db, `eventos/${eventoId}/checklist/${funcaoId}`), { por: uid, hora: horaAgora() });

export const desmarcarFeito = (eventoId, funcaoId) =>
  deleteDoc(doc(db, `eventos/${eventoId}/checklist/${funcaoId}`));

export const definirFrase = (eventoId, frase) =>
  chamar("definirFrase")({ eventoId, frase }).then((r) => r.data);

export const atribuirFuncao = (eventoId, funcaoId, pessoas) =>
  chamar("atribuirFuncao")({ eventoId, funcaoId, pessoas }).then((r) => r.data);

/** O culto em que a pessoa serve a seguir — este mês ou o próximo.
 *  Sem isso, cai no primeiro culto do mês (mesma rede de segurança do protótipo). */
export async function obterMeuEvento(uid) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [esteMes, proxMes] = await Promise.all([
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()),
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()),
  ]);
  const candidatos = [...esteMes, ...proxMes].sort((a, b) => a.data.localeCompare(b.data));

  const meu = candidatos.find((ev) => ev.data >= hojeISO && ev.escala.pessoas.includes(uid));
  return meu ?? candidatos.find((ev) => ev.escala.pessoas.includes(uid)) ?? esteMes[0] ?? null;
}
