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

## O que a construção do Painel Pastoral fechou

O Painel Pastoral (`apps/pastoral`, 2026-09) é a última base e a
primeira que não produz nada — só lê o que as outras dez produzem.
Construí-la não portou funcionalidade nenhuma entre bases; o que fez
foi **usar quatro coisas que já estavam no repo à espera dela**, e
abrir uma que serve a todas. Registo aqui para nenhuma delas voltar a
parecer código morto:

- **`eventos/{e}/estatisticasCulto/registo`** estava `read, write:
  if false` para toda a gente, com o comentário *"arquivo para o
  futuro Painel do Pastor"*. Era gravado a cada culto finalizado ao
  vivo desde que a integração com o FreeShow existe, e nunca tinha
  sido lido por nada. A leitura abriu-se para a claim nova
  (`ve_tudo_pastoral`); a escrita continua só Admin SDK. As contas que
  `arquivarCultoTerminado` deixou por fazer de propósito (*"ficam para
  quando esse painel existir"*) são agora `resumirCulto`, em
  `functions/pastoral.js`.
- **A coleção global `contactos`** foi posta fora de `bases/` desde o
  início pelo mesmo motivo, e as regras obrigavam a Base Pessoal a
  criar sempre com `etapa: "visita"` porque *"o funil das etapas
  seguintes é só do painel do pastor"*. As outras cinco etapas nascem
  agora em `moverEtapaContacto`. **Nada do que já estava gravado
  precisou de migração** — era exatamente o que essa decisão comprava.
- **`origem: "manual"` em `eventos/{e}.ordem`** já era aceite por
  `publicarOrdemCulto` (a Backstage grava-o quando o analisador do PDF
  falha e o líder escreve tudo à mão). Por isso o compositor da ordem
  do culto do painel não precisou de uma Cloud Function nova nem de um
  campo novo: publica pela mesma função, com a mesma claim
  `pode_publicar_culto`, e **nenhuma das dez bases mudou uma linha**
  para saber ler uma ordem montada no painel. O PDF continua a ser o
  caminho da Backstage, intacto.
- **`claimsExtraDaBase`** absorveu a capacidade nova numa linha, como
  tinha sido desenhado para fazer. Quatro das cinco capacidades da
  base pastoral (`veEscalas`, `veReembolsos`, `culto.podePublicar`,
  `eventos.podeCriarGlobal`) já existiam e não foram tocadas.

E uma que passa a servir qualquer base:

- **Recado de uma base para outra** (`recados/{id}` +
  `packages/shared/src/lib/recados.js` +
  `components/RecadoPastoral.jsx`) — nasceu já partilhado porque é
  literalmente igual nas dez: chega, lê-se, dispensa-se. Duas linhas
  por app (`<RecadoPastoral papel={papel} />` no topo do `Inicio.jsx`).
  Hoje só o painel pastoral envia, mas **nada no modelo é específico
  dele**: o documento tem `baseId` de destino e autor, e a regra de
  leitura é `minhaBase(resource.data.baseId)`. Se um dia a Backstage
  precisar de mandar um aviso à Técnica, é a função de envio que ganha
  um caminho novo, não o componente. Cuidado ao reutilizar: **não é uma
  `solicitacao`** — não tem prazo, atribuição, transferência nem
  histórico de estados, e é isso que o mantém barato. Quem precisar de
  resposta e de estado deve portar `solicitacoes`, não isto.

## Por portar (identificado, ainda não feito)

- **O mapa de calor da acomodação, no Painel Pastoral**
  (`bases/pessoal/acomodacaoResumos`, 2026-09). Os resumos são
  gravados a cada culto com um comentário a dizer que são *"o que vai
  alimentar o mapa de calor do painel do pastor mais tarde"*
  (`ResumosAcomodacao.jsx`). O painel já existe desde 2026-09 e o mapa
  ainda não — é a peça mais óbvia a seguir, e a única das quatro
  "à espera do painel" que ficou por usar. Não precisa de Cloud
  Function nova: os resumos já estão numa coleção da Pessoal e o
  agregador `panoramaPastoral` já lê `bases/{b}/*` pelo Admin SDK.

- **Gráficos como componentes partilhados**
  (`apps/pastoral/src/components/LinhaTempo.jsx` e `Funil.jsx`,
  2026-09). São SVG à mão, sem biblioteca — ~30 pontos e uma polilinha
  não justificam 40 kB de dependência (mesmo raciocínio das notas e
  moedas em SVG do Financeiro). Ficam na app porque só ela tem
  gráficos hoje; o `Barras.jsx` do Financeiro já foi generalizado aqui
  (o `formatar` entra por prop, em vez de `eur` cravado) e essa versão
  é a que deve ir para `packages/shared` quando uma segunda base
  precisar. Três decisões a copiar em qualquer porte, e nenhuma é de
  gosto: **um eixo por gráfico** (duas escalas no mesmo plot inventam
  uma correlação que os dados não têm); **rampa de um tom só para
  categorias ordenadas** — o funil de seis etapas começou com seis
  cores e estava errado, é um caminho e não seis identidades, e em
  daltonismo seis tons viram seis cinzentos iguais; e **atraso é
  estado, não série**, por isso usa as cores `.oc-atraso-*` que a
  ordem do culto ao vivo já usava, com os mesmos limiares.

- **Registo/edição sem sessão nenhuma, por token no link** (Base
  Kinder, 2026-09 — `/registo` e `/familia/<token>`,
  `functions/kinder.js`). É o primeiro sítio do repo em que alguém
  sem conta escreve no Firestore por uma Cloud Function: token de 18
  bytes gerado no servidor, só o hash fica guardado, limite de
  pedidos por IP. Serve qualquer base que precise de um formulário
  público (o Formulário de contacto da Pessoal, por exemplo, ainda
  pede sessão de voluntário para o visitante nem chegar a preencher)
  — o padrão (token, hash, limite por IP, Cloud Function em vez de
  escrita direta) portava sem tocar em `familias`/`criancas`.
- **`SeletorCategoria` — dividir um menu inteiro por sub-grupo
  colorido** (Base Kinder, 2026-09, `src/components/SeletorCategoria.jsx`
  + `varsCategoria` em `lib/modelo.js`, variáveis CSS locais). Só a
  Kinder tem sub-grupos com cor própria hoje, mas o padrão (chips
  coloridos no topo do ecrã, sala/grupo por omissão = o da própria
  pessoa, líderes abrem em "Todas") serve qualquer base com
  subdivisões coloridas — a Técnica já tem cor por ministério
  (`corMinisterio`), só nunca precisou de um seletor a filtrar o
  ecrã inteiro por ela.
- **Lembrete de confirmação de presença perto do culto** (pedido do
  líder da Louvor, 2026-09). Hoje a confirmação de presença
  (`eventos/{e}/escalas/louvor/confirmacoes/{pessoaId}`, ver
  `apps/louvor/CLAUDE.md`) depende só de a pessoa abrir a app e ver o
  balão/popup — não há nenhum empurrão de fora. A ideia é notificar
  (push/email, quando essa infraestrutura existir — hoje não existe
  nenhuma, nem push nem email, em nenhuma base) quem ainda não
  confirmou, 1-2 dias antes do culto. **Combinado explicitamente para
  ficar parado até todas as bases estarem prontas** — não é para
  construir isto isolado só para a Louvor; espera o resto do produto
  amadurecer (e a confirmação de presença em si só existe na Louvor
  por agora, ver decisão da Apoio de não a ter).
- **O logo leva ao Início** (`apps/tecnica/src/pages/Sessao.jsx` e
  `apps/kinder/src/pages/Sessao.jsx`/`src/kiosk/KioskChamadas.jsx`,
  classes `.tec-logo-botao`/`.kin-logo-botao` — caminho atualizado
  2026-09 quando a Kinder ganhou Portal: a classe saiu do antigo
  `App.jsx` do kiosk para os dois sítios que hoje têm cabeçalho).
  O canto superior esquerdo é onde a mão vai por hábito, e não custa
  nada: envolver o `<span className="logo">` num `<button>` com
  `aria-label`, mais quatro linhas de CSS local a tirar a moldura de
  botão. Falta na Apoio, Backstage, Comunicação, Louvor e Pessoal —
  todas têm o mesmo cabeçalho e a mesma função `irPara`. **Não copiar
  o `font: inherit` do `.tec-logo-botao`**: o atalho `font` reescreve
  o `font-size: 19px` que vem de `.logo` no global.css (a regra local
  carrega depois, mesmo peso) e o logo encolhe para os 16px do body —
  medido, 22px→16px em ecrã largo. Chegam `background`, `border`,
  `padding` e `cursor`.

- **Avisos locais da ordem do culto: só o nome do evento**
  (`packages/shared/src/components/AvisosLocais.jsx` +
  `functions/ordemCultoPdf.js`). Já é partilhado, fica aqui só o
  porquê: o analisador procurava uma data em qualquer sítio da linha
  e usava o que estivesse à esquerda dela como nome. Numa grelha de
  seis colunas isso dava "CONF26 27" e engolia as linhas cuja coluna
  "Informações" não fosse DD/MM ("26/set", "No final do culto") —
  quatro avisos no PDF, um só na app. Agora o nome vem sempre da
  coluna "Evento", cortada pelo `x`: meio caminho entre o centro do
  rótulo "Evento" e o do rótulo "Informações". **Cortar no início do
  rótulo seguinte não chega** — as células vêm centradas, e um texto
  largo começa à esquerda de um rótulo curto. Qualquer base que leia
  grelhas de PDF deve copiar esta ideia, não a versão da data.

## Já portado

| Data | Nasceu em | O quê | Portado para | Nota |
|---|---|---|---|---|
| 2026-09 | Técnica | "Equipamentos" (Inventário em modo património) da Técnica reaproveitado sem tocar em nenhuma Cloud Function | Louvor (adaptação, não cópia direta) | `criarEquipamento`/`guardarEquipamento`/`desativarEquipamento` já eram 100% genéricas por `baseId` — a Louvor ganhou a mesma tela (`pages/Equipamentos.jsx`, classes `tec-*` renomeadas `lv-*` e portadas para `styles/louvor.css`) trocando só a fonte do agrupamento: em vez de `ouvirMinisterios` (coleção Firestore), passa uma constante fixa em código (`PAPEIS` em `lib/modelo.js`) — os cinco papéis da escala fazem de "ministério" para agrupar equipamento. Um porte deste tipo (papéis/categorias fixas, sem CRUD) é mais barato do que copiar o modelo `ministerios` inteiro; só compensa criar a coleção de verdade se a base precisar de líder a criar/editar categorias pela interface. |
| 2026-09 | Pessoal | Aba "Culto" com sub-abas (Ordem do culto/Feedbacks + uma terceira própria da base) | Louvor | A Louvor seguiu o mesmo padrão da Pessoal (embrulhar um ecrã que também existe como aba própria noutras bases, aqui "Equipamentos" da Técnica, com `ativo={false}` para não disputar o cabeçalho) em vez de recriar as quatro sub-abas da Pessoal — só Ordem/Equipamentos/Feedbacks, sem Contagem (específica do prédio) nem Inventário genérico. Confirma o que a nota da Pessoal já dizia: só compensa juntar sub-abas quando o menu principal está mesmo apertado. |
| 2026-09 | Técnica | Reordenar lista por setas ↑/↓ em vez de arrasto (`tec-ordem`, checklist da Técnica) | Louvor | O Repertório da Louvor pedia "arrasto" no documento original — usar setas por item em vez de uma biblioteca de drag-and-drop poupa uma dependência nova e funciona melhor a um polegar só. Candidato óbvio para qualquer lista reordenável futura (a própria checklist da Apoio ainda não tem reordenação nenhuma). |
| 2026-08 | Técnica | Botão "Gerar domingos do ano que vem" no Painel do Líder → Definições | Apoio | `gerarDomingos` já era uma Cloud Function partilhada (`functions/index.js`) — só faltava o botão. Mesmo padrão nas duas bases: mostra sempre "ano corrente + 1", chama `gerarDomingos(anoQueVem)`. |
| 2026-08 | Técnica | Navegação de mês sem ficar presa no ano (`mudarMes` com virada dezembro→janeiro, em `Sessao.jsx`/`PainelLider.jsx`/`Calendario.jsx`) | Apoio | Mesmo código, mesma correção: `ano` passou a `useState` com setter, e as setas ‹ › deixaram de ter `disabled` nos limites do mês. |
| 2026-08 | Técnica | **A data desaparecia nos cultos especiais** — `nomeEvento(ev)` em vez de `{ev.tipo \|\| dataPorExtenso(ev.data)}` | Apoio | O padrão mostra o nome do culto **ou** a data, nunca os dois: num domingo normal não há `tipo` e sai a data, por isso ninguém nota; num culto especial sai só "Culto de Natal" e o dia desaparece. Apanhado no Perfil da Técnica, estava em mais quatro sítios nas duas bases (Painel do líder → linha da escala, o `<h2>` da folha da escala, e o `SheetFuncao`). `nomeEvento` já existia em `packages/shared/src/lib/data.js` e faz exatamente isto. **Qualquer base nova copiada daqui já nasce corrigida** — foi por isso que se corrigiram as duas ao mesmo tempo em vez de só a que reportou. Cuidado ao portar: há cinco sítios com o mesmo padrão que **não** se mexem, porque a data já aparece na linha seguinte (`SheetResponderEnquete`, `SheetAbrirEnquete`, `Escala` das duas), e o `Montar.jsx` junta domingos com `.join(" · ")` — o mesmo separador do `nomeEvento`, o que tornaria a lista ambígua em vez de mais clara. A pergunta a fazer em cada sítio não é "usa o padrão?" mas "a data aparece em mais algum lado deste cartão?". |
| 2026-08 | Técnica | Enquete de indisponibilidade (`bases/{b}/enquetes/{AAAA-MM}` + respostas, `lib/enquetes.js`, `SheetAbrirEnquete`/`SheetResponderEnquete`, alerta no Início) | Backstage | Cloud Functions (`abrirEnquete`/`fecharEnquete`/`responderEnquete`/…) e as duas Sheets já eram 100% genéricas — nenhuma tocava em ministérios, só o ecrã "Montar" da Técnica é que agrupava respostas por ministério e trazia o Sugestor de escala em cima. A Backstage ganhou uma versão mais simples, `pages/Enquetes.jsx` (lista plana de respostas, com um "Montar escala" próprio — ver linha abaixo — em vez do Sugestor de ministérios). Se a Apoio pedir enquete um dia, é o mesmo porto. |
| 2026-08 | Técnica | Melhorias (`bases/{b}/melhorias`, 6 Cloud Functions — `abrirMelhoria`/`comentarMelhoria`/`definirEstadoMelhoria`/`definirPrevisao`/`resolverMelhoria`/`desativarMelhoria`) | Backstage | As Cloud Functions já eram 100% genéricas (`equipamentoId`/`ministerioId` sempre opcionais) — só faltava a UI. A Backstage ganhou uma aba própria dentro de Culto (`MelhoriasTab.jsx`), sem equipamento nem ministério ligados e sem "Transformar em artigo da Wiki" (não tem Wiki). Ativas com filtro de gravidade, resolvidas num grupo fechado no fim — mesmo espírito do ecrã da Técnica, sem a parte de equipamentos/ministérios, que é só dela. |
| 2026-08 | Backstage | "Montar escala" simplificado (sugestão de 1 pessoa por domingo a partir das respostas da enquete + `obterEstatisticasEscala`, sem sugestor de ministérios/lugares) | — | Nasceu já pensado para bases sem ministérios — qualquer base futura no mesmo molde (uma pessoa por culto, sem equipa) usa direto. Não serve à Técnica como está (ela precisa de preencher lugares por ministério, não sugerir uma pessoa só). |
| 2026-08 | Backstage | `escalasCrossBase` (Cloud Function, `functions/index.js`) — resolve nomes (e ministério, quando a escala é `lugares[]`) de qualquer base para um evento, sempre em tempo real via Admin SDK | — | Genérica desde o início: detecta sozinha se a escala da base é lista simples ou lugares por ministério. Qualquer base futura com a capacidade `veEscalas:"todas"` usa sem tocar na function. |
| 2026-08 | Pessoal | Inventário em modo consumível ganhou estado de stock por cor (esgotado/no mínimo/quase no mínimo — `estadoStock()` em `Inventario.jsx`) e uma "Lista de compras" nova (`bases/{b}/listasCompras/{id}`, Cloud Functions em `functions/index.js`): qualquer voluntário vê, acrescenta, ajusta quantidade e remove itens; fechar/enviar é só líder ou o líder de escala/responsável do culto de hoje; fechar já cria a lista seguinte, vazia; "Enviar para compras" abre o WhatsApp sem número fixo | Apoio | Backend (Cloud Functions e `firestore.rules`) já era genérico por `baseId` — a portagem foi só de frontend, ficheiro a ficheiro idêntico (`lib/inventario.js`, `Inventario.jsx`, `ListasComprasSalvas.jsx` novo, `SheetItemInventario.jsx` só ganhou o campo Observações). As categorias reais da Apoio (Utensílios/Produtos/Insumos/Decoração/Extras) não foram tocadas — só a Pessoal tinha categorias placeholder erradas para corrigir. Não serve à Técnica/Backstage tal como está: lá o inventário é modo património (itens individuais com estado, não quantidade em stock) — "esgotado" e "no mínimo" não fazem sentido para um projetor. |
| 2026-09 | Apoio | Campo de pagamento (MB Way/IBAN) obrigatório no pedido de reembolso, guardado uma vez em `pessoas/{uid}/privado/pagamento` e copiado para o pedido no envio (`normalizarDestino`/`mostrarDestino`, `lib/reembolsos.js`) + cartão `.destaque` no Início para "pago"/"devolvido" (antes só "indeferido") | Técnica, Backstage, Comunicação, New, Pessoal, Shift, Kinder, Louvor | `lib/reembolsos.js` e `pages/Reembolsos.jsx` eram byte-idênticos nas 9 bases (só Kinder/Louvor divergiam no `souLiderBase`, preservado) — cópia direta às 8. O cartão do Início divergia mais entre bases (variáveis intercaladas), portado sítio a sítio; Kinder nunca teve este cartão para o voluntário (só o de pendentes da líder) e ficou de fora, de propósito — não é omissão. Nasceu para o Painel Financeiro (`apps/financeiro`, ver linha abaixo). |

## Já é partilhado (nada a portar — mora em `packages/shared` ou nas Cloud Functions)

- **Cartão de culto na Escala** (`packages/shared/src/components/CartaoCulto.jsx` + `.cartaoculto`/`.cabtoque` em `global.css`) — nasceu na Técnica e foi partilhado logo a seguir, porque o problema era igual nas duas bases: a Escala mostrava todos os cultos do mês abertos, com toda a gente de cada um, e chegar ao último era rolar a página inteira. Agora é um cartão fechado por culto, e o mês cabe num ecrã. **Só a casca é partilhada** — cabeçalho, destaque, seta, corpo que abre. Quem serve, e como se descreve, entra por `children`: a Apoio tem `pessoas[]` com funções, a Técnica `lugares[]` com titular/aprendiz, e forçar as duas a caber numa só era espremer coisas genuinamente diferentes. Cada app passa o `resumo` que quiser ("Serves · Áudio" na Técnica, "Serves" na Apoio). Três decisões que uma base nova herda de graça: **a cor não é decoração** — quem serve fica a `--azul`, a mesma que `.tab td.mim` já usa para dizer "tu" na tabela da mesma tela (começou verde e estava errado: duas cores para a mesma ideia no mesmo ecrã); **os cultos passados apagam-se, barra incluída**, senão um domingo que já aconteceu rouba o olhar ao próximo; e **título e resumo empilhados**, porque o nome de um culto especial é texto livre do líder e lado a lado partia as duas colunas. Cuidado ao usar: se a base tiver navegação de fora para dentro (o calendário do Início), o foco tem de **abrir** o cartão além de fazer scroll — senão toca-se num dia e aterra-se num cartão fechado. E com o cartão fechado a data de um culto especial deixa de aparecer noutro sítio, por isso o componente põe-na no resumo — é a mesma armadilha registada na linha do `nomeEvento`, acima.
- **Compressão de fotos no upload** (`comprimirImagem`) — `packages/shared/src/lib/imagem.js`, todas as bases já usam.
- **Login único / troca de base** (`pessoas/{uid}` global, `trocarBase`, `procurarPessoaGlobal`) — `functions/index.js` + `packages/shared/src/lib/auth.js`, todas as bases já usam.
- **Dev em várias bases ao mesmo tempo** (`PORTAS_DEV` em `auth.js`, `server.port` em cada `vite.config.js`, CORS `localhost` em qualquer porta em `functions/index.js`) — cada app fica numa porta fixa (5173–5176) e o `trocarBase` em localhost navega para a porta da base de destino, no mesmo hostname (`localhost` ou `127.0.0.1`). Uma base nova só precisa da porta no `vite.config.js` e de uma linha no `PORTAS_DEV` (checklist no `CLAUDE.md` da raiz) — o CORS já cobre qualquer porta. **Só vale depois do deploy das functions** — o frontend local chama as functions de produção.
- **Quadradinho de cor antes de um nome** (`corMinisterio` em `LinhaPessoaContacto`) — o componente já é partilhado e aceita a prop em qualquer base; só é *usado* pela Técnica porque só ela tem ministérios com cor. Uma base futura com o mesmo conceito (subdivisões coloridas) usa de graça.
- **Foto redonda com toque para expandir** (`FotoRedonda.jsx`, novo em `packages/shared/src/components`) — generalizado do padrão já usado em `Bola.jsx` (Funções), agora reutilizável para qualquer foto avulsa (equipamentos, melhorias…). Qualquer base nova usa direto, sem duplicar a lógica de `useState` + `ImagemExpandida`.
- **`overflow-anchor: none` no `html`** (`global.css`) — sem isto, o "scroll anchoring" do navegador tenta manter o botão "Ver mais" na mesma posição do ecrã depois de a lista crescer, e a página salta sozinha para baixo (o utilizador vê o cabeçalho a fugir para cima em vez da lista a abrir no sítio). Reportado primeiro na Técnica, mas o mesmo bug já acontecia na Apoio — corrigido nas duas de uma vez só por estar no CSS partilhado.
- **Ligar voluntário já existente noutra base** (`SheetLigarPessoa.jsx` + `pessoasGlobais.js`, novo em `packages/shared`; Cloud Function `listarPessoasDaBase` em `functions/index.js`, que devolve só nome/foto de outra base, nunca telefone) — feito diretamente partilhado porque é o mesmo conceito de identidade global que já existia (`pessoaExistenteId` em `criarVoluntario`, `procurarPessoaGlobal`), só faltava a UI: "Novo voluntário" → "Já tem perfil noutra base?" → escolhe a base → escolhe a pessoa da lista → o resto do formulário (telefone, papel, ministérios) continua específico desta base. Ao guardar, `pessoas/{uid}.bases` ganha a nova base e o seletor de base em `MenuEu.jsx` (já em produção) passa a aparecer sozinho para essa pessoa.
- **Acesso de dev** (`entrarComoDev` em `functions/index.js`; `GatilhoDev.jsx` + `SheetAcessoDev.jsx`, novos em `packages/shared`; `scripts/definirSenhaDev.mjs`) — para quem constrói o sistema continuar a testar qualquer base sem depender do PIN de um líder (que muda assim que a base é entregue). Uma senha só, partilhada por todas as bases (`config/devAccess/privado/auth`, um hash scrypt só, não um por base) — 5 toques no logo "igrejaonda" do ecrã de entrada abrem a folha de senha. Entra com `papel:"lider_base"` da base tocada, mas como o uid fixo `"dev-admin"`, que nunca existe em `bases/{b}/pessoas`: não aparece em Voluntários, não pode ser escalado. Mesmo bloqueio de tentativas do PIN. Cada entrada fica registada em `logs/acessosDev`. **Uma base nova só precisa de embrulhar o logo do `Entrada.jsx` dela em `GatilhoDev`** (ver checklist "Ao criar uma base nova" no `CLAUDE.md` raiz) — a Cloud Function e a senha já servem, não há nada por base a configurar.
- **Excluir culto especial** (`SheetExcluirCulto.jsx`, agora em `packages/shared/src/components` — recebe `excluir` como prop em vez de importar a Cloud Function de uma app específica) — nasceu na Técnica (botão em `SheetEscalaMinisterios`), portado para a Apoio (botão equivalente em `SheetEscala.jsx`, condicionado a `evento.tipo` — nunca aparece num domingo). A Cloud Function `excluirCultoEspecial` já era partilhada; só faltava a UI. `obterEventosDoMes`/`ouvirEventosDoMes` da Apoio ganharam o filtro `ev.ativo !== false`, como já tinha a Técnica.
- **Indisponibilidade partilhada entre bases** (`eventos/{e}/indisponibilidades/{uid}`, helpers `basesDaPessoa`/`garantirSemConflitoCrossBase`/`marcarIndisponivel`/`desmarcarIndisponivel` em `functions/index.js`) — quem serve em mais do que uma base não fica escalado em nenhuma outra no mesmo culto: `guardarEscalaTecnica` e a nova `guardarEscalaApoio` (que também tirou a Apoio de escrever a escala direto do cliente, sem validação nenhuma — passou a Cloud Function como já era regra) checam e gravam a mesma subcoleção. **Já é genérico para N bases, não só duas** — a checagem procura "existe entrada de qualquer OUTRA base", nunca compara com uma base específica, e o nome no aviso de erro vem de `bases/{id}.nome` (sempre existe), não de uma lista fixa. Uma base nova só precisa da sua própria `guardarEscala<Base>` (cada uma tem o formato de escala dela) — a validação partilhada funciona sem tocar em nada. Só a escala publicada conta (não a enquete — cada um vota livremente em cada base, por decisão explícita). O motivo fica como string (`"escalado"` hoje) de propósito: quando a Apoio ganhar enquete própria (ainda por confirmar com o líder), essa função só chama o mesmo helper com `motivo:"votou"`, sem mexer em mais nada partilhado.
- **Tour de primeiro login** (`packages/shared/src/lib/TourContext.jsx` + `tour.js` + `procurarAlvoTour.js`, `packages/shared/src/components/Tour.jsx`, Cloud Function `marcarTourVisto` em `functions/index.js`) — motor 100% genérico, nasce já partilhado: o conteúdo de cada passo vive no Firestore (`bases/{baseId}/tour/config`, escrito por `scripts/seedTour.mjs`, sem tela de edição por agora — decisão do líder), o componente só sabe seguir `data-tour="..."` no DOM e navegar pela `pagina` de cada passo. Dispara automaticamente no primeiro login (recalculado a cada `onAuthStateChanged`, funciona também depois de `trocarBase`, sem depender de nenhuma das duas passar um sinal especial); "Rever tour" no `MenuEu.jsx` reabre sem marcar nada. Marcação "visto" fica em `pessoas/{uid}.tourVisto.{baseId}`, mesmo padrão de mapa por base que `bases` já usa. Passo aponta para um elemento que não existe (`data-tour` ausente naquela tela/base) → pula em silêncio, nunca quebra. Além de boas-vindas/escala/checklist/fechamento, o tour percorre cada botão do menu (`NavBar.jsx` marca todos com `data-tour="nav-<chave>"` automaticamente, sem precisar de tocar em cada tela) explicando o que cada aba faz. Apoio ficou com 8 passos + 1 extra de líder (sem indisponibilidade nem publicar, que não existem nela); Técnica com 9 + 2 extra completos. Uma base nova só precisa de um doc `tour/config` novo — zero código.
- **Cache do Firestore single-tab, com fallback pra memória sem IndexedDB** (`packages/shared/src/lib/firebase.js`) — bug pré-existente que travava a app inteira (sem erro visível) em navegação privada, onde a negociação entre abas do `persistentMultipleTabManager` pode nunca resolver; corrigido para todas as bases de uma vez só por estar no ficheiro partilhado.
- **Lint com as regras dos hooks** (`eslint.config.js` na raiz, `npm run lint`, `.github/workflows/lint.yml`) — nasce partilhado por obrigação: uma config só, na raiz, a cobrir `apps/*` e `packages/shared`. Existe por causa do ecrã branco de 15/08/2026 na Técnica (um `useMemo` abaixo de um `return null` no `Inicio.jsx` → erro React #310 → base inacessível, com o `vite build` a passar verde). A lição que serve qualquer base: **o build compila, não valida** — nem ordem de hooks, nem identificadores por definir. Bloqueiam `react-hooks/rules-of-hooks` e, desde 16/08/2026, `no-unused-vars` — as duas apps foram limpas primeiro (Técnica, Apoio) e só depois a regra passou de aviso a erro, para que a herança de uma base não travasse o PR de outra. É a ordem a repetir sempre: limpar cada base no PR dela, apertar a regra no fim. O `exhaustive-deps` fica em aviso, e o bloco Node também — falta lá uma ocorrência em `functions/index.js`, ficheiro que faz deploy sozinho ao entrar na `main` e por isso não anda à boleia de um PR de lint. **Armadilha que vale para qualquer base:** o `no-unused-vars` do ESLint não sabe ler JSX, e sem `react/jsx-uses-vars` acusa como não usado todo o componente que só aparece dentro de JSX — a primeira versão desta config dava 169 falsos positivos que quase passaram por código morto a limpar. Ligar esse plugin é obrigatório antes de acreditar num único número desta regra. O reporte de `eslint-disable` não usados também ficou desligado pela mesma razão: obrigava a mexer no código de outra base no mesmo commit que a config. Uma base nova entra sozinha, sem tocar na config — os `files` são `apps/*/src/**`, não uma lista de nomes. Para apertar regras só numa base, acrescentar um bloco no fim do `eslint.config.js` da raiz com `files: ["apps/<base>/src/**"]` — o ESLint 9 não faz cascata de configs por pasta, não adianta pôr um ficheiro dentro da app.
- **Líder muda a foto de qualquer voluntário da base** (`enviarFotoVoluntario` em `lib/painel.js` de cada app, `editarVoluntario` em `functions/index.js` ganhou o campo opcional `foto`) — a `storage.rules` já deixava o líder da base subir a foto de qualquer pessoa da base (`storage.rules:10-13`, nunca precisou de alteração); só faltava o botão em `SheetPessoa.jsx`, adicionado nas duas apps com o mesmo padrão visual de `Perfil.jsx` (avatar + "Trocar/Juntar foto" + "Remover"). Só aparece a editar um voluntário já existente (precisa do `pessoa.id` para o caminho no Storage) — na criação continua sem foto, como já era.

## Específico de uma base hoje — mas reutilizável no futuro

| Nasceu em | O quê | Estado |
|---|---|---|
| Técnica | Equipamentos em cartões que abrem, com as avarias primeiro (`apps/tecnica/src/pages/Equipamentos.jsx`, classes `.tec-equip*`) | Usa o `.cabtoque` partilhado, mas a **hierarquia** é que é a ideia a levar, não o CSS: o que está avariado vem primeiro e nasce aberto (é o que trava um culto), o catálogo vem fechado por subdivisão. E cada grupo mostra **tudo** o que é dele, avariados incluídos com etiqueta — antes o filtro era `estado === "ok"` e o item avariado sumia do grupo, por isso quem fosse ver "o que temos na projeção" recebia uma resposta incompleta. Não se portou para a Apoio porque o inventário dela é modo consumível (quantidade em stock, "abaixo do mínimo"), não património com estado por item — o conceito de "avariado primeiro" não existe lá. Uma base futura em modo património copia isto direto. |
| Técnica | Escala titular/aprendiz por ministério (`lugares[]` em `eventos/{e}/escalas/tecnica`, `guardarEscalaTecnica`) | Só a Técnica usa isto por agora — a Apoio não tem ministérios nem conceito de aprendiz, continua com a escala em lista simples. Mas o padrão (titular + aprendiz por subdivisão, "uma pessoa só num lugar por culto" validado no servidor) foi desenhado para servir qualquer base futura que tenha o mesmo formato de equipa. Quando isso acontecer: generalizar `guardarEscalaTecnica`/`SheetEscalaMinisterios` em vez de copiar e colar — hoje o nome e os campos já são genéricos o suficiente (`ministerioId`, não algo específico da Técnica). |
| Técnica | Filtro por ministério nas Checklists do Painel do Líder | Consequência direta do ponto acima — só faz sentido quando há mais do que um agrupamento. Vem de graça para qualquer base futura que herde o padrão de ministérios. |
| Técnica | Equipamentos em modo património (`criarEquipamento`/`guardarEquipamento`/`desativarEquipamento` na **mesma coleção** `bases/{b}/inventario` que a Apoio usa em modo consumível — nunca colidem, cada função só mexe na base de quem a chama) | A Apoio continua em modo consumível (stepper de quantidade, "abaixo do mínimo"). Uma base futura que precise de rastrear itens individuais (não uma quantidade em stock) usa este padrão direto, sem tocar nas funções da Apoio. |
| Técnica | Melhorias — tracker de avarias/sugestões com linha do tempo, gravidade, previsão e "Transformar em artigo da Wiki" (`bases/{b}/melhorias`, 6 Cloud Functions). O campo "meta" (data-limite imutável) foi removido depois do primeiro uso real — só sobrou confusão com a Previsão; ficou só a Previsão, editável por qualquer voluntário a qualquer momento. | Não depende de ministérios nem de equipamentos — `equipamentoId`/`ministerioId` são opcionais no modelo. Qualquer base futura (com ou sem equipamentos, com ou sem ministérios) pode reaproveitar tal e qual — já sem o campo meta, que se provou desnecessário. |
| Backstage | `horaPrevista` opcional em `bases/{b}/funcoes/{id}` — quando pelo menos uma função da fase tem hora, a checklist do Início ordena por hora em vez de por nome de quem está atribuído (`ordenarPorAtribuicao` em `Inicio.jsx`) | Pensado desde o início para qualquer base — o campo é só mais um dado da função, `undefined` nas outras não muda nada (comportamento de hoje intacto). A Técnica é a candidata óbvia se uma fase (ex.: montagem de som) crescer a ponto de precisar de sequência, não só de agrupamento por ministério. |
| 2026-08 | Backstage | Nível titular/aprendiz **por pessoa**, não por ministério: `bases/{b}/pessoas/{id}.nivel` (`"titular"`\|`"aprendiz"`), com "aprendiz nunca serve sozinho" validado em `guardarEscalaBackstage` (não só no cliente) | Técnica (adaptação, não cópia direta) | A Técnica já tem titular/aprendiz, mas pendurado no ministério (`pessoa.ministerios.audio = "titular"`), porque lá o par é sempre dentro do mesmo lugar operacional. A Backstage não tem ministérios — por isso o campo é flat, direto na pessoa, e o par titular+aprendiz é do culto inteiro, não de um lugar. Se uma base futura tiver a mesma forma (equipa única, sem lugares/ministérios) mas quiser níveis, este é o padrão a copiar, não o da Técnica. `SheetEscala.jsx` (Backstage): tocar num titular substitui o titular atual (e tira o aprendiz, que não pode ficar sozinho); tocar num aprendiz junta-o ao titular já escolhido, ou bloqueia com aviso se ainda não houver titular. "Montar escala" das enquetes (preenchimento rápido de 1 nome por domingo) só sugere titulares — escalar um aprendiz exige o `SheetEscala.jsx` completo, onde o par faz sentido. |
| 2026-08 | Pessoal | Contagem do culto em `eventos/{e}/contagem/geral`, com nove categorias independentes, campo opcional, autoria e origem por categoria | — | Específica hoje porque a Base Pessoal é quem conta o público do prédio. O modelo e os controlos rápidos são reutilizáveis por uma base futura que precise de números operacionais por culto, mas não devem ser portados às outras só para criar um “total”: as categorias não somam entre si e cada uma tem semântica própria. As salas (`new`, `shift`, `juniorFun`, `baby`) começam com origem `manual` e podem passar a `automatica` sem migração quando existirem os respetivos painéis. |
| 2026-09 | Pessoal | Correção da data de um mapa do auditório (`corrigirDataMapaAcomodacao` + botão “Corrigir data”) | — | Específico do módulo de Acomodação: move os lugares preenchidos para outro culto real, reinicia a data de origem e nunca sobrescreve um mapa ou resumo existente. Para uma data passada, fecha o mapa e calcula o resumo no histórico. Uma base futura que use exatamente o mesmo modelo de lugares por culto pode reaproveitar o fluxo, mas não faz sentido nas bases sem mapa de auditório. |
| 2026-08 | Pessoal | Aba "Culto" que agrupa em subabas tudo o que gira à volta do próprio domingo — Ordem do culto, Inventário e Contagem (`pages/Culto.jsx`) — em vez de cada um ter aba própria no menu principal | Apoio, Técnica, Backstage, Comunicação (adaptação, não cópia direta) | Pedido explícito do dono do produto: menu principal mais curto. As outras bases hoje têm "Culto" (só Ordem do culto/Feedbacks) e "Inventário" como abas separadas — juntar exigiria decidir se cabe Feedbacks também, e cada base tem menos abas para começar (a Pessoal tinha 6, por isso sentia mais a falta). Não portar às cegas: só faz sentido se o menu de uma base concreta estiver mesmo apertado. Os componentes internos (`OrdemCultoCard`/`OrdemCultoTimeline`/`SheetRevisaoOrdem`, `Inventario.jsx`) não mudaram nada — continuam genéricos, só a casca que os embrulha é que é nova. |
| 2026-09 | Financeiro | Contagem de dinheiro nota a nota (`lib/oferta.js` + `components/DinheiroEuro.jsx`): tudo em **cêntimos inteiros**, notas/moedas desenhadas em SVG pela cor real de cada denominação, campo numérico direto com −/+ só para ajuste fino | — | Específico do Financeiro hoje, mas as duas decisões viajam para qualquer ecrã que conte dinheiro: (1) **nunca guardar dinheiro em vírgula flutuante** — `0.1 + 0.2` dá `0.30000000000000004` e uma contagem que não fecha ao cêntimo não serve; (2) desenhar a denominação em SVG em vez de fotografar — as imagens do BCE têm regras de reprodução próprias e pesam mais que a app, e o que a mão reconhece é a cor, não o retrato. O contra-exemplo a evitar: stepper só com botões, que obrigaria a 37 toques para 37 moedas de 10 cêntimos. |
| 2026-09 | Financeiro | **Corte de âmbito**: caixa (saldo entradas−saídas), entradas por fundo, fornecedores/despesas fixas, fontes fixas de receita e soma de património cross-base saíram todos da app, semanas depois de entrarem | — | Registo honesto de que se construiu a mais: o painel cresceu de "pagar reembolsos" para "contabilidade da igreja" sem ninguém ter pedido a segunda coisa, e o dono do produto mandou cortar. A lição para as outras bases é a de sempre neste repo — uma funcionalidade nova precisa de um pedido, não de uma dedução lógica de que "faz sentido a seguir". As coleções ficaram no Firestore (nada se apaga, regra 5) mas sem regras nem UI; `obterPatrimonioBases` foi removida das functions. |
| 2026-09 | Financeiro | Cada página de aba passa a exigir um prop `ativo` (`pagina === "<chave>"`) e só recalcula o cabeçalho quando ele é verdadeiro | — | As abas do Financeiro ficam sempre montadas (`display:none`, preserva filtro/scroll ao trocar), o que significa que o `useEffect` de `definirCabecalho` de cada uma só corria uma vez, no arranque — trocar de aba não atualizava o `<h1>`. Qualquer base que use o mesmo padrão de "abas sempre montadas" (em vez de montar/desmontar) tem o mesmo risco; o gate por `ativo` é o conserto genérico. |
| 2026-09 | Financeiro | Todo `Sheet*` termina com um botão "Cancelar"/"Fechar" explícito, mesmo quando já tem uma ação primária | — | Regra que já existia informalmente (`SheetEquipamento` da Técnica/Louvor sempre teve) mas não tinha sido copiada para os sheets novos do Financeiro — reportado como bug ("não tem o botão de fechar"). Vale para qualquer sheet novo em qualquer base: o véu (tocar fora) nunca é a única saída. |
| 2026-09 | Financeiro | Relatório geral (`pages/Relatorio.jsx`) — painel de abertura com barras de magnitude (um hue só, reaproveitando `.barra`/`.barra i`) e uma tabela simples, sem coleção própria: junta o que as outras abas já liam. `obterPatrimonioBases` lê `bases/{b}/inventario` de Técnica/Louvor por Admin SDK (a única leitura cross-base fechada por `minhaBase`, ao contrário dos reembolsos que já eram por documento) | — | Confirma a nota deixada na linha da claim `ve_todos_reembolsos` acima: quando é preciso juntar dados de coleções fechadas por `minhaBase` (não por documento), o molde a copiar é o `escalasCrossBase` — uma Cloud Function com Admin SDK, gate pela mesma claim, sem abrir a regra do Firestore a mais ninguém. Útil para qualquer painel futuro que precise somar algo fechado de várias bases sem expor a coleção inteira. |
| 2026-09 | Técnica | Valor de compra opcional no equipamento (`valorCompra`, `criarEquipamento`/`guardarEquipamento`), mesmo campo condicional que a fatura já usava | Louvor | Portado direto — as duas já partilhavam a mesma coleção `bases/{b}/inventario` em modo património e as mesmas Cloud Functions. Serve só o futuro Relatório do Financeiro somar o património de cada base; Comunicação usa `equipamentos` (custódia, não inventário) e Apoio/Pessoal são modo consumível, por isso não se aplica às três. |
| 2026-09 | Financeiro | Fornecedores e despesas fixas (`bases/financeiro/fornecedores`, `bases/financeiro/despesasFixas`, `lib/fornecedores.js`) — gastos recorrentes (renda, subscrições, contratos) que não nascem de um pedido de reembolso de nenhuma base, escritos direto do cliente (sem Cloud Function: é dado só desta base, sem autoria mista, mesmo padrão de `funcoes`/`avisos`) | — | Específico do Financeiro hoje — nenhuma outra base tem despesa própria a lançar, só reembolsos de voluntários. `despesasFixas` é histórico imutável (`create` apenas), como `inventario/movimentos`. Se uma base futura vier a precisar de registar gasto direto (não via reembolso), o padrão é este: coleção `fornecedores` (catálogo, `ativo:false` para "excluir") + coleção irmã de lançamentos, nunca a mesma coleção. |
| 2026-09 | Financeiro | Capacidade de base "vê tudo de X entre bases" generalizada pela segunda vez: `bases/{b}.veReembolsos === "todas"` → claim `ve_todos_reembolsos` (`claimsExtraDaBase`), mesmo molde de `veEscalas`/`ve_todas_escalas` que a Backstage já usava, agora aplicado a reembolsos em vez de escalas | — | Confirma que o padrão (capacidade da BASE, não da pessoa; lida uma vez no token; nunca do Firestore direto) generaliza bem para qualquer "ver X de todas as bases" — a próxima seria `veInventario`/`veMelhorias` se algum dia fizer sentido um painel cross-base de manutenção. A leitura em si usa `collectionGroup` + uma regra `match /{path=**}/reembolsos/{r}`, diferente do `escalasCrossBase` (Cloud Function, Admin SDK) — aqui compensou mais manter o `onSnapshot` ao vivo do que ganhar a agregação server-side, porque a caixa de entrada do Financeiro precisa de atualizar sozinha quando uma líder aprova um pedido. Se um dia precisar de juntar dados de coleções fechadas por `minhaBase` (não é o caso dos reembolsos, que já eram por documento), o molde a copiar é o `escalasCrossBase`, não este. |

| 2026-09 | Todas (9) + Financeiro | Funil da fatura EM PAPEL, à parte da foto: o voluntário declara no formulário se já a entregou em mãos ao líder (`fatura.comLider`, obrigatório), o líder declara ao aprovar se já a passou ao Financeiro ou se a leva no próximo culto (`fatura.paraFinanceiro`), e o Financeiro confere pedido a pedido (`fatura.recebida`, via `marcarFaturaFisica`). Enquanto o líder não a tiver, o voluntário vê o estado "Ag. fatura física" em vez de "À espera do líder" | Já partilhado — entrou nas 9 bases de uma vez | Nasceu partilhado porque `lib/reembolsos.js` e `pages/Reembolsos.jsx` são (quase) idênticos nas 9 bases: a mesma correção teve de ser aplicada 9 vezes à mão, e é o melhor argumento que existe para um dia isto subir a `packages/shared` — o que só não se fez agora porque mexer no partilhado é PR à parte (ver `verificar:isolamento`). O mapa `fatura` é criado por notação de ponto (`"fatura.comLider": true`) nas aprovações, por isso os pedidos antigos, sem o mapa, continuam a funcionar: `fatura` a faltar lê-se como "sem informação", nunca como "por entregar". A base nova que copiar o módulo de reembolsos leva o funil junto, sem trabalho extra. |

## Buracos fechados ao construir a Backstage

Não são "melhorias entre bases" no sentido de portar funcionalidade —
são três coisas que já existiam abertas a mais do que a base dona, e
só apareceram porque a Backstage precisava de capacidades que exigiam
olhar para elas com cuidado. Registo aqui para não parecerem
decisões novas se alguém for procurar o porquê:

- **`eventos/{e}/escalas/{base}`** lia `allow read: if autenticado()`
  — qualquer pessoa logada, de qualquer base, já lia a escala de
  qualquer outra. Fechado para `minhaBase(base) || ve_todas_escalas`
  (a capacidade nova da Backstage). `bases/{base}` continua aberto —
  é só nome/cor/horário, nunca foi o problema.
- **Ordem do culto** (`publicarOrdemCulto`/`lerOrdemCulto`/
  `limparOrdemCulto`, mais a `storage.rules` do `ordem.pdf`) só
  verificava `papel==lider_base`, sem checar a base — qualquer líder
  (Apoio ou Técnica) já podia publicar/apagar a ordem do culto da
  igreja toda. Fechado por `pode_publicar_culto` (claim vinda de
  `bases/{b}.culto.podePublicar`, hoje só a Backstage).
- **`criarCultoEspecial`** tinha o mesmo padrão — qualquer líder criava
  um evento global (ex.: "Culto de Mulheres" da Apoio). Aqui a
  correção teve um efeito colateral visível e combinado com o líder:
  `escopo:"global"` passou a exigir `pode_criar_evento_global` (só a
  Backstage); Apoio e Técnica passaram a criar os próprios cultos
  especiais como `escopo:"base"` — visíveis só à base que os cria a
  partir de agora (filtrado no cliente; ver nota em
  `visivelParaBase`, `lib/painel.js` — as rules não conseguem esconder
  isto de uma query de intervalo de datas sem quebrar o calendário de
  toda a gente, é filtro de interface, não sigilo a sério).

## A avaliar quando a próxima base começar

- **Wiki** (já construída para a Técnica: artigos + dúvidas por ministério, busca por índice client-side, tudo via Cloud Function por causa da autoria mista): o conceito de "base de conhecimento com esqueletos criados pelo líder, qualquer voluntário escreve, e busca sem full-text no Firestore via `wikiIndice/{base}`" é genérico o suficiente para qualquer base que precise disto — só a segmentação por *ministério* é específica da Técnica. Quando outra base pedir algo parecido, portar a estrutura toda (`bases/{base}/wiki/{id}`, `wikiIndice/{base}`, as 7 Cloud Functions em `functions/index.js`) e trocar "ministérios" pelo que for a subdivisão daquela base (ou tirar a subdivisão de vez, se ela não tiver nenhuma).
- **Wiki: navegar em vez de procurar** (`apps/tecnica/src/lib/wikiGrupos.js` + o layout da `Wiki.jsx`): a lista corrida foi substituída por grupos que se abrem, por ordem alfabética, e o convite a perguntar desceu do topo para o fim da página. O problema que resolve não é da Técnica — é de qualquer base de conhecimento: **a barra de pesquisa só serve quem já sabe a palavra que o documento usa**. Quem chega com "a projeção não dá imagem" não adivinha que o artigo se chama "Ligar o ProPresenter ao segundo ecrã", e sai de mãos a abanar. A ordem alfabética é deliberada (não é por data): o valor está em cada coisa estar sempre no mesmo sítio. Duas decisões que qualquer porte deve copiar: os grupos vêm da coleção de subdivisões e não de uma lista fixa de nomes (uma subdivisão nova entra sozinha), e existe sempre um grupo "Geral" a apanhar o que não tem subdivisão **e o que aponta para uma subdivisão desativada** — sem ele, desativar uma subdivisão faz desaparecer da Wiki tudo o que estava lá dentro, sem erro e sem aviso. A função de agrupar é pura e sem Firestore, por isso verifica-se com um `node` e dados inventados. Numa base sem subdivisões, o mesmo layout funciona agrupando pelo que ela tiver (etiqueta, tipo) — o que não se deve fazer é voltar à lista única.
- **Dúvidas sem resposta chegam ao líder** (`Inicio.jsx` + `PainelLider.jsx` da Técnica): a `criarDuvida` sempre publicou a dúvida de imediato, visível a todos e respondível por qualquer voluntário — e continua assim, de propósito, porque é o que faz com que quem sabe responda sem esperar pelo líder. O que faltava era o líder **saber que elas existem**: sem isso, só dava com elas por acaso a navegar na Wiki, e uma dúvida sem resposta é um guia que nunca chega a ser escrito. Agora aparecem como alerta no Início (só para o líder da base) e como lista no bloco Wiki do Painel, mais antigas primeiro, com atalho direto para a dúvida — de onde o botão "Transformar em artigo" (que já existia) fica a um toque. **Nada disto tocou em Cloud Functions nem em regras**: é tudo leitura do `wikiIndice/{base}` que já era carregado nas duas telas. Qualquer base com o módulo de Wiki ganha isto copiando ~15 linhas; a alternativa que foi ponderada e recusada — fila de revisão privada, em que só o líder vê a dúvida — obrigava a mexer na `criarDuvida` e nas `firestore.rules` (partilhado, deploy automático) e matava a entreajuda.
