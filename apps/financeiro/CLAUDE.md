# Financeiro — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é — e o que deliberadamente NÃO é

A única base sem equipa de culto. Faz **duas coisas, e só duas**:

1. **Pagar os reembolsos** que as outras bases aprovam — fecha o ciclo
   que elas começam (`apps/*/src/pages/Reembolsos.jsx` leva o pedido
   até "aprovado pelo líder"; aqui vira "pago" ou "devolvido").
2. **Contar a oferta** do culto, nota a nota e moeda a moeda.

Mais os relatórios que saem dessas duas coisas.

**Isto NÃO é um sistema de contabilidade da igreja.** Em 2026-09 esta
app chegou a ter caixa (saldo entradas−saídas), registo de dízimos e
ofertas por fundo, catálogo de fornecedores com despesas fixas, fontes
fixas de receita e soma de património das outras bases — tudo isso foi
**removido a pedido do dono do produto**, que achou o painel a crescer
para fora do que precisa. Não voltes a acrescentar nada disso sem ele
pedir explicitamente: as coleções `entradas`, `fontesEntrada`,
`fornecedores` e `despesasFixas` deixaram de ter regras no
`firestore.rules` e a Cloud Function `obterPatrimonioBases` foi
apagada (ver `git log` se precisares do código).

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

## As quatro abas

| Aba | Ficheiro | O que é |
|---|---|---|
| **Início** | `pages/Inicio.jsx` | O que está à espera de alguém + resumo curto |
| **Reembolsos** | `pages/Reembolsos.jsx` | A fila de pagamento, com filtros |
| **Oferta** | `pages/Oferta.jsx` | A contagem do culto |
| **Relatórios** | `pages/Relatorios.jsx` | Histórico completo, filtros e gráficos |

