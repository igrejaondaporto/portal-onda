/**
 * Reembolsos: qualquer voluntário submete o seu; o líder da base vê
 * todos e aprova ou indefere. Quem paga é o Financeiro, noutra app
 * (financeiro.igrejaonda.pt), por Cloud Function — daqui nunca se
 * escreve "pago". O anexo (nota ou fatura) fica no Storage, o
 * documento no Firestore.
 */
import { doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cReembolsos } from "./modelo";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

export function ouvirReembolsos(souLiderBase, uid, cb) {
  const q = souLiderBase
    ? query(cReembolsos(), orderBy("criadoEm", "desc"))
    : query(cReembolsos(), where("pessoaId", "==", uid), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/* ── onde a pessoa recebe ──────────────────────────────────────
 * Vive em pessoas/{uid}/privado/pagamento — global (quem serve em duas
 * bases recebe na mesma conta) e escondido: as regras só deixam a dona
 * ler e escrever, nem o líder da base vê o IBAN de ninguém. Preenche-se
 * uma vez; a partir daí o formulário vem preenchido.
 *
 * O pedido leva uma CÓPIA disto, não uma referência: o Financeiro tem
 * de saber para que conta pagou aquele pedido, e mudar de banco em
 * março não pode reescrever os pagamentos de janeiro. */
const refPagamento = (uid) => doc(db, `pessoas/${uid}/privado/pagamento`);

export async function lerPagamentoGuardado(uid) {
  const snap = await getDoc(refPagamento(uid));
  return snap.exists() ? snap.data() : null;
}

export const guardarPagamento = (uid, { metodo, destino }) =>
  setDoc(refPagamento(uid), { metodo, destino, guardadoEm: serverTimestamp() });

/** Só dígitos, para comparar e para gravar sem espaços a mais. */
const soDigitos = (s) => String(s).replace(/\D/g, "");

/** IBAN português: PT50 + 21 dígitos. Não validamos o dígito de
 *  controlo — o objetivo é apanhar o engano de quem escreveu a mais ou
 *  a menos no telemóvel, não fazer contabilidade. */
export function normalizarDestino(metodo, valor) {
  const cru = String(valor ?? "").trim();
  if (metodo === "mbway") {
    const d = soDigitos(cru);
    if (d.length !== 9 || !d.startsWith("9")) return { erro: "O MB Way é um número de telemóvel com 9 dígitos." };
    return { destino: d };
  }
  const limpo = cru.replace(/\s/g, "").toUpperCase();
  if (!/^PT\d{23}$/.test(limpo)) return { erro: "O IBAN começa por PT50 e tem 25 caracteres." };
  return { destino: limpo };
}

/** Como se mostra o destino já guardado (IBAN em grupos de 4). */
export const mostrarDestino = (metodo, destino) =>
  metodo === "mbway"
    ? String(destino).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : String(destino).replace(/(.{4})/g, "$1 ").trim();

export async function criarReembolso(uid, { descricao, valor, ficheiro, pessoaNome, pagamento }) {
  const ref = doc(cReembolsos());
  let anexo = null;
  if (ficheiro) {
    // a fatura tem de continuar legível — comprime menos que as outras
    // fotos da app, e só se for mesmo imagem (PDF sobe sem tocar).
    const paraEnviar = ficheiro.type.startsWith("image/")
      ? await comprimirImagem(ficheiro, { maxDimensao: 2000, qualidade: 0.9 })
      : ficheiro;
    const destino = refStorage(storage, `bases/${BASE_ID}/reembolsos/${ref.id}`);
    await uploadBytes(destino, paraEnviar, { contentType: paraEnviar.type });
    anexo = await getDownloadURL(destino);
  }
  await setDoc(ref, {
    pessoaId: uid,
    // o nome fica gravado porque o painel do Financeiro lê as 9 bases
    // numa query só (collectionGroup) e bases/{b}/pessoas é fechado à
    // base do token — de lá ele nunca conseguiria resolver o nome.
    pessoaNome: pessoaNome ?? null,
    baseId: BASE_ID,
    descricao, valor, anexo, pagamento,
    estado: "submetido", criadoEm: serverTimestamp(),
  });
  return ref.id;
}

/** Aprovar/indeferir são do líder — as regras já só deixam a ele
 *  (souLiderBase). "Aprovado" fica à espera do Financeiro, que paga ou
 *  devolve a partir da app dele. */
export const aprovarReembolso = (reembolsoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/reembolsos/${reembolsoId}`), {
    estado: "aprovado", comentarioLider: null, decididoEm: serverTimestamp(),
  });

export const indeferirReembolso = (reembolsoId, comentario) =>
  updateDoc(doc(db, `bases/${BASE_ID}/reembolsos/${reembolsoId}`), {
    estado: "indeferido", comentarioLider: comentario, decididoEm: serverTimestamp(), vistoPeloVoluntario: false,
  });

/** Só o dono do pedido chama isto (fecha o aviso no Início depois de
 *  ler o motivo, ou de ver que já foi pago) — as regras só deixam
 *  mexer neste campo, nada mais. */
export const marcarReembolsoVisto = (reembolsoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/reembolsos/${reembolsoId}`), { vistoPeloVoluntario: true });
