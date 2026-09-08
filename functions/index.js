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
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import sharp from "sharp";
import decodeAudio from "audio-decode";
import essentiaLib from "essentia.js";
import { equipamentoEmBaixo } from "./estadoEquipamento.js";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { logger } from "firebase-functions";
import { sondarUmaVez, normalizarNome } from "./freeshow.js";

admin.initializeApp();
const db = admin.firestore();

// O frontend vive no Cloudflare, não no domínio das Functions — sem isto
// os pedidos são bloqueados como cross-origin. Cobre o domínio de cada
// base (apoio.igrejaonda.pt…), o domínio antigo ainda em DNS, os
// previews do Workers Builds, e o dev local em localhost/127.0.0.1
// em qualquer porta — de propósito, para uma base nova não ter de
// mexer aqui. As portas concretas de cada app vivem só no cliente
// (PORTAS_DEV em packages/shared/src/lib/auth.js).
const ORIGENS_PERMITIDAS = [
  /^https:\/\/([a-z0-9-]+\.)?igrejaonda\.pt$/,
  /^https:\/\/([a-z0-9-]+\.)?painelonda\.pt$/,
  /^https:\/\/[a-z0-9-]+\.workers\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
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

/* ── CLAIMS EXTRA DERIVADOS DA CONFIG DA BASE ──────────────────
 * As regras leem sempre do token, nunca do Firestore (ver CLAUDE.md
 * raiz, regra 4) — por isso quem entra ou troca de base carrega estas
 * capacidades no próprio token, lidas uma vez aqui a partir de
 * bases/{baseId}. Só entram no token quando true, para o ficar pequeno.
 *   ve_todas_escalas      — bases/{b}.veEscalas === "todas"
 *   pode_publicar_culto   — bases/{b}.culto.podePublicar === true
 *   pode_criar_evento_global — por agora, só o líder da própria base
 *     com esta flag; pensado para incluir admin_igreja mais tarde
 *     sem mexer outra vez nas regras. */
async function claimsExtraDaBase(baseId) {
  const snap = await db.doc(`bases/${baseId}`).get();
  const b = snap.exists ? snap.data() : {};
  const extra = {};
  if (b.veEscalas === "todas") extra.ve_todas_escalas = true;
  if (b.culto?.podePublicar === true) extra.pode_publicar_culto = true;
  if (b.eventos?.podeCriarGlobal === true) extra.pode_criar_evento_global = true;
  if (b.feedbackAberto === true) extra.feedback_aberto = true;
  return extra;
}

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

/** Nomes (+ foto, telefone) de um conjunto de pessoas de uma base,
 *  para telas que resolvem em tempo real (nunca guardar cópia — ver
 *  escalasCrossBase). O telefone só sai daqui para quem tem
 *  `ve_todas_escalas` — é a mesma capacidade elevada que já lê a
 *  escala de qualquer base, para poder chamar quem serve noutra base
 *  quando precisa (contacto por WhatsApp, como já existe dentro da
 *  própria base). */
async function nomesDePessoas(baseId, ids) {
  const snaps = await Promise.all([...ids].map((id) => refPessoa(baseId, id).get()));
  return Object.fromEntries(snaps.filter((s) => s.exists).map((s) => [
    s.id, { nome: s.data().nome, foto: s.data().foto ?? null, telefone: s.data().telefone ?? "" },
  ]));
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
    papel: papelParaToken(pessoa.papel, baseId),
    ...(await claimsExtraDaBase(baseId)),
  });
  return { token, deveTrocarPin: !!s.provisorio };
});

/* ── ACESSO DEV ────────────────────────────────────────────
 * Entrada paralela ao PIN, para quem constrói o sistema continuar a
 * testar qualquer base sem depender do código de nenhum líder (que
 * muda assim que a base é entregue, e o dev deixa de saber). Não é
 * uma pessoa — o uid "dev-admin" nunca existe em bases/{b}/pessoas,
 * por isso nunca aparece em listas de Voluntários nem pode ser
 * escalado. A senha (não um PIN de 4-6 dígitos — dá acesso total a
 * qualquer base) fica só em config/devAccess/privado/auth, hash
 * scrypt igual ao do PIN, gravado por scripts/definirSenhaDev.mjs
 * (Admin SDK, nunca por um cliente — config/** cai no catch-all
 * "allow read, write: if false" do firestore.rules). Mesmo bloqueio
 * de tentativas do PIN (MAX_1/MAX_2/BLOQUEIO_MS), guardado no mesmo
 * documento. Cada entrada fica registada em logs/acessosDev, para
 * haver rasto de quando foi usado. */
const refSegredoDev = () => db.doc("config/devAccess/privado/auth");

export const entrarComoDev = onCall(async (req) => {
  const { baseId, senha } = req.data || {};
  if (!baseId || !senha) throw new HttpsError("invalid-argument", "Dados de entrada inválidos.");

  const baseSnap = await db.doc(`bases/${baseId}`).get();
  if (!baseSnap.exists) throw new HttpsError("not-found", "errado");

  const segredoRef = refSegredoDev();
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

  if (!confere(String(senha), s.hash)) {
    const falhas = (s.falhas ?? 0) + 1;
    const limite = s.jaBloqueou ? MAX_2 : MAX_1;
    const bloqueia = falhas >= limite;
    await segredoRef.set({
      falhas: bloqueia ? 0 : falhas,
      jaBloqueou: s.jaBloqueou || bloqueia,
      bloqueadoAte: bloqueia ? admin.firestore.Timestamp.fromMillis(agora + BLOQUEIO_MS) : null,
    }, { merge: true });
    throw new HttpsError("permission-denied", bloqueia ? "bloqueado" : "errado",
      { restam: bloqueia ? 0 : limite - falhas, bloqueado: bloqueia });
  }

  await segredoRef.set({ falhas: 0, jaBloqueou: false, bloqueadoAte: null }, { merge: true });
  await db.collection("logs/acessosDev/entradas").add({
    baseId, em: admin.firestore.FieldValue.serverTimestamp(),
  });

  const token = await admin.auth().createCustomToken("dev-admin", {
    baseId,
    papel: "lider_base",
    dev: true,
    ...(await claimsExtraDaBase(baseId)),
  });
  return { token };
});

/* ── TROCAR O PRÓPRIO PIN ─────────────────────────────────── */
export const trocarPin = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { pinAtual, pinNovo } = req.data || {};
  // "auxiliar" (só na Louvor) usa o mesmo tamanho de código do líder
  // da base — ver PAPEIS_LIDER mais abaixo no ficheiro.
  const digitos = PAPEIS_LIDER.has(req.auth.token.papel) ? 6 : 4;
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
/** "auxiliar" (só existe na Louvor, ver PAPEIS_BASE no cliente e a
 *  validação em criarVoluntario/editarVoluntario abaixo) tem as
 *  mesmas funções do líder da base — pedido do líder, 2026-09.
 *  Seguro tratar isto genericamente aqui (função partilhada por
 *  todas as bases): nenhuma outra base consegue gravar
 *  `papel:"auxiliar"` numa pessoa seguinte, e por isso nunca chega a
 *  entrar no token de ninguém fora da Louvor. */
const PAPEIS_LIDER = new Set(["lider_base", "auxiliar"]);

function exigeLider(req) {
  const baseId = req.auth?.token?.baseId;
  if (!baseId || !PAPEIS_LIDER.has(req.auth.token.papel)) {
    throw new HttpsError("permission-denied", "Só o líder da base pode fazer isto.");
  }
  return baseId;
}

/** Mesma regra usada para montar o custom token em `entrar` e
 *  `trocarBase` — só a Louvor pode ter "auxiliar"; noutra base isso
 *  colapsa para "voluntario", como qualquer papel desconhecido. */
function papelParaToken(papelPessoa, baseId) {
  if (papelPessoa === "lider_base") return "lider_base";
  if (papelPessoa === "auxiliar" && baseId === "louvor") return "auxiliar";
  return "voluntario";
}

/** Só a(s) base(s) com bases/{b}.culto.podePublicar podem publicar/
 *  apagar a ordem do culto — antes disto, qualquer líder de qualquer
 *  base conseguia mexer na ordem do culto da igreja toda, sem gate
 *  nenhum. A claim vem do token (ver claimsExtraDaBase), nunca lida
 *  do Firestore aqui. */
function exigePodePublicarCulto(req) {
  const baseId = exigeLider(req);
  if (req.auth.token.pode_publicar_culto !== true) {
    throw new HttpsError("permission-denied", "A tua base não pode publicar a ordem do culto.");
  }
  return baseId;
}
// fixo e óbvio de propósito: ninguém decora código nenhum, e o
// `provisorio:true` obriga a trocar logo no primeiro acesso.
const PIN_PADRAO = { lider_base: "123456", auxiliar: "123456", voluntario: "1234" };
const pinProvisorio = (papel) => PIN_PADRAO[papel] ?? PIN_PADRAO.voluntario;

/** "auxiliar" só é um papel válido na Louvor (ver PAPEIS_LIDER acima
 *  e PAPEIS_BASE no cliente) — noutra base é o mesmo erro que
 *  qualquer papel desconhecido. */
function validarPapelBase(papel, baseId) {
  if (!["voluntario", "lider_base", "auxiliar"].includes(papel)) {
    throw new HttpsError("invalid-argument", "Papel inválido.");
  }
  if (papel === "auxiliar" && baseId !== "louvor") {
    throw new HttpsError("invalid-argument", "Este papel só existe na Louvor.");
  }
}

// "MM-DD", sem ano (minimização de dados — Base Louvor, ver
// lib/aniversarios.js/CLAUDE.md dessa base). Só ela envia isto; nas
// outras bases o campo nunca aparece.
const ANIVERSARIO_RE = /^\d{2}-\d{2}$/;

export const criarVoluntario = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { nome, telefone = "", papel = "voluntario", pessoaExistenteId = null, ministerios, genero = null, nivel = null, cargo = null, instrumentos = null, aniversario = null } = req.data || {};
  validarPapelBase(papel, baseId);
  if (aniversario && !ANIVERSARIO_RE.test(aniversario)) throw new HttpsError("invalid-argument", "Aniversário inválido.");
  const comAniversario = aniversario ? { aniversario } : {};
  const comMinisterios = ministerios && typeof ministerios === "object" ? { ministerios } : {};
  // nivel: "titular"|"aprendiz" — flat, só a Backstage envia isto (sem
  // ministério onde pendurar, ao contrário do nivel por-ministério da
  // Técnica). Nas outras bases o campo nunca aparece.
  const comNivel = nivel ? { nivel } : {};
  // instrumentos: só a Louvor envia isto — que papéis (vocal/teclado/
  // guitarra/baixo/bateria, ver PAPEIS_LOUVOR mais abaixo) a pessoa
  // toca, para agrupar por "instrumento" ao montar a escala (ver
  // guardarEscalaLouvor). Uma pessoa pode tocar mais do que um; sem
  // validação de valores aqui — a mesma confiança no cliente que
  // ministerios/nivel/cargo já têm, o enum real vive só na UI da
  // Louvor (apps/louvor/src/lib/modelo.js, PAPEIS).
  const comInstrumentos = Array.isArray(instrumentos) ? { instrumentos: instrumentos.filter((x) => typeof x === "string") } : {};
  // cargo: etiqueta livre (ex.: "Auxiliar", Comunicação) — sem poder
  // nenhum associado, é só o que aparece a par do nome. Nas outras
  // bases o campo nunca aparece.
  const comCargo = cargo ? { cargo: String(cargo).trim() } : {};

  // pessoa que já existe noutra base: só a liga a esta, PIN não muda
  if (pessoaExistenteId) {
    const globalSnap = await refGlobal(pessoaExistenteId).get();
    if (!globalSnap.exists) throw new HttpsError("not-found", "Pessoa não encontrada.");
    // "nada é apagado, é desativado" — remover alguém da base marca
    // ativo:false, não apaga o documento. Sem o `&& ativo`, esta
    // checagem via um bloqueio permanente: quem foi removido nunca
    // mais podia ser adicionado de novo, mesmo pelo fluxo certo
    // ("já é voluntário(a) noutra base?"), porque o doc antigo
    // continuava a existir. Reativar é só voltar a escrever por cima.
    const jaAqui = await refPessoa(baseId, pessoaExistenteId).get();
    if (jaAqui.exists && jaAqui.data().ativo !== false) {
      throw new HttpsError("already-exists", "Essa pessoa já está nesta base.");
    }

    // procurarPessoaGlobal (buscar por telefone) não devolve o
    // telefone nos resultados — e quem liga por essa via nem sempre o
    // reescreve, achando que "é a mesma pessoa" já basta. Sem isto,
    // ligar alguém a uma base nova apagava o telefone que já tinha
    // noutra base (aconteceu: o Breno tinha o número guardado na
    // Apoio, ficou em branco ao ligar à Técnica). Se quem liga não
    // mandou um telefone, herda de qualquer outra base onde a pessoa
    // já tenha um guardado. A foto tem o mesmo problema por um motivo
    // diferente: cada pessoa muda a própria foto por escrita direta
    // em `bases/{base}/pessoas/{id}` (ver editarVoluntario), e isso
    // nunca sobe para o documento global — por isso `globalSnap`
    // quase sempre tem `foto:null`, mesmo que a pessoa tenha foto
    // posta noutra base (caso real: o Hans, ao ser religado à
    // Pessoal, ficou sem foto porque `pessoas/hans.foto` nunca foi
    // atualizado desde que a conta nasceu na Técnica). Mesmo
    // tratamento: herda de qualquer outra base que já tenha uma.
    let telefoneFinal = telefone;
    let fotoFinal = globalSnap.data().foto ?? null;
    if (!telefoneFinal || !fotoFinal) {
      const outrasBases = Object.keys(globalSnap.data().bases || {}).filter((b) => b !== baseId);
      for (const outraBase of outrasBases) {
        const outroSnap = await refPessoa(outraBase, pessoaExistenteId).get();
        if (!outroSnap.exists) continue;
        if (!telefoneFinal && outroSnap.data().telefone) telefoneFinal = outroSnap.data().telefone;
        if (!fotoFinal && outroSnap.data().foto) fotoFinal = outroSnap.data().foto;
        if (telefoneFinal && fotoFinal) break;
      }
    }

    await refPessoa(baseId, pessoaExistenteId).set({
      nome: nome.trim() || globalSnap.data().nome, telefone: telefoneFinal, papel, ativo: true, genero,
      foto: fotoFinal,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      ...comMinisterios, ...comNivel, ...comCargo, ...comInstrumentos, ...comAniversario,
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
    nome: nome.trim(), telefone, papel, ativo: true, foto: null, genero,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    ...comMinisterios, ...comNivel, ...comCargo, ...comInstrumentos, ...comAniversario,
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
      telefone: d.data().telefone ?? "",
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
  const { pessoaId, nome, telefone = "", papel, ministerios, foto, genero, nivel, cargo, instrumentos, aniversario } = req.data || {};
  if (!pessoaId) throw new HttpsError("invalid-argument", "Falta o voluntário.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (aniversario && !ANIVERSARIO_RE.test(aniversario)) throw new HttpsError("invalid-argument", "Aniversário inválido.");
  validarPapelBase(papel, baseId);
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
  const dados = { nome: nome.trim(), telefone, papel, genero: genero ?? null };
  // ministerios: { audio: "titular"|"aprendiz", ... } — só bases com
  // ministérios enviam isto; nas outras o campo nunca aparece.
  if (ministerios && typeof ministerios === "object") dados.ministerios = ministerios;
  if (nivel) dados.nivel = nivel;
  if (cargo !== undefined) dados.cargo = cargo ? String(cargo).trim() : null;
  if (Array.isArray(instrumentos)) dados.instrumentos = instrumentos.filter((x) => typeof x === "string");
  // o próprio já muda a sua foto por escrita direta (firestore.rules
  // permite ao dono); isto é só o líder a mudar a foto de outra
  // pessoa — o upload em si já passou pelo Storage antes de chegar
  // aqui (storage.rules já deixa o líder da base subir a foto de
  // qualquer pessoa da base). `null` remove a foto de propósito;
  // `undefined` (campo nem enviado) é que significa "não mexer".
  if (foto !== undefined) dados.foto = foto;
  // undefined (campo nem enviado) = não mexer; null ou "" = apagar —
  // mesmo tratamento de foto acima. Só a Louvor envia isto.
  if (aniversario !== undefined) dados.aniversario = aniversario || null;
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
    papel: papelParaToken(snap.data().papel, novoBaseId),
    ...(await claimsExtraDaBase(novoBaseId)),
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

/* ── ESCALA (equipa única, sem ministérios) ─────────────────
 * Nome ficou "Apoio" por ter nascido lá primeiro, mas é partilhada —
 * a Pessoal chama-a também (`lib/painel.js`, mesmo molde: equipa
 * única, sem ministérios). `baseId` vem sempre do token, nunca fixo
 * ("apoio" fixo aqui já foi bug real: a checagem de conflito
 * cross-base ficava sempre a apontar para a Apoio, mesmo quando quem
 * chamava era a Pessoal). Até existir esta função gravava direto do
 * cliente (setDoc) — nada validava, nem sequer o líder da base. Passa
 * a existir aqui só para poder aplicar a mesma regra da Técnica: quem
 * serve em mais do que uma base não fica escalado nas duas no mesmo
 * culto. Formato desta base é uma lista simples de pessoas, não
 * lugares por ministério. */
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
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, baseId, id);
  }

  await ref.set({
    baseId, liderEscala: liderEscala || null, pessoas,
  }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, baseId, id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, baseId, id);
  }
  return { ok: true };
});

/* ── ESCALA (Backstage) ──────────────────────────────────────
 * Mesmo formato da Apoio (lista simples, sem ministérios). Função
 * própria, não reaproveita guardarEscalaApoio, porque cada base tem
 * a sua — mesmo padrão da Técnica/Apoio (ver comentários acima). */
