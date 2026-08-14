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
    // pessoa, culto a culto. Ordem pensada pra minimizar scroll: a
    // checklist fica ACIMA do calendário na página (colunas da Início
    // empilham no telemóvel), por isso vem logo a seguir às
    // boas-vindas, antes do calendário — depois disso os passos do
    // menu (NavBar, fixo no rodapé) não fazem scroll nenhum, então vêm
    // por último, sem precisar voltar lá acima outra vez.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "checklist",
        titulo: "A tua checklist",
        texto: "Aqui em cima ficam as tuas tarefas de hoje — toca para marcares como feita.",
        alvo: "checklist-bloco", pagina: "inicio",
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Aqui vês o calendário do mês — toca num dia para veres os detalhes.",
        alvo: "escala-bloco", pagina: "inicio",
      },
      {
        chave: "nav-escala",
        titulo: "Escala",
        texto: "Aqui em baixo, no menu, toca em Escala para veres a escala completa do mês — todos os cultos e quem serve em cada um.",
        alvo: "nav-escala", pagina: "inicio",
      },
      {
        chave: "nav-funcoes",
        titulo: "Funções",
        texto: "Em Funções vês a descrição de cada tarefa — o que fazer em cada uma.",
        alvo: "nav-funcoes", pagina: "inicio",
      },
      {
        chave: "nav-culto",
        titulo: "Culto",
        texto: "A ordem do culto fica sempre em Culto, atualizada.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "nav-inventario",
        titulo: "Inventário",
        texto: "Em Inventário aumentas ou diminuis a quantidade de um item sempre que algo acabar ou chegar novo.",
        alvo: "nav-inventario", pagina: "inicio",
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
    // Ordem pensada pra minimizar scroll: na página Início, de cima pra
    // baixo, é cartão de enquete → checklist → calendário — por isso
    // o tour segue essa mesma ordem antes de entrar nos passos do menu
    // (NavBar, fixo no rodapé, sem scroll nenhum), que ficam por último.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "indisponibilidade",
        titulo: "Indisponibilidade",
        texto: "Não podes servir nalgum domingo? Avisa por aqui.",
        alvo: "cartao-enquete", pagina: "inicio",
      },
      {
        chave: "checklist",
        titulo: "A tua checklist",
        texto: "Aqui ficam as tarefas do teu ministério para hoje — toca para marcares como feita.",
        alvo: "checklist-bloco", pagina: "inicio",
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Aqui vês o calendário do mês — toca num dia para veres os detalhes.",
        alvo: "escala-bloco", pagina: "inicio",
      },
      {
        chave: "nav-escala",
        titulo: "Escala",
        texto: "Aqui em baixo, no menu, toca em Escala para veres a escala completa do mês — todos os cultos e quem serve em cada um.",
        alvo: "nav-escala", pagina: "inicio",
      },
      {
        chave: "nav-culto",
        titulo: "Culto",
        texto: "A ordem do culto fica sempre em Culto, atualizada.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "nav-inventario",
        titulo: "Equipamentos",
        texto: "Em Equipamentos vês o estado de cada equipamento e reportas quando algo avaria.",
        alvo: "nav-inventario", pagina: "inicio",
      },
      {
        chave: "nav-wiki",
        titulo: "Wiki",
        texto: "Na Wiki ficam artigos e respostas às dúvidas do teu ministério.",
        alvo: "nav-wiki", pagina: "inicio",
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
