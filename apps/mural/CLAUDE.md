# Mural Onda — igrejaonda

Contexto específico desta app. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack) —
este ficheiro é o resumo vivo do que é diferente aqui.

## O que é

Anúncios de "dou/vendo/arrendo" e de "procuro", para a igreja toda —
Portugal inteiro, não só o Porto/Maia (o grupo de WhatsApp que isto
substitui junta toda a gente). **Não é uma base** (CLAUDE.md raiz,
regra 6 — bases são equipas de voluntários); é como `eventos/`: "da
igreja, não da base". Duas coisas separadas, de propósito, que é fácil
confundir: **Ofereço** (quem tem algo a dar — venda, doação,
arrendamento, emprego) e **Procuro** (quem precisa de algo). O Procuro
é o que faz isto ser da igreja e não um classificados qualquer — quem
sobra a uns chega a quem precisa, em vez de se perder no scroll do
grupo.

Nasceu de uma conversa longa sobre o problema real: o grupo de
WhatsApp virou uma montra (2-3 anúncios por dia), as pessoas
silenciaram-no, e passaram a perder avisos a sério da igreja por
causa disso. A troca que sustenta o produto: quem anuncia continua a
chegar a toda a gente (o Painel gera **um resumo por semana** para
colar no grupo, em vez de vinte interrupções soltas); quem não quer
ver anúncios deixa de ser interrompido; e cada anúncio fica sempre
atualizado, porque o dono confirma "ainda está disponível?" a cada 30
dias, em vez de a informação morrer soterrada no histórico do grupo.

## Produtos e Serviços — a grelha 2×2 (2026-09)

Pedido do dono do produto: "uma forma simples e prática, dividir em
PRODUTOS e SERVIÇOS, e dentro de cada um Procuro e Ofereço". O mural
abre com dois botões grandes (**Produtos | Serviços**, `.natureza` em
`mural.css`) e por baixo o segmentado **Tudo · Ofereço · Procuro**.
Publicar é em três toques — Produto ou Serviço → Ofereço ou Procuro →
a categoria desse quadrado — e só depois aparece o resto do formulário.

| | Ofereço | Procuro |
|---|---|---|
| **Produtos** | Vendo (`venda`) · Dou (`doacao`) · Arrendo (`arrendamento`) | Compro / preciso de (`objetos`) · Quero arrendar (`arrendar`) |
| **Serviços** | Faço serviços (`servicos`) · Vaga de emprego (`emprego`) · Dou boleia (`boleias`) | Preciso de um serviço (`servicos`) · Procuro emprego (`emprego`) · Preciso de boleia (`boleias`) |

"Outros" existe nos quatro. Os ids são os de sempre — só os nomes
passaram a dizer o gesto; `servicos`/`boleias` no Ofereço e `arrendar`
no Procuro nasceram aqui. `anuncios/{id}.natureza` (`produto`/
`servico`) é gravado pelo servidor e **derivado da categoria**
(`naturezaDe`, nos dois lados — `functions/mural.js` e `lib/util.js`);
só "outros" usa a natureza escolhida. Os anúncios de antes não têm o
campo e caem no sítio certo pela categoria (os "outros" antigos ficam
em Produtos) — sem migração. O resumo semanal separa 🛒 Produtos e
🛠️ Serviços.

**Ajustes de 2026-10** (pedido do dono do produto):

- **Serviços primeiro** e aberto por omissão (`NATUREZAS`).
- **Cada natureza tem a sua cor** (`data-natureza`): Serviços o azul
  de sempre, Produtos o lima do "Onda" do título. Por escolher fica um
  tom claro; escolhido fica a cor cheia.
