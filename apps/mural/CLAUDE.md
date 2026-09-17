# Mural Onda — igrejaonda

Contexto específico desta app. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack) —
este ficheiro é o resumo vivo do que é diferente aqui.

## O que é

Anúncios de "dou/vendo/arrendo" e de "procuro", para a igreja toda —
Portugal inteiro, não só o Porto/Maia (o grupo de WhatsApp que isto
substitui junta toda a gente). **Não é uma base** (CLAUDE.md raiz,
regra 6 — bases são equipas de voluntários); é como `eventos/`: "da
igreja, não da base". Duas coisas separadas, de propósito, que é fácil
confundir: **Ofereço** (quem tem algo a dar — venda, doação,
arrendamento, emprego) e **Procuro** (quem precisa de algo). O Procuro
é o que faz isto ser da igreja e não um classificados qualquer — quem
sobra a uns chega a quem precisa, em vez de se perder no scroll do
grupo.

Nasceu de uma conversa longa sobre o problema real: o grupo de
WhatsApp virou uma montra (2-3 anúncios por dia), as pessoas
silenciaram-no, e passaram a perder avisos a sério da igreja por
causa disso. A troca que sustenta o produto: quem anuncia continua a
chegar a toda a gente (o Painel gera **um resumo por semana** para
colar no grupo, em vez de vinte interrupções soltas); quem não quer
ver anúncios deixa de ser interrompido; e cada anúncio fica sempre
atualizado, porque o dono confirma "ainda está disponível?" a cada 30
dias, em vez de a informação morrer soterrada no histórico do grupo.

## Entrada — dois caminhos para a mesma identidade

Isto é a decisão mais importante desta app e a que mais foge do
padrão do resto do repo (onde cada app serve UMA base, com
`VITE_BASE_ID` fixo):

- **"Sim, sirvo numa base"** — reaproveita `dadosEntrada`/`entrar`
  (`functions/index.js`) tal e qual, só com um passo a mais no
  cliente (escolher a base primeiro, ver `listarBasesMural`). Mesma
  identidade global, mesmo PIN de sempre (CLAUDE.md raiz, regra 2). O
  token que sai de lá já serve para publicar — as Cloud Functions do
  Mural (`functions/mural.js`) nunca olham para `baseId`/`papel`, só
  para `req.auth.uid`.
- **"Não, sou da igreja"** — quem nunca foi voluntário não tem base
  nenhuma para escolher. Entra por telemóvel + PIN, próprio deste
  domínio: `pedirEntradaMural` → `registarMural` (conta nova, id
  `tel_<telefone>` — nunca um nome cru, regra 9 do CLAUDE.md raiz) ou
  `entrarMural` (conta já existente).

`apps/mural/src/lib/auth.js` reaproveita o `SheetPin`/`TecladoNumerico`
partilhados para o primeiro caminho (guarda a base escolhida num
módulo local, `definirBaseEmCurso`, porque `SheetPin` espera
`entrarComPin(pessoaId, pin)` sem `baseId` — cada app de base tem
sempre o seu fixo, só o Mural varia). Sem `GatilhoDev`: o acesso de
dev é por base (CLAUDE.md raiz, "Ao criar uma base nova", item 3) e o
Mural não é uma — fica de fora de propósito.

## Modelo de dados

```
anuncios/{id}                    GLOBAL — tipo, categoria, título,
                                  descrição, preço/gratis, região,
                                  estado, autoria copiada (nunca lida
                                  em tempo real — mesmo padrão de
                                  nomesDePessoas em index.js)
gds/{id}                         GLOBAL desde 2026-09 (era
                                  bases/pessoal/gds) — o Mural só lê
config/muralAdmins/{pessoaId}    fechado (catch-all) — quem modera
```

Toda a escrita em `anuncios/` passa por Cloud Function
(`functions/mural.js`) — limite de 5 anúncios ativos por pessoa,
expiração a 30 dias, autoria vinda do servidor, nada disto dá para
garantir só com Regras (CLAUDE.md raiz, regra 3). "Remover" é sempre
`ativo:false` (regra 5 — nada se apaga a sério); o histórico do dono
continua visível em "Os meus".

**Sem índices compostos no Firestore, de propósito.** O feed lê só
`where(ativo==true)` (uma igualdade, indexada automaticamente) e
filtra/ordena tipo, região, categoria e busca no cliente — com o
volume real de um mural de igreja (dezenas a poucas centenas de
anúncios ativos) isto é mais barato do que manter índices compostos
para cada combinação de filtro, e simplifica: um filtro novo não pede
deploy de índice nenhum. A manutenção diária (`manutencaoMural`,
`onSchedule`) é a exceção — aí sim precisa de dois índices compostos
(ver `firestore.indexes.json`), porque corre no servidor sobre a
coleção inteira, não sobre o que já está na mão do cliente.

**O telefone nunca vai para dentro do anúncio.** Gravá-lo lá abriria
o número a qualquer pessoa autenticada que leia o documento, mesmo
sem carregar em nada. O botão "Falar no WhatsApp" chama
`pedirContactoAnuncio`, que o vai buscar na hora — a `pessoas/{uid}`
(quem só existe pelo Mural) ou a `bases/{b}/pessoas/{uid}` (quem é
voluntário, guarda o telefone na sua base).

## Débitos conscientes

- **Busca por telefone não normalizada entre sistemas.** `entrarMural`/
  `registarMural` só comparam contra `pessoas/tel_<telefone>` (o
  próprio caminho de registo do Mural), nunca contra o telefone que um
  líder escreveu numa base — por isso o formato ("912 345 678" vs
  "912345678") nunca interfere aqui. Ver o comentário completo no
  topo de `functions/mural.js`.
- **Sem moderação prévia.** Qualquer anúncio fica visível assim que é
  publicado; o Painel (aba "Reportados") e "Reportar anúncio à
  moderação" no detalhe são o mecanismo de hoje. Pré-aprovação
  combinada para uma fase seguinte — pedido explícito, 2026-09, para
  não travar o lançamento.
- **Editar um anúncio pelo Painel ainda não existe** — hoje o Painel
  só remove (`moderarAnuncio`). "Editar" fica para juntar com a
  pré-aprovação.
- **Sem upload de fotos no seed** (`scripts/seedMural.mjs`) — os
  anúncios de exemplo nascem sem imagem, só com o ícone de categoria.
- **Ícones/og-image gerados por script** (`scripts/gerarIconesMural.mjs`,
  CLAUDE.md raiz "Ao criar uma base nova", item 1) — já correu uma vez;
  volta a correr só se quiseres outro texto ou cor.
- **Pessoas de exemplo do seed são fictícias, nunca reais** — mesma
  convenção já escrita em `apps/pessoal/CLAUDE.md`: um anúncio
  inventado atribuído a um voluntário real, sem ele saber, confunde
  ou constrange se alguém tropeçar nisso antes de perceber que é
  demonstração.
