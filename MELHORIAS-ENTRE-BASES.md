# Melhorias entre bases

Registo de toda funcionalidade ou correção construída para **uma**
base, com uma avaliação honesta de se serve às outras — já
construídas ou futuras. Não é para copiar cegamente: cada base tem o
seu `CLAUDE.md` porque é genuinamente diferente da outra; isto aqui é
só para não perder de vista o que **é** genérico e ficou parado numa
base só por termos começado por ela.

Regra: sempre que uma funcionalidade nova (ou correção) for
implementada numa base, antes de a dar por terminada, acrescenta uma
linha aqui. Se for óbvio que só serve àquela base (o modelo de
ministérios da Técnica, por exemplo), diz isso e porquê — não é
esquecimento, é registo.

## Por portar (identificado, ainda não feito)

| Data | Nasceu em | O quê | Onde falta | Porquê serve lá também |
|---|---|---|---|---|
| 2026-08 | Técnica | Botão "Gerar domingos do ano que vem" no Painel do Líder → Definições | Apoio | `gerarDomingos` já é uma Cloud Function partilhada (`functions/index.js`), sempre foi — só nunca teve botão nenhum em lado nenhum. A Apoio tem exatamente o mesmo problema em janeiro de 2027: sem alguém correr isto manualmente no Firestore, os domingos do ano novo não existem. |
| 2026-08 | Técnica | Navegação de mês sem ficar presa no ano (`mudarMes` com virada dezembro→janeiro, em `Sessao.jsx`/`PainelLider.jsx`/`Calendario.jsx`) | Apoio | A Apoio tem a mesma estrutura de `useState(hoje.getFullYear())` sem setter — em dezembro de 2026 ela vai ter o mesmo bug: nenhuma seta leva a janeiro de 2027, mesmo que os domingos já existam. |

## Já é partilhado (nada a portar — mora em `packages/shared` ou nas Cloud Functions)

- **Compressão de fotos no upload** (`comprimirImagem`) — `packages/shared/src/lib/imagem.js`, todas as bases já usam.
- **Login único / troca de base** (`pessoas/{uid}` global, `trocarBase`, `procurarPessoaGlobal`) — `functions/index.js` + `packages/shared/src/lib/auth.js`, todas as bases já usam.
- **Quadradinho de cor antes de um nome** (`corMinisterio` em `LinhaPessoaContacto`) — o componente já é partilhado e aceita a prop em qualquer base; só é *usado* pela Técnica porque só ela tem ministérios com cor. Uma base futura com o mesmo conceito (subdivisões coloridas) usa de graça.

## Específico de uma base — avaliado e descartado para as outras

| Nasceu em | O quê | Porque não serve à Apoio |
|---|---|---|
| Técnica | Escala titular/aprendiz por ministério (`lugares[]`) | A Apoio não tem ministérios nem conceito de aprendiz — a escala dela é uma lista simples de pessoas por função, e é assim que deve continuar. |
| Técnica | Filtro por ministério nas Checklists do Painel do Líder | Consequência direta do ponto acima — só existe a necessidade de filtrar quando há mais de um agrupamento (ministério). A Apoio tem poucas funções e um catálogo só. |

## A avaliar quando a próxima base começar

- **Wiki** (em construção agora para a Técnica: artigos + dúvidas por ministério, busca por índice client-side): o conceito de "base de conhecimento com esqueletos criados pelo líder e busca sem full-text no Firestore" é genérico o suficiente para qualquer base que precise disto — só a segmentação por *ministério* é específica da Técnica. Quando outra base pedir algo parecido, portar a estrutura toda (`wiki/{id}`, `wikiIndice/{base}`, o padrão de índice) e trocar "ministérios" pelo que for a subdivisão daquela base (ou tirar a subdivisão de vez, se ela não tiver nenhuma).
