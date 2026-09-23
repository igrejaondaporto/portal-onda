# Base Pessoal — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A Base Pessoal cuida das pessoas: recebe à entrada, acomoda no
auditório, conta o público do prédio todo, serve o café e recolhe
contactos de quem quer ser chamado pelo pastor.

Cerca de 17 voluntários, um culto por domingo (10h), líder própria —
**Camila**. Como em qualquer outra base, o nome do líder é sempre uma
variável (`papel === "lider_base"`), nunca um nome fixo no código da
UI; quando o painel do pastor existir, ele vai poder trocar quem é
líder de qualquer base, incluindo esta.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em desenvolvimento em `pessoal.igrejaonda.pt`. O protótipo original
(`painel-base-pessoal ok.html`, fornecido pelo dono do produto) foi a
especificação visual e funcional inicial do módulo **Mapa** — esse é
o único módulo já portado 1:1. Todos os módulos já estão funcionais —
Mapa, Inventário, Ordem do culto, Contagem e Formulário. O que falta
é o painel do pastor (fora desta base) e os débitos documentados no
fim deste ficheiro.

## Fronteiras — o que esta base NÃO faz

- **Não há cadastro de visitantes.** As pessoas do Formulário não têm
  login, não são utilizadoras do sistema e não se registam a si
  próprias — um voluntário preenche por elas.
- **Não há acompanhamento.** A base recolhe e entrega. Quem contacta é
  o pastor, no painel dele (ainda não existe).
- **Não há cadastro de GDs.** Lista fixa por agora. O cadastro real
  nasce no painel do pastor.
- **O Mapa não preenche a Contagem.** São universos diferentes — ver
  "Contagem" abaixo.
- **O funil de seis etapas do contacto** (visita → contactado → gd →
  membro → voluntário → servindo) não se implementa aqui. O documento
  de contacto nasce com os campos certos para o painel do pastor ler
  sem migração, mas só a Base Pessoal escreve a primeira etapa.

## Módulos

| Aba | Quem vê | Conteúdo |
|---|---|---|
| Início | todos | Escala pessoal + avisos do líder |
| Escala | todos | Escala do mês por função |
| Funções | todos (edita a líder) | Café, Mapa, Acomodação, Recepção |
| Culto | todos | Quatro subabas: Ordem do culto, Feedbacks, Inventário, Contagem — ver abaixo |
| Formulário | todos | Novo contacto + lista do culto |
| Mapa | todos leem, escreve quem tem a função Mapa | Mapa do auditório |
| Enquetes | **só a líder** | Disponibilidade mensal |

A aba **Culto** (`pages/Culto.jsx`) agrupa tudo o que gira à volta do
próprio domingo — antes espalhado (Contagem vivia no Início,
Inventário tinha aba própria, Ordem do culto nem tinha interface).
Reorganizado a pedido do dono do produto: menu principal mais curto,
cada subaba continua com a lógica exata que já tinha — Inventário e
Contagem são os mesmos componentes de sempre
(`pages/Inventario.jsx`, `components/ContagemCulto.jsx`), só
embrulhados numa subaba em vez de página própria.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixa (Camila). Vê e edita tudo, em qualquer data |
| **Escala** | Quem serve em cada culto |
| **Função** | Café, Mapa, Acomodação, Recepção — catálogo, sem funções especiais por agora |
| **Culto** | O evento. Domingos 10h |
| **Mapa** | Nome da função (id interno ainda `drive`, ver abaixo) e da aba — quem tem esta função nesse culto é a única pessoa que escreve no mapa do auditório |
| **Acomodação** | Função diferente de Mapa — leva as pessoas até ao lugar indicado, sem nenhum acesso especial |
| **Contagem** | As nove categorias do prédio todo — nunca confundir com o mapa do auditório |

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/pessoal/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6).

### Função "Mapa" — id determinístico (ainda `drive`)

`bases/pessoal/funcoes/drive` é a única função de catálogo desta base
com **id fixo** (`"drive"`, não auto-id) — é o que permite à regra de
segurança do mapa do auditório (ver `firestore.rules` e
`functions/index.js`) apontar sempre a
`eventos/{evento}/atribuicoes/drive` sem lookup. O **nome visível**
desta função é **"Mapa"** (`drive` era o nome antigo, de quando isto
vivia numa folha do Google Drive — ficou só como id interno, trocar
exigiria migrar a rule/Cloud Function/seed, sem ganho nenhum para
quem usa a app). **Nome reservado**: nenhuma outra base pode ter uma
função com id `"drive"` — `atribuicoes` é uma coleção plana
(`eventos/{e}/atribuicoes/{funcaoId}`), sem namespace de base.

