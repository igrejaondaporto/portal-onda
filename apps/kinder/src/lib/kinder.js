/**
 * Famílias, crianças, check-in, checklist de sala, contagem,
 * ocorrências, capacitações e definições — o que é só da Kinder.
 *
 * Famílias/crianças/check-in escrevem-se SEMPRE por Cloud Function
 * (functions/kinder.js): são dados de menores, e os pais escrevem
 * sem conta, pelo link da família. O resto (checklist, contagem,
 * ocorrências, capacitações) é escrita direta — as regras chegam, e
 * assim funciona sem rede ao domingo.
 */
import {
  addDoc, deleteField, getDocs, onSnapshot, orderBy, query, limit,
  serverTimestamp, setDoc, updateDoc, where, doc,
} from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import {
  cFamilias, cCriancas, cCheckins, cCodigos, cChecklistSala, cChecklistKinder,
  cContagemKinder, cOcorrencias, cCapacitacoes, cCapacitacoesPessoa, cDefinicao,
} from "./modelo";

const pad2 = (n) => String(n).padStart(2, "0");

/** "AAAA-MM-DD" de hoje, em hora local (nunca toISOString). */
export function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "HH:MM" de um Timestamp do Firestore (ou de milissegundos). */
export function hora(ts) {
  const ms = typeof ts === "number" ? ts : ts?.toMillis?.();
  if (!ms) return "";
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const dados = (r) => r.data;

/* ── famílias e crianças ──────────────────────────────────── */

export const ouvirFamilias = (cb) =>
  onSnapshot(query(cFamilias(), where("ativo", "==", true)), (s) => cb(lista(s)));
export const ouvirCriancas = (cb) =>
  onSnapshot(query(cCriancas(), where("ativo", "==", true)), (s) => cb(lista(s)));

export const dadosRegisto = () => chamar("dadosRegistoKinder")({}).then(dados);
export const registarFamilia = (d) => chamar("registarFamiliaKinder")(d).then(dados);
export const editarFamilia = (d) => chamar("editarFamiliaKinder")(d).then(dados);
export const dadosFamilia = (token) => chamar("dadosFamiliaKinder")({ token }).then(dados);
export const confirmarFamilia = (familiaId) => chamar("confirmarFamiliaKinder")({ familiaId }).then(dados);
export const novoLinkFamilia = (familiaId) => chamar("novoLinkFamiliaKinder")({ familiaId }).then(dados);
export const desativarFamilia = (familiaId) => chamar("desativarFamiliaKinder")({ familiaId }).then(dados);

export const linkFamilia = (token) => `${window.location.origin}/familia/${token}`;
export const linkRegisto = () => `${window.location.origin}/registo`;

/** O que o QR do link da família leva: o id da família e, se já
 *  entrou hoje, o código de levantamento — lido à porta, na saída,
 *  poupa escrever o código à mão. Nenhum dado pessoal. */
export const conteudoQR = (familiaId, codigo) => `KINDER:${familiaId}${codigo ? `:${codigo}` : ""}`;
export function lerConteudoQR(texto) {
  const m = /^KINDER:([A-Za-z0-9]{10,40})(?::([A-Z2-9]{4}))?$/.exec(String(texto || "").trim());
  return m ? { familiaId: m[1], codigo: m[2] ?? null } : null;
}

/* ── check-in ─────────────────────────────────────────────── */

export const ouvirCheckins = (eventoId, cb) => onSnapshot(cCheckins(eventoId), (s) => cb(lista(s)));
export const ouvirCodigos = (eventoId, cb) =>
  onSnapshot(cCodigos(eventoId), (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data().codigo]))));
export const fazerCheckin = (criancaIds) => chamar("checkinKinder")({ criancaIds }).then(dados);
export const darSaida = (d) => chamar("checkoutKinder")(d).then(dados);
export const anularCheckin = (criancaId) => chamar("anularCheckinKinder")({ criancaId }).then(dados);

/** Histórico de check-ins de vários cultos (relatórios) — leitura
 *  pontual, uma por culto. */
export async function obterCheckinsDe(eventoIds) {
  const pares = await Promise.all(eventoIds.map(async (id) => [id, lista(await getDocs(cCheckins(id)))]));
  return Object.fromEntries(pares);
}

/* ── checklist de sala ────────────────────────────────────── */

export const ouvirItensChecklist = (cb) =>
  onSnapshot(query(cChecklistSala(), where("ativo", "==", true)), (s) =>
    cb(lista(s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))));

export const criarItemChecklist = ({ texto, categoria, fase }) =>
  addDoc(cChecklistSala(), { texto: texto.trim(), categoria, fase, ordem: Date.now(), ativo: true });
export const desativarItemChecklist = (id) =>
  updateDoc(doc(db, `bases/${BASE_ID}/checklistSala/${id}`), { ativo: false });

