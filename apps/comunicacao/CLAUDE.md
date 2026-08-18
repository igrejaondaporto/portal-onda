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

Fases 1 e 2 feitas: configuração da base, membros, Início (com
Equipamentos), Agenda (Domingo/Produção), Solicitações, Funções,
Culto. Ponto de partida: cópia de `apps/tecnica` (é a que já tem
ministérios) + o Funções em separador da Apoio (a Técnica não tem
essa aba, mete tudo na checklist do Início — a Comunicação tem as
duas coisas). Fases 3 (Brand/Acervo/Wiki) e 4 (Área do líder) por
fazer.

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
- **Wiki, Enquetes**: ainda não construídos (Fase 3/4). Quando forem,
  não vão apontar para `bases/tecnica/wiki` nem para
  `bases/*/enquetes` (essa é a enquete de indisponibilidade para
  montar escala — semântica completamente diferente da enquete de
  opções do briefing).

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

Barra inferior: `Início · Agenda · Solicitações · Funções · Culto`.
Sem Inventário (a Comunicação não tem esse conceito — ver
Equipamentos acima). Sem Wiki/Brand ainda (Fase 3). "Agenda" é a
antiga "Escala" (chave interna continua `escala`, só o rótulo mudou)
com duas sub-abas por cima: **Domingo** (a escala de sempre) e
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
  status: fila|producao|revisao|entregue|recusada,
  responsavelId, responsavelNome, entregaUrl, entregueEm,
  historico: [{ de, para, porId, porNome, em, motivo? }]
```

Toda a escrita passa por Cloud Function (`abrirSolicitacao`,
`editarSolicitacao`, `assumirSolicitacao`, `mudarStatusSolicitacao`) —
regra `solicitacoes/{id}: write: false`. Não é o que o rascunho de
regras do briefing (§7) sugeria (escrita direta do cliente com
validação por regra); segui o padrão já usado em Wiki/Melhorias
(autoria mista + histórico obrigatório = sempre função, nunca
`setDoc` direto), porque `foraDoPrazo` tem de vir do servidor e o
histórico tem de ser gravado na mesma escrita que muda o estado.

`editarSolicitacao` (solicitante edita enquanto `status == "fila"`)
está implementada e testada (`node --check`), mas **sem UI nesta
fase** — nenhuma tela chama. Se um dia o solicitante precisar de
corrigir um pedido já aberto, é aí que entra.

**"Pedir à Comunicação"** vive no Painel do líder de Apoio/Técnica/
Backstage (não numa aba nova nessas apps — é `SheetAbrirSolicitacao`,
`packages/shared`, a única coisa desta fase que é genuinamente igual
em qualquer base). Visível a qualquer líder de base, inclui o aviso
de prazo curto antes de enviar (lê `bases/comunicacao.slaDiasMinimos`,
público a quem tem sessão).

## Detalhes que valem para esta base como as outras

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.
- `horaChegada` fica `null` no seed — o líder define em Painel do
  líder → Definições da base (mesmo ecrã das outras bases).

## Próximas fases (ver briefing completo)

- **Fase 3**: Brand (`marcas` + subcoleção `recursos`, raiz — leitura
  para todas as bases), Acervo (`acervo`, raiz), Wiki desta base
  (`bases/comunicacao/artigos`, categoria passo/dúvida/artigo, sem
  editor no app — schema mais simples que o da Técnica, sem
  ministérios nem esqueletos).
- **Fase 4**: Área do líder — escala sugerida (lógica condicional,
  sem IA) e enquetes (pergunta/opções genéricas — não confundir com a
  enquete de indisponibilidade que já existe noutras bases).