Não confundir com a função **"Acomodação"** (`bases/pessoal/funcoes/
acomodacao`, catálogo comum) — essa é quem leva as pessoas até ao
lugar indicado, papel físico e diferente, sem nenhum acesso especial.
Os dois nomes já colidiram com o da aba (que também se chamava
"Acomodação") e causaram confusão real — um voluntário com a função
"Acomodação" achava, com razão, que devia conseguir marcar o mapa, e
não conseguia. Foi por isto que a aba passou a chamar-se **"Mapa"**.

### Mapa — mapa do auditório

- **Planta/configuração** — `bases/pessoal/acomodacao/planta` (doc
  único): fileiras A–L (12 lugares cada, 144 total), reservados fixos
  A1–A4, bloqueios permanentes (cadeira partida), parâmetros de
  desenho, preferência de cores invertidas da líder. Muda sem deploy.
  Leitura: qualquer pessoa da base. Escrita: só a líder.
- **Estado ao vivo, sempre o de HOJE** — `eventos/{AAAA-MM-DD}/acomodacao/mapa`
  (doc único): campo `lugares` (mapa id→estado, as 144 chaves sempre
  preenchidas desde a criação), `fechado`, `criadoEm`, `iniciadoPor`.
  O `AAAA-MM-DD` da chave **é sempre a data real de hoje**
  (`hojeLocal()`, `pages/Acomodacao.jsx`) — não o culto em que a
  pessoa está escalada. Nasceu de um bug real: `obterMeuEvento`
  (pensado para "quando sirvo a seguir") podia saltar para o domingo
  seguinte assim que a escala futura ainda não tinha saído, e a líder
  deixava de conseguir ver o mapa de hoje já fechado — abria a app e
  via um mapa em branco de uma semana à frente. Por isso já não existe
  "corrigir data" (nem a Cloud Function `corrigirDataMapaAcomodacao`,
  removida): a data nunca está errada, porque nunca se escolhe.
  Escrita por lugar via `updateDoc` com dot-notation
  (`lugares.A1`), nunca reescrevendo o doc inteiro — é o que torna o
  offline seguro. **Escreve só quem tem a função Mapa nesse culto**
  (ou a líder). Quem não tem a função Mapa continua a ver o mapa ao
  vivo (acompanha em tempo real o que está a ser marcado) — só não
  consegue tocar; `pages/Acomodacao.jsx` mostra um popup a explicar
  porquê e a pedir para falar com o líder, em vez de deixar tocar sem
  efeito nenhum. Regra de escrita em `firestore.rules`, ao lado do
  bloco `checklist`.
- **Arquivo pós-fecho** — `bases/pessoal/acomodacaoResumos/{AAAA-MM-DD}`
  (subcoleção): `ocupados`, `visitantes`, `livres`, `reservados`,
  `bloqueados`, `capacidadeUtil`, `percentagem`. Escrito pela Cloud
  Function `fecharAcomodacao` (não pelo cliente direto — fechar é a
  única ação do módulo que exige rede). A lotação (`percentagem`)
  conta só sobre `capacidadeUtil` (144 menos reservados e bloqueados)
  — reservados e bloqueados contam como indisponíveis, tal como
  ocupados, nunca como livres. Alimenta o futuro mapa de calor do
  painel do pastor. O lápis "Editar" na lista de "Cultos fechados"
  (`ResumosAcomodacao.jsx`, só a líder vê os ícones) chama a Cloud
  Function `reabrirAcomodacao` — apaga este resumo (se houver) e
  devolve o mapa a `fechado: false`, para corrigir e fechar de novo.
  Mesma permissão de `fecharAcomodacao`. **A condição para reabrir é o
  MAPA estar `fechado:true`, não o resumo existir** — um mapa pode
  ficar fechado sem resumo nenhum (aconteceu em produção com um
  documento de antes de o mapa passar a seguir sempre a data real de
  hoje), e nesse caso não aparece em "Cultos fechados" nenhuma. Por
  isso `pages/Acomodacao.jsx` também mostra "Reabrir para marcar de
  novo" direto no aviso de culto fechado, para quem tem acesso
  (`souDrive`) — sem depender de estar naquela lista.
