/**
 * Base Kinder — famílias, crianças e check-in (paridade com o My Kids,
 * a app que o Kinder usava antes; ver apps/kinder/CLAUDE.md).
 *
 * Porque é que isto é tudo Cloud Function e nada é escrita direta:
 *   1. São dados de menores — e de saúde (alergias). As regras só
 *      deixam LER à própria base; escrever passa sempre por aqui,
 *      validado, com `undefined` impossível de chegar ao Firestore.
 *   2. Os pais não têm conta. O registo (/registo, QR na porta) e o
 *      link da família (/familia/<token>) chamam isto SEM sessão — o
 *      token é o único segredo, e só o hash dele fica guardado (quem
 *      lê o Firestore não consegue reconstruir o link de ninguém).
 *   3. O código de levantamento tem de ser único no culto — só o
 *      servidor o garante (transação).
 *
 * `baseId` é sempre "kinder", fixo: nenhuma outra base tem isto, e
 * aceitar a base do cliente nas funções públicas (sem token) abriria
 * escrita em `bases/<qualquer>/familias`.
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { createHash, randomBytes, randomInt } from "node:crypto";

const BASE = "kinder";
export const CATEGORIAS_KINDER = ["baby", "fun", "junior"];
const PAPEIS_LIDER = new Set(["lider_base", "auxiliar"]);
// sem 0/O nem 1/I/L — o código é lido em voz alta à porta, com pressa
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 4;
// idades por omissão — a líder muda em Painel → Definições
// (bases/kinder/definicoes/categorias), só servem para SUGERIR a sala
const FAIXAS_PADRAO = { baby: { min: 0, max: 3 }, fun: { min: 4, max: 7 }, junior: { min: 8, max: 11 } };
// por IP e por hora. Alto de propósito: ao domingo as famílias todas
// registam-se pela mesma rede da Casa do Povo, que é um IP só.
const MAX_REGISTOS_POR_HORA = 40;
const HORA_MS = 60 * 60 * 1000;

// Texto provisório — tem de ser revisto pela igreja antes de ir para
// os pais a sério (a líder substitui em Painel → Definições, e cada
// alteração sobe a versão guardada em cada família).
const CONSENTIMENTO_PADRAO =
  "Autorizo a Igreja Onda a guardar os dados desta ficha (nomes, datas de nascimento, " +
  "contactos, alergias e cuidados de saúde) para acolher as crianças no Kinder durante os " +
  "cultos e para me contactar se for preciso. Os dados só são vistos pelos voluntários do " +
  "Kinder, nunca são partilhados fora da igreja e são apagados se a criança não vier durante " +
  "um ano. Posso pedir para os corrigir ou apagar a qualquer momento.";

const db = () => admin.firestore();
const agora = () => admin.firestore.FieldValue.serverTimestamp();
const col = (nome) => db().collection(`bases/${BASE}/${nome}`);
const refFamilia = (id) => db().doc(`bases/${BASE}/familias/${id}`);
const refCrianca = (id) => db().doc(`bases/${BASE}/criancas/${id}`);
const refCheckin = (ev, criancaId) => db().doc(`eventos/${ev}/checkinKinder/${criancaId}`);
const refCodigo = (ev, familiaId) => db().doc(`eventos/${ev}/codigosKinder/${familiaId}`);
const hashToken = (t) => createHash("sha256").update(String(t)).digest("hex");
const ms = (ts) => ts?.toMillis?.() ?? null;

/** Mesma função de functions/index.js — duplicada em vez de importada
 *  porque o index importa este ficheiro (evita import circular). */
function hojeEmLisboa() {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function exigeKinder(req) {
  const uid = req.auth?.uid;
  if (!uid || req.auth.token?.baseId !== BASE) {
    throw new HttpsError("permission-denied", "Só a Base Kinder pode fazer isto.");
  }
  return uid;
}
const souLider = (req) => PAPEIS_LIDER.has(req.auth?.token?.papel);

const texto = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const textoLongo = (v) => String(v ?? "").trim().slice(0, 500);
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const soDigitos = (t) => String(t ?? "").replace(/\D/g, "");

function limparPessoas(lista, max, exigeTelefone) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, max)
    .map((p) => ({ nome: texto(p?.nome), telefone: texto(p?.telefone, 30), parentesco: texto(p?.parentesco, 40) }))
    .filter((p) => p.nome && (!exigeTelefone || soDigitos(p.telefone).length >= 9));
}

/** Idade em anos completos, contas em datas locais (nunca toISOString —
 *  em UTC+ desvia um dia, bug já visto noutras bases). */
