# Backstage — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A base que cuida do funcionamento do culto: faz o pré-culto acontecer,
sobe a ordem do culto que o pastor manda por PDF, passa as
informações a limpo. Molde Apoio — equipa única, sem ministérios,
sem níveis, sem aprendiz.

Duas coisas moldam o desenho:

- **Não existe coordenador fixo.** Quem serve no domingo coordena. O
  líder da base gere pessoas, funções e dados — como na Apoio — mas o
  trabalho de domingo é do voluntário escalado. As capacidades novas
  desta base (ver todas as escalas, publicar a ordem do culto) são da
  **base**, não do papel `lider_base` — o que mostram vive na Home de
  qualquer voluntário, não atrás do PIN de líder.
- **A comunicação ao vivo não entra no sistema.** Usam rádio — mais
  rápido. Não há chat nem módulo de pedidos aqui. O painel substitui
  mensagem estruturada (o PDF, notas), nunca conversa.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em construção em `back.igrejaonda.pt`. Ponto de partida: cópia
literal de `apps/apoio` (mesmo padrão usado para a Técnica), mais o
módulo de enquetes de indisponibilidade portado de `apps/tecnica`
(a Apoio ainda não tem esse módulo).

## Vocabulário — mesmo da Apoio

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo. Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa |
| **Culto** | O evento |

Não digas "líder do dia", "tarefa", "turno" nem "evento" na interface.

## O que é só desta base

- **`bases/backstage.veEscalas = "todas"`** — a Backstage lê a
  escala de qualquer base (segmento `Minha base | Todas as bases` no
  ecrã Escala), só leitura, só de escalas publicadas. Sem progresso,
  checklist ou presença de outras bases — se precisa saber se outra
  base terminou, pergunta presencialmente.
- **`bases/backstage.culto.podePublicar = true`** — só esta base tem
  o botão de subir o PDF da ordem do culto e o editor de notas
  (`eventos/{e}.notas`). Apoio e Técnica continuam a ler a mesma
  ordem, já não publicam.
- **`bases/backstage.eventos.podeCriarGlobal = true`** — só o líder
  desta base cria eventos fora de domingo com `escopo:"global"`
  (pensado para incluir uma capacidade `admin_igreja` mais tarde, sem
  mexer nas regras outra vez). Qualquer líder de qualquer base
  continua a poder criar `escopo:"base"`, só para a própria base.
- **`horaPrevista` nas funções** (`bases/backstage/funcoes/{id}`,
  opcional): quando presente, a checklist da fase ordena pela hora,
  como linha do tempo, em vez de por nome. Só nesta base — nas outras
  o campo fica `undefined`, comportamento igual ao de hoje.
