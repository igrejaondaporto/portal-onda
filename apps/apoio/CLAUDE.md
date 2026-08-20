# Base de Apoio — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A equipa de limpeza e manutenção, ~18 pessoas. Chegam às 08:00 de
domingo, preparam a Casa do Povo de Vermoim, o culto é às 10:30.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em produção em `apoio.igrejaonda.pt`. O protótipo original
(`../../PROTOTIPO.html`, na raiz do monorepo) foi a especificação
visual e funcional inicial — já todo portado.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo. Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa (Sala de amamentação, WC Homens…) |
| **Culto** | O evento. Domingos 10:30, mais especiais (Culto de Mulheres) |

Não digas "líder do dia", "tarefa", "turno" nem "evento" na interface.

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/apoio/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6, e `packages/shared/src/lib/auth.js`).

Nota do Firestore: **não há junções.** As atribuições guardam uma cópia
do nome da função, para o ecrã de funções carregar de uma vez.

## Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todos os cultos
- `"2026-08-14"` → só naquele culto (ex.: "Subir as coisas da Loja")

Só o líder da base cria no catálogo. O líder de escala só cria
especiais, e só para o culto dele.

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

## Montar — enquete de indisponibilidade + sugestor de escala

Menu "Montar", só para o líder da base (`ABAS_BASE` + gate em
`Sessao.jsx`, mesmo padrão da Técnica). Três partes, todas em
`src/pages/Montar.jsx`: abrir/acompanhar a enquete, a escala
sugerida, e as últimas enquetes.

```js
bases/apoio/enquetes/{AAAA-MM}
  estado: "aberta" | "fechada", prazo: date
  domingos: [...]

bases/apoio/enquetes/{AAAA-MM}/respostas/{uid}
  indisponivelEm: [...], semIndisponibilidade: true, nota?, respondidoEm
```

**Cópia 1:1 do schema, Cloud Functions e regras da Técnica/Backstage**
(`src/lib/enquetes.js`) — já eram genéricas por `baseId`, zero
alteração no backend para isto funcionar aqui também. Só mudou o
domínio no texto pronto para o WhatsApp (`apoio.igrejaonda.pt`).

### O sugestor é mais simples que o da Técnica

A Apoio não tem ministérios — é uma equipa só. Por isso
`src/lib/sugestor.js` não tem titular/aprendiz/ministério: cada
domingo pede `tamanhoEquipa` pessoas quaisquer
(`gerarSugestaoApoio`), a saída é directamente `{pessoas: [...],
liderEscala}` — a mesma forma que `guardarEscala` já espera (a
mesma do editor manual, `SheetEscala.jsx`). Sem ministérios não há o
problema de "beco sem saída" da Técnica (preencher primeiro o slot
com menos candidatos) — qualquer pessoa serve para qualquer domingo,
por isso os domingos são preenchidos em ordem cronológica.

Candidatos ordenados por: nunca serviu primeiro → há mais tempo sem
servir → menos vezes no trimestre (`obterEstatisticasEscala`) →
menos vezes já escalada nesta própria geração (fairness dentro do
mês) → sorteio no empate de verdade.

UI (`src/components/painel/SugestorEscala.jsx`): um cartão por
domingo, mostra quem está escalado com a mesma interação do
`SheetEscala.jsx` manual (toca no ✓ para trocar, estrela define o
líder de escala) — "Editar equipa" abre a lista toda para ajustar.
**Nunca publica sozinho**: "Gerar sugestão" só propõe; o líder ajusta
e confirma em "Publicar escala", que grava um `guardarEscala` por
domingo e marca `marcarEscalaPublicada`. Sem a tabela/canvas de
exportação da Técnica (não fazia sentido sem colunas de ministério) —
se vier a fazer falta, portar depois.

## Detalhes já decididos e não se discutem outra vez

- Chegada 08:00, fixa por base, editável só pelo líder da base.
- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- Funções feitas descem para o fim da lista.
- Reembolso vai para o líder da base, que reencaminha ao Financeiro.
  Nunca escrevas o nome do responsável financeiro na interface.
- O nome do líder é sempre uma variável. Nunca um nome fixo no código
  da UI.
