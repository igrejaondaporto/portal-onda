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
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
import sharp from "sharp";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

const BASE = "kinder";
export const CATEGORIAS_KINDER = ["baby", "fun", "junior"];
const PAPEIS_LIDER = new Set(["lider_base", "auxiliar"]);
// sem 0/O nem 1/I/L — o código é lido em voz alta à porta, com pressa
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 4;
// idades por omissão — a líder muda em Painel → Definições
// (bases/kinder/definicoes/categorias), só servem para SUGERIR a sala
const FAIXAS_PADRAO = { baby: { min: 1, max: 2 }, fun: { min: 3, max: 5 }, junior: { min: 6, max: 8 } };
// por IP e por hora. Alto de propósito: ao domingo as famílias todas
// registam-se pela mesma rede da Casa do Povo, que é um IP só.
const MAX_REGISTOS_POR_HORA = 40;
const HORA_MS = 60 * 60 * 1000;

// Texto provisório — tem de ser revisto pela igreja antes de ir para
// os pais a sério (a líder substitui em Painel → Definições, e cada
// alteração sobe a versão guardada em cada família). Retenção: ver
// MESES_RETENCAO/purgarFamiliasInativasKinder abaixo — a família tem
// de saber que a exclusão é a sério (apaga, não é só "esconde"), e
// que a foto tem um uso limitado e diferente do da rede social.
const CONSENTIMENTO_PADRAO =
  "Autorizo a Igreja Onda a guardar os dados desta ficha (nomes, datas de nascimento, " +
  "contactos, alergias e cuidados de saúde) para acolher as crianças no Kinder durante os " +
  "cultos e para me contactar se for preciso. Se eu subir uma foto da criança ou de quem a " +
  "vem buscar, é só para os voluntários reconhecerem quem é quem — nunca é partilhada nem " +
  "usada para outro fim (isso é sempre um consentimento à parte). Os dados só são vistos " +
  "pelos voluntários do Kinder, nunca são partilhados fora da igreja, e são apagados a " +
  "sério (não só escondidos) se a criança não vier durante 6 meses — nesse caso é preciso " +
  "voltar a registar. Posso pedir para os corrigir ou apagar antes disso, a qualquer momento.";

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

/** A Mestra de uma sala é escolhida por culto, na Escala
 *  (eventos/{e}/escalas/kinder.mestras[sala] = pessoaId) — não é um
 *  papel fixo. Para os dois pontos em que ganha a permissão da líder
 *  (saída sem código, publicar a lição do dia), o servidor confirma
 *  aqui, nunca confiando no cliente. `categorias` pode ter mais do
 *  que uma sala (uma lição pode ser de Fun+Júnior); basta ser mestra
 *  de uma delas nesse culto. */
async function souMestraDeAlgumaSala(uid, eventoId, categorias) {
  if (!eventoId || !Array.isArray(categorias) || !categorias.length) return false;
  const s = await db().doc(`eventos/${eventoId}/escalas/${BASE}`).get();
  if (!s.exists) return false;
  const mestras = s.data().mestras || {};
  return categorias.some((c) => CATEGORIAS_KINDER.includes(c) && mestras[c] === uid);
}

const texto = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const textoLongo = (v) => String(v ?? "").trim().slice(0, 500);
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const soDigitos = (t) => String(t ?? "").replace(/\D/g, "");

const RE_ID_PESSOA = /^[A-Za-z0-9_-]{6,60}$/;

/** `id` é o que dá um caminho estável à foto de um responsável/
 *  autorizado — não existem como documentos próprios (são só um
 *  array na família), por isso o cliente gera o id (crypto.randomUUID)
 *  na primeira vez e devolve-o nas edições seguintes; sem um válido,
 *  esta função gera um novo. `fotoBase64`/`removerFoto` passam por
 *  aqui só em bruto — `resolverFotosPessoas` é que os processa. */
