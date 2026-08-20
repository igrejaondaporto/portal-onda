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
membros, Início (com Equipamentos), Agenda (Domingo/Solicitações),
Solicitações, Funções, Culto, Brand (Marcas + Acervo), Wiki, e a Área
do líder (Escala sugerida + Enquetes). Ponto de partida: cópia de
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

**Sem "Responsável" rotativo.** A Técnica modela o líder de culto como
um ministério de `ordem:0`; a Comunicação não tem isso — o
organograma mostra um líder da base fixo (`papel: "lider_base"`), sem
rotação de liderança por domingo. `liderEscala` existe no documento da
escala (mesmo formato das outras bases, para o resto do sistema não
precisar de caso especial) mas fica sempre `null`, e só o líder da
base pode gravar a escala (`guardarEscalaComunicacao`, valida no
servidor — não é líder de escala nenhum).

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

Barra inferior: `Início · Agenda · Funções · Culto · Wiki · Brand` —
**sem "Solicitações" própria**, diferente do menu que o briefing
original sugeria. "Agenda" é a antiga "Escala" (chave interna continua `escala`,
só o rótulo mudou) com duas sub-abas por cima: **Domingo** (a escala
de sempre) e **Solicitações** — o `Solicitacoes.jsx` inteiro
(`<Solicitacoes uid papel ativo definirCabecalho>`), quadro Kanban e
tudo, embrulhado ali dentro.

Passou por três formas até aqui, todas a pedido do líder depois de
testar: (1) o briefing pedia uma aba própria na barra, mais uma vista
filtrada só do que a pessoa produz dentro de Agenda — "A tua
produção", uma lista sem ação nenhuma; (2) essa lista saiu, e a
sub-aba passou a embrulhar o `Solicitacoes.jsx` completo, com a aba
própria na barra a continuar a existir em paralelo, as duas a mostrar
o mesmo estado ao vivo; (3) a aba própria saiu da barra — "não tem
uso [...] deixa ele apenas como um menu secundário em Agenda". Hoje
só há um caminho para lá: Agenda → Solicitações. Sem coleção
paralela nem cópia de estado — é sempre o mesmo componente, só muda
onde é montado.

## Solicitações

```js
solicitacoes/{id}                    // raiz — escrito por líderes de
  titulo, baseSolicitanteId,         // QUALQUER base, lido por essa
  solicitanteId, solicitanteNome,    // base + a Comunicação
  oQue, ondeUsa, textoFinal, linkReferencia,
  prazo, foraDoPrazo,                // calculado no servidor
  ministerioId,                      // para que ministério é (Fotografia,
                                      // Social Media…) — escolhido por
                                      // quem pede, não por quem produz
  status: fila|producao|revisao|entregue|recusada,
  responsavelId, responsavelNome, entregaUrl, entregueEm,
  transferePendente: { paraId, paraNome, deId, deNome, em } | null,
  historico: [{ de, para, porId, porNome, em, motivo? }
              | { tipo: "transferencia"|"transferencia_aceite"|"transferencia_recusada", ... }]
```

Toda a escrita passa por Cloud Function (`abrirSolicitacao`,
`editarSolicitacao`, `assumirSolicitacao`, `mudarStatusSolicitacao`,
`transferirSolicitacao`, `aceitarTransferencia`,
`recusarTransferencia`) — regra `solicitacoes/{id}: write: false`.
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

**"Pedir à Comunicação"** vive no Painel do líder de Apoio/Técnica/
Backstage (não numa aba nova nessas apps — é `SheetAbrirSolicitacao`,
`packages/shared`, a única coisa desta fase que é genuinamente igual
em qualquer base). Visível a qualquer líder de base, inclui o aviso
de prazo curto antes de enviar (lê `bases/comunicacao.slaDiasMinimos`,
público a quem tem sessão) e o seletor de ministério — lê
`bases/comunicacao/ministerios` mesmo sem ser da Comunicação, via
carve-out na regra (`base == 'comunicacao' && autenticado()`, mesma
lógica de `marcas`/`acervo`: nome/cor de ministério não é sensível).

**A revisão é feita por um líder — pedido explícito, mudou o fluxo
original.** Antes, quem produzia marcava "Entregue" sozinho a
qualquer momento; agora `producao → revisao` (quem produz, com o
link da entrega — sem link não sai da produção) e `revisao →
entregue` / `revisao → producao` (só o líder, aprova ou devolve) são
transições distintas, cada uma com quem pode fazê-la
(`TRANSICOES_SOLICITACAO` em `functions/index.js`). `recusar`
continua livre para quem produz, em qualquer estado aberto.

**Transferir**: qualquer voluntário da Comunicação transfere uma
solicitação (própria ou não) para outro — não é decisão do líder.
Fica `transferePendente` até quem recebe decidir: aceita (fica
responsável, some o pendente) ou recusa (`status` volta a `fila`,
`responsavelId` limpo — pedido explícito do líder). Enquanto pendente,
ninguém mais assume nem transfere de novo. Quem recebe vê um banner
no Início (`ouvirTransferenciasPendentes`, query por
`transferePendente.paraId`) com Aceitar/Recusar diretos — não abre
a solicitação para decidir.

**Kanban** (`Solicitacoes.jsx`): quatro colunas fixas — Fila,
Produção, Revisão, Entregue (Recusada fica fora, por trás de "Ver
recusadas" — não é um estado a monitorizar no dia a dia). Cor da
barra do card é o ministério, não o estado (o estado já é a coluna).
Arrastar (`draggable` nativo) só funciona a rato — é um atalho a
mais para desktop, nunca o único caminho, porque o uso real é
telemóvel e HTML5 drag-and-drop não funciona bem a toque. Uma
transição que precise de dado extra (`producao → revisao` precisa do
link) não se larga direto: abre o card, que já sabe pedir o que
falta. As outras transições sem input (assumir, aprovar, devolver)
acontecem direto ao largar.

## Detalhes que valem para esta base como as outras

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.
- `horaChegada` fica `null` no seed — o líder define em Painel do
  líder → Definições da base (mesmo ecrã das outras bases).

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

**Acervo com categorias, cada uma até 3 itens antes de "Ver mais".**
Mesma ideia, coleção própria na raiz (`acervoCategorias`, não é por
marca — o Acervo nunca teve nível de marca). `SheetItemAcervo` ganhou
o seletor de categoria (opcional — sem categoria cai em "Sem
categoria", nunca some). `GrupoAcervo` reaproveita `.mincartao`/
`.verMais`, o mesmo cartão que a Wiki usa para agrupar por ministério
— mostra só os 3 primeiros itens da categoria, "Ver mais (N)" expande
para todos. Sem paginação nem ecrã à parte: o acervo de uma equipa
pequena não pede isso.

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
