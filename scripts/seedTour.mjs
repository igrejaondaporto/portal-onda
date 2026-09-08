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
    // pessoa, culto a culto. Ordem pensada pra nunca esperar: os
    // botões do menu (NavBar, fixo no rodapé) não dependem de nenhum
    // dado da Firestore, aparecem sempre na hora — vêm primeiro. A
    // checklist e o calendário só existem depois de `meuEvento`
    // carregar em Inicio.jsx; ficam por último, quando esse tempo já
    // passou de sobra (o utilizador já tocou em 4 botões antes) — e
    // nessa ordem (checklist antes do calendário, que é como aparecem
    // na página) é um scroll só, sempre pra baixo, sem voltar atrás.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
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

  new: {
    // Molde Apoio (equipa única, sem ministérios), com "Lição" no
    // lugar de "Montar" — esta base não tem enquete/sugestor (ver
    // CLAUDE.md desta base). Mesma ordem de sempre: NavBar primeiro
    // (não depende de dados), checklist/calendário por último.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
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
        chave: "nav-licao",
        titulo: "Lição",
        texto: "Em Lição fica o documento que o líder enviar — toca para abrir.",
        alvo: "nav-licao", pagina: "inicio",
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

  shift: {
    // Clone exato da New (mesmas telas/abas) — ver CLAUDE.md desta
    // base. Mesmo molde Apoio, com "Lição" no lugar de "Montar".
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
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
        chave: "nav-licao",
        titulo: "Lição",
        texto: "Em Lição fica o documento que o líder enviar — toca para abrir.",
        alvo: "nav-licao", pagina: "inicio",
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
    // Ordem pensada pra nunca esperar: os botões do menu (NavBar, fixo
    // no rodapé) não dependem de nenhum dado da Firestore, aparecem
    // sempre na hora — vêm primeiro. Checklist/calendário só existem
    // depois dos dados carregarem em Inicio.jsx; ficam por último,
    // quando esse tempo já passou de sobra — e nessa ordem (é como
    // aparecem na página, de cima pra baixo) é um scroll só, sempre
    // pra baixo, sem voltar atrás.
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
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

  backstage: {
    // Molde Apoio (mesmo menu, mesma ordem-lógica: botões do menu
    // primeiro — não dependem de dado nenhum, aparecem sempre na hora
    // —, checklist/calendário por último, quando meuEvento já
    // carregou de sobra). Duas coisas só desta base entram no meio:
    // "Todas as bases" (comum a qualquer voluntário, não só ao líder
    // — ver bases/backstage.veEscalas) e "Enquetes"/"Publicar a ordem
    // do culto" (só ao líder, em passosLider).
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "nav-escala",
        titulo: "Escala",
        texto: "Aqui em baixo, no menu, toca em Escala para veres a escala completa do mês — todos os cultos e quem serve em cada um.",
        alvo: "nav-escala", pagina: "inicio",
      },
      {
        chave: "escala-todas-bases",
        titulo: "Todas as bases",
        texto: "Só a Backstage tem isto: toca em \"Todas as bases\" para veres quem serve em cada equipa naquele domingo — sem checklist nem progresso, só quem está escalado.",
        alvo: "escala-todas-bases", pagina: "escala",
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
        chave: "fechamento",
        titulo: "Pronto a servir",
        texto: "Pronto. Qualquer dúvida, fala com o teu líder.",
        alvo: null, pagina: null,
      },
    ],
    passosLider: [
      {
        chave: "nav-enquetes",
        titulo: "Enquetes",
        texto: "Em Enquetes abres a pergunta de indisponibilidade do mês e vês quem já respondeu, antes de montar a escala em Escala.",
        alvo: "nav-enquetes", pagina: "inicio",
      },
      {
        chave: "publicar-ordem",
        titulo: "Publicar a ordem do culto",
        texto: "Só a Backstage publica: em Culto, sobe o PDF que o pastor manda — as outras bases só leem o que publicas aqui.",
        alvo: "nav-culto", pagina: "inicio",
      },
    ],
  },
  comunicacao: {
    // Molde Técnica (ministérios, checklist filtrada por ministério em
    // vez de "todas as funções") + o bloco de Equipamentos, que não
    // existe em nenhuma outra base — custódia dos dois itens, não um
    // separador próprio (ver apps/comunicacao/CLAUDE.md).
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
      },
      {
        chave: "nav-escala",
        titulo: "Escala",
        texto: "Aqui em baixo, no menu, toca em Escala para veres a escala completa do mês — titular e aprendiz de cada ministério, em cada culto.",
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
        chave: "checklist",
        titulo: "O teu ministério",
        texto: "Aqui em cima ficam as funções do teu ministério para hoje — toca para marcares como feita.",
        alvo: "checklist-bloco", pagina: "inicio",
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Aqui vês o calendário do mês — toca num dia para veres os detalhes.",
        alvo: "escala-bloco", pagina: "inicio",
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
        texto: "Aqui montas a escala do mês — toca num culto para escolher o titular e o aprendiz de cada ministério.",
        alvo: "painel-escala-bloco", pagina: "painel",
      },
    ],
  },
  pessoal: {
    // Molde Apoio (equipa única, sem ministérios) + o tab próprio de
    // Mapa, que não existe em nenhuma outra base — mapa do auditório,
    // só para quem tem a função Mapa nesse culto (ver
    // apps/pessoal/CLAUDE.md).
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel do Voluntário",
        texto: "Aqui vês quando serves, sem precisares de procurar no WhatsApp.",
        alvo: null, pagina: null,
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
        texto: "Em Funções vês a descrição de cada tarefa — Café, Mapa, Acomodação, Recepção.",
        alvo: "nav-funcoes", pagina: "inicio",
      },
      {
        chave: "nav-culto",
        titulo: "Culto",
        texto: "Em Culto encontras a ordem que o pastor envia, o inventário do café e a contagem do domingo — tudo o que gira à volta do próprio culto.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "nav-formulario",
        titulo: "Formulário",
        texto: "Em Formulário registas um novo contacto sempre que alguém à entrada quiser deixar os dados.",
        alvo: "nav-formulario", pagina: "inicio",
      },
      {
        chave: "nav-acomodacao",
        titulo: "Mapa",
        texto: "Em Mapa vês o mapa do auditório ao vivo — só quem tem a função Mapa nesse culto pode marcar os lugares.",
        alvo: "nav-acomodacao", pagina: "inicio",
      },
      {
        chave: "escala",
        titulo: "A tua escala",
        texto: "Aqui vês o calendário do mês — toca num dia para veres os detalhes.",
        alvo: "escala-bloco", pagina: "inicio",
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

  louvor: {
    passos: [
      {
        chave: "boasvindas",
        titulo: "Bem-vindo ao Painel da Louvor",
        texto: "Aqui vês quando serves, o repertório do domingo e a biblioteca de músicas da Onda.",
        alvo: null, pagina: null,
      },
      {
        chave: "nav-escala",
        titulo: "Escala",
        texto: "Toca em Escala para veres o mês todo — quem toca ou canta em cada culto, e em que papel.",
        alvo: "nav-escala", pagina: "inicio",
      },
      {
        chave: "nav-culto",
        titulo: "Culto",
        texto: "Em Culto encontras a ordem do culto, o estado do equipamento e os feedbacks de cada domingo.",
        alvo: "nav-culto", pagina: "inicio",
      },
      {
        chave: "nav-biblioteca",
        titulo: "Biblioteca",
        texto: "Todas as músicas da Onda ficam aqui — tom, BPM, letra e cifra de cada uma.",
        alvo: "nav-biblioteca", pagina: "inicio",
      },
      {
        chave: "nav-repertorio",
        titulo: "Repertório",
        texto: "Em Repertório montas a lista de músicas e momentos do domingo.",
        alvo: "nav-repertorio", pagina: "inicio",
      },
      {
        chave: "repertorio",
        titulo: "O repertório de domingo",
        texto: "Aqui em cima vês sempre o repertório do teu próximo culto — toca para abrir.",
        alvo: "repertorio-bloco", pagina: "inicio",
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
        texto: "Aqui montas a escala do mês — toca num culto para escolher quem toca ou canta, e em que papel.",
        alvo: "painel-escala-bloco", pagina: "painel",
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
