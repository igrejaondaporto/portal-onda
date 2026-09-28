# Onda Tech Hub — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

Não é uma base de voluntários que serve num domingo — é a equipa que
cuida do Portal em si (Julio, Vitor, Kairan, Diogo, Hans — todos
também voluntários da Técnica). Um painel só, sem escala, sem culto,
sem ministérios: ver e triar os **relatos** (bugs, erros, melhorias)
que qualquer pessoa, em qualquer base, reporta pelo menu ("Reportar
problema", `packages/shared/components/MenuEu.jsx`).

Pedido do líder da Técnica, 2026-09: "quero um menu para as pessoas
reportarem erros, bugs ou melhorias [...] que tenhamos um painel
nosso para sabermos o que cada pessoa está melhorando, bem como todos
os pontos reportados [...] apareçam para nós gerimos as tarefas e
executarmos."

## Estado

Scaffolding inicial a partir do skill `nova-base`, muito mais magro —
sem ministérios/escala/culto/wiki/equipamentos, porque nada disso se
aplica. Um ecrã só: **Relatos** (`src/pages/Relatos.jsx`).

Ainda por fazer antes de dar por pronta:
- Correr `scripts/criarBaseOndaTechHub.mjs` (precisa de
  `service-account.json`) — cria `bases/ondatechhub` e liga os 5.
- Ligar o domínio `techhub.igrejaonda.pt` no Cloudflare (Workers →
  `portal-ondatechhub` → Domains & Routes) — manual, fora do repo.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Relato** | Um bug/erro/melhoria reportado por alguém, de qualquer base |
| **Tipo** | erro, bug ou melhoria — o que a pessoa marcou ao reportar |
| **Estado** | Novo → Em andamento → Concluído (ou Recusado, em qualquer ponto) — os valores internos continuam `aberto`/`em_andamento`/`resolvido`/`recusado` (Firestore, Cloud Functions), só o texto mostrado mudou para bater com o vocabulário pedido |

Não digas "ticket", "issue" nem "chamado" na interface — é sempre
"relato".

## Modelo de dados

Nada disto é específico desta app — `relatos/{id}` é uma coleção
global (raiz, como `solicitacoes/`), escrita por Cloud Function
(`functions/relatos.js`) a partir de QUALQUER base. Ver o comentário
no topo desse ficheiro para o desenho completo.

```js
relatos/{id}
  tipo: "erro"|"bug"|"melhoria", titulo, descricao, paginaOrigem?
  baseOrigemId, reportadoPorId, reportadoPorNome
  status: "aberto"|"em_andamento"|"resolvido"|"recusado"
  responsavelId, responsavelNome, ativo, criadoEm, historico: [...]
```

Esta app é a única que LÊ a coleção inteira (`ouvirTodosRelatos`,
`src/lib/relatos.js`) — a rule (`minhaBase('ondatechhub')`) só deixa
isso a quem está autenticado com `baseId: "ondatechhub"` no token.
Qualquer um dos 5 muda o estado de qualquer relato
(`mudarStatusRelato`) — sem transições travadas por papel, ao
contrário de "Solicitar BG" na Comunicação: são 5 pessoas de
confiança triando junto, não duas equipas a negociar um pedido.

## Sem líder da base

`pessoas/{p}.papel` é sempre `"voluntario"` para os 5 — não há
"Painel do líder" nesta app (nada de voluntários para gerir, a
equipa é fixa), por isso um `lider_base` aqui só mostraria um botão
morto no menu (`MenuEu.jsx`, "Painel do líder" — gate só em `papel`,
sem `onAbrirPainel` ligado). Se um dia precisar de um líder de
verdade, ligar `onAbrirPainel` primeiro.

## Como entrar uma pessoa nova

**Nunca por seed direto com nome cru** (regra 9, CLAUDE.md raiz). As
5 pessoas de arranque foram ligadas por
`scripts/criarBaseOndaTechHub.mjs`, que procura o nome em
`bases/tecnica/pessoas` e liga (nunca duplica) — o mesmo mecanismo de
"já é voluntário(a) noutra base?" do Painel do líder, só que por
script porque não há líder desta base ainda para usar esse caminho
pela UI. Para adicionar alguém novo mais tarde, o caminho normal
(Painel do líder → Adicionar) não existe aqui — ou se cria um sexto
membro à mão com `criarVoluntario` (Cloud Function genérica,
`pessoaExistenteId` se já for voluntário noutra base), ou adapta-se o
script.

## Detalhes já decididos

- Sem tour de primeiro login — 5 pessoas de confiança, sem visita
  guiada (não quebra nada, `TourAutoStart` continua montado, só fica
  sem passos).
- Sem confirmação de presença, sem escala — não se aplica.
- Cor `#00C2A8` (teal), sem colisão com nenhuma base existente.
