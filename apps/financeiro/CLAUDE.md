# Financeiro — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A única base sem equipa de culto — trata do dinheiro, não de servir
domingo. Fecha o ciclo que todas as outras bases começam:
`Reembolsos` (`apps/*/src/pages/Reembolsos.jsx`) leva o pedido até
"aprovado pelo líder"; esta app é onde ele vira "pago". Também é onde
entra o outro lado — dízimos, ofertas, gastos fixos, património.

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

## As cinco abas

Sem escala, sem funções, sem culto, sem inventário, sem Painel do
líder — nenhum desses conceitos existe aqui. Perfil não é aba, abre
tocando na foto (mesmo padrão do "Ver perfil" do `MenuEu` das outras
bases).

| Aba | Ficheiro | O que é |
|---|---|---|
| **Início** | `pages/Inicio.jsx` | Ecrã de abertura — visão geral com gráficos e tabelas |
| **Reembolsos** | `pages/Reembolsos.jsx` | A fila de pagamento (pedidos das 9 bases) |
| **Entradas** | `pages/Entradas.jsx` | Dízimos, ofertas e outras receitas |
| **Fornecedores** | `pages/Fornecedores.jsx` | Gastos fixos/recorrentes |
| **Caixa** | `pages/Caixa.jsx` | O extrato — saldo, por base, exportação CSV |

**Início é sempre a primeira aba, Caixa é sempre a última** — pedido
explícito do dono do produto: a visão geral abre a app, o extrato
detalhado é para quem quer conferir a sério, não o que se vê primeiro.

Todas as cinco ficam **sempre montadas** (`display:none` no lugar de
desmontar, em `Sessao.jsx`) — preserva filtro e posição de scroll ao
trocar de aba. Por causa disso, cada página só recalcula o cabeçalho
(`definirCabecalho`) quando recebe o prop **`ativo` = verdadeiro**
(`pagina === "<chave>"`, passado por `Sessao.jsx`): sem esse gate, o
efeito de cada página corria só uma vez, no arranque da app, e o
título parava de seguir a navegação — foi um bug reportado depois do
Relatório virar Início. Qualquer página nova aqui **tem de** receber
`ativo` e usá-lo assim:

```jsx
useEffect(() => {
  if (!ativo) return;
  definirCabecalho({ titulo: ..., subtitulo: ..., chips: [...] });
}, [ativo, definirCabecalho, /* ...o resto que o título usa */]);
```

## Todo sheet tem um botão de fechar

Regra sem exceção nesta app (reportado como bug: um popup sem saída
visível, só fechava tocando fora): todo componente `Sheet*` acaba com
um `<button className="btn sec full" onClick={onFechar}>Cancelar</button>`
(ou "Fechar", em `SheetDetalheReembolso`), **mesmo** quando já existe
uma ação primária (Guardar, Registar, Marcar como pago). O véu
(`<div className="veu" onClick={onFechar}>`) continua a existir, mas
nunca é a única saída.

## Vocabulário

| Termo | O que é |
|---|---|
| **Aprovado** | O líder da base já decidiu que o pedido é válido — é o que entra na fila do Financeiro |
| **Pago** | O Financeiro já transferiu/pagou por MB Way |
| **Devolvido** | O Financeiro encontrou um problema (fatura ilegível, falta o NIF) e mandou de volta ao líder — volta a ser decisão dele, aprovar de novo ou indeferir |
| **Lote** | Vários pedidos pagos de uma vez, tipicamente todos os de uma mesma pessoa |

Não digas "indeferido" aqui — indeferir é sempre do líder da base, o
Financeiro só paga ou devolve.

## Reembolsos (fila de pagamento)

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

Cada linha da fila mostra uma etiqueta colorida com o nome da base
(cor de `bases/{id}.cor`, mesmo `.tag` que qualquer base usa) — sem
isso não dava para saber de relance quem mandou o pedido sem abrir
o detalhe. A aba **Pagos** (dentro de Reembolsos) mostra o mesmo
"resumo de pagos" (total do mês/ano + por base) que também aparece em
Caixa — duplicado de propósito: quem só quer saber "quanto já paguei"
não devia ter de trocar de aba.

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

## Entradas — dízimos, ofertas e outras receitas

Ao contrário dos reembolsos (que nascem noutra base), quem regista é
**sempre o próprio Financeiro** — nenhuma base tem esse dado. Duas
coleções (`lib/entradas.js`):

```js
bases/financeiro/entradas/{id}
  valor, fundo, metodo (dinheiro|mbway|transferencia), referencia?,
  fonteId?, fonteNome?,             // ligação a uma fonte fixa, opcional
  criadoPor, criadoEm

bases/financeiro/fontesEntrada/{id}
  nome, fundo, valorHabitual?, periodicidade (mensal|anual|pontual),
  ativo
```

