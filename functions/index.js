/**
 * Cloud Functions do Portal do Voluntário — igrejaonda
 *
 * Porque é que isto existe:
 *   1. O Firebase Auth não sabe fazer login por PIN. Tem de ser à mão.
 *   2. A verificação NUNCA pode acontecer no telemóvel — quem abrir as
 *      ferramentas do browser entrava como qualquer pessoa.
 *   3. A regra do líder de escala (só edita o culto em que está nomeado)
 *      é simples de escrever aqui e horrível de escrever nas regras.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { logger } from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

// O frontend vive no Cloudflare, não no domínio das Functions — sem isto
// os pedidos são bloqueados como cross-origin. Cobre o domínio de cada
// base (apoio.painelonda.pt, tecnica.painelonda.pt…), os previews do
// Workers Builds e o dev local.
const ORIGENS_PERMITIDAS = [
  /^https:\/\/([a-z0-9-]+\.)?painelonda\.pt$/,
  /^https:\/\/[a-z0-9-]+\.workers\.dev$/,
  "http://localhost:5173",
];

// Portugal → o datacenter mais próximo. Poupa ~80ms por chamada.
setGlobalOptions({ region: "europe-west1", maxInstances: 10, cors: ORIGENS_PERMITIDAS });

const MAX_1 = 3;                  // tentativas antes do bloqueio
const MAX_2 = 5;                  // tentativas depois dos 15 minutos
const BLOQUEIO_MS = 15 * 60 * 1000;

/* ── hash do PIN ──────────────────────────────────────────── */
function hash(pin) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
}
function confere(pin, guardado) {
  const [sal, esperado] = String(guardado).split(":");
  if (!sal || !esperado) return false;
  const a = Buffer.from(esperado, "hex");
  const b = scryptSync(pin, sal, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const refPessoa = (b, p) => db.doc(`bases/${b}/pessoas/${p}`);
// o segredo é global — uma pessoa, um PIN, em qualquer base em que sirva
const refGlobal = (p) => db.doc(`pessoas/${p}`);
const refSegredo = (p) => db.doc(`pessoas/${p}/privado/auth`);

/* ── INDISPONIBILIDADE PARTILHADA ENTRE BASES ─────────────────
 * Quem serve em mais do que uma base não pode ser escalado no mesmo
 * culto em nenhuma delas ao mesmo tempo — para N bases, não só duas:
 * a checagem abaixo procura "existe entrada de QUALQUER outra base",
 * nunca compara com uma base específica. Uma base nova não precisa de
 * nenhuma mudança aqui, só da sua própria guardarEscala<Base> (cada
 * base já tem o formato de escala dela — lugares[] na Técnica, lista
 * simples na Apoio — por isso não dá para generalizar a função em si,
 * só a validação partilhada). eventos/{e} já é global ("pertence à
 * igreja, não à base" — CLAUDE.md raiz, regra 7); esta subcoleção
 * segue o mesmo padrão de escalas/{base} e atribuicoes/{funcao}, só
 * que é "da pessoa+culto", não de uma base. Só existe para quem é
 * multi-base — para o resto nunca há nada para escrever aqui.
 *
 * Por agora só a escala publicada grava (`motivo:"escalado"`) — a
 * enquete de indisponibilidade fica de fora do escopo de propósito
 * (cada um vota livremente em cada base). O campo `motivo` continua
 * uma string, não um booleano, porque é o ponto de extensão pronto
 * para o dia em que a Apoio ganhar enquete própria: essa função só
 * chamaria `marcarIndisponivel(eventoId, "apoio", uid, "votou")`,
 * sem mexer em mais nada aqui. */
const refIndisponibilidade = (eventoId, uid) => db.doc(`eventos/${eventoId}/indisponibilidades/${uid}`);

async function basesDaPessoa(uid) {
  const g = await refGlobal(uid).get();
  const bases = g.exists ? g.data().bases || {} : {};
  return Object.keys(bases).filter((b) => bases[b]);
}

/** Lança failed-precondition se `uid` já tem uma entrada de OUTRA
 *  base (qualquer uma — não uma lista fixa de duas) para este culto —
 *  chamar antes de gravar a escala. Só lê o nome da pessoa e da outra
 *  base (dois pedidos extra ao Firestore) no caminho de erro, que é
 *  raro; `bases/{id}.nome` já existe para todas, nunca precisa de
 *  manutenção quando uma base nova aparecer. */
async function garantirSemConflitoCrossBase(eventoId, baseId, uid) {
  const snap = await refIndisponibilidade(eventoId, uid).get();
  if (!snap.exists) return;
  const origens = snap.data().origens || {};
  const outraBase = Object.keys(origens).find((b) => b !== baseId);
  if (outraBase) {
    const [g, b] = await Promise.all([refGlobal(uid).get(), db.doc(`bases/${outraBase}`).get()]);
    const nome = g.exists ? g.data().nome : "Esta pessoa";
    const nomeBase = b.exists ? b.data().nome : outraBase;
    throw new HttpsError("failed-precondition",
      `${nome} já está escalado(a) na ${nomeBase} nesse dia.`);
  }
}

/** Grava/atualiza só a entrada desta base — nunca mexe na da outra.
 *  Chave com ponto num set(merge:true) gravaria um campo literal
 *  "origens.tecnica", não o mapa aninhado (mesmo bug já corrigido em
 *  pessoas/{uid}.bases) — por isso o objeto vem sempre aninhado. */
async function marcarIndisponivel(eventoId, baseId, uid, motivo) {
  await refIndisponibilidade(eventoId, uid).set({
    origens: { [baseId]: { motivo, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() } },
  }, { merge: true });
}

/** Apaga só a entrada desta base. FieldValue.delete() dentro de um
 *  mapa aninhado funciona tanto em set(merge:true) como em update() —
 *  aqui fica em set(merge:true) porque não exige o documento já
 *  existir (nada a apagar = no-op, sem precisar de tratar not-found). */
async function desmarcarIndisponivel(eventoId, baseId, uid) {
  await refIndisponibilidade(eventoId, uid).set({
    origens: { [baseId]: admin.firestore.FieldValue.delete() },
  }, { merge: true });
}

/* ── DADOS DO ECRÃ DE ENTRADA ─────────────────────────────────
 * Antes de autenticar não há token, logo as regras do Firestore
 * não deixam ler nada (de propósito). É por isto que a grelha de
 * fotos e o cabeçalho vêm por aqui: devolve só o que já é visível
 * a olho nu à porta — nome, papel, foto. Nunca telefone, nunca o
 * hash do PIN. */
export const dadosEntrada = onCall(async (req) => {
  const { baseId } = req.data || {};
  if (!baseId) throw new HttpsError("invalid-argument", "Falta a base.");

  const baseSnap = await db.doc(`bases/${baseId}`).get();
  if (!baseSnap.exists || baseSnap.data().ativa === false) {
    throw new HttpsError("not-found", "Base não encontrada.");
  }
  const pessoasSnap = await db
    .collection(`bases/${baseId}/pessoas`)
    .where("ativo", "==", true)
    .orderBy("nome")
    .get();

  const b = baseSnap.data();
  // o PIN é global — quantos dígitos tem é propriedade do PIN, não do
  // papel nesta base (um líder da Técnica, adicionado como voluntário
  // na Apoio, continua a digitar o código de 6 dígitos que já tinha).
  // pinDigitos vive no segredo (pessoas/{p}/privado/auth), nunca no
  // documento da base; o fallback cobre identidades criadas antes
  // deste campo existir.
  const segredos = await Promise.all(pessoasSnap.docs.map((d) => refSegredo(d.id).get()));
  return {
    base: { nome: b.nome, horaChegada: b.horaChegada, horaCulto: b.horaCulto, local: b.local },
    pessoas: pessoasSnap.docs.map((d, i) => {
      const p = d.data();
      const s = segredos[i];
      const digitos = s.exists ? s.data().pinDigitos ?? (p.papel === "lider_base" ? 6 : 4) : 4;
      return { id: d.id, nome: p.nome, papel: p.papel, foto: p.foto ?? null, digitos };
    }),
  };
});

/* ── ENTRAR ───────────────────────────────────────────────── */
export const entrar = onCall(async (req) => {
  const { baseId, pessoaId, pin } = req.data || {};
  if (!baseId || !pessoaId || !/^\d{4,6}$/.test(String(pin || ""))) {
    throw new HttpsError("invalid-argument", "Dados de entrada inválidos.");
  }

  const segredoRef = refSegredo(pessoaId);
  const [pSnap, sSnap] = await Promise.all([refPessoa(baseId, pessoaId).get(), segredoRef.get()]);
  // mensagem igual à do PIN errado, para não revelar quem existe
  if (!pSnap.exists || !sSnap.exists) throw new HttpsError("permission-denied", "errado");

  const pessoa = pSnap.data();
  const s = sSnap.data();
  const agora = Date.now();
  const bloqueadoAte = s.bloqueadoAte?.toMillis?.() ?? 0;

  if (bloqueadoAte > agora) {
    throw new HttpsError("resource-exhausted", "bloqueado", {
      faltamSegundos: Math.ceil((bloqueadoAte - agora) / 1000),
    });
  }

  if (!confere(String(pin), s.pinHash)) {
    const falhas = (s.falhas ?? 0) + 1;
    const limite = s.jaBloqueou ? MAX_2 : MAX_1;
    const bloqueia = falhas >= limite;
    await segredoRef.set({
      falhas: bloqueia ? 0 : falhas,
      jaBloqueou: s.jaBloqueou || bloqueia,
      bloqueadoAte: bloqueia ? admin.firestore.Timestamp.fromMillis(agora + BLOQUEIO_MS) : null,
      ultimaFalha: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw new HttpsError("permission-denied", bloqueia ? "bloqueado" : "errado",
      { restam: bloqueia ? 0 : limite - falhas, bloqueado: bloqueia });
  }

  await segredoRef.set({
    falhas: 0, jaBloqueou: false, bloqueadoAte: null,
    ultimoAcesso: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const token = await admin.auth().createCustomToken(pessoaId, {
    baseId,
    papel: pessoa.papel === "lider_base" ? "lider_base" : "voluntario",
  });
  return { token, deveTrocarPin: !!s.provisorio };
});

/* ── TROCAR O PRÓPRIO PIN ─────────────────────────────────── */
export const trocarPin = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { pinAtual, pinNovo } = req.data || {};
  const digitos = req.auth.token.papel === "lider_base" ? 6 : 4;
  if (!new RegExp(`^\\d{${digitos}}$`).test(String(pinNovo || ""))) {
    throw new HttpsError("invalid-argument", `O código tem de ter ${digitos} dígitos.`);
  }
  if (/^(\d)\1+$/.test(pinNovo) || "0123456789".includes(pinNovo)) {
    throw new HttpsError("invalid-argument", "Escolhe um código menos óbvio.");
  }

  const ref = refSegredo(uid);
  const snap = await ref.get();
  if (!snap.exists || !confere(String(pinAtual), snap.data().pinHash)) {
    throw new HttpsError("permission-denied", "O código atual não está certo.");
  }
  await ref.set({ pinHash: hash(String(pinNovo)), pinDigitos: digitos, provisorio: false, falhas: 0 }, { merge: true });
  return { ok: true };
});

/* ── LÍDER DA BASE ────────────────────────────────────────── */
function exigeLider(req) {
  const baseId = req.auth?.token?.baseId;
  if (!baseId || req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só o líder da base pode fazer isto.");
  }
  return baseId;
}
// fixo e óbvio de propósito: ninguém decora código nenhum, e o
// `provisorio:true` obriga a trocar logo no primeiro acesso.
const PIN_PADRAO = { lider_base: "123456", voluntario: "1234" };
const pinProvisorio = (papel) => PIN_PADRAO[papel] ?? PIN_PADRAO.voluntario;

export const criarVoluntario = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { nome, telefone = "", papel = "voluntario", pessoaExistenteId = null, ministerios } = req.data || {};
  const comMinisterios = ministerios && typeof ministerios === "object" ? { ministerios } : {};

  // pessoa que já existe noutra base: só a liga a esta, PIN não muda
  if (pessoaExistenteId) {
    const globalSnap = await refGlobal(pessoaExistenteId).get();
    if (!globalSnap.exists) throw new HttpsError("not-found", "Pessoa não encontrada.");
    const jaAqui = await refPessoa(baseId, pessoaExistenteId).get();
    if (jaAqui.exists) throw new HttpsError("already-exists", "Essa pessoa já está nesta base.");

    await refPessoa(baseId, pessoaExistenteId).set({
      nome: nome.trim() || globalSnap.data().nome, telefone, papel, ativo: true,
      foto: globalSnap.data().foto ?? null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      ...comMinisterios,
    });
    // chave com ponto num set(merge:true) grava um campo literal
    // "bases.tecnica", não o mapa aninhado — tem de ser objeto aninhado
    // (o merge funde recursivamente e preserva as outras bases já lá).
    await refGlobal(pessoaExistenteId).set({ bases: { [baseId]: true } }, { merge: true });
    return { pessoaId: pessoaExistenteId, pinProvisorio: null };
  }

  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");

  const provisorio = pinProvisorio(papel);
  const ref = db.collection(`bases/${baseId}/pessoas`).doc();
  await ref.set({
    nome: nome.trim(), telefone, papel, ativo: true, foto: null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    ...comMinisterios,
  });
  await refGlobal(ref.id).set({
    nome: nome.trim(), foto: null, bases: { [baseId]: true },
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await refSegredo(ref.id).set({
    pinHash: hash(provisorio), pinDigitos: provisorio.length,
    provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  });
  // devolvido UMA vez, para o líder dizer à pessoa. Nunca mais fica legível.
  return { pessoaId: ref.id, pinProvisorio: provisorio };
});

/** Para o líder encontrar alguém que já existe noutra base, antes de
 *  criar uma identidade duplicada (ex.: o Vitor já está na Apoio e vai
 *  servir também na Técnica). Procura pelo telefone, o único campo
 *  razoavelmente único que já se pede a toda a gente. */
export const procurarPessoaGlobal = onCall(async (req) => {
  exigeLider(req);
  const telefone = String(req.data?.telefone || "").trim();
  if (!telefone) throw new HttpsError("invalid-argument", "Falta o telefone.");

  const snap = await db.collectionGroup("pessoas").where("telefone", "==", telefone).limit(5).get();
  const vistos = new Set();
  const resultados = [];
  for (const d of snap.docs) {
    if (vistos.has(d.id)) continue;
    vistos.add(d.id);
    const global = await refGlobal(d.id).get();
    const bases = global.exists ? global.data().bases || {} : {};
    resultados.push({
      pessoaId: d.id,
      nome: d.data().nome,
      foto: d.data().foto ?? null,
      bases: Object.keys(bases).filter((b) => bases[b]),
    });
  }
  return { resultados };
});

/** Para o líder que está a ligar uma pessoa já existente noutra base:
 *  procurar pelo telefone às vezes falha (número trocado, não
 *  preenchido) — isto deixa escolher de uma lista. Inclui o telefone
 *  (o líder está mesmo a ligar esta pessoa, não a espreitar a outra
 *  base) para pré-preencher o formulário — é o mesmo número da mesma
 *  pessoa, não faz sentido perguntar outra vez. Nunca o papel: isso é
 *  sempre decidido de novo nesta base. */
export const listarPessoasDaBase = onCall(async (req) => {
  exigeLider(req);
  const { baseId } = req.data || {};
  if (!baseId) throw new HttpsError("invalid-argument", "Falta a base.");

  const snap = await db.collection(`bases/${baseId}/pessoas`).where("ativo", "==", true).get();
  const pessoas = snap.docs
    .map((d) => ({
      pessoaId: d.id, nome: d.data().nome, foto: d.data().foto ?? null,
      telefone: d.data().telefone ?? "",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return { pessoas };
});

export const editarVoluntario = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { pessoaId, nome, telefone = "", papel, ministerios } = req.data || {};
  if (!pessoaId) throw new HttpsError("invalid-argument", "Falta o voluntário.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (!["voluntario", "lider_base"].includes(papel)) {
    throw new HttpsError("invalid-argument", "Papel inválido.");
  }
  const ref = refPessoa(baseId, pessoaId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Voluntário não encontrado.");

  if (papel === "lider_base") {
    // só um líder da base de cada vez — promover alguém demove quem lá estava
    const outros = await db.collection(`bases/${baseId}/pessoas`)
      .where("papel", "==", "lider_base").get();
    const lote = db.batch();
    outros.forEach((d) => { if (d.id !== pessoaId) lote.update(d.ref, { papel: "voluntario" }); });
    await lote.commit();
  }
  const dados = { nome: nome.trim(), telefone, papel };
  // ministerios: { audio: "titular"|"aprendiz", ... } — só bases com
  // ministérios enviam isto; nas outras o campo nunca aparece.
  if (ministerios && typeof ministerios === "object") dados.ministerios = ministerios;
  await ref.set(dados, { merge: true });
  return { ok: true };
});

export const reporPin = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { pessoaId } = req.data || {};
  const snap = await refPessoa(baseId, pessoaId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Voluntário não encontrado.");
  const provisorio = pinProvisorio(snap.data().papel);
  await refSegredo(pessoaId).set({
    pinHash: hash(provisorio), pinDigitos: provisorio.length,
    provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  }, { merge: true });
  return { pinProvisorio: provisorio };
});

/* ── REPOR OS CÓDIGOS DE TODA A BASE DE UMA VEZ ─────────────
 * O PIN é global — repor aqui repõe em qualquer outra base onde a
 * pessoa também sirva. É a mesma pessoa, o mesmo código. */
export const reporTodosPins = onCall(async (req) => {
  const baseId = exigeLider(req);
  const snap = await db.collection(`bases/${baseId}/pessoas`).where("ativo", "==", true).get();
  const lote = db.batch();
  snap.forEach((doc) => {
    const provisorio = pinProvisorio(doc.data().papel);
    lote.set(refSegredo(doc.id), {
      pinHash: hash(provisorio), pinDigitos: provisorio.length,
      provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
    }, { merge: true });
  });
  await lote.commit();
  return { repostos: snap.size };
});

export const removerVoluntario = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { pessoaId } = req.data || {};
  if (pessoaId === req.auth.uid) {
    throw new HttpsError("failed-precondition", "Não te podes remover a ti próprio.");
  }
  // desativar, não apagar: o histórico dos domingos passados depende disto
  await refPessoa(baseId, pessoaId).set({ ativo: false }, { merge: true });
  await refGlobal(pessoaId).set({ bases: { [baseId]: false } }, { merge: true });

  // o PIN só se apaga se a pessoa não continuar ativa nem numa base sequer
  const globalSnap = await refGlobal(pessoaId).get();
  const bases = globalSnap.exists ? globalSnap.data().bases || {} : {};
  const aindaAtivaAlgures = Object.values(bases).some(Boolean);
  if (!aindaAtivaAlgures) {
    await refSegredo(pessoaId).delete();
  }

  const escalas = await db.collectionGroup("escalas")
    .where("pessoas", "array-contains", pessoaId).get();
  const lote = db.batch();
  const eventosLimpos = [];
  escalas.forEach((d) => {
    if (d.id !== baseId) return;
    lote.update(d.ref, {
      pessoas: admin.firestore.FieldValue.arrayRemove(pessoaId),
      liderEscala: d.data().liderEscala === pessoaId ? null : d.data().liderEscala,
    });
    eventosLimpos.push(d.ref.parent.parent.id);
  });
  await lote.commit();
  // tira o bloqueio cross-base pendente nos cultos de onde acabou de
  // sair — sem isto a pessoa ficava "escalada fantasma" na outra base
  await Promise.all(eventosLimpos.map((eventoId) => desmarcarIndisponivel(eventoId, baseId, pessoaId)));
  return { ok: true };
});

/* ── TROCAR DE BASE ──────────────────────────────────────────
 * Já autenticado, sem pedir PIN outra vez: só troca os claims do
 * token para a base escolhida, desde que a pessoa esteja mesmo lá. */
export const trocarBase = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { novoBaseId } = req.data || {};
  if (!novoBaseId) throw new HttpsError("invalid-argument", "Falta a base.");

  const snap = await refPessoa(novoBaseId, uid).get();
  if (!snap.exists || snap.data().ativo === false) {
    throw new HttpsError("permission-denied", "Não estás ativo nessa base.");
  }

  const token = await admin.auth().createCustomToken(uid, {
    baseId: novoBaseId,
    papel: snap.data().papel === "lider_base" ? "lider_base" : "voluntario",
  });
  return { token };
});

/** Marca o tour de primeiro login como visto, só para a base do token
 *  de quem chama — nunca uma base recebida do cliente, para não dar
 *  para marcar tour visto de uma base a que a pessoa não pertence.
 *  pessoas/{uid} é global e write:false nas regras, por isso esta
 *  gravação só pode passar por aqui. */
export const marcarTourVisto = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  await refGlobal(uid).set({ tourVisto: { [baseId]: true } }, { merge: true });
  return { ok: true };
});