- **Filtros revistos:** o Filtro só mostra as categorias da natureza
  aberta. Em "Tudo" mostra os dois grupos, Ofereço e Procuro, em vez
  de os esconder. A escolha guarda o tipo junto (`"procuro:servicos"`,
  `chaveCategoria`/`bateCategoria` em `lib/util.js`), porque
  `servicos`/`emprego`/`boleias`/`outros` existem dos dois lados com
  sentidos opostos.
  - Trocar de natureza limpa a categoria; trocar Ofereço/Procuro só a
    limpa se for do outro lado.
  - Os filtros escolhidos aparecem por baixo da busca, cada um com ×.
  - A busca também apanha o nome da categoria ("boleia").
- **Botão "+" redondo, lima** (`.mural-fab`). É o mesmo da Biblioteca
  da Louvor e, como ele, fica em baixo à **esquerda** no telemóvel: o
  canto direito é do "Melhorias" partilhado. No computador fica à
  direita.
  - Sem sessão, abre a Entrada; ao entrar segue sozinho para Publicar
    (`depoisDeEntrar` em `Sessao.jsx`, que vale também para
    Publicar/Os meus na barra de baixo).
  - Fechar a Entrada sem entrar esquece o destino.

## Preço, ordenar, fotos primeiro, pausar e contacto de outra pessoa (2026-10)

Pedido do dono do produto:

- **Preço no lugar da etiqueta "Disponível".** A etiqueta estava em
  todos os anúncios e não dizia nada. No feed, à direita fica o preço
  (`.precoTag`, `textoPreco`): Grátis a verde, "A combinar" a
  cinzento. O estado só aparece quando diz alguma coisa: Reservado
  (laranja) ou Vendido. O detalhe também deixou de mostrar
  "Disponível".
- **Ordenar** (Filtro → Ordenar, `ORDENS`/`ordenar` em `lib/util.js`):
  - "Mais recentes" (omissão), "Mais baratos" (grátis primeiro, depois
    do menor para o maior valor) e "Mais caros".
  - O preço é texto livre, por isso `valorPreco` lê o primeiro número
    ("1.200 €" = 1200, "15,50 €/h" = 15,5). Sem número ("A combinar")
    vai sempre para o fim.
- **Com foto sempre primeiro**, em qualquer ordem. O Publicar avisa
  duas vezes: uma dica logo depois de escolher a categoria e a caixa
  das fotos em destaque.
- **Reservado → pausar ou excluir** (Os meus, `.acoesDono`):
  - "Marcar reservado" liga e desliga. Quando está reservado, aparece
    a dica "Quando ficar resolvido, pausa-o ou exclui-o".
  - **Pausar** grava `estado: "pausado"`: sai do feed (filtro no
    cliente) e do resumo semanal, continua a contar para o limite de 5
    e "Retomar" volta a pô-lo no ar.
  - **Excluir** é o `removerAnuncio` de sempre (`ativo: false`, nunca
    se apaga). O "Já vendi" do aviso dos 30 dias passou a "Já não,
    excluir".
  - "Disponível" e "Vendido" deixaram de ser botões. Os anúncios antigos
    marcados como vendidos continuam a aparecer esbatidos.
- **Contacto de outra pessoa**:
  - Publicar → "Quem atende os interessados?", com as opções "Eu" e
    "Outra pessoa". Exemplo: "vi uma placa de arrendamento na rua e
    quero ajudar".
  - O nome (opcional) e o telemóvel de quem trata ficam em
    `anuncios/{id}/privado/contacto`, onde nenhuma regra dá acesso. O
    anúncio público só leva `contactoDeOutro: true`.
  - O detalhe diz "X publicou isto para ajudar — o contacto é de quem
    trata". O botão passa a "Falar com quem trata no WhatsApp" e
    mostra também o número, para ligar se for um fixo.
  - **Sai do sistema quando o anúncio sai do ar** (removido, moderado
    ou expirado, em `functions/mural.js`). É de alguém que nunca se
    registou (RGPD), e é a única exceção consciente à regra 5 neste
    ficheiro.

### Ajustes logo a seguir (2026-10)

- **A etiqueta é só preço.** O campo é texto livre, e havia anúncios
  com "Domingos" ou "Pago". `textoPreco` só mostra o texto se tiver um
  algarismo; senão mostra "A combinar", ou "Grátis" numa boleia. O
  Publicar já não deixa gravar texto sem valor (`precoValido`), e
  escolher uma categoria de boleia marca "É grátis" sozinho.