- Estados possíveis de um lugar: `livre | ocupado | visitante |
  reservado | bloqueado`. Cores fixas (não mexer sem avisar a líder):
  livre `#8E2028`, ocupado `#C8F02E`, visitante `#F5C518` (+ ponto
  escuro), reservado `#3B82F6` (+ ponto branco), bloqueado `#5A6072`
  (+ X branco).
- **O mapa não preenche a Contagem.** Pode mostrar-se o nº de lugares
  ocupados como referência ao lado, em texto, nunca copiar para um
  campo da Contagem.

### Ordem do culto — subaba de Culto

Mesmo componente (`components/culto/OrdemCultoCard.jsx` +
`OrdemCultoTimeline.jsx` + `SheetRevisaoOrdem.jsx`) e o mesmo modelo
de dados de Apoio/Técnica/Backstage/Comunicação (`eventos/{e}.ordem`,
PDF em `eventos/{e}/ordem.pdf` no Storage, funções `publicarOrdemCulto`/
`lerOrdemCulto`/`limparOrdemCulto` já existentes em `lib/culto.js`) —
**cópia direta, zero alteração**, porque já era genérico por evento,
não por base. Quem publica é definido por `bases/{b}.culto.pode_publicar`
(vira o claim `pode_publicar_culto` no token) — **hoje só a Backstage
tem isto ligado**, por isso a Base Pessoal vê sempre em modo leitura
(a mesma cronologia que o pastor publicou, nunca o botão de subir
PDF). Se um dia a Camila também passar a publicar, basta ligar o
mesmo campo em `bases/pessoal` — a interface já suporta os dois modos
sem alteração nenhuma de código.

### Feedbacks — subaba de Culto

Cópia direta do componente e do modelo de Apoio/Técnica/Backstage/
Comunicação (`eventos/{e}.feedback`, Cloud Function `definirFeedback`
já existente em `lib/culto.js`) — quem escreve é o líder de escala
DESSE culto (ou a líder da base), a mesma regra de `podeDistribuir`.
Nada de específico da Pessoal aqui.

### Contagem — subaba de Culto — categorias que não somam entre si

`visitantes`, `voluntarios`, `mensagem`, `apelo` (manuais); `new`,
`shift`, `junior`, `fun`, `baby` (`origem: "automatica"`, escritas
pelos painéis das salas — SHIFT, New e Kinder — nunca à mão aqui; ver
o CLAUDE.md de cada uma). **"Membros" saiu do catálogo** (pedido
2026-09: sem padrão de preenchimento a sério, ninguém contava).
**"Junior Fun" separou-se em `junior`/`fun`** (mesmo pedido, para bater
com as três salas reais da Kinder, cada uma com o seu popup de
contagem). Campo aceita ficar vazio, guarda quem preencheu cada
categoria. Vive no documento único `eventos/{AAAA-MM-DD}/contagem/geral`,
em `categorias.{id}`, com `valor`, `origem`, `preenchidoPor` e
`preenchidoEm`. Botão "Limpar contagem" (com confirmação) volta todas
a `valor: null` — as regras não deixam apagar o documento (histórico
do culto), por isso é sempre um `update`, nunca um `delete`. Cada
categoria mostra também a que horas foi preenchida, ao lado de quem
preencheu.

