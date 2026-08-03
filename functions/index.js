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

admin.initializeApp();
const db = admin.firestore();

// Portugal → o datacenter mais próximo. Poupa ~80ms por chamada.
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

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
const refSegredo = (b, p) => db.doc(`bases/${b}/pessoas/${p}/privado/auth`);

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
  return {
    base: { nome: b.nome, horaChegada: b.horaChegada, horaCulto: b.horaCulto, local: b.local },
    pessoas: pessoasSnap.docs.map((d) => {
      const p = d.data();
      return { id: d.id, nome: p.nome, papel: p.papel, foto: p.foto ?? null };
    }),
  };
});

/* ── ENTRAR ───────────────────────────────────────────────── */
export const entrar = onCall(async (req) => {
  const { baseId, pessoaId, pin } = req.data || {};
  if (!baseId || !pessoaId || !/^\d{4,6}$/.test(String(pin || ""))) {
    throw new HttpsError("invalid-argument", "Dados de entrada inválidos.");
  }

  const segredoRef = refSegredo(baseId, pessoaId);
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

  const ref = refSegredo(baseId, uid);
  const snap = await ref.get();
  if (!snap.exists || !confere(String(pinAtual), snap.data().pinHash)) {
    throw new HttpsError("permission-denied", "O código atual não está certo.");
  }
  await ref.set({ pinHash: hash(String(pinNovo)), provisorio: false, falhas: 0 }, { merge: true });
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
  const { nome, telefone = "", papel = "voluntario" } = req.data || {};
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");

  const provisorio = pinProvisorio(papel);
  const ref = db.collection(`bases/${baseId}/pessoas`).doc();
  await ref.set({
    nome: nome.trim(), telefone, papel, ativo: true, foto: null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await refSegredo(baseId, ref.id).set({
    pinHash: hash(provisorio), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  });
  // devolvido UMA vez, para o líder dizer à pessoa. Nunca mais fica legível.
  return { pessoaId: ref.id, pinProvisorio: provisorio };
});

export const reporPin = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { pessoaId } = req.data || {};
  const snap = await refPessoa(baseId, pessoaId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Voluntário não encontrado.");
  const provisorio = pinProvisorio(snap.data().papel);
  await refSegredo(baseId, pessoaId).set({
    pinHash: hash(provisorio), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  }, { merge: true });
  return { pinProvisorio: provisorio };
});

export const removerVoluntario = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { pessoaId } = req.data || {};
  if (pessoaId === req.auth.uid) {
    throw new HttpsError("failed-precondition", "Não te podes remover a ti próprio.");
  }
  // desativar, não apagar: o histórico dos domingos passados depende disto
  await refPessoa(baseId, pessoaId).set({ ativo: false }, { merge: true });
  await refSegredo(baseId, pessoaId).delete();

  const escalas = await db.collectionGroup("escalas")
    .where("pessoas", "array-contains", pessoaId).get();
  const lote = db.batch();
  escalas.forEach((d) => {
    if (d.id !== baseId) return;
    lote.update(d.ref, {
      pessoas: admin.firestore.FieldValue.arrayRemove(pessoaId),
      liderEscala: d.data().liderEscala === pessoaId ? null : d.data().liderEscala,
    });
  });
  await lote.commit();
  return { ok: true };
});

/* ── ATRIBUIR FUNÇÃO — a regra da data vive aqui ──────────── */
export const atribuirFuncao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { eventoId, funcaoId, pessoas } = req.data || {};
  if (!eventoId || !funcaoId || !Array.isArray(pessoas)) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }

  const escala = await db.doc(`eventos/${eventoId}/escalas/${baseId}`).get();
  if (!escala.exists) throw new HttpsError("not-found", "Este culto não tem escala.");

  const souLiderBase = req.auth.token.papel === "lider_base";
  const souLiderEscala = escala.data().liderEscala === uid;

  // ESTA é a regra toda: o líder de escala só manda no dia dele
  if (!souLiderBase && !souLiderEscala) {
    throw new HttpsError("permission-denied",
      "Só o líder de escala deste culto distribui as funções.");
  }
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
