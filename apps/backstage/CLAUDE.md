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
  opcional): só informação escrita na linha (`"09:15 · Som"` em vez de
  só `"Som"`), nunca decide a ordem. Só nesta base — nas outras o
  campo fica `undefined`.
- **A checklist do Início é espelho de Funções, sempre.** Mesma
  ordem, ponto — quem reordena em Funções (setas ↑/↓, `mover` →
  `reordenarFuncoes`, grava `ordem`) já vê a mudança na checklist,
  porque `ouvirFuncoes` (`lib/painel.js`) já devolve
  `orderBy("ordem"), orderBy("nome")` e o Início nunca reordena por
  cima disso. `ordenarPorFeita` (`Inicio.jsx`) só faz uma coisa: manda
  quem já está feito para o fim — usa `sort` estável de propósito,
  para preservar a ordem de Funções dentro de cada grupo (feitas / por
  fazer). Já existiu uma versão que ordenava por hora ou por nome de
  quem estava atribuído — foi removida por quebrar o espelho.
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
  Cartões fechados por omissão (`.mincartao`/`cabtoque`, mesmo padrão
  de Checklists) — pedido do líder: "coloca apenas os nomes, e se a
  pessoa clicar, expande a base". Só o nome + contagem à vista.
- **Cor por base, agora distinta** (`bases/{id}.cor`) — as quatro
  usavam praticamente o mesmo azul (`#0019BE`/`#001ED1`), a cor não
  ajudava a diferenciar nada nos cartões de "Todas as bases" e
  Checklists. Pedido do líder: Apoio ficou com o azul de sempre
  (`#0019BE`), Técnica violeta (`#7B5CFF`), Backstage laranja
  (`#F5A300`), Comunicação ciano (`#0092D4`) — de propósito nem verde
  nem magenta, que já significam "tudo pronto"/"urgente" nas telas de
  Checklists e Solicitações; usar uma delas como cor de base
  confundiria os dois sentidos. Só o documento `bases/{id}` mudou —
  `cor` só é lido pela Backstage nestas duas telas cruzadas, não pela
  própria app de cada base (nunca usa a cor do seu próprio
  `bases/{id}` para se pintar).
- **Checklists — menu próprio** (`apps/backstage/src/pages/Checklists.jsx`),
  não uma sub-aba de Escala. Nasceu como terceiro segmento dentro de
  Escala; o líder testou e pediu acesso direto — "essa parte" merecia
  o próprio lugar no menu principal. Entra na `NavBar` só para quem
  tem `ve_todas_escalas` (hoje é toda a Backstage, a claim vem de
  `bases/backstage.veEscalas` — se um dia mudar, o item some sozinho,
  sem checar papel no código).

  **Três categorias, não uma lista só** — pedido explícito do líder:
  `CATEGORIAS` (`Checklists.jsx`) é `[chave, título, mensagem de
  "tudo pronto"]` para Pré-culto/Durante o culto/Pós-culto, cada uma
  com a sua frase de fechado ("Pronto pro Culto!" /"Pronto para o
  encerramento!" / "Pronto para o fechamento das portas!" — três
  textos diferentes, não um genérico repetido). Trocar de categoria
  troca a fase que filtra tudo: cartões por base (`.mincartao`, mesmo
  padrão da Comunicação em Wiki/Acervo/Solicitações), agrupados por
  ministério dentro da categoria quando a base tem
  (Técnica/Comunicação) — sem ministérios (Apoio/Backstage), lista
  direta. Uma base sem nenhuma tarefa nessa categoria continua a
  aparecer ("sem tarefas": a ausência é informação, mesmo princípio
  de "Todas as bases"), mas não entra na conta de quem falta.

  **A barra no fim resume quem falta, não só quantas tarefas** —
  outro pedido explícito: "Falta apenas Base de Apoio finalizar"
  (uma base), "Faltam Apoio e Comunicação finalizarem" (duas, com
  "e"), "Faltam Apoio, Técnica e Comunicação finalizarem" (três+,
  vírgulas + "e" antes da última — `listaComE`). Só quando **todas**
  as bases com tarefas nessa categoria terminam é que vira verde com
  a mensagem própria da categoria. Só leitura: ninguém marca a
  checklist de outra base por aqui (as rules continuam a exigir estar
  na escala da própria base para escrever ali).

  O catálogo (que função existe, de que ministério/fase, nomes de
  quem está ativo em cada base) vem uma vez da Cloud Function
  `checklistCrossBase` — `bases/{b}/funcoes` e `/pessoas` são
  restritos a `minhaBase` nas rules, só o Admin SDK lê cruzado, mesmo
  padrão de `escalasCrossBase`. Devolve uma lista **achatada** por
  base (cada função já com `fase` e `ministerioId/Nome/Cor`
  resolvidos), não pré-agrupada: uma função de "Fotografia" pode ser
  pré-culto e outra da mesma pessoa pode ser durante, então quem lê
  filtra por fase primeiro e só agrupa por ministério depois — fazer
  ao contrário misturava as duas fases dentro do mesmo grupo. O que
  muda de verdade — feito, quem, a que hora — o cliente lê direto e
  ao vivo de `eventos/{e}/checklist` (`ouvirChecklistDoEvento`,
  `lib/painel.js`): essa coleção já é global e `allow read: if
  autenticado()` nas rules, não pede Cloud Function nenhuma para
  isso. É o que torna isto **em tempo real** sem chamar a função a
  cada toque de checkbox de qualquer base — o catálogo muda muito
  menos que o estado dele, por isso só ele é buscado uma vez.
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

**Não escolhes o ministério ao abrir — a Comunicação atribui na
triagem.** O campo "Para que ministério" saiu do formulário (só a
Comunicação, a pedir para si mesma, ainda escolhe): não conhecemos o
organograma dela para acertar. `SheetDetalheSolicitacao` mostra
"Por atribuir" até isso acontecer. **"Excluir pedido"** (mesmo sheet)
deixa o líder cancelar um pedido próprio só enquanto está "Na fila" —
depois de assumido, cancelar sozinho desapareceria sem avisar quem já
está a produzir.

## Detalhes decididos, iguais à Apoio

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- Funções feitas descem para o fim da lista (mesmo com `horaPrevista`).
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.

## Não construir nesta base

- Módulo de pedidos do pastor, chat ou mensagens — é rádio.
- Presença de outras bases em "Todas as bases" (quem já chegou) — só
  checklist entrou (ver acima), presença continua de fora, ninguém
  pediu isso ainda.
- Ministérios (o `nivel` titular/aprendiz existe, ver acima, mas sem
  ministério nenhum onde pendurar — é sempre um campo plano por pessoa).
- Wiki, por agora.