function idade(dataNascimento, hojeISO) {
  const [a, m, d] = dataNascimento.split("-").map(Number);
  const [ha, hm, hd] = hojeISO.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

function categoriaPorIdade(dataNascimento, faixas) {
  const anos = idade(dataNascimento, hojeEmLisboa());
  return CATEGORIAS_KINDER.find((c) => anos >= faixas[c].min && anos <= faixas[c].max) ?? null;
}

async function lerFaixas() {
  const s = await db().doc(`bases/${BASE}/definicoes/categorias`).get();
  const f = s.exists ? s.data().faixas || {} : {};
  return Object.fromEntries(CATEGORIAS_KINDER.map((c) => [c, { ...FAIXAS_PADRAO[c], ...(f[c] || {}) }]));
}

/** `categoriaDada` só é respeitada quando vem de um voluntário — os
 *  pais não escolhem a sala, fica a sugerida pela idade (ou a que o
 *  Kinder já lhe tinha dado). */
function limparCrianca(c, faixas, categoriaDada) {
  const nome = texto(c?.nome);
  if (!nome) throw new HttpsError("invalid-argument", "Falta o nome de uma criança.");
  const dataNascimento = DATA_RE.test(c?.dataNascimento || "") ? c.dataNascimento : null;
  if (!dataNascimento) throw new HttpsError("invalid-argument", `Falta a data de nascimento de ${nome}.`);
  const categoria = CATEGORIAS_KINDER.includes(categoriaDada)
    ? categoriaDada
    : categoriaPorIdade(dataNascimento, faixas);
  return {
    nome, dataNascimento, categoria,
    alergias: textoLongo(c?.alergias),
    restricoesAlimentares: textoLongo(c?.restricoesAlimentares),
    necessidades: textoLongo(c?.necessidades),
  };
}

async function limitarRegistoPublico(req) {
  const ip = req.rawRequest?.ip || req.rawRequest?.headers?.["x-forwarded-for"] || "desconhecido";
  const ref = db().doc(`bases/${BASE}/limitesRegisto/${hashToken(ip).slice(0, 32)}`);
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const agoraMs = Date.now();
    const d = s.exists ? s.data() : null;
    const naJanela = d && agoraMs - d.inicioMs < HORA_MS;
    const contagem = naJanela ? d.contagem + 1 : 1;
    if (contagem > MAX_REGISTOS_POR_HORA) {
      throw new HttpsError("resource-exhausted",
        "Demasiados registos seguidos. Pede ajuda a um voluntário na receção do Kinder.");
    }
    tx.set(ref, { inicioMs: naJanela ? d.inicioMs : agoraMs, contagem });
  });
}

async function familiaPorToken(token) {
  if (!token || String(token).length < 16) throw new HttpsError("not-found", "Link inválido.");
  const snap = await col("familias").where("tokenHash", "==", hashToken(token)).limit(1).get();
  const doc = snap.docs[0];
  if (!doc || doc.data().ativo === false) throw new HttpsError("not-found", "Link inválido.");
  return doc;
}

async function criancasDaFamilia(familiaId) {
  const snap = await col("criancas").where("familiaId", "==", familiaId).get();
  return snap.docs.filter((d) => d.data().ativo !== false);
}

/* ── REGISTO ──────────────────────────────────────────────────── */

/** Texto do consentimento e faixas etárias — o formulário público
 *  precisa disto antes de haver sessão nenhuma. Nada sensível. */
export const dadosRegistoKinder = onCall(async () => {
  const [faixas, cons] = await Promise.all([
    lerFaixas(),
    db().doc(`bases/${BASE}/definicoes/consentimento`).get(),
  ]);
  const c = cons.exists ? cons.data() : {};
  return {
    faixas,
    consentimento: { texto: c.texto || CONSENTIMENTO_PADRAO, versao: c.versao || "rascunho-1" },
  };
});

/** Duas portas de entrada, a mesma função:
 *   - pais pelo QR (sem sessão) → família `pendente`, confirmada à porta
 *     no primeiro check-in;
 *   - voluntário na receção (sessão da Kinder) → já `confirmada`.
 *  Devolve o token do link da família UMA vez — não fica legível em
 *  lado nenhum depois (só o hash). */
