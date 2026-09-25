/**
 * Notificações push — o lado do servidor.
 *
 * O contraponto de `packages/shared/src/lib/push.js`, que grava o
 * token de cada dispositivo. Aqui só se envia.
 *
 * ── Payload só de `data`, nunca `notification` ──────────────────
 *
 * É a decisão que mais afeta o resultado, e a mais fácil de desfazer
 * por engano. Um payload com o bloco `notification` faz o browser
 * desenhar a notificação sozinho **e** chamar o `onBackgroundMessage`
 * do service worker — a pessoa recebe duas notificações iguais. Com
 * `data` só, o service worker é o único a desenhar, e é ele que
 * decide o ícone, o agrupamento e para onde o toque leva.
 *
 * Por isso `titulo`/`corpo`/`url`/`tag` vão dentro de `data`, como
 * strings (o FCM só aceita strings em `data` — um número ou um
 * booleano aqui é um erro em tempo de execução, não de compilação).
 *
 * ── Limpar tokens mortos é obrigatório, não higiene ─────────────
 *
 * Um token morre quando a pessoa desinstala a app, limpa os dados do
 * browser ou troca de telemóvel. O FCM responde
 * `registration-token-not-registered`, e um token desses fica a
 * falhar para sempre se ninguém o apagar — a somar latência a cada
 * envio e a sujar os logs até ninguém os ler. Apaga-se na resposta do
 * próprio envio, que é o único momento em que se sabe.
 *
 * ── Nada aqui bloqueia o que estava a acontecer ─────────────────
 *
 * Todas as chamadas a `notificar()` são "dispara e esquece", com o
 * erro apanhado. Um reembolso não pode falhar por o FCM estar em
 * baixo, e um recado que foi gravado tem de continuar gravado mesmo
 * que a notificação não saia.
 */
import "./opcoes.js";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  POR_LOTE, configEnvio, emailDe, enviarEmails, enviarLote, montarEmail, reservarEnvios,
} from "./email.js";

const db = () => admin.firestore();

/** Os domínios por base, para a notificação abrir a app certa de quem
 *  serve em mais do que uma. O subdomínio é sempre o `baseId` — é o
 *  que os torna endereçáveis sem uma tabela (ver o comentário em
 *  `auth.js`, `packages/shared`). */
const urlDaBase = (baseId, caminho = "/") => `https://${baseId}.igrejaonda.pt${caminho}`;

/**
 * Envia a uma lista de pessoas, pelos dois canais: push (a quem o
 * ligou) e e-mail (a quem deixou um endereço — `email.js`). O coração
 * do ficheiro; tudo o resto são gatilhos que lhe chamam.
 *
 * Os dois canais são independentes: um falhar nunca impede o outro
 * (o Resend em baixo não pode calar o push, nem o contrário).
 *
 * @param uids      quem recebe (duplicados são ignorados)
 * @param titulo    curto — no Android corta aos ~50 caracteres; é
 *                  também o assunto do e-mail
 * @param corpo     a frase
 * @param url       para onde o toque (ou o botão do e-mail) leva
 * @param tag       assunto, para notificações do mesmo tipo se
 *                  substituírem em vez de se empilharem (só push)
 * @param email     `false` para um gatilho que não deve ir por e-mail
 *                  na hora (o recado, que é da base inteira; as
 *                  escalas, que vão no resumo das 20h — ver email.js)
 */
export async function notificar(uids, { titulo, corpo, url, tag, email = true }) {
  const unicos = [...new Set((uids || []).filter(Boolean))];
  if (!unicos.length) return { enviadas: 0, emails: 0 };

  const [push, mail] = await Promise.allSettled([
    enviarPush(unicos, { titulo, corpo, url, tag }),
    email ? enviarEmails(unicos, { titulo, corpo, url }) : Promise.resolve({ enviados: 0 }),
  ]);
  if (mail.status === "rejected") logger.error("notificar: e-mail falhou", mail.reason);
  if (push.status === "rejected") throw push.reason;
  return { ...push.value, emails: mail.status === "fulfilled" ? mail.value.enviados : 0 };
}

