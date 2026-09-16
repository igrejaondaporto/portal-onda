# Financeiro — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A única base sem equipa de culto — trata do dinheiro, não de servir
domingo. Fecha o ciclo que todas as outras bases começam:
`Reembolsos` (`apps/*/src/pages/Reembolsos.jsx`) leva o pedido até
"aprovado pelo líder"; esta app é onde ele vira "pago".

Uso real: telemóvel pessoal, uma vez por semana ou menos — não é o
ritmo de domingo de manhã das outras bases, mas continua a valer a
regra de sempre: se algo exige mais de três toques, está mal
desenhado.

## Por que é uma base e não uma tela dentro de outra

O responsável financeiro precisa de ver os reembolsos das 9 bases de
uma vez, e o sistema de papéis é sempre dentro de uma base
(`request.auth.token.baseId`, ver `CLAUDE.md` raiz, regra 4). Uma
"base" nova (`bases/financeiro`, com a capacidade `veReembolsos:
"todas"`) resolve isto pelo mesmo mecanismo que já existe para a
Backstage ver todas as escalas (`veEscalas: "todas"` →
`ve_todas_escalas`) — aqui vira a claim `ve_todos_reembolsos`
(`claimsExtraDaBase`, `functions/index.js`). Entra-se por PIN, como
qualquer outra base; não há papel "admin_igreja" nenhum, é só mais
uma capacidade de base.

## O que esta app NÃO tem

Sem escala, sem funções, sem culto, sem inventário, sem Painel do
líder — nenhum desses conceitos existe aqui. Quatro abas: **Relatório**
(a de abertura), **Por pagar**, **Dinheiro** e **Fornecedores**, mais
Perfil (login/PIN, igual a qualquer base).

## Vocabulário

| Termo | O que é |
|---|---|
| **Aprovado** | O líder da base já decidiu que o pedido é válido — é o que entra na fila do Financeiro |
| **Pago** | O Financeiro já transferiu/pagou por MB Way |
| **Devolvido** | O Financeiro encontrou um problema (fatura ilegível, falta o NIF) e mandou de volta ao líder — volta a ser decisão dele, aprovar de novo ou indeferir |
| **Lote** | Vários pedidos pagos de uma vez, tipicamente todos os de uma mesma pessoa |

Não digas "indeferido" aqui — indeferir é sempre do líder da base, o
Financeiro só paga ou devolve.

## Modelo de dados

Não tem coleção própria de reembolsos — lê `bases/*/reembolsos` de
TODAS as bases por `collectionGroup` (`lib/reembolsosFinanceiro.js`),
autorizado pelo bloco `match /{path=**}/reembolsos/{r}` em
`firestore.rules`, guardado por `vejoTodosReembolsos()`. Ver
`functions/index.js`: `marcarReembolsosPagos` (lote) e
`devolverReembolso` são as únicas duas escritas — nunca escrita
direta do cliente, porque mexem em dinheiro e cruzam bases (regra 3
do `CLAUDE.md` raiz).

`bases/financeiro` em si não guarda reembolsos nenhuns — só existe
para dar identidade/PIN a quem trata disto, com
`veReembolsos: "todas"`.

### Onde a pessoa recebe (IBAN/MB Way)

Cada reembolso já chega com `pagamento: {metodo, destino}` — uma
CÓPIA do que a pessoa tinha guardado em
`pessoas/{uid}/privado/pagamento` no momento em que submeteu o
pedido (ver `apps/*/src/lib/reembolsos.js`, `criarReembolso`). Esta
app nunca lê `privado/pagamento` diretamente — só vê a cópia que já
veio no pedido, e é o que aparece em `SheetDetalheReembolso`.
Continua certo mesmo que a pessoa mude de banco depois de já ter
sido paga uma vez.

## Nomes e cores de outras bases

`bases/{id}` é público a qualquer pessoa autenticada (ver
`firestore.rules`) — `lib/bases.js` lê a coleção toda uma vez para
etiquetar cada pedido com o nome e a cor certos (mesmo `quadmin` que
as escalas já usam). Nunca lê `bases/{id}/pessoas` de outra base —
isso continua fechado; o nome de quem pediu vem gravado no próprio
reembolso (`pessoaNome`, denormalizado no `criarReembolso`).

## Dinheiro que entra — dízimos e ofertas

Ao contrário dos reembolsos (que nascem noutra base), quem regista
dízimo/oferta é **sempre o próprio Financeiro** — nenhuma base tem
esse dado. Coleção própria (`lib/entradas.js`):

```js
bases/financeiro/entradas/{id}
  valor, fundo (dizimo|oferta|missoes|obras|outro),
  metodo (dinheiro|mbway|transferencia), referencia?,
  criadoPor, criadoEm
```