export const registarFamiliaKinder = onCall(async (req) => {
  const voluntario = req.auth?.token?.baseId === BASE ? req.auth.uid : null;
  const d = req.data || {};
  if (d.consentimento?.aceite !== true) {
    throw new HttpsError("invalid-argument", "Falta aceitar o consentimento.");
  }
  const responsaveis = limparPessoas(d.responsaveis, 4, true);
  if (!responsaveis.length) {
    throw new HttpsError("invalid-argument", "Falta pelo menos um responsável com telemóvel.");
  }
  if (!Array.isArray(d.criancas) || !d.criancas.length) {
    throw new HttpsError("invalid-argument", "Falta pelo menos uma criança.");
  }
  if (d.criancas.length > 8) throw new HttpsError("invalid-argument", "No máximo 8 crianças por família.");
  const faixas = await lerFaixas();
  const criancas = d.criancas.map((c) => limparCrianca(c, faixas, voluntario ? c?.categoria : null));
  if (!voluntario) await limitarRegistoPublico(req);

  const token = randomBytes(18).toString("base64url");
  const familiaRef = col("familias").doc();
  const lote = db().batch();
  lote.set(familiaRef, {
    responsaveis,
    autorizados: limparPessoas(d.autorizados, 6, false),
    telefones: responsaveis.map((r) => soDigitos(r.telefone)),
    fotoAutorizada: d.fotoAutorizada === true,
    visitante: d.visitante === true,
    consentimento: {
      versao: texto(d.consentimento.versao, 30) || "rascunho-1",
      aceiteEm: agora(),
      origem: voluntario ? `voluntario:${voluntario}` : "qr",
    },
    estado: voluntario ? "confirmada" : "pendente",
    tokenHash: hashToken(token),
    ativo: true,
    criadoEm: agora(),
    criadoPor: voluntario,
  });
  for (const c of criancas) {
    lote.set(col("criancas").doc(), { ...c, familiaId: familiaRef.id, ativo: true, criadoEm: agora() });
  }
  await lote.commit();
  return { token, familiaId: familiaRef.id };
});

/** Pais perderam o link (trocaram de telemóvel…): um voluntário gera
 *  outro. O antigo deixa de funcionar na hora. */
export const novoLinkFamiliaKinder = onCall(async (req) => {
  exigeKinder(req);
  const { familiaId } = req.data || {};
  const snap = familiaId ? await refFamilia(familiaId).get() : null;
  if (!snap?.exists) throw new HttpsError("not-found", "Família não encontrada.");
  const token = randomBytes(18).toString("base64url");
  await snap.ref.update({ tokenHash: hashToken(token), linkRenovadoEm: agora() });
  return { token };
});

export const confirmarFamiliaKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const { familiaId } = req.data || {};
  const snap = familiaId ? await refFamilia(familiaId).get() : null;
  if (!snap?.exists) throw new HttpsError("not-found", "Família não encontrada.");
  await snap.ref.update({ estado: "confirmada", confirmadaPor: uid, confirmadaEm: agora() });
  return { ok: true };
});

/** "Nada é apagado, é desativado" (regra 5) — a anonimização por
 *  retenção (RGPD) é outra coisa, ainda por fechar com a igreja. */
export const desativarFamiliaKinder = onCall(async (req) => {
  exigeKinder(req);
  if (!souLider(req)) throw new HttpsError("permission-denied", "Só uma líder pode remover uma família.");
  const { familiaId } = req.data || {};
  const snap = familiaId ? await refFamilia(familiaId).get() : null;
  if (!snap?.exists) throw new HttpsError("not-found", "Família não encontrada.");
  const lote = db().batch();
  lote.update(snap.ref, { ativo: false, desativadaEm: agora() });
  (await criancasDaFamilia(familiaId)).forEach((c) => lote.update(c.ref, { ativo: false }));
  await lote.commit();
  return { ok: true };
});

/** Editar a ficha — pelos pais (com o token do link) ou por um
 *  voluntário (sessão da Kinder, com `familiaId`). `criancas` traz as
 *  que ficam (com `id` = já existia, sem `id` = nova); `removidas` são
 *  ids a desativar. Uma criança de outra família nunca é tocada. */