/** O canal push (FCM) — o que `notificar` fazia sozinho até 2026-09. */
async function enviarPush(unicos, { titulo, corpo, url, tag }) {
  // um documento por dispositivo; uma pessoa pode ter telemóvel e
  // portátil, e recebe nos dois
  const porPessoa = await Promise.all(unicos.map((uid) =>
    db().collection(`pessoas/${uid}/dispositivos`).get().catch(() => null)));

  const tokens = [];
  porPessoa.forEach((snap, i) => {
    snap?.forEach((d) => tokens.push({ token: d.id, uid: unicos[i] }));
  });
  if (!tokens.length) return { enviadas: 0 };

  // o FCM aceita 500 por chamada; a igreja tem ~150 pessoas, mas o
  // lote existe para o dia em que tiver 600 e ninguém se lembrar disto
  const lotes = [];
  for (let i = 0; i < tokens.length; i += 500) lotes.push(tokens.slice(i, i + 500));

  let enviadas = 0;
  const mortos = [];

  for (const lote of lotes) {
    const resposta = await admin.messaging().sendEachForMulticast({
      tokens: lote.map((t) => t.token),
      // só `data` — ver o cabeçalho deste ficheiro
      data: {
        titulo: String(titulo ?? "igrejaonda"),
        corpo: String(corpo ?? ""),
        url: String(url ?? "/"),
        tag: String(tag ?? "igrejaonda"),
      },
      // a notificação de um culto não vale nada no dia seguinte
      android: { ttl: 60 * 60 * 24 * 1000, priority: "high" },
      apns: { headers: { "apns-expiration": String(Math.floor(Date.now() / 1000) + 86400) } },
      webpush: { headers: { TTL: "86400" }, fcmOptions: { link: String(url ?? "/") } },
    });

    resposta.responses.forEach((r, i) => {
      if (r.success) { enviadas++; return; }
      const codigo = r.error?.code ?? "";
      if (codigo.includes("registration-token-not-registered")
        || codigo.includes("invalid-registration-token")
        || codigo.includes("invalid-argument")) {
        mortos.push(lote[i]);
      }
    });
  }

  await Promise.all(mortos.map(({ uid, token }) =>
    db().doc(`pessoas/${uid}/dispositivos/${token}`).delete().catch(() => {})));

  if (mortos.length) logger.info(`notificacoes: ${mortos.length} tokens mortos apagados`);
  return { enviadas, mortos: mortos.length };
}

/** Dispara e esquece. Todo o gatilho usa isto, nunca o `notificar`
 *  direto: a coisa que estava a acontecer (gravar um reembolso, um
 *  recado, uma escala) não pode falhar porque o FCM está em baixo. */
export function notificarSemEsperar(uids, conteudo) {
  notificar(uids, conteudo).catch((e) => logger.error("notificar falhou", e));
}

/** Quem está ativo numa base. Usado pelos gatilhos que falam com uma
 *  equipa inteira em vez de com uma pessoa. */
export async function pessoasAtivasDaBase(baseId) {
  const snap = await db().collection(`bases/${baseId}/pessoas`)
    .where("ativo", "==", true).get().catch(() => null);
  return snap ? snap.docs.map((d) => d.id) : [];
}

/* ══════════════════════════════════════════════════════════════
 *  GATILHO 1 — o recado do pastor
 * ══════════════════════════════════════════════════════════════
 *
 * O recado (`recados/{id}`) aparece no Início da base e, até aqui, não
 * batia em lado nenhum: a própria folha de envio no Painel Pastoral
 * avisa o pastor de que "ninguém recebe notificação". Esta é a linha
 * que torna esse aviso desatualizado — e está assinalado lá para ser
 * corrigido junto com isto.
 *
 * Gatilho no documento e não dentro de `enviarRecadoPastoral` porque
 * o recado pode vir a ser criado por outro caminho (a coleção já tem
 * `baseId` e autor, e nada nela é específico do painel pastoral); um
 * gatilho no dado cobre os dois casos sem se lembrar de ninguém.
 */
export const notificarRecado = onDocumentWritten("recados/{id}", async (evento) => {
  const antes = evento.data?.before?.data();
  const depois = evento.data?.after?.data();
  if (!depois || antes) return;                      // só na criação
  if (depois.dispensado === true) return;

  const uids = await pessoasAtivasDaBase(depois.baseId);
  await notificar(uids, {
    titulo: depois.urgente ? "Recado urgente" : "Recado do pastor",
    corpo: String(depois.texto ?? "").slice(0, 160),
    url: urlDaBase(depois.baseId),
    tag: "recado",
    // só push (pedido 2026-09): o recado é para a base inteira — por
    // e-mail, um recado às dez bases eram ~120 de uma vez, e o cartão
    // no Início já é o caminho garantido
    email: false,
  });
});

