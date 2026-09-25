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
 * continua como sempre. Define-se com `scripts/definirEnvioEmail.mjs`.
 *
 * ── Onde está o endereço de cada pessoa ─────────────────────────
 *
 * `pessoas/{uid}/privado/email` — global como o PIN e o IBAN (quem
 * serve em duas bases tem um e-mail, não dois), e só a dona lê e
 * escreve (`firestore.rules`). Nenhum líder vê o e-mail de ninguém.
 * `semEmail: true` é "respondi que não tenho" — não recebe nada.
 *
 * ── Um e-mail por pessoa, nunca um "Para:" com todos ─────────────
 *
 * Um recado à equipa inteira são N e-mails separados (pelo endpoint
 * de lote, até 100 por pedido): pôr os endereços todos no mesmo
 * "Para:" mostrava o e-mail de cada voluntário a todos os outros.
 */
import admin from "firebase-admin";
import { logger } from "firebase-functions";

const db = () => admin.firestore();

const URL_LOTE = "https://api.resend.com/emails/batch";
const POR_LOTE = 100; // o máximo do endpoint de lote
const REMETENTE_OMISSAO = "Igreja Onda <avisos@igrejaonda.pt>";

/** Mesmo formato que a regra do Firestore aceita — o que chega aqui
 *  já passou por ela, isto é só a última rede. */
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A configuração de envio, ou `null` se ainda não foi definida (ou
 *  foi desligada de propósito com `ativo:false`). */
async function configEnvio() {
  const snap = await db().doc("config/emailEnvio").get().catch(() => null);
  if (!snap?.exists) return null;
  const c = snap.data();
  if (c.ativo === false || typeof c.chave !== "string" || !c.chave) return null;
  return { chave: c.chave, remetente: c.remetente || REMETENTE_OMISSAO };
}

/** Os endereços de quem os deixou, por uid. */
async function enderecos(uids) {
  const snaps = await Promise.all(uids.map((uid) =>
    db().doc(`pessoas/${uid}/privado/email`).get().catch(() => null)));
  const lista = [];
  snaps.forEach((s) => {
    const d = s?.exists ? s.data() : null;
    if (d && d.semEmail !== true && typeof d.email === "string" && EMAIL_VALIDO.test(d.email)) {
      lista.push(d.email.trim());
    }
  });
  return [...new Set(lista)];
}

const escapar = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O corpo do e-mail. Tabelas e estilos inline, de propósito: é o que
 *  o Gmail/Outlook no telemóvel desenham igual — CSS em `<style>` e
 *  flexbox são ignorados por metade dos clientes de e-mail. */
export function montarEmail({ titulo, corpo, url }) {
  const t = escapar(titulo);
  const c = escapar(corpo).replace(/\n/g, "<br>");
  const u = escapar(url || "https://igrejaonda.pt");
  const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${t}</title></head>
<body style="margin:0;padding:0;background:#eef1fb;font-family:Outfit,Arial,Helvetica,sans-serif;color:#0b1033">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1fb;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td style="background:#0019be;background-image:linear-gradient(135deg,#001ed1,#0019be,#001594);padding:22px 24px;color:#ffffff">
<span style="font-size:15px;opacity:.8">igreja</span><b style="font-size:19px;letter-spacing:-.02em">onda</b>
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#c3dc54;margin-top:4px">Portal do Voluntário</div>
</td></tr>
<tr><td style="padding:26px 24px 8px">
<h1 style="margin:0;font-size:22px;line-height:1.25;letter-spacing:-.02em">${t}</h1>
<p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:#2b3060">${c}</p>
</td></tr>
<tr><td style="padding:18px 24px 26px">
<a href="${u}" style="display:inline-block;background:#0019be;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:100px">Abrir o Portal</a>
</td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid #e3e6f3;font-size:12px;line-height:1.5;color:#6b7194">
Recebes este e-mail porque o deixaste no Portal do Voluntário da Igreja Onda.
Para mudar ou deixar de receber: na app, toca na tua foto → <b>E-mail para avisos</b>.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const texto = `${titulo}\n\n${corpo}\n\nAbrir o Portal: ${url || "https://igrejaonda.pt"}\n\n—\nRecebes este e-mail porque o deixaste no Portal do Voluntário da Igreja Onda. Para mudar ou deixar de receber: na app, toca na tua foto → E-mail para avisos.`;
  return { html, texto };
}

/** Um pedido ao endpoint de lote. Devolve quantos seguiram. */
async function enviarLote(cfg, mensagens) {
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
 * um endereço. Nunca lança por falta de configuração — sem chave,
 * devolve `{ enviados: 0, motivo }` e o push segue sozinho.
 */
export async function enviarEmails(uids, { titulo, corpo, url }) {
  const cfg = await configEnvio();
  if (!cfg) return { enviados: 0, motivo: "sem-configuracao" };

  const para = await enderecos(uids);
  if (!para.length) return { enviados: 0, motivo: "ninguem-com-email" };

  const { html, texto } = montarEmail({ titulo, corpo, url });
  const assunto = String(titulo ?? "Igreja Onda").slice(0, 120);
  const mensagens = para.map((email) => ({
    from: cfg.remetente, to: [email], subject: assunto, html, text: texto,
  }));

  let enviados = 0;
  for (let i = 0; i < mensagens.length; i += POR_LOTE) {
    enviados += await enviarLote(cfg, mensagens.slice(i, i + POR_LOTE));
  }
  logger.info(`email: ${enviados} enviados — "${assunto}"`);
  return { enviados };
}