Perfil não é aba — entra-se tocando na foto (mesmo padrão do "Ver
perfil" do `MenuEu` das outras bases).

**Início responde "tenho alguma coisa para tratar?", Relatórios
responde "quanto foi para quê".** Se uma coisa nova não cabe numa
dessas duas perguntas, provavelmente não pertence a esta app.

As quatro ficam **sempre montadas** (`display:none` no lugar de
desmontar, em `Sessao.jsx`) — preserva filtro e posição de scroll ao
trocar de aba. Por causa disso, cada página só recalcula o cabeçalho
(`definirCabecalho`) quando recebe o prop **`ativo` = verdadeiro**
(`pagina === "<chave>"`, passado por `Sessao.jsx`): sem esse gate, o
efeito de cada página corria só uma vez, no arranque da app, e o
título parava de seguir a navegação — foi um bug reportado. Qualquer
página nova aqui **tem de** receber `ativo` e usá-lo assim:

```jsx
useEffect(() => {
  if (!ativo) return;
  definirCabecalho({ titulo: ..., subtitulo: ..., chips: [...] });
}, [ativo, definirCabecalho, /* ...o resto que o título usa */]);
```

## Todo sheet tem um botão de fechar

Regra sem exceção nesta app (reportada como bug: um popup sem saída
visível, que só fechava tocando fora): todo componente `Sheet*` acaba
com um `<button className="btn sec full" onClick={onFechar}>` —
"Fechar" ou "Cancelar" —, **mesmo** quando já existe uma ação
primária. O véu (`<div className="veu" onClick={onFechar}>`) continua
a existir, mas nunca é a única saída.

## Vocabulário

| Termo | O que é |
|---|---|
| **Aprovado** | O líder da base já decidiu que o pedido é válido — é o que entra na fila do Financeiro |
| **Pago** | O Financeiro já transferiu/pagou por MB Way |
| **Devolvido** | O Financeiro encontrou um problema (fatura ilegível, falta o NIF) e mandou de volta ao líder — volta a ser decisão dele, aprovar de novo ou indeferir |
| **Lote** | Vários pedidos pagos de uma vez, tipicamente todos os de uma mesma pessoa |
| **Contagem** | Um culto contado: quantas notas e moedas de cada, e o total |

Não digas "indeferido" aqui — indeferir é sempre do líder da base, o
Financeiro só paga ou devolve.

## Reembolsos

Não tem coleção própria de reembolsos — lê `bases/*/reembolsos` de
TODAS as bases por `collectionGroup` (`lib/reembolsosFinanceiro.js`),
autorizado pelo bloco `match /{path=**}/reembolsos/{r}` em
`firestore.rules`, guardado por `vejoTodosReembolsos()`. Ver
`functions/index.js`: `marcarReembolsosPagos` (lote) e
`devolverReembolso` são as únicas duas escritas — nunca escrita
direta do cliente, porque mexem em dinheiro e cruzam bases (regra 3
do `CLAUDE.md` raiz).

Filtros: estado (Por pagar / Pagos / Devolvidos) em chips, mais dois
seletores — **base** e **categoria de despesa**. As bases do seletor
saem do que há na lista, não das 9 fixas: filtrar por uma base que
nunca pediu nada só daria lista vazia. Cada linha leva uma etiqueta
colorida com o nome da base (cor de `bases/{id}.cor`) — sem isso não
dá para saber de relance quem mandou o pedido.

### Onde a pessoa recebe (IBAN/MB Way)

Cada reembolso já chega com `pagamento: {metodo, destino}` — uma
CÓPIA do que a pessoa tinha guardado em
`pessoas/{uid}/privado/pagamento` no momento em que submeteu o
pedido (ver `apps/*/src/lib/reembolsos.js`, `criarReembolso`). Esta
app nunca lê `privado/pagamento` diretamente — só vê a cópia que já
veio no pedido, e é o que aparece em `SheetDetalheReembolso`.
Continua certo mesmo que a pessoa mude de banco depois de já ter
sido paga uma vez.

## Oferta — a contagem do culto

```js
bases/financeiro/contagensOferta/{id}
  data: "2026-09-20"                       // o culto; o mesmo id de eventos/{AAAA-MM-DD}
  notas:  { "50000": 0, "20000": 1, ... }  // denominação em cêntimos → quantidade
  moedas: { "200": 4, "100": 10, ... }
  totalNotas, totalMoedas, total           // tudo em CÊNTIMOS
  observacao, contadoPor, contadoEm
```

**Tudo em cêntimos, inteiros, do princípio ao fim** (`lib/oferta.js`).
Somar `0.1 + 0.2` em vírgula flutuante dá `0.30000000000000004`, e uma
contagem de dinheiro que não fecha ao cêntimo não serve para nada. Só
na apresentação é que se divide por 100 (`emEuros`).

As notas e moedas são **desenhadas em SVG**
(`components/DinheiroEuro.jsx`), não fotografadas: as imagens reais
são do Banco Central Europeu, têm regras próprias de reprodução e
pesariam mais do que a app inteira. O que interessa é o sinal — a cor
de cada nota (cinza 5, vermelho 10, azul 20, laranja 50, verde 100,
amarelo 200, roxo 500) e o metal de cada moeda (ouro nórdico, cobre, e
as duas bimetálicas ao contrário uma da outra) são o que a mão já
conhece de contar dinheiro a sério. A moeda leva só o número lá
dentro: o "c"/"€" por cima do algarismo fica ilegível a 32px, e o
rótulo ao lado já diz "50 cênt." por extenso.

O campo aceita **escrever o número direto** (teclado numérico); os
botões −/+ são só para o ajuste fino. Contar 37 moedas de 10 cêntimos
a tocar 37 vezes no "+" seria absurdo.

Ao contrário dos pagamentos já feitos (imutáveis), **uma contagem pode
ser corrigida por cima**: contar mal acontece, e obrigar a criar uma
segunda contagem do mesmo culto só faria o histórico mentir. Tocar
numa contagem antiga carrega-a no formulário. Nunca se apaga (regra 5
do `CLAUDE.md` raiz).

## Relatórios

Filtro de período (mês / ano / tudo) e, a partir dele: totais de
reembolso e de oferta, dias médios entre o pedido e o pagamento,
barras por categoria e por base, oferta por mês, tabela mês a mês,
detalhe linha a linha e exportação CSV.

As barras são um componente só (`components/Barras.jsx`), partilhado
com o Início: magnitude, um hue só, ordenadas de maior para menor.
`cor` por linha só se usa quando a cor JÁ significa alguma coisa (a
cor da base, que o resto da app usa para a mesma base) — para
categorias ou meses não há cor própria nenhuma, e aí fica tudo a azul.

## Nomes e cores de outras bases

`bases/{id}` é público a qualquer pessoa autenticada (ver
`firestore.rules`) — `lib/bases.js` lê a coleção toda uma vez para
etiquetar cada pedido com o nome e a cor certos. Nunca lê
`bases/{id}/pessoas` de outra base — isso continua fechado; o nome de
quem pediu vem gravado no próprio reembolso (`pessoaNome`,
denormalizado no `criarReembolso`).

## Detalhes já decididos

- **Nunca escrevas o nome do responsável financeiro na interface**
  (mesma regra da Apoio) — o cartão de aviso no Início das outras
  bases diz só "O Financeiro", nunca um nome.
- Devolver é diferente de indeferir: estado próprio (`devolvido`),
  nunca um regresso a `submetido` — ver o comentário em
  `devolverReembolso`, `functions/index.js`.
- O pagamento em lote agrupa por pessoa (uma transferência com todos
  os pedidos dela), não por base.
- Nenhum trigger de criação/registo é um link de texto (`.cap`) — é
  sempre um `.btn` cheio, óbvio ao toque (reportado: "nem parece que
  dá pra clicar").
- Todo aviso no Início leva ao sítio onde se resolve: um aviso que não
  tem atalho obriga a procurar o ecrã certo à mão.

## Por fazer / débito consciente

- Sem push/email (nenhuma base tem — ver `MELHORIAS-ENTRE-BASES.md`).
  O aviso de "pago"/"devolvido" é só o cartão `.destaque` no Início
  de cada base, como o de "indeferido" já era.
- A contagem da oferta não está ligada a `eventos/{AAAA-MM-DD}` por
  chave estrangeira — guarda só a data em texto, no mesmo formato. Se
  um dia fizer falta cruzar com o culto a sério (tipo de culto, nome),
  é aí que se liga.
