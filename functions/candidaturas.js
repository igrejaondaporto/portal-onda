/**
 * "Quero servir" — pedidos para entrar numa base (candidaturas).
 *
 * Pedido do dono do produto, 2026-09. Dois caminhos até ao mesmo sítio
 * (o Início do líder da base):
 *
 *   1. **Pelo perfil** — um voluntário que já serve numa base pede para
 *      servir noutra ("🙋 Servir noutra base", no menu da foto). Um
 *      pedido de cada vez: enquanto houver um à espera, não dá para
 *      pedir outra base (decisão do dono do produto — sem isto, a mesma
 *      pessoa aparecia a pedir às dez bases de uma vez).
 *   2. **Pelo Painel Pastoral** — um visitante do funil passa para
 *      "Quer servir" e o pastor escolhe uma ou duas bases (1.ª e 2.ª
 *      opção). As duas recebem o pedido AO MESMO TEMPO; quando um
 *      líder aprova, o pedido da outra base é cancelado e desaparece.
 *
 * `candidaturas/{id}` é global (como `recados` e `contactos`), um
 * documento por pessoa POR BASE: o líder de cada base lê só os da
 * dele, o próprio lê os seus, o pastor lê tudo (ver firestore.rules).
 * Toda a escrita passa por aqui — aprovar cria identidade (regra 2 do
 * CLAUDE.md raiz), e cancelar a outra base tem de acontecer na MESMA
 * escrita que aprova esta, coisa que uma regra não garante.
 *
 * ── Aprovar cria (ou liga) o voluntário, num toque ──────────────
 *
 * Não abre o "Adicionar voluntário" de cada base: esse ecrã é
 * diferente em cada app (ministérios na Técnica, instrumentos na
 * Louvor, sala na Kinder), e um passo a mais só para preencher o que o
 * líder já pode ajustar depois no Painel era o tipo de ecrã que o
 * CLAUDE.md raiz pede para não ter ("mais de três toques está mal
 * desenhada"). Aprovar faz o mesmo que `criarVoluntario` faria:
 *
 *   - quem pediu pelo perfil já tem identidade → liga-a a esta base
 *     (mesmo PIN, mesma foto; o telefone herda de outra base);
 *   - um visitante do funil não tem → cria `pessoas/{id}` com o PIN
 *     provisório de sempre, devolvido UMA vez ao líder para lhe dizer.
 *     Antes de criar, procura alguém com o mesmo telemóvel: se houver,
 *     devolve `precisaEscolher` e o líder diz se é a mesma pessoa —
 *     nunca se liga sozinho (um telemóvel de família partilhado ligava
 *     duas pessoas diferentes num perfil só) e nunca se duplica sem
 *     perguntar (regra 9 do CLAUDE.md raiz).
 *
 * ── A cascata: 1.ª escolha → 2.ª → todas (2026-10) ─────────────
 *
 * Pedido do dono do produto: o pedido vai PRIMEIRO só à 1.ª base que a
 * pessoa escolheu; se essa disser "agora não", segue para a 2.ª; se a
 * 2.ª também disser, vai a TODAS as outras ao mesmo tempo (e a primeira
 * que aprovar fica com a pessoa — o mesmo `grupo` do Painel Pastoral).
 * Serve os dois caminhos de quem escolhe sozinho:
 *
 *   - o teste "Onde vais servir?" (`apps/voluntario`, sem login) —
 *     `enviarTesteVoluntario`, `origem: "teste"`;
 *   - o "Servir noutra base" do menu da foto — `pedirParaServir`, que
 *     passou a aceitar a 2.ª escolha e a recusar quem já está em DUAS
 *     bases ("o limite é duas bases" — `LIMITE_BASES`).
 *
 * Cada documento leva `grupo`, `passo` (1, 2 ou 3 = todas) e `cascata`
 * (as escolhas, por ordem). Avançar acontece DENTRO da transação que
 * recusa (`proximoPasso`), nunca num gatilho: dois líderes a recusar ao
 * mesmo tempo no passo 3 não podem criar a cascata duas vezes. Os
 * pedidos do Painel Pastoral (as duas bases ao mesmo tempo) não têm
 * `passo` e ficam como estavam.
 *
 * `FieldValue.serverTimestamp()` só em campos de NÍVEL DE DOCUMENTO:
 * `contactos/{id}.servir.bases` e `historicoEtapas` são arrays (ver o
 * CLAUDE.md raiz — um sentinel dentro de um array rebenta na escrita).
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { randomBytes, scryptSync } from "node:crypto";
import { SUBDOMINIO, notificar } from "./notificacoes.js";

const db = () => admin.firestore();
const agora = () => admin.firestore.FieldValue.serverTimestamp();

/** As bases que recebem pedidos — todas as de voluntários, menos o
 *  Financeiro (decisão do dono do produto), a Pastoral e o Onda Tech
 *  Hub (não são equipas de domingo). A mesma lista vive no cliente
 *  (`packages/shared/src/lib/candidaturas.js`) — uma base nova tem de
 *  entrar nos dois sítios; o servidor recusa o que não conhece, que é
 *  o que se quer. */