Um lançamento por fundo+método (não um total à mão) — é o que faz o
"total por método + por fundo" bater certo sem depender de texto
livre. Mesmo padrão de `despesasFixas`: escrita direta do cliente,
imutável (só `create`), corrige-se com um lançamento novo. Aparece
dentro da aba **Dinheiro** (não ganhou aba própria — é a mesma tela
que já mostra "o que saiu"), com os totais do mês por fundo e por
método e os últimos lançamentos.

## Fornecedores e despesas fixas

Gastos recorrentes (renda, subscrições, contrato de limpeza…) que não
nascem de um pedido de reembolso de nenhuma base — o Financeiro lança
diretamente o que já pagou. Duas coleções próprias, só desta base
(`lib/fornecedores.js`):

```js
bases/financeiro/fornecedores/{id}
  nome, categoria (CATEGORIAS_DESPESA), valorHabitual?, periodicidade,
  ativo

bases/financeiro/despesasFixas/{id}
  fornecedorId, fornecedorNome, categoria, valor, metodo, referencia,
  criadoPor, criadoEm
```

Escrita direta do cliente (sem Cloud Function): é dado só desta base,
sem cruzamento com outra nem autoria mista, mesmo padrão de
`funcoes`/`avisos` de qualquer base (ver `firestore.rules`).
`despesasFixas` é histórico de pagamento — só `create`, nunca
`update`/`delete` (regra 5 do `CLAUDE.md` raiz: corrige-se com um
lançamento novo, não editando o antigo). "Excluir" um fornecedor é
sempre `ativo:false`, nunca um delete a sério.

## Valor de património nos equipamentos

Não é dado desta base — vive em `bases/{tecnica|louvor}/inventario/{item}.valorCompra`
(`criarEquipamento`/`guardarEquipamento`, `functions/index.js`), o
mesmo campo opcional já usado para a fatura de compra. O Relatório
(abaixo) é quem o lê.

## Relatório — a aba de abertura

Pedido explícito do dono do produto ("quero MUITO, isso é muito
importante, deixar até como Início isso") — painel geral com
gráficos simples e tabelas fáceis, primeira aba da NavBar
(`pages/Relatorio.jsx`). Nada de coleção própria: junta o que as
outras abas já leem —

- **Entrou/Saiu do mês** — soma de `entradas` (dízimos/ofertas) contra
  reembolsos pagos + `despesasFixas`.
- **Património** — soma de `valorCompra` de Técnica e Louvor, via
  `obterPatrimonioBases` (`lib/relatorio.js`). Única leitura nova:
  `bases/{b}/inventario` é fechado por `minhaBase(b)` nas rules (ao
  contrário de reembolsos, que já eram por documento e por isso a
  collectionGroup do Financeiro serve) — sem atalho de regra possível
  aqui, por isso é uma Cloud Function com Admin SDK, mesmo molde do
  `escalasCrossBase` da Backstage. `BASES_PATRIMONIO` é uma lista fixa
  em código (`functions/index.js`) — uma base nova em modo património
  entra ali manualmente, o mesmo custo que já existe para
  `CATEGORIAS_DESPESA`.
- **Gasto por categoria** / **Entradas por fundo** — barras horizontais
  de um hue só (o mesmo componente `.barra`/`.barra i` que "Por base"
  em Dinheiro.jsx já usa), ano corrente, reembolsos pagos +
  despesasFixas categorizados de um lado, entradas do outro.
- **Últimos 6 meses** — tabela simples, sempre 6 linhas mesmo em mês
  sem lançamento nenhum.

Tudo lido ao vivo (`onSnapshot`) exceto o património, que é uma
chamada única à função ao entrar na aba (não há razão para ao vivo —
o valor de compra de um equipamento quase nunca muda).

## Detalhes já decididos

- **Nunca escrevas o nome do responsável financeiro na interface**
  (mesma regra da Apoio) — o cartão de aviso no Início das outras
  bases diz só "O Financeiro", nunca um nome.
- Devolver é diferente de indeferir: estado próprio (`devolvido`),
  nunca um regresso a `submetido` — ver o comentário em
  `devolverReembolso`, `functions/index.js`.
- O pagamento em lote agrupa por pessoa (uma transferência com todos
  os pedidos dela), não por base.
- Exportação CSV é sempre do mês corrente visível em Dinheiro — sem
  seletor de período por agora; se vier a fazer falta, portar.

## Por fazer / débito consciente

- Sem push/email (nenhuma base tem — ver `MELHORIAS-ENTRE-BASES.md`).
  O aviso de "pago"/"devolvido" é só o cartão `.destaque` no Início
  de cada base, como o de "indeferido" já era.
- Sem orçamento mensal (decisão explícita — só se usa dinheiro quando
  precisa de algo, não há tecto a controlar) nem aprovação em dois
  níveis (também recusado).
- Plano combinado do painel financeiro completo — categorias,
  fornecedores, entradas, património, Relatório.
