/**
 * Mural Onda — anúncios de "ofereço" (venda, doação, arrendamento,
 * emprego) e "procuro" (pedidos), para a igreja toda, não uma base
 * (ver apps/mural/CLAUDE.md). Ficheiro próprio, no mesmo espírito de
 * kinder.js — não afogar index.js com um domínio inteiro à parte.
 *
 * Porque é que a entrada não é só uma função nova:
 *   Quem já é voluntário nalguma base entra pelo caminho de sempre —
 *   o próprio ecrã de entrada do Mural mostra a grelha de bases e, a
 *   seguir, os rostos (mesmas `dadosEntrada`/`entrar` de
 *   functions/index.js, mesmo PIN global — regra 2 do CLAUDE.md
 *   raiz). Nada de novo a construir aí: o token que sai de `entrar`
 *   já serve para publicar no Mural, porque as funções abaixo só
 *   olham para `req.auth.uid`, nunca para baseId/papel.
 *   Quem NUNCA foi voluntário não tem base nenhuma para escolher —
 *   por isso só para essas pessoas é que existe um caminho próprio:
 *   telemóvel + PIN, com uma identidade global nova
 *   (`pessoas/tel_<telefone>`, nunca um nome cru — regra 9 do
 *   CLAUDE.md raiz: aqui não há sequer nome no id, é o telefone).
 *
 * Porque é que os anúncios não são escrita direta do cliente:
 *   Limite de 5 anúncios ativos por pessoa, expiração a 30 dias,
 *   autoria (nome/foto/base ou GD) — nada disto dá para garantir só
 *   com Regras do Firestore (regra 3 do CLAUDE.md raiz).
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const db = () => admin.firestore();

const MAX_1 = 3;                  // tentativas antes do bloqueio — igual ao `entrar` de sempre
const MAX_2 = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const MAX_ATIVOS_POR_PESSOA = 5;  // regra combinada com o dono do produto, 2026-09
const DIAS_ATE_EXPIRAR = 30;
const DIAS_AVISO_ANTES_DE_EXPIRAR = 2;

const TIPOS = new Set(["ofereco", "procuro"]);
const CATEGORIAS = {
  ofereco: new Set(["venda", "doacao", "arrendamento", "emprego", "outros"]),
  procuro: new Set(["objetos", "servicos", "boleias", "emprego", "outros"]),
};
const REGIOES = new Set(["norte", "lisboa", "sines"]);
const ESTADOS = new Set(["disponivel", "reservado", "vendido"]);

/* ── hash do PIN — mesmo scrypt do `entrar` em functions/index.js
 * (duplicado aqui, não importado: mural.js fica lido de ponta a
 * ponta sem saltar para outro ficheiro, como kinder.js). ──────── */