export const BASES_CANDIDATURA = [
  "apoio", "tecnica", "backstage", "comunicacao", "pessoal",
  "louvor", "louvorkinder", "kinder", "new", "shift",
];

/** Mesmo conjunto de `PAPEIS_LIDER` em index.js — o auxiliar (Louvor,
 *  Louvor Kinder, Kinder) tem as mesmas funções do líder. */
const PAPEIS_LIDER = new Set(["lider_base", "auxiliar"]);

const MAX_MENSAGEM = 300;
const PIN_VOLUNTARIO = "1234"; // o mesmo PIN_PADRAO.voluntario de index.js

/** Mesmo formato byte a byte de `hash()` em index.js — é o `confere()`
 *  de lá que autentica no login (mesma nota de `hashPin` em pastoral.js). */
function hashPin(pin) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
}

// back.igrejaonda.pt, techhub.igrejaonda.pt — ver SUBDOMINIO em notificacoes.js
const urlDaBase = (baseId) => `https://${SUBDOMINIO[baseId] ?? baseId}.igrejaonda.pt/`;

function exigeSessao(req) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  return uid;
}

function exigeVisaoPastoral(req) {
  if (req.auth?.token?.ve_tudo_pastoral !== true) {
    throw new HttpsError("permission-denied", "Isto é da equipa pastoral.");
  }
  return req.auth.uid;
}

/** Líder (ou auxiliar) da base DESTE pedido — pelo token, nunca pelo
 *  Firestore (regra 4 do CLAUDE.md raiz). */
function exigeLiderDe(req, baseId) {
  const t = req.auth?.token;
  if (!t || t.baseId !== baseId || !PAPEIS_LIDER.has(t.papel)) {
    throw new HttpsError("permission-denied", "Só o líder desta base pode responder a este pedido.");
  }
  return req.auth.uid;
}

async function baseValida(baseId) {
  if (!BASES_CANDIDATURA.includes(baseId)) throw new HttpsError("invalid-argument", "Esta base não recebe pedidos.");
  const snap = await db().doc(`bases/${baseId}`).get();
  if (!snap.exists || snap.data().ativa === false) throw new HttpsError("not-found", "Base desconhecida.");
  return { id: baseId, nome: snap.data().nome ?? baseId };
}

/** O nome de quem está a responder, como aparece na base dele — "Aprovada
 *  por Camila", nunca um uid. */
async function nomeNaBase(baseId, uid) {
  const s = await db().doc(`bases/${baseId}/pessoas/${uid}`).get();
  return s.exists ? (s.data().nome ?? null) : null;
}

/** Telefone e foto de alguém que já existe — de qualquer base onde os
 *  tenha. O líder da base de destino não lê as pessoas de outra base
 *  (firestore.rules), por isso isto fica gravado no pedido: é o que
 *  alimenta o botão de WhatsApp. Mesma herança que `criarVoluntario`
 *  (index.js) faz ao ligar alguém — o Breno e o Hans ficaram sem
 *  telefone e sem foto antes de ela existir. */
async function contactoDaPessoa(uid, globalData) {
  let telefone = "";
  let foto = globalData.foto ?? null;
  const bases = Object.keys(globalData.bases || {});
  const ativas = [];
  for (const b of bases) {
    const s = await db().doc(`bases/${b}/pessoas/${uid}`).get();
    if (!s.exists) continue;
    if (!telefone && s.data().telefone) telefone = s.data().telefone;
    if (!foto && s.data().foto) foto = s.data().foto;
    if (s.data().ativo !== false && globalData.bases[b]) ativas.push(b);
  }
  return { telefone, foto, basesAtivas: ativas };
}

async function nomesDasBases(ids) {
  const snaps = await Promise.all(ids.map((b) => db().doc(`bases/${b}`).get()));
  return snaps.map((s, i) => (s.exists ? (s.data().nome ?? ids[i]) : ids[i]));
}

/* ══════════════════════════════════════════════════════════════
 *  A CASCATA — 1.ª escolha → 2.ª → todas
 * ══════════════════════════════════════════════════════════════ */

/** No máximo em duas bases (pedido do dono do produto, 2026-10). Só
 *  contam as equipas de domingo (`BASES_CANDIDATURA`): o Financeiro, a
 *  Pastoral e o Onda Tech Hub não entram nesta conta. */
const LIMITE_BASES = 2;
const MSG_LIMITE = "LIMITE DE BASES ATINGIDO! Já serves em duas bases, que é o máximo.";
const contamParaLimite = (bases) => bases.filter((b) => BASES_CANDIDATURA.includes(b));

