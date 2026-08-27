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
especificação visual e funcional inicial do módulo **Acomodação** —
esse é o único módulo já portado 1:1. Todos os módulos já estão
funcionais — Acomodação, Inventário, Ordem do culto, Contagem e
Formulário. O que falta é o painel do pastor (fora desta base) e os
débitos documentados no fim deste ficheiro.

## Fronteiras — o que esta base NÃO faz

- **Não há cadastro de visitantes.** As pessoas do Formulário não têm
  login, não são utilizadoras do sistema e não se registam a si
  próprias — um voluntário preenche por elas.
- **Não há acompanhamento.** A base recolhe e entrega. Quem contacta é
  o pastor, no painel dele (ainda não existe).
- **Não há cadastro de GDs.** Lista fixa por agora. O cadastro real
  nasce no painel do pastor.
- **O mapa de Acomodação não preenche a Contagem.** São universos
  diferentes — ver "Contagem" abaixo.
- **O funil de seis etapas do contacto** (visita → contactado → gd →
  membro → voluntário → servindo) não se implementa aqui. O documento
  de contacto nasce com os campos certos para o painel do pastor ler
  sem migração, mas só a Base Pessoal escreve a primeira etapa.

## Módulos

| Aba | Quem vê | Conteúdo |
|---|---|---|
| Início | todos | Escala pessoal + avisos do líder |
| Escala | todos | Escala do mês por função |
| Funções | todos (edita a líder) | Café, Drive, Acomodação, Recepção |
| Culto | todos | Quatro subabas: Ordem do culto, Feedbacks, Inventário, Contagem — ver abaixo |
| Formulário | todos | Novo contacto + lista do culto |
| Acomodação | todos leem, escreve o Drive | Mapa do auditório |
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
| **Função** | Café, Drive, Acomodação, Recepção — catálogo, sem funções especiais por agora |
| **Culto** | O evento. Domingos 10h |
| **Drive** | Quem tem a função Drive nesse culto — a única pessoa que escreve no mapa de Acomodação |
| **Contagem** | As nove categorias do prédio todo — nunca confundir com o mapa de Acomodação |

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/pessoal/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6).

### Função "Drive" — id determinístico

`bases/pessoal/funcoes/drive` é a única função de catálogo desta base
com **id fixo** (`"drive"`, não auto-id) — é o que permite à regra de
segurança do mapa de Acomodação (ver `firestore.rules` e
`functions/index.js`) apontar sempre a
`eventos/{evento}/atribuicoes/drive` sem lookup. **Nome reservado**:
nenhuma outra base pode ter uma função com id `"drive"` —
`atribuicoes` é uma coleção plana (`eventos/{e}/atribuicoes/{funcaoId}`),
sem namespace de base.

### Acomodação — mapa do auditório

- **Planta/configuração** — `bases/pessoal/acomodacao/planta` (doc
  único): fileiras A–L (12 lugares cada, 144 total), reservados fixos
  A1–A4, bloqueios permanentes (cadeira partida), parâmetros de
  desenho, preferência de cores invertidas da líder. Muda sem deploy.
  Leitura: qualquer pessoa da base. Escrita: só a líder.
- **Estado ao vivo por culto** — `eventos/{AAAA-MM-DD}/acomodacao/mapa`
  (doc único): campo `lugares` (mapa id→estado, as 144 chaves sempre
  preenchidas desde a criação), `fechado`, `criadoEm`, `iniciadoPor`.
  Escrita por lugar via `updateDoc` com dot-notation
  (`lugares.A1`), nunca reescrevendo o doc inteiro — é o que torna o
  offline seguro. **Escreve só quem tem a função Drive nesse culto**
  (ou a líder). Quem não tem a função Drive hoje **nem vê o mapa** —
  `pages/Acomodacao.jsx` mostra uma mensagem a pedir para falar com o
  líder em vez do mapa só de leitura (decisão explícita do dono do
  produto — antes toda a gente lia ao vivo). Regra de escrita em
  `firestore.rules`, ao lado do bloco `checklist`.