/* ══════════════════════════════════════════════════════════════
 *  GATILHO 2 — o reembolso decidido
 * ══════════════════════════════════════════════════════════════
 *
 * Está escrito como débito consciente no `CLAUDE.md` do Financeiro:
 * "sem push/email (nenhuma base tem). O aviso de pago/devolvido é só
 * o cartão no Início de cada base". Agora é as duas coisas — o cartão
 * fica, porque quem desligou as notificações continua a precisar de
 * o ver.
 *
 * Só nas transições que interessam a quem pediu: o dinheiro entrou, o
 * pedido voltou para trás, ou foi indeferido. Não notifica "aprovado"
 * — isso é o pedido a andar, não uma decisão final, e três
 * notificações por reembolso ensinam a ignorá-las todas.
 */
const ESTADOS_QUE_NOTIFICAM = {
  pago: { titulo: "Reembolso pago", corpo: "O teu pedido foi pago." },
  devolvido: { titulo: "Reembolso devolvido", corpo: "O Financeiro devolveu o teu pedido — vê o que falta." },
  indeferido: { titulo: "Reembolso indeferido", corpo: "O teu líder indeferiu o pedido." },
};

export const notificarReembolso = onDocumentWritten("bases/{baseId}/reembolsos/{id}", async (evento) => {
  const antes = evento.data?.before?.data();
  const depois = evento.data?.after?.data();
  if (!depois || !antes) return;                     // só em mudanças de estado
  if (antes.estado === depois.estado) return;

  const modelo = ESTADOS_QUE_NOTIFICAM[depois.estado];
  if (!modelo || !depois.pessoaId) return;

  await notificar([depois.pessoaId], {
    ...modelo,
    url: urlDaBase(evento.params.baseId, "/"),
    // a mesma tag para todos os reembolsos: se três forem pagos de
    // uma vez (o pagamento em lote agrupa por pessoa), a pessoa
    // recebe uma notificação e não três
    tag: "reembolso",
  });
});

/* ══════════════════════════════════════════════════════════════
 *  GATILHO 3 — entraste na escala
 * ══════════════════════════════════════════════════════════════
 *
 * Só a QUEM ENTROU, nunca à escala toda. O líder mexe na escala
 * várias vezes até a fechar; notificar toda a gente a cada gravação
 * seria a forma mais rápida de a equipa desligar as notificações no
 * primeiro mês.
 *
 * Um gatilho no documento da escala cobre as dez bases de uma vez —
 * a alternativa era acrescentar a mesma linha às seis
 * `guardarEscala<Base>`, e à sétima que aparecer com a base seguinte.
 * Lê as duas formas de escala do repo, a mesma deteção de
 * `escalasCrossBase`.
 */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "2026-09-27" → "domingo, 27 de setembro". Um id que não seja data
 *  (não devia acontecer) volta tal como veio. */
function dataPorExtenso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const hojeLisboa = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date());

function pessoasDaEscala(d) {
  if (!d) return new Set();
  if (Array.isArray(d.lugares) && d.lugares.length) {
    return new Set(d.lugares.flatMap((l) => [l.titularId, l.aprendizId]).filter(Boolean));
  }
  return new Set((d.pessoas || []).filter(Boolean));
}

export const notificarEscala = onDocumentWritten("eventos/{eventoId}/escalas/{baseId}", async (evento) => {
  const antes = pessoasDaEscala(evento.data?.before?.data());
  const depois = pessoasDaEscala(evento.data?.after?.data());

  const novos = [...depois].filter((uid) => !antes.has(uid));
  if (!novos.length) return;

  const { eventoId, baseId } = evento.params;
  const [base, doc] = await Promise.all([
    db().doc(`bases/${baseId}`).get().catch(() => null),
    db().doc(`eventos/${eventoId}`).get().catch(() => null),
  ]);

  const nomeBase = base?.exists ? (base.data().nome ?? baseId) : baseId;
  // o nome do culto especial, ou a data — o mesmo critério do
  // `nomeEvento` partilhado, mas sem poder importá-lo (as Functions
  // não trazem packages/shared para o deploy)
  // (2026-09: a data por extenso — "2026-09-27" cru ficava feio no
  // assunto de um e-mail)
  const data = doc?.exists ? (doc.data().data ?? eventoId) : eventoId;
  const quando = doc?.exists && doc.data().tipo ? `${doc.data().tipo} (${dataPorExtenso(data)})` : dataPorExtenso(data);

  // push na hora; o e-mail vai no resumo das 20h (ver abaixo)
  await notificar(novos, {
    titulo: `Estás escalado — ${nomeBase}`,
    corpo: `Foste escalado para ${quando}.`,
    url: urlDaBase(baseId),
    tag: `escala-${eventoId}`,
    email: false,
  });

  // um domingo que já passou não é notícia para ninguém
  if (String(data).slice(0, 10) < hojeLisboa()) return;
  const entrada = {
    eventoId, baseId, nomeBase, data: String(data).slice(0, 10),
    tipo: doc?.exists ? (doc.data().tipo ?? null) : null,
    // Timestamp.now(), não serverTimestamp(): vai dentro de um array
    em: admin.firestore.Timestamp.now(),
  };
  await Promise.all(novos.map((uid) => db().doc(`filaEmail/${uid}`).set({
    escalas: admin.firestore.FieldValue.arrayUnion(entrada),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })));
});