function hash(pin) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
}
function confere(pin, guardado) {
  const [sal, esperado] = String(guardado || "").split(":");
  if (!sal || !esperado) return false;
  const a = Buffer.from(esperado, "hex");
  const b = scryptSync(pin, sal, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const refGlobal = (p) => db().doc(`pessoas/${p}`);
const refSegredo = (p) => db().doc(`pessoas/${p}/privado/auth`);
const refAdminMural = (uid) => db().doc(`config/muralAdmins/${uid}`);

/** "Apoio" → "Base Apoio"; "Base Louvor" → "Base Louvor" (sem
 *  duplicar) — mesmo helper de apps/mural/src/lib/util.js. O campo
 *  `bases/{id}.nome` não é consistente entre bases (algumas já
 *  gravam "Base X", outras só "X"), por isso nunca prefixar às cegas. */
function nomeBase(nome) {
  const n = String(nome || "").trim();
  return /^base\b/i.test(n) ? n : `Base ${n}`;
}

/** Só dígitos, sem +351/espaços/traços. Não valida se É um número de
 *  telemóvel real — não há verificação por SMS aqui, de propósito: o
 *  PIN escolhido a seguir é a segurança real, o telefone é só o
 *  identificador (como o email em tantos sistemas sem verificação
 *  por email). Débito consciente: isto só serve quem se REGISTA pelo
 *  Mural (`registarMural`/`entrarMural`) — nunca é comparado contra o
 *  telefone que um líder escreveu numa base (esse caminho nem existe
 *  aqui, ver o comentário no topo do ficheiro), por isso o formato
 *  como cada líder escreveu o telefone nas bases não interfere nada
 *  disto. */
function normalizarTelefone(t) {
  const digitos = String(t || "").replace(/\D/g, "");
  const semIndicativo = digitos.length > 9 && digitos.startsWith("351") ? digitos.slice(3) : digitos;
  return semIndicativo;
}
function idParaTelefone(telefone) {
  return `tel_${telefone}`;
}

async function bloqueioEValidacaoPin(segredoRef, pin) {
  const sSnap = await segredoRef.get();
  if (!sSnap.exists) throw new HttpsError("permission-denied", "errado");
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
}

/** Só entre quem já se registou pelo Mural — quem já é voluntário
 *  entra pelo caminho de sempre (ver o comentário no topo do
 *  ficheiro), nunca por aqui. */
async function encontrarPorTelefone(telefone) {
  const id = idParaTelefone(telefone);
  const snap = await refGlobal(id).get();
  if (snap.exists && snap.data().ativo !== false) return { pessoaId: id };
  return null;
}

/* ── ENTRADA ──────────────────────────────────────────────────
 * Sem sessão (como `dadosEntrada` em index.js) — quem ainda não
 * entrou não tem token, logo as Regras do Firestore não deixam ler
 * nada (de propósito). `bases/{id}` não tem nada sensível (nome/
 * horas/cor — mesmo comentário do firestore.rules), por isso dá para
 * devolver aqui sem risco nenhum. */
export const listarBasesMural = onCall(async () => {
  const snap = await db().collection("bases").get();
  // `ativa` ausente conta como ativa — mesma leitura defensiva de
  // `dadosEntrada` em index.js (só `false` explícito desativa).
  const bases = snap.docs
    .filter((d) => d.data().ativa !== false)
    .map((d) => ({ id: d.id, nome: d.data().nome || d.id }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return { bases };
});

/* Sem sessão (como `dadosEntrada`) — diz só se o telefone já existe
 * e quantos dígitos tem o PIN, nunca nome nem foto. */
export const pedirEntradaMural = onCall(async (req) => {
  const telefone = normalizarTelefone(req.data?.telefone);
  if (telefone.length < 9) throw new HttpsError("invalid-argument", "Telemóvel inválido.");

  const achado = await encontrarPorTelefone(telefone);
  if (!achado) return { existe: false };

  const sSnap = await refSegredo(achado.pessoaId).get();
  const digitos = sSnap.exists ? sSnap.data().pinDigitos ?? 4 : 4;
  return { existe: true, digitos };
});

export const entrarMural = onCall(async (req) => {
  const telefone = normalizarTelefone(req.data?.telefone);
  const pin = String(req.data?.pin || "");
  if (telefone.length < 9 || !/^\d{4,6}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "Dados de entrada inválidos.");
  }
  const achado = await encontrarPorTelefone(telefone);
  if (!achado) throw new HttpsError("permission-denied", "errado");

  await bloqueioEValidacaoPin(refSegredo(achado.pessoaId), pin);

  // sem claims — as funções do Mural nunca olham para baseId/papel,
  // só para o uid; quem já é voluntário continua com o MESMO uid de
  // sempre, é literalmente a mesma pessoa a entrar por outra porta.
  const token = await admin.auth().createCustomToken(achado.pessoaId);
  return { token };
});

/** Regista quem nunca foi voluntário — id `tel_<telefone>`, nunca um
 *  nome cru (regra 9 do CLAUDE.md raiz). `gdId`, opcional, tem de
 *  existir no catálogo global (ver gds/{id}, apps/pessoal). */
export const registarMural = onCall(async (req) => {
  const telefone = normalizarTelefone(req.data?.telefone);
  const pin = String(req.data?.pin || "");
  const nome = String(req.data?.nome || "").trim();
  const gdId = req.data?.gdId || null;
  if (telefone.length < 9 || !/^\d{4}$/.test(pin) || !nome) {
    throw new HttpsError("invalid-argument", "Dados de registo inválidos.");
  }
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin)) {
    throw new HttpsError("invalid-argument", "Escolhe um código menos óbvio.");
  }
  if (nome.length > 60) throw new HttpsError("invalid-argument", "Nome demasiado longo.");

  const jaExiste = await encontrarPorTelefone(telefone);
  if (jaExiste) {
    // já existe conta para este telefone — a app deve ter chamado
    // pedirEntradaMural antes e mostrado o ecrã de entrar, não este;
    // recusar aqui evita reescrever uma identidade por cima da outra.
    throw new HttpsError("already-exists", "Este telemóvel já tem conta.");
  }
  if (gdId) {
    const gdSnap = await db().doc(`gds/${gdId}`).get();
    if (!gdSnap.exists) throw new HttpsError("invalid-argument", "GD inválido.");
  }

  const id = idParaTelefone(telefone);
  await refGlobal(id).set({
    nome, telefone, gdId, ativo: true, bases: {},
    origemMural: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await refSegredo(id).set({ pinHash: hash(pin), pinDigitos: 4, provisorio: false, falhas: 0 });

  const token = await admin.auth().createCustomToken(id);
  return { token };
});

/** Troca do próprio PIN — mesma lógica de `trocarPin` em index.js,
 *  só que essa exige `req.auth.token.baseId` (que ninguém do Mural
 *  tem, por desenho — ver o comentário no topo do ficheiro). Sempre
 *  4 dígitos: ninguém entra no Mural como líder de base. */
export const trocarPinMural = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { pinAtual, pinNovo } = req.data || {};
  if (!/^\d{4}$/.test(String(pinNovo || ""))) {
    throw new HttpsError("invalid-argument", "O código tem de ter 4 dígitos.");
  }
  if (/^(\d)\1+$/.test(pinNovo) || "0123456789".includes(pinNovo)) {
    throw new HttpsError("invalid-argument", "Escolhe um código menos óbvio.");
  }
  const ref = refSegredo(uid);
  const snap = await ref.get();
  if (!snap.exists || !confere(String(pinAtual), snap.data().pinHash)) {
    throw new HttpsError("permission-denied", "O código atual não está certo.");
  }
  await ref.set({ pinHash: hash(String(pinNovo)), pinDigitos: 4, provisorio: false, falhas: 0 }, { merge: true });
  return { ok: true };
});

/* ── IDENTIDADE DE QUEM PUBLICA ────────────────────────────────
 * Nome/foto/"onde serves" vêm sempre do servidor, nunca do que o
 * cliente manda — copiados para dentro do anúncio (o mesmo padrão de
 * `nomesDePessoas` em index.js: nunca um join lido em tempo real,
 * porque pessoas/{uid} só a própria pessoa pode ler). */
async function autorInfo(uid) {
  const snap = await refGlobal(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "Perfil não encontrado.");
  const p = snap.data();
  let local = null;
  const basesAtivas = Object.keys(p.bases || {}).filter((b) => p.bases[b]);
  if (basesAtivas.length) {
    const bSnap = await db().doc(`bases/${basesAtivas[0]}`).get();
    local = bSnap.exists ? nomeBase(bSnap.data().nome || basesAtivas[0]) : null;
  } else if (p.gdId) {
    const gSnap = await db().doc(`gds/${p.gdId}`).get();
    local = gSnap.exists ? `GD ${gSnap.data().nome}` : null;
  }
  return { nome: p.nome || "Alguém da igreja", foto: p.foto ?? null, local };
}

async function exigirDono(anuncioRef, uid) {
  const snap = await anuncioRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Anúncio não encontrado.");
  if (snap.data().autorId !== uid) throw new HttpsError("permission-denied", "Este anúncio não é teu.");
  return snap;
}

async function souAdminMural(uid) {
  const snap = await refAdminMural(uid).get();
  return snap.exists;
}
async function exigirAdminMural(req) {
  const uid = req.auth?.uid;
  if (!uid || !(await souAdminMural(uid))) {
    throw new HttpsError("permission-denied", "Só quem modera o Mural pode fazer isto.");
  }
  return uid;
}

/** O cliente não consegue ler config/muralAdmins (fechado pelo
 *  catch-all do firestore.rules) — só assim sabe se mostra a aba
 *  "Painel" na barra de baixo. */
export const souAdminMuralAgora = onCall(async (req) => {
  const uid = req.auth?.uid;
  return { admin: uid ? await souAdminMural(uid) : false };
});

/** Telefone de quem publicou — nunca gravado dentro do anúncio (isso
 *  abriria o número a qualquer pessoa autenticada que leia o
 *  documento, mesmo sem carregar em nenhum botão). Só sai daqui, na
 *  hora, quando alguém pede para falar. Quem é voluntário guarda o
 *  telefone na SUA base (`bases/{b}/pessoas/{uid}.telefone`, ver
 *  index.js); quem só existe pelo Mural guarda-o no próprio
 *  `pessoas/{uid}` (ver registarMural acima). */
async function telefoneDoAutor(uid) {
  const pSnap = await refGlobal(uid).get();
  if (!pSnap.exists) return null;
  const p = pSnap.data();
  if (p.telefone) return p.telefone;
  const basesAtivas = Object.keys(p.bases || {}).filter((b) => p.bases[b]);
  for (const baseId of basesAtivas) {
    const bp = await db().doc(`bases/${baseId}/pessoas/${uid}`).get();
    if (bp.exists && bp.data().telefone) return bp.data().telefone;
  }
  return null;
}

const MAX_CONTACTOS_POR_HORA = 30; // por IP — ver limitarPedidoContacto

/** Mesmo padrão de `limitarRegistoPublico` em kinder.js: sem sessão
 *  para identificar quem pede (o botão do WhatsApp é público — ver
 *  abaixo), o IP é o único travão contra um script a percorrer todos
 *  os anúncios a colher números. Guardado com hash, nunca em claro. */
async function limitarPedidoContacto(req) {
  const ip = req.rawRequest?.ip || req.rawRequest?.headers?.["x-forwarded-for"] || "desconhecido";
  const ref = db().doc(`limitesMural/${createHash("sha256").update(String(ip)).digest("hex").slice(0, 32)}`);
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const agoraMs = Date.now();
    const d = s.exists ? s.data() : null;
    const naJanela = d && agoraMs - d.inicioMs < 60 * 60 * 1000;
    const contagem = naJanela ? d.contagem + 1 : 1;
    if (contagem > MAX_CONTACTOS_POR_HORA) {
      throw new HttpsError("resource-exhausted", "Demasiados pedidos seguidos. Tenta outra vez daqui a um bocado.");
    }
    tx.set(ref, { inicioMs: naJanela ? d.inicioMs : agoraMs, contagem });
  });
}