function limparPessoas(lista, max, exigeTelefone) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, max)
    .map((p) => ({
      id: RE_ID_PESSOA.test(p?.id || "") ? p.id : randomUUID(),
      nome: texto(p?.nome), telefone: texto(p?.telefone, 30), parentesco: texto(p?.parentesco, 40),
      ...(typeof p?.fotoBase64 === "string" ? { fotoBase64: p.fotoBase64 } : {}),
      ...(p?.removerFoto === true ? { removerFoto: true } : {}),
    }))
    .filter((p) => p.nome && (!exigeTelefone || soDigitos(p.telefone).length >= 9));
}

/** Foto de cada responsável/autorizado — sobe a nova, apaga (null) ou
 *  mantém a que já lá estava (o array é sempre reescrito por inteiro,
 *  nunca um merge por item — sem isto, editar um perdia a foto de
 *  outro). `existentesPorId` vem do que já estava guardado. */
async function resolverFotosPessoas(pessoas, existentesPorId, caminhoBase) {
  return Promise.all(pessoas.map(async ({ fotoBase64, removerFoto, ...p }) => {
    const resolvida = await fotoOpcional({ fotoBase64, removerFoto }, `${caminhoBase}/${p.id}.webp`);
    const foto = resolvida !== undefined ? resolvida : (existentesPorId.get(p.id)?.foto ?? null);
    return { ...p, foto };
  }));
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

/* ── fotos (criança e responsável/autorizado) ────────────────────
 * Os pais nunca têm sessão (registo/link são sem conta) — não há
 * como um `storage.rules` deixá-los escrever direto no Storage. Por
 * isso a foto viaja em base64 dentro do próprio pedido (comprimida
 * no cliente antes) e é esta função, com o Admin SDK, que sobe o
 * ficheiro — o único caminho que serve pais e voluntários da mesma
 * forma, sem duplicar lógica. Redimensiona sempre para 480×480
 * (rosto/retrato, não precisa de mais para reconhecer alguém). */
const TAMANHO_MAX_FOTO = 6 * 1024 * 1024; // já comprimida — 6MB é uma margem larga
const RE_FOTO_BASE64 = /^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/;

async function guardarFotoPessoa(caminho, base64) {
  const m = RE_FOTO_BASE64.exec(String(base64 || ""));
  if (!m) throw new HttpsError("invalid-argument", "Foto inválida — tenta outra imagem.");
  const entrada = Buffer.from(m[2], "base64");
  if (entrada.length > TAMANHO_MAX_FOTO) throw new HttpsError("invalid-argument", "A foto é grande demais.");
  const webp = await sharp(entrada).rotate().resize(480, 480, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  const token = randomUUID();
  const bucket = admin.storage().bucket();
  const file = bucket.file(caminho);
  await file.save(webp, { metadata: { contentType: "image/webp", metadata: { firebaseStorageDownloadTokens: token } } });
  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`, nome: "foto.webp" };
}

/** Processa `fotoBase64`/`removerFoto` de UM item (criança, responsável
 *  ou autorizado) contra o caminho onde a foto desse item vive.
 *  Sem nenhum dos dois campos, devolve `undefined` — a chamadora não
 *  toca no que já lá estava (mesmo padrão do `licao ? {licao} : {}`
 *  usado em guardarLicaoKinder). */
async function fotoOpcional(item, caminho) {
  if (item?.fotoBase64) return guardarFotoPessoa(caminho, item.fotoBase64);
  if (item?.removerFoto) return null;
  return undefined;
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
  const [faixas, cons, grupo] = await Promise.all([
    lerFaixas(),
    db().doc(`bases/${BASE}/definicoes/consentimento`).get(),
    db().doc(`bases/${BASE}/definicoes/grupoPais`).get(),
  ]);
  const c = cons.exists ? cons.data() : {};
  return {
    faixas,
    consentimento: { texto: c.texto || CONSENTIMENTO_PADRAO, versao: c.versao || "rascunho-1" },
    grupoPais: { link: grupo.exists ? grupo.data().link || "" : "" },
  };
});

/** Duas portas de entrada, a mesma função — pais pelo QR (sem sessão)
 *  ou voluntário na receção (sessão da Kinder); os dois ficam `estado:
 *  "confirmada"` logo ao registar, sem passo de confirmação nenhum
 *  (decisão de 2026-09: registo livre, sem fricção). Devolve o token
 *  do link da família UMA vez — não fica legível em lado nenhum
 *  depois (só o hash). */
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
  const criancasLimpas = d.criancas.map((c) => ({ dados: limparCrianca(c, faixas, voluntario ? c?.categoria : null), origem: c }));
  if (!voluntario) await limitarRegistoPublico(req);

  const token = randomBytes(18).toString("base64url");
  const familiaRef = col("familias").doc();
  const caminhoPessoas = `bases/${BASE}/familias/${familiaRef.id}/pessoas`;
  const [responsaveisComFoto, autorizadosComFoto, criancasComFoto] = await Promise.all([
    resolverFotosPessoas(responsaveis, new Map(), caminhoPessoas),
    resolverFotosPessoas(limparPessoas(d.autorizados, 6, false), new Map(), caminhoPessoas),
    Promise.all(criancasLimpas.map(async ({ dados, origem }) => {
      const ref = col("criancas").doc();
      const foto = await fotoOpcional(origem, `bases/${BASE}/criancas/${ref.id}.webp`);
      return { ref, dados: { ...dados, foto: foto ?? null } };
    })),
  ]);

  const lote = db().batch();
  lote.set(familiaRef, {
    responsaveis: responsaveisComFoto,
    autorizados: autorizadosComFoto,
    telefones: responsaveis.map((r) => soDigitos(r.telefone)),
    fotoAutorizada: d.fotoAutorizada === true,
    visitante: d.visitante === true,
    membro: d.membro === true,
    consentimento: {
      versao: texto(d.consentimento.versao, 30) || "rascunho-1",
      aceiteEm: agora(),
      origem: voluntario ? `voluntario:${voluntario}` : "qr",
    },
    estado: "confirmada",
    tokenHash: hashToken(token),
    ativo: true,
    criadoEm: agora(),
    criadoPor: voluntario,
  });
  for (const { ref, dados } of criancasComFoto) {
    lote.set(ref, { ...dados, familiaId: familiaRef.id, ativo: true, criadoEm: agora() });
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

/** "Nada é apagado, é desativado" (regra 5) — continua a valer para
 *  a líder remover uma família à mão. A retenção por RGPD
 *  (purgarFamiliasInativasKinder, abaixo) é a excepção deliberada: o
 *  consentimento já avisa a família que essa exclusão é a sério. */
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

/** Apaga a sério (não `ativo:false`) uma foto de criança/responsável/
 *  autorizado no Storage — nunca falha a purga toda por um ficheiro
 *  que talvez nem exista (ninguém subiu foto). */
async function apagarFotoSeExistir(caminho) {
  try { await admin.storage().bucket().file(caminho).delete(); } catch { /* sem foto, nada a apagar */ }
}

/** RGPD, decisão da igreja (2026-09): família sem check-in nenhum há
 *  MESES_RETENCAO é apagada a sério — família, crianças e fotos no
 *  Storage — nunca só `ativo:false`. Quem voltar tem de se registar
 *  de novo (o consentimento já avisa disto). Corre sozinha, todos os
 *  dias — `ultimoCheckinEm` é atualizado em cada check-in
 *  (checkinKinder); sem nenhum ainda, é `criadoEm` que conta. */
const MESES_RETENCAO = 6;

async function apagarFamiliaKinder(snap) {
  const f = snap.data();
  const familiaId = snap.id;
  const criancas = await col("criancas").where("familiaId", "==", familiaId).get();
  await Promise.all([
    ...criancas.docs.map((c) => c.ref.delete()),
    ...criancas.docs.map((c) => apagarFotoSeExistir(`bases/${BASE}/criancas/${c.id}.webp`)),
    ...[...(f.responsaveis || []), ...(f.autorizados || [])].map((p) => apagarFotoSeExistir(`bases/${BASE}/familias/${familiaId}/pessoas/${p.id}.webp`)),
  ]);
  await snap.ref.delete();
}

export const purgarFamiliasInativasKinder = onSchedule("every 24 hours", async () => {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESES_RETENCAO);
  const limiteMs = limite.getTime();
  const todas = await col("familias").get();
  for (const snap of todas.docs) {
    const f = snap.data();
    const referencia = (f.ultimoCheckinEm ?? f.criadoEm)?.toMillis?.();
    if (referencia && referencia < limiteMs) await apagarFamiliaKinder(snap);
  }
});

/** O `url` guardado em `licao`/`recurso`/`atividades[]` é sempre um
 *  download URL do Storage (nunca outra coisa — sobe sempre por
 *  `subir()` em apps/kinder/src/lib/licoes.js), então o caminho real
 *  do ficheiro está embutido nele; poupa ter de reconstruir o nome
 *  (que varia com a extensão: pdf, imagem, .docx…). */
function caminhoDeUrlStorage(url) {
  const m = /\/o\/([^?]+)/.exec(String(url || ""));
  return m ? decodeURIComponent(m[1]) : null;
}

async function apagarAnexoUrlSeExistir(url) {
  const caminho = caminhoDeUrlStorage(url);
  if (caminho) await apagarFotoSeExistir(caminho);
}

/** Espaço no Storage, decisão da igreja (2026-09): um domingo pode ter
 *  lição + recurso + várias atividades, até 20 MB cada — sem limite,
 *  isso cresce sem parar. Os ANEXOS (não a lição em si: título, resumo
 *  e resumo para os pais continuam no histórico) de lições com mais de
 *  MESES_RETENCAO_LICOES são apagados a sério do Storage; o documento
 *  fica com `licao`/`recurso`/`atividades` a null/vazio. Corre sozinha,
 *  todos os dias. */
const MESES_RETENCAO_LICOES = 3;

export const purgarAnexosLicoesAntigasKinder = onSchedule("every 24 hours", async () => {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESES_RETENCAO_LICOES);
  const limiteMs = limite.getTime();
  const todas = await col("licoes").get();
  for (const snap of todas.docs) {
    const l = snap.data();
    const criadoMs = l.criadoEm?.toMillis?.();
    if (!criadoMs || criadoMs >= limiteMs) continue;
    if (!l.licao && !(l.recursos || []).length && !(l.atividades || []).length) continue; // já sem anexos
    await Promise.all([
      apagarAnexoUrlSeExistir(l.licao?.url),
      ...(l.recursos || []).map((r) => apagarAnexoUrlSeExistir(r?.url)),
      ...(l.atividades || []).map((a) => apagarAnexoUrlSeExistir(a?.url)),
    ]);
    await snap.ref.update({ licao: null, recursos: [], atividades: [], anexosExcluidosEm: agora() });
  }
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
  const dadosAtuais = familiaSnap.data();
  const responsaveis = limparPessoas(d.responsaveis, 4, true);
  if (!responsaveis.length) {
    throw new HttpsError("invalid-argument", "Falta pelo menos um responsável com telemóvel.");
  }
  const faixas = await lerFaixas();
  const existentes = new Map((await criancasDaFamilia(familiaId)).map((c) => [c.id, c]));
  const caminhoPessoas = `bases/${BASE}/familias/${familiaId}/pessoas`;
  const [responsaveisComFoto, autorizadosComFoto] = await Promise.all([
    resolverFotosPessoas(responsaveis, new Map((dadosAtuais.responsaveis || []).map((p) => [p.id, p])), caminhoPessoas),
    resolverFotosPessoas(limparPessoas(d.autorizados, 6, false), new Map((dadosAtuais.autorizados || []).map((p) => [p.id, p])), caminhoPessoas),
  ]);
  const lote = db().batch();
  lote.update(familiaSnap.ref, {
    responsaveis: responsaveisComFoto,
    autorizados: autorizadosComFoto,
    telefones: responsaveis.map((r) => soDigitos(r.telefone)),
    fotoAutorizada: d.fotoAutorizada === true,
    atualizadoEm: agora(),
    atualizadoPor: req.auth?.uid ?? "familia",
  });
  const lista = Array.isArray(d.criancas) ? d.criancas.slice(0, 8) : [];
  await Promise.all(lista.map(async (c) => {
    const atual = c?.id ? existentes.get(c.id) : null;
    if (c?.id && !atual) return;
    const categoriaDada = pelosPais ? atual?.data().categoria : c?.categoria;
    const limpa = limparCrianca(c, faixas, categoriaDada);
    if (atual) {
      const foto = await fotoOpcional(c, `bases/${BASE}/criancas/${atual.id}.webp`);
      lote.update(atual.ref, { ...limpa, ...(foto !== undefined ? { foto } : {}), atualizadoEm: agora() });
    } else {
      const ref = col("criancas").doc();
      const foto = await fotoOpcional(c, `bases/${BASE}/criancas/${ref.id}.webp`);
      lote.set(ref, { ...limpa, foto: foto ?? null, familiaId, ativo: true, criadoEm: agora() });
    }
  }));
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
    .map((l) => ({ id: l.id, titulo: l.titulo, resumoPais: l.resumoPais, categorias: l.categorias, eventoId: l.eventoId ?? null, criadoEm: ms(l.criadoEm) }));

  return {
    familiaId: fam.id,
    estado: f.estado,
    responsaveis: f.responsaveis || [],
    autorizados: f.autorizados || [],
    fotoAutorizada: f.fotoAutorizada === true,
    criancas: criancas.map((c) => ({
      id: c.id, nome: c.nome, dataNascimento: c.dataNascimento, categoria: c.categoria ?? null,
      alergias: c.alergias || "", restricoesAlimentares: c.restricoesAlimentares || "", necessidades: c.necessidades || "",
      foto: c.foto ?? null,
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
 *  O bloco abaixo que confirma uma família `pendente` é só para dados
 *  antigos (2026-09: o registo deixou de ter passo de confirmação —
 *  `registarFamiliaKinder` já grava sempre `confirmada`) — nunca
 *  apagado (regra 5), só deixa de ser gerado. */
export const checkinKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const ids = [...new Set((req.data?.criancaIds || []).filter((x) => typeof x === "string"))].slice(0, 12);
  if (!ids.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma criança.");
  const eventoId = hojeEmLisboa();
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
      if (!s.exists) return;
      // ultimoCheckinEm é o que purgarFamiliasInativasKinder usa para
      // saber que a família ainda está viva — sem check-in nenhum, é
      // sempre criadoEm que conta (ver essa função).
      const extra = s.data().estado === "pendente" ? { estado: "confirmada", confirmadaPor: uid, confirmadaEm: agora() } : {};
      tx.update(s.ref, { ...extra, ultimoCheckinEm: agora() });
    });
  });
  return { eventoId, codigos };
});

/** Saída: o código tem de bater certo. Sem código, só uma líder — ou
 *  a Mestra da sala dessa criança neste culto, a mesma permissão da
 *  líder — e com o motivo registado (ex.: "avó autorizada, telemóvel
 *  sem bateria") — o My Kids também deixa, mas nunca em silêncio.
 *  A verificação da Mestra é por criança (a sua `categoria`, gravada
 *  no check-in): uma Mestra da Baby não força saída no Fun. */
export const checkoutKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const { criancaIds, codigo, levantadoPor, motivo } = req.data || {};
  const ids = [...new Set((criancaIds || []).filter((x) => typeof x === "string"))].slice(0, 12);
  if (!ids.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma criança.");
  const quem = texto(levantadoPor);
  if (!quem) throw new HttpsError("invalid-argument", "Diz quem veio buscar.");
  const forcado = !texto(codigo);
  if (forcado && !texto(motivo)) throw new HttpsError("invalid-argument", "Diz porque sai sem código.");
  const eventoId = hojeEmLisboa();
  const snaps = await Promise.all(ids.map((id) => refCheckin(eventoId, id).get()));
  let mestras = null;
  if (forcado && !souLider(req)) {
    const s = await db().doc(`eventos/${eventoId}/escalas/${BASE}`).get();
    mestras = s.exists ? s.data().mestras || {} : {};
  }
  const lote = db().batch();
  let saidas = 0;
  for (const s of snaps) {
    if (!s.exists || s.data().anulado) throw new HttpsError("failed-precondition", "Esta criança não fez check-in hoje.");
    const c = s.data();
    if (c.saidaEm) continue;
    if (!forcado) {
      if (texto(codigo).toUpperCase() !== c.codigo) throw new HttpsError("permission-denied", "O código não confere.");
    } else if (mestras && mestras[c.categoria] !== uid) {
      throw new HttpsError("permission-denied", "Sem código, só a líder, ou a mestra da sala, pode dar a saída.");
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

/* ── LIÇÃO ────────────────────────────────────────────────────── */

/** Publicar/editar a lição do dia — por Cloud Function (e não escrita
 *  direta, como seria de esperar por firestore.rules → licoes) porque
 *  é o único jeito de dar a mesma permissão da líder à Mestra: ela não
 *  tem papel de líder, só está listada em eventos/{e}/escalas/kinder.
 *  mestras[sala], e as rules não têm como olhar para isso ficheiro a
 *  ficheiro. O upload dos documentos continua direto do cliente para
 *  o Storage (bases/kinder/licoes/{id}-…, storage.rules aceita
 *  qualquer pessoa da Kinder nesse caminho) — só o que fica
 *  publicado na app é que passa por aqui, validado. */
export const guardarLicaoKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const { id, dados, novo } = req.data || {};
  const idLimpo = texto(id, 40);
  if (!idLimpo) throw new HttpsError("invalid-argument", "Falta o id da lição.");
  if (!dados || typeof dados !== "object") throw new HttpsError("invalid-argument", "Dados inválidos.");

  const categorias = Array.isArray(dados.categorias) ? dados.categorias.filter((c) => CATEGORIAS_KINDER.includes(c)) : [];
  if (!categorias.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma sala.");
  const titulo = texto(dados.titulo, 120);
  if (!titulo) throw new HttpsError("invalid-argument", "Falta o título.");
  const eventoId = DATA_RE.test(dados.eventoId || "") ? dados.eventoId : null;

  if (!souLider(req) && !(await souMestraDeAlgumaSala(uid, eventoId, categorias))) {
    throw new HttpsError("permission-denied", "Só a líder, ou a mestra de uma destas salas neste culto, pode publicar a lição.");
  }

  const limparDocumento = (u) => {
    if (!u) return null;
    const url = texto(u.url, 600);
    if (!url.startsWith("https://")) return null;
    return { url, nome: texto(u.nome, 200) };
  };
  const escrita = {
    titulo, categorias, eventoId,
    resumo: textoLongo(dados.resumo),
    resumoPais: textoLongo(dados.resumoPais),
    louvor: textoLongo(dados.louvor),
    recursos: (Array.isArray(dados.recursos) ? dados.recursos : []).slice(0, 6).map(limparDocumento).filter(Boolean),
    atividades: (Array.isArray(dados.atividades) ? dados.atividades : []).slice(0, 12).map(limparDocumento).filter(Boolean),
  };
  if ("licao" in dados) escrita.licao = limparDocumento(dados.licao);
  if (novo) {
    escrita.enviadoPor = uid;
    escrita.criadoEm = agora();
    escrita.ativo = true;
  }
  await db().doc(`bases/${BASE}/licoes/${idLimpo}`).set(escrita, { merge: true });
  return { ok: true };
});

/** "Excluir" é ativo:false (regra 5) — mesma permissão de
 *  guardarLicaoKinder (líder ou Mestra de uma das salas dessa lição,
 *  nesse culto). Lê o eventoId/categorias do próprio documento —
 *  nunca do que o cliente diz que é. */
export const desativarLicaoKinder = onCall(async (req) => {
  const uid = exigeKinder(req);
  const id = texto(req.data?.id, 40);
  if (!id) throw new HttpsError("invalid-argument", "Falta o id da lição.");
  const ref = db().doc(`bases/${BASE}/licoes/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Lição não encontrada.");
  const d = snap.data();
  if (!souLider(req) && !(await souMestraDeAlgumaSala(uid, d.eventoId, d.categorias || []))) {
    throw new HttpsError("permission-denied", "Só a líder, ou a mestra de uma destas salas neste culto, pode remover a lição.");
  }
  await ref.update({ ativo: false, removidaPor: uid, removidaEm: agora() });
  return { ok: true };
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
