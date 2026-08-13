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

| Nasceu em | O quê | Nota |
|---|---|---|
| Técnica | Excluir culto especial (`excluirCultoEspecial` em `functions/index.js` — desativa com `ativo:false`, nunca apaga; recusa domingos, só cultos criados por `criarCultoEspecial`; botão "Excluir este culto" em `SheetEscalaMinisterios` → `SheetExcluirCulto`) | A Cloud Function já é partilhada e serve as duas bases sem alteração nenhuma — falta só a Apoio ganhar o mesmo botão/sheet no seu `PainelLider.jsx` (ela já tem `criarCultoEspecial`/`SheetNovoCulto`, só falta o par). `obterEventosDoMes`/`ouvirEventosDoMes` da Apoio também precisam do filtro `ev.ativo !== false`, como foi feito em `apps/tecnica/src/lib/painel.js`. |

## Já portado

| Data | Nasceu em | O quê | Portado para | Nota |
|---|---|---|---|---|
| 2026-08 | Técnica | Botão "Gerar domingos do ano que vem" no Painel do Líder → Definições | Apoio | `gerarDomingos` já era uma Cloud Function partilhada (`functions/index.js`) — só faltava o botão. Mesmo padrão nas duas bases: mostra sempre "ano corrente + 1", chama `gerarDomingos(anoQueVem)`. |
| 2026-08 | Técnica | Navegação de mês sem ficar presa no ano (`mudarMes` com virada dezembro→janeiro, em `Sessao.jsx`/`PainelLider.jsx`/`Calendario.jsx`) | Apoio | Mesmo código, mesma correção: `ano` passou a `useState` com setter, e as setas ‹ › deixaram de ter `disabled` nos limites do mês. |

## Já é partilhado (nada a portar — mora em `packages/shared` ou nas Cloud Functions)

- **Compressão de fotos no upload** (`comprimirImagem`) — `packages/shared/src/lib/imagem.js`, todas as bases já usam.
- **Login único / troca de base** (`pessoas/{uid}` global, `trocarBase`, `procurarPessoaGlobal`) — `functions/index.js` + `packages/shared/src/lib/auth.js`, todas as bases já usam.
- **Quadradinho de cor antes de um nome** (`corMinisterio` em `LinhaPessoaContacto`) — o componente já é partilhado e aceita a prop em qualquer base; só é *usado* pela Técnica porque só ela tem ministérios com cor. Uma base futura com o mesmo conceito (subdivisões coloridas) usa de graça.
- **Foto redonda com toque para expandir** (`FotoRedonda.jsx`, novo em `packages/shared/src/components`) — generalizado do padrão já usado em `Bola.jsx` (Funções), agora reutilizável para qualquer foto avulsa (equipamentos, melhorias…). Qualquer base nova usa direto, sem duplicar a lógica de `useState` + `ImagemExpandida`.
- **`overflow-anchor: none` no `html`** (`global.css`) — sem isto, o "scroll anchoring" do navegador tenta manter o botão "Ver mais" na mesma posição do ecrã depois de a lista crescer, e a página salta sozinha para baixo (o utilizador vê o cabeçalho a fugir para cima em vez da lista a abrir no sítio). Reportado primeiro na Técnica, mas o mesmo bug já acontecia na Apoio — corrigido nas duas de uma vez só por estar no CSS partilhado.
- **Ligar voluntário já existente noutra base** (`SheetLigarPessoa.jsx` + `pessoasGlobais.js`, novo em `packages/shared`; Cloud Function `listarPessoasDaBase` em `functions/index.js`, que devolve só nome/foto de outra base, nunca telefone) — feito diretamente partilhado porque é o mesmo conceito de identidade global que já existia (`pessoaExistenteId` em `criarVoluntario`, `procurarPessoaGlobal`), só faltava a UI: "Novo voluntário" → "Já tem perfil noutra base?" → escolhe a base → escolhe a pessoa da lista → o resto do formulário (telefone, papel, ministérios) continua específico desta base. Ao guardar, `pessoas/{uid}.bases` ganha a nova base e o seletor de base em `MenuEu.jsx` (já em produção) passa a aparecer sozinho para essa pessoa.

## Específico de uma base hoje — mas reutilizável no futuro

| Nasceu em | O quê | Estado |
|---|---|---|
| Técnica | Escala titular/aprendiz por ministério (`lugares[]` em `eventos/{e}/escalas/tecnica`, `guardarEscalaTecnica`) | Só a Técnica usa isto por agora — a Apoio não tem ministérios nem conceito de aprendiz, continua com a escala em lista simples. Mas o padrão (titular + aprendiz por subdivisão, "uma pessoa só num lugar por culto" validado no servidor) foi desenhado para servir qualquer base futura que tenha o mesmo formato de equipa. Quando isso acontecer: generalizar `guardarEscalaTecnica`/`SheetEscalaMinisterios` em vez de copiar e colar — hoje o nome e os campos já são genéricos o suficiente (`ministerioId`, não algo específico da Técnica). |
| Técnica | Filtro por ministério nas Checklists do Painel do Líder | Consequência direta do ponto acima — só faz sentido quando há mais do que um agrupamento. Vem de graça para qualquer base futura que herde o padrão de ministérios. |
| Técnica | Equipamentos em modo património (`criarEquipamento`/`guardarEquipamento`/`desativarEquipamento` na **mesma coleção** `bases/{b}/inventario` que a Apoio usa em modo consumível — nunca colidem, cada função só mexe na base de quem a chama) | A Apoio continua em modo consumível (stepper de quantidade, "abaixo do mínimo"). Uma base futura que precise de rastrear itens individuais (não uma quantidade em stock) usa este padrão direto, sem tocar nas funções da Apoio. |
| Técnica | Melhorias — tracker de avarias/sugestões com linha do tempo, gravidade, previsão e "Transformar em artigo da Wiki" (`bases/{b}/melhorias`, 6 Cloud Functions). O campo "meta" (data-limite imutável) foi removido depois do primeiro uso real — só sobrou confusão com a Previsão; ficou só a Previsão, editável por qualquer voluntário a qualquer momento. | Não depende de ministérios nem de equipamentos — `equipamentoId`/`ministerioId` são opcionais no modelo. Qualquer base futura (com ou sem equipamentos, com ou sem ministérios) pode reaproveitar tal e qual — já sem o campo meta, que se provou desnecessário. |

## A avaliar quando a próxima base começar

- **Wiki** (já construída para a Técnica: artigos + dúvidas por ministério, busca por índice client-side, tudo via Cloud Function por causa da autoria mista): o conceito de "base de conhecimento com esqueletos criados pelo líder, qualquer voluntário escreve, e busca sem full-text no Firestore via `wikiIndice/{base}`" é genérico o suficiente para qualquer base que precise disto — só a segmentação por *ministério* é específica da Técnica. Quando outra base pedir algo parecido, portar a estrutura toda (`bases/{base}/wiki/{id}`, `wikiIndice/{base}`, as 7 Cloud Functions em `functions/index.js`) e trocar "ministérios" pelo que for a subdivisão daquela base (ou tirar a subdivisão de vez, se ela não tiver nenhuma).