/** Confirma que quem chama é líder da base ou líder de escala do culto.
 *  Devolve a escala (já lida) para quem precisar dela a seguir. */
async function exigeLiderDoCulto(req, eventoId) {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const escala = await db.doc(`eventos/${eventoId}/escalas/${baseId}`).get();
  if (!escala.exists) throw new HttpsError("not-found", "Este culto não tem escala.");

  const souLiderBase = req.auth.token.papel === "lider_base";
  const souLiderEscala = escala.data().liderEscala === uid;
  if (!souLiderBase && !souLiderEscala) {
    throw new HttpsError("permission-denied",
      "Só o líder de escala deste culto pode fazer isto.");
  }
  return { uid, baseId, escala };
}

/* ── ESCALA POR MINISTÉRIO (Base Técnica) ──────────────────
 * eventos/{e}/escalas/{base} ganha `lugares` (titular+aprendiz por
 * ministério) além do que já existia. `pessoas` continua a ser
 * escrito — é o array plano que o resto do sistema (checklist,
 * "servem contigo", obterMeuEvento…) já sabe ler; recalculado aqui,
 * nunca confiado ao que o cliente mandou. */
export const guardarEscalaTecnica = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { eventoId, liderEscala = null, lugares } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!Array.isArray(lugares)) throw new HttpsError("invalid-argument", "Faltam os lugares.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();
  const souLiderBase = req.auth.token.papel === "lider_base";
  const souLiderAtual = snap.exists && snap.data().liderEscala === uid;
  if (!souLiderBase && !souLiderAtual) {
    throw new HttpsError("permission-denied",
      "Só o líder da base ou o líder de escala deste culto pode fazer isto.");
  }

  // o Responsável é um papel de liderança, não um posto operacional —
  // pode acumular com um ministério (o Jorge pode ser Responsável e
  // titular do Áudio no mesmo culto). A restrição "uma pessoa, um
  // lugar por culto" vale só entre os ministérios operacionais.
  const pessoas = new Set();
  const usados = new Set();
  const lugaresLimpos = lugares.map((l) => {
    if (!l?.ministerioId) throw new HttpsError("invalid-argument", "Lugar sem ministério.");
    const operacional = l.ministerioId !== "responsavel";
    for (const id of [l.titularId, l.aprendizId]) {
      if (!id) continue;
      if (operacional) {
        if (usados.has(id)) throw new HttpsError("invalid-argument", "Uma pessoa não pode estar em dois lugares no mesmo culto.");
        usados.add(id);
      }
      pessoas.add(id);
    }
    return { ministerioId: l.ministerioId, titularId: l.titularId || null, aprendizId: l.aprendizId || null };
  });

  // quem serve em mais do que uma base não pode ficar escalado nas
  // duas no mesmo culto — só interessa a quem entrou ou saiu agora
  // (quem já lá estava já passou por esta validação da vez anterior).
  const pessoasAntigas = new Set(snap.exists ? snap.data().pessoas || [] : []);
  const adicionadas = [...pessoas].filter((id) => !pessoasAntigas.has(id));
  const removidas = [...pessoasAntigas].filter((id) => !pessoas.has(id));
  const multiBase = new Set();
  for (const id of new Set([...adicionadas, ...removidas])) {
    if ((await basesDaPessoa(id)).length > 1) multiBase.add(id);
  }
  for (const id of adicionadas) {
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, "tecnica", id);
  }

  await ref.set({
    baseId, liderEscala: liderEscala || null,
    lugares: lugaresLimpos, pessoas: [...pessoas],
  }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, "tecnica", id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, "tecnica", id);
  }
  return { ok: true };
});