export const guardarEscalaBackstage = onCall(async (req) => {
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

  // um aprendiz nunca serve sozinho (mesma regra da Técnica) — precisa
  // de estar acompanhado por pelo menos um titular no mesmo culto.
  // Validado aqui, não só no cliente: é a garantia real, o SheetEscala
  // é só a experiência que evita chegar a este erro na prática.
  if (pessoas.length) {
    const pessoasSnap = await Promise.all(pessoas.map((id) => refPessoa(baseId, id).get()));
    const temAprendiz = pessoasSnap.some((s) => s.exists && s.data().nivel === "aprendiz");
    const temTitular = pessoasSnap.some((s) => s.exists && s.data().nivel !== "aprendiz");
    if (temAprendiz && !temTitular) {
      throw new HttpsError("invalid-argument", "Um aprendiz não pode servir sozinho — junta um titular.");
    }
  }

  const pessoasAntigas = new Set(snap.exists ? snap.data().pessoas || [] : []);
  const pessoasNovas = new Set(pessoas);
  const adicionadas = pessoas.filter((id) => !pessoasAntigas.has(id));
  const removidas = [...pessoasAntigas].filter((id) => !pessoasNovas.has(id));
  const multiBase = new Set();
  for (const id of new Set([...adicionadas, ...removidas])) {
    if ((await basesDaPessoa(id)).length > 1) multiBase.add(id);
  }
  for (const id of adicionadas) {
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, baseId, id);
  }

  const liderAntigo = snap.exists ? snap.data().liderEscala || null : null;
  const novoLider = liderEscala || null;

  await ref.set({
    baseId, liderEscala: novoLider, pessoas,
  }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, baseId, id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, baseId, id);
  }

  // é sempre uma pessoa só a fazer tudo nesta base — por isso, ao
  // escalar (ou trocar) quem serve, essa pessoa já fica responsável
  // por todas as funções do dia dela, sem a líder ter de as atribuir
  // uma a uma. Só dispara quando o titular muda de facto (nunca ao
  // gravar de novo com o mesmo titular, ex.: só a juntar um aprendiz)
  // — assim não apaga ajustes que a líder já tenha feito função a
  // função. A líder continua livre para trocar ou acrescentar depois.
  if (novoLider && novoLider !== liderAntigo) {
    await atribuirTodasFuncoesAoTitular(eventoId, baseId, novoLider, uid);
  }

  return { ok: true };
});

/** Atribui uma pessoa a todas as funções do catálogo + as só deste
 *  culto, substituindo quem lá estava — mesmo formato de escrita do
 *  atribuirFuncao, para o resto do sistema (checklist, "servem
 *  contigo") não precisar de caso especial. */
async function atribuirTodasFuncoesAoTitular(eventoId, baseId, titularId, atualizadoPor) {
  const funcoesSnap = await db.collection(`bases/${baseId}/funcoes`).get();
  const doCulto = funcoesSnap.docs.filter((d) => !d.data().eventoId || d.data().eventoId === eventoId);
  if (!doCulto.length) return;
  const lote = db.batch();
  for (const f of doCulto) {
    lote.set(db.doc(`eventos/${eventoId}/atribuicoes/${f.id}`), {
      baseId, funcaoId: f.id, pessoas: [titularId],
      nomeFuncao: f.data().nome,
      atualizadoPor, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await lote.commit();
}

/* ── ESCALA (Base Louvor) ────────────────────────────────────
 * Sem titular/aprendiz e sem lugar fixo por papel: o líder de escala
 * escolhe livremente quantos lead/guitarras/etc. entram, cada
 * pessoa com um papel (ver PAPEIS em apps/louvor/src/lib/modelo.js —
 * lista replicada aqui porque o cliente não pode ser a única
 * validação). Uma pessoa não pode ocupar dois papéis no mesmo culto.
 * "vocal" saiu do Set (2026-09, virou lead/colead/back) — só afeta
 * escritas novas; escalados antigos com esse papel, já gravados,
 * continuam no Firestore sem revalidação (nada se apaga). */
const PAPEIS_LOUVOR = new Set(["lead", "colead", "back", "teclado", "guitarra", "baixo", "bateria"]);

export const guardarEscalaLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { eventoId, liderEscala = null, escalados } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!Array.isArray(escalados)) throw new HttpsError("invalid-argument", "Faltam os escalados.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();
  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  const souLiderAtual = snap.exists && snap.data().liderEscala === uid;
  if (!souLiderBase && !souLiderAtual) {
    throw new HttpsError("permission-denied",
      "Só o líder da base ou o líder de escala deste culto pode fazer isto.");
  }

  await escreverEscalaLouvor(eventoId, baseId, escalados, liderEscala);
  return { ok: true };
});

/** O corpo de guardarEscalaLouvor, sem a checagem de permissão — é a
 *  parte que publicarRascunhoEscala também precisa (já validado no
 *  seu próprio exigeLider, um domingo de cada vez). Faz sempre a
 *  validação completa (papel válido, sem duplicar pessoa, conflito
 *  entre bases) — nunca a versão leve de guardarRascunhoEscala. */
async function escreverEscalaLouvor(eventoId, baseId, escalados, liderEscala) {
  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();

  const usados = new Set();
  const escaladosLimpos = escalados.map((e) => {
    if (!e?.pessoaId || !PAPEIS_LOUVOR.has(e.papel)) {
      throw new HttpsError("invalid-argument", "Escalado sem pessoa ou papel válido.");
    }
    if (usados.has(e.pessoaId)) {
      throw new HttpsError("invalid-argument", "Uma pessoa não pode estar em dois papéis no mesmo culto.");
    }
    usados.add(e.pessoaId);
    return { pessoaId: e.pessoaId, papel: e.papel };
  });
  const pessoas = new Set(escaladosLimpos.map((e) => e.pessoaId));

  const pessoasAntigas = new Set(snap.exists ? snap.data().pessoas || [] : []);
  const adicionadas = [...pessoas].filter((id) => !pessoasAntigas.has(id));
  const removidas = [...pessoasAntigas].filter((id) => !pessoas.has(id));
  const multiBase = new Set();
  for (const id of new Set([...adicionadas, ...removidas])) {
    if ((await basesDaPessoa(id)).length > 1) multiBase.add(id);
  }
  for (const id of adicionadas) {
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, baseId, id);
  }

  await ref.set({
    baseId, liderEscala: liderEscala || null,
    escalados: escaladosLimpos, pessoas: [...pessoas],
  }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, baseId, id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, baseId, id);
  }
}

/** Publica a escala já gravada pela tabela rápida de sempre
 *  (SheetEscala.jsx), sem passar por rascunho — marca `publicado`,
 *  o sinal que a confirmação de presença (próxima fase) vai exigir.
 *  Mesmo gate de guardarEscalaLouvor: líder da base, auxiliar, ou o
 *  líder de escala deste culto. */
export const publicarEscalaLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Este culto ainda não tem escala.");
  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  const souLiderAtual = snap.data().liderEscala === uid;
  if (!souLiderBase && !souLiderAtual) {
    throw new HttpsError("permission-denied",
      "Só o líder da base ou o líder de escala deste culto pode fazer isto.");
  }
  await ref.set({
    publicado: true,
    publicadoEm: admin.firestore.FieldValue.serverTimestamp(),
    publicadoPor: uid,
  }, { merge: true });
  return { ok: true };
});

/* ── RASCUNHO DE ESCALA (Base Louvor) ─────────────────────────
 * Só líder/auxiliar mexe em rascunhos (exigeLider) — ao contrário da
 * escala ao vivo, um rascunho cobre vários domingos de uma vez, não
 * faz sentido o líder de escala de um culto só editar isto. Guardar
 * valida pouco (papel válido, sem duplicar pessoa no mesmo culto) —
 * sem checar conflito entre bases: um rascunho pode estar "errado"
 * enquanto é trabalhado, sem gente presa por causa disso. A
 * validação completa (a mesma de guardarEscalaLouvor) só corre ao
 * publicar, via escreverEscalaLouvor. Publicar é sempre tudo de uma
 * vez — todos os domingos do rascunho, decisão do líder. */
export const guardarRascunhoEscala = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { rascunhoId, nome, itens } = req.data || {};
  if (!Array.isArray(itens) || !itens.length) {
    throw new HttpsError("invalid-argument", "Faltam os domingos do rascunho.");
  }

  const itensLimpos = itens.map((it) => {
    if (!it?.eventoId) throw new HttpsError("invalid-argument", "Item do rascunho sem culto.");
    const usados = new Set();
    const escalados = (it.escalados || []).map((e) => {
      if (!e?.pessoaId || !PAPEIS_LOUVOR.has(e.papel)) {
        throw new HttpsError("invalid-argument", "Escalado sem pessoa ou papel válido.");
      }
      if (usados.has(e.pessoaId)) {
        throw new HttpsError("invalid-argument", "Uma pessoa não pode estar em dois papéis no mesmo culto.");
      }
      usados.add(e.pessoaId);
      return { pessoaId: e.pessoaId, papel: e.papel };
    });
    return { eventoId: it.eventoId, liderEscala: it.liderEscala || null, escalados };
  });

  const ref = rascunhoId
    ? db.doc(`bases/${baseId}/rascunhosEscala/${rascunhoId}`)
    : db.collection(`bases/${baseId}/rascunhosEscala`).doc();
  const dados = {
    itens: itensLimpos, ativo: true, publicado: false,
    atualizadoPor: req.auth.uid, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (typeof nome === "string" && nome.trim()) dados.nome = nome.trim();
  if (!rascunhoId) {
    dados.criadoPor = req.auth.uid;
    dados.criadoEm = admin.firestore.FieldValue.serverTimestamp();
    if (!dados.nome) dados.nome = "Rascunho sem nome";
  }
  await ref.set(dados, { merge: true });
  return { rascunhoId: ref.id };
});

