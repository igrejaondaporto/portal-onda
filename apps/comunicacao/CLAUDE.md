# Comunicação — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack,
monorepo).

## O que é

A equipa que produz conteúdo (fotografia, vídeo, social media, design)
e atende pedidos das outras bases. É a primeira base do painel com
trabalho que não é só de domingo: tem prazo, não escala.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

As quatro fases do briefing estão feitas: configuração da base,
membros, Início (com Equipamentos), Culto (Escala/Ordem do
culto/Feedbacks), Solicitações, Funções, Brand (Marcas + Acervo),
Wiki, e a Área do líder (Escala sugerida + Enquetes). Ponto de partida: cópia de
`apps/tecnica` (é a que já tem ministérios) + o Funções em separador
da Apoio (a Técnica não tem essa aba, mete tudo na checklist do
Início — a Comunicação tem as duas coisas).

O briefing completo (`CLAUDE-comunicacao.md`, partilhado à parte) é a
especificação de produto. Este ficheiro documenta só onde a
implementação real diverge dele ou decide algo que ele deixava em
aberto — lê os dois.

## Onde diverge do briefing original

O briefing pedia "codebase única, base definida por configuração" —
**não é assim que o monorepo funciona** (ver `CLAUDE.md` raiz: cada
base é uma app Vite/Worker própria, decisão deliberada para um bug
numa base nunca derrubar outra). A Comunicação segue o padrão real:
`apps/comunicacao/` é uma app própria, como as outras três. O
documento `bases/comunicacao` guarda configuração da base (nome, cor,
horas, `slaDiasMinimos`), não liga/desliga telas de um código
genérico.

Os módulos que o briefing pedia para "reaproveitar" (Wiki, Equipamentos)
têm nome igual a coisas que já existem, mas modelo de dados
diferente — não são a mesma coleção:

- **Equipamentos aqui é custódia** (dois itens, quem está com cada um,
  desde quando) — `bases/comunicacao/equipamentos`, nada a ver com o
  "Equipamentos" da Técnica (esse é o Inventário em modo património,
  `bases/tecnica/inventario`).
- **Wiki**: mesmo path e schema de `bases/tecnica/wiki` — cópia 1:1 a
  pedido do líder (ver seção própria abaixo), depois de uma primeira
  versão simplificada que não teve editor nenhum.
- **Enquetes**: `bases/comunicacao/enquetes` — **mesmo path, mesmo
  schema, mesma regra** da enquete de indisponibilidade de
  Técnica/Backstage (`write: false`, só por Cloud Function). O
  briefing (§5.5) descrevia uma enquete genérica de pergunta/opções;
  chegámos a construir essa versão e o líder pediu para a excluir —
  "totalmente inútil", o que ele queria mesmo era a indisponibilidade
  que já existe nas outras bases, porque alimenta a Escala sugerida.
  Ver seção própria abaixo.

## Ministérios

```js
bases/comunicacao/ministerios/{id}
  nome, cor, ordem, ativo
```

Do organograma partilhado pelo líder: **Captação e Edição · UNVT ·
Social Media · Storymaker · Redação e Design · Fotografia**. Titular +
aprendiz por ministério, como a Técnica (ver `SheetEscalaMinisterios`).

**Sem "Responsável" rotativo como `liderEscala`.** A Técnica modela o
líder de culto como um campo próprio na escala (`ordem:0`); a
Comunicação não tem isso — o organograma mostra um líder da base fixo
(`papel: "lider_base"`), sem rotação de liderança por domingo.
`liderEscala` existe no documento da escala (mesmo formato das outras
bases, para o resto do sistema não precisar de caso especial) mas
fica sempre `null`, e só o líder da base pode gravar a escala
(`guardarEscalaComunicacao`, valida no servidor — não é líder de
escala nenhum).

Isto não impediu o líder de criar, mais tarde, pelo próprio Painel
(Ministérios → Novo), um ministério chamado literalmente
**"Responsável"** — esse é um ministério normal como qualquer outro
(`ordem: 99`, sem tratamento especial no código), com titular por
culto como Storymaker ou Fotografia. Não é o `liderEscala`/`ordem:0`
da Técnica, só tem o mesmo nome — ver "Ministérios que servem na
Escala" abaixo.

**Ministérios que servem na Escala (o quadro do culto) — só 3 dos 7.**
Captação e Edição, UNVT, Social Media e Redação e Design são
produção/edição, sem posto ao vivo no domingo; só **Storymaker**,
**Fotografia** e **Responsável** têm gente escalada na hora do culto.
Pedido do líder: tirar os outros 4 da tabela de Escala (`Culto.jsx`)
e do formulário de "montar escala" (`SheetEscalaMinisterios`, aberto
em Painel do líder → Escala → "definir") — em todo o resto
(Ministérios do Painel, atribuição de pessoa a ministério, Wiki,
Funções…) os 7 continuam intactos, isto filtra só nessas duas telas.
`ministeriosDaEscala` (`lib/modelo.js`) filtra por **nome**, não por
id fixo — "Responsável" foi criado pelo líder com um id gerado, sem
slug conhecido de antemão como os outros 6. Se um ministério for
renomeado, a lista `NOMES_MINISTERIOS_ESCALA` tem de acompanhar.

