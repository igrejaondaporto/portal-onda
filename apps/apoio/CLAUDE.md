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

Em produção em `apoio.painelonda.pt`. O protótipo original
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
