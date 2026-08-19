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
membros, Início (com Equipamentos), Agenda (Domingo/Produção),
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

Barra inferior: `Início · Agenda · Solicitações · Funções · Culto ·
Wiki · Brand` — o menu final do briefing, completo. Sem Inventário (a
Comunicação não tem esse conceito — ver Equipamentos acima). "Agenda"
é a antiga "Escala" (chave interna continua `escala`, só o rótulo
mudou) com duas sub-abas por cima: **Domingo** (a escala de sempre) e
**Produção** — consulta a `solicitacoes` filtrada por
`responsavelId == eu` (ver `CLAUDE-comunicacao.md` §5.6 — nunca uma
coleção própria, senão desincroniza de Solicitações).

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
marcas/{id}/recursos/{id}            // tanto quanto a Comunicação")
  tipo: logos|fontes|cores|outros
  titulo, descricao, url, thumbUrl?, origem, ordem
acervo/{id}                          // raiz, mesma leitura ampla
  titulo, descricao, url, thumbUrl?, origem, ordem, ativo
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

```js
bases/comunicacao/artigos/{id}
  categoria: passo | duvida | artigo
  titulo, resumo, conteudo, ordem, ativo
```

Só leitura e busca no cliente (título/resumo, sem acentos) — **sem
editor no app nesta fase** (dívida consciente do briefing §9.3): o
conteúdo entra direto no Firestore, por fora do painel. `conteudo` é
mostrado como texto simples (`white-space: pre-wrap`), não se
interpreta markdown — evita depender de mais uma biblioteca para um
ecrã sem editor. Agrupado por categoria em `.mincartao` (o mesmo
componente que a Técnica usa para ministério), sem índice `wikiIndice`
à parte — a coleção é pequena o suficiente para ler inteira de uma
vez.

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