/* ══════════════════════════════════════════════════════════════
 *  O RESUMO POR E-MAIL — todos os dias às 20h (2026-09)
 * ══════════════════════════════════════════════════════════════
 *
 * Pedido: "quando sai a escala, ela já publica o mês todo — não é um
 * aviso por semana; é 'já saiu a tua escala de outubro'". O gatilho
 * das escalas acima só junta em `filaEmail/{uid}`; isto manda UM
 * e-mail por pessoa, com os dias agrupados por mês. Leva também o que
 * ficou de fora do teto diário noutro envio (`pendentes`, email.js).
 *
 * Antes de mandar, confirma cada domingo na escala a sério: quem foi
 * posto e tirado no mesmo dia não recebe "estás escalado" às 20h.
 *
 * Quem não couber no teto de hoje (95) fica na fila para amanhã, pela
 * ordem de chegada — o mais antigo sai primeiro. O documento da fila
 * apaga-se depois de enviado: é trabalho por fazer, não histórico (o
 * histórico é a própria escala).
 */
const MESES_NOME = MESES;

function assuntoDoResumo(escalas, pendentes) {
  const meses = [...new Set(escalas.map((e) => e.data.slice(0, 7)))].sort()
    .map((m) => MESES_NOME[Number(m.slice(5)) - 1]);
  if (meses.length && !pendentes.length) {
    return `Saiu a tua escala de ${meses.length === 1 ? meses[0] : `${meses.slice(0, -1).join(", ")} e ${meses.at(-1)}`}`;
  }
  if (!escalas.length && pendentes.length === 1) return pendentes[0].titulo || "Portal do Voluntário";
  return "Novidades no Portal do Voluntário";
}

function corpoDoResumo(escalas, pendentes) {
  const linhas = [];
  const porMes = new Map();
  for (const e of [...escalas].sort((a, b) => a.data.localeCompare(b.data))) {
    const m = e.data.slice(0, 7);
    if (!porMes.has(m)) porMes.set(m, []);
    porMes.get(m).push(e);
  }
  for (const [m, lista] of porMes) {
    if (linhas.length) linhas.push("");
    linhas.push(`Estás na escala de ${MESES_NOME[Number(m.slice(5)) - 1]}:`);
    for (const e of lista) {
      linhas.push(`• ${e.tipo ? `${e.tipo} — ` : ""}${dataPorExtenso(e.data)} · ${e.nomeBase}`);
    }
  }
  for (const p of pendentes) {
    if (linhas.length) linhas.push("");
    linhas.push(`${p.titulo}${p.corpo ? ` — ${p.corpo}` : ""}`);
  }
  return linhas.join("\n");
}