export const publicarRascunhoEscala = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { rascunhoId } = req.data || {};
  if (!rascunhoId) throw new HttpsError("invalid-argument", "Falta o rascunho.");

  const ref = db.doc(`bases/${baseId}/rascunhosEscala/${rascunhoId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().ativo === false) throw new HttpsError("not-found", "Rascunho não encontrado.");
  const { itens = [] } = snap.data();
  if (!itens.length) throw new HttpsError("failed-precondition", "Este rascunho não tem domingos.");

  for (const item of itens) {
    await escreverEscalaLouvor(item.eventoId, baseId, item.escalados, item.liderEscala);
    await db.doc(`eventos/${item.eventoId}/escalas/${baseId}`).set({
      publicado: true,
      publicadoEm: admin.firestore.FieldValue.serverTimestamp(),
      publicadoPor: req.auth.uid,
    }, { merge: true });
  }

  await ref.set({
    publicado: true,
    publicadoEm: admin.firestore.FieldValue.serverTimestamp(),
    publicadoPor: req.auth.uid,
  }, { merge: true });
  return { ok: true, domingos: itens.length };
});

/** "Excluir" é sempre ativo:false — regra 5 do CLAUDE.md raiz. */
export const excluirRascunhoEscala = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { rascunhoId } = req.data || {};
  if (!rascunhoId) throw new HttpsError("invalid-argument", "Falta o rascunho.");
  await db.doc(`bases/${baseId}/rascunhosEscala/${rascunhoId}`).set({ ativo: false }, { merge: true });
  return { ok: true };
});

/* ── HISTÓRICO DE TONS POR VERSÃO (Base Louvor) ───────────────
 * Duas formas de saber quem é "o cantor" de uma música num culto,
 * sempre as duas quando fazem sentido (pedido do líder, 2026-09):
 * (a) o nome da própria versão bate com uma pessoa ativa da base
 * (ex.: versão "Tai" → Tai Trindade) — vale para qualquer culto que
 * use essa versão; (b) quem está escalado como Lead nesse culto
 * específico — vale só para esse culto, mesmo que a versão usada
 * seja "Original" (é quem vai cantar de facto, independente do nome
 * da versão). As duas podem apontar para a mesma pessoa (conta uma
 * vez só) ou para pessoas diferentes (as duas ganham a entrada).
 *
 * `versoes/{id}.usoPorCulto: { [eventoId]: tom }` — um mapa, não uma
 * lista que só cresce: sobrescrever a chave de um eventoId é como se
 * resolve sozinho "mudei o tom deste culto" (chamada de novo com o
 * mesmo eventoId), e apagar a chave é como desfazerUsoVersaoLouvor
 * (abaixo) resolve "esta música saiu do repertório". `vezes`/
 * `datas por tom` são deriváveis no cliente agrupando o mapa, não
 * precisam de campo próprio. `indiceCantores/{pessoaId}.musicas[]`
 * guarda uma cópia de usoPorCulto por pessoa — índice invertido para
 * "todas as músicas que este cantor já cantou" sem collectionGroup
 * query (ver Biblioteca.jsx), atualizado na MESMA transação que a
 * versão, nunca desalinha.
 *
 * Chamada do cliente em três momentos: ao adicionar a música a um
 * repertório (lib/repertorio.js) e ao trocar o tom de um item já lá
 * dentro (SheetEditarTom.jsx) — as duas COM eventoId, contam como
 * "uso" nesse culto — e ao criar/editar a própria versão
 * (SheetVersao.jsx), SEM eventoId: só sincroniza nome/tom no índice
 * (só o sinal do nome-da-versão, o Lead não entra sem um culto), sem
 * contar como uso — é assim que "criar uma versão nova já cria um
 * cantor novo na biblioteca" acontece sem esperar por um culto. Sem
 * tom definido, ou sem nenhuma das duas pessoas encontrada, fica
 * silencioso — não é erro. Transação de propósito: dois toques quase
 * juntos não podem perder-se um ao outro. */
async function pessoasParaAtribuir(baseId, nomeVersao, eventoId) {
  const pessoasSnap = await db.collection(`bases/${baseId}/pessoas`).where("ativo", "==", true).get();
  const norm = (s) => (s || "").trim().toLowerCase();
  const primeiroNome = (s) => norm(s).split(" ")[0];

  const encontrados = new Map(); // pessoaId -> nome
  const porNome = pessoasSnap.docs.find((d) => {
    const nomePessoa = d.data().nome || "";
    return !!nomeVersao && (norm(nomePessoa) === norm(nomeVersao) || primeiroNome(nomePessoa) === norm(nomeVersao));
  });
  if (porNome) encontrados.set(porNome.id, porNome.data().nome);

  if (eventoId) {
    const escalaSnap = await db.doc(`eventos/${eventoId}/escalas/${baseId}`).get();
    const lead = escalaSnap.exists ? (escalaSnap.data().escalados || []).find((e) => e.papel === "lead") : null;
    if (lead && !encontrados.has(lead.pessoaId)) {
      const pessoaLead = pessoasSnap.docs.find((d) => d.id === lead.pessoaId);
      if (pessoaLead) encontrados.set(pessoaLead.id, pessoaLead.data().nome);
    }
  }
  return encontrados;
}

export const registarUsoVersaoLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { eventoId, musicaId, versaoId } = req.data || {};
  if (!musicaId || !versaoId) throw new HttpsError("invalid-argument", "Faltam dados.");

  const [versaoSnap, musicaSnap] = await Promise.all([
    db.doc(`bases/${baseId}/musicas/${musicaId}/versoes/${versaoId}`).get(),
    db.doc(`bases/${baseId}/musicas/${musicaId}`).get(),
  ]);
  if (!versaoSnap.exists) return { registado: false };
  const nomeVersao = (versaoSnap.data().nome || "").trim();
  // Sem tom ainda conta como uso — o líder pediu que a música entre
  // no Histórico do cantor já ao ser adicionada ao repertório, mesmo
  // antes de o tom ser escolhido (ver GradeTom/SheetEditarTom, que
  // chama isto de novo assim que o tom for definido, sobrescrevendo
  // esta entrada com o tom a valer).
  const tom = versaoSnap.data().tom || null;

  const pessoas = await pessoasParaAtribuir(baseId, nomeVersao, eventoId);
  if (!pessoas.size) return { registado: false };

  const tituloMusica = musicaSnap.exists ? musicaSnap.data().titulo : "—";
  const artistaMusica = musicaSnap.exists ? musicaSnap.data().artista || "" : "";
  const refVersao = db.doc(`bases/${baseId}/musicas/${musicaId}/versoes/${versaoId}`);
  const idsPessoas = [...pessoas.keys()];
  const refsIndice = idsPessoas.map((id) => db.doc(`bases/${baseId}/indiceCantores/${id}`));

  await db.runTransaction(async (tx) => {
    const [versaoAtualSnap, ...indiceSnaps] = await Promise.all([tx.get(refVersao), ...refsIndice.map((r) => tx.get(r))]);

    const usoPorCulto = { ...(versaoAtualSnap.data()?.usoPorCulto || {}) };
    if (eventoId) usoPorCulto[eventoId] = tom;
    tx.set(refVersao, { usoPorCulto }, { merge: true });

    idsPessoas.forEach((pessoaId, i) => {
      const indiceSnap = indiceSnaps[i];
      const musicasIndice = indiceSnap.exists ? [...(indiceSnap.data().musicas || [])] : [];
      const j = musicasIndice.findIndex((m) => m.musicaId === musicaId && m.versaoId === versaoId);
      const entrada = { musicaId, versaoId, titulo: tituloMusica, artista: artistaMusica, nomeVersao, tom, usoPorCulto };
      if (j === -1) musicasIndice.push(entrada);
      else musicasIndice[j] = entrada;
      tx.set(refsIndice[i], { nome: pessoas.get(pessoaId), musicas: musicasIndice }, { merge: true });
    });
  });
  return { registado: true };
});

/** Espelho de registarUsoVersaoLouvor, para quando uma música SAI do
 *  repertório de um culto — sem isto, o Histórico continuava a
 *  mostrar um uso que já não existe (pedido do líder). Mesmos
 *  candidatos (nome da versão + Lead do culto), mas apaga a chave
 *  deste eventoId em vez de gravar o tom — nunca apaga a entrada da
 *  versão inteira do índice, mesmo que fique sem nenhum uso: se o
 *  nome bate por ser mesmo o nome da pessoa, continua a fazer
 *  sentido ela aparecer lá (com "sem uso ainda"), só o uso NESTE
 *  culto é que deixou de valer. */
export const desfazerUsoVersaoLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { eventoId, musicaId, versaoId } = req.data || {};
  if (!eventoId || !musicaId || !versaoId) return { desfeito: false };

  const versaoSnap = await db.doc(`bases/${baseId}/musicas/${musicaId}/versoes/${versaoId}`).get();
  if (!versaoSnap.exists) return { desfeito: false };
  const nomeVersao = (versaoSnap.data().nome || "").trim();

  const pessoas = await pessoasParaAtribuir(baseId, nomeVersao, eventoId);
  const refVersao = db.doc(`bases/${baseId}/musicas/${musicaId}/versoes/${versaoId}`);
  const idsPessoas = [...pessoas.keys()];
  const refsIndice = idsPessoas.map((id) => db.doc(`bases/${baseId}/indiceCantores/${id}`));

  await db.runTransaction(async (tx) => {
    const [versaoAtualSnap, ...indiceSnaps] = await Promise.all([tx.get(refVersao), ...refsIndice.map((r) => tx.get(r))]);

    const usoPorCulto = { ...(versaoAtualSnap.data()?.usoPorCulto || {}) };
    delete usoPorCulto[eventoId];
    tx.set(refVersao, { usoPorCulto }, { merge: true });

    idsPessoas.forEach((pessoaId, i) => {
      const indiceSnap = indiceSnaps[i];
      if (!indiceSnap.exists) return;
      const musicasIndice = [...(indiceSnap.data().musicas || [])];
      const j = musicasIndice.findIndex((m) => m.musicaId === musicaId && m.versaoId === versaoId);
      if (j === -1) return;
      const usoAtualizado = { ...(musicasIndice[j].usoPorCulto || {}) };
      delete usoAtualizado[eventoId];
      musicasIndice[j] = { ...musicasIndice[j], usoPorCulto: usoAtualizado };
      tx.set(refsIndice[i], { musicas: musicasIndice }, { merge: true });
    });
  });
  return { desfeito: true };
});

/** Limpa `indiceCantores/{pessoaId}.musicas[]` de uma versão excluída
 *  (desativarVersao) ou esvaziada de tom (removerTomVersao, quando o
 *  último tom sai e a versão fica `ativo:false` — ver lib/biblioteca.js
 *  em cada caso) — gap documentado desde a criação do índice: essa
 *  coleção só aceita escrita de Cloud Function (`allow write: if
 *  false` no cliente, ver firestore.rules), então uma tentativa
 *  anterior direto do cliente falhava sempre, silenciosamente. Varre
 *  `indiceCantores` inteiro (a base fica bem abaixo de 500 músicas,
 *  o número de cantores é uma fração disso — mesmo raciocínio de
 *  `pessoasParaAtribuir` acima) em vez de tentar adivinhar quem tem a
 *  entrada: mais simples e sempre correto, mesmo que o nome da
 *  versão já não bata com ninguém (ex.: versão renomeada antes de
 *  excluída). Nunca apaga o documento do cantor inteiro, só a
 *  entrada dessa música — o resto do histórico continua válido. */
export const limparIndiceParaVersaoLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { musicaId, versaoId } = req.data || {};
  if (!musicaId || !versaoId) throw new HttpsError("invalid-argument", "Faltam dados.");

  const indiceSnap = await db.collection(`bases/${baseId}/indiceCantores`).get();
  const lote = db.batch();
  let limpos = 0;
  indiceSnap.forEach((doc) => {
    const musicas = doc.data().musicas || [];
    const filtradas = musicas.filter((m) => !(m.musicaId === musicaId && m.versaoId === versaoId));
    if (filtradas.length !== musicas.length) {
      lote.set(doc.ref, { musicas: filtradas }, { merge: true });
      limpos++;
    }
  });
  if (limpos) await lote.commit();
  return { limpos };
});

/* ── CONFIRMAÇÃO DE PRESENÇA (Base Louvor) ────────────────────
 * Primeira base a sair do "sem confirmação de presença, quem não
 * pode avisa pelo WhatsApp" (decisão registada no CLAUDE.md da
 * Apoio) — pedido explícito do líder, 2026-09. Só depois de a escala
 * estar `publicado` (Fase C) é que faz sentido pedir confirmação —
 * antes disso a pessoa nem sabe que está escalada a sério. `pessoaId`
 * é só do líder/auxiliar, mesmo padrão de responderEnquete: corrigir
 * quem esqueceu, sem depender do telemóvel da pessoa.
 *
 * `resposta: "vai" | "nao_vai"` — não é só um booleano de "confirmei
 * sim/não": quem não pode vir já deixa a justificativa aqui, no
 * mesmo gesto (pedido do líder, "mais intuitivo"). Documento sempre
 * existe depois da primeira resposta (troca de "vai" para "nao_vai"
 * e vice-versa é sempre um novo `set`, nunca delete) — "responder de
 * novo" mostra sempre a última resposta, não "desfaz" para vazio. */
const RESPOSTAS_PRESENCA = new Set(["vai", "nao_vai"]);
export const confirmarPresencaLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { eventoId, pessoaId, resposta, justificativa = "" } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!RESPOSTAS_PRESENCA.has(resposta)) throw new HttpsError("invalid-argument", "Resposta inválida.");

  let alvo = uid;
  if (pessoaId && pessoaId !== uid) {
    if (!PAPEIS_LIDER.has(req.auth.token.papel)) {
      throw new HttpsError("permission-denied", "Só o líder pode confirmar por outra pessoa.");
    }
    alvo = pessoaId;
  }

  const escalaRef = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const escalaSnap = await escalaRef.get();
  if (!escalaSnap.exists || !escalaSnap.data().publicado) {
    throw new HttpsError("failed-precondition", "Esta escala ainda não foi publicada.");
  }
  if (!(escalaSnap.data().pessoas || []).includes(alvo)) {
    throw new HttpsError("failed-precondition", "Esta pessoa não está escalada neste culto.");
  }

  const dados = {
    resposta,
    justificativa: resposta === "nao_vai" ? (String(justificativa).trim() || null) : null,
    respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (alvo !== uid) { dados.respondidoPeloLider = true; dados.respondidoPor = uid; }
  await escalaRef.collection("confirmacoes").doc(alvo).set(dados);
  return { ok: true };
});

/** Confirmação de presença no ENSAIO — espelho de confirmarPresencaLouvor
 *  acima, mas o gate é `dataEnsaio` estar definida (não `publicado`):
 *  o ensaio é marcado por definirDetalhesCultoLouvor a qualquer
 *  momento, independente de a escala do culto em si já estar
 *  publicada. Pedido do líder, 2026-09: assim que ele marca a data do
 *  ensaio dentro do cartão do culto (Escala geral), quem já está
 *  escalado nesse culto passa a ter uma confirmação de ensaio
 *  pendente — sem passo extra nenhum, o próprio "está pendente" já
 *  nasce de existir `dataEnsaio` e faltar `confirmacoesEnsaio/{pessoa}`
 *  (ver ouvirConfirmacoesEnsaioDoMes no cliente). Subcoleção própria,
 *  nunca reaproveita `confirmacoes` — são perguntas diferentes (ir ao
 *  ensaio vs. ir ao culto), a pessoa responde às duas em separado. */
export const confirmarPresencaEnsaioLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { eventoId, pessoaId, resposta, justificativa = "" } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!RESPOSTAS_PRESENCA.has(resposta)) throw new HttpsError("invalid-argument", "Resposta inválida.");

  let alvo = uid;
  if (pessoaId && pessoaId !== uid) {
    if (!PAPEIS_LIDER.has(req.auth.token.papel)) {
      throw new HttpsError("permission-denied", "Só o líder pode confirmar por outra pessoa.");
    }
    alvo = pessoaId;
  }

  const escalaRef = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const escalaSnap = await escalaRef.get();
  if (!escalaSnap.exists || !escalaSnap.data().dataEnsaio) {
    throw new HttpsError("failed-precondition", "Este culto ainda não tem ensaio marcado.");
  }
  if (!(escalaSnap.data().pessoas || []).includes(alvo)) {
    throw new HttpsError("failed-precondition", "Esta pessoa não está escalada neste culto.");
  }

  const dados = {
    resposta,
    justificativa: resposta === "nao_vai" ? (String(justificativa).trim() || null) : null,
    respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (alvo !== uid) { dados.respondidoPeloLider = true; dados.respondidoPor = uid; }
  await escalaRef.collection("confirmacoesEnsaio").doc(alvo).set(dados);
  return { ok: true };
});

/** Tipo do culto (Ceia/Contribua/Culto da Família) — era só da Louvor
 *  (eventos/{e}/escalas/louvor.enfase), passou a global em 2026-09
 *  (pedido do líder da Louvor): a Backstage escolhe obrigatoriamente
 *  ao publicar a Ordem do Culto (ver publicarOrdemCulto), qualquer
 *  base lê em eventos/{e}.tipoCulto — um dono só, sem duas fontes de
 *  verdade. Louvor deixou de ter editor próprio (definirDetalhesCultoLouvor
 *  já não aceita `enfase`); o default automático (1º domingo do mês =
 *  Ceia) continua calculado no cliente enquanto a Backstage não
 *  publicou nada para esse culto — ver tipoCultoDefault em
 *  packages/shared/src/lib/tipoCulto.js. */
const TIPOS_CULTO = new Set(["ceia", "contribua", "familia"]);
const HEX_COR = /^#[0-9a-fA-F]{6}$/;

/** Detalhes do culto que não são "quem serve" — cores da roupa, data/
 * hora/local do ensaio, observação do líder. Fica em
 * eventos/{e}/escalas/louvor (não no eventos/{e} global — regra 7 do
 * CLAUDE.md raiz: isto é da base, não da igreja). O gate replica o de
 * guardarEscalaLouvor, tolerante ao documento ainda não existir, em
 * vez de reusar exigeLiderDoCulto — essa exige que a escala já
 * exista, o que bloquearia definir o ensaio antes de escalar
 * ninguém. Cada campo só é escrito se vier no pedido (`!==
 * undefined`), para dar para mudar só um campo sem reenviar tudo.
 * `enfase` já não é aceite aqui — virou `tipoCulto`, global, só a
 * Backstage escreve (ver publicarOrdemCulto). */
export const definirDetalhesCultoLouvor = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");

  const { eventoId, coresRoupa, dataEnsaio, horaEnsaio, localEnsaio, observacao } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();
  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  const souLiderEscala = snap.exists && snap.data().liderEscala === uid;
  if (!souLiderBase && !souLiderEscala) {
    throw new HttpsError("permission-denied",
      "Só o líder da base ou o líder de escala deste culto pode fazer isto.");
  }

  if (coresRoupa !== undefined) {
    if (!Array.isArray(coresRoupa) || coresRoupa.length > 3 || coresRoupa.some((c) => !HEX_COR.test(c))) {
      throw new HttpsError("invalid-argument", "Cores inválidas — até 3 hexadecimais.");
    }
  }

  const dados = { baseId };
  if (coresRoupa !== undefined) dados.coresRoupa = coresRoupa;
  if (dataEnsaio !== undefined) dados.dataEnsaio = dataEnsaio || null;
  if (horaEnsaio !== undefined) dados.horaEnsaio = horaEnsaio || null;
  if (localEnsaio !== undefined) dados.localEnsaio = String(localEnsaio ?? "").trim() || null;
  if (observacao !== undefined) dados.observacaoLider = String(observacao ?? "").trim() || null;

  // Data do ensaio mudou de facto (marcada de novo ou remarcada para
  // outro dia) — limpa quem já tinha confirmado, senão um "sim" dado
  // para o ensaio de sábado ficava a valer sozinho para o de terça
  // que o líder remarcou (pedido do líder, 2026-09: cada vez que
  // marca uma data nova, já manda a confirmação de novo a quem serve
  // nesse culto — isto é o que torna essa confirmação "pendente outra
  // vez" sem precisar de nenhum passo explícito de "enviar"). Nunca
  // dispara ao só definir cores/local/observação.
  const dataEnsaioMudou = dataEnsaio !== undefined && (dataEnsaio || null) !== (snap.exists ? (snap.data().dataEnsaio || null) : null);

  await ref.set(dados, { merge: true });

  if (dataEnsaioMudou) {
    const antigas = await ref.collection("confirmacoesEnsaio").listDocuments();
    if (antigas.length) {
      const lote = db.batch();
      antigas.forEach((d) => lote.delete(d));
      await lote.commit();
    }
  }

  return { ok: true };
});

/* ── ESCALA (Base Comunicação) ──────────────────────────────
 * Lugares por ministério — lista aberta de pessoas (`pessoas: [id]`),
 * sem distinção de titular/aprendiz (essa continua a existir como
 * etiqueta da pessoa em `pessoa.ministerios[id]`, só deixou de
 * limitar a escala a 2 lugares fixos — pedido do líder: às vezes são
 * dois fotógrafos, ou dois do Storymaker, sem ninguém "em treino").
 * Sem "Responsável" rotativo: a Comunicação só tem o líder da base
 * fixo (ver apps/comunicacao/CLAUDE.md), por isso só ele pode gravar
 * a escala e `liderEscala` não é usado (fica sempre null). */
export const guardarEscalaComunicacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (!PAPEIS_LIDER.has(req.auth.token.papel)) {
    throw new HttpsError("permission-denied", "Só o líder da base pode fazer isto.");
  }

  const { eventoId, lugares } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  if (!Array.isArray(lugares)) throw new HttpsError("invalid-argument", "Faltam os lugares.");

  const ref = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const snap = await ref.get();

  const pessoas = new Set();
  const usados = new Set();
  const lugaresLimpos = lugares.map((l) => {
    if (!l?.ministerioId) throw new HttpsError("invalid-argument", "Lugar sem ministério.");
    const idsDoLugar = Array.isArray(l.pessoas) ? l.pessoas.filter(Boolean) : [];
    for (const id of idsDoLugar) {
      if (usados.has(id)) throw new HttpsError("invalid-argument", "Uma pessoa não pode estar em dois lugares no mesmo culto.");
      usados.add(id);
      pessoas.add(id);
    }
    return { ministerioId: l.ministerioId, pessoas: idsDoLugar };
  });

  // quem serve em mais do que uma base não pode ficar escalado nas
  // duas no mesmo culto (mesma regra da Técnica/Apoio/Backstage).
  const pessoasAntigas = new Set(snap.exists ? snap.data().pessoas || [] : []);
  const adicionadas = [...pessoas].filter((id) => !pessoasAntigas.has(id));
  const removidas = [...pessoasAntigas].filter((id) => !pessoas.has(id));
  const multiBase = new Set();
  for (const id of new Set([...adicionadas, ...removidas])) {
    if ((await basesDaPessoa(id)).length > 1) multiBase.add(id);
  }
  for (const id of adicionadas) {
    if (multiBase.has(id)) await garantirSemConflitoCrossBase(eventoId, baseId, id);
  }

  await ref.set({
    baseId, liderEscala: null,
    lugares: lugaresLimpos, pessoas: [...pessoas],
  }, { merge: true });

  for (const id of adicionadas) {
    if (multiBase.has(id)) await marcarIndisponivel(eventoId, baseId, id, "escalado");
  }
  for (const id of removidas) {
    if (multiBase.has(id)) await desmarcarIndisponivel(eventoId, baseId, id);
  }
  return { ok: true };
});

/* ── ESCALA DE TODAS AS BASES (Backstage) ──────────────────────
 * Só quem tem a claim ve_todas_escalas (ver claimsExtraDaBase) — lê
 * a escala publicada de cada base para um evento, sempre em tempo
 * real (nunca uma cópia gravada na escrita, que ficaria desatualizada
 * se alguém mudasse de nome depois, ou nunca existiria em escalas já
 * gravadas antes desta função existir). Cada base resolve os nomes a
 * partir de bases/{baseId}/pessoas — Admin SDK, ignora as rules que
 * de propósito não deixam o cliente ler pessoas de outra base. Duas
 * formas de escala: lista simples (Apoio/Backstage) ou lugares por
 * ministério (Técnica) — devolve os dois formatos já com nomes. */
export const escalasCrossBase = onCall(async (req) => {
  if (req.auth?.token?.ve_todas_escalas !== true) {
    throw new HttpsError("permission-denied", "Sem acesso à escala de outras bases.");
  }
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const basesSnap = await db.collection("bases").get();
  const bases = basesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.ativa !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt"));

  const resultado = await Promise.all(bases.map(async (b) => {
    const base = { baseId: b.id, nome: b.nome ?? b.id, cor: b.cor ?? null };
    const escalaSnap = await db.doc(`eventos/${eventoId}/escalas/${b.id}`).get();
    if (!escalaSnap.exists) return { ...base, tipo: "vazio" };
    const escala = escalaSnap.data();

    if (Array.isArray(escala.lugares) && escala.lugares.length) {
      const idsPessoas = [...new Set(escala.lugares.flatMap((l) => [l.titularId, l.aprendizId]).filter(Boolean))];
      const idsMinisterios = [...new Set(escala.lugares.map((l) => l.ministerioId).filter(Boolean))];
      const [pessoasSnaps, ministeriosSnaps] = await Promise.all([
        Promise.all(idsPessoas.map((id) => refPessoa(b.id, id).get())),
        Promise.all(idsMinisterios.map((id) => db.doc(`bases/${b.id}/ministerios/${id}`).get())),
      ]);
      const pessoaResumo = Object.fromEntries(
        pessoasSnaps.filter((s) => s.exists).map((s) => [
          s.id, { nome: s.data().nome, foto: s.data().foto ?? null, telefone: s.data().telefone ?? "" },
        ])
      );
      const nomeMinisterio = Object.fromEntries(ministeriosSnaps.filter((s) => s.exists).map((s) => [s.id, s.data().nome]));
      const itens = escala.lugares
        .filter((l) => l.titularId)
        .map((l) => ({
          ministerio: nomeMinisterio[l.ministerioId] ?? l.ministerioId,
          titular: pessoaResumo[l.titularId] ?? null,
          aprendiz: l.aprendizId ? (pessoaResumo[l.aprendizId] ?? null) : null,
        }));
      if (!itens.length) return { ...base, tipo: "vazio" };
      return { ...base, tipo: "lugares", itens };
    }

    const pessoas = escala.pessoas || [];
    if (!pessoas.length) return { ...base, tipo: "vazio" };
    const resumo = await nomesDePessoas(b.id, pessoas);
    return {
      ...base, tipo: "pessoas",
      pessoas: pessoas.map((id) => (resumo[id] ? { id, ...resumo[id] } : null)).filter(Boolean),
      liderEscalaId: escala.liderEscala || null,
    };
  }));

  return { bases: resultado };
});

/* ── CATÁLOGO DA CHECKLIST DE TODAS AS BASES (Backstage) ────────
 * Mesma claim ve_todas_escalas de escalasCrossBase — quem já vê a
 * escala de qualquer base também acompanha se a checklist dela está
 * feita, pedido explícito do líder da Backstage. Só o CATÁLOGO
 * (funções, ministério de cada uma, nomes de quem está ativo) vem
 * daqui, pelo Admin SDK — bases/{b}/funcoes, bases/{b}/ministerios e
 * bases/{b}/pessoas são todos restritos a minhaBase nas rules, de
 * propósito. O estado ao vivo ("feito", quem, a que hora) o cliente
 * lê direto de eventos/{e}/checklist, que já é global e em tempo
 * real (rules: allow read: if autenticado()) — não passa por aqui, e
 * não devia: chamar esta função a cada toque de checkbox de
 * qualquer base seria caro e lento, o catálogo (que função existe,
 * de que ministério/fase) muda muito menos que o estado dela.
 *
 * Devolve uma lista achatada por base — `fase` e `ministerioId/Nome`
 * vêm em cada função, não pré-agrupados: quem lê (Checklists.jsx)
 * separa primeiro por fase (Pré-culto/Durante/Pós-culto, a categoria
 * da tela) e só depois por ministério dentro de cada categoria — uma
 * função de "Fotografia" pode ser pré-culto, outra da mesma pessoa
 * pode ser durante; agrupar por ministério antes de fase misturava
 * as duas. */
export const checklistCrossBase = onCall(async (req) => {
  if (req.auth?.token?.ve_todas_escalas !== true) {
    throw new HttpsError("permission-denied", "Sem acesso à checklist de outras bases.");
  }
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const basesSnap = await db.collection("bases").get();
  const bases = basesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.ativa !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt"));

  const resultado = await Promise.all(bases.map(async (b) => {
    const base = { baseId: b.id, nome: b.nome ?? b.id, cor: b.cor ?? null };
    const [funcoesSnap, ministeriosSnap, pessoasSnap] = await Promise.all([
      db.collection(`bases/${b.id}/funcoes`).where("ativa", "==", true).get(),
      db.collection(`bases/${b.id}/ministerios`).get(),
      db.collection(`bases/${b.id}/pessoas`).where("ativo", "==", true).get(),
    ]);
    const ministerios = Object.fromEntries(ministeriosSnap.docs.map((d) => [d.id, d.data()]));
    const pessoas = Object.fromEntries(pessoasSnap.docs.map((d) => [d.id, d.data().nome]));
    const funcoes = funcoesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((f) => !f.eventoId || f.eventoId === eventoId)
      .map((f) => ({
        id: f.id, nome: f.nome, fase: f.fase || "pre",
        ministerioId: f.ministerioId ?? null,
        ministerioNome: f.ministerioId ? (ministerios[f.ministerioId]?.nome ?? null) : null,
        ministerioCor: f.ministerioId ? (ministerios[f.ministerioId]?.cor ?? null) : null,
      }));

    return { ...base, funcoes, pessoas, total: funcoes.length };
  }));

  return { bases: resultado };
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
  // bases/{b}.feedbackAberto (hoje só a Backstage) — qualquer voluntário
  // da base escreve, não só o líder de escala do culto. Nas outras
  // bases o comportamento não muda: só líder de escala/líder da base.
  let uid = req.auth?.uid;
  if (req.auth?.token?.feedback_aberto === true) {
    if (!uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  } else {
    ({ uid } = await exigeLiderDoCulto(req, eventoId));
  }
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

/* ── ACOMODAÇÃO (Base Pessoal): fechar/corrigir o mapa do culto ─
 * Marcar lugares é escrita direta do cliente (ver firestore.rules,
 * eventos/{evento}/acomodacao/mapa), porque tem de funcionar offline.
 * Fechar e corrigir a data, porém, passam pelo servidor: os números do
 * resumo têm de vir do estado realmente gravado e uma mudança de data
 * não pode deixar o mapa antigo por engano no próximo domingo. */

function lugaresIniciaisAcomodacao(planta) {
  const fileiras = Array.isArray(planta?.fileiras) ? planta.fileiras : [];
  const porFileira = fileiras[0]?.lugares ?? 12;
  const reservados = new Set(planta?.reservados ?? []);
  const bloqueados = new Set(planta?.bloqueiosPermanentes ?? []);
  const lugares = {};

  fileiras.forEach((fileira) => {
    for (let n = 1; n <= porFileira; n++) {
      const id = `${fileira.id}${n}`;
      lugares[id] = reservados.has(id) ? "reservado" : bloqueados.has(id) ? "bloqueado" : "livre";
    }
  });
  (planta?.fileirasExtra ?? []).forEach((fileira) => {
    if (!fileiras.some((f) => f.id === fileira.atras)) return;
    (fileira.colunas ?? []).forEach((_, indice) => {
      const id = `${fileira.id}${indice + 1}`;
      lugares[id] = reservados.has(id) ? "reservado" : bloqueados.has(id) ? "bloqueado" : "livre";
    });
  });
  return lugares;
}

/** Reservas/bloqueios e o número de lugares podem mudar entre duas
 * versões da planta. Para decidir se um mapa tem trabalho real, só
 * contam os estados que registam presença: ocupado e visitante. */
function mapaTemOcupacao(lugares) {
  return Object.values(lugares || {}).some((estado) => estado === "ocupado" || estado === "visitante");
}

function resumoAcomodacao(eventoId, lugares, uid) {
  const contagem = { livre: 0, ocupado: 0, visitante: 0, reservado: 0, bloqueado: 0 };
  Object.values(lugares).forEach((estado) => { if (estado in contagem) contagem[estado]++; });
  const ocupados = contagem.ocupado + contagem.visitante;
  const capacidadeUtil = Object.keys(lugares).length - contagem.reservado - contagem.bloqueado;
  return {
    eventoId,
    ocupados: contagem.ocupado, visitantes: contagem.visitante,
    livres: contagem.livre, reservados: contagem.reservado, bloqueados: contagem.bloqueado,
    capacidadeUtil, percentagem: capacidadeUtil ? ocupados / capacidadeUtil : 0,
    fechadoEm: admin.firestore.FieldValue.serverTimestamp(), fechadoPor: uid,
  };
}

function hojeEmLisboa() {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}
export const fecharAcomodacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (baseId !== "pessoal") throw new HttpsError("permission-denied", "Só a Base Pessoal tem Acomodação.");

  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  if (!souLiderBase) {
    const atribuicao = await db.doc(`eventos/${eventoId}/atribuicoes/drive`).get();
    const souDrive = atribuicao.exists && (atribuicao.data().pessoas || []).includes(uid);
    if (!souDrive) throw new HttpsError("permission-denied", "Só quem tem a função Mapa neste culto pode fechar.");
  }

  const mapaRef = db.doc(`eventos/${eventoId}/acomodacao/mapa`);
  const mapa = await mapaRef.get();
  if (!mapa.exists) throw new HttpsError("not-found", "Este culto ainda não tem mapa.");
  if (mapa.data().fechado) throw new HttpsError("failed-precondition", "Este culto já foi fechado.");

  const resumo = resumoAcomodacao(eventoId, mapa.data().lugares || {}, uid);

  const lote = db.batch();
  lote.set(db.doc(`bases/pessoal/acomodacaoResumos/${eventoId}`), resumo);
  lote.update(mapaRef, { fechado: true });
  await lote.commit();

  return { ok: true, resumo: { ...resumo, fechadoEm: null } };
});

/** Move um mapa preenchido para a data certa e reinicia o mapa de
 * origem. Só a líder da Base Pessoal pode fazê-lo: é uma correção de
 * histórico, não uma marcação operacional. O destino tem de ser um
 * culto real e não pode ter presença registada nem resumo, para nunca apagar dados.
 * Se a data escolhida já passou, o mapa chega fechado e com o resumo
 * calculado, para aparecer imediatamente no histórico. */
export const corrigirDataMapaAcomodacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (baseId !== "pessoal" || !PAPEIS_LIDER.has(req.auth.token.papel)) {
    throw new HttpsError("permission-denied", "Só a líder da Base Pessoal pode corrigir a data do mapa.");
  }

  const { eventoId, novoEventoId } = req.data || {};
  const dataValida = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataValida.test(eventoId || "") || !dataValida.test(novoEventoId || "")) {
    throw new HttpsError("invalid-argument", "Escolhe datas de culto válidas.");
  }
  if (eventoId === novoEventoId) throw new HttpsError("invalid-argument", "Escolhe uma data diferente.");

  const origemRef = db.doc(`eventos/${eventoId}/acomodacao/mapa`);
  const destinoRef = db.doc(`eventos/${novoEventoId}/acomodacao/mapa`);
  const eventoDestinoRef = db.doc(`eventos/${novoEventoId}`);
  const resumoDestinoRef = db.doc(`bases/pessoal/acomodacaoResumos/${novoEventoId}`);
  const plantaRef = db.doc("bases/pessoal/acomodacao/planta");
  const fecharDestino = novoEventoId < hojeEmLisboa();

  await db.runTransaction(async (tx) => {
    const [origem, destino, eventoDestino, resumoDestino, planta] = await Promise.all([
      tx.get(origemRef), tx.get(destinoRef), tx.get(eventoDestinoRef), tx.get(resumoDestinoRef), tx.get(plantaRef),
    ]);
    if (!origem.exists) throw new HttpsError("not-found", "O mapa que queres corrigir já não existe.");
    if (origem.data().fechado) throw new HttpsError("failed-precondition", "Reabre este mapa antes de corrigir a data.");
    if (!eventoDestino.exists) throw new HttpsError("not-found", "Não existe um culto nessa data.");
    if (!planta.exists) throw new HttpsError("failed-precondition", "A planta do auditório não está configurada.");
    const lugaresIniciais = lugaresIniciaisAcomodacao(planta.data());
    const destinoTemDados = destino.exists
      && (destino.data().fechado || mapaTemOcupacao(destino.data().lugares));
    if (destinoTemDados || resumoDestino.exists) {
      throw new HttpsError("already-exists", "Já há dados de mapa para a data escolhida. Não substituímos dados existentes.");
    }

    const dadosOrigem = origem.data();
    const lugares = dadosOrigem.lugares || {};
    const agora = admin.firestore.FieldValue.serverTimestamp();
    tx.set(destinoRef, {
      eventoId: novoEventoId,
      lugares,
      fechado: fecharDestino,
      criadoEm: dadosOrigem.criadoEm ?? agora,
      iniciadoPor: dadosOrigem.iniciadoPor ?? uid,
      movidoDe: eventoId, movidoEm: agora, movidoPor: uid,
    });
    tx.update(origemRef, {
      lugares: lugaresIniciais, fechado: false,
      atualizadoEm: agora, reiniciadoPor: uid, reiniciadoEm: agora,
    });
    if (fecharDestino) tx.set(resumoDestinoRef, resumoAcomodacao(novoEventoId, lugares, uid));
  });

  return { ok: true, fechado: fecharDestino };
});

/** Desfaz um fecho: apaga o resumo arquivado e devolve o mapa a
 *  "aberto" (fechado:false), para poder corrigir e fechar de novo.
 *  Mesma permissão de quem fecha (líder ou quem tem a função Mapa
 *  desse culto). O lápis "Editar" na lista de "Cultos fechados"
 *  (ResumosAcomodacao.jsx) chama isto — as regras não deixam apagar
 *  `acomodacaoResumos` direto do cliente, só por aqui. */
export const reabrirAcomodacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (baseId !== "pessoal") throw new HttpsError("permission-denied", "Só a Base Pessoal tem Acomodação.");

  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  if (!souLiderBase) {
    const atribuicao = await db.doc(`eventos/${eventoId}/atribuicoes/drive`).get();
    const souDrive = atribuicao.exists && (atribuicao.data().pessoas || []).includes(uid);
    if (!souDrive) throw new HttpsError("permission-denied", "Só quem tem a função Mapa neste culto pode reabrir.");
  }

  const resumoRef = db.doc(`bases/pessoal/acomodacaoResumos/${eventoId}`);
  const mapaRef = db.doc(`eventos/${eventoId}/acomodacao/mapa`);
  const [resumo, mapa] = await Promise.all([resumoRef.get(), mapaRef.get()]);
  if (!resumo.exists) throw new HttpsError("not-found", "Este culto não tem resumo fechado.");

  const lote = db.batch();
  lote.delete(resumoRef);
  if (mapa.exists) lote.update(mapaRef, { fechado: false });
  await lote.commit();

  return { ok: true };
});

/** Tira um resumo fechado da lista, sem reabrir o mapa (o culto
 *  continua fechado, só de leitura) — para descartar um teste ou um
 *  registo indesejado sem devolver o culto a editável. Marca
 *  `arquivado:true` em vez de apagar o documento a sério (histórico),
 *  mesmo padrão do `arquivado` do Formulário. O "X" na lista de
 *  "Cultos fechados" chama isto — mesma permissão de reabrirAcomodacao. */
export const arquivarResumoAcomodacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (baseId !== "pessoal") throw new HttpsError("permission-denied", "Só a Base Pessoal tem Acomodação.");

  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const souLiderBase = PAPEIS_LIDER.has(req.auth.token.papel);
  if (!souLiderBase) {
    const atribuicao = await db.doc(`eventos/${eventoId}/atribuicoes/drive`).get();
    const souDrive = atribuicao.exists && (atribuicao.data().pessoas || []).includes(uid);
    if (!souDrive) throw new HttpsError("permission-denied", "Só quem tem a função Mapa neste culto pode excluir.");
  }

  const resumoRef = db.doc(`bases/pessoal/acomodacaoResumos/${eventoId}`);
  const resumo = await resumoRef.get();
  if (!resumo.exists) throw new HttpsError("not-found", "Este culto não tem resumo fechado.");

  await resumoRef.set({ arquivado: true }, { merge: true });
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
  exigePodePublicarCulto(req);
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
  exigePodePublicarCulto(req);
  const { eventoId, momentos, avisos, inicio, fim, portasAbertas, pdfUrl, origem, tipoCulto } = req.data || {};
  if (!eventoId || !Array.isArray(momentos) || !Array.isArray(avisos)) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  if (!TIPOS_CULTO.has(tipoCulto)) {
    throw new HttpsError("invalid-argument", "Falta escolher o tipo de culto (Ceia, Contribua ou Culto da Família).");
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
    tipoCulto,
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
  exigePodePublicarCulto(req);
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

/* ── NOTAS DA BASE QUE PUBLICA, POR CIMA DA ORDEM DO CULTO ─────
 * Separado de `frase` (do líder de escala, já existia) — estas notas
 * são visivelmente da base que publica (ver CLAUDE.md da Backstage),
 * nunca confundidas com o que o pastor escreveu no PDF. Campo vazio
 * não existe: string vazia apaga o campo, não deixa "" gravado. */
export const definirNotasCulto = onCall(async (req) => {
  const uid = req.auth.uid;
  exigePodePublicarCulto(req);
  const { eventoId, notas } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  const limpo = String(notas ?? "").trim();
  await db.doc(`eventos/${eventoId}`).set({
    notas: limpo || admin.firestore.FieldValue.delete(),
    notasPor: limpo ? uid : admin.firestore.FieldValue.delete(),
    notasEm: limpo ? admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.delete(),
  }, { merge: true });
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
  if (PAPEIS_LIDER.has(req.auth.token.papel)) return baseId;

  const hoje = new Date().toISOString().slice(0, 10);
  const escala = await db.doc(`eventos/${hoje}/escalas/${baseId}`).get();
  if (escala.exists && escala.data().liderEscala === uid) return baseId;

  throw new HttpsError("permission-denied",
    "Só o líder da base, ou o líder de escala no dia do culto, pode gerir o inventário.");
}

export const criarItemInventario = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { itemId, nome, categoria, unidade, minimo, quantidade, foto, observacoes } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o item.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (!categoria?.trim()) throw new HttpsError("invalid-argument", "Falta a categoria.");
  await db.doc(`bases/${baseId}/inventario/${itemId}`).set({
    nome: nome.trim(), categoria: categoria.trim(), unidade: unidade?.trim() || "unidades",
    minimo: Number(minimo) || 0, quantidade: Number(quantidade) || 0, foto: foto ?? null,
    observacoes: observacoes?.trim() || null,
    ativo: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { itemId };
});

export const guardarItemInventario = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { itemId, nome, categoria, unidade, minimo, quantidade, foto, observacoes } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o item.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  if (!categoria?.trim()) throw new HttpsError("invalid-argument", "Falta a categoria.");
  await db.doc(`bases/${baseId}/inventario/${itemId}`).set({
    nome: nome.trim(), categoria: categoria.trim(), unidade: unidade?.trim() || "unidades",
    minimo: Number(minimo) || 0, quantidade: Number(quantidade) || 0, foto: foto ?? null,
    observacoes: observacoes?.trim() || null,
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

/* ── LISTA DE COMPRAS ──────────────────────────────────────────
 * Acrescentar/tirar/mexer quantidade são escrita direta do cliente
 * (ver firestore.rules — rápido, sem round-trip a uma função). Esta
 * função só entra numa situação: não há NENHUMA lista aberta ainda
 * (primeiro item de sempre, ou depois de a última ter sido enviada
 * sem ninguém ter acrescentado nada à seguinte) — aí "abre-se
 * sozinha", sem exigir a líder para começar. Fechar/enviar continuam
 * restritos a líder da base ou responsável do culto de hoje (mesmo
 * exigeGestorInventario do módulo Inventário). Fechar já cria a
 * lista seguinte, vazia — nunca fica um momento sem lista aberta. */
export const adicionarItemListaCompras = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { itemId, nome } = req.data || {};
  if (!itemId || !nome?.trim()) throw new HttpsError("invalid-argument", "Falta o item.");

  const col = db.collection(`bases/${baseId}/listasCompras`);
  return db.runTransaction(async (tx) => {
    const abertaSnap = await tx.get(col.where("estado", "==", "aberta").limit(1));
    const existente = abertaSnap.empty ? null : abertaSnap.docs[0];
    const ref = existente ? existente.ref : col.doc();
    const itensAtuais = existente ? existente.data().itens || [] : [];
    if (itensAtuais.some((i) => i.itemId === itemId)) return { jaAdicionado: true, listaId: ref.id };

    const novoItem = {
      itemId, nome: nome.trim(), quantidade: 1, adicionadoPor: uid, adicionadoEm: admin.firestore.Timestamp.now(),
    };
    tx.set(ref, {
      estado: "aberta",
      itens: [...itensAtuais, novoItem],
      criadaEm: existente ? existente.data().criadaEm : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { jaAdicionado: false, listaId: ref.id };
  });
});

export const fecharListaCompras = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { listaId } = req.data || {};
  if (!listaId) throw new HttpsError("invalid-argument", "Falta a lista.");
  const ref = db.doc(`bases/${baseId}/listasCompras/${listaId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Lista não encontrada.");
  if (snap.data().estado !== "aberta") throw new HttpsError("failed-precondition", "Esta lista já não está aberta.");
  const lote = db.batch();
  lote.update(ref, {
    estado: "fechada",
    fechadaEm: admin.firestore.FieldValue.serverTimestamp(),
    fechadaPor: req.auth.uid,
  });
  lote.set(db.collection(`bases/${baseId}/listasCompras`).doc(), {
    estado: "aberta", itens: [], criadaEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await lote.commit();
  return { ok: true };
});

export const enviarListaCompras = onCall(async (req) => {
  const baseId = await exigeGestorInventario(req);
  const { listaId } = req.data || {};
  if (!listaId) throw new HttpsError("invalid-argument", "Falta a lista.");
  const ref = db.doc(`bases/${baseId}/listasCompras/${listaId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Lista não encontrada.");
  if (snap.data().estado !== "fechada") throw new HttpsError("failed-precondition", "Esta lista ainda não foi fechada.");
  await ref.update({
    estado: "enviada",
    enviadaEm: admin.firestore.FieldValue.serverTimestamp(),
    enviadaPor: req.auth.uid,
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

/* ── CULTO ESPECIAL (fora dos domingos) ───────────────────── */
/* ── CULTO ESPECIAL: escopo global vs. de uma base ─────────────
 * `escopo:"global"` é o que sempre existiu (ex.: Culto de Mulheres da
 * Apoio) — visível e disponível à igreja toda, sem pedir confirmação
 * extra: continua aberto a qualquer líder, exatamente como hoje.
 * `escopo:"base"` é novo — evento privado de uma base (ex.: um ensaio
 * só da Técnica). Fica no mesmo documento global (não há como evitar,
 * ver nota em obterEventosDoMes) mas as outras bases filtram-no da
 * própria interface — não é sigilo Firestore, é "não aparece". Só
 * quem tem a claim pode_criar_evento_global (hoje só a Backstage)
 * cria escopo:"global"; qualquer líder cria escopo:"base" para a
 * própria base. */
export const criarCultoEspecial = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { data, tipo, horaCulto = "10:30", horaChegada = "08:00", escopo } = req.data || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) {
    throw new HttpsError("invalid-argument", "Data inválida.");
  }
  if (!tipo?.trim()) throw new HttpsError("invalid-argument", "Falta o nome do culto.");
  if (escopo !== "global" && escopo !== "base") {
    throw new HttpsError("invalid-argument", "Falta dizer se o culto é global ou só desta base.");
  }
  if (escopo === "global" && req.auth.token.pode_criar_evento_global !== true) {
    throw new HttpsError("permission-denied", "A tua base não pode criar eventos globais.");
  }

  // o culto é da igreja toda — por isso é a Cloud Function que grava,
  // não uma escrita direta do cliente (ver firestore.rules)
  const ref = db.doc(`eventos/${data}`);
  const snap = await ref.get();
  // `ativo:false` conta como livre — excluirCultoEspecial já apaga a
  // sério (ver comentário lá), mas um doc `ativo:false` anterior a
  // essa mudança (ou qualquer outro jeito de sobrar um) não pode
  // continuar a prender a data para sempre; `.set()` abaixo substitui
  // o documento inteiro, então recriar aqui já "limpa" o resto sozinho.
  if (snap.exists && snap.data().ativo !== false) {
    throw new HttpsError("already-exists", "Já existe um culto nesse dia.");
  }

  await ref.set({
    data, tipo: tipo.trim(), horaCulto, horaChegada,
    escopo, baseId: escopo === "base" ? baseId : null, dispensadaPor: [],
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { eventoId: data };
});

/* ── EXCLUIR CULTO ESPECIAL ────────────────────────────────
 * Ao contrário do resto do app (ver CLAUDE.md, "nada é apagado"), um
 * culto especial excluído é apagado a sério (pedido do líder,
 * 2026-09) — o id do documento é a própria data (`eventos/{data}`),
 * então um `ativo:false` deixava a data "presa" para sempre: recriar
 * um culto especial no mesmo dia batia sempre no `already-exists` de
 * criarCultoEspecial, mostrando um erro sobre um culto que já não
 * devia contar. Como isto só existe para cultos especiais (nunca
 * domingos, geridos por gerarDomingos) e o líder já confirmou a
 * exclusão explicitamente, arrasta também a própria subcoleção de
 * escala/confirmações desta base para não deixar lixo órfão. */
export const excluirCultoEspecial = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");

  const ref = db.doc(`eventos/${eventoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Culto não encontrado.");
  if (!snap.data().tipo) {
    throw new HttpsError("failed-precondition", "Domingos não se excluem — só cultos especiais.");
  }
  // um evento escopo:"base" só a própria base o exclui — um global
  // continua aberto a qualquer líder, como sempre foi
  if (snap.data().escopo === "base" && snap.data().baseId !== baseId) {
    throw new HttpsError("permission-denied", "Este culto é de outra base.");
  }

  const refEscala = db.doc(`eventos/${eventoId}/escalas/${baseId}`);
  const confirmacoesSnap = await refEscala.collection("confirmacoes").listDocuments();
  const lote = db.batch();
  confirmacoesSnap.forEach((d) => lote.delete(d));
  lote.delete(refEscala);
  lote.delete(ref);
  await lote.commit();
  return { ok: true };
});

/* ── DISPENSAR UMA BASE DE UM EVENTO GLOBAL ───────────────────
 * "Esta base não serve neste evento" — tira-a da próxima geração da
 * enquete desse evento (ver SheetAbrirEnquete/useCultosDoMes) e do
 * calendário dela. Só reversível chamando outra vez sem a base no
 * array (ver reincluirBaseEmEvento, mesmo padrão do array-union). */
export const dispensarBaseDeEvento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  await db.doc(`eventos/${eventoId}`).update({
    dispensadaPor: admin.firestore.FieldValue.arrayUnion(baseId),
  });
  return { ok: true };
});

export const reincluirBaseEmEvento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  await db.doc(`eventos/${eventoId}`).update({
    dispensadaPor: admin.firestore.FieldValue.arrayRemove(baseId),
  });
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

/**
 * Quantas unidades iguais há daquele equipamento. Um registo com
 * `quantidade: 2` em vez de duas fichas "COB esquerdo" e "COB
 * direito": comprar um terceiro passaria a obrigar a inventar um
 * "COB central", e o nome do sítio onde está pendurado não é
 * identidade do equipamento.
 *
 * Qual das unidades avariou fica dito na avaria, não aqui — o estado
 * do registo continua a ser um só, e é o título da melhoria que diz
 * "COB esquerdo".
 */
function quantidadeValida(v) {
  if (v === undefined || v === null || v === "") return 1;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new HttpsError("invalid-argument", "A quantidade tem de ser um número inteiro entre 1 e 999.");
  }
  return n;
}

export const criarEquipamento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId, nome, modelo = "", nSerie = "", local = "", ministerioId = null, foto = null, quantidade } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  await refEquipamento(baseId, itemId).set({
    nome: nome.trim(), modelo: modelo.trim(), nSerie: nSerie.trim(), local: local.trim(),
    ministerioId, foto, quantidade: quantidadeValida(quantidade), estado: "ok", ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { itemId };
});