- **A escala é normalmente uma pessoa só por culto**, não uma equipa
  (diferente de Apoio/Técnica). `SheetEscala.jsx` troca em vez de
  acumular — tocar noutro nome substitui quem lá estava. `pessoas` e
  `liderEscala` continuam a existir no documento (mesmo formato das
  outras bases, para o resto do sistema — checklist, "servem
  contigo", `obterMeuEvento`… — não precisar de caso especial).
- **Cada voluntário tem um `nivel`: `"titular"` ou `"aprendiz"`**
  (`bases/backstage/pessoas/{id}.nivel`, editável em `SheetPessoa.jsx`).
  Diferente da Técnica, aqui não há ministério onde pendurar o nível —
  é um campo só, plano, por pessoa. **Um aprendiz nunca serve
  sozinho**: escalar um aprendiz junta-o ao titular já escolhido (ou
  pede para escolher um titular primeiro); tirar o titular tira também
  o aprendiz — nesse caso `pessoas` passa a ter 2 ids, sempre
  `[titular, aprendiz]`, nunca só o aprendiz. Validado em
  `guardarEscalaBackstage` (Cloud Function), não só no cliente. A
  "Montar escala" das enquetes só sugere titulares — é um preenchimento
  rápido de 1 nome, sem par; para escalar um aprendiz usa-se o
  `SheetEscala.jsx` completo (Painel do Líder → Escala).
- **Escalar o titular já mostra/atribui todas as funções do dia a essa
  pessoa** — duas camadas:
  1. `atribuirTodasFuncoesAoTitular`, chamada de dentro de
     `guardarEscalaBackstage` (nunca do cliente), grava a mesma escrita
     que `atribuirFuncao` faria função a função, para todas de uma vez.
     Só dispara quando o titular muda de facto (novo ou trocado), nunca
     ao regravar a escala com o mesmo titular — por exemplo, só juntar
     um aprendiz não reatribui nada, para não apagar ajustes que a
     líder já tenha feito função a função.
  2. `Funcoes.jsx` e `Inicio.jsx` (bloco "Como está o domingo") também
     calculam uma `atribuicoesEfetivas` no cliente: qualquer função
     **sem documento próprio** em `eventos/{e}/atribuicoes` (não só sem
     gente lá dentro) mostra-se já com o titular do dia, mesmo sem
     depender do gatilho da Cloud Function — cobre escalas gravadas
     antes desta funcionalidade existir, e qualquer função nova
     ("só deste culto") criada depois da escala. Uma função "limpa" de
     propósito (`atribuirFuncao(..., [])`, documento existe com
     `pessoas:[]`) fica mesmo vazia — não volta a mostrar o titular.
  A líder continua livre para trocar ou acrescentar pessoas por função
  depois, em Funções — cada toque aí grava um documento real.
- **"As tuas funções" não existe no Início desta base** (existe na
  Apoio/Técnica). Como é sempre uma pessoa só a servir, seria sempre
  igual a "todas as funções do dia" — redundante com "Como está o
  domingo", logo abaixo. Removido de propósito, não esquecido.
- **"Deixa uma palavra à tua equipa" (a frase do líder de escala)
  também não existe aqui** (existe na Apoio/Técnica, `definirFrase`
  continua lá para elas — Cloud Function partilhada, não se mexeu).
  Sentido para uma equipa de várias pessoas se motivarem antes do
  culto; sem sentido a falar sozinho. Removido de propósito.
- **`bases/backstage.feedbackAberto = true`** — em Culto → Feedbacks,
  qualquer voluntário escreve, não só o líder de escala do culto
  (`definirFeedback` aceita pela claim `feedback_aberto`). Nas outras
  bases continua só líder de escala/líder da base.
- **Montar escala** (dentro de cada enquete, botão à parte — não
  precisa de a enquete estar fechada, o líder decide quando): por
  domingo, sugere quem está disponível e há mais tempo sem servir
  (`obterEstatisticasEscala`, já existente) — o líder escolhe no
  `<select>` (aceita a sugestão ou troca) e grava direto, sem
  sugestor de ministérios/lugares como a Técnica tem, porque aqui é
  sempre uma pessoa só. "Excluir enquete" também vive aqui.
- **"Todas as bases" mostra só o próximo culto**, nunca o mês —
  `obterProximoEvento()` em `lib/painel.js`. É uma visão geral rápida
  ("quem serve amanhã em cada base"), não outro calendário para
  navegar. Os nomes (e o ministério, na Técnica) vêm da Cloud Function
  `escalasCrossBase` — sempre resolvidos na hora a partir de
  `bases/{outraBase}/pessoas` pelo Admin SDK, nunca uma cópia gravada
  na escrita (ficaria desatualizada) nem uma leitura direta do
  cliente (as rules não abrem `pessoas` de outra base de propósito).
- **Melhorias** (aba dentro de Culto, ao lado de Feedbacks): mesmas
  Cloud Functions da Técnica (`abrirMelhoria`/`comentarMelhoria`/
  `definirEstadoMelhoria`/`definirPrevisao`/`resolverMelhoria`/
  `desativarMelhoria` — já genéricas, `equipamentoId`/`ministerioId`
  sempre `null` aqui), sem equipamento nem ministério ligados e sem
  "Transformar em artigo da Wiki" (não há Wiki nesta base). Ativas
  com filtro de gravidade por cima, resolvidas num grupo fechado no
  fim — `apps/backstage/src/components/culto/MelhoriasTab.jsx`.

## Solicitar BG (pedidos à Comunicação)

Item "Solicitar BG" em "A base" no Início, só para o líder — abre
`SheetSolicitacoesBase` (`packages/shared`, genuinamente igual em
Apoio/Técnica/Backstage): botão "Novo pedido" (abre
`SheetAbrirSolicitacao`, também partilhado) + lista ao vivo dos
pedidos desta base, com o estado que a Comunicação vai mudando
(`ouvirMinhasSolicitacoes`, `packages/shared/lib/solicitacoes.js` —
query por `baseSolicitanteId == BASE_ID`). Tocar num pedido abre
`SheetDetalheSolicitacao`, só de leitura. Antes disto, o Painel do
líder tinha uma secção "Comunicação" com só o botão de abrir e
nenhuma forma de acompanhar — foi removida, ficou só este caminho.

## Detalhes decididos, iguais à Apoio

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- Funções feitas descem para o fim da lista (mesmo com `horaPrevista`).
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.

## Não construir nesta base

- Módulo de pedidos do pastor, chat ou mensagens — é rádio.
- Progresso, checklist ou presença de outras bases em "Todas as bases".
- Ministérios (o `nivel` titular/aprendiz existe, ver acima, mas sem
  ministério nenhum onde pendurar — é sempre um campo plano por pessoa).
- Wiki, por agora.