/** Mesmo `soDigitos` do teste (apps/voluntario): 9 dígitos, sem +351. */
const soDigitosTel = (t) => String(t || "").replace(/\D/g, "").replace(/^351(?=\d{9}$)/, "");

/** O que passa de um passo para o seguinte — tudo menos a base e o estado. */
const CAMPOS_DA_CASCATA = [
  "origem", "pessoaId", "nome", "telefone", "telefoneNorm", "foto", "basesAtuais", "basesAtuaisIds",
  "mensagem", "localidade", "grupo", "cascata", "teste", "criadoPor",
];
function comumDe(c) {
  const comum = {};
  for (const k of CAMPOS_DA_CASCATA) if (c[k] !== undefined) comum[k] = c[k];
  return comum;
}

/** Um pedido por base, todos no mesmo `grupo`. */
function escreverPasso(t, comum, passo, bases, recusadas = []) {
  for (const b of bases) {
    t.set(db().collection("candidaturas").doc(), {
      ...comum, baseId: b.id, baseNome: b.nome,
      estado: "pendente", passo, recusadas, criadoEm: agora(),
    });
  }
}

/** Para onde segue um pedido da cascata que acabou de ser recusado. SÓ
 *  LEITURAS (chama-se antes das escritas da transação). `fim` = já não
 *  há para onde ir; `bases` vazio sem `fim` = no passo 3 ainda há outras
 *  bases por responder, não se faz nada. */
async function proximoPasso(t, c, idAtual) {
  const irmas = await t.get(db().collection("candidaturas").where("grupo", "==", c.grupo));
  if (irmas.docs.some((d) => d.id !== idAtual && d.data().estado === "pendente")) {
    return { bases: [], fim: false };
  }
  const recusadas = irmas.docs.filter((d) => d.id === idAtual || d.data().estado === "recusada");
  const fora = new Set([...recusadas.map((d) => d.data().baseId), ...(c.basesAtuaisIds || [])]);
  const recusadasNomes = [...new Set(recusadas.map((d) => d.data().baseNome))];
  const tentativas = [];
  const segunda = c.cascata?.[1]?.id;
  if (c.passo === 1 && segunda && !fora.has(segunda)) tentativas.push({ passo: 2, ids: [segunda] });
  if (c.passo < 3) tentativas.push({ passo: 3, ids: BASES_CANDIDATURA.filter((b) => !fora.has(b)) });
  for (const { passo, ids } of tentativas) {
    if (!ids.length) continue;
    const snaps = await t.getAll(...ids.map((b) => db().doc(`bases/${b}`)));
    const bases = snaps
      .filter((x) => x.exists && x.data().ativa !== false)
      .map((x) => ({ id: x.id, nome: x.data().nome ?? x.id }));
    if (bases.length) return { passo, bases, recusadasNomes, fim: false };
  }
  return { bases: [], recusadasNomes, fim: true };
}

/* ══════════════════════════════════════════════════════════════
 *  PELO TESTE — "Onde vais servir?" (apps/voluntario, sem login)
 * ══════════════════════════════════════════════════════════════ */

/** Teto de envios por dia, para a igreja toda — a função é pública (não
 *  há login no teste) e cada envio avisa líderes; isto impede alguém de
 *  encher os Inícios de pedidos falsos. Numa reunião de novos
 *  voluntários chegam umas 10–20 pessoas. */
const TESTES_POR_DIA = 40;