/** Botão "Falar no WhatsApp" do detalhe do anúncio — público de
 *  propósito (2026-09): ver quem vende e chamar no WhatsApp NUNCA
 *  pede conta (só publicar pede). O único travão contra colheita em
 *  massa é o limite por IP acima — nunca o número fica gravado no
 *  documento do anúncio em si (ver telefoneDoAutor). */
export const pedirContactoAnuncio = onCall(async (req) => {
  await limitarPedidoContacto(req);
  const { id } = req.data || {};
  const snap = await db().doc(`anuncios/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Anúncio não encontrado.");
  const telefone = await telefoneDoAutor(snap.data().autorId);
  if (!telefone) throw new HttpsError("not-found", "Sem contacto disponível para este anúncio.");
  return { telefone };
});

/* ── ANÚNCIOS ─────────────────────────────────────────────────── */
export const criarAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { tipo, categoria, titulo, descricao = "", regiao, preco = "", gratis = false } = req.data || {};

  if (!TIPOS.has(tipo)) throw new HttpsError("invalid-argument", "Tipo inválido.");
  if (!CATEGORIAS[tipo].has(categoria)) throw new HttpsError("invalid-argument", "Categoria inválida.");
  if (!REGIOES.has(regiao)) throw new HttpsError("invalid-argument", "Região inválida.");
  const t = String(titulo || "").trim();
  if (!t || t.length > 80) throw new HttpsError("invalid-argument", "Título inválido.");
  if (String(descricao).length > 600) throw new HttpsError("invalid-argument", "Descrição demasiado longa.");
  if (String(preco).length > 40) throw new HttpsError("invalid-argument", "Preço inválido.");

  const ativosSnap = await db().collection("anuncios")
    .where("autorId", "==", uid).where("ativo", "==", true).get();
  if (ativosSnap.size >= MAX_ATIVOS_POR_PESSOA) {
    throw new HttpsError("resource-exhausted", "limite",
      { limite: MAX_ATIVOS_POR_PESSOA, ativos: ativosSnap.size });
  }

  const { nome, foto, local } = await autorInfo(uid);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const expiraEm = admin.firestore.Timestamp.fromMillis(Date.now() + DIAS_ATE_EXPIRAR * 24 * 60 * 60 * 1000);

  const ref = await db().collection("anuncios").add({
    tipo, categoria, titulo: t, descricao: String(descricao).trim(),
    regiao, preco: gratis ? "" : String(preco).trim(), gratis: !!gratis,
    fotos: [], estado: "disponivel", ativo: true,
    autorId: uid, autorNome: nome, autorFoto: foto, autorLocal: local,
    numReports: 0, reportadoPor: [], ultimosReports: [], lembreteEnviado: false, pedirConfirmacao: false,
    criadoEm: agora, atualizadoEm: agora, expiraEm,
  });
  return { id: ref.id };
});

export const editarAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, titulo, descricao, preco, gratis, categoria } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  const snap = await exigirDono(ref, uid);
  const tipo = snap.data().tipo;

  const alteracoes = { atualizadoEm: admin.firestore.FieldValue.serverTimestamp() };
  if (titulo !== undefined) {
    const t = String(titulo).trim();
    if (!t || t.length > 80) throw new HttpsError("invalid-argument", "Título inválido.");
    alteracoes.titulo = t;
  }
  if (descricao !== undefined) {
    if (String(descricao).length > 600) throw new HttpsError("invalid-argument", "Descrição demasiado longa.");
    alteracoes.descricao = String(descricao).trim();
  }
  if (categoria !== undefined) {
    if (!CATEGORIAS[tipo].has(categoria)) throw new HttpsError("invalid-argument", "Categoria inválida.");
    alteracoes.categoria = categoria;
  }
  if (gratis !== undefined) alteracoes.gratis = !!gratis;
  if (preco !== undefined) alteracoes.preco = alteracoes.gratis || snap.data().gratis ? "" : String(preco).trim();

  await ref.update(alteracoes);
  return { ok: true };
});

/** Fotos já sobem para o Storage do lado do cliente (mesmo caminho
 *  autorizado pelas Regras: anuncios/{uid}/{anuncioId}/...) — aqui só
 *  se grava a lista de URLs, validada contra esse mesmo prefixo, para
 *  ninguém pendurar no anúncio uma imagem de fora. */
export const definirFotosAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, fotos } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  await exigirDono(ref, uid);
  if (!Array.isArray(fotos) || fotos.length > 4) {
    throw new HttpsError("invalid-argument", "No máximo 4 fotos.");
  }
  const prefixo = `anuncios%2F${uid}%2F${id}%2F`;
  const validas = fotos.every((f) => typeof f === "string" && f.includes(prefixo));
  if (!validas) throw new HttpsError("invalid-argument", "Foto inválida.");
  await ref.update({ fotos, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});

export const alterarEstadoAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, estado } = req.data || {};
  if (!ESTADOS.has(estado)) throw new HttpsError("invalid-argument", "Estado inválido.");
  const ref = db().doc(`anuncios/${id}`);
  await exigirDono(ref, uid);
  await ref.update({ estado, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});

/** "Ainda está disponível?" — renova mais 30 dias e limpa o aviso.
 *  É a peça que mantém o mural verdadeiro (ver apps/mural/CLAUDE.md):
 *  sem isto, um anúncio fica para sempre ou expira sozinho sem a
 *  pessoa poder dizer "sim, continua". */
export const renovarAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  await exigirDono(ref, uid);
  const expiraEm = admin.firestore.Timestamp.fromMillis(Date.now() + DIAS_ATE_EXPIRAR * 24 * 60 * 60 * 1000);
  await ref.update({
    expiraEm, lembreteEnviado: false, pedirConfirmacao: false,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/** Nunca apaga a sério (regra 5 do CLAUDE.md raiz) — o autor remove o
 *  seu, quem modera remove qualquer um (reportado ou não). */
export const removerAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Anúncio não encontrado.");
  if (snap.data().autorId !== uid && !(await souAdminMural(uid))) {
    throw new HttpsError("permission-denied", "Este anúncio não é teu.");
  }
  await ref.update({ ativo: false, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});

/** Botão "Reportar anúncio à moderação" — qualquer pessoa autenticada,
 *  uma vez por anúncio (repetir não soma outra vez, evita alguém
 *  inflacionar o contador sozinho). Nunca se pode reportar o próprio. */
export const reportarAnuncio = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, motivo = "" } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Anúncio não encontrado.");
  const a = snap.data();
  if (a.autorId === uid) throw new HttpsError("invalid-argument", "Não podes reportar o teu próprio anúncio.");
  if ((a.reportadoPor || []).includes(uid)) return { ok: true }; // já tinha reportado — sem duplicar

  const ultimos = [{ motivo: String(motivo).trim().slice(0, 200), em: Date.now() }, ...(a.ultimosReports || [])].slice(0, 5);
  await ref.update({
    numReports: admin.firestore.FieldValue.increment(1),
    reportadoPor: admin.firestore.FieldValue.arrayUnion(uid),
    ultimosReports: ultimos,
  });
  return { ok: true };
});

/** Painel de moderação: manter (limpa os reports) ou remover
 *  (ativo:false — nunca apaga a sério). */
export const moderarAnuncio = onCall(async (req) => {
  const uid = await exigirAdminMural(req);
  const { id, acao } = req.data || {};
  const ref = db().doc(`anuncios/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Anúncio não encontrado.");

  if (acao === "remover") {
    await ref.update({ ativo: false, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  } else if (acao === "manter") {
    await ref.update({ numReports: 0, reportadoPor: [], ultimosReports: [] });
  } else {
    throw new HttpsError("invalid-argument", "Ação inválida.");
  }
  await db().collection("logs/moderacaoMural/acoes").add({
    id, acao, por: uid, em: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/** O texto pronto a colar no grupo, uma vez por semana (ver
 *  apps/mural/CLAUDE.md — é a troca que sustenta a promessa "menos
 *  interrupções, mesmo alcance"). Só quem modera chama isto. */
const EMOJI_CATEGORIA = {
  venda: "🛒", doacao: "🎁", arrendamento: "🏠", emprego: "💼", outros: "📌",
  objetos: "🙏", servicos: "🙏", boleias: "🚗",
};
const NOME_REGIAO = { norte: "Norte", lisboa: "Lisboa", sines: "Sines" };

export const resumoSemanalMural = onCall(async (req) => {
  await exigirAdminMural(req);
  const desde = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snap = await db().collection("anuncios").where("criadoEm", ">=", desde).get();
  const anuncios = snap.docs.map((d) => d.data()).filter((a) => a.ativo);

  const ofertas = anuncios.filter((a) => a.tipo === "ofereco");
  const pedidos = anuncios.filter((a) => a.tipo === "procuro");
  const porRegiao = {};
  for (const a of ofertas) (porRegiao[a.regiao] ??= []).push(a);

  let texto = `📋 Mural Onda — últimos 7 dias\n\nEsta semana: ${ofertas.length} novos anúncios e ${pedidos.length} pedidos.\n`;
  for (const regiao of ["norte", "lisboa", "sines"]) {
    const lista = porRegiao[regiao];
    if (!lista?.length) continue;
    texto += `\n${NOME_REGIAO[regiao]}\n`;
    for (const a of lista) {
      const emoji = EMOJI_CATEGORIA[a.categoria] || "📌";
      const preco = a.gratis ? "grátis" : a.preco || "a combinar";
      texto += `${emoji} ${a.titulo} — ${preco}\n`;
    }
  }
  if (pedidos.length) {
    texto += `\n🙏 Há quem precise de: ${pedidos.map((p) => p.titulo.toLowerCase()).join(", ")}.\n`;
  }
  texto += `\nVer tudo 👉 mural.igrejaonda.pt`;
  return { texto, totalOfertas: ofertas.length, totalPedidos: pedidos.length };
});

/* ── MANUTENÇÃO DIÁRIA ────────────────────────────────────────
 * Sem isto o mural mente como o grupo de WhatsApp mentia (ver
 * apps/mural/CLAUDE.md) — um anúncio só sai por ação de alguém, nunca
 * por si só, e sem lembrete ninguém age. */
export const manutencaoMural = onSchedule({ schedule: "every day 06:00", timeZone: "Europe/Lisbon" }, async () => {
  const agora = Date.now();
  const emDoisDias = admin.firestore.Timestamp.fromMillis(agora + DIAS_AVISO_ANTES_DE_EXPIRAR * 24 * 60 * 60 * 1000);
  const jaPassou = admin.firestore.Timestamp.fromMillis(agora);

  const paraAvisar = await db().collection("anuncios")
    .where("ativo", "==", true).where("lembreteEnviado", "==", false)
    .where("expiraEm", "<=", emDoisDias).get();
  await Promise.all(paraAvisar.docs.map((d) => d.ref.update({ lembreteEnviado: true, pedirConfirmacao: true })));

  const paraExpirar = await db().collection("anuncios")
    .where("ativo", "==", true).where("expiraEm", "<=", jaPassou).get();
  await Promise.all(paraExpirar.docs.map((d) => d.ref.update({ ativo: false })));
});
