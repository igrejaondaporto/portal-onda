/**
 * Famílias, crianças, check-in, checklist de sala, contagem,
 * capacitações e definições — o que é só da Kinder.
 *
 * Famílias/crianças/check-in escrevem-se SEMPRE por Cloud Function
 * (functions/kinder.js): são dados de menores, e os pais escrevem
 * sem conta, pelo link da família. O resto (checklist, contagem,
 * capacitações) é escrita direta — as regras chegam, e assim
 * funciona sem rede ao domingo.
 */
import {
  addDoc, deleteField, getDocFromServer, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where, doc,
} from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
import {
  cFamilia, cFamilias, cCriancas, cCheckins, cCodigos, cChecklistSala, cChecklistKinder,
  cContagemKinder, cCapacitacoes, cCapacitacoesPessoa, cDefinicao,
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

/** Confirma no servidor (nunca na cache local) se uma família existe
 *  — usado quando o QR diz "não encontrada" pela escuta ao vivo, que
 *  só vê o que já sincronizou: uma família registada agora mesmo
 *  (pelo `/registo`, sem sessão) pode ainda não ter chegado à cache
 *  deste aparelho. `null` se mesmo assim não existir (ou já não
 *  estiver ativa). */
export async function obterFamiliaDoServidor(id) {
  const s = await getDocFromServer(cFamilia(id));
  return s.exists() && s.data().ativo !== false ? { id: s.id, ...s.data() } : null;
}
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

/* ── capacitações ─────────────────────────────────────────── */

export const ouvirCapacitacoes = (cb) =>
  onSnapshot(query(cCapacitacoes(), where("ativo", "==", true)), (s) =>
    cb(lista(s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.titulo.localeCompare(b.titulo, "pt"))));
export const criarCapacitacao = (d) => addDoc(cCapacitacoes(), { ...d, ordem: Date.now(), ativo: true });
export const guardarCapacitacao = (id, d) => updateDoc(doc(db, `bases/${BASE_ID}/capacitacoes/${id}`), d);
export const desativarCapacitacao = (id) => updateDoc(doc(db, `bases/${BASE_ID}/capacitacoes/${id}`), { ativo: false });

export const ouvirCapacitacoesDe = (uid, cb) =>
  onSnapshot(cCapacitacoesPessoa(uid), (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))));
/** `comprovanteUrl: null` = desmarcar (fica o documento, com quem mexeu). */
export const marcarCapacitacao = (uid, capId, d) =>
  setDoc(doc(cCapacitacoesPessoa(uid), capId), { ...d, atualizadoEm: serverTimestamp() }, { merge: true });

/** Sobe o comprovativo (certificado, foto da conclusão…) para
 *  `bases/kinder/pessoas/{uid}/capacitacoes/{capId}` e marca a
 *  capacitação como feita hoje. Imagem comprime antes de subir; PDF
 *  vai como está (ver limites em storage.rules). */
export async function enviarComprovanteCapacitacao(uid, capId, ficheiro) {
  const comprimido = await comprimirImagem(ficheiro);
  const ext = comprimido.type === "application/pdf" ? "pdf" : "jpg";
  const caminho = refStorage(storage, `bases/${BASE_ID}/pessoas/${uid}/capacitacoes/${capId}.${ext}`);
  await uploadBytes(caminho, comprimido, { contentType: comprimido.type });
  const url = await getDownloadURL(caminho);
  await marcarCapacitacao(uid, capId, {
    comprovanteUrl: url, comprovanteNome: ficheiro.name, feitaEm: hojeLocal(),
  });
  return url;
}

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
  if (!feita?.comprovanteUrl) return "falta";
  if (cap.temValidade && (!feita.validaAte || feita.validaAte < hoje)) return "caducada";
  return "ok";
}

/* ── definições (faixas etárias, consentimento) ───────────── */

export const ouvirDefinicao = (nome, cb) => onSnapshot(cDefinicao(nome), (s) => cb(s.exists() ? s.data() : null));
export const guardarDefinicao = (nome, d) => setDoc(cDefinicao(nome), { ...d, atualizadoEm: serverTimestamp() }, { merge: true });