export const enviarTesteVoluntario = onCall(async (req) => {
  const d = req.data || {};
  const nome = String(d.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (nome.split(" ").length < 2) throw new HttpsError("invalid-argument", "Escreve o nome e o apelido.");
  const tel = soDigitosTel(d.telefone);
  if (!/^\d{9}$/.test(tel)) throw new HttpsError("invalid-argument", "O telemóvel tem de ter 9 números.");
  const primeira = await baseValida(String(d.primeira || ""));
  const segunda = d.segunda ? await baseValida(String(d.segunda)) : null;
  if (segunda?.id === primeira.id) throw new HttpsError("invalid-argument", "Escolhe duas bases diferentes.");
  const area = String(d.area ?? "").trim().slice(0, 80) || null;
  const teste = { direto: d.direto === true, area, areaDe: area ? primeira.id : null };

  const grupo = db().collection("candidaturas").doc().id;
  const cascata = [primeira, segunda].filter(Boolean).map((b) => ({ id: b.id, nome: b.nome }));
  const refTeste = db().doc(`testesVoluntario/${tel}`);
  const refLimite = db().doc(`limites/testeVoluntario-${new Date().toISOString().slice(0, 10)}`);

  await db().runTransaction(async (t) => {
    const pendente = await t.get(db().collection("candidaturas")
      .where("telefoneNorm", "==", tel).where("estado", "==", "pendente").limit(1));
    if (!pendente.empty) {
      throw new HttpsError("already-exists", "Já recebemos o teu pedido — agora é só aguardar que um líder fale contigo.");
    }
    const limite = await t.get(refLimite);
    if ((limite.data()?.n ?? 0) >= TESTES_POR_DIA) {
      throw new HttpsError("resource-exhausted", "Hoje já chegaram muitos pedidos. Tenta outra vez amanhã.");
    }
    t.set(refLimite, { n: admin.firestore.FieldValue.increment(1) }, { merge: true });
    // o resultado do teste, por telemóvel — fica para o pastor, e é o
    // "um teste por telemóvel" do lado do servidor
    t.set(refTeste, {
      nome, telefone: tel, primeira: primeira.id, segunda: segunda?.id ?? null, ...teste,
      grupo, enviadoEm: agora(), vezes: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
    escreverPasso(t, {
      origem: "teste", nome, telefone: tel, telefoneNorm: tel, foto: null,
      grupo, cascata, teste, mensagem: null,
    }, 1, [primeira]);
  });
  return { ok: true, primeira: primeira.nome, segunda: segunda?.nome ?? null };
});

/* ══════════════════════════════════════════════════════════════
 *  PELO PERFIL — "Servir noutra base"
 * ══════════════════════════════════════════════════════════════ */

/** A 1.ª base (`baseId`) e, opcional, a 2.ª (`segundaId`) — a cascata
 *  (ver o topo). Só para quem está em menos de `LIMITE_BASES` bases. */
export const pedirParaServir = onCall(async (req) => {
  const uid = exigeSessao(req);
  const { baseId, segundaId = null, mensagem } = req.data || {};
  const base = await baseValida(String(baseId || ""));
  const segunda = segundaId ? await baseValida(String(segundaId)) : null;
  if (segunda?.id === base.id) throw new HttpsError("invalid-argument", "Escolhe duas bases diferentes.");
  const texto = String(mensagem ?? "").trim().slice(0, MAX_MENSAGEM);

  const globalSnap = await db().doc(`pessoas/${uid}`).get();
  if (!globalSnap.exists) throw new HttpsError("permission-denied", "Só quem já é voluntário pode pedir por aqui.");
  const g = globalSnap.data();

  const { telefone, foto, basesAtivas } = await contactoDaPessoa(uid, g);
  if (contamParaLimite(basesAtivas).length >= LIMITE_BASES) {
    throw new HttpsError("failed-precondition", MSG_LIMITE);
  }
  for (const b of [base, segunda].filter(Boolean)) {
    if (basesAtivas.includes(b.id)) throw new HttpsError("already-exists", `Já serves na ${b.nome}.`);
  }
  const basesAtuais = await nomesDasBases(basesAtivas);

  const grupo = db().collection("candidaturas").doc().id;
  // numa transação: dois toques seguidos (ou dois telemóveis) não podem
  // deixar a mesma pessoa com dois pedidos à espera
  await db().runTransaction(async (t) => {
    const pendentes = await t.get(db().collection("candidaturas")
      .where("pessoaId", "==", uid).where("estado", "==", "pendente").limit(1));
    if (!pendentes.empty) {
      const outra = pendentes.docs[0].data();
      throw new HttpsError("failed-precondition",
        `Já tens um pedido à espera (${outra.baseNome}). Cancela-o primeiro para pedires outra base.`);
    }
    escreverPasso(t, {
      origem: "perfil",
      pessoaId: uid, nome: g.nome ?? "", telefone, telefoneNorm: soDigitosTel(telefone) || null, foto,
      basesAtuais, basesAtuaisIds: basesAtivas,
      mensagem: texto || null,
      grupo, cascata: [base, segunda].filter(Boolean).map((b) => ({ id: b.id, nome: b.nome })),
      criadoPor: { uid, baseId: req.auth.token?.baseId ?? null },
    }, 1, [base]);
  });
  return { ok: true, grupo };
});

/** O próprio desiste do pedido, enquanto ainda está à espera — no passo 3
 *  (todas as bases) cancela-o em todas de uma vez. */
export const cancelarPedidoServir = onCall(async (req) => {
  const uid = exigeSessao(req);
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta o pedido.");
  const ref = db().doc(`candidaturas/${id}`);
  await db().runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.data().pessoaId !== uid) throw new HttpsError("not-found", "Pedido não encontrado.");
    if (s.data().estado !== "pendente") throw new HttpsError("failed-precondition", "Este pedido já teve resposta.");
    const irmas = s.data().grupo
      ? await t.get(db().collection("candidaturas").where("grupo", "==", s.data().grupo).where("estado", "==", "pendente"))
      : null;
    t.update(ref, { estado: "cancelada", motivo: "pelo_proprio", decididoEm: agora() });
    irmas?.forEach((d) => {
      if (d.id !== id && d.data().pessoaId === uid) {
        t.update(d.ref, { estado: "cancelada", motivo: "pelo_proprio", decididoEm: agora() });
      }
    });
  });
  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  PELO PAINEL PASTORAL — um visitante do funil, a 1 ou 2 bases
 * ══════════════════════════════════════════════════════════════ */

/** Passa o contacto para "Quer servir" e manda o pedido às bases
 *  escolhidas, numa escrita só (o histórico do funil fica gravado ao
 *  mesmo tempo, como em `moverEtapaContacto`). Chamar outra vez
 *  enquanto está à espera TROCA as bases: os pedidos antigos saem
 *  (cancelados), os novos entram. */
export const enviarContactoParaServir = onCall(async (req) => {
  const uid = exigeVisaoPastoral(req);
  const { contactoId, bases } = req.data || {};
  if (!contactoId) throw new HttpsError("invalid-argument", "Falta o contacto.");
  if (!Array.isArray(bases) || bases.length < 1 || bases.length > 2 || new Set(bases).size !== bases.length) {
    throw new HttpsError("invalid-argument", "Escolhe uma ou duas bases diferentes.");
  }
  const escolhidas = await Promise.all(bases.map((b) => baseValida(String(b))));
  const autorNome = await nomeNaBase(req.auth.token.baseId, uid);

  const refContacto = db().doc(`contactos/${contactoId}`);
  const grupo = db().collection("candidaturas").doc().id;
  const opcoes = escolhidas.map((b, i) => ({ baseId: b.id, nome: b.nome, opcao: i + 1 }));

  await db().runTransaction(async (t) => {
    const c = await t.get(refContacto);
    if (!c.exists || c.data().arquivado === true) throw new HttpsError("not-found", "Contacto não encontrado.");
    const dados = c.data();
    if (dados.servir?.estado === "aprovada") {
      throw new HttpsError("failed-precondition", `${dados.nome} já foi aprovado(a) na ${dados.servir.aprovadaPor?.baseNome ?? "base"}.`);
    }
    const antigas = await t.get(db().collection("candidaturas")
      .where("contactoId", "==", contactoId).where("estado", "==", "pendente"));

    antigas.forEach((d) => t.update(d.ref, { estado: "cancelada", motivo: "reenviado_pelo_pastor", decididoEm: agora() }));
    for (const o of opcoes) {
      t.set(db().collection("candidaturas").doc(), {
        baseId: o.baseId, baseNome: o.nome,
        estado: "pendente", origem: "pastoral",
        contactoId, nome: dados.nome ?? "", telefone: dados.telemovel ?? "", foto: null,
        localidade: [dados.freguesia, dados.concelho].filter(Boolean).join(", ") || null,
        gd: dados.gd?.nome ?? null,
        grupo, opcao: o.opcao,
        outrasOpcoes: opcoes.filter((x) => x.baseId !== o.baseId),
        criadoEm: agora(),
        criadoPor: { uid, nome: autorNome, baseId: req.auth.token.baseId },
      });
    }
    const anterior = dados.etapa ?? "visita";
    t.set(refContacto, {
      servir: {
        estado: "aguardando", grupo,
        bases: opcoes.map((o) => ({ ...o, estado: "pendente" })),
        enviadoEm: agora(), enviadoPor: uid, aprovadaPor: null,
      },
      ...(anterior !== "voluntario" ? {
        etapa: "voluntario", etapaEm: agora(), etapaPor: uid,
        historicoEtapas: admin.firestore.FieldValue.arrayUnion({
          de: anterior, para: "voluntario", em: new Date().toISOString(), por: uid,
          nota: `Enviado a ${opcoes.map((o) => o.nome).join(" e ")}`,
        }),
      } : {}),
    }, { merge: true });
  });
  return { ok: true, grupo };
});

/** Tira os pedidos à espera de um contacto — quando o pastor o arquiva
 *  ou o move para outra etapa que não "Quer servir". Sem isto o líder
 *  continuava a ver um pedido de alguém que o pastor já tinha tirado do
 *  caminho. Chamado de `pastoral.js`; não é uma função exposta. */
export async function cancelarPedidosDoContacto(contactoId, motivo) {
  const snap = await db().collection("candidaturas")
    .where("contactoId", "==", contactoId).where("estado", "==", "pendente").get();
  if (snap.empty) return 0;
  const lote = db().batch();
  snap.forEach((d) => lote.update(d.ref, { estado: "cancelada", motivo, decididoEm: agora() }));
  lote.set(db().doc(`contactos/${contactoId}`), { servir: { estado: "cancelada" } }, { merge: true });
  await lote.commit();
  return snap.size;
}

/* ══════════════════════════════════════════════════════════════
 *  O LÍDER RESPONDE — aprovar ou "agora não"
 * ══════════════════════════════════════════════════════════════ */

/** Quem tem este telemóvel — o número exato, e a mesma coisa com/sem o
 *  +351 (é assim que as bases o escrevem, das duas maneiras). */
async function pessoasComTelefone(telefone) {
  const t = String(telefone || "").trim();
  if (!t) return [];
  const digitos = t.replace(/[^\d+]/g, "");
  const variantes = new Set([t, digitos]);
  if (digitos.startsWith("+351")) variantes.add(digitos.slice(4));
  else if (digitos.startsWith("351") && digitos.length > 9) variantes.add(digitos.slice(3));
  else variantes.add(`+351${digitos}`);
  const snaps = await Promise.all([...variantes].filter(Boolean).map((v) =>
    db().collectionGroup("pessoas").where("telefone", "==", v).limit(5).get()));
  const vistos = new Map();
  for (const snap of snaps) {
    for (const d of snap.docs) {
      // só pessoas de uma base (bases/{b}/pessoas/{id}); o collectionGroup
      // também apanharia uma coleção "pessoas" noutro sítio qualquer
      if (d.ref.parent.parent?.parent?.id !== "bases") continue;
      if (!vistos.has(d.id)) vistos.set(d.id, d);
    }
  }
  const resultado = [];
  for (const [id, d] of vistos) {
    const g = await db().doc(`pessoas/${id}`).get();
    if (!g.exists) continue;
    const bases = Object.keys(g.data().bases || {}).filter((b) => g.data().bases[b]);
    resultado.push({ pessoaId: id, nome: g.data().nome ?? d.data().nome, foto: d.data().foto ?? null, bases: await nomesDasBases(bases) });
  }
  return resultado;
}

export const decidirCandidatura = onCall(async (req) => {
  const { id, decisao, pessoaExistenteId = null, criarNova = false } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta o pedido.");
  if (!["aprovar", "recusar"].includes(decisao)) throw new HttpsError("invalid-argument", "Decisão inválida.");
  const ref = db().doc(`candidaturas/${id}`);
  const primeiro = await ref.get();
  if (!primeiro.exists) throw new HttpsError("not-found", "Pedido não encontrado.");
  const c = primeiro.data();
  const uid = exigeLiderDe(req, c.baseId);
  if (c.estado !== "pendente") throw new HttpsError("failed-precondition", "Este pedido já não está à espera.");
  const decididoPor = { uid, nome: await nomeNaBase(c.baseId, uid) };

  if (decisao === "recusar") {
    await db().runTransaction(async (t) => {
      const s = await t.get(ref);
      if (s.data().estado !== "pendente") throw new HttpsError("failed-precondition", "Este pedido já não está à espera.");
      const refContacto = c.contactoId ? db().doc(`contactos/${c.contactoId}`) : null;
      const contacto = refContacto ? await t.get(refContacto) : null;
      // a cascata (teste e perfil): 1.ª → 2.ª → todas — lido antes de escrever
      const seguinte = c.passo && c.grupo ? await proximoPasso(t, c, id) : null;
      t.update(ref, {
        estado: "recusada", decididoEm: agora(), decididoPor,
        ...(seguinte ? {
          seguiuPara: seguinte.bases.length ? (seguinte.passo === 3 ? "todas" : seguinte.bases[0].nome) : null,
          fim: seguinte.fim,
        } : {}),
      });
      if (seguinte?.bases.length) escreverPasso(t, comumDe(c), seguinte.passo, seguinte.bases, seguinte.recusadasNomes);
      if (contacto?.exists && contacto.data().servir?.grupo === c.grupo) {
        const servir = contacto.data().servir;
        const basesServir = (servir.bases || []).map((b) => (b.baseId === c.baseId ? { ...b, estado: "recusada", por: decididoPor.nome } : b));
        const aindaPendente = basesServir.some((b) => b.estado === "pendente");
        t.set(refContacto, { servir: { bases: basesServir, ...(aindaPendente ? {} : { estado: "recusada" }) } }, { merge: true });
      }
    });
    return { ok: true, decisao };
  }

  // ── aprovar: quem é esta pessoa? ──
  let pessoaId = c.origem === "perfil" ? c.pessoaId : null;
  if (!pessoaId && pessoaExistenteId) {
    // só uma das pessoas que `precisaEscolher` mostrou (mesmo telemóvel)
    // — o líder confirma que é a mesma pessoa, não escolhe uma qualquer
    const candidatos = await pessoasComTelefone(c.telefone);
    if (!candidatos.some((p) => p.pessoaId === pessoaExistenteId)) {
      throw new HttpsError("invalid-argument", "Essa pessoa não tem o telemóvel deste pedido.");
    }
    pessoaId = pessoaExistenteId;
  }
  if (!pessoaId && !criarNova) {
    const candidatos = await pessoasComTelefone(c.telefone);
    if (candidatos.length) return { ok: false, precisaEscolher: true, candidatos };
  }

  // o que herda de outra base, quando liga alguém que já existe
  let herdado = null;
  if (pessoaId) {
    const g = await db().doc(`pessoas/${pessoaId}`).get();
    herdado = { global: g.data(), ...(await contactoDaPessoa(pessoaId, g.data())) };
    // o limite de duas bases vale também aqui: a pessoa pode ter entrado
    // noutra base enquanto este pedido esperava
    if (contamParaLimite(herdado.basesAtivas.filter((b) => b !== c.baseId)).length >= LIMITE_BASES) {
      throw new HttpsError("failed-precondition", `${herdado.global.nome ?? c.nome} já serve em duas bases, que é o limite.`);
    }
  }
  const novoId = pessoaId ?? db().collection(`bases/${c.baseId}/pessoas`).doc().id;
  const refPessoaBase = db().doc(`bases/${c.baseId}/pessoas/${novoId}`);
  const refGlobal = db().doc(`pessoas/${novoId}`);

  const resultado = await db().runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.data().estado !== "pendente") {
      throw new HttpsError("failed-precondition",
        s.data().motivo === "aprovada_noutra_base" ? "Já foi aprovado(a) noutra base." : "Este pedido já não está à espera.");
    }
    const irmas = c.grupo
      ? await t.get(db().collection("candidaturas").where("grupo", "==", c.grupo).where("estado", "==", "pendente"))
      : null;
    const refContacto = c.contactoId ? db().doc(`contactos/${c.contactoId}`) : null;
    const contacto = refContacto ? await t.get(refContacto) : null;
    const jaAqui = await t.get(refPessoaBase);
    const jaAtivo = jaAqui.exists && jaAqui.data().ativo !== false;

    let pinProvisorio = null;
    if (!jaAtivo) {
      if (pessoaId) {
        t.set(refPessoaBase, {
          nome: herdado.global.nome ?? c.nome, telefone: c.telefone || herdado.telefone || "",
          papel: "voluntario", ativo: true, genero: null, foto: herdado.foto ?? null,
          criadoEm: agora(),
        });
        t.set(refGlobal, { bases: { [c.baseId]: true } }, { merge: true });
      } else {
        pinProvisorio = PIN_VOLUNTARIO;
        const nome = String(c.nome || "").trim() || "Sem nome";
        t.set(refPessoaBase, {
          nome, telefone: c.telefone || "", papel: "voluntario", ativo: true, foto: null, genero: null,
          criadoEm: agora(),
        });
        t.set(refGlobal, { nome, foto: null, bases: { [c.baseId]: true }, criadoEm: agora() });
        t.set(db().doc(`pessoas/${novoId}/privado/auth`), {
          pinHash: hashPin(pinProvisorio), pinDigitos: pinProvisorio.length,
          provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
        });
      }
    }

    t.update(ref, { estado: "aprovada", decididoEm: agora(), decididoPor, pessoaCriadaId: novoId });
    irmas?.forEach((d) => {
      if (d.id === id) return;
      t.update(d.ref, { estado: "cancelada", motivo: "aprovada_noutra_base", aprovadaEm: c.baseNome, decididoEm: agora() });
    });

    if (contacto?.exists) {
      const dados = contacto.data();
      const mesmoGrupo = dados.servir?.grupo === c.grupo;
      const basesServir = mesmoGrupo
        ? (dados.servir.bases || []).map((b) => (b.baseId === c.baseId
          ? { ...b, estado: "aprovada", por: decididoPor.nome }
          : b.estado === "pendente" ? { ...b, estado: "cancelada" } : b))
        : [];
      const anterior = dados.etapa ?? "visita";
      t.set(refContacto, {
        pessoaId: novoId,
        servir: {
          estado: "aprovada",
          ...(mesmoGrupo ? { bases: basesServir } : {}),
          aprovadaPor: { nome: decididoPor.nome, baseId: c.baseId, baseNome: c.baseNome },
          aprovadaEm: agora(),
        },
        // aprovado = já está numa base: o funil avança sozinho para "A
        // servir" (e deixa de contar como "parado" em "Quer servir")
        ...(anterior !== "servindo" ? {
          etapa: "servindo", etapaEm: agora(), etapaPor: uid,
          historicoEtapas: admin.firestore.FieldValue.arrayUnion({
            de: anterior, para: "servindo", em: new Date().toISOString(), por: uid,
            nota: `Aprovado(a) na ${c.baseNome}${decididoPor.nome ? ` por ${decididoPor.nome}` : ""}`,
          }),
        } : {}),
      }, { merge: true });
    }
    return { pinProvisorio, jaEstava: jaAtivo };
  });

  return {
    ok: true, decisao, pessoaId: novoId, nome: c.nome, telefone: c.telefone || herdado?.telefone || "",
    novo: !pessoaId && !resultado.jaEstava, ...resultado,
  };
});

