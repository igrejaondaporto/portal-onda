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

## Uma armadilha encontrada ao construir o Painel Pastoral: duas telas, a mesma claim, o mesmo documento

Registo à parte, porque é um padrão que qualquer base futura com uma
capacidade "cross-base" pode repetir sem querer. `publicarOrdemCulto`
dá a claim `pode_publicar_culto` a quem a tiver — hoje a Backstage, e
quase a Pastoral também — e a função **substitui o campo inteiro**
(`eventos/{e}.ordem = {...}`), sem merge por secção. Isso é seguro
enquanto só uma base publica; deixa de ser no dia em que uma segunda
tela ganha a mesma claim: a segunda a publicar apaga o que a primeira
tinha posto, sem aviso nenhum. Foi encontrado a testar (2026-09-20): o
conteúdo que a Backstage tinha subido por PDF desapareceu depois de
mexer na aba nova do painel.

A correção não foi mudar `publicarOrdemCulto` para fazer merge (isso
resolveria "apagar tudo" mas não "duas fontes de verdade a decidir a
mesma ordem ao mesmo tempo", que é o problema a sério) — foi manter a
tela nova pronta mas **desligada** até haver uma decisão explícita de
qual caminho fica ativo: `bases/pastoral.culto.podePublicar = false`
por omissão (`scripts/seedPastoral.mjs`), e o próprio
`podePublicarCulto` (a claim que já protege a função no servidor) a
decidir do lado do cliente se a tela mostra o formulário ou uma
explicação (`apps/pastoral/src/pages/Ordem.jsx`). Nenhuma flag nova:
reutilizar o sinal que já existia em vez de inventar um `ativo:
true/false` a mais para alguém esquecer de verificar num sítio.

A pergunta a fazer sempre que uma capacidade nova (`ve_algo_todas`,
`pode_algo`) for concedida a uma segunda base: **o que ela escreve é
um campo que se soma, ou um documento que se substitui?** Se for
substituição — como esta, como qualquer `.set(..., {merge:true})` com
um objeto aninhado inteiro — duas fontes com a mesma claim têm de se
coordenar por fora do código (uma decisão de produto, um interruptor),
nunca só por "as duas sabem escrever lá".

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

## Notificações push — a infraestrutura que faltava ao produto inteiro

2026-09. Até aqui **nenhuma base tinha push nem email**, e isso estava
escrito em três sítios do repo como razão para não fazer outras
coisas. Três funcionalidades estavam explicitamente paradas à espera
disto, e as três saíram do papel no mesmo dia:

- **O lembrete de confirmação de presença da Louvor** (pedido do líder
  em 2026-09, "combinado explicitamente para ficar parado até todas as
  bases estarem prontas"). É agora `lembrarConfirmacaoPresenca` — corre
  uma vez por dia e avisa quem serve daqui a dois dias e ainda não
  confirmou. Só a Louvor por agora, porque só ela tem confirmação de
  presença; `BASES_COM_CONFIRMACAO` é uma constante de um elemento à
  espera da segunda.
- **O aviso de reembolso pago/devolvido** (débito registado no
  `CLAUDE.md` do Financeiro). É `notificarReembolso`. O cartão
  `.destaque` no Início **fica** — não é redundância, é o caminho para
  quem não ligou notificações.
- **O recado do pastor**, construído umas horas antes e já a nascer com
  um aviso a dizer que ninguém era notificado. É `notificarRecado`.

Mais um quarto gatilho que ninguém tinha pedido mas que é o mais óbvio
assim que existe canal: **entraste na escala** (`notificarEscala`).

Cinco decisões a conhecer antes de lhe mexer:

- **Payload só de `data`, nunca `notification`.** Com o bloco
  `notification`, o browser desenha a notificação sozinho **e** chama o
  handler do service worker — a pessoa recebe duas. É o erro mais fácil
  de cometer aqui e o mais difícil de diagnosticar.
- **Um service worker, não dois.** O handler de fundo
  (`push-sw.js`, gerado por `scripts/gerar-push-sw.mjs`) é *importado*
  pelo service worker do PWA via `workbox.importScripts`. Registar um
  segundo no mesmo âmbito substituiria o primeiro — e o que se perdia
  era a atualização automática da app.
- **No iPhone só funciona com a app instalada** no ecrã principal. Um
  site em separador nunca recebe push no Safari, e o
  `Notification.permission` mente, devolvendo `"default"` como se
  valesse a pena pedir. `suportado()` distingue o caso para a interface
  poder dizer "instala primeiro" em vez de mostrar um botão morto.
- **Notificar só quem entrou, nunca a escala toda.** O líder mexe na
  escala várias vezes até a fechar; avisar toda a gente a cada gravação
  seria a forma mais rápida de a equipa desligar as notificações no
  primeiro mês.
- **Tokens mortos apagam-se na resposta do envio.** Um token de quem
  desinstalou a app falha para sempre se ninguém o limpar, a somar
  latência a cada envio.

**Continua sem email.** O push cobre quem tem a app instalada; um canal
de email precisa de um fornecedor e de uma conta — é uma decisão com
custo, não uma linha de código. Se um dia existir, o sítio para o pôr é
o `notificar()` de `functions/notificacoes.js`, que já é o único ponto
por onde tudo passa.

## Retenção RGPD, em código

2026-09. Os prazos estavam no `CLAUDE.md` da raiz desde o início
("operacional 2 meses, reembolsos 5 anos, voluntários inativos 1 ano")
e só a Kinder os cumpria a sério. As outras nove acumulavam — o que é
pior do que não ter política, porque a política escrita cria a
expectativa de que é cumprida.

`functions/retencao.js` aplica os três. A decisão de desenho que o
resolve sem partir a regra 5 do `CLAUDE.md` ("nada é apagado, é
desativado"): **anonimiza-se a pessoa, não se apaga o registo.** Sai o
que identifica (telefone, foto, PIN, IBAN); fica o documento e o
`nome`, porque as escalas passadas apontam para aquele uid e apagá-lo
deixaria dois anos de domingos com buracos.

Três travões, e nenhum é opcional: **multi-base** (uma pessoa inativa
numa base mas ativa noutra nunca é tocada — `pessoas/{uid}` e o PIN
são globais), **data de referência explícita** (sem data fiável não se
toca, a dúvida nunca resolve a favor de apagar), e **rasto**
(`logs/retencao`, porque uma purga silenciosa é indistinguível de um
bug que apagou dados). Há um `ensaiarRetencao` que diz o que ia apagar
sem apagar nada — é por aí que se começa antes de confiar nisto.

## Por portar (identificado, ainda não feito)

- **A roda do rato muda números em silêncio** (`apps/tecnica/src/lib/campos.js`,
  `largarAoRodar`). Num computador, rodar por cima de um
  `<input type="number">` com foco muda o valor em vez de rolar — o
  Júlio escreveu 17 no dia de um culto especial, rodou para chegar ao
  botão, e o culto foi criado a 16. Reproduzido com roda real pelo
  DevTools Protocol. Nos reembolsos é pior: "25,00" vira "24,99". A
  correção é uma linha por campo, `onWheel={largarAoRodar}` (tira o
  foco, a roda volta a rolar, o valor fica). Na Técnica estão os 5
  campos corrigidos. **Falta nas outras**: Apoio 7, Pessoal 8,
  Backstage 5, New 5, SHIFT 5, Comunicação 3, Louvor 3 (contagem de
  `type="number"` a 2026-09-21). Candidato a ir para `packages/shared`
  se aparecer numa quarta base.
- **Editar a escala onde ela se vê, e limpar o mês inteiro**
  (`apps/tecnica/src/pages/Escala.jsx`). O líder via a tabela do mês na
  aba Escala mas só a podia corrigir pelo Painel do líder, três toques
  mais longe — e é a olhar para a tabela que ele percebe que está
  errada. Agora cada cartão de culto tem "Editar escala" (a MESMA folha
  do Painel, para não haver dois editores a divergir) e, por baixo da
  tabela, "Limpar a escala de <mês>" com confirmação. Limpar percorre
  os cultos do mês e chama a função de guardar com `lugares: []` — a
  permissão e a validação são as mesmas de guardar à mão, e os cultos
  ficam de pé. Nasceu de uma escala de exemplo que sobrou nos dados com
  a enquete ainda aberta. Qualquer base com escala por mês tem o mesmo
  problema no dia em que montar a escala cedo demais.

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

- **Contacto (telefone) nunca dentro do documento partilhável — só
  buscado na hora, por quem pede** (Mural Onda, 2026-09,
  `pedirContactoAnuncio`/`telefoneDoAutor` em `functions/mural.js`).
  O anúncio é lido por qualquer pessoa autenticada; gravar o telefone
  lá dentro abria o número a toda a gente, mesmo sem clicar em nada.
  Em vez disso, o botão "Falar no WhatsApp" chama uma Cloud Function
  que só devolve o número na hora, para quem já entrou. Serve
  qualquer base que precise de "ligar a alguém" sem expor o contacto
  em bruto num documento de leitura larga — hoje `nomesDePessoas`
  (index.js) já não devolve o telefone a quem não tem
  `ve_todas_escalas`, o mesmo raciocínio, este é o caso de "qualquer
  pessoa, não só quem tem uma claim elevada".
- **Entrada por telemóvel + PIN, sem base nenhuma** (Mural Onda,
  2026-09, `pedirEntradaMural`/`entrarMural`/`registarMural`,
  `functions/mural.js`). Identidade global (`pessoas/tel_<telefone>`)
  para quem nunca foi voluntário — sem passar por `criarVoluntario`
  nem por nenhuma base. Serve qualquer produto futuro que precise de
  login da igreja toda (não de uma equipa), como o Formulário de
  contacto da Pessoal citava como exemplo já antes disto existir. Não
  portado ainda porque a Pessoal continua a pedir sessão de voluntário
  antes do visitante preencher (ver `apps/pessoal/CLAUDE.md`,
  "Fronteiras") — portar é trocar essa exigência por este caminho.

- **Armadilha para o próximo app sem `VITE_BASE_ID` fixo**: vários
  componentes de `packages/shared` (`SheetPin.jsx`, `MenuEu.jsx`,
  `SheetAcessoDev.jsx`) importam de `"../lib/auth"` — um caminho
  RELATIVO AO PRÓPRIO FICHEIRO, que por isso resolve sempre para
  `packages/shared/src/lib/auth.js`, nunca para o `lib/auth.js` de
  quem os usa. Nas apps de base isso não se nota, porque cada uma só
  entra na sua própria base (`VITE_BASE_ID` fixo) e o `entrarComPin`
  partilhado já faz a coisa certa sozinho. O Mural (2026-09) apanhou
  o oposto: PIN certo a parecer errado, porque a chamada ia sempre
  com `baseId: "mural"` (que não existe) em vez da base escolhida no
  ecrã — ver `apps/mural/src/components/adaptados/LEIA-ME.md`. Regra
  para o próximo app que precise de decidir a base em tempo de
  execução (não fixa por `.env`): nunca reaproveitar `SheetPin`/
  `MenuEu`/`SheetAcessoDev` diretamente — copiar para
  `adaptados/` como o Mural fez, ou (melhor, se compensar mexer no
  partilhado) mudar esses três componentes para receberem
  `entrarComPin` por prop em vez de o importarem.

## Já portado

| Data | Nasceu em | O quê | Portado para | Nota |
|---|---|---|---|---|
| 2026-09 | Louvor | A app inteira (biblioteca, versões, histórico de tons, repertório, escala por papéis, rascunho, enquete, confirmação de presença) copiada para uma base nova, o Louvor Kinder (`apps/louvorkinder`) | Louvor Kinder | Base própria em vez de secção dentro da Louvor: o isolamento (biblioteca infantil que nunca se mistura com a da Onda) sai das regras genéricas `bases/{base}/...` + `minhaBase`, sem claim nova. As Cloud Functions são as mesmas (já liam o `baseId` do token) — só os papéis da escala passaram a ser por base (`ESCALA_LOUVOR_POR_BASE`, `functions/index.js`), e o cliente trocou os `"lead"` escritos à mão por `PAPEL_LEAD`/`PAPEIS_VOCAL` (`lib/modelo.js`). **São agora duas cópias da mesma app: uma correção na app da Louvor tem de ser avaliada para o Louvor Kinder, e vice-versa.** Se a Louvor passar a usar `PAPEL_LEAD`/`PAPEIS_VOCAL` também, as duas ficam mais fáceis de manter iguais. |
| 2026-09 | Louvor Kinder | Importador do LouveApp (`scripts/importarLouveAppLouvor.mjs`) por base (`--base=`), com o cabeçalho legível do export novo, durações `m:ss`, e capa do Deezer só com título+artista a bater (cai na busca simples quando a avançada vem vazia; recusa faixas de ruído/instrumental/playback) | Louvor | Já partilhado — é o mesmo script. A Louvor ganha a capa mais segura numa próxima importação (antes caía no primeiro resultado do Deezer às cegas). As classificações são por base: `POR_BASE` no script tem de bater com `CLASSIFICACOES` de cada app. |
| 2026-09 | Louvor Kinder | Na Biblioteca, o "+ repertório" de cada música vira ✓ quando ela já está no repertório do próximo culto, e tocar tira (com confirmação); "Tirar do repertório" também no detalhe (`removerMusicaDoRepertorio`, `lib/repertorio.js`) | Louvor | **Portar** — a app da Louvor tem o mesmo "+" sem volta atrás; a cópia é direta (mesmos ficheiros). |
| 2026-09 | Louvor Kinder | A mesma pessoa em dois papéis no mesmo culto (`variosPapeisPorPessoa`, `functions/index.js`; `pessoasEscaladas`, `lib/modelo.js`) | Louvor | Específico desta base por agora — na Louvor adulta "uma pessoa, um papel" é regra de propósito. Se a Louvor quiser, é pôr a flag na entrada `louvor` do mapa e copiar `SheetEscala.jsx`/`pessoasEscaladas`. |
| 2026-09 | Louvor | Os papéis da escala (Lead, Guitarra, Bateria…) deixaram de ser lista fixa em código — passaram a `bases/{base}/definicoes/papeisEscala` (`{lista:[{id,nome,emoji,cor,ativo}]}`), editável em Definições da base → Papéis da escala (`SecaoPapeisEscala.jsx`, `PapeisEscalaContext.jsx`), validado no servidor por `papeisValidosDaBase` (`functions/index.js`, `ESCALA_LOUVOR_POR_BASE.<base>.papeisEditaveis`) | Louvor Kinder, Técnica (ministérios) | **A previsão da linha "Equipamentos" logo abaixo já dizia isto**: "só compensa criar a coleção de verdade se a base precisar de líder a criar/editar categorias pela interface" — foi o que o líder pediu. "Remover" é sempre `ativo:false` (regra 5), nunca some de escalas/equipamento já existentes, só deixa de ser oferecido para o futuro. O id nasce do nome e nunca muda — é o que fica gravado em `escalados[].papel`/`instrumentos[]`, por isso editar nome/emoji/cor é seguro. Qualquer base com um catálogo fixo do mesmo formato (papel/categoria com nome+emoji+cor, referenciado por id noutros documentos) porta isto copiando `SecaoPapeisEscala.jsx` + `PapeisEscalaContext.jsx` + `papeisValidosDaBase`, trocando só o caminho do doc e os campos do formulário. |
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

- **Os textos de WhatsApp da enquete são do líder**
  (`lib/mensagensEnquete.js`, `lib/useMensagensEnquete.js`,
  `components/SheetEditarMensagem.jsx`, `components/EditarMensagemEnquete.jsx`).
  O texto ao grupo e o "Lembrar" individual eram frases fixas dentro do
  código de cada base — oito cópias, iguais exceto o endereço no fim.
  Agora guardam-se **por base**, em `bases/{base}/definicoes/
  mensagensEnquete` (`{ enquete, lembrete }`), e o líder escreve-os num
  editor com pré-visualização. Como o texto muda todos os meses (os
  meses, os prazos), guarda-se o MODELO, com marcas `{meses}`,
  `{prazos}` e `{nome}` que o portal preenche na hora de enviar; os
  botões "+ Mês", "+ Prazo", "+ Nome" inserem-nas, porque escrever
  chavetas num telemóvel é penoso. Uma marca inventada (`{mes}`)
  bloqueia o guardar — senão o grupo inteiro recebia "{mes}" à letra.
  `null` num campo = texto de fábrica, e é isso que se grava quando o
  líder volta ao original, para as melhorias futuras do texto de
  fábrica lhe chegarem sozinhas. **Sem Cloud Function e sem regras
  novas:** `definicoes/{doc}` já deixava o líder de qualquer base
  escrever direto. O texto de fábrica passou a viver num só sítio e foi
  comparado byte a byte com o antigo de cada base (8 bases × 4 casos,
  nenhuma diferença) — `npm run teste:mensagens` guarda-o.
  **Ligado em 6 bases:** Técnica, Apoio, Pessoal, Backstage, Louvor e
  Comunicação (esta só tem o texto do grupo — não tem "Lembrar"
  individual, e não se inventou um). **New e SHIFT** não têm ecrã de
  líder para a enquete, por isso nada se ligou; mas a função antiga
  continua lá, morta, e diz "apoio.igrejaonda.pt" em vez do endereço da
  própria base. Quando ganharem esse ecrã, usar este módulo e apagar
  a cópia. O endereço do texto de fábrica vem agora de
  `window.location.hostname` (`dominioDaBase`), não escrito à mão — foi
  assim que essas duas ficaram com o endereço errado.

- **"Painel do voluntário": o líder vê o que a equipa vê**
  (`MenuEu.jsx`, `BarraVistaVoluntario.jsx`, `SheetEscolherVista.jsx`).
  Não é papel novo nem login falso: o token continua a ser o do líder
  e o servidor também o trata como líder — o que muda é o `papel` que
  desce para as telas (`papelEfetivo`), e com ele todos os botões que
  só o líder tem, mais os separadores dele. A saída vive numa faixa
  fixa, porque dentro da vista o menu do perfil passa a ser o de um
  voluntário e deixaria o líder sem caminho de volta.
  **Nas bases com ministérios** (hoje a Técnica) escolhe-se qual antes
  de entrar, e o Início passa a montar a checklist desse ministério em
  vez da que vem da escala — ver o parâmetro `ministerioFingido` em
  `funcoesDosMeusMinisterios`; `null` é uma escolha válida ("sem
  ministério", o painel de quem não serve), por isso o desligado é
  `undefined`. **Fica de fora** o Financeiro, a Pastoral e o Mural:
  não têm `MenuEu` nem voluntários — toda a gente lá é líder.

- **Computador: menu lateral + coluna central** (`global.css`, bloco
  `@media (min-width: 900px)`, mais o logo dentro do `NavBar.jsx`).
  Nasceu na Técnica a 2026-09-21 e passou ao partilhado dois dias
  depois, quando o líder pediu o mesmo em todas as bases. A barra de
  baixo e o menu lateral são o MESMO elemento, só redesenhado: nenhuma
  app escreve uma linha para o ter, e o tour continua a apontar aos
  mesmos `data-tour`. O `.duas` deixou de ser duas colunas no
  computador — o pedido foi manter o que o telemóvel mostra. Se um
  painel precisar de mais espaço, o número a mexer é `--coluna`.
  **Duas armadilhas de especificidade**, ambas apanhadas a medir e não
  a olhar: `.navb button` (0,1,1) ganha a `.logo` e a `.navb-logo`
  (0,1,0), por isso o logo do menu saía com 14px e meio apagado, e no
  telemóvel aparecia como mais um botão a partir a grelha em duas
  linhas. Qualquer regra nova para o logo do menu precisa de
  `.navb .navb-logo`.

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

| 2026-09 | Pessoal | O mapa do auditório deixou de ser guardado sob o culto em que a pessoa está escalada (`obterMeuEvento`) e passou a ser guardado sob a data real de hoje (`hojeLocal()`, `pages/Acomodacao.jsx`), sempre — sem "corrigir data" nenhuma (a Cloud Function `corrigirDataMapaAcomodacao` foi removida) | — | Bug de fundo, não feature: um documento "ao vivo, um por dia" nunca deve nascer de "a que culto esta pessoa pertence" — isso responde a uma pergunta diferente (quando sirvo a seguir) e pode saltar para a frente no calendário assim que a escala futura ainda não saiu, deixando quem abre a app a olhar para o dia errado sem erro nenhum à vista. Qualquer coisa futura no formato "um registo por dia real" (não por pessoa nem por escala) deve nascer já amarrada à data do relógio, nunca a uma leitura que tenta adivinhar "o culto certo". |

| 2026-09 | Pastoral | Corrigir um dado do passado por CORREÇÃO DIRETA, não por reconstruir uma hora de relógio: `corrigirDuracaoSecaoCulto` (`functions/pastoral.js`) guarda `duracaoCorrigidaMin` na secção, e `resumirCulto` prefere esse valor ao cálculo automático sempre que existe — nunca mexe em `horaReal`/`timestampReal`. A primeira versão tentava reconstruir um `Timestamp` a partir da data do culto + uma hora nova (via `Intl.DateTimeFormat`, para o offset de Lisboa mudar com o horário de verão); pedido novo do dono do produto a mandou trocar: "a correção está para a hora do relógio, mas precisa ser para a duração do bloco" — ninguém sabe de cor a que horas algo entrou, sabe quanto tempo durou. Duas ideias menores do mesmo lote, ainda válidas: (1) num gráfico de linha com grelha em números fechados, a grelha deve DEFINIR o topo do gráfico (calcular as linhas primeiro, topo = uma acima do máximo), nunca o contrário — calcular o topo primeiro (`max * 1.15`) e a grelha depois pode deixar a última linha abaixo do valor máximo de verdade, bug real já visto aqui (`LinhaTempo.jsx`); (2) uma Cloud Function que precisa de escrever numa base que não é a de quem chama (`baseId` como argumento, não do token) é sempre a exceção, nunca o padrão — proteger pela capacidade elevada (`ve_tudo_pastoral`, aqui) e nunca copiar o molde de `editarVoluntario` (que lê `baseId` do token de propósito) para esse caso. |
| 2026-09 | Pastoral → Pessoal | Um agregador que lê um dado AO VIVO (não fechado) como recurso — `historicoPastoral` lia `eventos/{e}/acomodacao/mapa` sempre que não havia resumo fechado — sem que o módulo dono desse dado (`Acomodacao.jsx`, sempre preso ao dia de hoje, de propósito) tivesse caminho nenhum para ver ou corrigir um domingo passado assim. Reportado como "de onde vêm estes números, se aqui diz que não há culto fechado nenhum?". Corrigido com uma lista nova, "Mapas por fechar" (`MapasPorFechar.jsx`, logo abaixo de "Cultos fechados"), que lê os últimos meses e mostra só os cultos com gente marcada (`ocupados+visitantes > 0` — reservados/bloqueados da planta não contam, já vêm por omissão em todo mapa) e nunca fechados, com **Fechar agora** (`fecharAcomodacao`, que já aceitava qualquer `eventoId`, não só o de hoje) e **Excluir** (`limparMapaAcomodacaoAoVivo`, novo — volta os lugares a "livre" sem fechar, nunca apaga o documento) | — | A lição generaliza: sempre que um agregador cross-base decide ler um dado NÃO FECHADO como fallback (em vez de esperar o fecho formal), o módulo dono desse dado fica com uma obrigação nova — dar para ver e corrigir esse registo específico, mesmo que a tela normal dele só mostre "o de hoje". Sem isso, o dado fica orfão: existe, pesa nalgum painel, e ninguém tem porta de entrada para ele. Qualquer base com o mesmo formato ("um documento ao vivo por dia", como o mapa daqui) que ganhe um consumidor cross-base deve nascer já com esta lista, não como correção depois do relato. |

| 2026-09 | Pastoral | Duas funções cruzadas (`escalasCrossBase`, `checklistCrossBase`, `functions/index.js`) assumiam formatos que nem toda base usa, e falhavam em silêncio — nunca um erro, só a base a aparecer "vazia" ou "sem checklist". (1) `escalasCrossBase` só reconhecia `lugares:[{titularId,aprendizId}]` (Técnica) e `pessoas:[id,...]` (Apoio/Backstage) — a "lista aberta" da Comunicação (`lugares:[{ministerioId, pessoas:[id,...]}]`, sem titular/aprendiz fixos, ver `CLAUDE.md` dela) não batia com nenhum dos dois: todo `l.titularId` vinha `undefined`, a lista de itens ficava vazia, e a função devolvia `tipo:"vazio"` para uma escala cheia. (2) `checklistCrossBase` só lia `bases/{b}/funcoes` — a Kinder não usa essa coleção para a checklist dela, usa `bases/kinder/checklistSala` (catálogo por SALA, não por função/ministério, ver `CLAUDE.md` da Kinder); `funcoes` para a Kinder vinha sempre vazio, e "sem checklist criada" aparecia mesmo com itens de sobra. Corrigido nos dois pontos: `escalasCrossBase` detecta o formato pelo campo `pessoas` (array) dentro do próprio lugar; `checklistCrossBase` acrescenta os itens de `checklistSala` ao `funcoes` devolvido quando a base é `"kinder"`, com a sala a fazer de "ministério" (mesmas cores de `apps/kinder/src/lib/modelo.js`). O ESTADO ao vivo da Kinder (`eventos/{e}/checklistKinder/{sala}.itens`, regra afrouxada de `minhaBase('kinder')` para `autenticado()`, mesmo padrão de `eventos/{e}/checklist`) teve de ser juntado nos dois lugares que já liam a checklist cruzada, senão os itens da Kinder apareciam no catálogo mas nunca ficavam "feitos" | Backstage | Reportado como "não está aparecendo a escala... da Comunicação" e "diz que não tem Checklist" (Kinder), no Painel Pastoral (`Domingo.jsx`) — mas as duas funções são as MESMAS que a "Todas as bases"/Checklists da própria Backstage já usava (`Escala.jsx`, `Checklists.jsx`), com o mesmo bug lá, silencioso até agora. Por isso o porte foi automático (a correção é no ponto único, `functions/index.js`) e só o merge do estado ao vivo teve de ser copiado a mão para `ouvirChecklistDoEvento` (`apps/backstage/src/lib/painel.js`), espelhando `ouvirChecklist` (`apps/pastoral/src/lib/culto.js`). A lição generaliza: uma função cross-base que lê o formato de dados de uma base específica (não o schema genérico documentado) fica cega, sem erro nenhum, à primeira base que usar uma variação legítima — vale a pena testar cross-base com pelo menos duas bases de formato diferente, não só a que motivou a função. |

| 2026-09 | Kinder | "Quantas crianças estão presentes?" — popup grande no Início, uma vez por domingo enquanto faltar preencher, que escreve direto na Contagem da Base Pessoal (`eventos/{e}/contagem/geral`) pela Cloud Function nova `registarContagemSala` (`functions/contagemSalas.js`), sem escrita direta — cada base só pode tocar na SUA categoria dentro do mapa `categorias`, e uma regra do Firestore não distingue campos dentro do mesmo documento, só documentos inteiros. Portado logo no mesmo lote para SHIFT e New (pedido explícito: "quero o mesmo no painel do SHIFT e do New") — mesmo componente, sem a divisão por sala (um número só, sempre a líder da base, nunca uma líder de subgrupo). | SHIFT, New | O padrão generaliza a qualquer base que precise de alimentar um número na Contagem da Base Pessoal sem lhe dar escrita direta ao documento inteiro: a função central sabe, por `baseId` do token, que categoria(s) essa base pode tocar (`CATEGORIAS_POR_BASE`), nunca confia num campo `categoria` vindo do cliente sozinho. Uma base com subdivisões internas (como a Kinder, três salas) acrescenta uma verificação extra de "és a líder desta subdivisão", que uma base de equipa única não precisa. |

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