**A Contagem não fica presa a "quando sirvo a seguir".** Pedido
2026-09 ("hoje é dia 23/09 e o culto de 20/09 não foi marcado, eu
quero marcar essa data"): a subaba mostra a data do culto que está a
marcar, com setas ‹ › para andar entre os cultos do mês carregado
(`eventosMes`, o mesmo que "Ordem do culto"/"Feedbacks" já usam) —
troca de mês continua pela seta lá em cima, no cabeçalho de Culto.
Por omissão abre no próximo culto por vir (ou no último, se o mês já
acabou), mas qualquer domingo do mês fica a um toque, marcado ou não.

Botão **"Salvar contagem"** no fim grava `finalizadoEm`/`finalizadoPor`
(`finalizarContagem` em `lib/contagem.js`) — cada categoria já grava
sozinha ao toque, isto é só a confirmação explícita de "terminei",
que é o que faz o culto aparecer no bloco **"Cultos contados"**
(`components/HistoricoContagem.jsx`), logo abaixo, dentro da mesma
subaba. Mesmo esquema do Formulário/Mapa: filtro por mês,
cartão fechado por omissão que expande ao tocar, editar (reabre o
próprio `ContagemCulto` desse culto, dentro de uma sheet) e excluir
(chama `limparContagem`, que também limpa `finalizadoEm` — por isso
some do histórico ao ser excluído, nunca um delete a sério).

### Formulário de contacto

Substitui o Google Forms atual. Funcional — `pages/Formulario.jsx` +
`lib/contactos.js`. Campos automáticos: `eventoId` (o culto da
pessoa que preenche), `criadoPor`, `criadoEm`, etapa inicial sempre
`"visita"`. Concelho é select (não texto livre) — só assim o sugestor
de GD por distância funciona; freguesias dependentes do concelho
(`FREGUESIAS_POR_CONCELHO` em `lib/contactos.js` — nomes oficiais
pós-reorganização de 2013, Matosinhos já com a desagregação de 2025).
12 concelhos: os 6 da área metropolitana do Porto (Porto, Maia,
Matosinhos, Vila Nova de Gaia, Gondomar, Valongo) + 6 "remotos" onde
já há GD próprio (Póvoa de Varzim, Vila do Conde, Barcelos, São João
da Madeira, Lisboa, Sines) — mais "Outro", que troca a Freguesia para
texto livre (placeholder "Qual?"), sem sugestão de GD (sem concelho
conhecido, não há como estimar distância nenhuma).
Duplicados por telemóvel: avisa (compara pelo campo `telemovelDigitos`,
só números), nunca bloqueia. RGPD: checkbox obrigatório de que a
pessoa foi informada — grava `rgpd.aceite`/`baseLegal`/`em`; campo
`arquivado` previsto, sem purga automática por agora.

Coleção **global** `contactos/{id}` (fora de `bases/` e de
`pessoas/`, ver `firestore.rules`) — é onde o painel do pastor (ainda
não existe) vai ler por cima de todas as bases, sem migração, quando
nascer. Por agora só a Pessoal lê e escreve. Um campo aponta para
`pessoas/{id}` só a partir da etapa "voluntário" — nunca duplicar
identidade (essa parte do funil é só do painel do pastor).

**Ponte para o pastor, até o painel dele existir**: a líder vê a
lista "Leads deste culto" no próprio Formulário, um botão "Enviar
para o pastor" por lead abre o WhatsApp dela com a mensagem já
formatada (nome, telefone, concelho/freguesia, GD sugerido) — e
**dentro dessa mensagem** um link `wa.me` direto para a conversa com
o próprio lead, para o pastor abrir com um toque
(`linkParaPastor`/`textoParaPastor` em `lib/contactos.js`). Não é um
"cartão de contacto" nativo do WhatsApp — isso só existe partilhando
um contacto a sério da agenda, não é algo que uma app web consiga
acionar à distância; o link é o equivalente prático (um toque, abre
a conversa certa). O número do pastor é editável pela líder em
"Definições da base" (`definirBase`, guardado em `bases/pessoal/
config/contactoPastor` — nunca no código nem no doc `bases/pessoal`
de sempre, que qualquer pessoa autenticada de QUALQUER base lê; ver
`ouvirContactoPastor`/`linkParaPastor` em `lib/contactos.js`).

### Catálogo de GDs

`gds/{id}` (`nome`, `regiao`) — **global desde 2026-09** (era
`bases/pessoal/gds`; migrado por `scripts/migrarGDsParaGlobal.mjs`).
Um GD não é "da Pessoal", é da igreja — o Mural Onda (`apps/mural`)
passou a precisar do mesmo catálogo para o ecrã de entrada de quem
não é voluntário, mesma lógica de `eventos/` (CLAUDE.md raiz, regra
7). Continua o mesmo padrão do catálogo de funções: só a líder da
Pessoal escreve (secção "Gerir" dentro do Formulário — ver
`souLiderBase('pessoal')` no `firestore.rules`), agora qualquer base
autenticada lê. Sem cadastro real ainda (nomes/regiões verdadeiros
entram à mão pela líder) — ver "Não há cadastro de GDs" em
"Fronteiras" no topo deste ficheiro.

### Inventário do café — subaba de Culto

Mesmo molde de **consumível** da Backstage (`src/lib/inventario.js`,
`SheetItemInventario.jsx`) — quantidade e mínimo, sem património por
item. ~30 itens (copos, palitos, água, café, pão…), conferência
semanal. Funcional — `pages/Inventario.jsx` é o mesmo componente de
sempre, só passa a viver dentro da subaba "Inventário" de Culto em
vez de aba própria (`ativo` fixo a `false` quando embrulhado ali,
para não disputar o cabeçalho com Culto).

## Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todo culto (Café, Mapa, Acomodação,
  Recepção — todas de catálogo por agora, sem funções especiais)