/* ══════════════════════════════════════════════════════════════
 *  AVISOS — um gatilho no documento, como o do recado
 * ══════════════════════════════════════════════════════════════
 *
 * Pedido novo → push + e-mail ao líder e aos auxiliares da base (o
 * cartão no Início é o caminho garantido; isto é o empurrão).
 * Resposta → a quem pediu (pelo perfil: push + e-mail, é pessoal) ou
 * ao pastor que enviou (só push — ele tem o destaque no Domingo).
 * Cancelados não avisam ninguém: "desaparece", como pedido.
 */
async function lideresDaBase(baseId) {
  const snap = await db().collection(`bases/${baseId}/pessoas`).where("ativo", "==", true).get();
  return snap.docs.filter((d) => PAPEIS_LIDER.has(d.data().papel)).map((d) => d.id);
}

export const notificarCandidatura = onDocumentWritten("candidaturas/{id}", async (evento) => {
  const antes = evento.data?.before?.exists ? evento.data.before.data() : null;
  const depois = evento.data?.after?.exists ? evento.data.after.data() : null;
  if (!depois || antes?.estado === depois.estado) return;
  const tag = `candidatura-${evento.params.id}`;

  try {
    if (!antes && depois.estado === "pendente") {
      const lideres = await lideresDaBase(depois.baseId);
      const segunda = depois.passo === 2 ? " (era a 2.ª escolha)" : "";
      await notificar(lideres, {
        titulo: `🙋 Quer servir — ${depois.baseNome}`,
        corpo: depois.passo === 3
          ? `${depois.nome} ainda não tem base: as que escolheu disseram "agora não". Se houver lugar na tua, responde no Início.`
          : depois.origem === "pastoral"
            ? `${depois.nome} veio do Painel Pastoral e quer servir na tua base. Fala com ele(a) e responde no Início.`
            : depois.origem === "teste"
              // os líderes não sabem do teste (pedido do dono do produto): é só
              // "voluntário aguardando solicitação"
              ? `Voluntário aguardando solicitação: ${depois.nome} quer servir na tua base${segunda}. Fala com ele(a) e responde no Início.`
              : `${depois.nome} pediu para servir também na tua base${segunda}. Responde no Início.`,
        url: urlDaBase(depois.baseId), tag,
      });
      return;
    }
    if (antes?.estado !== "pendente" || !["aprovada", "recusada"].includes(depois.estado)) return;
    const aprovada = depois.estado === "aprovada";

    // a cascata seguiu (ou ainda há bases por responder no passo 3): só
    // um aviso curto, sem e-mail — a resposta a sério vem no fim
    if (!aprovada && depois.passo && depois.fim !== true) {
      if (depois.origem === "perfil" && depois.seguiuPara) {
        await notificar([depois.pessoaId], {
          titulo: `O teu pedido seguiu`,
          corpo: depois.seguiuPara === "todas"
            ? `A ${depois.baseNome} disse "agora não". Enviámos o teu pedido às outras bases — agora é só aguardar.`
            : `A ${depois.baseNome} disse "agora não". O teu pedido seguiu para a ${depois.seguiuPara} — agora é só aguardar.`,
          url: urlDaBase(depois.criadoPor?.baseId ?? depois.baseId), tag, email: false,
        });
      }
      return;
    }

    if (depois.origem === "perfil") {
      await notificar([depois.pessoaId], {
        titulo: aprovada ? `Bem-vindo(a) à ${depois.baseNome}!` : `Resposta da ${depois.baseNome}`,
        corpo: aprovada
          ? `O teu pedido foi aceite. Já podes entrar na ${depois.baseNome} com o teu código de sempre.`
          : depois.fim
            ? "Por agora nenhuma base tem lugar. Podes falar com o teu líder, ou tentar mais tarde."
            : "Por agora não foi possível. Podes falar com o líder da base, ou pedir outra.",
        url: urlDaBase(depois.baseId), tag,
      });
    } else if (depois.criadoPor?.uid) {
      await notificar([depois.criadoPor.uid], {
        titulo: aprovada ? `✅ ${depois.nome} entrou na ${depois.baseNome}` : `${depois.baseNome}: agora não`,
        corpo: aprovada
          ? `Aprovado(a)${depois.decididoPor?.nome ? ` por ${depois.decididoPor.nome}` : ""}.`
          : `${depois.baseNome} respondeu "agora não" a ${depois.nome}.`,
        url: urlDaBase("pastoral"), tag, email: false,
      });
    }
  } catch (e) {
    logger.error("notificarCandidatura falhou", { id: evento.params.id }, e);
  }
});
