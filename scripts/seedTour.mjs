/**
 * Semeia o conteúdo do tour de primeiro login, por base.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. npm run seed:tour
 *
 * Corre uma vez por base. Repetir não duplica (usa merge) — serve
 * também para atualizar o texto de um passo já existente.
 *
 * O conteúdo não é editável no Painel (decisão do líder, por agora) —
 * ajustar aqui e correr de novo sempre que o texto precisar de mudar.
 * `passosLider` é só o delta do líder — nunca duplica os passos comuns
 * do voluntário (ver packages/shared/src/lib/tour.js, composicaoPassos).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const TOURS = {
  apoio: {
    // a Apoio não tem tela de indisponibilidade (sem confirmação de
    // presença, avisa por WhatsApp — CLAUDE.md da Apoio) nem fluxo de
    // "gerar sugestão + publicar" no Painel — o líder atribui pessoa a
    // pessoa, culto a culto. Por isso o tour fica mais curto.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo à Onda",
        texto: "Este é o teu painel. Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Estas são as tuas datas do mês.",
        alvo: "escala-bloco", pagina: "inicio",
      },
      {
        chave: "culto",
        titulo: "A aba Culto",
        texto: "A ordem do culto fica sempre aqui, atualizada.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "fechamento",
        titulo: "Pronto a servir",
        texto: "Pronto. Qualquer dúvida, fala com o teu líder.",
        alvo: null, pagina: null,
      },
    ],
    passosLider: [
      {
        chave: "painel-escala",
        titulo: "Montar a escala",
        texto: "Aqui montas a escala do mês — toca num culto para escolher quem serve.",
        alvo: "painel-escala-bloco", pagina: "painel",
      },
    ],
  },

  tecnica: {
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo à Onda",
        texto: "Este é o teu painel. Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Estas são as tuas datas do mês.",
        alvo: "escala-bloco", pagina: "inicio",
      },
      {
        chave: "culto",
        titulo: "A aba Culto",
        texto: "A ordem do culto fica sempre aqui, atualizada.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "indisponibilidade",
        titulo: "Indisponibilidade",
        texto: "Não podes servir nalgum domingo? Avisa por aqui.",
        alvo: "cartao-enquete", pagina: "inicio",
      },
      {
        chave: "fechamento",
        titulo: "Pronto a servir",
        texto: "Pronto. Qualquer dúvida, fala com o teu líder.",
        alvo: null, pagina: null,
      },
    ],
    passosLider: [
      {
        chave: "gerar-sugestao",
        titulo: "Gerar sugestão",
        texto: "Aqui montas a escala do mês. O sistema sugere, tu ajustas.",
        alvo: "montar-gerar", pagina: "montar",
      },
      {
        chave: "publicar-escala",
        titulo: "Publicar escala",
        texto: "Depois de conferir, publica. Todos passam a ver.",
        alvo: "montar-publicar", pagina: "montar",
      },
    ],
  },
};

async function main() {
  console.log("A semear o conteúdo do tour…\n");
  for (const [baseId, conteudo] of Object.entries(TOURS)) {
    await db.doc(`bases/${baseId}/tour/config`).set(conteudo, { merge: true });
    console.log(`${baseId}: ${conteudo.passos.length} passos + ${conteudo.passosLider.length} extra do líder`);
  }
  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
