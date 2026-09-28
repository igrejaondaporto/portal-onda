/**
 * "Quero servir" — pedidos para entrar numa base (candidaturas).
 *
 * Partilhado porque é igual em todas as bases: o voluntário pede pelo
 * menu da foto (`MenuEu` → `SheetServirNoutraBase`), o líder responde
 * no Início (`PedidosParaServir`). O servidor é `functions/
 * candidaturas.js` — toda a escrita passa por lá (aprovar cria ou liga
 * uma identidade, regra 2 do CLAUDE.md raiz); aqui só se lê ao vivo e
 * se chama as funções.
 */
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, chamar, db, BASE_ID } from "./firebase.js";

/** As bases que recebem pedidos — a MESMA lista de
 *  `functions/candidaturas.js` (uma base nova entra nos dois sítios).
 *  Financeiro, Pastoral e Onda Tech Hub ficam de fora (decisão do dono
 *  do produto: não são equipas de domingo). */
export const BASES_CANDIDATURA = [
  "apoio", "tecnica", "backstage", "comunicacao", "pessoal",
  "louvor", "louvorkinder", "kinder", "new", "shift",
];

export const PAPEIS_QUE_RESPONDEM = new Set(["lider_base", "auxiliar"]);

/** O endereço da app de cada base — o subdomínio é sempre o baseId (o
 *  mesmo pressuposto de `trocarBase`, em auth.js). */
export const urlDaBase = (baseId) => `https://${baseId}.igrejaonda.pt`;

/** As bases a que se pode pedir, por nome — `bases/{id}` é legível por
 *  qualquer sessão (firestore.rules). */
export async function listarBasesParaServir() {
  const snap = await getDocs(collection(db, "bases"));
  return snap.docs
    .filter((d) => BASES_CANDIDATURA.includes(d.id) && d.data().ativa !== false)
    .map((d) => ({ id: d.id, nome: d.data().nome || d.id }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** O meu pedido à espera (ou null) — no máximo um, o servidor garante. */
export function ouvirMeuPedido(cb) {
  const uid = auth.currentUser?.uid;
  if (!uid) { cb(null); return () => {}; }
  const q = query(collection(db, "candidaturas"), where("pessoaId", "==", uid), where("estado", "==", "pendente"));
  return onSnapshot(q, (s) => cb(s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }), () => cb(null));
}

/** Os pedidos à espera nesta base, os mais antigos primeiro. Ordenação
 *  no cliente: `orderBy` com os dois `where` pedia um índice composto
 *  novo (ficheiro partilhado, com deploy próprio) para meia dúzia de
 *  documentos — mesmo raciocínio de `ouvirRecados`. */
export function ouvirPedidosDaBase(cb) {
  const q = query(collection(db, "candidaturas"), where("baseId", "==", BASE_ID), where("estado", "==", "pendente"));
  return onSnapshot(
    q,
    (s) => cb(s.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0))),
    // sem a claim (voluntário) ou sem rede: sem pedidos, o Início segue
    () => cb([]),
  );
}

export const pedirParaServir = (baseId, mensagem) =>
  chamar("pedirParaServir")({ baseId, mensagem }).then((r) => r.data);

export const cancelarPedidoServir = (id) =>
  chamar("cancelarPedidoServir")({ id }).then((r) => r.data);

/** `aprovar` pode voltar com `precisaEscolher` + `candidatos` (alguém já
 *  tem este telemóvel) — aí chama-se outra vez com `pessoaExistenteId`
 *  (é a mesma pessoa) ou `criarNova: true` (não é). */
export const decidirCandidatura = (id, decisao, extra = {}) =>
  chamar("decidirCandidatura")({ id, decisao, ...extra }).then((r) => r.data);

/** "há 3 dias" / "hoje" — quanto tempo o pedido está à espera. */
export function haQuantoTempo(ts) {
  if (!ts?.toDate) return "agora";
  const dias = Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