export const editarFamiliaKinder = onCall(async (req) => {
  const d = req.data || {};
  let familiaSnap;
  if (d.token) {
    familiaSnap = await familiaPorToken(d.token);
  } else {
    exigeKinder(req);
    familiaSnap = d.familiaId ? await refFamilia(d.familiaId).get() : null;
    if (!familiaSnap?.exists) throw new HttpsError("not-found", "Família não encontrada.");
  }
  const pelosPais = !!d.token;
  const familiaId = familiaSnap.id;
  const responsaveis = limparPessoas(d.responsaveis, 4, true);
  if (!responsaveis.length) {
    throw new HttpsError("invalid-argument", "Falta pelo menos um responsável com telemóvel.");
  }
  const faixas = await lerFaixas();
  const existentes = new Map((await criancasDaFamilia(familiaId)).map((c) => [c.id, c]));
  const lote = db().batch();
  lote.update(familiaSnap.ref, {
    responsaveis,
    autorizados: limparPessoas(d.autorizados, 6, false),
    telefones: responsaveis.map((r) => soDigitos(r.telefone)),
    fotoAutorizada: d.fotoAutorizada === true,
    atualizadoEm: agora(),
    atualizadoPor: req.auth?.uid ?? "familia",
  });
  const lista = Array.isArray(d.criancas) ? d.criancas.slice(0, 8) : [];
  for (const c of lista) {
    const atual = c?.id ? existentes.get(c.id) : null;
    if (c?.id && !atual) continue;
    const categoriaDada = pelosPais ? atual?.data().categoria : c?.categoria;
    const limpa = limparCrianca(c, faixas, categoriaDada);
    if (atual) lote.update(atual.ref, { ...limpa, atualizadoEm: agora() });
    else lote.set(col("criancas").doc(), { ...limpa, familiaId, ativo: true, criadoEm: agora() });
  }
  for (const id of Array.isArray(d.removidas) ? d.removidas : []) {
    const atual = existentes.get(id);
    if (atual) lote.update(atual.ref, { ativo: false });
  }
  await lote.commit();
  return { ok: true };
});

/** O link da família: o que os pais veem, sem conta. Só dados desta
 *  família — nunca de outra, nunca quem são os voluntários. */
export const dadosFamiliaKinder = onCall(async (req) => {
  const fam = await familiaPorToken(req.data?.token);
  const f = fam.data();
  const criancas = (await criancasDaFamilia(fam.id)).map((c) => ({ id: c.id, ...c.data() }));
  const hoje = hojeEmLisboa();
  const [checkins, codigoSnap, licoesSnap] = await Promise.all([
    Promise.all(criancas.map((c) => refCheckin(hoje, c.id).get())),
    refCodigo(hoje, fam.id).get(),
    col("licoes").orderBy("criadoEm", "desc").limit(20).get(),
  ]);
  const categorias = new Set(criancas.map((c) => c.categoria).filter(Boolean));
  const licoes = licoesSnap.docs
    .map((l) => ({ id: l.id, ...l.data() }))
    .filter((l) => l.resumoPais && (l.categorias || []).some((c) => categorias.has(c)))
    .slice(0, 3)
    .map((l) => ({ id: l.id, titulo: l.titulo, resumoPais: l.resumoPais, categorias: l.categorias, criadoEm: ms(l.criadoEm) }));

  return {
    familiaId: fam.id,
    estado: f.estado,
    responsaveis: f.responsaveis || [],
    autorizados: f.autorizados || [],
    fotoAutorizada: f.fotoAutorizada === true,
    criancas: criancas.map((c) => ({
      id: c.id, nome: c.nome, dataNascimento: c.dataNascimento, categoria: c.categoria ?? null,
      alergias: c.alergias || "", restricoesAlimentares: c.restricoesAlimentares || "", necessidades: c.necessidades || "",
    })),
    hoje: {
      eventoId: hoje,
      codigo: codigoSnap.exists ? codigoSnap.data().codigo : null,
      checkins: Object.fromEntries(checkins.filter((s) => s.exists && !s.data().anulado).map((s) => [
        s.id, { entradaEm: ms(s.data().entradaEm), saidaEm: ms(s.data().saidaEm), levantadoPor: s.data().levantadoPor ?? null },
      ])),
    },
    licoes,
  };
});

/* ── CHECK-IN / SAÍDA ─────────────────────────────────────────── */

function gerarCodigo() {
  let c = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) c += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return c;
}

/** Entrada de uma ou mais crianças (irmãos entram juntos). Um código
 *  por FAMÍLIA por culto — quem vem buscar os três irmãos diz um
 *  código só. Idempotente: quem já está na sala fica como está.
 *  Uma família `pendente` (registo pelo QR) fica confirmada aqui — o
 *  voluntário acabou de a ver à porta. */
