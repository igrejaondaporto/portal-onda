/**
 * Reportar bugs/erros/melhorias do painel — de QUALQUER base, para o
 * Onda Tech Hub triar (Julio, Vitor, Kairan, Diogo, Hans). Ficheiro
 * próprio, mesmo espírito de kinder.js/mural.js/pastoral.js.
 *
 * Coleção na raiz (`relatos/{id}`), não aninhada em nenhuma base —
 * mesmo desenho de `solicitacoes/` (ver index.js): escrita por
 * QUALQUER pessoa autenticada, de qualquer base, lida por quem abriu
 * + pela base `ondatechhub`. Ao contrário de `solicitacoes`, aqui não
 * é só o líder que abre — qualquer voluntário reporta o que vê
 * (pedido explícito do líder da Técnica, 2026-09: "reportados pelos
 * líderes OU utilizadores dos painéis"). Toda a escrita passa por
 * Cloud Function (regra 3 do CLAUDE.md raiz).
 *
 * Sem transições travadas por papel (ao contrário de
 * `mudarStatusSolicitacao`): o Onda Tech Hub são 5 pessoas de
 * confiança, não duas equipas a negociar um pedido — qualquer membro
 * move qualquer relato para qualquer estado.
 *
 * Anexo (foto ou vídeo, opcional): sobe direto do cliente para o
 * Storage (`relatos/{id}/...`, ver storage.rules) — esta função só
 * grava o URL que já veio pronto. Existe só enquanto o relato precisa
 * de atenção: ao marcar "resolvido", `mudarStatusRelato` apaga o
 * ficheiro do Storage e limpa o campo (pedido do líder — não faz
 * sentido guardar screenshots/vídeos de problemas já corrigidos).
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

const db = () => admin.firestore();
const refRelato = (id) => db().doc(`relatos/${id}`);

// "erro" existia como terceiro tipo, sem nenhum relato real ainda
// criado (verificado antes desta mudança) — o líder pediu só dois,
// "para ficar mais fácil saber o que é e o que priorizar": Problema/
// Bug (inclui o que antes era "erro") e Melhoria.
const TIPOS_RELATO = ["bug", "melhoria"];
const STATUS_RELATO = ["aberto", "em_andamento", "resolvido", "recusado"];

async function nomeDaPessoa(baseId, uid) {
  const s = await db().doc(`bases/${baseId}/pessoas/${uid}`).get();
  return s.exists ? s.data().nome : null;
}

// O ID nasce no cliente (mesmo padrão de SheetMarca — id gerado ANTES
// do documento existir, para o anexo ter um caminho de Storage para
// onde subir antes de abrir o relato). Um id de 20 caracteres do
// próprio `doc()` do Firestore é, na prática, impossível de adivinhar
// ou colidir — mesma confiança que o resto do repo já deposita nesse
// padrão.
export const abrirRelato = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, tipo, titulo, descricao, paginaOrigem = "", anexoUrl = null, anexoTipo = null } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta o id.");
  if (!TIPOS_RELATO.includes(tipo)) throw new HttpsError("invalid-argument", "Tipo inválido.");
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  if (!descricao?.trim()) throw new HttpsError("invalid-argument", "Falta descrever o que aconteceu.");

  const reportadoPorNome = await nomeDaPessoa(baseId, uid);
  await refRelato(id).set({
    tipo, titulo: titulo.trim(), descricao: descricao.trim(),
    paginaOrigem: paginaOrigem.trim() || null,
    anexoUrl: anexoUrl || null, anexoTipo: anexoTipo || null,
    baseOrigemId: baseId, reportadoPorId: uid, reportadoPorNome,
    status: "aberto", responsavelId: null, responsavelNome: null,
    ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    historico: [{ de: null, para: "aberto", porId: uid, porNome: reportadoPorNome, em: admin.firestore.Timestamp.now() }],
  });
  return { id };
});

function exigeOndaTechHub(req) {
  if (req.auth?.token?.baseId !== "ondatechhub") {
    throw new HttpsError("permission-denied", "Só o Onda Tech Hub gere relatos.");
  }
  return req.auth.uid;
}

// O anexo (screenshot/vídeo do problema) só interessa enquanto o
// relato está por tratar — pedido do líder: "quando a gente concluir,
// será excluído da base de dados". Mesmo par de helpers que
// retencao.js/kinder.js já usam para apagar um anexo pelo download
// URL (o caminho real vem embutido nele, poupa reconstruir um nome
// que varia com a extensão).
function caminhoDeUrlStorage(url) {
  const m = /\/o\/([^?]+)/.exec(String(url || ""));
  return m ? decodeURIComponent(m[1]) : null;
}
async function apagarFicheiroSeExistir(url) {
  const caminho = caminhoDeUrlStorage(url);
  if (!caminho) return;
  try {
    await admin.storage().bucket().file(caminho).delete();
  } catch { /* já não existe, nada a fazer */ }
}

export const mudarStatusRelato = onCall(async (req) => {
  const uid = exigeOndaTechHub(req);
  const { id, novoStatus, nota = "" } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta o relato.");
  if (!STATUS_RELATO.includes(novoStatus)) throw new HttpsError("invalid-argument", "Estado inválido.");

  const ref = refRelato(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Relato não encontrado.");
  const r = snap.data();
  if (r.status === novoStatus) throw new HttpsError("failed-precondition", "Já está nesse estado.");

  const nome = await nomeDaPessoa("ondatechhub", uid);
  const historicoEntry = {
    de: r.status, para: novoStatus, porId: uid, porNome: nome,
    em: admin.firestore.Timestamp.now(), ...(nota.trim() ? { nota: nota.trim() } : {}),
  };
  const dados = { status: novoStatus, historico: [...(r.historico || []), historicoEntry] };
  // quem mexe primeiro fica marcado como responsável — não trava
  // outro membro de continuar a mexer depois (são 5 pessoas de
  // confiança, não uma fila de aprovação)
  if (!r.responsavelId) { dados.responsavelId = uid; dados.responsavelNome = nome; }
  if (novoStatus === "resolvido" && r.anexoUrl) {
    await apagarFicheiroSeExistir(r.anexoUrl);
    dados.anexoUrl = null;
    dados.anexoTipo = null;
  }
  await ref.set(dados, { merge: true });
  return { ok: true };
});

// "Nada é apagado, é desativado" (regra 5, CLAUDE.md raiz) — só quem
// abriu, e só enquanto ninguém do Onda Tech Hub mexeu ainda (uma vez
// que alguém já está a olhar para aquilo, cancelar sozinho some sem
// avisar quem já investiu tempo — mesma lógica de
// `excluirMinhaSolicitacao`).
export const excluirMeuRelato = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta o relato.");
  const ref = refRelato(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Relato não encontrado.");
  const r = snap.data();
  if (r.reportadoPorId !== uid) throw new HttpsError("permission-denied", "Só quem reportou pode remover.");
  if (r.status !== "aberto") throw new HttpsError("failed-precondition", "Já foi assumido — fala com o Onda Tech Hub para cancelar.");
  await ref.set({ ativo: false }, { merge: true });
  return { ok: true };
});