export const ouvirMarcasChecklist = (eventoId, sala, cb) =>
  onSnapshot(cChecklistKinder(eventoId, sala), (s) => cb(s.exists() ? s.data().itens || {} : {}));

/* sem `await` em quem chama: a marca aparece logo, vinda da cache
 * local, e sincroniza quando a rede voltar (a Casa do Povo nem sempre
 * tem sinal) — mesmo padrão da checklist das outras bases. */
export const marcarItem = (eventoId, sala, itemId, uid) =>
  setDoc(cChecklistKinder(eventoId, sala), { itens: { [itemId]: { por: uid, hora: hora(Date.now()) } } }, { merge: true });
export const desmarcarItem = (eventoId, sala, itemId) =>
  setDoc(cChecklistKinder(eventoId, sala), { itens: { [itemId]: deleteField() } }, { merge: true });

/* ── contagem ─────────────────────────────────────────────── */

export const ouvirContagem = (eventoId, cb) =>
  onSnapshot(cContagemKinder(eventoId), (s) => cb(s.exists() ? s.data() : {}));
/** `valor` null tira a correção — volta a valer a contagem automática
 *  (os check-ins). */
export const corrigirContagem = (eventoId, sala, valor, uid) =>
  setDoc(cContagemKinder(eventoId), {
    [sala]: valor == null ? deleteField() : { valor: Number(valor), por: uid, em: serverTimestamp() },
  }, { merge: true });

/* ── ocorrências ──────────────────────────────────────────── */

/** A líder geral vê todas; a líder de sala vê as da sua sala, de
 *  qualquer voluntário; um voluntário simples só as que ele próprio
 *  registou. `escopo`: "geral" | "sala" | "propria"; `valor`: null
 *  (geral), a sala (sala) ou o uid (propria). */
export function ouvirOcorrencias(escopo, valor, cb) {
  const q = escopo === "geral"
    ? query(cOcorrencias(), orderBy("criadoEm", "desc"), limit(100))
    : escopo === "sala"
      ? query(cOcorrencias(), where("categoria", "==", valor))
      : query(cOcorrencias(), where("registadoPor", "==", valor));
  return onSnapshot(q, (s) => cb(lista(s).sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now()))));
}
export const registarOcorrencia = (uid, d) =>
  addDoc(cOcorrencias(), { ...d, registadoPor: uid, paisAvisados: !!d.paisAvisados, resolvida: false, criadoEm: serverTimestamp() });
export const atualizarOcorrencia = (id, campos) =>
  updateDoc(doc(db, `bases/${BASE_ID}/ocorrencias/${id}`), campos);

/* ── capacitações ─────────────────────────────────────────── */

export const ouvirCapacitacoes = (cb) =>
  onSnapshot(query(cCapacitacoes(), where("ativo", "==", true)), (s) =>
    cb(lista(s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, "pt"))));
export const criarCapacitacao = (d) => addDoc(cCapacitacoes(), { ...d, ordem: Date.now(), ativo: true });
export const guardarCapacitacao = (id, d) => updateDoc(doc(db, `bases/${BASE_ID}/capacitacoes/${id}`), d);
export const desativarCapacitacao = (id) => updateDoc(doc(db, `bases/${BASE_ID}/capacitacoes/${id}`), { ativo: false });

export const ouvirCapacitacoesDe = (uid, cb) =>
  onSnapshot(cCapacitacoesPessoa(uid), (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))));
/** `feitaEm: null` = desmarcar (fica o documento, com quem mexeu). */
export const marcarCapacitacao = (uid, capId, d) =>
  setDoc(doc(cCapacitacoesPessoa(uid), capId), { ...d, atualizadoEm: serverTimestamp() }, { merge: true });

/** Grelha da líder: capacitações de toda a gente, lidas uma vez. */
export async function obterCapacitacoesDeTodos(pessoas) {
  const pares = await Promise.all(pessoas.map(async (p) => {
    const s = await getDocs(cCapacitacoesPessoa(p.id));
    return [p.id, Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))];
  }));
  return Object.fromEntries(pares);
}

/** Uma capacitação está em dia? O certificado de registo criminal
 *  tem validade; as outras basta terem sido feitas. */
export function estadoCapacitacao(cap, feita, hoje = hojeLocal()) {
  if (!feita?.feitaEm) return "falta";
  if (cap.temValidade && (!feita.validaAte || feita.validaAte < hoje)) return "caducada";
  return "ok";
}

/* ── definições (faixas etárias, consentimento) ───────────── */

export const ouvirDefinicao = (nome, cb) => onSnapshot(cDefinicao(nome), (s) => cb(s.exists() ? s.data() : null));
export const guardarDefinicao = (nome, d) => setDoc(cDefinicao(nome), { ...d, atualizadoEm: serverTimestamp() }, { merge: true });