/* ── ESCALA (Base de Apoio) ─────────────────────────────────
 * Até agora gravava direto do cliente (setDoc) — nada validava, nem
 * sequer o líder da base. Passa a existir aqui só para poder aplicar
 * a mesma regra da Técnica: quem serve em mais do que uma base não
 * fica escalado nas duas no mesmo culto. Formato desta base é uma
 * lista simples de pessoas, não lugares por ministério. */
export const guardarEscalaApoio = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { eventoId, liderEscala = null, pessoas: pessoasRecebidas } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!Array.isArray(pessoasRecebidas)) throw new HttpsError("invalid-argument", "Faltam as pessoas.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();
  const souLiderBase = req.auth.token.papel === "lider_base";
  const souLiderAtual = snap.exists && snap.data().liderEscala === uid;
  if (!souLiderBase && !souLiderAtual) {
    throw new HttpsError("permission-denied",
      "Só o líder da base ou o líder de escala deste culto pode fazer isto.");
  }

  const pessoas = [...new Set(pessoasRecebidas.filter(Boolean))];

  const pessoasAntigas = new Set(snap.exists ? snap.data().pessoas || [] : []);
  const pessoasNovas = new Set(pessoas);
  const adicionadas = pessoas.filter((id) => !pessoasAntigas.has(id));
  const removidas = [...pessoasAntigas].filter((id) => !pessoasNovas.has(id));
  const multiBase = new Set();
  for (const id of new Set([...adicionadas, ...removidas])) {
    if ((await basesDaPessoa(id)).length > 1) multiBase.add(id);
  }
  for (const id of adicionadas) {
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, "apoio", id);
  }

  await ref.set({ baseId, liderEscala: liderEscala || null, pessoas }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, "apoio", id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, "apoio", id);
  }
  return { ok: true };
});