export const checkinKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const ids = [...new Set((req.data?.criancaIds || []).filter((x) => typeof x === "string"))].slice(0, 12);
  if (!ids.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma criança.");
  const eventoId = hojeEmLisboa();
  if (!(await db().doc(`eventos/${eventoId}`).get()).exists) {
    throw new HttpsError("failed-precondition", "Hoje não há culto marcado — o check-in só abre em dia de culto.");
  }
  const snaps = await Promise.all(ids.map((id) => refCrianca(id).get()));
  const criancas = snaps.map((s) => {
    if (!s.exists || s.data().ativo === false) throw new HttpsError("not-found", "Criança não encontrada.");
    return { id: s.id, ...s.data() };
  });
  const familias = [...new Set(criancas.map((c) => c.familiaId))];
  const codigos = {};

  await db().runTransaction(async (tx) => {
    const [todos, checkinSnaps, famSnaps] = await Promise.all([
      tx.get(db().collection(`eventos/${eventoId}/codigosKinder`)),
      Promise.all(criancas.map((c) => tx.get(refCheckin(eventoId, c.id)))),
      Promise.all(familias.map((f) => tx.get(refFamilia(f)))),
    ]);
    const usados = new Set(todos.docs.map((d) => d.data().codigo));
    const existentes = Object.fromEntries(todos.docs.map((d) => [d.id, d.data().codigo]));
    for (const f of familias) {
      if (existentes[f]) { codigos[f] = existentes[f]; continue; }
      let codigo;
      do { codigo = gerarCodigo(); } while (usados.has(codigo));
      usados.add(codigo);
      codigos[f] = codigo;
      tx.set(refCodigo(eventoId, f), { codigo, familiaId: f, criadoEm: agora() });
    }
    criancas.forEach((c, i) => {
      const atual = checkinSnaps[i].exists ? checkinSnaps[i].data() : null;
      if (atual && !atual.saidaEm && !atual.anulado) return;
      tx.set(refCheckin(eventoId, c.id), {
        criancaId: c.id, familiaId: c.familiaId, nome: c.nome, categoria: c.categoria ?? null,
        codigo: codigos[c.familiaId],
        entradaEm: agora(), entradaPor: uid,
        saidaEm: null, saidaPor: null, levantadoPor: null, saidaForcada: null,
        anulado: false,
      });
    });
    famSnaps.forEach((s) => {
      if (s.exists && s.data().estado === "pendente") {
        tx.update(s.ref, { estado: "confirmada", confirmadaPor: uid, confirmadaEm: agora() });
      }
    });
  });
  return { eventoId, codigos };
});

/** Saída: o código tem de bater certo. Sem código, só uma líder, e
 *  com o motivo registado (ex.: "avó autorizada, telemóvel sem
 *  bateria") — o My Kids também deixa, mas nunca em silêncio. */
export const checkoutKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const { criancaIds, codigo, levantadoPor, motivo } = req.data || {};
  const ids = [...new Set((criancaIds || []).filter((x) => typeof x === "string"))].slice(0, 12);
  if (!ids.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma criança.");
  const quem = texto(levantadoPor);
  if (!quem) throw new HttpsError("invalid-argument", "Diz quem veio buscar.");
  const forcado = !texto(codigo);
  if (forcado) {
    if (!souLider(req)) throw new HttpsError("permission-denied", "Sem código, só uma líder pode dar a saída.");
    if (!texto(motivo)) throw new HttpsError("invalid-argument", "Diz porque sai sem código.");
  }
  const eventoId = hojeEmLisboa();
  const snaps = await Promise.all(ids.map((id) => refCheckin(eventoId, id).get()));
  const lote = db().batch();
  let saidas = 0;
  for (const s of snaps) {
    if (!s.exists || s.data().anulado) throw new HttpsError("failed-precondition", "Esta criança não fez check-in hoje.");
    const c = s.data();
    if (c.saidaEm) continue;
    if (!forcado && texto(codigo).toUpperCase() !== c.codigo) {
      throw new HttpsError("permission-denied", "O código não confere.");
    }
    lote.update(s.ref, {
      saidaEm: agora(), saidaPor: uid, levantadoPor: quem,
      saidaForcada: forcado ? { motivo: texto(motivo, 200), por: uid } : null,
    });
    saidas++;
  }
  await lote.commit();
  return { saidas };
});

/** Check-in feito por engano (criança errada, toque a mais). Fica no
 *  histórico como anulado em vez de desaparecer. */
export const anularCheckinKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const { criancaId } = req.data || {};
  const snap = criancaId ? await refCheckin(hojeEmLisboa(), criancaId).get() : null;
  if (!snap?.exists) throw new HttpsError("not-found", "Não há check-in desta criança hoje.");
  if (!souLider(req) && snap.data().entradaPor !== uid) {
    throw new HttpsError("permission-denied", "Só quem fez o check-in, ou uma líder, pode anulá-lo.");
  }
  await snap.ref.update({ anulado: true, anuladoPor: uid, anuladoEm: agora() });
  return { ok: true };
});
