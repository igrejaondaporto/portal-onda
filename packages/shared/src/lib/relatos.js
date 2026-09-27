/**
 * Reportar um bug/erro/melhoria do painel — genuinamente igual em
 * qualquer base (é para isso que packages/shared existe, ver
 * CLAUDE.md raiz). A gestão (mudar estado, quem assume) é só do Onda
 * Tech Hub — ver apps/ondatechhub.
 */
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, chamar } from "./firebase.js";

export const abrirRelato = (dados) => chamar("abrirRelato")(dados).then((r) => r.data);

export const excluirMeuRelato = (id) => chamar("excluirMeuRelato")({ id }).then((r) => r.data);

/** Os relatos que ESTA pessoa abriu, de qualquer base — a rule só
 *  deixa ler quem reportou ou o Onda Tech Hub (ver firestore.rules,
 *  euSou(reportadoPorId)). Excluídos (`ativo: false`) ficam de fora —
 *  filtro no cliente, não `where`, mesmo critério de
 *  `ouvirMinhasSolicitacoes`. */
export function ouvirMeusRelatos(uid, cb) {
  const q = query(
    collection(db, "relatos"),
    where("reportadoPorId", "==", uid), orderBy("criadoEm", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.ativo !== false)));
}

export const ROTULO_TIPO_RELATO = { erro: "Erro", bug: "Bug", melhoria: "Melhoria" };
export const ROTULO_STATUS_RELATO = {
  aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido", recusado: "Recusado",
};
export const COR_STATUS_RELATO = {
  aberto: "var(--cinza)", em_andamento: "var(--azul)", resolvido: "var(--verde)", recusado: "var(--magenta)",
};