/* ── FRASE DO LÍDER DE ESCALA ──────────────────────────────
 * O documento do evento é global (a igreja toda) e write:false para o
 * cliente — só assim é que a data e o tipo do culto não podem ser
 * mexidos por engano. A frase passa por aqui por causa disso. */
export const definirFrase = onCall(async (req) => {
  const { eventoId, frase } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  await exigeLiderDoCulto(req, eventoId);
  await db.doc(`eventos/${eventoId}`).set({ frase: String(frase ?? "").trim() }, { merge: true });
  return { ok: true };
});

/* ── FEEDBACK DO CULTO — mesma regra, mesmo motivo ────────── */
export const definirFeedback = onCall(async (req) => {
  const { eventoId, texto } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  const { uid } = await exigeLiderDoCulto(req, eventoId);
  const limpo = String(texto ?? "").trim();
  await db.doc(`eventos/${eventoId}`).set(
    limpo ? { feedback: { texto: limpo, autorUid: uid } } : { feedback: null },
    { merge: true }
  );
  return { ok: true };
});

/* ── ATRIBUIR FUNÇÃO — a regra da data vive aqui ──────────── */
export const atribuirFuncao = onCall(async (req) => {
  const { eventoId, funcaoId, pessoas } = req.data || {};
  if (!eventoId || !funcaoId || !Array.isArray(pessoas)) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const { baseId, uid, escala } = await exigeLiderDoCulto(req, eventoId);

  const naEscala = escala.data().pessoas || [];
  if (pessoas.some((p) => !naEscala.includes(p))) {
    throw new HttpsError("failed-precondition", "Só podes atribuir a quem está escalado.");
  }

  const funcao = await db.doc(`bases/${baseId}/funcoes/${funcaoId}`).get();
  if (!funcao.exists) throw new HttpsError("not-found", "Função não encontrada.");
  // funções especiais só entram no culto a que pertencem
  const dono = funcao.data().eventoId ?? null;
  if (dono && dono !== eventoId) {
    throw new HttpsError("failed-precondition", "Esta função pertence a outro culto.");
  }

  await db.doc(`eventos/${eventoId}/atribuicoes/${funcaoId}`).set({
    baseId, funcaoId, pessoas,
    nomeFuncao: funcao.data().nome,   // cópia: no Firestore não há junções
    atualizadoPor: uid,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/* ── ORDEM DO CULTO: PDF → texto → estrutura ──────────────────
 * A base é o analisador testado contra o PDF real do pastor (ver
 * culto-transcrito.html, na raiz do projeto) — só a origem do texto
 * muda: aqui vem do Storage via pdfjs-dist em vez do <input type=file>
 * do browser. Duas correções vieram de testar com o PDF a sério:
 *   1. o extrator às vezes mete espaços à volta de ':' e '/' dentro
 *      de horas e datas (ex.: "09 : 30") — normalizar() tira-os.
 *   2. o nome de um aviso pode cair na linha A SEGUIR à data, não só
 *      antes dela na mesma linha, quando a célula "Informações" da
 *      grelha quebra em duas linhas.
 * Quando o pastor mudar o modelo do PDF, isto parte — o ecrã de
 * revisão do líder é a rede de segurança, não um extra. */
async function linhasDoPdf(bytes) {
  const pdf = await getDocument({ data: bytes, disableFontFace: true, useSystemFonts: true }).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    const porY = new Map();
    for (const it of conteudo.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);          // agrupa pela altura
      const chave = [...porY.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
      if (!porY.has(chave)) porY.set(chave, []);
      porY.get(chave).push({ x: it.transform[4], s: it.str });
    }
    [...porY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, itens]) => {
      linhas.push(normalizar(itens.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ")
        .replace(/\s+/g, " ").trim()));
    });
  }
  return linhas.filter(Boolean);
}

/** Junta glifos partidos pelo extrator de texto: "09 : 30" → "09:30",
 *  "14 / 08" → "14/08", "sexta - feira" → "sexta-feira". */
function normalizar(linha) {
  return linha
    .replace(/(\d)\s*:\s*(\d)/g, "$1:$2")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
    .replace(/([a-zà-úA-ZÀ-Ú])\s+-\s+([a-zà-úA-ZÀ-Ú])/g, "$1-$2")
    .replace(/\s+,/g, ",");
}

const RESP = /(Pr(?:\.|a\.)?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõçÁÉÍÓÚ.]*|Base\s+[A-Z]\w+|Banda|Projeç[ãa]o|Sonoplastia|Diaconia|Louvor)\s*$/;
const DETALHE = /(Ilumina[çc][ãa]o:\s*.+|TODOS OS VOLUNT[ÁA]RIOS)\s*$/i;
const RUIDO_FIM_AVISO = /\s+((BG|Avisos|Materiais)\s*)+$/i;

