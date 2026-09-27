/**
 * Notificações por e-mail — o segundo canal de `notificar()`
 * (`notificacoes.js`), ao lado do push. Pedido 2026-09: "sempre que
 * houver uma alteração importante, a pessoa recebe um e-mail".
 *
 * ── Porque existe, se já há push ─────────────────────────────────
 *
 * O push só chega a quem o ligou, e no iPhone só com a app instalada
 * no ecrã principal. O e-mail chega a toda a gente que deixou um
 * endereço — é o canal "garantido" que faltava.
 *
 * ── O fornecedor: Resend, por HTTP, sem SDK ──────────────────────
 *
 * Um `fetch` para https://api.resend.com — zero dependências novas
 * no `functions/package.json` (o Node 20 já traz `fetch`). Trocar de
 * fornecedor um dia é mexer em `enviarLote()` e em mais nada.
 *
 * ── A chave NÃO vive no código nem num secret do deploy ─────────
 *
 * Vive em `config/emailEnvio` (Firestore), documento que nenhuma regra
 * abre — só o Admin SDK o lê. É o mesmo padrão de `config/devAccess`
 * (`scripts/definirSenhaDev.mjs`). Porquê não `defineSecret`: um
 * secret que ainda não existe no Secret Manager faz FALHAR o deploy de
 * todas as functions no CI (`firebase.yml`), e este código tem de
 * poder entrar na `main` antes de alguém ter criado a conta. Assim,
 * sem chave, o e-mail simplesmente não sai (fica no log) e o push
 * continua como sempre. Define-se no Painel Pastoral (Perfil → "E-mail
 * dos avisos", `configurarEnvioEmail` abaixo) ou com
 * `scripts/definirEnvioEmail.mjs`.
 *
 * ── Onde está o endereço de cada pessoa ─────────────────────────
 *
 * `pessoas/{uid}/privado/email` — global como o PIN e o IBAN (quem
 * serve em duas bases tem um e-mail, não dois), e só a dona lê e
 * escreve (`firestore.rules`). Nenhum líder vê o e-mail de ninguém.
 * `semEmail: true` é "respondi que não tenho" — não recebe nada.
 *
 * ── Só a endereços CONFIRMADOS (2026-09) ─────────────────────────
 *
 * Pedido: "assim que a pessoa colocar o e-mail, recebe um e-mail para
 * o confirmar". Um código de 6 dígitos (`enviarCodigoEmail`), escrito
 * no próprio pop-up (`confirmarCodigoEmail`) — não um link: o link
 * abria no browser do e-mail, fora da app instalada, e às vezes noutro
 * telemóvel; o código deixa a pessoa onde está.
 *
 * `verificado: true` em `privado/email` só o escreve esta função (o
 * Admin SDK). As regras só deixam o cliente gravar `email`/`semEmail`/
 * `atualizadoEm`, e o cliente grava sempre o documento inteiro — por
 * isso qualquer mudança de endereço feita no cliente apaga o
 * `verificado` sozinha, sem mudar uma linha das regras. `emailDe()`
 * só devolve endereços confirmados: um erro de escrita
 * ("gmial.com") nunca recebe nada, e um endereço que devolve e-mails
 * estraga a reputação do domínio no Resend para toda a gente.
 *
 * ── O que vai por e-mail, e o que não (pedido 2026-09) ──────────
 *
 * Só o que é PESSOAL: o reembolso (pago/devolvido/indeferido), o
 * "confirma a tua presença" e as escalas. O recado do pastor não —
 * é para a base inteira, fica no push e no cartão do Início. As
 * escalas não saem na hora: juntam-se em `filaEmail/{uid}` e saem às
 * 20h num e-mail só por pessoa, agrupado por mês ("Saiu a tua escala
 * de outubro"), porque o líder publica o mês inteiro de uma vez e um
 * e-mail por domingo era ruído (`enviarResumosEmail`, notificacoes.js).
 *
 * ── Teto de 95 por dia ────────────────────────────────────────────
 *
 * O plano grátis do Resend é de 100/dia. Cada envio reserva o seu
 * lugar num contador por dia de Lisboa (`config/emailEnvio/uso/{dia}`,
 * numa transação — dois envios ao mesmo tempo nunca passam o teto
 * juntos). O que não cabe vai para a fila e sai no resumo do dia
 * seguinte, nunca se perde. O push não conta: é sempre instantâneo.
 *
 * ── Um e-mail por pessoa, nunca um "Para:" com todos ─────────────
 *
 * Um recado à equipa inteira são N e-mails separados (pelo endpoint
 * de lote, até 100 por pedido): pôr os endereços todos no mesmo
 * "Para:" mostrava o e-mail de cada voluntário a todos os outros.
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const db = () => admin.firestore();

const URL_LOTE = "https://api.resend.com/emails/batch";
export const POR_LOTE = 100; // o máximo do endpoint de lote
const REMETENTE_OMISSAO = "Igreja Onda <avisos@igrejaonda.pt>";

/** Mesmo formato que a regra do Firestore aceita — o que chega aqui
 *  já passou por ela, isto é só a última rede. */
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** O cabeçalho (logo igrejaonda branco + "PORTAL DO VOLUNTÁRIO" em
 *  verde água) é uma IMAGEM, não texto: o modo escuro do Gmail inverte
 *  as cores do texto e deixava-o quase preto sobre o azul (reportado
 *  2026-09); imagens nunca são invertidas. Servida pela app Pastoral
 *  (`apps/pastoral/public/email/cabecalho.png`, gerada por
 *  `scripts/gerar-cabecalho-email.cjs`). */
