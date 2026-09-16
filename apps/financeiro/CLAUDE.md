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
líder — nenhum desses conceitos existe aqui. Duas abas só: **Por
pagar** e **Dinheiro**, mais Perfil (login/PIN, igual a qualquer
base).

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
- Sem categorias de despesa nem orçamento por base — ver o mockup e a
  conversa que motivou esta app para o resto do plano (v2/v3).