function analisar(linhas) {
  const momentos = [], avisos = [];
  let titulo = null, dataFicheiro = null;

  linhas.forEach((linha, i) => {
    const t = linha.match(/ORDEM CULTO ([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)\s*(\d{2}\/\d{2})/i);
    if (t) { titulo = t[1].trim(); dataFicheiro = t[2]; }

    const m = linha.match(/^(\d{1,2}:\d{2})\s+(.+?)\s+(\d+)\s*min\s+(.*)$/);
    if (m) {
      let resto = m[4].trim(), detalhe = null, responsavel = null;
      const d = resto.match(DETALHE);
      if (d) { detalhe = d[1].trim(); resto = resto.slice(0, d.index).trim(); }
      const r = resto.match(RESP);
      if (r) { responsavel = r[1].trim(); resto = resto.slice(0, r.index).trim(); }
      momentos.push({ hora: m[1], momento: m[2].trim(), minutos: +m[3],
        projecao: resto === "-" ? null : resto || null, responsavel, detalhe });
      return;
    }

    const a = linha.match(/(\d{2}\/\d{2})(?:\/\d{4})?[,\s]+(.*)$/);
    if (a && !/^\d{1,2}:\d{2}/.test(linha) && !/min\b/.test(linha)) {
      let nome = linha.slice(0, a.index).trim().replace(/[,\s–-]+$/, "").replace(RUIDO_FIM_AVISO, "").trim();
      let j = i + 1;
      // sem nome antes da data nesta linha? a célula "Evento" da grelha
      // pode ter caído na linha seguinte, não na anterior
      if (!nome) {
        const candidato = linhas[j];
        if (candidato && !/^(Evento|Informa)/i.test(candidato)) {
          nome = candidato.replace(RUIDO_FIM_AVISO, "").trim();
          j++;
        }
      }
      const infoPartes = [a[2]];
      if (linhas[j] && /^(Povo|Casa|Sala)\b/.test(linhas[j]) && infoPartes.join(" ").trim().endsWith("do")) {
        infoPartes.push(linhas[j].split(" ")[0]);
        j++;
      }
      const info = infoPartes.join(" ").replace(RUIDO_FIM_AVISO, "").trim();
      if (nome) avisos.push({ nome, data: a[1], info });
    }
  });

  let fim = null;
  if (momentos.length) {
    const u = momentos.at(-1), [h, mi] = u.hora.split(":").map(Number);
    const t = h * 60 + mi + u.minutos;
    fim = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  return { titulo, dataFicheiro, momentos, avisos, inicio: momentos[0]?.hora ?? null, fim };
}

export const lerOrdemCulto = onCall(async (req) => {
  const { eventoId, caminhoStorage } = req.data || {};
  exigeLider(req);
  if (!eventoId || caminhoStorage !== `eventos/${eventoId}/ordem.pdf`) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  try {
    const [buffer] = await admin.storage().bucket().file(caminhoStorage).download();
    // pdfjs-dist exige um Uint8Array "puro" — um Buffer do Node, mesmo
    // sendo tecnicamente um Uint8Array, é rejeitado pelo teste interno dele
    const r = analisar(await linhasDoPdf(new Uint8Array(buffer)));
    if (!r.momentos.length) return { momentos: [], avisos: [], falhou: true };
    return { ...r, falhou: false };
  } catch (e) {
    logger.error("lerOrdemCulto falhou", e);
    return { momentos: [], avisos: [], falhou: true };
  }
});

/* ── PUBLICAR A ORDEM DO CULTO ─────────────────────────────────
 * eventos/{e} é global e write:false (ver firestore.rules) — por
 * isso passa por aqui, tal como a frase e o feedback. Grava só
 * depois do líder confirmar no ecrã de revisão; nada é automático. */
export const publicarOrdemCulto = onCall(async (req) => {
  exigeLider(req);
  const { eventoId, momentos, avisos, inicio, fim, portasAbertas, pdfUrl, origem } = req.data || {};
  if (!eventoId || !Array.isArray(momentos) || !Array.isArray(avisos)) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const evento = await db.doc(`eventos/${eventoId}`).get();
  if (!evento.exists) throw new HttpsError("not-found", "Culto não encontrado.");
  const ano = evento.data().data.slice(0, 4);

  const criados = [];
  for (const aviso of avisos) {
    if (!aviso?.criarCulto) continue;
    const [dia, mes] = String(aviso.data || "").split("/");
    if (!dia || !mes) continue;
    const id = `${ano}-${mes}-${dia}`;
    const ref = db.doc(`eventos/${id}`);
    if ((await ref.get()).exists) continue;          // nunca sobrescreve
    await ref.set({
      data: id, tipo: aviso.nome, horaCulto: "10:30",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    criados.push({ id, tipo: aviso.nome });
  }

  const avisosLimpos = avisos.map(({ nome, data, info }) => ({ nome, data, info }));
  await db.doc(`eventos/${eventoId}`).set({
    ordem: {
      momentos, avisos: avisosLimpos, inicio: inicio ?? null, fim: fim ?? null,
      portasAbertas: portasAbertas ?? inicio ?? null,
      pdfUrl: pdfUrl ?? null, publicadoPor: req.auth.uid,
      publicadoEm: admin.firestore.FieldValue.serverTimestamp(),
      origem: origem === "manual" ? "manual" : "auto",
    },
  }, { merge: true });

  return { ok: true, cultosEspeciaisCriados: criados };
});

/* ── LIMPAR A ORDEM PUBLICADA ──────────────────────────────────
 * O líder quer recomeçar do zero: tira o PDF do Storage e apaga o
 * campo ordem — volta a ficar "à espera do PDF", como nunca tivesse
 * sido enviado nada. */
export const limparOrdemCulto = onCall(async (req) => {
  exigeLider(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  try {
    await admin.storage().bucket().file(`eventos/${eventoId}/ordem.pdf`).delete();
  } catch (e) {
    if (e.code !== 404) throw e;                      // já não havia ficheiro, tudo bem
  }
  await db.doc(`eventos/${eventoId}`).update({ ordem: admin.firestore.FieldValue.delete() });
  return { ok: true };
});

/* ── DEFINIÇÕES DA BASE ────────────────────────────────────────
 * bases/{b} é write:false para o cliente (ver firestore.rules). */
export const definirBase = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { horaChegada, horaCulto } = req.data || {};
  if (!/^\d{1,2}:\d{2}$/.test(String(horaChegada || "")) || !/^\d{1,2}:\d{2}$/.test(String(horaCulto || ""))) {
    throw new HttpsError("invalid-argument", "Hora inválida.");
  }
  await db.doc(`bases/${baseId}`).set({ horaChegada, horaCulto }, { merge: true });
  return { ok: true };
});

/* ── INVENTÁRIO: LÍDER DA BASE, OU LÍDER DE ESCALA NO DIA DO CULTO DELE ──
 * Criar, editar e desativar itens passa sempre por aqui — só assim é que
 * o líder de escala pode ajudar sem abrir a porta a qualquer voluntário.
 * A quantidade em si continua a mexer-se direto do cliente (ver regras). */
async function exigeGestorInventario(req) {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (req.auth.token.papel === "lider_base") return baseId;

  const hoje = new Date().toISOString().slice(0, 10);
  const escala = await db.doc(`eventos/${hoje}/escalas/${baseId}`).get();
  if (escala.exists && escala.data().liderEscala === uid) return baseId;

  throw new HttpsError("permission-denied",
    "Só o líder da base, ou o líder de escala no dia do culto, pode gerir o inventário.");
}

export const criarItemInventario = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { itemId, nome, categoria, unidade, minimo, quantidade, foto } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o item.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (!categoria?.trim()) throw new HttpsError("invalid-argument", "Falta a categoria.");
  await db.doc(`bases/${baseId}/inventario/${itemId}`).set({
    nome: nome.trim(), categoria: categoria.trim(), unidade: unidade?.trim() || "unidades",
    minimo: Number(minimo) || 0, quantidade: Number(quantidade) || 0, foto: foto ?? null,
    ativo: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { itemId };
});

export const guardarItemInventario = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { itemId, nome, categoria, unidade, minimo, quantidade, foto } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o item.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (!categoria?.trim()) throw new HttpsError("invalid-argument", "Falta a categoria.");
  await db.doc(`bases/${baseId}/inventario/${itemId}`).set({
    nome: nome.trim(), categoria: categoria.trim(), unidade: unidade?.trim() || "unidades",
    minimo: Number(minimo) || 0, quantidade: Number(quantidade) || 0, foto: foto ?? null,
  }, { merge: true });
  return { ok: true };
});

export const desativarItemInventario = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { itemId } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o item.");
  await db.doc(`bases/${baseId}/inventario/${itemId}`).set({ ativo: false }, { merge: true });
  return { ok: true };
});