`fundo` — os tipos de receita comuns numa igreja local (`FUNDOS` em
`lib/entradas.js`, mantido igual em `firestore.rules`):
`dizimo`, `oferta`, `oferta_especial` (campanha), `missoes`, `obras`,
`aluguel` (espaço alugado), `evento`, `outro`.

`fontesEntrada` é o equivalente, do lado da receita, de
`fornecedores` do lado da despesa — receita recorrente que não é
dízimo/oferta de culto (aluguel de uma sala, uma doação mensal já
combinada). Só pré-preenche o registo em `entradas` (botão "Registar"
na fonte abre o mesmo formulário, com fundo/valor já preenchidos);
a fonte em si nunca é uma entrada. "Excluir" é sempre `ativo:false`.

Um lançamento por fundo+método (não um total à mão) — é o que faz o
"total por método + por fundo" bater certo sem depender de texto
livre. Escrita direta do cliente, imutável (só `create`), corrige-se
com um lançamento novo. **Sem resumo por fundo/método na própria
aba** (decisão explícita — já existe em Início como gráfico, e
repetir como etiquetas soltas ao lado da lista de lançamentos era
redundante, reportado como ruído visual): a lista de "últimos
lançamentos" já mostra o fundo de cada um.

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

## Caixa — o extrato

Última aba de propósito (ver "As cinco abas" acima). Resumo de
**entradas, saídas e saldo do mês** logo no topo (o pedido era
explícito: "precisa ter um resumo de entradas e saídas e saldo, logo
no começo"), depois o histórico de reembolsos pagos por mês/ano e por
base (`.barra`/`.barra i`, mesmo padrão de barra de magnitude usada
no Início), e a exportação CSV do mês (sempre o mês corrente visível
— sem seletor de período por agora; se vier a fazer falta, portar).

## Valor de património nos equipamentos

Não é dado desta base — vive em
`bases/{tecnica|louvor}/inventario/{item}.valorCompra` e `.tipo`
(`criarEquipamento`/`guardarEquipamento`, `functions/index.js`), os
mesmos campos opcionais condicionais já usados pela fatura de compra.
`tipo` é `TIPOS_PATRIMONIO` (`packages/shared/src/lib/tiposPatrimonio.js`):
`equipamento` (técnico), `instrumento` (musical), `mobiliario`,
`outro` — o Início soma por **tipo**, não por base (só duas bases
hoje, a distinção por base dizia pouco; "equipamento" vs.
"instrumento" já separa Técnica de Louvor na prática, sem precisar
nomear a base). Item sem `tipo` definido cai em "outro" na soma.

## Início — a aba de abertura

Pedido explícito do dono do produto ("quero MUITO, isso é muito
importante, deixar até como Início isso") — painel geral com
gráficos simples e tabelas fáceis (`pages/Inicio.jsx`). Nada de
coleção própria: junta o que as outras abas já leem —

- **Por pagar agora** — o mesmo cartão `.destaque` azul que também
  aparece em Reembolsos (duplicado de propósito, mesma razão do
  "resumo de pagos" acima).
- **Entrou/Saiu do mês** — soma de `entradas` contra reembolsos pagos
  + `despesasFixas`.
- **Património** — soma de `valorCompra` de Técnica e Louvor, **por
  tipo**, via `obterPatrimonioBases` (`lib/relatorio.js`). Única
  leitura cross-base fora da collectionGroup de reembolsos:
  `bases/{b}/inventario` é fechado por `minhaBase(b)` nas rules (ao
  contrário de reembolsos, que já eram por documento) — sem atalho de
  regra possível aqui, por isso é uma Cloud Function com Admin SDK,
  mesmo molde do `escalasCrossBase` da Backstage. `BASES_PATRIMONIO`
  é uma lista fixa em código (`functions/index.js`) — uma base nova
  em modo património entra ali manualmente, o mesmo custo que já
  existe para `CATEGORIAS_DESPESA`.
- **Gasto por categoria** / **Entradas por fundo** — barras
  horizontais de um hue só (o mesmo componente `.barra`/`.barra i`
  que "Por base" em Caixa.jsx já usa), ano corrente, reembolsos pagos
  + despesasFixas categorizados de um lado, entradas do outro.
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
- Nenhum trigger de criação/edição/registo é um link de texto (`.cap`)
  — é sempre um `.btn` cheio, óbvio ao toque (reportado: "nem parece
  que dá pra clicar"). Vale para "+ Registar entrada", "+ Novo
  fornecedor" e qualquer botão equivalente que vier a seguir.

## Por fazer / débito consciente

- Sem push/email (nenhuma base tem — ver `MELHORIAS-ENTRE-BASES.md`).
  O aviso de "pago"/"devolvido" é só o cartão `.destaque` no Início
  de cada base, como o de "indeferido" já era.
- Sem orçamento mensal (decisão explícita — só se usa dinheiro quando
  precisa de algo, não há tecto a controlar) nem aprovação em dois
  níveis (também recusado).