- `"AAAA-MM-DD"` → só naquele culto

Só a líder da base cria no catálogo.

## Princípios do briefing original (não se discutem outra vez)

- **Avisa, não bloqueia.** Duplicados, stock mínimo, conflitos —
  sempre alerta, nunca impedimento.
- **Campo vazio não renderiza nada.** Sem "—", sem caixa vazia.
- **Sem IA no sugestor de escala.** Só lógica condicional (mesmo
  padrão da Apoio — `src/lib/sugestor.js`).
- **Dados de exemplo claramente fictícios** em seeds/demos, nunca
  nomes reais.
- **Débito documenta-se, não trava** — ver secção abaixo.

## Débitos conscientes

- **Ordem do culto**: só leitura na Base Pessoal — ninguém aqui tem
  `pode_publicar_culto` ligado ainda. Ver secção acima.
- Inventário sem património por item (herdado da Backstage).
- **Sem UI para gerir GDs** — a lista e o formulário de "Gerir" que
  existiam por baixo do Formulário foram tirados (pedido explícito,
  ficava a repetir informação e ninguém geria dali). O catálogo
  (`gds/{id}`, global — ver secção acima) só se mexe por
  `scripts/seedGDsPessoal.mjs` +
  `.github/workflows/rodar-script-admin.yml` — adicionar/editar um GD
  é correr esse script (ou um novo, no mesmo padrão) contra a
  produção. `criarGD` continua em `lib/contactos.js`, sem uso na UI
  por agora — fica pronto se um dia valer a pena repor a interface.
  Sem morada, contacto do responsável nem validação contra fonte
  oficial. O cadastro "a sério" nasce no painel do pastor.
- **Sugestor por distância** (`gdMaisProximo` em `lib/contactos.js`,
  Haversine) — ao escolher **a freguesia** (não só o concelho: dentro
  do mesmo concelho, freguesias diferentes podem ter GDs mais perto
  diferentes — ver `São Mamede de Infesta`, em Matosinhos, mais perto
  do GD "São Mamede" que do GD "Brito Capelo"), o Formulário
  pré-seleciona o GD mais perto em linha reta, editável à mão a
  seguir. Duas precisões diferentes de propósito, ver o comentário
  grande no topo de `COORDENADAS_FREGUESIA` em `lib/contactos.js`:
  freguesia a freguesia nos 6 concelhos da área metropolitana do
  Porto (onde ficam quase todos os GDs, e onde a freguesia muda
  mesmo a resposta); uma coordenada só por concelho remoto (Póvoa de
  Varzim, Vila do Conde, Barcelos, São João da Madeira, Lisboa,
  Sines) — lá dentro a freguesia nunca muda qual GD é o mais perto,
  o alternativo mais próximo está sempre a dezenas/centenas de km.
  Sem sugestão para "Outro" (sem concelho conhecido) nem para GDs sem
  `lat`/`lng` gravadas (continuam escolhíveis à mão). As coordenadas
  são aproximadas (centro da localidade), nunca confirmadas contra
  GPS a sério — chega para ordenar por "mais perto", não para nada
  que precise de precisão maior.
- Sem purga automática de contactos antigos; só o campo `arquivado`
  (ainda sem UI para o marcar).
- **Sem migração automática para o painel do pastor.** Enquanto ele
  não existir, é a líder que reenvia cada lead à mão pelo botão
  "Enviar para o pastor" — ver secção do Formulário acima.
- Planta de auditório sem editor visual — configura-se por documento
  Firestore (`bases/pessoal/acomodacao/planta`). Editor fica para
  depois.
- Curvatura/inclinação reais das fileiras: o desenho é aproximado às
  fotografias do protótipo, pode precisar de afinação depois do
  primeiro culto a sério.
- Pessoas por função em cada culto (1 a 3): valores por defeito ainda
  não definidos — perguntar à Camila antes de fechar o módulo Funções.