export const guardarEquipamento = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId, nome, modelo = "", nSerie = "", local = "", ministerioId = null, foto = null, quantidade } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  await refEquipamento(baseId, itemId).set({
    nome: nome.trim(), modelo: modelo.trim(), nSerie: nSerie.trim(), local: local.trim(),
    ministerioId, foto, quantidade: quantidadeValida(quantidade),
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

/* ── EQUIPAMENTOS (Base Comunicação) ───────────────────────────
 * Custódia, não stock — só dois itens, quem está com cada um e desde
 * quando (ver apps/comunicacao/CLAUDE.md). Não é a mesma coleção do
 * "Equipamentos" da Técnica (esse é o inventário em modo património,
 * bases/{b}/inventario) — aqui é bases/{b}/equipamentos, e passar um
 * item tem de gravar o histórico na mesma escrita, por isso é sempre
 * por função, nunca setDoc direto do cliente. */
const refEquipamentoComunicacao = (baseId, id) => db.doc(`bases/${baseId}/equipamentos/${id}`);

export const criarEquipamentoComunicacao = onCall(async (req) => {
  const baseId = exigeLider(req);
  const { itemId, nome, icone = null, responsavelId = null } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  await refEquipamentoComunicacao(baseId, itemId).set({
    nome: nome.trim(), icone, responsavelId, ativo: true,
    desde: responsavelId ? admin.firestore.FieldValue.serverTimestamp() : null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  if (responsavelId) {
    await refEquipamentoComunicacao(baseId, itemId).collection("historico").add({
      paraId: responsavelId, deId: null, em: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { itemId };
});

// qualquer voluntário passa — não é uma decisão do líder, é só dizer
// quem ficou com o quê (ver briefing da base: "Passar" no Início)
export const passarEquipamento = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { itemId, paraId } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "Falta o equipamento.");
  if (!paraId) throw new HttpsError("invalid-argument", "Falta escolher quem fica com o equipamento.");

  const ref = refEquipamentoComunicacao(baseId, itemId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().ativo === false) throw new HttpsError("not-found", "Equipamento não encontrado.");

  const paraSnap = await refPessoa(baseId, paraId).get();
  if (!paraSnap.exists || paraSnap.data().ativo === false) {
    throw new HttpsError("invalid-argument", "Essa pessoa não está ativa nesta base.");
  }

  const deId = snap.data().responsavelId ?? null;
  const agora = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({ responsavelId: paraId, desde: agora }, { merge: true });
  await ref.collection("historico").add({ deId, paraId, em: agora });
  return { ok: true };
});

/* ── SOLICITAÇÕES (raiz — a Comunicação atende as outras bases) ──
 * Coleção na raiz, não aninhada em bases/comunicacao: é escrita por
 * líderes de QUALQUER base e lida por duas bases ao mesmo tempo (quem
 * pediu + a Comunicação). Sempre por Cloud Function, como Wiki/
 * Melhorias — aqui ainda mais: foraDoPrazo tem de ser calculado no
 * servidor, nunca aceite do cliente (ver CLAUDE-comunicacao.md §5.1). */
const STATUS_SOLICITACAO = ["fila", "producao", "revisao", "entregue", "recusada"];
const refSolicitacao = (id) => db.doc(`solicitacoes/${id}`);

async function nomeDaPessoa(baseId, uid) {
  const s = await refPessoa(baseId, uid).get();
  return s.exists ? s.data().nome : null;
}

async function slaDiasMinimosComunicacao() {
  const s = await db.doc("bases/comunicacao").get();
  return s.exists ? (s.data().slaDiasMinimos ?? 3) : 3;
}

function diasEntre(hojeISO, prazoISO) {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hojeISO}T00:00:00Z`)) / MS_DIA);
}

async function exigeMinisterioComunicacaoAtivo(ministerioId) {
  if (!ministerioId) throw new HttpsError("invalid-argument", "Falta escolher para que ministério é.");
  const snap = await db.doc(`bases/comunicacao/ministerios/${ministerioId}`).get();
  if (!snap.exists || snap.data().ativo === false) {
    throw new HttpsError("invalid-argument", "Esse ministério não existe.");
  }
}

const BASES_VALIDAS = ["apoio", "tecnica", "backstage", "comunicacao"];

export const abrirSolicitacao = onCall(async (req) => {
  const baseId = exigeLider(req); // qualquer líder de base — a de quem pede, não a da Comunicação
  const uid = req.auth.uid;
  const { titulo, oQue, ondeUsa, textoFinal = "", linkReferencia = "", prazo, ministerioId, baseSolicitanteId } = req.data || {};
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  if (!oQue?.trim()) throw new HttpsError("invalid-argument", "Falta descrever o que precisas.");
  if (!ondeUsa?.trim()) throw new HttpsError("invalid-argument", "Falta dizer onde isto vai ser usado.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(prazo || ""))) throw new HttpsError("invalid-argument", "Falta o prazo.");
  // as outras bases já não escolhem ministério ao abrir — é a
  // Comunicação que atribui na triagem (ver atribuirSolicitacao). A
  // própria Comunicação, a pedir para si (souComunicacao), continua a
  // escolher já na abertura — tem o contexto para isso; por isso só é
  // obrigatório quando é ela a pedir, mas validado sempre que vier.
  if (baseId === "comunicacao" || ministerioId) {
    await exigeMinisterioComunicacaoAtivo(ministerioId);
  }

  // só a própria Comunicação escolhe de que base é o pedido (pode ser
  // "em nome de" outra base, ou um trabalho interno) — as outras três
  // nunca podem fingir ser outra, o baseId vem sempre do token delas
  let baseFinal = baseId;
  if (baseId === "comunicacao" && baseSolicitanteId) {
    if (!BASES_VALIDAS.includes(baseSolicitanteId)) throw new HttpsError("invalid-argument", "Base inválida.");
    baseFinal = baseSolicitanteId;
  }

  const slaDiasMinimos = await slaDiasMinimosComunicacao();
  const hoje = new Date().toISOString().slice(0, 10);
  const foraDoPrazo = diasEntre(hoje, prazo) < slaDiasMinimos;

  const solicitanteNome = await nomeDaPessoa(baseId, uid);
  const ref = db.collection("solicitacoes").doc();
  await ref.set({
    titulo: titulo.trim(), baseSolicitanteId: baseFinal, solicitanteId: uid, solicitanteNome,
    oQue: oQue.trim(), ondeUsa: ondeUsa.trim(), ministerioId: ministerioId || null,
    designadoParaId: null, designadoParaNome: null,
    textoFinal: textoFinal.trim(), linkReferencia: linkReferencia.trim(),
    prazo, foraDoPrazo, status: "fila",
    responsavelId: null, responsavelNome: null, entregaUrl: null, entregueEm: null,
    transferePendente: null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    historico: [{ de: null, para: "fila", porId: uid, porNome: solicitanteNome, em: admin.firestore.Timestamp.now() }],
  });
  return { id: ref.id, foraDoPrazo };
});

// só quem está em "fila" ainda é do solicitante — depois disso é a
// Comunicação que decide (ver firestore.rules)
const CAMPOS_EDITAVEIS_SOLICITANTE = ["titulo", "oQue", "ondeUsa", "textoFinal", "linkReferencia", "prazo", "ministerioId"];

export const editarSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { id, ...campos } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.solicitanteId !== uid) throw new HttpsError("permission-denied", "Só quem abriu pode editar.");
  if (s.status !== "fila") throw new HttpsError("failed-precondition", "Já saiu da fila — já não dá para editar sozinho.");

  const dados = {};
  for (const chave of CAMPOS_EDITAVEIS_SOLICITANTE) {
    if (campos[chave] === undefined) continue;
    dados[chave] = typeof campos[chave] === "string" ? campos[chave].trim() : campos[chave];
  }
  if (!Object.keys(dados).length) throw new HttpsError("invalid-argument", "Nada para guardar.");
  if (dados.titulo === "") throw new HttpsError("invalid-argument", "Falta o título.");
  if (dados.prazo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.prazo)) throw new HttpsError("invalid-argument", "Prazo inválido.");
    const slaDiasMinimos = await slaDiasMinimosComunicacao();
    dados.foraDoPrazo = diasEntre(new Date().toISOString().slice(0, 10), dados.prazo) < slaDiasMinimos;
  }
  if (dados.ministerioId !== undefined) await exigeMinisterioComunicacaoAtivo(dados.ministerioId);
  await ref.set(dados, { merge: true });
  return { ok: true };
});

// Triagem: o líder aponta o pedido a um ministério e/ou a uma pessoa
// — nenhum dos dois obriga o outro (dá para atribuir só ao ministério,
// e quem for dele decide quem assume; ou já direto a alguém). Só
// enquanto "fila": depois de assumido, é o responsável quem já sabe
// que é dele, não faz sentido re-triagem. Isto é o que faz a
// solicitação aparecer no Início de quem foi apontado (ver
// Inicio.jsx) — nunca escreve responsavelId, só quem "Assumir" faz
// isso.
export const atribuirSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId, papel = req.auth?.token?.papel;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação atribui solicitações.");
  if (papel !== "lider_base") throw new HttpsError("permission-denied", "Só o líder atribui solicitações.");
  const { id, ministerioId = null, designadoParaId = null } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  if (!ministerioId && !designadoParaId) throw new HttpsError("invalid-argument", "Escolhe um ministério ou uma pessoa.");
  if (ministerioId) await exigeMinisterioComunicacaoAtivo(ministerioId);
  let designadoNome = null;
  if (designadoParaId) {
    const p = await refPessoa(baseId, designadoParaId).get();
    if (!p.exists || p.data().ativo === false) throw new HttpsError("invalid-argument", "Essa pessoa não está ativa.");
    designadoNome = p.data().nome;
  }
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.status !== "fila") throw new HttpsError("failed-precondition", "Só dá para atribuir enquanto está na fila.");
  const nome = await nomeDaPessoa(baseId, uid);
  const ministerioFinal = ministerioId ?? s.ministerioId ?? null;
  const historicoEntry = {
    tipo: "atribuicao", porId: uid, porNome: nome,
    ministerioId: ministerioFinal, designadoParaId, designadoParaNome: designadoNome,
    em: admin.firestore.Timestamp.now(),
  };
  await ref.set({
    ministerioId: ministerioFinal,
    designadoParaId, designadoParaNome: designadoNome,
    historico: [...(s.historico || []), historicoEntry],
  }, { merge: true });
  return { ok: true };
});

// qualquer membro da Comunicação, não só o líder — "assumir sem
// passar pelo líder" (ver briefing §6.3). Limpa a atribuição: uma vez
// assumido, quem tem o pedido é responsavelId, designadoParaId já não
// serve para nada (e ficaria a mostrar o banner de "para ti" a quem
// foi apontado, mesmo depois de outra pessoa já ter assumido).
export const assumirSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação assume solicitações.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.status === "entregue" || s.status === "recusada") {
    throw new HttpsError("failed-precondition", "Esta solicitação já foi fechada.");
  }
  if (s.transferePendente) {
    throw new HttpsError("failed-precondition", "Há uma transferência por aceitar — espera essa decisão primeiro.");
  }
  const nome = await nomeDaPessoa(baseId, uid);
  const novoStatus = s.status === "fila" ? "producao" : s.status;
  const historicoEntry = { de: s.status, para: novoStatus, porId: uid, porNome: nome, em: admin.firestore.Timestamp.now() };
  await ref.set({
    responsavelId: uid, responsavelNome: nome, status: novoStatus,
    designadoParaId: null, designadoParaNome: null,
    historico: [...(s.historico || []), historicoEntry],
  }, { merge: true });
  return { ok: true };
});

// Quem pode mover para onde. "responsavel" = uid == s.responsavelId;
// "lider" = req.auth.token.papel == 'lider_base'. A revisão é o líder
// a aprovar (nunca quem produziu) — pedido explícito: "a revisão é
// feita por um líder". producao→revisao é o próprio a dizer "acabei,
// olha lá isto"; revisao→entregue/producao é sempre o líder a decidir.
const TRANSICOES_SOLICITACAO = {
  producao: { revisao: "responsavel" },
  revisao: { entregue: "lider", producao: "lider" },
};

export const mudarStatusSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação muda o estado.");
  const { id, novoStatus, entregaUrl, motivo = "" } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  if (!STATUS_SOLICITACAO.includes(novoStatus)) throw new HttpsError("invalid-argument", "Estado inválido.");
  if (novoStatus === "recusada" && !motivo.trim()) {
    throw new HttpsError("invalid-argument", "Falta o motivo da recusa.");
  }

  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  const souLider = PAPEIS_LIDER.has(req.auth.token.papel);

  if (novoStatus === "recusada") {
    if (s.responsavelId !== uid) throw new HttpsError("permission-denied", "Só quem está a produzir pode recusar.");
    if (s.status === "entregue" || s.status === "recusada") {
      throw new HttpsError("failed-precondition", "Esta solicitação já foi fechada.");
    }
  } else {
    const quemPode = TRANSICOES_SOLICITACAO[s.status]?.[novoStatus];
    if (!quemPode) throw new HttpsError("failed-precondition", `Não dá para passar de "${s.status}" para "${novoStatus}".`);
    if (quemPode === "responsavel" && s.responsavelId !== uid) {
      throw new HttpsError("permission-denied", "Só quem está a produzir pode enviar para revisão.");
    }
    if (quemPode === "lider" && !souLider) {
      throw new HttpsError("permission-denied", "Só o líder decide isto na revisão.");
    }
  }
  if (novoStatus === "revisao" && !entregaUrl?.trim()) {
    throw new HttpsError("invalid-argument", "Falta o link da entrega, para o líder rever.");
  }
  if (novoStatus === "entregue" && !entregaUrl?.trim() && !s.entregaUrl) {
    throw new HttpsError("invalid-argument", "Falta o link da entrega.");
  }

  const nome = await nomeDaPessoa(baseId, uid);
  const historicoEntry = {
    de: s.status, para: novoStatus, porId: uid, porNome: nome,
    em: admin.firestore.Timestamp.now(), ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
  };
  const dados = { status: novoStatus, historico: [...(s.historico || []), historicoEntry] };
  if (entregaUrl?.trim() && (novoStatus === "revisao" || novoStatus === "entregue")) {
    dados.entregaUrl = entregaUrl.trim();
  }
  if (novoStatus === "entregue") {
    dados.entregueEm = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(dados, { merge: true });
  return { ok: true };
});

// qualquer voluntário da Comunicação transfere para outro (ou para
// si mesmo — pegar uma solicitação que está com outra pessoa, ex.:
// abriste o card da Ana e queres pôr o teu nome) — não é decisão do
// líder, é só "isto fica melhor contigo". Fica pendente até quem
// recebe aceitar (aparece no Início dele) ou recusar (volta para a
// Fila, sem responsável — pedido explícito do líder).
export const transferirSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação transfere solicitações.");
  const { id, paraId } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  if (!paraId) throw new HttpsError("invalid-argument", "Falta escolher para quem.");

  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.status === "entregue" || s.status === "recusada") {
    throw new HttpsError("failed-precondition", "Esta solicitação já foi fechada.");
  }
  if (s.transferePendente) {
    throw new HttpsError("failed-precondition", "Já há uma transferência por aceitar.");
  }
  const paraSnap = await refPessoa(baseId, paraId).get();
  if (!paraSnap.exists || paraSnap.data().ativo === false) {
    throw new HttpsError("invalid-argument", "Essa pessoa não está ativa na Comunicação.");
  }

  const nome = await nomeDaPessoa(baseId, uid);
  const paraNome = paraSnap.data().nome;
  const historicoEntry = {
    tipo: "transferencia", de: nome, para: paraNome, porId: uid, porNome: nome,
    em: admin.firestore.Timestamp.now(),
  };
  await ref.set({
    transferePendente: { paraId, paraNome, deId: uid, deNome: nome, em: admin.firestore.Timestamp.now() },
    historico: [...(s.historico || []), historicoEntry],
  }, { merge: true });
  return { ok: true };
});

export const aceitarTransferencia = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação aceita transferências.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.transferePendente?.paraId !== uid) throw new HttpsError("permission-denied", "Esta transferência não é para ti.");

  const nome = await nomeDaPessoa(baseId, uid);
  const novoStatus = s.status === "fila" ? "producao" : s.status;
  const historicoEntry = { tipo: "transferencia_aceite", porId: uid, porNome: nome, em: admin.firestore.Timestamp.now() };
  await ref.set({
    responsavelId: uid, responsavelNome: nome, status: novoStatus, transferePendente: null,
    historico: [...(s.historico || []), historicoEntry],
  }, { merge: true });
  return { ok: true };
});

export const recusarTransferencia = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação recusa transferências.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.transferePendente?.paraId !== uid) throw new HttpsError("permission-denied", "Esta transferência não é para ti.");

  const nome = await nomeDaPessoa(baseId, uid);
  const historicoEntry = { tipo: "transferencia_recusada", porId: uid, porNome: nome, em: admin.firestore.Timestamp.now() };
  await ref.set({
    status: "fila", responsavelId: null, responsavelNome: null, transferePendente: null,
    historico: [...(s.historico || []), historicoEntry],
  }, { merge: true });
  return { ok: true };
});

// "Nada é apagado, é desativado" (ver CLAUDE.md raiz) — excluir marca
// `ativo: false`, nunca `ref.delete()`. Qualquer estágio, inclusive
// entregue/recusada: pedido do líder para não ficar sujando o campo
// com pedidos já fechados. Só o líder da Comunicação, como
// `excluirEnquete` — quem produziu/assumiu não decide isto sozinho.
export const excluirSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || baseId !== "comunicacao") throw new HttpsError("permission-denied", "Só a Comunicação exclui solicitações.");
  if (!PAPEIS_LIDER.has(req.auth.token.papel)) throw new HttpsError("permission-denied", "Só o líder exclui solicitações.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  await ref.set({ ativo: false }, { merge: true });
  return { ok: true };
});

// O lado do solicitante: o líder da base que abriu cancela o próprio
// pedido — "abriu errado" ou já não precisa. Só enquanto "fila": uma
// vez que a Comunicação assumiu, já investiu trabalho nisso, cancelar
// sozinho desapareceria sem avisar quem está a produzir — a partir
// daí é conversa com a Comunicação, não um botão. Mesma regra de
// sempre: `ativo: false`, nunca apaga o documento.
export const excluirMinhaSolicitacao = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId, papel = req.auth?.token?.papel;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  if (!PAPEIS_LIDER.has(papel)) throw new HttpsError("permission-denied", "Só o líder da base exclui um pedido.");
  const { id } = req.data || {};
  if (!id) throw new HttpsError("invalid-argument", "Falta a solicitação.");
  const ref = refSolicitacao(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Solicitação não encontrada.");
  const s = snap.data();
  if (s.baseSolicitanteId !== baseId) throw new HttpsError("permission-denied", "Este pedido não é desta base.");
  if (s.status !== "fila") throw new HttpsError("failed-precondition", "Já foi assumido — fala com a Comunicação para cancelar.");
  await ref.set({ ativo: false }, { merge: true });
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
  // `marcaAvaria` separa as duas coisas que se abrem sobre um mesmo
  // equipamento: "o COB esquerdo está a piscar" põe o equipamento em
  // baixo; "comprar cabos XLR para testar" não põe — é trabalho a
  // fazer, não uma avaria. Sem isto, qualquer melhoria ligada a um
  // equipamento marcava-o avariado, e não havia como registar a
  // segunda sem mentir sobre a primeira.
  // O `true` por omissão mantém o comportamento de quem já chamava
  // isto sem o campo (o "Reportar avaria" que já existia).
  const {
    melhoriaId, titulo, descricao = "", foto = null, equipamentoId = null,
    ministerioId = null, gravidade, marcaAvaria = true,
  } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta o id da melhoria.");
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título.");
  if (!GRAVIDADES.includes(gravidade)) throw new HttpsError("invalid-argument", "Gravidade inválida.");

  const avaria = !!equipamentoId && marcaAvaria !== false;
  const lote = db.batch();
  const ref = refMelhoria(baseId, melhoriaId);
  lote.set(ref, {
    titulo: titulo.trim(), descricao: descricao.trim(), foto, equipamentoId, ministerioId, gravidade,
    estado: "aberta", previsao: null, marcaAvaria: avaria,
    abertaPor: uid, abertaEm: admin.firestore.FieldValue.serverTimestamp(),
    resolvidaPor: null, resolvidaEm: null, notaResolucao: null, fotoResolucao: null, ativo: true,
  });
  if (avaria) {
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

/**
 * O estado do equipamento é uma consequência das melhorias abertas
 * sobre ele, não um campo que alguém escreve à mão — não há tela em
 * lado nenhum que o defina diretamente. Sempre que uma melhoria sai
 * de cena (resolvida ou excluída), o estado tem de ser recalculado.
 *
 * Fazer isto por dedução, e não "resolver → põe ok", evita os dois
 * enganos simétricos: dar por reparado um equipamento que ainda tem
 * outra avaria aberta, e deixá-lo avariado para sempre quando a única
 * avaria dele foi excluída.
 *
 * `ignorarId` é a melhoria que está a sair agora: ainda não commitou,
 * por isso a leitura ainda a traz.
 */
async function reavaliarEstadoEquipamento(lote, baseId, equipamentoId, ignorarId) {
  if (!equipamentoId) return;
  const abertas = await cMelhorias(baseId)
    .where("equipamentoId", "==", equipamentoId)
    .where("ativo", "==", true)
    .get();
  const emBaixo = equipamentoEmBaixo(
    abertas.docs.map((d) => ({ id: d.id, ...d.data() })), ignorarId);
  lote.set(refEquipamento(baseId, equipamentoId), { estado: emBaixo ? "avariado" : "ok" }, { merge: true });
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
  if (estado === "aberta" && !PAPEIS_LIDER.has(req.auth.token.papel)) {
    throw new HttpsError("permission-denied", "Só o líder da base reabre uma melhoria.");
  }
  if (m.estado === "resolvida" && !PAPEIS_LIDER.has(req.auth.token.papel)) {
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

/**
 * Quem fica encarregue de tratar de uma melhoria. Vários, de
 * propósito: "comprei os cabos, agora alguém tem de os testar no
 * domingo" são duas pessoas no mesmo assunto, não duas melhorias.
 *
 * Fica na melhoria e não numa subcoleção porque o Início precisa de
 * responder a "o que é meu?" numa leitura só — o `wikiIndice` existe
 * pela mesma razão, o Firestore não faz junções.
 *
 * Qualquer voluntário pode atribuir, incluindo a si próprio: quem
 * está a tratar do assunto sabe melhor do que o líder quem falta
 * chamar, e o líder vê tudo à mesma no painel.
 */
export const definirResponsaveisMelhoria = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { melhoriaId, responsaveis } = req.data || {};
  if (!melhoriaId) throw new HttpsError("invalid-argument", "Falta a melhoria.");
  if (!Array.isArray(responsaveis)) throw new HttpsError("invalid-argument", "Responsáveis inválidos.");

  // Só gente ativa DESTA base: um uid à mão no pedido não pode pôr
  // alguém de outra base — ou já desativado — a aparecer nas tarefas.
  const limpos = [...new Set(responsaveis.filter((x) => typeof x === "string" && x))];
  if (limpos.length > 12) throw new HttpsError("invalid-argument", "Responsáveis a mais.");
  for (const p of limpos) {
    const snap = await db.doc(`bases/${baseId}/pessoas/${p}`).get();
    if (!snap.exists || snap.data().ativo === false) {
      throw new HttpsError("invalid-argument", "Só voluntários ativos desta base.");
    }
  }

  await obterMelhoria(baseId, melhoriaId);
  const ref = refMelhoria(baseId, melhoriaId);
  const lote = db.batch();
  lote.set(ref, { responsaveis: limpos }, { merge: true });
  lote.set(ref.collection("eventos").doc(), {
    tipo: "responsaveis", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(),
    texto: String(limpos.length),
  });
  await lote.commit();
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
  await reavaliarEstadoEquipamento(lote, baseId, m.equipamentoId, melhoriaId);
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
  // Só o líder da base, por decisão dele (17/08/2026). Antes também
  // quem abriu podia: a regra mudou porque excluir apaga o registo, e
  // quem reportou tem a saída certa em "Concluir" — que exige nota e
  // fica como histórico. A interface já só mostra o botão ao líder;
  // isto fecha a mesma regra do lado do servidor, que é onde o
  // `CLAUDE.md` manda o papel ser verificado.
  if (!PAPEIS_LIDER.has(req.auth.token.papel)) {
    throw new HttpsError("permission-denied", "Só o líder da base pode excluir uma avaria.");
  }
  const m = await obterMelhoria(baseId, melhoriaId);

  const lote = db.batch();
  const ref = refMelhoria(baseId, melhoriaId);
  lote.set(ref, { ativo: false }, { merge: true });
  // Fica o rasto de quem desfez, mesmo com a melhoria fora das listas:
  // o documento continua a existir (regra 5 — nada é apagado).
  lote.set(ref.collection("eventos").doc(), {
    tipo: "exclusao", autorId: uid, quando: admin.firestore.FieldValue.serverTimestamp(),
    texto: "Excluída.",
  });

  // O equipamento tem de voltar a `ok`, senão fica avariado para
  // sempre: sem melhoria ativa a apontar para ele, deixa de haver
  // sítio na app por onde o desmarcar. Era o que acontecia até aqui —
  // bastava um toque errado no "Reportar avaria" e o equipamento
  // ficava encravado no painel de avarias sem saída.
  //
  // Só se mais nenhuma melhoria ativa o mantiver em baixo: dois
  // relatos sobre o mesmo equipamento são normais, e desfazer um não
  // pode dar o outro por resolvido.
  await reavaliarEstadoEquipamento(lote, baseId, m.equipamentoId, melhoriaId);

  await lote.commit();
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

/* pessoaId diferente do próprio uid só é aceite do líder — é como
 * corrige o voto errado de um voluntário ou vota por quem ainda não
 * respondeu (pedido explícito). Nesse caso ignora-se o "estado
 * aberta": o líder pode corrigir mesmo depois de fechada, é
 * precisamente para isso que serve — só a resposta da própria pessoa
 * exige a enquete ainda aberta. */
export const responderEnquete = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { mes, pessoaId, indisponivelEm = [], semIndisponibilidade = false, nota = "" } = req.data || {};
  if (!MES_RE.test(String(mes || ""))) throw new HttpsError("invalid-argument", "Mês inválido.");
  if (!Array.isArray(indisponivelEm)) throw new HttpsError("invalid-argument", "Indisponibilidade inválida.");
  if (!semIndisponibilidade && !indisponivelEm.length) {
    throw new HttpsError("invalid-argument", "Marca as datas ou diz que não tens indisponibilidades.");
  }

  let alvo = uid;
  if (pessoaId && pessoaId !== uid) {
    if (!PAPEIS_LIDER.has(req.auth.token.papel)) {
      throw new HttpsError("permission-denied", "Só o líder pode responder por outra pessoa.");
    }
    alvo = pessoaId;
  }

  const enquete = await refEnquete(baseId, mes).get();
  if (!enquete.exists || enquete.data().ativo === false) throw new HttpsError("not-found", "Enquete não encontrada.");
  if (alvo === uid && enquete.data().estado !== "aberta") {
    throw new HttpsError("failed-precondition", "Esta enquete já está fechada.");
  }

  await refEnquete(baseId, mes).collection("respostas").doc(alvo).set({
    indisponivelEm: semIndisponibilidade ? [] : indisponivelEm,
    semIndisponibilidade: !!semIndisponibilidade,
    nota: nota.trim(),
    respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
    ...(alvo !== uid ? { respondidoPeloLider: true, respondidoPor: uid } : {}),
  });
  return { ok: true };
});

/* ── ORDEM DO CULTO AO VIVO: FreeShow → Firestore (Base Técnica) ──
 * O túnel fs.painelonda.pt liga ao FreeShow do PC da igreja 24/7 (o
 * Kinder já depende disto em produção) — por isso a sonda corre como
 * função AGENDADA, não à espera de ninguém manter uma aba aberta nem
 * de instalar nada na igreja. 1 minuto é o mínimo do Cloud Scheduler;
 * substitui o debounce anti-ressalto de 8s do documento original — a
 * esse ritmo, o que estiver no ar no instante da sonda é que conta.
 * Datas sempre no fuso de Lisboa via Intl — nunca toISOString(), que
 * já causou desvio de um dia noutros projetos deste tipo. */
const FUSO_LISBOA = "Europe/Lisbon";
const hojeISOLisboa = () => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_LISBOA }).format(new Date());
const horaAgoraLisboa = () =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: FUSO_LISBOA, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const minutosDoDiaLisboa = () => {
  const [h, m] = horaAgoraLisboa().split(":").map(Number);
  return h * 60 + m;
};

// TUNEL_FREESHOW é configurável por variável de ambiente só para
// testar localmente contra um FreeShow no Mac (ver
// scripts/sonda-freeshow.mjs); em produção não há Secret nenhum
// definido, por isso cai sempre no túnel real.
const TUNEL_FREESHOW = process.env.TUNEL_FREESHOW || "https://fs.painelonda.pt";
const JANELA_AUTO_INICIO = [8 * 60, 12 * 60]; // 08:00–12:00 — só aqui o "15 min de movimento" arranca sozinho
const MOVIMENTO_PARA_AUTO_INICIO_MS = 15 * 60 * 1000;

/** Só a Base Técnica inicia/descarta/configura — "edição completa" no
 *  documento original, sem restringir a líder (ao contrário de
 *  exigeLider, que também exigiria papel === "lider_base"). */
function exigeBaseTecnica(req) {
  if (req.auth?.token?.baseId !== "tecnica") {
    throw new HttpsError("permission-denied", "Só a Base Técnica pode fazer isto.");
  }
}

const refCultoAoVivo = (eventoId) => db.doc(`eventos/${eventoId}/cultoAoVivo/registo`);

const refPonteiroAoVivo = () => db.doc("config/cultoAoVivo");

/* Arquivo para o futuro Painel do Pastor — write/read:false a toda a
 * gente (ver firestore.rules), nada disto aparece a nenhuma base
 * hoje. Guarda o bruto (secoesReais + o previsto do PDF daquele dia);
 * as contas de atraso/estatística ficam para quando esse painel
 * existir, não há razão para as fazer duas vezes. Chamado só pelo
 * botão "Finalizar culto" — o fecho é sempre manual, nunca sozinho por
 * falta de output. Também limpa o ponteiro, se ainda apontava para
 * este culto. */
async function arquivarCultoTerminado(eventoId, secoesReais, momentosPrevistos) {
  await db.doc(`eventos/${eventoId}/estatisticasCulto/registo`).set({
    secoesReais, momentosPrevistos: momentosPrevistos ?? [],
    finalizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  const ponteiroRef = refPonteiroAoVivo();
  const ponteiro = await ponteiroRef.get();
  if (ponteiro.exists && ponteiro.data().eventoIdAtivo === eventoId) {
    await ponteiroRef.set({ eventoIdAtivo: null });
  }
}

/* O botão "Começou o culto" não olha para a data — pode ser o culto de
 * qualquer dia (pedido explícito: "não é pra se basear na data").
 * refPonteiroAoVivo() é o que diz à sonda QUAL evento seguir, seja
 * qual for a data dele; só um culto grava de cada vez, por isso
 * bloqueia começar um segundo sem descartar o primeiro. */
export const iniciarCultoAoVivo = onCall(async (req) => {
  exigeBaseTecnica(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  const evento = await db.doc(`eventos/${eventoId}`).get();
  if (!evento.exists) throw new HttpsError("not-found", "Culto não encontrado.");

  const ponteiroRef = refPonteiroAoVivo();
  const ponteiro = await ponteiroRef.get();
  const ativo = ponteiro.exists ? ponteiro.data().eventoIdAtivo : null;
  if (ativo && ativo !== eventoId) {
    throw new HttpsError("failed-precondition", "Já há outro culto a gravar — descarta-o primeiro.");
  }

  const ref = refCultoAoVivo(eventoId);
  const snap = await ref.get();
  // já a gravar (manual ou automático) — não apagar o que já foi registado
  if (snap.exists && snap.data().estado === "gravando") return { ok: true };

  await ref.set({
    estado: "gravando",
    iniciadoPor: req.auth.uid,
    iniciadoEm: admin.firestore.FieldValue.serverTimestamp(),
    secoesReais: [],
    movimentoJanela: [],
    ultimoSlideId: null,
    secaoAtualId: null,
    ultimaDeteccaoOutput: admin.firestore.FieldValue.serverTimestamp(),
  });
  await ponteiroRef.set({ eventoIdAtivo: eventoId });
  return { ok: true };
});

/* "Descartar e recomeçar" — para quando o operador começou errado
 * (ex.: carregou em "Começou o culto" a meio dos testes). Só limpa o
 * ponteiro se ele ainda apontava para este evento — evita apagar o
 * ponteiro de um culto diferente por uma chamada tardia/repetida. */
export const descartarCultoAoVivo = onCall(async (req) => {
  exigeBaseTecnica(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  await refCultoAoVivo(eventoId).set({
    estado: "aguardando",
    iniciadoPor: null,
    iniciadoEm: null,
    secoesReais: [],
    movimentoJanela: [],
    ultimoSlideId: null,
    secaoAtualId: null,
    ultimaDeteccaoOutput: null,
  });
  const ponteiroRef = refPonteiroAoVivo();
  const ponteiro = await ponteiroRef.get();
  if (ponteiro.exists && ponteiro.data().eventoIdAtivo === eventoId) {
    await ponteiroRef.set({ eventoIdAtivo: null });
  }
  return { ok: true };
});

/* "Finalizar culto" — o único jeito de terminar um culto: arquiva os
 * horários reais e liberta o ponteiro, para conseguir começar outro. */
export const finalizarCultoAoVivo = onCall(async (req) => {
  exigeBaseTecnica(req);
  const { eventoId } = req.data || {};
  if (!eventoId) throw new HttpsError("invalid-argument", "Falta o culto.");
  const [evento, snap] = await Promise.all([
    db.doc(`eventos/${eventoId}`).get(),
    refCultoAoVivo(eventoId).get(),
  ]);
  if (!evento.exists) throw new HttpsError("not-found", "Culto não encontrado.");
  if (!snap.exists || snap.data().estado !== "gravando") {
    throw new HttpsError("failed-precondition", "Este culto não está a gravar.");
  }

  const secoesReais = snap.data().secoesReais || [];
  await arquivarCultoTerminado(eventoId, secoesReais, evento.data().ordem?.momentos);
  await refCultoAoVivo(eventoId).set({ estado: "terminado" }, { merge: true });
  return { ok: true };
});

/* Só a Base Técnica edita — as outras bases só leem em tempo real (ver
 * firestore.rules: cultoAoVivo continua de leitura aberta a
 * autenticado()). Uma vez editada, a sonda nunca mais mexe nesta
 * secção (ver sondarFreeshow: só acrescenta entradas novas, nunca
 * substitui uma já existente). */
export const editarSecaoAoVivo = onCall(async (req) => {
  exigeBaseTecnica(req);
  const uid = req.auth.uid;
  const { eventoId, nomeCorrespondente, horaReal } = req.data || {};
  if (!eventoId || !String(nomeCorrespondente || "").trim() || !/^\d{1,2}:\d{2}$/.test(String(horaReal || ""))) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const nome = nomeCorrespondente.trim();
  const chave = normalizarNome(nome);
  const ref = refCultoAoVivo(eventoId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const dados = snap.exists ? snap.data() : { estado: "aguardando", secoesReais: [], movimentoJanela: [] };
    const secoes = dados.secoesReais || [];
    const i = secoes.findIndex((s) => normalizarNome(s.nomeCorrespondente || s.nomeFreeshow || "") === chave);
    const entrada = {
      idFreeshow: (i >= 0 && secoes[i].idFreeshow) ?? null,
      nomeFreeshow: (i >= 0 && secoes[i].nomeFreeshow) ?? null,
      nomeCorrespondente: nome,
      horaReal,
      // FieldValue.serverTimestamp() não é suportado dentro de arrays —
      // Timestamp.now() é a alternativa concreta de sempre neste caso.
      timestampReal: admin.firestore.Timestamp.now(),
      cor: (i >= 0 && secoes[i].cor) ?? null,
      editadoManualmente: true,
      editadoPor: uid,
      editadoEm: admin.firestore.Timestamp.now(),
    };
    const novasSecoes = i >= 0 ? secoes.with(i, entrada) : [...secoes, entrada];
    tx.set(ref, { ...dados, secoesReais: novasSecoes }, { merge: true });
  });
  return { ok: true };
});

/* Corrige ao vivo uma secção que o FreeShow mandou com um nome que não
 * batia com nada da correspondência (ex.: "OD News" em vez de "Onda
 * News") — em vez de a Técnica marcar a hora à mão no momento certo
 * (o que criava uma entrada NOVA, duplicada, ver histórico), isto
 * troca o nomeCorrespondente da entrada que já existe, identificada
 * por idFreeshow. Como o cruzamento com o previsto (cruzarComReal, em
 * @portal/shared/lib/ordemAoVivo.js) casa por nome normalizado, a
 * entrada passa a contar como a secção prevista escolhida e some da
 * lista "não previsto" sozinha — sem código extra nenhum aqui para
 * isso. Também grava o nome errado na correspondência, para o mesmo
 * erro de digitação não se repetir nos próximos cultos. */
export const reassociarSecaoAoVivo = onCall(async (req) => {
  exigeBaseTecnica(req);
  const uid = req.auth.uid;
  const { eventoId, idFreeshow, nomeCorrespondente } = req.data || {};
  if (!eventoId || !idFreeshow || !String(nomeCorrespondente || "").trim()) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const nome = nomeCorrespondente.trim();
  const ref = refCultoAoVivo(eventoId);
  let nomeFreeshow = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Culto não encontrado.");
    const dados = snap.data();
    const secoes = dados.secoesReais || [];
    const i = secoes.findIndex((s) => s.idFreeshow === idFreeshow);
    if (i < 0) throw new HttpsError("not-found", "Secção não encontrada.");
    nomeFreeshow = secoes[i].nomeFreeshow;
    const entrada = {
      ...secoes[i],
      nomeCorrespondente: nome,
      reassociado: true, // fica para sempre — é o que mantém o ✏️ visível o resto do culto, mesmo já não sendo "não previsto"
      editadoManualmente: true,
      editadoPor: uid,
      editadoEm: admin.firestore.Timestamp.now(),
    };
    tx.set(ref, { ...dados, secoesReais: secoes.with(i, entrada) }, { merge: true });
  });

  if (nomeFreeshow) {
    await db.doc("bases/tecnica/config/correspondenciaFreeshow")
      .set({ mapa: { [normalizarNome(nomeFreeshow)]: nome } }, { merge: true });
  }
  return { ok: true };
});

export const definirCorrespondenciaFreeshow = onCall(async (req) => {
  exigeBaseTecnica(req);
  const { mapa } = req.data || {};
  if (!mapa || typeof mapa !== "object" || Array.isArray(mapa)) {
    throw new HttpsError("invalid-argument", "Mapa inválido.");
  }
  const limpo = {};
  for (const [chave, valor] of Object.entries(mapa)) {
    const c = normalizarNome(chave), v = String(valor || "").trim();
    if (c && v) limpo[c] = v;
  }
  await db.doc("bases/tecnica/config/correspondenciaFreeshow").set({ mapa: limpo });
  return { ok: true };
});

/* Um "tick" da sonda — chamado pelo agendador (a cada 1 min, sempre) e
 * também por sondarFreeshowAgora (onCall, enquanto alguém tem a Ordem
 * do culto aberta no ecrã, a cada poucos segundos): mesma lógica, dois
 * gatilhos. O agendador é a rede de segurança que nunca falha; o onCall
 * é só para a hora real aparecer mais depressa a quem está a olhar. */
async function executarSondaFreeshow() {
  // segue o culto apontado por config/cultoAoVivo (seja qual for a
  // data — "Começou o culto" não olha para o dia); sem nada apontado,
  // cai no culto de hoje só para o início automático (15 min de
  // movimento) ter algum evento candidato a começar sozinho.
  const ponteiroRef = refPonteiroAoVivo();
  const ponteiro = await ponteiroRef.get();
  const eventoIdAtivo = ponteiro.exists ? ponteiro.data().eventoIdAtivo : null;
  const eventoId = eventoIdAtivo || hojeISOLisboa();
  const evento = await db.doc(`eventos/${eventoId}`).get();
  if (!evento.exists) return; // nem culto de hoje nem ponteiro válido, nada a sondar

  const ref = refCultoAoVivo(eventoId);
  const snap = await ref.get();
  const dados = snap.exists ? snap.data() : { estado: "aguardando", secoesReais: [], movimentoJanela: [] };
  if (dados.estado === "terminado") return;

  const resultado = await sondarUmaVez(TUNEL_FREESHOW);
  if (!resultado.ok) {
    logger.warn("sondarFreeshow: sonda falhou", { motivo: resultado.motivo, erro: resultado.erro });
    return;
  }

  const agoraMs = Date.now();
  const agoraTs = admin.firestore.Timestamp.now();
  const patch = {};
  let estado = dados.estado || "aguardando";
  let secoesReais = dados.secoesReais || [];
  let movimentoJanela = (dados.movimentoJanela || []).filter((t) => agoraMs - t.toMillis() < MOVIMENTO_PARA_AUTO_INICIO_MS);
  let ultimaDeteccaoOutput = dados.ultimaDeteccaoOutput || null;

  if (resultado.output) {
    ultimaDeteccaoOutput = agoraTs;
    if (resultado.output.id !== dados.ultimoSlideId) {
      movimentoJanela = [...movimentoJanela, agoraTs];
      patch.ultimoSlideId = resultado.output.id;
    }

    if (estado === "aguardando") {
      const dentroDaJanela = minutosDoDiaLisboa() >= JANELA_AUTO_INICIO[0] && minutosDoDiaLisboa() <= JANELA_AUTO_INICIO[1];
      const movimentoContinuo = movimentoJanela.length > 0 && agoraMs - movimentoJanela[0].toMillis() >= MOVIMENTO_PARA_AUTO_INICIO_MS;
      if (dentroDaJanela && movimentoContinuo) {
        estado = "gravando";
        patch.iniciadoPor = "automatico";
        patch.iniciadoEm = admin.firestore.FieldValue.serverTimestamp();
        await ponteiroRef.set({ eventoIdAtivo: eventoId });
      }
    }

    // secaoAtualId é só da sonda — nunca se confunde com o último item
    // de secoesReais, que também recebe edições manuais fora de ordem
    // (senão "agora" saltava para o que alguém acabou de corrigir à
    // mão, mesmo o FreeShow estando noutra secção qualquer).
    if (estado === "gravando" && resultado.secao) {
      patch.secaoAtualId = resultado.secao.id;
      if (dados.secaoAtualId !== resultado.secao.id) {
        const correspSnap = await db.doc("bases/tecnica/config/correspondenciaFreeshow").get();
        const mapa = correspSnap.exists ? correspSnap.data().mapa || {} : {};
        secoesReais = [...secoesReais, {
          idFreeshow: resultado.secao.id,
          nomeFreeshow: resultado.secao.nome,
          nomeCorrespondente: mapa[normalizarNome(resultado.secao.nome)] || null,
          horaReal: horaAgoraLisboa(),
          timestampReal: agoraTs,
          cor: resultado.secao.cor,
          editadoManualmente: false,
          editadoPor: null,
          editadoEm: null,
        }];
      }
    } else if (estado === "gravando") {
      patch.secaoAtualId = null; // output sem secção identificável
    }
  }

  // fecho é só manual (botão "Finalizar culto", ver finalizarCultoAoVivo)
  // — nada aqui termina sozinho por falta de output.

  await ref.set({ ...patch, estado, secoesReais, movimentoJanela, ultimaDeteccaoOutput }, { merge: true });
}

export const sondarFreeshow = onSchedule("every 1 minutes", executarSondaFreeshow);

/* Chamado pelo ecrã da Ordem do culto, a cada poucos segundos, só
 * enquanto o culto que a pessoa está a ver estiver mesmo "gravando" —
 * é só para a hora real aparecer mais depressa a quem está a olhar
 * naquele momento; quem abre o ecrã depois continua a ver tudo certo
 * na hora, porque lê direto do Firestore (ver
 * packages/shared/components/OrdemCultoAoVivo.jsx). Qualquer
 * voluntário logado, de qualquer base — tem exatamente o mesmo efeito
 * que a sonda automática, só que mais cedo, por isso não há razão
 * para restringir a quem pode chamar. */
export const sondarFreeshowAgora = onCall(async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  await executarSondaFreeshow();
  return { ok: true };
});

/* ── BIBLIOTECA (Base Louvor) ─────────────────────────────────
 * Fase 1: só a capa é automática (Deezer, API pública sem chave).
 * Tom, BPM e links continuam à mão — ver apps/louvor/CLAUDE.md,
 * secção "Resolução automática", e o CLAUDE-louvor.md original
 * (secção 5, resolverMusica, fica para uma entrega seguinte). */

/** Busca capas candidatas — nunca grava nada, só devolve a lista para
 *  o líder escolher (ver processarCapaMusica). */
export const buscarCapaDeezer = onCall(async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { titulo, artista } = req.data || {};
  if (!titulo?.trim() || !artista?.trim()) throw new HttpsError("invalid-argument", "Falta o título ou o artista.");

  const q = `track:"${titulo.trim()}" artist:"${artista.trim()}"`;
  const resp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=6`);
  if (!resp.ok) throw new HttpsError("unavailable", "O Deezer não respondeu.");
  const json = await resp.json();
  const resultados = (json.data || []).map((t) => ({
    deezerId: String(t.id),
    titulo: t.title,
    artista: t.artist?.name || "",
    capa: t.album?.cover_medium || null,
    duracao: t.duration || null,
    preview: t.preview || null,
  }));
  return { resultados };
});

/** Baixa a capa escolhida, converte para WebP 250px qualidade 80 e
 *  copia para bases/{base}/capas/{musicaId}.webp — a música nunca
 *  mais consulta o Deezer depois disto (decisão 14 do CLAUDE-louvor). */
export const processarCapaMusica = onCall(async (req) => {
  const uid = req.auth?.uid, baseId = req.auth?.token?.baseId;
  if (!uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { musicaId, deezerId } = req.data || {};
  if (!musicaId || !deezerId) throw new HttpsError("invalid-argument", "Falta a música ou a capa.");

  const musicaRef = db.doc(`bases/${baseId}/musicas/${musicaId}`);
  if (!(await musicaRef.get()).exists) throw new HttpsError("not-found", "Música não encontrada.");

  const trackResp = await fetch(`https://api.deezer.com/track/${deezerId}`);
  if (!trackResp.ok) throw new HttpsError("unavailable", "O Deezer não respondeu.");
  const track = await trackResp.json();
  const capaOrigemUrl = track.album?.cover_medium;
  if (!capaOrigemUrl) throw new HttpsError("not-found", "Esta faixa não tem capa no Deezer.");

  const imgResp = await fetch(capaOrigemUrl);
  if (!imgResp.ok) throw new HttpsError("unavailable", "Não foi possível baixar a capa.");
  const buffer = Buffer.from(await imgResp.arrayBuffer());
  const webp = await sharp(buffer).resize(250, 250, { fit: "cover" }).webp({ quality: 80 }).toBuffer();

  const token = randomUUID();
  const bucket = admin.storage().bucket();
  const file = bucket.file(`bases/${baseId}/capas/${musicaId}.webp`);
  await file.save(webp, {
    metadata: { contentType: "image/webp", metadata: { firebaseStorageDownloadTokens: token } },
  });
  const capaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;

  await musicaRef.set({
    capaUrl, capaOrigem: "deezer", deezerId: String(deezerId), previewUrl: track.preview || null,
  }, { merge: true });

  return { capaUrl };
});

/** O link de prévia do Deezer é um token assinado de curta duração
 *  (poucas horas, não dias) — guardar `previewUrl` uma vez e tocar
 *  depois sempre falha com 403 assim que expira. Por isso o botão de
 *  prévia nunca usa o campo gravado direto: pede sempre um link novo
 *  aqui, na hora de tocar, a partir do `deezerId` (esse sim é
 *  permanente). */
export const obterPreviaDeezer = onCall(async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { deezerId } = req.data || {};
  if (!deezerId) throw new HttpsError("invalid-argument", "Falta a faixa do Deezer.");
  const resp = await fetch(`https://api.deezer.com/track/${deezerId}`);
  if (!resp.ok) throw new HttpsError("unavailable", "O Deezer não respondeu.");
  const track = await resp.json();
  return { preview: track.preview || null };
});

/* ── BIBLIOTECA (Base Louvor) — pesquisa por nome, Fase 2 ──────
 * Busca no Deezer só pelo nome (sem artista) e devolve vários
 * candidatos, cada um já enriquecido com tom (Cifra Club, melhor
 * esforço). Um candidato individual falhar a enriquecer nunca derruba
 * os outros nem a busca toda — mesma filosofia do resto desta base.
 * (GetSongBPM foi removido: a Cloudflare deles bloqueia o acesso por
 * API há muito, nunca deu para usar de facto — ver histórico do
 * repositório se um dia for retomado.) */

const normLouvor = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function slugCifraClub(texto) {
  return normLouvor(texto)
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

/** letras.mus.br e cifraclub.com.br partilham o padrão {artista}/
 *  {musica} — as mesmas variações servem aos dois (título sem
 *  parênteses, artista sem feat./&, e só o primeiro artista quando
 *  há mais do que um separado por vírgula ou " e "). Devolve só as
 *  combinações com slug válido, sem duplicados. */
/** Busca no motor de sugestão deles (o mesmo que alimenta a caixa de
 *  busca do site — endpoint público, sem chave, é o que qualquer
 *  visitante já chama) — devolve o slug REAL deles, que letras.mus.br
 *  também usa (mesma empresa, mesmo dns/url). Existe porque muita
 *  banda usa um nome curto (ex.: "fhop music") que o Cifra Club
 *  cataloga pelo nome por extenso ("Florianópolis House Of Prayer")
 *  — nenhuma variação de slug gerada a partir do nome curto bate,
 *  então nada substitui perguntar a eles mesmos. tipo "2" = música
 *  (tipo "1" é artista, sem url de música). */
async function buscarSlugsCifraClub(titulo, artista) {
  try {
    // O endpoint deles é Solr puro — o parser da query deles não é
    // tolerante: manter "(Ao Vivo)"/"(Live)" como termo de busca some
    // com o resultado certo (confirmado: "Sublime fhop music" acha,
    // "Sublime Ao Vivo fhop music" não acha nada, 0 resultados, sem
    // erro nenhum). Remove o conteúdo entre parênteses inteiro (não
    // só os caracteres) antes de perguntar — a comparação de título
    // mais abaixo continua a usar o título original, sem cortar nada.
    const limpar = (s) => (s || "")
      .replace(/\(.*?\)/g, " ")
      .replace(/[()[\]{}+\-!^~*?:"\\]/g, " ")
      .replace(/\s+/g, " ").trim();
    const q = `${limpar(titulo)} ${limpar(artista)}`.trim();
    if (!q) return [];
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    const resp = await fetch(`https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(q)}&limit=10`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const json = await resp.json();
    const tNorm = normLouvor(titulo);
    return (json.response?.docs || [])
      .filter((d) => d.tipo === "2" && d.dns && d.url)
      .filter((d) => {
        const dNorm = normLouvor(d.txt || "");
        return dNorm === tNorm || dNorm.includes(tNorm) || tNorm.includes(dNorm) || dNorm.slice(0, 10) === tNorm.slice(0, 10);
      })
      .slice(0, 2)
      .map((d) => ({ aSlug: d.dns, tSlug: d.url }));
  } catch {
    return [];
  }
}

async function variacoesSlug(titulo, artista) {
  const primeiroArtista = (artista || "").split(/,| e | & /i)[0].trim();
  const brutas = [
    { t: titulo, a: artista },
    { t: (titulo || "").replace(/\(.*?\)/g, "").trim(), a: artista },
    { t: titulo, a: (artista || "").replace(/\bfeat\.?.*$/i, "").replace(/&.*$/, "").trim() },
    { t: (titulo || "").replace(/\(.*?\)/g, "").trim(), a: primeiroArtista },
  ];
  const vistas = new Set();
  const variacoes = [];
  // slug real deles primeiro — quando acha, é o mais confiável de
  // todos (validado pela busca deles, não adivinhado por nós).
  for (const v of await buscarSlugsCifraClub(titulo, artista)) {
    const chave = `${v.aSlug}/${v.tSlug}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    variacoes.push(v);
  }
  for (const v of brutas) {
    const aSlug = slugCifraClub(v.a), tSlug = slugCifraClub(v.t);
    if (!aSlug || !tSlug) continue;
    const chave = `${aSlug}/${tSlug}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    variacoes.push({ aSlug, tSlug });
  }
  return variacoes;
}

/** Tenta cada variação até uma página existir E o título bater —
 *  nunca confia numa página que o Cifra Club serviu mas não é a
 *  música certa (ex.: redireciona para a busca). */
async function resolverTomCifraClub(titulo, variacoes) {
  for (const { aSlug, tSlug } of variacoes) {
    const url = `https://www.cifraclub.com.br/${aSlug}/${tSlug}/`;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const html = await resp.text();
      const tituloTag = html.slice(html.indexOf("<title>"), html.indexOf("<title>") + 200);
      if (!normLouvor(tituloTag).includes(normLouvor(titulo).slice(0, 8))) continue;
      const m = html.match(/aria-label="Diminuir tom"[\s\S]{0,300}?<p[^>]*>([A-G](?:#|b)?m?)<\/p>/);
      return { tom: m ? m[1] : null, link: url };
    } catch {
      continue;
    }
  }
  return { tom: null, link: null };
}

/** Letra: independente do Cifra Club — mesmas variações de slug,
 *  mas testadas direto no letras.mus.br (podem ter catálogos
 *  diferentes; um falhar não deve tirar a hipótese do outro). Só
 *  existência (HEAD), o conteúdo não interessa aqui. */
async function resolverLetra(variacoes) {
  for (const { aSlug, tSlug } of variacoes) {
    const url = `https://www.letras.mus.br/${aSlug}/${tSlug}/`;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);
      const resp = await fetch(url, { method: "HEAD", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(timeout);
      if (resp.ok) return url;
    } catch {
      continue;
    }
  }
  return null;
}

const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");
const SPOTIFY_CLIENT_ID = defineSecret("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = defineSecret("SPOTIFY_CLIENT_SECRET");

/** Um único resultado, sem tentar casar canal com artista (ao
 *  contrário do documento original — aqui já estamos a mostrar vários
 *  candidatos por música, casar canal a mais tornaria a busca lenta
 *  para pouco ganho). Sem chave definida, devolve null em silêncio. */
async function resolverVideoYouTube(titulo, artista, apiKey) {
  if (!apiKey) return null;
  try {
    const q = `${titulo} ${artista}`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const json = await resp.json();
    const videoId = json.items?.[0]?.id?.videoId;
    return videoId ? `https://youtu.be/${videoId}` : null;
  } catch {
    return null;
  }
}

/** Token de acesso do Spotify (Client Credentials — não precisa de
 *  login de ninguém, só identifica a nossa app). Guardado em memória
 *  do processo entre chamadas: cada instância da function reaproveita
 *  o token até expirar, em vez de pedir um novo a cada música. Uma
 *  instância nova (cold start) começa sem cache, pede um — normal. */
let tokenSpotifyCache = null; // { token, expiraEm }
async function obterTokenSpotify(clientId, clientSecret) {
  if (tokenSpotifyCache && tokenSpotifyCache.expiraEm > Date.now()) return tokenSpotifyCache.token;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) {
    logger.error("Spotify token falhou", { status: resp.status, corpo: (await resp.text()).slice(0, 500) });
    throw new Error("falha a autenticar no Spotify");
  }
  const json = await resp.json();
  tokenSpotifyCache = { token: json.access_token, expiraEm: Date.now() + (json.expires_in - 60) * 1000 };
  return tokenSpotifyCache.token;
}

/** Só o link — o Spotify descontinuou `audio-features`/`audio-analysis`
 *  para qualquer app criada depois de 27/11/2024 (a nossa é de 2026):
 *  403 sempre, para qualquer conta, mesmo Premium (confirmado —
 *  https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api).
 *  Não é algo que fique disponível esperando; não há tom/BPM por aqui.
 *  Sem credenciais definidas, devolve tudo null em silêncio, como as
 *  outras camadas. */
async function resolverSpotify(titulo, artista, clientId, clientSecret) {
  if (!clientId || !clientSecret) return { link: null };
  try {
    const token = await obterTokenSpotify(clientId, clientSecret);
    const q = `track:${titulo} artist:${artista}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const buscaResp = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
    );
    clearTimeout(timeout);
    if (!buscaResp.ok) {
      logger.error("Spotify search falhou", { status: buscaResp.status, corpo: (await buscaResp.text()).slice(0, 500) });
      return { link: null };
    }
    const buscaJson = await buscaResp.json();
    const faixa = buscaJson.tracks?.items?.[0];
    return { link: faixa?.external_urls?.spotify || null };
  } catch (e) {
    logger.error("Spotify resolverSpotify falhou", { erro: e.message });
    return { link: null };
  }
}

const RESULTADOS_POR_PAGINA = 6;

export const pesquisarMusicaLouvor = onCall({
  secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET],
  cors: ORIGENS_PERMITIDAS,
}, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { nome, pagina } = req.data || {};
  if (!nome?.trim()) throw new HttpsError("invalid-argument", "Falta o nome da música.");
  const indice = Math.max(0, Number(pagina) || 0) * RESULTADOS_POR_PAGINA;

  const buscaResp = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(nome.trim())}&index=${indice}&limit=${RESULTADOS_POR_PAGINA}`
  );
  if (!buscaResp.ok) throw new HttpsError("unavailable", "O Deezer não respondeu.");
  const buscaJson = await buscaResp.json();
  const brutos = buscaJson.data || [];
  // o Deezer devolve `total` (contagem geral da busca) em toda página —
  // dá para saber se há mais sem adivinhar pelo tamanho desta página.
  const total = typeof buscaJson.total === "number" ? buscaJson.total : indice + brutos.length;

  const valorSecret = (s) => { try { return s.value() || null; } catch { return null; } };
  const spotifyId = valorSecret(SPOTIFY_CLIENT_ID);
  const spotifySecret = valorSecret(SPOTIFY_CLIENT_SECRET);

  const candidatos = await Promise.all(brutos.map(async (t) => {
    const titulo = t.title, artista = t.artist?.name || "";
    const variacoes = await variacoesSlug(titulo, artista);
    const [cifra, letraLink, spotify] = await Promise.all([
      resolverTomCifraClub(titulo, variacoes).catch(() => ({ tom: null, link: null })),
      resolverLetra(variacoes).catch(() => null),
      resolverSpotify(titulo, artista, spotifyId, spotifySecret).catch(() => ({ link: null })),
    ]);
    // tom: só Cifra Club por agora (cifra transcrita à mão). Spotify
    // só entra com o link — o deles não dá mais tom/BPM (ver
    // resolverSpotify). BPM: ninguém dá cobertura de verdade hoje.
    const tom = cifra.tom || null;
    const fonteTom = cifra.tom ? "cifraclub" : null;
    const bpm = null;
    const fonteBpm = null;
    return {
      deezerId: String(t.id), titulo, artista,
      capa: t.album?.cover_medium || null, duracao: t.duration || null, preview: t.preview || null,
      tom, fonteTom, bpm, fonteBpm,
      linkCifra: cifra.link, linkLetra: letraLink,
      linkAudio: spotify.link || t.link || null, linkVideo: null,
    };
  }));

  return { candidatos, temMais: indice + candidatos.length < total };
});

/** Vídeo do YouTube, só para a música escolhida — a cota diária da
 *  YouTube Data API é de 100 buscas (100 unidades cada, de um total
 *  de 10 000/dia): buscar vídeo para os 6 candidatos de toda página
 *  pesquisada esgotava a cota em ~16 buscas por dia. Só vale a pena
 *  gastar cota na música que o líder de facto escolheu. */
export const resolverVideoMusica = onCall({
  secrets: [YOUTUBE_API_KEY],
  cors: ORIGENS_PERMITIDAS,
}, async (req) => {
  const baseId = req.auth?.token?.baseId;
  if (!req.auth?.uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { titulo, artista } = req.data || {};
  if (!titulo?.trim()) throw new HttpsError("invalid-argument", "Falta o título da música.");

  // Cache permanente por música — a cota diária da YouTube Data API é
  // só 100 buscas; sem isto, procurar a MESMA música outra vez (ex.:
  // reiniciar a app, voltar a pesquisar) gastava cota de novo à toa.
  // Guarda mesmo quando não encontra vídeo nenhum (null), senão uma
  // música sem correspondência voltava a gastar cota a cada busca.
  const chave = `${normLouvor(artista || "")}__${normLouvor(titulo)}`;
  const cacheRef = db.doc(`bases/${baseId}/cacheVideosYoutube/${chave}`);
  const cache = await cacheRef.get();
  if (cache.exists) return { video: cache.data().video };

  const valorSecret = (s) => { try { return s.value() || null; } catch { return null; } };
  const video = await resolverVideoYouTube(titulo.trim(), artista?.trim() || "", valorSecret(YOUTUBE_API_KEY));
  await cacheRef.set({ video, resolvidoEm: admin.firestore.FieldValue.serverTimestamp() });
  return { video };
});

/** Instância única do Essentia por instância da Cloud Function —
 *  inicializar o WASM custa caro, reaproveitar entre pedidos "quentes"
 *  (mesma ideia do token do Spotify/LouveApp em memória). Nunca
 *  chamar .delete() nela: isso destruía a instância partilhada. */
let essentiaInstancia = null;
function obterEssentia() {
  if (!essentiaInstancia) essentiaInstancia = new essentiaLib.Essentia(essentiaLib.EssentiaWASM);
  return essentiaInstancia;
}

/** A Essentia devolve tom em bemol quando é mais natural nessa nota
 *  (Eb, Ab…) — o resto da app usa sustenido (D#, G#…), igual ao que
 *  já saía do Cifra Club/Spotify. Só conversão de notação, a nota é a
 *  mesma. */
const FLAT_PARA_SUSTENIDO = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

/** Detecta tom e BPM analisando os 30s de prévia do Deezer — nunca
 *  substitui o Cifra Club (cifra transcrita à mão, mais confiável),
 *  só cobre o que ele não tem. Detecção algorítmica nunca é perfeita
 *  (a mesma ressalva que já valia para o extinto audio-features do
 *  Spotify) — errar por um semitom acontece, mas é melhor do que
 *  ficar em branco. O deezerId é sempre revalidado (o link de preview
 *  gravado expira em horas — ver obterPreviaDeezer). */
async function analisarAudioDeezer(deezerId) {
  const trackResp = await fetch(`https://api.deezer.com/track/${deezerId}`);
  if (!trackResp.ok) return { tom: null, bpm: null };
  const track = await trackResp.json();
  if (!track.preview) return { tom: null, bpm: null };
  const audioResp = await fetch(track.preview);
  if (!audioResp.ok) return { tom: null, bpm: null };

  const { channelData, sampleRate } = await decodeAudio(await audioResp.arrayBuffer());
  if (!channelData?.[0]?.length) return { tom: null, bpm: null };

  const essentia = obterEssentia();
  const vetor = essentia.arrayToVector(channelData[0]);
  try {
    const { key, scale } = essentia.KeyExtractor(
      vetor, true, 4096, 4096, 12, 3500, 60, 25, 0.2, "bgate",
      sampleRate, 0.0001, 440, "cosine", "hann"
    );
    const nota = FLAT_PARA_SUSTENIDO[key] || key;
    const tom = nota ? (scale === "minor" ? `${nota}m` : nota) : null;

    const { bpm: bpmBruto } = essentia.RhythmExtractor2013(vetor);
    const bpm = bpmBruto ? Math.round(bpmBruto) : null;

    return { tom, bpm };
  } finally {
    if (typeof vetor.delete === "function") vetor.delete();
  }
}

/** Só entra quando o Cifra Club não achou nada — o líder escolhe o
 *  candidato, e só aí vale a pena gastar alguns segundos de CPU a
 *  analisar o áudio. Cache permanente por música, igual ao vídeo:
 *  nunca reanalisa a mesma música duas vezes, mesmo quando o
 *  resultado é null. */
export const resolverTomAudioMusica = onCall({
  cors: ORIGENS_PERMITIDAS,
  timeoutSeconds: 60,
  memory: "1GiB",
}, async (req) => {
  const baseId = req.auth?.token?.baseId;
  if (!req.auth?.uid || !baseId) throw new HttpsError("unauthenticated", "Sessão inválida.");
  const { deezerId, titulo, artista } = req.data || {};
  if (!deezerId || !titulo?.trim()) throw new HttpsError("invalid-argument", "Falta a faixa do Deezer ou o título.");

  const chave = `${normLouvor(artista || "")}__${normLouvor(titulo)}`;
  const cacheRef = db.doc(`bases/${baseId}/cacheTomAudio/${chave}`);
  const cache = await cacheRef.get();
  if (cache.exists) return cache.data();

  const resultado = await analisarAudioDeezer(deezerId).catch((e) => {
    logger.error("Análise de áudio falhou", { erro: e.message, deezerId, titulo });
    return { tom: null, bpm: null };
  });
  await cacheRef.set({ ...resultado, resolvidoEm: admin.firestore.FieldValue.serverTimestamp() });
  return resultado;
});

/* ── REPERTÓRIO (Base Louvor) ─────────────────────────────────
 * Histórico por música (não por versão, ver decisão 12): recalculado
 * a cada escrita num repertório, só para as músicas que entraram ou
 * saíram nesta escrita (não a biblioteca toda) — o volume é baixo
 * (~1 repertório por semana, <500 músicas), por isso um recount
 * completo por música afetada é barato e sempre correto, mesmo que
 * um repertório antigo seja editado fora de ordem. */
export const aoGravarRepertorioLouvor = onDocumentWritten("bases/{baseId}/repertorios/{repertorioId}", async (event) => {
  const baseId = event.params.baseId;
  const antes = event.data?.before?.data();
  const depois = event.data?.after?.data();
  const idsAntes = (antes?.itens || []).filter((i) => i.tipo === "musica").map((i) => i.musicaId);
  const idsDepois = (depois?.itens || []).filter((i) => i.tipo === "musica").map((i) => i.musicaId);
  const musicaIds = [...new Set([...idsAntes, ...idsDepois])];
  if (!musicaIds.length) return;

  const snap = await db.collection(`bases/${baseId}/repertorios`).get();
  const repertorios = snap.docs.map((d) => d.data());
  const limite90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const lote = db.batch();
  for (const musicaId of musicaIds) {
    let ultima = null;
    let vezes90d = 0;
    for (const rep of repertorios) {
      const temMusica = (rep.itens || []).some((i) => i.tipo === "musica" && i.musicaId === musicaId);
      if (!temMusica || !rep.data) continue;
      if (!ultima || rep.data > ultima) ultima = rep.data;
      if (rep.data >= limite90) vezes90d += 1;
    }
    lote.set(db.doc(`bases/${baseId}/musicas/${musicaId}`), {
      ultimaVezTocada: ultima ? admin.firestore.Timestamp.fromDate(new Date(`${ultima}T00:00:00`)) : null,
      vezes90d,
    }, { merge: true });
  }
  await lote.commit();
});