- **Arquivo pós-fecho** — `bases/pessoal/acomodacaoResumos/{AAAA-MM-DD}`
  (subcoleção): `ocupados`, `visitantes`, `livres`, `reservados`,
  `bloqueados`, `capacidadeUtil`, `percentagem`. Escrito pela Cloud
  Function `fecharAcomodacao` (não pelo cliente direto — fechar é a
  única ação do módulo que exige rede). A lotação (`percentagem`)
  conta só sobre `capacidadeUtil` (144 menos reservados e bloqueados)
  — reservados e bloqueados contam como indisponíveis, tal como
  ocupados, nunca como livres. Alimenta o futuro mapa de calor do
  painel do pastor.
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

### Contagem — subaba de Culto — nove categorias que não somam entre si

`membros`, `visitantes`, `voluntarios`, `mensagem`, `apelo` (manuais);
`new`, `shift`, `juniorFun`, `baby` (viram automáticas quando os
painéis das salas existirem — por agora manuais, com `origem` gravada
por categoria desde já, para a transição não pedir migração). Campo
aceita ficar vazio, guarda quem preencheu cada categoria. Vive no documento
único `eventos/{AAAA-MM-DD}/contagem/geral`, em `categorias.{id}`, com
`valor`, `origem`, `preenchidoPor` e `preenchidoEm`. Por agora todas as
categorias têm origem `manual`; quando existirem painéis das salas, só
`new`, `shift`, `juniorFun` e `baby` passam a `automatica`. Botão
"Limpar contagem" (com confirmação) volta as nove a `valor: null` —
as regras não deixam apagar o documento (histórico do culto), por
isso é sempre um `update`, nunca um `delete`.

### Formulário de contacto

Substitui o Google Forms atual. Funcional — `pages/Formulario.jsx` +
`lib/contactos.js`. Campos automáticos: `eventoId` (o culto da
pessoa que preenche), `criadoPor`, `criadoEm`, etapa inicial sempre
`"visita"`. Concelho é select (não texto livre) — só assim o futuro
sugestor de GD funciona; freguesias dependentes do concelho
(`FREGUESIAS_POR_CONCELHO` em `lib/contactos.js` — nomes oficiais
pós-reorganização de 2013, Matosinhos já com a desagregação de 2025).
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
a conversa certa). O número do pastor (`WHATSAPP_PASTOR` em
`lib/contactos.js`) está fixo no código por agora — ver "Débitos
conscientes".

### Catálogo de GDs

`bases/pessoal/gds/{id}` (`nome`, `regiao`) — mesmo padrão do
catálogo de funções: só a líder escreve (secção "Gerir" dentro do
Formulário), toda a base lê. Sem cadastro real ainda (nomes/regiões
verdadeiros entram à mão pela líder) — ver "Não há cadastro de GDs"
em "Fronteiras" no topo deste ficheiro.

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
- `null` → catálogo, aparece em todo culto (Café, Drive, Acomodação,
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
- **`WHATSAPP_PASTOR` fixo no código** (`lib/contactos.js`), não
  editável pela líder — se o número do pastor mudar, é mudar ali e
  fazer deploy. Segue o padrão de `bases/pessoal.horaChegada`/
  `horaCulto` (editável pela líder via "Definições da base") se um
  dia valer a pena dar-lhe o mesmo tratamento.
- Cadastro de GDs (nome + região + `lat`/`lng`) é da líder, à mão,
  dentro do Formulário — sem morada, contacto do responsável nem
  validação contra uma fonte oficial. O cadastro "a sério" nasce no
  painel do pastor.
- **Sugestor por distância já existe** (`gdMaisProximo` em
  `lib/contactos.js`, Haversine sobre `COORDENADAS_CONCELHO` ×
  `lat`/`lng` do GD) — ao escolher o concelho, o Formulário já
  pré-seleciona o GD mais perto em linha reta, editável à mão a
  seguir. Só funciona para os 6 concelhos servidos (não para
  "Outro") e só entre os GDs com `lat`/`lng` gravadas — **o
  formulário "Gerir" da líder ainda não pede essas coordenadas a
  quem adiciona um GD novo**, por isso um GD acrescentado pela
  interface fica de fora da sugestão automática (continua escolhível
  à mão) até alguém gravar `lat`/`lng` diretamente no Firestore. Os
  14 GDs seedados (`scripts/seedGDsPessoal.mjs`) já têm coordenadas.
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