/* ── GERAR OS DOMINGOS DO ANO ─────────────────────────────── */
export const gerarDomingos = onCall(async (req) => {
  exigeLider(req);
  const { ano = new Date().getFullYear() } = req.data || {};
  const lote = db.batch();
  let criados = 0;
  for (let m = 0; m < 12; m++) {
    const dias = new Date(ano, m + 1, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const data = new Date(Date.UTC(ano, m, d));
      if (data.getUTCDay() !== 0) continue;
      const id = data.toISOString().slice(0, 10);      // 2026-08-02
      lote.set(db.doc(`eventos/${id}`),
        { data: id, tipo: null, horaCulto: "10:30", criadoEm: new Date() }, { merge: true });
      criados++;
    }
  }
  await lote.commit();
  return { criados };
});

/* ── CULTO ESPECIAL (fora dos domingos) ───────────────────── */
export const criarCultoEspecial = onCall(async (req) => {
  exigeLider(req);
  const { data, tipo, horaCulto = "10:30", horaChegada = "08:00" } = req.data || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) {
    throw new HttpsError("invalid-argument", "Data inválida.");
  }
  if (!tipo?.trim()) throw new HttpsError("invalid-argument", "Falta o nome do culto.");

  // o culto é da igreja toda — por isso é a Cloud Function que grava,
  // não uma escrita direta do cliente (ver firestore.rules)
  const ref = db.doc(`eventos/${data}`);
  const snap = await ref.get();
  if (snap.exists) throw new HttpsError("already-exists", "Já existe um culto nesse dia.");

  await ref.set({
    data, tipo: tipo.trim(), horaCulto, horaChegada,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { eventoId: data };
});

/* ── EXCLUIR CULTO ESPECIAL ────────────────────────────────
 * Nada é apagado, é desativado (ver CLAUDE.md) — o evento fica
 * `ativo:false` e some das listagens, mas a escala/ordem já gravadas
 * continuam no histórico. Só cultos especiais (fora dos domingos):
 * os domingos são geridos por `gerarDomingos`, nunca à mão. */
export const excluirCultoEspecial = onCall(async (req) => {
  exigeLider(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const ref = db.doc(`eventos/${eventoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Culto não encontrado.");
  if (!snap.data().tipo) {
    throw new HttpsError("failed-precondition", "Domingos não se excluem — só cultos especiais.");
  }

  await ref.set({ ativo: false }, { merge: true });
  return { ok: true };
});

/* ── WIKI ──────────────────────────────────────────────────
 * Autoria mista (o líder cria esqueletos, qualquer voluntário
 * escreve/edita artigos e responde dúvidas) e todo write tem de
 * recalcular o índice leve de busca — por isso, ao contrário de
 * funcoes/ministerios (escrita direta, só souLiderBase), a Wiki
 * passa sempre por aqui (ver firestore.rules: write:false). */
const cWiki = (baseId) => db.collection(`bases/${baseId}/wiki`);
const refWiki = (baseId, id) => db.doc(`bases/${baseId}/wiki/${id}`);

// texto (sem imagens) de todo o corpo, pra busca encontrar uma frase
// do artigo mesmo que não esteja no título nem nas etiquetas
function textoBuscavelWiki(w) {
  if (w.tipo === "duvida") return w.corpo || "";
  return [w.introducao, w.conclusao, ...(w.passos || []).map((p) => p.texto)].filter(Boolean).join(" ");
}

async function atualizarIndiceWiki(baseId) {
  const snap = await cWiki(baseId).where("ativo", "==", true).get();
  const itens = snap.docs.map((d) => {
    const w = d.data();
    return {
      id: d.id, tipo: w.tipo, titulo: w.titulo,
      ministerios: w.ministerios || [], etiquetas: w.etiquetas || [],
      esqueleto: !!w.esqueleto,
      resolvida: w.tipo === "duvida" ? !!w.resolvidaPorRespostaId : null,
      atualizadoEm: w.atualizadoEm ?? w.criadoEm ?? null,
      texto: textoBuscavelWiki(w),
    };
  });
  await db.doc(`wikiIndice/${baseId}`).set({
    itens, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const criarEsqueletoWiki = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { titulo, ministerios = [] } = req.data || {};
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  const ref = cWiki(baseId).doc();
  await ref.set({
    tipo: "artigo", titulo: titulo.trim(), ministerios, etiquetas: [],
    introducao: "", conclusao: "", passos: [], esqueleto: true, ativo: true,
    autorId: req.auth.uid, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: req.auth.uid,
  });
  await atualizarIndiceWiki(baseId);
  return { wikiId: ref.id };
});

export const guardarArtigoWiki = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { wikiId, titulo, introducao = "", conclusao = "", passos = [], ministerios = [], etiquetas = [] } = req.data || {};
  if (!wikiId) throw new HttpsError("invalid-argument", "Falta o id do artigo.");
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  if (!Array.isArray(passos)) throw new HttpsError("invalid-argument", "Passos inválidos.");
  const passosLimpos = passos
    .map((p) => ({ texto: String(p?.texto || "").trim(), imagem: p?.imagem || null }))
    .filter((p) => p.texto || p.imagem);

  const dados = {
    tipo: "artigo", titulo: titulo.trim(), introducao: introducao.trim(), conclusao: conclusao.trim(),
    passos: passosLimpos, ministerios, etiquetas, esqueleto: false,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: uid,
  };

  // o id vem sempre do cliente (novoWikiId(), o mesmo padrão de
  // novoFuncaoId()) — precisa de existir antes de guardar para as
  // fotos dos passos terem onde apontar. Por isso criar/editar é só
  // "o documento já existia ou não", nunca dois fluxos separados.
  const snap = await refWiki(baseId, wikiId).get();
  if (snap.exists) {
    await refWiki(baseId, wikiId).set(dados, { merge: true });
  } else {
    await refWiki(baseId, wikiId).set({
      ...dados, ativo: true, autorId: uid, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await atualizarIndiceWiki(baseId);
  return { wikiId };
});

export const desativarWiki = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { wikiId } = req.data || {};
  if (!wikiId) throw new HttpsError("invalid-argument", "Falta o artigo.");
  const snap = await refWiki(baseId, wikiId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Não encontrado.");
  if (snap.data().autorId !== uid && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só o líder da base ou quem criou pode excluir.");
  }
  await refWiki(baseId, wikiId).set({ ativo: false }, { merge: true });
  await atualizarIndiceWiki(baseId);
  return { ok: true };
});

export const criarDuvida = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { titulo, corpo = "", ministerios = [] } = req.data || {};
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título da dúvida.");
  const ref = cWiki(baseId).doc();
  await ref.set({
    tipo: "duvida", titulo: titulo.trim(), corpo: corpo.trim(), ministerios, etiquetas: [],
    resolvidaPorRespostaId: null, ativo: true,
    autorId: uid, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: uid,
  });
  await atualizarIndiceWiki(baseId);
  return { wikiId: ref.id };
});

export const responderDuvida = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { wikiId, texto } = req.data || {};
  if (!wikiId || !texto?.trim()) throw new HttpsError("invalid-argument", "Falta o texto da resposta.");
  const snap = await refWiki(baseId, wikiId).get();
  if (!snap.exists || snap.data().tipo !== "duvida") throw new HttpsError("not-found", "Dúvida não encontrada.");
  const ref = refWiki(baseId, wikiId).collection("respostas").doc();
  await ref.set({ texto: texto.trim(), autorId: uid, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
  await refWiki(baseId, wikiId).set({ atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { respostaId: ref.id };
});

export const marcarRespostaCerta = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { wikiId, respostaId } = req.data || {};
  if (!wikiId || !respostaId) throw new HttpsError("invalid-argument", "Faltam dados.");
  const snap = await refWiki(baseId, wikiId).get();
  if (!snap.exists || snap.data().tipo !== "duvida") throw new HttpsError("not-found", "Dúvida não encontrada.");
  const d = snap.data();
  if (d.autorId !== uid && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só quem perguntou (ou o líder da base) marca a resposta certa.");
  }
  const respostaSnap = await refWiki(baseId, wikiId).collection("respostas").doc(respostaId).get();
  if (!respostaSnap.exists) throw new HttpsError("not-found", "Resposta não encontrada.");
  await refWiki(baseId, wikiId).set({
    resolvidaPorRespostaId: respostaId, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await atualizarIndiceWiki(baseId);
  return { ok: true };
});

export const transformarDuvidaEmArtigo = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { wikiId } = req.data || {};
  if (!wikiId) throw new HttpsError("invalid-argument", "Falta a dúvida.");
  const snap = await refWiki(baseId, wikiId).get();
  if (!snap.exists || snap.data().tipo !== "duvida") throw new HttpsError("not-found", "Dúvida não encontrada.");
  const d = snap.data();
  if (d.autorId !== uid && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só quem perguntou (ou o líder da base) transforma em artigo.");
  }
  if (!d.resolvidaPorRespostaId) throw new HttpsError("failed-precondition", "A dúvida ainda não tem resposta certa.");
  const respostaSnap = await refWiki(baseId, wikiId).collection("respostas").doc(d.resolvidaPorRespostaId).get();
  if (!respostaSnap.exists) throw new HttpsError("not-found", "Resposta não encontrada.");
  const resposta = respostaSnap.data();

  await refWiki(baseId, wikiId).set({
    tipo: "artigo", introducao: d.corpo || "", conclusao: "",
    passos: [{ texto: resposta.texto, imagem: null }], esqueleto: false,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: uid,
  }, { merge: true });
  await atualizarIndiceWiki(baseId);
  return { ok: true };
});

/* ── EQUIPAMENTOS (Base Técnica, modo património) ────────────
 * Mesma coleção bases/{b}/inventario que a Apoio usa em modo
 * consumível — nunca colidem porque cada função só é chamada com o
 * baseId de quem pede, e só a Técnica chama estas. Só o líder gere o
 * catálogo (nome, modelo, local, ministério, foto), por isso passa
 * por função como funcoes/ministerios — a diferença é só a foto e o
 * campo `estado`, que aqui vem sempre das Melhorias, nunca à mão. */
const refEquipamento = (baseId, id) => db.doc(`bases/${baseId}/inventario/${id}`);

export const criarEquipamento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId, nome, modelo = "", nSerie = "", local = "", ministerioId = null, foto = null } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  await refEquipamento(baseId, itemId).set({
    nome: nome.trim(), modelo: modelo.trim(), nSerie: nSerie.trim(), local: local.trim(),
    ministerioId, foto, estado: "ok", ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { itemId };
});

export const guardarEquipamento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId, nome, modelo = "", nSerie = "", local = "", ministerioId = null, foto = null } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  await refEquipamento(baseId, itemId).set({
    nome: nome.trim(), modelo: modelo.trim(), nSerie: nSerie.trim(), local: local.trim(),
    ministerioId, foto,
  }, { merge: true });
  return { ok: true };
});

export const desativarEquipamento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  await refEquipamento(baseId, itemId).set({ ativo: false }, { merge: true });
  return { ok: true };
});

/* ── MELHORIAS (Base Técnica) ─────────────────────────────────
 * Autoria mista, como a Wiki: qualquer voluntário reporta, comenta,
 * define a previsão e resolve; só o líder reabre uma melhoria já
 * resolvida. */
const cMelhorias = (baseId) => db.collection(`bases/${baseId}/melhorias`);
const refMelhoria = (baseId, id) => db.doc(`bases/${baseId}/melhorias/${id}`);
const GRAVIDADES = ["impede_culto", "atrapalha", "melhoria"];

export const abrirMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, titulo, descricao = "", foto = null, equipamentoId = null, ministerioId = null, gravidade } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta o id da melhoria.");
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  if (!GRAVIDADES.includes(gravidade)) throw new HttpsError("invalid-argument", "Gravidade inválida.");

  const lote = db.batch();
  const ref = refMelhoria(baseId, melhoriaId);
  lote.set(ref, {
    titulo: titulo.trim(), descricao: descricao.trim(), foto, equipamentoId, ministerioId, gravidade,
    estado: "aberta", previsao: null,
    abertaPor: uid, abertaEm: admin.firestore.FieldValue.serverTimestamp(),
    resolvidaPor: null, resolvidaEm: null, notaResolucao: null, fotoResolucao: null, ativo: true,
  });
  if (equipamentoId) {
    lote.set(refEquipamento(baseId, equipamentoId), { estado: "avariado" }, { merge: true });
  }
  lote.set(ref.collection("eventos").doc(), {
    tipo: "abertura", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(), texto: descricao.trim(),
  });
  await lote.commit();
  return { melhoriaId };
});

async function obterMelhoria(baseId, melhoriaId) {
  const snap = await refMelhoria(baseId, melhoriaId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Melhoria não encontrada.");
  return snap.data();
}

export const comentarMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, texto } = req.data || {};
  if (!melhoriaId || !texto?.trim()) throw new HttpsError("invalid-argument", "Falta o comentário.");
  await obterMelhoria(baseId, melhoriaId);
  const ref = refMelhoria(baseId, melhoriaId);
  await ref.collection("eventos").add({
    tipo: "comentario", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(), texto: texto.trim(),
  });
  return { ok: true };
});

export const definirEstadoMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, estado } = req.data || {};
  if (!["aberta", "em_curso"].includes(estado)) throw new HttpsError("invalid-argument", "Estado inválido.");
  const m = await obterMelhoria(baseId, melhoriaId);
  if (estado === "aberta" && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só o líder da base reabre uma melhoria.");
  }
  if (m.estado === "resolvida" && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só o líder da base reabre uma melhoria resolvida.");
  }
  const ref = refMelhoria(baseId, melhoriaId);
  await ref.set({ estado }, { merge: true });
  await ref.collection("eventos").add({
    tipo: "estado", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(), texto: estado,
  });
  return { ok: true };
});

// Previsão = estimativa de quem está a tratar; qualquer voluntário
// pode ajustar, a qualquer momento.
export const definirPrevisao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, previsao } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta a melhoria.");
  await obterMelhoria(baseId, melhoriaId);
  const ref = refMelhoria(baseId, melhoriaId);
  await ref.set({ previsao: previsao || null }, { merge: true });
  await ref.collection("eventos").add({
    tipo: "previsao", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(), texto: previsao || "removida",
  });
  return { ok: true };
});

export const resolverMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, notaResolucao, fotoResolucao = null } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta a melhoria.");
  if (!notaResolucao?.trim()) throw new HttpsError("invalid-argument", "A nota de resolução é obrigatória.");
  const m = await obterMelhoria(baseId, melhoriaId);

  const lote = db.batch();
  const ref = refMelhoria(baseId, melhoriaId);
  lote.set(ref, {
    estado: "resolvida", resolvidaPor: uid, fotoResolucao,
    resolvidaEm: admin.firestore.FieldValue.serverTimestamp(), notaResolucao: notaResolucao.trim(),
  }, { merge: true });
  if (m.equipamentoId) {
    lote.set(refEquipamento(baseId, m.equipamentoId), { estado: "ok" }, { merge: true });
  }
  lote.set(ref.collection("eventos").doc(), {
    tipo: "resolucao", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(), texto: notaResolucao.trim(),
  });
  await lote.commit();
  return { ok: true };
});

export const transformarMelhoriaEmArtigoWiki = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta a melhoria.");
  const m = await obterMelhoria(baseId, melhoriaId);
  if (m.estado !== "resolvida") throw new HttpsError("failed-precondition", "A melhoria ainda não está resolvida.");

  const eventosSnap = await refMelhoria(baseId, melhoriaId).collection("eventos").orderBy("quando").get();
  const passos = eventosSnap.docs
    .filter((d) => d.data().texto)
    .map((d) => ({ texto: d.data().texto, imagem: null }));
  if (m.foto && passos.length) passos[0].imagem = m.foto; // a foto da abertura vira a do primeiro passo
  if (m.fotoResolucao && passos.length) passos[passos.length - 1].imagem = m.fotoResolucao; // idem para a de resolução

  const wikiRef = cWiki(baseId).doc();
  await wikiRef.set({
    tipo: "artigo", titulo: m.titulo, introducao: m.descricao || "", conclusao: m.notaResolucao || "",
    passos, ministerios: m.ministerioId ? [m.ministerioId] : [], etiquetas: [],
    esqueleto: false, ativo: true,
    autorId: uid, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: uid,
  });
  await atualizarIndiceWiki(baseId);
  return { wikiId: wikiRef.id };
});

export const desativarMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta a melhoria.");
  const m = await obterMelhoria(baseId, melhoriaId);
  if (m.abertaPor !== uid && req.auth.token.papel !== "lider_base") {
    throw new HttpsError("permission-denied", "Só o líder da base ou quem abriu pode excluir.");
  }
  await refMelhoria(baseId, melhoriaId).set({ ativo: false }, { merge: true });
  return { ok: true };
});

/* ── ENQUETES DE INDISPONIBILIDADE (Base Técnica) ─────────────
 * Um documento por mês (AAAA-MM). Voto privado: cada voluntário só
 * lê a própria resposta, o líder vê o conjunto (ver firestore.rules).
 * O sugestor de escala corre depois disto fechar — nunca publica
 * sozinho, só propõe. */
const refEnquete = (baseId, mes) => db.doc(`bases/${baseId}/enquetes/${mes}`);
const MES_RE = /^\d{4}-\d{2}$/;

// respostas são do voto daquela enquete específica — ao excluir ou
// reabrir do zero, não pode sobrar resposta antiga a fingir de nova
async function apagarRespostas(baseId, mes) {
  const snap = await refEnquete(baseId, mes).collection("respostas").get();
  if (snap.empty) return;
  const lote = db.batch();
  snap.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
}

export const abrirEnquete = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { mes, prazo, domingos = [] } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(prazo || ""))) throw new HttpsError("invalid-argument", "Falta o prazo.");
  if (!Array.isArray(domingos) || !domingos.length) throw new HttpsError("invalid-argument", "Falta pelo menos um domingo.");

  // o mês (AAAA-MM) é o próprio id do documento — se já existiu uma
  // enquete excluída ou fechada nesse mês, esta abertura é uma enquete
  // nova de verdade, não uma continuação: sem respostas antigas
  await apagarRespostas(baseId, mes);
  await refEnquete(baseId, mes).set({
    estado: "aberta", prazo, domingos, ativo: true, escalaPublicada: false,
    abertaPor: req.auth.uid, abertaEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { mes };
});

export const fecharEnquete = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { mes } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  const ref = refEnquete(baseId, mes);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Enquete não encontrada.");
  await ref.set({ estado: "fechada", fechadaEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const reabrirEnquete = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { mes } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  const ref = refEnquete(baseId, mes);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Enquete não encontrada.");
  await ref.set({ estado: "aberta" }, { merge: true });
  return { ok: true };
});

// A enquete continua visível no Montar (com "Fechar" trocado por um
// cadeado) até o líder publicar a escala sugerida a partir dela — só
// aí some, para não perder de vista o que ainda falta montar.
export const marcarEscalaPublicada = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { mes } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  const ref = refEnquete(baseId, mes);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Enquete não encontrada.");
  await ref.set({ escalaPublicada: true, escalaPublicadaEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

// O documento da enquete em si segue a regra "nada é apagado, é
// desativado" (ativo:false, ver CLAUDE.md) — mas as respostas são o
// voto de cada pessoa NAQUELA enquete: excluídas de verdade junto,
// senão reaparecem sozinhas como "já respondeu" se o mês for reaberto.
export const excluirEnquete = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { mes } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  const ref = refEnquete(baseId, mes);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Enquete não encontrada.");
  await apagarRespostas(baseId, mes);
  await ref.set({ ativo: false }, { merge: true });
  return { ok: true };
});

export const responderEnquete = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { mes, indisponivelEm = [], semIndisponibilidade = false, nota = "" } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  if (!Array.isArray(indisponivelEm)) throw new HttpsError("invalid-argument", "Indisponibilidade inválida.");
  if (!semIndisponibilidade && !indisponivelEm.length) {
    throw new HttpsError("invalid-argument", "Marca as datas ou diz que não tens indisponibilidades.");
  }
  const enquete = await refEnquete(baseId, mes).get();
  if (!enquete.exists || enquete.data().ativo === false) throw new HttpsError("not-found", "Enquete não encontrada.");
  if (enquete.data().estado !== "aberta") throw new HttpsError("failed-precondition", "Esta enquete já está fechada.");

  await refEnquete(baseId, mes).collection("respostas").doc(uid).set({
    indisponivelEm: semIndisponibilidade ? [] : indisponivelEm,
    semIndisponibilidade: !!semIndisponibilidade,
    nota: nota.trim(),
    respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