const CABECALHO = "https://pastoral.igrejaonda.pt/email/cabecalho.png";

/** 95 e não 100: margem para o e-mail de teste e para um reenvio. */
export const TETO_DIARIO = 95;

/** "2026-09-25" em Lisboa — o dia do contador. O servidor corre em UTC,
 *  e à meia-noite de verão o dia UTC ainda é o anterior. */
const hojeLisboa = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date());

const refUsoHoje = () => db().doc(`config/emailEnvio/uso/${hojeLisboa()}`);

/** Reserva até `n` envios do teto de hoje; devolve quantos couberam.
 *  Em transação: dois gatilhos ao mesmo tempo nunca passam o teto. Um
 *  envio que falhe depois de reservado conta na mesma — é o lado
 *  seguro (o Resend também o pode ter contado). */
export async function reservarEnvios(n) {
  if (n <= 0) return 0;
  const ref = refUsoHoje();
  return db().runTransaction(async (t) => {
    const s = await t.get(ref);
    const usados = s.exists ? s.data().enviados || 0 : 0;
    const dar = Math.max(0, Math.min(n, TETO_DIARIO - usados));
    if (dar > 0) {
      t.set(ref, { enviados: usados + dar, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    return dar;
  });
}

async function enviadosHoje() {
  const s = await refUsoHoje().get().catch(() => null);
  return s?.exists ? s.data().enviados || 0 : 0;
}

/** A configuração de envio, ou `null` se ainda não foi definida (ou
 *  foi desligada de propósito com `ativo:false`). */
export async function configEnvio() {
  const snap = await db().doc("config/emailEnvio").get().catch(() => null);
  if (!snap?.exists) return null;
  const c = snap.data();
  if (c.ativo === false || typeof c.chave !== "string" || !c.chave) return null;
  return { chave: c.chave, remetente: c.remetente || REMETENTE_OMISSAO };
}

/** `{ email, confirmado }` de uma pessoa, ou `null` (nunca respondeu,
 *  ou disse que não tem e-mail). */
export async function estadoEmailDe(uid) {
  const s = await db().doc(`pessoas/${uid}/privado/email`).get().catch(() => null);
  const d = s?.exists ? s.data() : null;
  if (!d || d.semEmail === true || typeof d.email !== "string" || !EMAIL_VALIDO.test(d.email)) return null;
  return { email: d.email.trim(), confirmado: d.verificado === true };
}

/** O endereço CONFIRMADO de uma pessoa, ou `null` — o único a que se
 *  manda um aviso (ver "Só a endereços CONFIRMADOS" no topo). */
export async function emailDe(uid) {
  const e = await estadoEmailDe(uid);
  return e?.confirmado ? e.email : null;
}

/** `[{ uid, email }]` de quem deixou endereço — um só por endereço. */
async function enderecos(uids) {
  const emails = await Promise.all(uids.map(emailDe));
  const vistos = new Set();
  const lista = [];
  uids.forEach((uid, i) => {
    const email = emails[i];
    if (!email || vistos.has(email)) return;
    vistos.add(email);
    lista.push({ uid, email });
  });
  return lista;
}

/** Guarda para o resumo seguinte o que hoje já não coube no teto. */
async function paraAFila(uid, { titulo, corpo, url }) {
  await db().doc(`filaEmail/${uid}`).set({
    // Timestamp.now() e não serverTimestamp(): vai DENTRO de um array
    // (ver CLAUDE.md raiz — um sentinel num array rebenta a escrita)
    pendentes: admin.firestore.FieldValue.arrayUnion({
      titulo: String(titulo ?? ""), corpo: String(corpo ?? ""), url: String(url ?? ""), em: admin.firestore.Timestamp.now(),
    }),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

const escapar = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O corpo do e-mail. Tabelas e estilos inline, de propósito: é o que
 *  o Gmail/Outlook no telemóvel desenham igual — CSS em `<style>` e
 *  flexbox são ignorados por metade dos clientes de e-mail. */
const RODAPE_AVISOS = "Recebes este e-mail porque o deixaste no Portal do Voluntário da Igreja Onda. "
  + "Para mudar ou deixar de receber: na app, toca na tua foto → E-mail para avisos.";

/** `codigo` (opcional): o e-mail de confirmação — mostra o código em
 *  grande no lugar do botão, e o rodapé diz o que fazer se não foi a
 *  própria pessoa a pedi-lo. */
export function montarEmail({ titulo, corpo, url, codigo, rodape = RODAPE_AVISOS }) {
  const t = escapar(titulo);
  const c = escapar(corpo).replace(/\n/g, "<br>");
  const u = escapar(url || "https://igrejaonda.pt");
  const acao = codigo
    ? `<div style="display:inline-block;background:#eef1fb;border-radius:16px;padding:14px 12px 14px 22px;font-size:34px;font-weight:800;letter-spacing:.3em;color:#0019be;font-family:Outfit,Arial,Helvetica,sans-serif">${escapar(codigo)}</div>`
    : `<a href="${u}" style="display:inline-block;background:#0019be;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:100px">Abrir o Portal</a>`;
  const r = escapar(rodape).replace("E-mail para avisos", "<b>E-mail para avisos</b>");
  const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${t}</title></head>
<body style="margin:0;padding:0;background:#eef1fb;font-family:Outfit,Arial,Helvetica,sans-serif;color:#0b1033">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1fb;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td bgcolor="#0019be" style="background:#0019be;padding:0;line-height:0;font-size:0">
<img src="${CABECALHO}" width="480" alt="igrejaonda · Portal do Voluntário" style="display:block;width:100%;max-width:480px;height:auto;border:0;color:#ffffff;font-size:15px;line-height:1.4">
</td></tr>
<tr><td style="padding:26px 24px 8px">
<h1 style="margin:0;font-size:22px;line-height:1.25;letter-spacing:-.02em">${t}</h1>
<p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:#2b3060">${c}</p>
</td></tr>
<tr><td style="padding:18px 24px 26px">
${acao}
</td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid #e3e6f3;font-size:12px;line-height:1.5;color:#6b7194">
${r}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const texto = codigo
    ? `${titulo}\n\n${corpo}\n\n${codigo}\n\n—\n${rodape}`
    : `${titulo}\n\n${corpo}\n\nAbrir o Portal: ${url || "https://igrejaonda.pt"}\n\n—\n${rodape}`;
  return { html, texto };
}

/** Um pedido ao endpoint de lote. Devolve quantos seguiram. */
export async function enviarLote(cfg, mensagens) {
  const resposta = await fetch(URL_LOTE, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify(mensagens),
  });
  if (!resposta.ok) {
    // a mensagem do Resend diz o que falta (domínio por verificar,
    // chave inválida, limite diário) — vai inteira para o log
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Resend ${resposta.status}: ${corpo.slice(0, 300)}`);
  }
  return mensagens.length;
}

/**
 * Envia a mesma notificação por e-mail a quem destas pessoas deixou
 * um endereço, dentro do teto de hoje; quem não couber fica na fila
 * para o resumo seguinte. Nunca lança por falta de configuração — sem
 * chave, devolve `{ enviados: 0, motivo }` e o push segue sozinho.
 */
export async function enviarEmails(uids, { titulo, corpo, url }) {
  const cfg = await configEnvio();
  if (!cfg) return { enviados: 0, motivo: "sem-configuracao" };

  const para = await enderecos(uids);
  if (!para.length) return { enviados: 0, motivo: "ninguem-com-email" };

  const cabem = await reservarEnvios(para.length);
  const agora = para.slice(0, cabem);
  const depois = para.slice(cabem);
  await Promise.all(depois.map(({ uid }) => paraAFila(uid, { titulo, corpo, url })));

  const { html, texto } = montarEmail({ titulo, corpo, url });
  const assunto = String(titulo ?? "Igreja Onda").slice(0, 120);
  const mensagens = agora.map(({ email }) => ({
    from: cfg.remetente, to: [email], subject: assunto, html, text: texto,
  }));

  let enviados = 0;
  for (let i = 0; i < mensagens.length; i += POR_LOTE) {
    enviados += await enviarLote(cfg, mensagens.slice(i, i + POR_LOTE));
  }
  logger.info(`email: ${enviados} enviados, ${depois.length} para a fila (teto) — "${assunto}"`);
  return { enviados, naFila: depois.length };
}

/* ══════════════════════════════════════════════════════════════
 *  Configurar pelo Painel Pastoral (2026-09)
 * ══════════════════════════════════════════════════════════════
 *
 * Pedido: "pelo telemóvel, sem computador". A chave vai do telemóvel
 * para aqui por HTTPS e daqui para `config/emailEnvio` — nunca passa
 * por uma conversa, um ficheiro ou um repositório. E NUNCA volta: estas
 * funções devolvem só se há chave e os últimos 4 caracteres, para dar
 * para reconhecer qual está lá sem a expor a quem tenha o painel
 * aberto. Trocar a chave é gravar outra por cima.
 *
 * Só `ve_tudo_pastoral` (a equipa pastoral, e o acesso de dev ao
 * painel): é uma configuração da igreja toda, não de uma base.
 */
function exigeVisaoPastoral(req) {
  if (req.auth?.token?.ve_tudo_pastoral !== true) {
    throw new HttpsError("permission-denied", "Só a equipa pastoral configura o e-mail.");
  }
}

async function estadoAtual() {
  const [envio, publico] = await Promise.all([
    db().doc("config/emailEnvio").get().catch(() => null),
    db().doc("config/email").get().catch(() => null),
  ]);
  const e = envio?.exists ? envio.data() : {};
  const chave = typeof e.chave === "string" ? e.chave : "";
  return {
    temChave: !!chave,
    chaveFim: chave ? chave.slice(-4) : null,
    remetente: e.remetente || REMETENTE_OMISSAO,
    ativo: !!chave && e.ativo !== false,
    pedirNoLogin: publico?.exists ? publico.data().pedirNoLogin === true : false,
    enviadosHoje: await enviadosHoje(),
    tetoDiario: TETO_DIARIO,
  };
}

export const estadoEnvioEmail = onCall(async (req) => {
  exigeVisaoPastoral(req);
  return estadoAtual();
});

/** Grava o que vier (tudo opcional): `chave` nova, `remetente`,
 *  `ativo` (envio ligado), `pedirNoLogin` (o pop-up nas bases). */
export const configurarEnvioEmail = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { chave, remetente, ativo, pedirNoLogin } = req.data || {};
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const envio = { atualizadoEm: agora, atualizadoPor: req.auth.uid };

  if (chave !== undefined && chave !== null && chave !== "") {
    const limpa = String(chave).trim();
    if (!/^re_[A-Za-z0-9_-]{8,}$/.test(limpa)) {
      throw new HttpsError("invalid-argument", "Isso não parece uma chave do Resend (começa por re_).");
    }
    envio.chave = limpa;
  }
  if (remetente !== undefined) {
    const r = String(remetente || "").trim();
    if (r && !/^[^<>]*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$|^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r)) {
      throw new HttpsError("invalid-argument", "Remetente inválido — ex.: Igreja Onda <avisos@igrejaonda.pt>");
    }
    envio.remetente = r || REMETENTE_OMISSAO;
  }
  if (typeof ativo === "boolean") envio.ativo = ativo;

  await db().doc("config/emailEnvio").set(envio, { merge: true });
  if (typeof pedirNoLogin === "boolean") {
    await db().doc("config/email").set({ pedirNoLogin, atualizadoEm: agora }, { merge: true });
  }
  logger.info("email: configuração alterada", { por: req.auth.uid, chaveNova: !!envio.chave, ativo, pedirNoLogin });
  return estadoAtual();
});

/** Um e-mail de teste com a chave gravada — para confirmar domínio e
 *  chave antes de ligar tudo. Devolve o erro do Resend por extenso. */
export const enviarEmailTeste = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const para = String(req.data?.para || "").trim();
  if (!EMAIL_VALIDO.test(para)) throw new HttpsError("invalid-argument", "E-mail de destino inválido.");

  const snap = await db().doc("config/emailEnvio").get();
  const c = snap.exists ? snap.data() : {};
  if (!c.chave) throw new HttpsError("failed-precondition", "Ainda não há chave gravada.");
  if (!(await reservarEnvios(1))) {
    throw new HttpsError("resource-exhausted", `Já saíram ${TETO_DIARIO} e-mails hoje — o teto diário. Tenta amanhã.`);
  }

  const { html, texto } = montarEmail({
    titulo: "Teste — Portal do Voluntário",
    corpo: "Se estás a ler isto, os e-mails do Portal do Voluntário estão a funcionar.",
    url: "https://pastoral.igrejaonda.pt/",
  });
  try {
    await enviarLote({ chave: c.chave, remetente: c.remetente || REMETENTE_OMISSAO }, [{
      from: c.remetente || REMETENTE_OMISSAO, to: [para], subject: "Teste — Portal do Voluntário", html, text: texto,
    }]);
  } catch (e) {
    throw new HttpsError("failed-precondition", String(e.message || e).slice(0, 300));
  }
  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  Confirmar o e-mail com um código (2026-09)
 * ══════════════════════════════════════════════════════════════
 *
 * Qualquer pessoa com sessão, para o SEU e-mail (o uid vem do token,
 * nunca do pedido). O código não fica em lado nenhum que o cliente
 * leia: vive em `pessoas/{uid}/privado/emailCodigo` (o `privado`
 * genérico das regras está fechado) e só como hash.
 *
 * Travões, porque cada código gasta um lugar do teto de 95 por dia
 * que as escalas também usam: um código por minuto, 5 por pessoa por
 * dia, 5 tentativas por código, 30 minutos de validade.
 */
const VALIDADE_CODIGO_MS = 30 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;
const CODIGOS_POR_DIA = 5;
const TENTATIVAS_POR_CODIGO = 5;

const refCodigo = (uid) => db().doc(`pessoas/${uid}/privado/emailCodigo`);
const hashCodigo = (uid, codigo) => createHash("sha256").update(`${uid}:${codigo}`).digest();

function exigeSessao(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Entra primeiro no Portal.");
  return req.auth.uid;
}

/** Grava o e-mail (por confirmar) e manda-lhe um código de 6 dígitos.
 *  O e-mail fica gravado mesmo que o envio não aconteça (teto, rede):
 *  a pessoa não tem de o escrever outra vez, só de pedir outro código.
 *  Devolve `{ enviado: true }`, ou `{ jaConfirmado: true }` se este
 *  endereço já estava confirmado (não gasta nada). */
export const enviarCodigoEmail = onCall(async (req) => {
  const uid = exigeSessao(req);
  const email = String(req.data?.email || "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email) || email.length > 254) {
    throw new HttpsError("invalid-argument", "Esse e-mail não parece certo — confirma se falta alguma letra.");
  }

  const refEmail = db().doc(`pessoas/${uid}/privado/email`);
  const [atualSnap, codSnap] = await Promise.all([refEmail.get(), refCodigo(uid).get()]);
  const atual = atualSnap.exists ? atualSnap.data() : null;
  if (atual?.email === email && atual.verificado === true && atual.semEmail !== true) return { jaConfirmado: true };

  const agora = admin.firestore.FieldValue.serverTimestamp();
  if (atual?.email !== email || atual?.semEmail === true || atual?.verificado !== false) {
    await refEmail.set({ email, semEmail: false, verificado: false, atualizadoEm: agora });
  }

  const cod = codSnap.exists ? codSnap.data() : {};
  const dia = hojeLisboa();
  const enviosHoje = cod.dia === dia ? cod.enviosHoje || 0 : 0;
  const ultimo = cod.enviadoEm?.toMillis?.() ?? 0;
  if (Date.now() - ultimo < ESPERA_REENVIO_MS) {
    throw new HttpsError("resource-exhausted", "Acabámos de te mandar um código — espera um minuto antes de pedir outro.", { motivo: "espera" });
  }
  if (enviosHoje >= CODIGOS_POR_DIA) {
    throw new HttpsError("resource-exhausted", "Já pediste muitos códigos hoje. Tenta outra vez amanhã.", { motivo: "pessoa" });
  }

  const cfg = await configEnvio();
  if (!cfg) {
    throw new HttpsError("failed-precondition", "O envio de e-mails ainda não está ligado. Confirmas mais tarde.", { motivo: "desligado" });
  }
  if (!(await reservarEnvios(1))) {
    throw new HttpsError("resource-exhausted", "Hoje já saíram todos os e-mails que podemos mandar. Pede o código amanhã.", { motivo: "teto" });
  }

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await refCodigo(uid).set({
    hash: hashCodigo(uid, codigo).toString("hex"),
    email,
    expiraEm: admin.firestore.Timestamp.fromMillis(Date.now() + VALIDADE_CODIGO_MS),
    tentativas: 0,
    enviadoEm: admin.firestore.Timestamp.now(),
    dia,
    enviosHoje: enviosHoje + 1,
  });

  const { html, texto } = montarEmail({
    titulo: "Confirma o teu e-mail",
    corpo: "Escreve este código no Portal do Voluntário para confirmares o teu e-mail. Vale 30 minutos.",
    codigo,
    rodape: "Se não foste tu a pedir este código, ignora este e-mail — sem o código, nada muda.",
  });
  try {
    await enviarLote(cfg, [{
      from: cfg.remetente, to: [email], subject: `${codigo} é o teu código do Portal do Voluntário`, html, text: texto,
    }]);
  } catch (e) {
    logger.error("email: código de confirmação não saiu", { uid, erro: String(e.message || e) });
    throw new HttpsError("unavailable", "Não conseguimos mandar o e-mail agora. Tenta daqui a pouco.", { motivo: "envio" });
  }
  return { enviado: true };
});

/** Confere o código e marca o e-mail como confirmado. */
export const confirmarCodigoEmail = onCall(async (req) => {
  const uid = exigeSessao(req);
  const codigo = String(req.data?.codigo || "").replace(/\D/g, "");
  if (codigo.length !== 6) throw new HttpsError("invalid-argument", "O código tem 6 números.");

  const snap = await refCodigo(uid).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Pede um código novo.");
  const c = snap.data();
  if ((c.expiraEm?.toMillis?.() ?? 0) < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Este código já expirou — pede outro.");
  }
  if ((c.tentativas || 0) >= TENTATIVAS_POR_CODIGO) {
    throw new HttpsError("resource-exhausted", "Demasiadas tentativas com este código — pede outro.");
  }

  const guardado = Buffer.from(String(c.hash || ""), "hex");
  const certo = guardado.length === 32 && timingSafeEqual(hashCodigo(uid, codigo), guardado);
  if (!certo) {
    const tentativas = (c.tentativas || 0) + 1;
    await snap.ref.set({ tentativas }, { merge: true });
    const faltam = TENTATIVAS_POR_CODIGO - tentativas;
    throw new HttpsError("invalid-argument", faltam > 0
      ? `Código errado. ${faltam === 1 ? "Resta 1 tentativa" : `Restam ${faltam} tentativas`}.`
      : "Código errado. Pede um código novo.");
  }

  // o endereço pode ter mudado entre o pedido do código e agora
  const refEmail = db().doc(`pessoas/${uid}/privado/email`);
  const atual = await refEmail.get();
  if (!atual.exists || atual.data().email !== c.email || atual.data().semEmail === true) {
    throw new HttpsError("failed-precondition", "O teu e-mail mudou entretanto — pede um código novo.");
  }
  const agora = admin.firestore.FieldValue.serverTimestamp();
  await refEmail.set({ verificado: true, verificadoEm: agora, atualizadoEm: agora }, { merge: true });
  // trabalho feito, não histórico (como a filaEmail)
  await snap.ref.delete();
  logger.info("email: confirmado", { uid });
  return { confirmado: true, email: c.email };
});