export const enviarResumosEmail = onSchedule(
  { schedule: "every day 20:00", timeZone: "Europe/Lisbon" },
  async () => {
    const cfg = await configEnvio();
    if (!cfg) return;
    const fila = await db().collection("filaEmail").get();
    if (fila.empty) return;

    // cada escala lida uma vez, mesmo que meia base esteja nela
    const cacheEscalas = new Map();
    const naEscala = async (eventoId, baseId, uid) => {
      const k = `${eventoId}/${baseId}`;
      if (!cacheEscalas.has(k)) {
        const s = await db().doc(`eventos/${eventoId}/escalas/${baseId}`).get().catch(() => null);
        cacheEscalas.set(k, pessoasDaEscala(s?.exists ? s.data() : null));
      }
      return cacheEscalas.get(k).has(uid);
    };

    const prontos = [];
    for (const doc of fila.docs) {
      const uid = doc.id;
      const d = doc.data();
      const email = await emailDe(uid);
      if (!email) { await doc.ref.delete(); continue; }   // sem e-mail: nada a guardar
      const escalas = [];
      const vistos = new Set();
      for (const e of d.escalas || []) {
        const k = `${e.eventoId}/${e.baseId}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (await naEscala(e.eventoId, e.baseId, uid)) escalas.push(e);
      }
      const pendentes = d.pendentes || [];
      if (!escalas.length && !pendentes.length) { await doc.ref.delete(); continue; }
      const desde = Math.min(...[...(d.escalas || []), ...pendentes].map((x) => x.em?.toMillis?.() ?? Date.now()));
      prontos.push({ ref: doc.ref, email, escalas, pendentes, desde });
    }
    if (!prontos.length) return;

    prontos.sort((a, b) => a.desde - b.desde);
    const cabem = await reservarEnvios(prontos.length);
    const agora = prontos.slice(0, cabem);

    for (let i = 0; i < agora.length; i += POR_LOTE) {
      const lote = agora.slice(i, i + POR_LOTE);
      const mensagens = lote.map((p) => {
        const titulo = assuntoDoResumo(p.escalas, p.pendentes);
        const url = p.escalas[0] ? urlDaBase(p.escalas[0].baseId) : (p.pendentes[0]?.url || "https://igrejaonda.pt");
        const { html, texto } = montarEmail({ titulo, corpo: corpoDoResumo(p.escalas, p.pendentes), url });
        return { from: cfg.remetente, to: [p.email], subject: titulo.slice(0, 120), html, text: texto };
      });
      await enviarLote(cfg, mensagens);
      await Promise.all(lote.map((p) => p.ref.delete()));
    }
    logger.info(`resumo email: ${agora.length} enviados, ${prontos.length - agora.length} ficam para amanhã (teto)`);
  },
);

/* ══════════════════════════════════════════════════════════════
 *  GATILHO 4 — confirmar presença (Louvor)
 * ══════════════════════════════════════════════════════════════
 *
 * O pedido do líder da Louvor, de 2026-09, que ficou
 * **explicitamente parado à espera desta infraestrutura** (ver
 * MELHORIAS-ENTRE-BASES.md: "notificar quem ainda não confirmou, 1-2
 * dias antes do culto... combinado para ficar parado até todas as
 * bases estarem prontas"). Estão.
 *
 * Corre uma vez por dia e só atua quando faltam exatamente dois dias
 * para um culto — nunca "nos próximos dois dias", que mandaria a
 * mesma coisa dois dias seguidos.
 *
 * Só a Louvor e o Louvor Kinder (cópia da app da Louvor, mesmo fluxo),
 * porque só elas têm confirmação de presença (a Apoio decidiu
 * explicitamente não a ter). Quando outra
 * base ganhar o mesmo fluxo, acrescenta-se o slug à constante — o
 * resto da função já é genérico.
 */
const BASES_COM_CONFIRMACAO = ["louvor", "louvorkinder"];
const DIAS_ANTES = 2;

export const lembrarConfirmacaoPresenca = onSchedule(
  { schedule: "every day 10:00", timeZone: "Europe/Lisbon" },
  async () => {
    const alvo = new Date();
    alvo.setDate(alvo.getDate() + DIAS_ANTES);
    const eventoId = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;

    const evento = await db().doc(`eventos/${eventoId}`).get();
    if (!evento.exists || evento.data().ativo === false) return;

    for (const baseId of BASES_COM_CONFIRMACAO) {
      const escala = await db().doc(`eventos/${eventoId}/escalas/${baseId}`).get();
      if (!escala.exists) continue;

      const escalados = [...pessoasDaEscala(escala.data())];
      if (!escalados.length) continue;

      const confirmacoes = await db()
        .collection(`eventos/${eventoId}/escalas/${baseId}/confirmacoes`).get();
      const jaConfirmou = new Set(confirmacoes.docs.map((d) => d.id));

      const faltam = escalados.filter((uid) => !jaConfirmou.has(uid));
      if (!faltam.length) continue;

      await notificar(faltam, {
        titulo: "Confirma a tua presença",
        corpo: `Serves daqui a ${DIAS_ANTES} dias e ainda não confirmaste.`,
        url: urlDaBase(baseId),
        tag: `confirmacao-${eventoId}`,
      });
    }
  },
);