**Etiqueta "Auxiliar"**: o organograma tem duas pessoas ligadas direto
ao líder, fora dos ministérios. O sistema só tem dois papéis (líder da
base / voluntário) — não criámos um terceiro. Em vez disso,
`bases/comunicacao/pessoas/{id}.cargo` é uma etiqueta livre (texto,
opcional, editável em `SheetPessoa`), só para aparecer a par do nome.
Sem poder nenhum associado. Campo genérico em `criarVoluntario`/
`editarVoluntario` (`functions/index.js`) — nas outras bases nunca é
enviado, fica ausente.

## Equipamentos (custódia — não confundir com Inventário)

```js
bases/comunicacao/equipamentos/{id}
  nome, icone, responsavelId, desde, ativo
bases/comunicacao/equipamentos/{id}/historico/{h}
  deId, paraId, em
```

Só dois itens por agora (dívida consciente do briefing — "quando
passarem de uns cinco, o molde precisa mudar"). Sem número de série,
sem estado de conservação. **Bloco no Início**, antes de "A base" —
não é separador do menu. Qualquer voluntário toca em "Passar" e
escolhe quem fica com o item (`passarEquipamento`); só o líder cria
um equipamento novo (Painel do líder → Equipamentos → Novo). Sempre
por Cloud Function: passar tem de gravar o histórico na mesma escrita
que atualiza o responsável, e isso as regras não garantem sozinhas.

Nenhum equipamento foi semeado — o líder ainda não decidiu quais são
os dois itens. `scripts/seedComunicacao.mjs` cria só `bases/comunicacao`
e os ministérios; pessoas e equipamentos entram pelo próprio painel
(dados reais, não configuração — não se semeiam por script).

## Sines — fora de escopo por agora

O organograma tem pessoas marcadas "(Sines)". Confirmado com o líder:
por agora a base cobre **só o Porto/Vermoim**, igual a todas as
outras — "(Sines)" é só identificação de onde a pessoa é, não muda a
escala nem o culto. Se um dia Sines tiver culto próprio (hora, ordem,
notas), isso pede um planeamento à parte antes de qualquer código —
mexe no modelo `eventos`/`escalas`, que hoje assume um culto global
só, para todas as bases (ver `CLAUDE.md` raiz, regra 7).

## Navegação

Barra inferior: `Início · Culto · Funções · Wiki · Solicitações ·
Brand`. Já passou por formas diferentes — ver histórico abaixo —, mas
a ideia de fundo não mudou: nada de coleção paralela nem cópia de
estado só porque o caminho até lá mudou, é sempre o mesmo componente,
só muda onde é montado.

**Solicitações tem aba própria** (pedido do líder — "quero um menu
exclusivo para ele, com acesso direto no menu"). Antes vivia como
sub-aba dentro de "Agenda"; "Agenda" deixou de existir como aba —
`Solicitacoes.jsx` monta direto em `Sessao.jsx`, sem wrapper nenhum
por cima.

**"Escala" (a antiga aba "Domingo" de Agenda) mudou-se para dentro de
Culto — pedido do líder, para reunir tudo do domingo num sítio só.**
`Culto.jsx` ganhou uma terceira sub-aba, em primeiro lugar (a
pergunta mais comum é "quem serve?", antes de "o que toca?" ou "como
correu?"): **Escala · Ordem do culto · Feedbacks**. É o mesmo
conteúdo/lógica que existia em `Escala.jsx` (apagado — não há mais
nenhuma tela desse nome), só que agora dentro de `Culto.jsx`.

Navegar para lá de propósito (calendário do Início, "Ordem do
domingo" em "A base") passa por `abaAlvo`/`focoSeq` em vez de um
`abaInicial` só lido no mount: `Culto` fica montado o tempo todo (só
`display:none` ao trocar de aba), então um `useState` inicial não
reagiria a uma segunda navegação depois de a pessoa já ter tocado
numa sub-aba à mão. `focoSeq` muda a cada navegação (mesmo destino ou
não) e força `setAba(abaAlvo)`. **Cuidado ao mexer aqui**: o efeito
que abre o cartão certo do dia clicado no calendário (`eventoIdFoco`)
depende também de `aba === "escala"`, não só de `eventoIdFoco` — as
refs dos cartões (`refsEventos`) só existem enquanto a sub-aba Escala
está montada, e o efeito de abrir o cartão corre na mesma leva que o
de trocar de aba; sem essa dependência a mais, ele corre primeiro
(com a aba antiga, sem os cartões montados ainda) e nunca tenta de
novo depois da troca acontecer.

Passou por formas diferentes até aqui, todas a pedido do líder depois
de testar: (1) o briefing pedia uma aba própria na barra para
Solicitações, mais uma vista filtrada só do que a pessoa produz
dentro de Agenda — "A tua produção", uma lista sem ação nenhuma; (2)
essa lista saiu, e Solicitações virou sub-aba de Agenda, com a aba
própria na barra a continuar a existir em paralelo, as duas a
mostrar o mesmo estado ao vivo; (3) a aba própria saiu da barra —
"não tem uso [...] deixa ele apenas como um menu secundário em
Agenda"; (4) — agora — o líder pediu o oposto do passo 3: acesso
direto de novo, e a antiga aba "Domingo" de Agenda mudou-se para
dentro de Culto, como "Escala".

## Solicitações

```js
solicitacoes/{id}                    // raiz — escrito por líderes de
  titulo, baseSolicitanteId,         // QUALQUER base, lido por essa
  solicitanteId, solicitanteNome,    // base + a Comunicação
  oQue, ondeUsa, textoFinal, linkReferencia,
  prazo, foraDoPrazo,                // calculado no servidor
  ministerioId,                      // null até à triagem — a Comunicação
                                      // é quem escolhe agora, não quem pede
                                      // (exceto pedido interno dela mesma)
  designadoParaId, designadoParaNome, // triagem: aponta a pedido a alguém,
                                      // sem ainda ser responsavelId
  status: fila|producao|revisao|entregue|recusada,
  responsavelId, responsavelNome, entregaUrl, entregueEm,
  transferePendente: { paraId, paraNome, deId, deNome, em } | null,
  historico: [{ de, para, porId, porNome, em, motivo? }
              | { tipo: "transferencia"|"transferencia_aceite"|"transferencia_recusada"|"atribuicao", ... }]
```

Toda a escrita passa por Cloud Function (`abrirSolicitacao`,
`editarSolicitacao`, `atribuirSolicitacao`, `assumirSolicitacao`,
`mudarStatusSolicitacao`, `transferirSolicitacao`, `aceitarTransferencia`,
`recusarTransferencia`, `excluirSolicitacao`, `excluirMinhaSolicitacao`)
— regra `solicitacoes/{id}: write: false`.
Não é o que o rascunho de regras do briefing (§7) sugeria (escrita
direta do cliente com validação por regra); segui o padrão já usado
em Wiki/Melhorias (autoria mista + histórico obrigatório = sempre
função, nunca `setDoc` direto), porque `foraDoPrazo` tem de vir do
servidor e o histórico tem de ser gravado na mesma escrita que muda
o estado.

`editarSolicitacao` (solicitante edita enquanto `status == "fila"`)
está implementada e testada (`node --check`), mas **sem UI nesta
fase** — nenhuma tela chama. Se um dia o solicitante precisar de
corrigir um pedido já aberto, é aí que entra.

**"Solicitar BG"** vive no Início de Apoio/Técnica/Backstage, "A base",
só para o líder — não numa aba nova nessas apps, é
`SheetSolicitacoesBase`/`SheetAbrirSolicitacao`/`SheetDetalheSolicitacao`
(`packages/shared`, a única coisa desta fase que é genuinamente igual
em qualquer base). Inclui o aviso de prazo curto antes de enviar (lê
`bases/comunicacao.slaDiasMinimos` — 3 dias, público a quem tem
sessão; era 10, o líder achou longo demais) e —
antes — o seletor de ministério (lia `bases/comunicacao/ministerios`
mesmo sem ser da Comunicação, via carve-out na regra); esse carve-out
continua na regra (só a própria Comunicação, `souComunicacao`, ainda
usa o seletor ao abrir para si mesma), mas as outras três bases já
não veem o campo — ver "Triagem" abaixo.

**Triagem: quem pede já não escolhe ministério — a Comunicação
atribui depois de ler o pedido.** Pedido do líder: as outras bases
não conhecem o organograma da Comunicação, então pedir para
adivinharem o ministério certo só gerava escolhas erradas.
`abrirSolicitacao` deixou de exigir `ministerioId` de quem não é
`comunicacao` (continua obrigatório quando é a própria Comunicação a
abrir para si — `souComunicacao`, ela conhece o contexto). Fica
`ministerioId: null` até `atribuirSolicitacao` (só o líder da
Comunicação, só enquanto `status == "fila"`) escolher um ministério
e/ou uma pessoa (`designadoParaId`) — nenhum dos dois obriga o outro.
Isto é o que faz o pedido aparecer nos dois avisos do Início (ver
abaixo); `assumirSolicitacao` limpa `designadoParaId` ao assumir, para
o aviso não continuar a mostrar-se a quem foi apontado depois de
outra pessoa já ter pegado o pedido.

**O `<select>` de pessoa filtra pelo ministério escolhido.** Sem
ministério, mostra qualquer voluntário; ao escolher um, `SheetSolicitacao`
reduz a `candidatosAtribuicao` para quem tem esse ministério em
`pessoa.ministerios` (titular ou aprendiz) — sem isto o líder via a
lista toda mesmo tendo acabado de dizer "isto é do Fotografia".
Trocar de ministério limpa a pessoa escolhida se ela não for desse
ministério, para nunca ficar uma seleção órfã escondida da lista.

**Dois avisos no Início, um por papel — pedido explícito do líder:
"quero que apareça no Início".** `Inicio.jsx` passou a ouvir a coleção
inteira (`ouvirSolicitacoes`, antes só usada em `Solicitacoes.jsx`).
(1) Só o líder vê "N pedidos novos por atribuir" — pedidos em fila
sem `ministerioId` nem `designadoParaId`, toca e vai direto à aba
Solicitações (`onIrSolicitacoes`, hoje é só `irPara("solicitacoes")`
— desde que Solicitações ganhou aba própria, não precisa de focar
sub-aba nenhuma, ver "Navegação" acima). (2) Qualquer membro vê "Um pedido para ti" por
cada pedido em fila que o aponta — de propósito (`designadoParaId ==
uid`) ou porque o ministério dele foi escolhido sem pessoa específica
(`ministerioId` bate com algum `pessoa.ministerios[id]`, sem
`designadoParaId`) — com um botão "Assumir" direto no banner, sem
abrir a solicitação. Ambos desaparecem assim que alguém assume
(`responsavelId` deixa de ser `null`) — nenhum dos dois é exclusivo
de quem foi apontado, "Assumir" continua aberto a qualquer membro,
como sempre foi.

**A revisão é feita por um líder — pedido explícito, mudou o fluxo
original.** Antes, quem produzia marcava "Entregue" sozinho a
qualquer momento; agora `producao → revisao` (quem produz, com o
link da entrega — sem link não sai da produção) e `revisao →
entregue` / `revisao → producao` (só o líder, aprova ou devolve) são
transições distintas, cada uma com quem pode fazê-la
(`TRANSICOES_SOLICITACAO` em `functions/index.js`). `recusar`
continua livre para quem produz, em qualquer estado aberto.

**Excluir é sempre `ativo: false`, nunca `delete()` — mesmo depois de
entregue ou recusada.** Pedido do líder: o campo de estados ativos
ficava sujo de pedidos já fechados sem forma de os tirar de lá.
`excluirSolicitacao` (`functions/index.js`) marca `ativo: false` em
qualquer estágio, sem exceção — segue a mesma regra do resto do app
("nada é apagado, é desativado", ver `CLAUDE.md` raiz) e o mesmo
padrão de `excluirEnquete`. Só o líder da base exclui (como
`excluirEnquete`; diferente de assumir/mudar estado, que qualquer
voluntário da Comunicação faz). `ouvirSolicitacoes`
(`lib/solicitacoes.js`) filtra `ativo !== false` no cliente, não por
`where` — pedidos de antes desta funcionalidade não têm o campo
`ativo` nenhum, e `where("ativo","!=",false)` os teria excluído por
engano. Botão "Excluir solicitação" fica no fim de `SheetSolicitacao`,
com confirmação (mesmo padrão de "Recusar pedido").

**O lado de quem pediu tem o seu próprio excluir, mais restrito.**
`excluirMinhaSolicitacao` deixa o líder da base que abriu cancelar o
próprio pedido ("abriu errado" ou já não precisa) — mas só enquanto
`status == "fila"`: depois de a Comunicação assumir, já há trabalho
investido, e desaparecer sem avisar quem está a produzir seria pior
que deixar sujo. Passado isso, é conversa direta, não um botão. Botão
"Excluir pedido" em `SheetDetalheSolicitacao` (`packages/shared`),
só quando `papel === "lider_base"` e ainda em fila.

**Transferir**: qualquer voluntário da Comunicação transfere uma
solicitação (própria ou não) para outro — não é decisão do líder.
Fica `transferePendente` até quem recebe decidir: aceita (fica
responsável, some o pendente) ou recusa (`status` volta a `fila`,
`responsavelId` limpo — pedido explícito do líder). Enquanto pendente,
ninguém mais assume nem transfere de novo. Quem recebe vê um banner
no Início (`ouvirTransferenciasPendentes`, query por
`transferePendente.paraId`) com Aceitar/Recusar diretos — não abre
a solicitação para decidir.

**A lista de "Transferir para" inclui quem já está a olhar para o
card** (pedido explícito do líder) — exclui só o atual `responsavelId`
(transferir para quem já a tem não faz sentido), nunca `uid`.
`candidatosTransferencia` (`SheetSolicitacao.jsx`) mudou de "todos
menos eu" para "todos menos quem já a tem": abrir o card de outra
pessoa e "transferir para" o meu nome é como pegar o pedido dela —
sem isto, quem via um card da Ana não conseguia atribuir-se a si
mesmo, só a um terceiro. O backend (`transferirSolicitacao`) já não
bloqueia `paraId === uid` — transferir para si mesmo cria um
`transferePendente` que a própria pessoa aceita a seguir (mesmo
fluxo de sempre, só que remetente e destinatário coincidem).

**Secções empilhadas, não quadro Kanban lado a lado — testámos os
dois.** Primeira versão era um quadro de 4 colunas fixas com scroll
horizontal (`.com-kanban`); o líder testou no telemóvel e via quase
tudo fora do ecrã, tinha de arrastar para o lado para ver as colunas
seguintes. `Solicitacoes.jsx` passou a empilhar as quatro secções na
vertical — Fila, Produção, Revisão, Entregue, cada uma um
`.mincartao` (mesmo cartão que a Wiki e o Acervo já usam para
agrupar: `.mincartao-barra` colorida pelo estado + `.ponto` + `.nome`
+ `.conta`), sempre todas visíveis, sem arrastar nada — só o scroll
normal da página. Recusada fica fora das quatro, por trás de "Ver
recusadas" (não é um estado a monitorizar no dia a dia).

Dentro de cada secção, `.com-kcard` continua igual: cor da barra do
card é o ministério, não o estado (o estado já é a secção onde está).

**Semáforo do prazo, só em Fila/Produção.** A etiqueta de dias
restantes (`corPrazo`, `Solicitacoes.jsx`) muda de cor pelo prazo em
si, não mais pelo `foraDoPrazo` fixado na criação: 3 dias ou menos
(inclui atrasado) vermelho, 4 a 7 amarelo, 8+ verde — pedido do líder.
Recalcula a cada render (não é gravado), por isso o card muda de cor
sozinho com o passar dos dias, sem ninguém tocar nele. Só nas duas
secções onde o prazo ainda é urgente — em Revisão/Entregue a etiqueta
volta a cinza (`foraDoPrazo`, gravado na criação, continua a decidir
o aviso "fora do prazo mínimo" na folha de detalhe; são conceitos
diferentes, não o mesmo campo redecorado).

**"Avisar no WhatsApp" ao atribuir a alguém.** Depois de
`atribuirSolicitacao` marcar `designadoParaId`, `SheetSolicitacao`
mostra um botão ao lado de "Designado a X" — só quando essa pessoa
tem `telefone` guardado (`bases/comunicacao/pessoas/{id}.telefone`).
Abre `wa.me/{telefone}?text=...` com o título e o prazo, mesmo padrão
do `telefoneWa` que a Técnica já usa em `Montar.jsx`. Existe porque o
aviso no Início só chega a quem abrir o app — isto avisa por fora,
sem depender disso.

Arrastar (`draggable` nativo) só funciona a rato — é um atalho a mais
para desktop, nunca o único caminho, porque o uso real é telemóvel e
HTML5 drag-and-drop não funciona bem a toque. Uma transição que
precise de dado extra (`producao → revisao` precisa do link) não se
larga direto: abre o card, que já sabe pedir o que falta. As outras
transições sem input (assumir, aprovar, devolver) acontecem direto
ao largar.

**Base solicitante é campo próprio, não escondido no subtítulo.**
`baseSolicitanteId` é sempre a chave interna (`apoio`/`tecnica`/...);
`nomeBase()` (`lib/solicitacoes.js`) traduz para o nome de exibição —
lista fixa, não lê `bases/{id}` um a um só para isto. Aparece no card
(`Ministério · Base`) e como campo próprio "De que base" na folha de
detalhe — antes só vinha escondido no subtítulo, sem rótulo, em minúsculas.

**As quatro secções vêm fechadas por omissão — mesmo padrão da
Wiki/Acervo.** `secoesAbertas` (`Solicitacoes.jsx`) é `{}` ao
carregar, cada `.mincartao-cab` é agora `cabtoque` de verdade
(`<button>`, `aria-expanded`, seta que roda): toca para abrir só
aquela secção, as outras ficam como estavam. Largar um card
arrastado (`onDragOver`/`onDrop`) continua a funcionar numa secção
fechada — os handlers vivem no `.mincartao` de fora, não dependem de
`secoesAbertas`.

**Só a Comunicação escolhe a base solicitante ao abrir um pedido —
as outras três nunca veem o campo.** `SheetAbrirSolicitacao.jsx`
(`packages/shared`) é o mesmo formulário para qualquer base; para
Apoio/Técnica/Backstage a base do pedido é sempre a própria (como
sempre foi, a Cloud Function deriva do token, nunca confiou em
input). Só quando `BASE_ID === "comunicacao"` (`souComunicacao`)
aparece o campo "De que base é o pedido" — porque um pedido aberto
pela própria Comunicação tanto pode ser em nome de outra base
(alguém pediu por fora do sistema, ex.: WhatsApp) como um trabalho
interno dela mesma; sem o campo não havia como distinguir os dois.
No backend, `abrirSolicitacao` (`functions/index.js`) só aceita
`baseSolicitanteId` do payload **quando o `baseId` do token já é
`"comunicacao"`** — para qualquer outra base o campo é ignorado
mesmo que venha no payload, a base final é sempre a do token
(`BASES_VALIDAS` valida o valor escolhido). Nunca confiar em
`baseSolicitanteId` do cliente sozinho — é sempre condicionado ao
`baseId` real, verificado pelo Auth.

## Detalhes que valem para esta base como as outras

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.
- `horaChegada` fica `null` no seed — o líder define em Painel do
  líder → Definições da base (mesmo ecrã das outras bases).

## Culto

Três sub-abas — **Escala · Ordem do culto · Feedbacks**, nessa ordem
(ver "Navegação" acima para a história de como Escala chegou aqui).

Quem publica o PDF da ordem do culto **é a Backstage, não a
Comunicação** — `bases/comunicacao.culto.podePublicar` não existe
(só `bases/backstage` tem `culto.podePublicar: true`, ver `CLAUDE.md`
raiz e `functions/index.js`, `claimsExtraDaBase`). O líder da
Comunicação nunca vê o botão "Subir ficheiro" aqui, só lê o PDF depois
de publicado — a mesma ordem do culto que todas as bases leem. Por
isso `OrdemCultoCard.jsx` (cópia local desta base, cada app tem a
sua) diz "A Backstage costuma subir o ficheiro à quinta-feira" e não
"O líder" — "líder" sozinho, sem dizer de que base, dava a entender
(mal) que era o líder da própria Comunicação.

## Brand (Marcas + Acervo)

```js
marcas/{id}                          // raiz — leitura para TODAS as
  nome, descricao, cores: string[],  // bases (briefing §6.7: "o líder
  fotoUrl?, ordem, ativo             // de Kids precisa do logo certo
  fixado?, fixadoEm?                 // tanto quanto a Comunicação")
marcas/{id}/categoriasRecurso/{id}   // Logos/Fontes/Cores/Outros por
  nome, ordem, ativo                 // omissão, o líder cria mais
marcas/{id}/recursos/{id}
  categoriaId                        // substitui o antigo `tipo` fixo
  titulo, descricao, url, thumbUrl?, origem, ordem
acervo/{id}                          // raiz, mesma leitura ampla
  categoriaId?, titulo, descricao, url, thumbUrl?, origem, ordem, ativo
acervoCategorias/{id}                // raiz, mesma leitura ampla
  nome, ordem, ativo
```

Sem Cloud Function — escrita direta do cliente, gate só na regra
(`souLiderBase('comunicacao')`). Diferente de Solicitações: aqui não
há autoria mista nem histórico a garantir, então a regra já chega
(mesmo padrão de `funcoes`/`ministerios`).

**Cores é uma paleta (2 a 4 hex), não um par fixo.** O briefing (§5.2)
sugeria só `cor`+`gradiente opcional`; o líder pediu para poder editar
a paleta inteira pelo painel (`SheetMarca`, com `<input type="color">`
por swatch). O card da grelha usa as duas primeiras como gradiente
(`linear-gradient(135deg, cores[0], cores[1])`); todas aparecem como
bolinhas por baixo do nome. `fotoUrl` opcional substitui o gradiente
quando preenchida — pedido explícito do líder, ver mockup partilhado
na conversa que criou este ecrã.

**Fixar no topo.** Botão em `SheetMarca` (`fixarMarca`/`desafixarMarca`).
`ouvirMarcas` continua a mesma query (`ativo`, `ordem`, `nome`); a
reordenação — fixadas primeiro, a mais recentemente fixada à frente
das outras — acontece no cliente, sem índice composto novo (a lista
de marcas é sempre pequena). Badge 📌 no card da grelha
(`.marca-fixada`), mesmo padrão de emoji de estado que o resto da
app já usa (📝 em treino, ✅ feito) — sem introduzir ícone novo.

**Categorias de recurso, dentro de cada marca — substituem o antigo
`tipo` fixo em código.** Pedido do líder: "dentro de cada Marca,
precisa ter a opção de criar cada categoria lá [...] Que serão Logos,
Fontes, Cores e Outros [...] pode tirar a opção de Tipo, em Novo
recurso, pois isso entrará já dentro de cada categoria." O kit de uma
marca agora tem dois níveis: primeiro uma grelha de categorias (cards
no gradiente da própria marca, `.categoria-card` — "igual os cards de
Marcas", só que sem paleta própria, a cor é sempre a da marca), só
depois os recursos lá dentro. `SheetRecurso` deixou de perguntar o
tipo — `categoriaId` vem do contexto (a categoria que estava aberta),
como abrir "Novo" dentro de uma pasta.

`garantirCategoriasPadrao` semeia Logos/Fontes/Cores/Outros com **IDs
fixos iguais aos valores do antigo `tipo`** (`logos`, `fontes`,
`cores`, `outros`) na primeira vez que o líder abre o kit de uma
marca — os recursos antigos (só têm `tipo`, nunca `categoriaId`) caem
sozinhos na categoria certa, sem script de migração
(`categoriaDoRecurso = r => r.categoriaId ?? r.tipo`, em `Brand.jsx`).
O líder acrescenta categorias além dessas 4 quando uma marca precisa
(`SheetCategoriaRecurso`); desativar uma não apaga os recursos lá
dentro, eles só deixam de aparecer em nenhum grupo (mesmo cuidado do
Acervo, ver abaixo).

**Acervo com categorias, cada uma até 3 itens antes de "Ver mais" —
categoria é obrigatória.** Mesma ideia das Marcas, coleção própria na
raiz (`acervoCategorias`, não é por marca — o Acervo nunca teve nível
de marca). Decisão do líder depois de testar: todo item novo tem de
escolher uma categoria (`SheetItemAcervo` valida e bloqueia sem ela,
pré-seleciona a primeira); sem nenhuma categoria ainda, o sheet nem
mostra o formulário — pede para criar uma primeiro ("Nova categoria").
"Sem categoria" não é opção no `<select>` — só continua a existir como
grupo de leitura (sem editar, sem ser escolhível) se sobrar algum item
de antes desta regra existir, para nada desaparecer sozinho; vazio,
não aparece. `GrupoAcervo` reaproveita `.mincartao`/
`.verMais`, o mesmo cartão que a Wiki usa para agrupar por ministério
— mostra só os 3 primeiros itens da categoria, "Ver mais (N)" expande
para todos. Sem paginação nem ecrã à parte: o acervo de uma equipa
pequena não pede isso.

**Categoria vem fechada por omissão, mesmo padrão da Wiki/Solicitações
— dois níveis de "aberto" independentes.** `secaoAberta` decide se a
categoria mostra os itens (fechada ao carregar, toca no cabeçalho
`.cabtoque` para abrir); `todosVisiveis` (só existe depois de aberta)
decide se mostra 3 ou todos. O cabeçalho é `<div role="button">`, não
`<button>` de verdade — tem o botão "Editar" aninhado lá dentro
(`.mincartao-editar`, só para o líder da base), e HTML não deixa
`<button>` dentro de `<button>`; "Editar" para a propagação do clique
(`e.stopPropagation()`) antes de abrir `onEditarCategoria`, senão
tocar em "Editar" também abria/fechava a categoria.

**Instagram é origem, não campo à parte — e o ícone é o logo real de
cada serviço, não emoji.** Primeira tentativa foi um `linkInstagram`
separado do `url` principal, com emoji na miniatura (🗂️/🎨/📦) em vez
da inicial do título; o líder corrigiu os dois: "Isso foi errado [...]
o usuário já vai por o link em Link mesmo" — Instagram entra como mais
um valor de `origem` (`ORIGENS` em `SheetItemAcervo.jsx` e
`SheetRecurso.jsx`: Google Drive/Canva/Dropbox/Instagram/Outro), sem
campo novo nenhum. `LOGO_ORIGEM` (em `Brand.jsx`) mapeia cada origem
para o logo de verdade em `apps/comunicacao/public/origem/`
(`drive.webp`, `canva.jpg`, `dropbox.png`, `instagram.svg` — ficheiros
que o líder enviou, cada um num formato diferente, por isso as
extensões não seguem um padrão só). `.miniatura-origem` (CSS local)
põe um cartão branco por trás dos quatro para ficarem com a mesma
moldura. `CardRecurso` é partilhado entre Acervo e Kit de Marca — o
ícone vale nos dois sítios.

**Categorias reais aparecem sempre na lista, mesmo com 0 itens —
bug já corrigido, não repetir.** A primeira versão só mostrava um
grupo se `itens.length > 0`; uma categoria recém-criada (ainda sem
nada lá dentro) ficava invisível, e sem aparecer não havia como a
abrir para editar/excluir nem para lhe atribuir o primeiro item — só
"resolvia sozinho" depois de criar um item nela por fora (via
`SheetItemAcervo`, que lista todas as categorias no `<select>`
independentemente de terem itens). Só "Sem categoria" (não é uma
categoria de verdade, `SEM_CATEGORIA` no código) esconde-se quando
vazia — é fixa, sem edição, o líder confirmou que assim está bem.

**Cor por categoria, não foto — testámos e voltámos atrás.** Primeira
versão pôs uma foto de fundo na barra da categoria (upload, Storage em
`acervoCategorias/{id}`); o líder testou e achou feio ("ficou
horrível"), pediu para trocar por uma barra de cor. `acervoCategorias/
{id}.cor` (hex, `<input type="color">` em `SheetCategoriaAcervo`) —
mesma `.mincartao-barra` + `.ponto` que a Wiki já usa para agrupar por
ministério, nada de novo em CSS. Sem Storage, sem upload — se um dia
voltar a foto, ver `git log` deste ficheiro para a versão que já foi
tentada e descartada, não repetir o mesmo caminho.

**Layout é local, não em `packages/shared`.** A grelha de Marcas
(`.marca-card`, `.grelha-marcas`) só existe neste ecrã, por isso vive
em `apps/comunicacao/src/styles/comunicacao.css` — nunca em
`global.css` (ver `CLAUDE.md` raiz: mudança visual de uma base só,
escreve no ficheiro local dela). Dentro do kit de cada marca e no
Acervo, os cards de recurso reaproveitam `.cartaomelh` tal como já
existe (miniatura, título, selo) — só a `border-radius` da miniatura
muda de redonda para quadrada (10px), porque um logo não é uma
pessoa.

Miniatura do recurso: `thumbUrl` se preenchido, senão a inicial do
título (mesmo padrão de Melhorias) — sem emoji por tipo, decisão
explícita do líder para não inventar uma convenção nova.

**Foto da marca é upload, não link — reversão deliberada da regra
"sem upload" do briefing.** O princípio 2 do briefing dizia "nada de
upload de arquivo no painel, em qualquer tela"; o líder pediu
explicitamente um campo de upload para a foto de fundo do card (com o
tamanho ideal escrito por baixo — 600×400px, 3:2). Só este campo
muda: os recursos dentro do kit e o Acervo continuam por link, como
o briefing sempre pediu. Implementação é o mesmo padrão já usado para
foto de função/pessoa (`comprimirImagem` a 900px, Storage, ver
`storage.rules` — `marcas/{ficheiro}`, só o líder da Comunicação
escreve). `SheetMarca` gera o id da marca já na abertura (mesmo para
"nova"), para o upload ter um caminho antes de o documento existir no
Firestore — igual ao `novoFuncaoId`.

## Wiki

**Portada 1:1 da Técnica** — pedido do líder depois de testar a
primeira versão (`bases/comunicacao/artigos`, só leitura, "sem editor
nesta fase"): "não tem uso [...] copia isso exatamente igual da
técnica". Mesmo path, mesmo schema, zero mudança no backend
(`criarEsqueletoWiki`/`guardarArtigoWiki`/`criarDuvida`/
`responderDuvida`/`marcarRespostaCerta`/`transformarDuvidaEmArtigo`,
já genéricas por `baseId`):

```js
bases/comunicacao/wiki/{id}
  tipo: "artigo" | "duvida"
  titulo, introducao, conclusao, passos: [{texto, imagem}]
  ministerios: [...], etiquetas: [...]
  autorId, criadoEm, atualizadoEm
  esqueleto: true          // criado pelo líder, ainda por escrever
  resolvidaPorRespostaId?  // dúvidas
bases/comunicacao/wiki/{id}/respostas/{id}
wikiIndice/comunicacao      // índice leve para a busca no cliente
```

`lib/wiki.js`, `lib/wikiGrupos.js` e os componentes
(`SheetArtigoWiki`, `SheetDuvidaWiki`, `SheetEditorArtigo`,
`SheetNovaDuvida`, `SeletorMinisterios`) são cópia de `apps/tecnica`
sem alteração de lógica — só as classes CSS locais mudaram de nome
(`tec-min`/`tec-perguntar` → `com-min`/`com-perguntar`, ver
`comunicacao.css`, mesmo motivo de sempre: nunca reaproveitar nomes
de classe de outra base). Agrupado por ministério (`agruparWikiPorMinisterio`),
com "Geral" como rede de segurança para o que não tem ministério ou
aponta para um entretanto desativado. **"Novo artigo"** e **"Coloca
aqui a tua dúvida"** são os pontos de entrada para escrever — a
diferença da versão antiga é exatamente esta: agora há como criar,
não só ler.

## Enquetes (indisponibilidade — não é a genérica que o briefing pedia)

```js
bases/comunicacao/enquetes/{mes}         // {mes} = "AAAA-MM", igual a
  domingos: string[],                    // Técnica/Backstage
  estado: aberta|fechada, ativo,
  abertaEm, prazo?, escalaPublicada?
bases/comunicacao/enquetes/{mes}/respostas/{uid}
  indisponivelEm: string[], semIndisponibilidade, nota, respondidoEm
```

`write: false` nos dois níveis — só por Cloud Function
(`abrirEnquete`, `fecharEnquete`, `reabrirEnquete`, `excluirEnquete`,
`responderEnquete`, `marcarEscalaPublicada`, em `functions/index.js`),
**já genéricas por `baseId`** — não foi preciso mexer no backend para
a Comunicação ganhar isto, só `lib/enquetes.js` (`apps/comunicacao`,
portado quase 1:1 de `apps/tecnica`) e as telas.

**Não é o que o briefing pedia.** O §5.5 descrevia uma enquete
genérica (pergunta + opções, criador escolhe o que perguntar) —
chegámos a construir essa versão inteira (`SheetEnquete`,
`SheetRespostasEnquete`, regra própria com `base=='comunicacao'`) e o
líder mandou excluir: "totalmente inútil, as enquetes que eu quero é
as enquetes para Indisponibilidades mesmo, que dali já tira as infos
para montar a escala." Ficou o mecanismo real de indisponibilidade,
igual ao da Técnica/Backstage — mesmo path, mesmo schema, mesma regra.
Sem "Responsável" rotativo nem lugares travados (ver Ministérios
acima), por isso a versão da Comunicação não tem o resto da
complexidade da Técnica (texto para WhatsApp por lugar, alertas de
sobrecarga) — só abrir/fechar/responder e o que o sugestor precisa.

Líder abre/gere em Painel do líder → Indisponibilidades
(`SheetAbrirEnquete` para abrir um mês, `SheetIndisponibilidade` para
ver respostas por domingo, quem falta responder, encerrar/reabrir/
excluir — todos portados de `apps/tecnica` sem alteração de schema).
Voluntário responde num banner no Início ("A precisar de ti —
indisponibilidades de {mês}", `SheetResponderEnquete`) — mesmo
componente e texto da Técnica.

## Escala sugerida

`lib/sugestor.js` — só `if`s, sem IA, botão "Sugestão automática"
dentro do editor de escala (`SheetEscalaMinisterios`). Preenche só os
lugares vazios (nunca troca o que o líder já escolheu) com quem, em
cada ministério, está há mais tempo sem servir
(`obterEstatisticasEscala`, já genérica, reaproveitada de
`lib/painel.js`), sem repetir pessoa no mesmo culto.

**Usa a indisponibilidade real** (ver Enquetes acima): antes de
sugerir, `SheetEscalaMinisterios` busca as respostas do mês do culto
(`obterRespostas`, one-shot, não live) e passa a
`indisponiveisNoCulto(respostas, evento.id)` — quem marcou aquele
domingo como indisponível nunca é sugerido, mas continua escolhível à
mão no `<select>` (a exclusão é só da sugestão automática, não uma
regra de negócio). Sem enquete aberta para o mês, o conjunto de
indisponíveis fica vazio — a sugestão nunca trava por falta dela, só
perde a restrição.
