# Backstage — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A base que cuida do funcionamento do culto: faz o pré-culto acontecer,
sobe a ordem do culto que o pastor manda por PDF, passa as
informações a limpo. Molde Apoio — equipa única, sem ministérios,
sem níveis, sem aprendiz.

Duas coisas moldam o desenho:

- **Não existe coordenador fixo.** Quem serve no domingo coordena. O
  líder da base gere pessoas, funções e dados — como na Apoio — mas o
  trabalho de domingo é do voluntário escalado. As capacidades novas
  desta base (ver todas as escalas, publicar a ordem do culto) são da
  **base**, não do papel `lider_base` — o que mostram vive na Home de
  qualquer voluntário, não atrás do PIN de líder.
- **A comunicação ao vivo não entra no sistema.** Usam rádio — mais
  rápido. Não há chat nem módulo de pedidos aqui. O painel substitui
  mensagem estruturada (o PDF, notas), nunca conversa.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em construção em `back.painelonda.pt`. Ponto de partida: cópia
literal de `apps/apoio` (mesmo padrão usado para a Técnica), mais o
módulo de enquetes de indisponibilidade portado de `apps/tecnica`
(a Apoio ainda não tem esse módulo).

## Vocabulário — mesmo da Apoio

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo. Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa |
| **Culto** | O evento |

Não digas "líder do dia", "tarefa", "turno" nem "evento" na interface.

## O que é só desta base

- **`bases/backstage.veEscalas = "todas"`** — a Backstage lê a
  escala de qualquer base (segmento `Minha base | Todas as bases` no
  ecrã Escala), só leitura, só de escalas publicadas. Sem progresso,
  checklist ou presença de outras bases — se precisa saber se outra
  base terminou, pergunta presencialmente.
- **`bases/backstage.culto.podePublicar = true`** — só esta base tem
  o botão de subir o PDF da ordem do culto e o editor de notas
  (`eventos/{e}.notas`). Apoio e Técnica continuam a ler a mesma
  ordem, já não publicam.
- **`bases/backstage.eventos.podeCriarGlobal = true`** — só o líder
  desta base cria eventos fora de domingo com `escopo:"global"`
  (pensado para incluir uma capacidade `admin_igreja` mais tarde, sem
  mexer nas regras outra vez). Qualquer líder de qualquer base
  continua a poder criar `escopo:"base"`, só para a própria base.
- **`horaPrevista` nas funções** (`bases/backstage/funcoes/{id}`,
  opcional): quando presente, a checklist da fase ordena pela hora,
  como linha do tempo, em vez de por nome. Só nesta base — nas outras
  o campo fica `undefined`, comportamento igual ao de hoje.

## Detalhes decididos, iguais à Apoio

- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- Funções feitas descem para o fim da lista (mesmo com `horaPrevista`).
- O nome do líder é sempre uma variável. Nunca um nome fixo no código.

## Não construir nesta base

- Módulo de pedidos do pastor, chat ou mensagens — é rádio.
- Progresso, checklist ou presença de outras bases em "Todas as bases".
- Ministérios, níveis ou aprendiz.
- Wiki e Melhorias, por agora.