- **Filtro: Ordenar, Categoria e Onde**, nada da outra natureza.
  - Em Ofereço/Procuro, as categorias desse lado.
  - Em "Tudo", **temas** que juntam os dois lados (`TEMAS`: "Boleias"
    = Dou boleia + Preciso de boleia; "Compra e venda" = Vendo + Compro;
    "Arrendamento" = Arrendo + Quero arrendar). Antes eram duas listas,
    com "Outros" repetido.
- **Onde: cidade e freguesia.**
  - No Publicar escolhe-se a cidade, de entre os 12 concelhos onde há
    GDs (`lib/locais.js`, copiado da Pessoal, só os nomes), ou "Outra
    cidade…" escrita à mão. A freguesia é opcional.
  - A região antiga deduz-se da cidade (só se pergunta em "Outra
    cidade"), porque `criarAnuncio` ainda a exige.
  - O filtro "Onde" **não é uma lista fixa**: sai dos anúncios que
    existem (`lugares` em `Sessao.jsx`), com quantos anúncios tem cada
    cidade. Escolhida uma cidade, aparecem as freguesias dela.
  - Os anúncios antigos, sem cidade, aparecem pela região (Norte…), via
    `lugarDe`.
- **Mais espaço** entre a caixa das fotos e "Publicar anúncio".

### Moderação, login e GDs (2026-10)

- **Publicar em nome de outra pessoa** (só quem modera; caixa violeta no
  topo do Publicar). Serve para quem pôs o anúncio no grupo do WhatsApp
  e não no Mural. Escolhe-se **onde está a pessoa** (uma base, "Membros"
  ou "Não está registada") e depois o nome, com busca
  (`components/EscolherPessoaEmNome.jsx`).
  - **Registada** (voluntário de uma base ou membro do Mural):
    `criarAnuncio({ emNomeDe: { pessoaId } })` cria o anúncio **no perfil
    dela** (`autorId` = ela). Leva o nome, a foto e o "onde serve" dela,
    aparece nos "Os meus" dela, é ela que o gere, e o WhatsApp é o dela.
    Fica `publicadoPor` = quem moderou, só para poder pôr as fotos logo a
    seguir (`definirFotosAnuncio`). Depois de publicar, volta-se ao
    mural, porque o anúncio não está nos "Os meus" de quem modera.
  - As pessoas de cada base vêm do `dadosEntrada` (a mesma cache da
    Entrada). Os membros sem base vêm de `listarMembrosMural`, só para
    quem modera: nome, GD e os últimos 3 dígitos do telemóvel, para
    distinguir nomes iguais.
  - **Não está registada**: `emNomeDe: {nome, telefone}`.
    - Se o número já tem conta no Mural, é igual ao caso acima: vai logo
      para o perfil dela.
    - Se não tem, o telefone vai para `anuncios/{id}/privado/contacto` (o
      mesmo sítio do "contacto de outra pessoa") e o anúncio fica no
      `autorId` de quem modera, **pendente**.
    - `muralPendentes/tel_<número>` (fechado, só o Admin SDK lê) guarda
      os ids. Quando a pessoa se regista com esse número (`registarMural`
      → `transferirPendentes`), os anúncios passam para o perfil dela e o
      WhatsApp passa a ser o do perfil.
    - Ao sair do ar, o anúncio sai também da lista de pendentes, e o
      contacto apaga-se.
    - Só o registo pelo Mural ("Não, mas sou membro") transfere. Se for
      voluntário, escolhe-se na lista da base.
  - **Conta para os 5 dessa pessoa** (pedido 2026-10), nunca para os de
    quem modera: os ativos dela, ou os pendentes desse número. No Publicar
    de quem modera, os pendentes (`emNomeDe`) não entram na contagem.
  - **Sem etiqueta**: o anúncio aparece como qualquer outro dessa pessoa
    (a etiqueta "publicado pela moderação" saiu, pedido 2026-10).
  - As fotos dum anúncio publicado pela moderação ficam na pasta de quem
    moderou. Quando a dona edita, `definirFotosAnuncio` deixa ficar as
    que o anúncio já tem, venham de que pasta vierem.
- **Login sem "Base"**: `nomeBase` tira o prefixo ("Base de Apoio" →
  "Apoio", "Base Louvor" → "Louvor").
- **Login**: a segunda opção passou a "Não, mas sou membro".
- **GDs novos** no catálogo global `gds/{id}` (`scripts/seedGDsPessoal.mjs`,
  corrido em produção): Maia, Rio Tinto, Sertã, Proença (Proença-a-Nova),
  Bresciadue (Brescia) e Online.
  - Regiões novas: Centro, Itália e Online.
  - O Online não tem coordenadas, por isso nunca é sugerido por distância.
  - Entram sozinhos no Mural, no Formulário da Pessoal e no funil do
    Painel Pastoral, sem mudar código.

### Editar anúncio e o WhatsApp de quem é membro (2026-10)

- **✎ Editar** em "Os meus" abre `SheetEditarAnuncio.jsx`.
  - Pode mudar: título, categoria (do mesmo lado — trocar Ofereço/Procuro
    é outro anúncio), preço/grátis, cidade/freguesia, descrição e fotos
    (tirar as que lá estão, juntar novas até 4).
  - Grava pelo `editarAnuncio`, que passou a aceitar o lugar.
  - As fotos só se regravam se mudaram (`subirFotosNovas` usa nomes
    únicos, para não pisar uma foto mantida).
- **O WhatsApp de quem se registou como membro** já era o número do
  registo (`pessoas/{uid}.telefone`, lido por `telefoneDoAutor`).
  Confirmado em produção. O dono nunca o via, porque no próprio anúncio
  não há botão. Agora o "Eu" do Publicar mostra "no teu WhatsApp 9xx xxx
  xxx" (`obterMeuTelefone`). Voluntários guardam o telefone na base, que
  daqui não se lê, por isso fica o texto de sempre.

### Fotos: reordenar e galeria (2026-10)

- **Reordenar** (`components/OrdenarFotos.jsx`, no Publicar e no Editar):
  - as fotos escolhidas aparecem em miniatura, cada uma com ‹ › para
    trocar de lugar e × para tirar;
  - a primeira leva a marca "capa", porque é a que aparece no feed;
  - "+ foto" junta mais, até 4.
  - São setas e não arrastar: no telemóvel, arrastar dentro de uma página
    que também desliza é frágil.
  - No Editar, a ordem nova grava-se pelo `definirFotosAnuncio`, que
    aceita reordenar as fotos que o anúncio já tem.
- **Bug corrigido:** o `<input type=file>` limpava-se (`value = ""`)
  antes de o `setState` ler `e.target.files`, porque o updater corre
  depois. As fotos escolhidas no Editar perdiam-se sem aviso. Agora os
  ficheiros são copiados primeiro.
- **Galeria** (`components/GaleriaExpandida.jsx`): tocar numa foto do
  detalhe abre-a em ecrã cheio.
  - Tem setas dos lados para passar às outras sem fechar e as miniaturas
    de todas por baixo.
  - Também desliza com o dedo e responde às setas do teclado e ao Esc.
  - Fica no Mural e não no `ImagemExpandida` partilhado: as bases usam
    esse para uma foto só, e mudá-lo repintava todas.
- **Limpeza para o lançamento (2026-10-01):** os 16 anúncios de exemplo
  que ainda estavam no ar passaram a `ativo: false`, marcados com
  `limpezaLancamento: "2026-10-01"`, e nenhum foi apagado. As 16 contas de
  teste (`tel_0000000xx`, `tel_999999999`) ficaram como estavam, a
  pedido.

### "Melhorias" — relatos ao Onda Tech Hub (2026-10)

O botão "Melhorias" vinha no menu partilhado (`NavBar`), mas o Mural
não montava o `BotaoReportarFlutuante` que o ouve, por isso não fazia
nada.

- **Com sessão:** o mesmo fluxo das bases (Casca em `Sessao.jsx`), com
  `paginaAtual = "Mural Onda — <página>"`. É esse prefixo que diz ao
  `abrirRelato` (`functions/relatos.js`) que o relato vem daqui: grava
  `baseOrigemId: "mural"`, mesmo para membros, que não têm base no
  token. O Tech Hub mostra-o como "Mural Onda" (`NOMES_BASE`).
- **Sem sessão:** o botão abre a Entrada, porque relatar pede conta,
  como publicar.

## Login rápido (2026-10)

Reportado: "3 s para aparecer a lista de pessoas" e "30, 40 s para
entrar depois de pôr o código". O PIN não era o problema: é uma
leitura por id. Somavam-se arranques a frio das Cloud Functions,
encadeados uns atrás dos outros. Quatro coisas:

1. **Functions** (`functions/aquecer.js`, PR à parte). O `index.js` já
   não carrega PDF/sharp/áudio no topo, e `aquecerLogin` (à boleia do
   `sondarFreeshow`, custo zero) mantém
   acordadas, de 5 em 5 min, `entrar`, `dadosEntrada`,
   `listarBasesMural`, `pedirEntradaMural` e `entrarMural`.
2. **Lista pré-carregada e guardada** (`lib/auth.js`).
   - Ao abrir a Entrada, `preCarregarEntrada` pede as bases e as
     pessoas de TODAS as bases em paralelo, enquanto a pessoa ainda lê
     "Já serves numa base?".
   - Tudo fica no `localStorage`, por isso na visita seguinte a lista
     aparece logo e a nova chega em fundo.
   - São os mesmos nomes/fotos que `dadosEntrada` já dá sem sessão.
   - Storage em try/catch: sem ele, só fica mais lento.
3. **`entrar` acordado antes do PIN.** Escolher a base dispara
   `aquecerEntrar()`, e o telemóvel existente dispara
   `aquecerEntrarMural()`.
4. **O overlay fecha assim que o token chega** (`App.jsx`).
   - Antes esperava pelo perfil (Firestore) E por `souAdminMuralAgora`
     (mais uma função fria).
   - Agora mostra logo o nome do rosto tocado (`definirPessoaEmCurso`)
     ou o da última visita (`mural.eu` no localStorage), e completa o
     resto em fundo.
   - Vale também para quem volta com sessão aberta: o Mural já não
     espera por nada para aparecer.



Diferença grande em relação a todas as outras apps do repo: ver os
anúncios e falar no WhatsApp **nunca pedem sessão**. `anuncios/{id}`
lê-se com `allow read: if true` no `firestore.rules`, e
`pedirContactoAnuncio` (o único sítio de onde o telefone sai) aceita
chamadas sem `req.auth`, travado só por limite de pedidos por IP
(`limitarPedidoContacto`, mesmo padrão de `limitarRegistoPublico` em
`kinder.js`) — sem isso, um script sem conta nenhuma conseguia
percorrer todos os anúncios a colher números.

Na prática (`App.jsx`/`Sessao.jsx`): o Mural em si é sempre a tela de
raiz, com ou sem sessão; a Entrada só aparece como um overlay
(`.entradaModal`), aberto pelo botão "Entrar" no cabeçalho ou ao
tentar Publicar/Os meus/Painel sem conta (`PAGINAS_COM_SESSAO` em
`Sessao.jsx`). "Reportar anúncio" continua a exigir sessão — é
moderação, não simples consulta — mas o próprio botão abre a Entrada
em vez de falhar silenciosamente quando não há `meuUid`.

## Entrada — dois caminhos para a mesma identidade

Isto é a decisão mais importante desta app e a que mais foge do
padrão do resto do repo (onde cada app serve UMA base, com
`VITE_BASE_ID` fixo):

- **"Sim, sirvo numa base"** — reaproveita `dadosEntrada`/`entrar`
  (`functions/index.js`) tal e qual, só com um passo a mais no
  cliente (escolher a base primeiro, ver `listarBasesMural`). Mesma
  identidade global, mesmo PIN de sempre (CLAUDE.md raiz, regra 2). O
  token que sai de lá já serve para publicar — as Cloud Functions do
  Mural (`functions/mural.js`) nunca olham para `baseId`/`papel`, só
  para `req.auth.uid`.
- **"Não, sou da igreja"** — quem nunca foi voluntário não tem base
  nenhuma para escolher. Entra por telemóvel + PIN, próprio deste
  domínio: `pedirEntradaMural` → `registarMural` (conta nova, id
  `tel_<telefone>` — nunca um nome cru, regra 9 do CLAUDE.md raiz) ou
  `entrarMural` (conta já existente).

`apps/mural/src/lib/auth.js` guarda a base escolhida num módulo local
(`definirBaseEmCurso`) para o primeiro caminho, porque
`entrarComPin(pessoaId, pin)` não leva `baseId` — cada app de base
tem sempre o seu fixo, só o Mural varia. **O ecrã de base+rostos usa
`SheetPinBase` (`components/adaptados/`), uma cópia local do
`SheetPin` partilhado, nunca o original** — o `SheetPin` de
`packages/shared` importa `entrarComPin` de `"../lib/auth"`, caminho
relativo AO PRÓPRIO FICHEIRO, que resolve sempre para
`packages/shared/src/lib/auth.js` (o `entrarComPin` genérico, com
`BASE_ID` fixo do `.env`) — nunca para o `lib/auth.js` desta app. Nas
apps de base isso nunca aparece (cada uma só entra na sua própria
base); no Mural fazia qualquer PIN certo parecer errado, porque a
chamada ia sempre com `baseId: "mural"` (que não existe) em vez da
base escolhida no ecrã — bug real, apanhado 2026-09 por quem estava a
testar. Ver o LEIA-ME de `components/adaptados/` para o detalhe.
`TecladoNumerico` continua reaproveitado sem cópia (não toca em
auth). Sem `GatilhoDev`: o acesso de dev é por base (CLAUDE.md raiz,
"Ao criar uma base nova", item 3) e o Mural não é uma — fica de fora
de propósito.

## Modelo de dados

```
anuncios/{id}                    GLOBAL — tipo, categoria, título,
                                  descrição, preço/gratis, região,
                                  estado, autoria copiada (nunca lida
                                  em tempo real — mesmo padrão de
                                  nomesDePessoas em index.js)
gds/{id}                         GLOBAL desde 2026-09 (era
                                  bases/pessoal/gds) — o Mural só lê
config/muralAdmins/porPessoa/{pessoaId}   fechado (catch-all) — quem modera
```

Toda a escrita em `anuncios/` passa por Cloud Function
(`functions/mural.js`) — limite de 5 anúncios ativos por pessoa,
expiração a 30 dias, autoria vinda do servidor, nada disto dá para
garantir só com Regras (CLAUDE.md raiz, regra 3). "Remover" é sempre
`ativo:false` (regra 5 — nada se apaga a sério); o histórico do dono
continua visível em "Os meus".

## Ganhar acesso ao painel — o mesmo gesto das bases, adaptado

`config/muralAdmins/porPessoa/{pessoaId}` continua a ser só um
documento (não uma claim — ver acima), mas ganhá-lo já não depende só
de alguém correr `scripts/definirAdminMural.mjs <pessoaId>` à mão: 5
toques no logo do cabeçalho (`GatilhoModeracao`, em
`components/`) abrem `SheetDesbloquearModeracao`, que pede uma senha
partilhada (`config/moderacaoMural`, via `desbloquearModeracaoMural`
em `functions/mural.js`) — mesmo desenho do `GatilhoDev`/
`SheetAcessoDev` partilhado (5 toques, senha com bloqueio por
tentativas), mas **não** é esse mecanismo: `entrarComoDev` cria uma
sessão nova sem pessoa nenhuma por trás; isto marca quem **já está
autenticado** como admin, por isso só reage a 5 toques com sessão
aberta (`ativo={!!eu && !eu.admin}` em `Sessao.jsx`) — sem conta não
há ninguém para conceder. Define a senha com
`node scripts/definirSenhaModeracaoMural.mjs "senha"`, à parte da
senha de dev (é outro documento, outro privilégio). O script antigo
não desapareceu: **o gesto só concede, nunca revoga** — tirar o
acesso continua a ser `node scripts/definirAdminMural.mjs <id> --tirar`.

**Sem índices compostos no Firestore, de propósito.** O feed lê só
`where(ativo==true)` (uma igualdade, indexada automaticamente) e
filtra/ordena tipo, região, categoria e busca no cliente — com o
volume real de um mural de igreja (dezenas a poucas centenas de
anúncios ativos) isto é mais barato do que manter índices compostos
para cada combinação de filtro, e simplifica: um filtro novo não pede
deploy de índice nenhum. A manutenção diária (`manutencaoMural`,
`onSchedule`) é a exceção — aí sim precisa de dois índices compostos
(ver `firestore.indexes.json`), porque corre no servidor sobre a
coleção inteira, não sobre o que já está na mão do cliente.

**O telefone nunca vai para dentro do anúncio.** Gravá-lo lá abriria
o número a qualquer pessoa autenticada que leia o documento, mesmo
sem carregar em nada. O botão "Falar no WhatsApp" chama
`pedirContactoAnuncio`, que o vai buscar na hora — a `pessoas/{uid}`
(quem só existe pelo Mural) ou a `bases/{b}/pessoas/{uid}` (quem é
voluntário, guarda o telefone na sua base).

## Débitos conscientes

- **Busca por telefone não normalizada entre sistemas.** `entrarMural`/
  `registarMural` só comparam contra `pessoas/tel_<telefone>` (o
  próprio caminho de registo do Mural), nunca contra o telefone que um
  líder escreveu numa base — por isso o formato ("912 345 678" vs
  "912345678") nunca interfere aqui. Ver o comentário completo no
  topo de `functions/mural.js`.
- **Sem moderação prévia.** Qualquer anúncio fica visível assim que é
  publicado; o Painel (aba "Reportados") e "Reportar anúncio à
  moderação" no detalhe são o mecanismo de hoje. Pré-aprovação
  combinada para uma fase seguinte — pedido explícito, 2026-09, para
  não travar o lançamento.
- **Editar um anúncio pelo Painel ainda não existe** — hoje o Painel
  só remove (`moderarAnuncio`). "Editar" fica para juntar com a
  pré-aprovação.
- **Sem upload de fotos no seed** (`scripts/seedMural.mjs`) — os
  anúncios de exemplo nascem sem imagem, só com o ícone de categoria.
- **Ícones/og-image gerados por script** (`scripts/gerarIconesMural.mjs`,
  CLAUDE.md raiz "Ao criar uma base nova", item 1) — já correu uma vez;
  volta a correr só se quiseres outro texto ou cor.
- **Pessoas de exemplo do seed usam nome, foto E telefone reais de
  voluntários** (`bases/{baseId}/pessoas`, de qualquer base já
  semeada) — ao contrário da convenção em `apps/pessoal/CLAUDE.md`,
  aqui foi pedido explicitamente pelo dono do produto (2026-09), para
  o botão "Falar no WhatsApp" funcionar a sério ao testar. O "autor"
  em si continua a ser uma identidade só de teste (`pessoas/tel_...`,
  nunca o pessoaId do voluntário) — só o nome/foto/telefone são
  copiados. Preço consciente e aceite: como o Mural é público, quem
  vir um anúncio de exemplo pode mandar mensagem a sério a esse
  voluntário sobre algo que ele nunca publicou. Ver o aviso completo
  no topo de `scripts/seedMural.mjs`.
