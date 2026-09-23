# Painel Pastoral — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é — e o que deliberadamente NÃO é

A segunda base sem equipa de culto (a primeira foi o Financeiro), e a
última a ser construída: nasceu **depois** das dez, e é a tela que
junta o que elas produzem.

Faz **quatro coisas**:

1. **Mostra o domingo** — as dez escalas, as dez checklists ao vivo, a
   contagem de presentes, e o culto a acontecer em tempo real.
2. **Mostra o estado de cada base** — o que está por resolver, e em
   que ordem.
3. **Mostra as pessoas** — quem serve, quem serve em duas bases, e o
   funil de visitantes, da primeira visita a estar numa escala.
4. **Monta e publica a ordem do culto** — o que até 2026-09 era um PDF
   que o pastor mandava e a Backstage subia.

**O painel observa; não decide — mas já escreve mais do que só ordem/
etapa/recado.** Decisão explícita do dono do produto, e é o que
impede esta app de virar um super-utilizador com acesso de escrita a
dez bases. Não aprova reembolsos, não marca checklists, não edita
inventário. O que escreve, e porquê:

| O quê | Onde | Porquê é escrita e não leitura |
|---|---|---|
| A ordem do culto | `eventos/{e}.ordem` | É produzida aqui, não noutro lado — é o que substitui o PDF |
| A etapa de um visitante | `contactos/{id}.etapa` | O funil sempre foi desenhado para ser só daqui (ver abaixo) |
| Um recado a uma base | `recados/{id}` | De ida, sem resposta, sem estado — o líder lê e dispensa |
| Excluir um contacto do funil | `contactos/{id}.arquivado` | "Excluir" nunca apaga (regra 5 do CLAUDE.md raiz); mesmo campo que a Pessoal já usa no Formulário dela |
| Corrigir a DURAÇÃO de um momento | `eventos/{e}/estatisticasCulto/registo.secoesReais[].duracaoCorrigidaMin` | Depois de "Finalizar culto" copiar tudo para o arquivo, nada mais o edita — um erro ficava congelado para sempre (pedido 2026-09). Corrige a duração, não a hora de relógio — ninguém sabe de cor a que horas algo entrou |
| Trocar o líder de uma base | `bases/{b}/pessoas/{id}.papel` | A ÚNICA escrita numa base que não é a própria — decisão nova do dono do produto (2026-09), ver "Trocar líder" abaixo |

Escalas continuam do líder de cada base — o painel não monta nem
publica nenhuma. Trocar QUEM é o líder é outra coisa (ver abaixo), e
foi um pedido explícito, não uma reinterpretação desta regra.

Se alguém pedir "e já agora aprovar os reembolsos por aqui", a
resposta é não sem uma decisão nova do dono do produto: a regra 3 do
`CLAUDE.md` raiz existe para o que é do líder decidir continuar a ser
dele.

## Isto estava previsto no código antes de existir

Quatro sítios guardavam dados **de propósito**, à espera desta app.
Não são coincidências — cada um tem um comentário a dizê-lo, e nenhum
ficou por usar:

- **`eventos/{e}/estatisticasCulto/registo`** (`firestore.rules`):
  *"arquivo para o futuro Painel do Pastor — nenhuma base lê isto
  hoje, de propósito"*. Gravado por `arquivarCultoTerminado`
  (`functions/index.js`) quando a Técnica finaliza o culto ao vivo,
  com o bruto (secções reais + o previsto daquele dia) e sem contas
  nenhumas: *"as contas de atraso/estatística ficam para quando esse
  painel existir, não há razão para as fazer duas vezes"*. São feitas
  em `resumirCulto` (`functions/pastoral.js`).
- **A coleção global `contactos`** (`firestore.rules` e
  `apps/pessoal/src/lib/contactos.js`): *"o painel do pastor (ainda
  não existe) vai precisar de ler isto por cima de todas as bases, um
  dia"*, e *"o funil das etapas seguintes é só do painel do pastor"*.
  Por isso a Base Pessoal só pode criar com `etapa: "visita"` — as
  regras obrigam — e as outras cinco etapas nascem aqui.
- **Os resumos de acomodação** (`apps/pessoal/src/components/
  acomodacao/ResumosAcomodacao.jsx`): *"é o que vai alimentar o mapa
  de calor do painel do pastor mais tarde"*. É o `MapaCalor.jsx`, em
  Números — a `percentagem` vem de lá calculada (sobre a capacidade
  útil) e não se recalcula aqui: a mesma conta em dois sítios divergia
  no dia em que uma mudasse.
- E a **chave VAPID** (`VITE_FB_VAPID_KEY`, em `.env.production`),
  provisionada desde sempre e nunca usada, é o que as notificações
  push finalmente gastam (`functions/notificacoes.js`).

Ao mexer aqui, vale a pena procurar `pastor` no repo antes de inventar
uma estrutura nova: é provável que já exista uma à espera.

## Por que é uma base e não um papel novo

Pela mesma razão que o Financeiro: o sistema de papéis é sempre dentro
de uma base (`request.auth.token.baseId`, regra 4 do `CLAUDE.md`
raiz). `bases/pastoral` ganha capacidades, e as capacidades entram no
token por `claimsExtraDaBase` (`functions/index.js`), como já
acontecia com a Backstage e o Financeiro:

```js
bases/pastoral {
  veEscalas: "todas",              // → ve_todas_escalas      (já existia, Backstage)
  veReembolsos: "todas",           // → ve_todos_reembolsos   (já existia, Financeiro)
  culto: { podePublicar: false },  // → pode_publicar_culto   nasce desligada — ver "A ordem do culto" abaixo
  eventos: { podeCriarGlobal: true }, // → pode_criar_evento_global
  visaoPastoral: true,             // → ve_tudo_pastoral      ← a única nova
}
```

**Não existe papel "admin_igreja", e não é agora que passa a existir.**
Quatro das cinco capacidades já existiam e não foram tocadas — foi
por isso que publicar a ordem do culto daqui não precisou de nenhuma
Cloud Function nova.

## As cinco abas

| Aba | Ficheiro | A pergunta a que responde |
|---|---|---|
| **Domingo** | `pages/Domingo.jsx` | O que está a acontecer (ou vai acontecer) neste culto? |
| **Bases** | `pages/Bases.jsx` | Alguma base precisa de mim? |
| **Pessoas** | `pages/Pessoas.jsx` | Quem é a igreja, e quem está a ficar pelo caminho? |
| **Números** | `pages/Numeros.jsx` | Está a melhorar ou a piorar? |
| **Ordem** | `pages/Ordem.jsx` | Montar e publicar a ordem do culto |

Perfil não é aba — entra-se tocando na foto (mesmo padrão do `MenuEu`
das outras bases). **Se uma coisa nova não cabe numa destas cinco
perguntas, provavelmente não pertence a esta app** — é a mesma vara de
medir que o Financeiro usa.

As cinco ficam **sempre montadas** (`display:none` no lugar de
desmontar, em `Sessao.jsx`). Aqui isso não é só preservar scroll: os
agregadores são caros, e desmontar a aba repetiria a chamada a cada
ida e volta. Por causa disso, cada página só recalcula o cabeçalho
quando recebe **`ativo` = verdadeiro** — sem esse gate, o efeito corre
uma vez só no arranque e o título para de seguir a navegação (bug já
reportado no Financeiro, que tem a mesma casca):

```jsx
useEffect(() => {
  if (!ativo) return;
  definirCabecalho({ titulo: ..., subtitulo: ..., chips: [...] });
}, [ativo, definirCabecalho, /* ...o resto que o título usa */]);
```

## A regra de ouro desta app: função para o catálogo, `onSnapshot` para o estado

É a decisão de arquitetura que mais interessa perceber antes de
acrescentar seja o que for.

O painel precisa de ler inventário, melhorias, wiki e pessoas de dez
bases — tudo restrito a cada base nas regras, de propósito. Havia dois
caminhos:

1. Acrescentar `|| vejoTudoPastoral()` a ~15 blocos do
   `firestore.rules` — quinze sítios novos onde enganar-se, num
   ficheiro que **faz deploy sozinho ao entrar na `main`**.
2. Ler pelo Admin SDK numa Cloud Function e devolver só o resumo.

Escolheu-se o 2. As regras ganharam **duas** leituras novas, não
quinze: `contactos` e `estatisticasCulto` — as duas são listas a
sério, com filtro e busca, e dentro de uma função perderiam o tempo
real e ganhavam paginação à mão.

Mas o que **já era legível** por qualquer pessoa autenticada não passa
por função nenhuma, e isso é igualmente deliberado:

| Vem de uma função (retrato) | Vem de `onSnapshot` (ao vivo) |
|---|---|
| `panoramaPastoral` — o estado das 10 bases | `eventos/{e}/checklist` — quem já marcou o quê |
| `pessoasPastoral` — quem serve onde | `eventos/{e}/contagem/geral` — a contagem a subir |
| `patrimonioPastoral` — o que a igreja tem | `eventos/{e}/cultoAoVivo` — o momento no ar |
| `historicoPastoral` — os números dos gráficos | `config/cultoAoVivo` — há culto agora? |
| `escalasCrossBase` / `checklistCrossBase` (catálogo) | `recados` — o líder já dispensou? |

**É isto que faz o ecrã de domingo valer alguma coisa.** Uma função
devolve um retrato; chamá-la a cada toque de checkbox das dez bases
seria caro e lento — o raciocínio já estava escrito em
`checklistCrossBase` desde 2026-08 e vale igual aqui. Se acrescentares
um dado novo, a pergunta a fazer é "isto muda durante o culto?": se
sim, `onSnapshot`; se não, agregador.

## RGPD — o que este painel vê, e o que não vê

Decisão explícita do dono do produto ao desenhar a app: vê **tudo
menos as ocorrências da Kinder**.

Vê: nomes, fotos, telefones, quem serve em que base, valores de
reembolso pedido a pedido, faturas, contactos de visitantes com
morada e telemóvel.

**Não vê `bases/kinder/ocorrencias`** (queda, febre — dados de saúde de
menores). É a categoria mais sensível do sistema, a líder da base já
as trata, e um painel de observação não é motivo suficiente para as
espalhar. Há um comentário a dizer isto no topo de
`functions/pastoral.js`: quem acrescentar `ocorrencias` a
`resumoDaBase` está a desfazer uma decisão, não a completar um
esquecimento.

## A ordem do culto

### Publicar continua desligado por omissão (2026-09, ajustado depois)

Motivo: `publicarOrdemCulto` **substitui** o campo `ordem` inteiro, sem
merge por secção. Isso é seguro enquanto só a Backstage publica — é o
que já acontecia sempre — e deixa de ser seguro no dia em que duas
telas com a mesma claim escrevem no mesmo documento sem se avisarem:
publicar pelo painel depois de a Backstage já ter subido o PDF apaga o
que lá estava, sem aviso nenhum. Foi assim que a equipa encontrou isto
a testar (2026-09-20) — o "corpo" que a Backstage tinha subido por PDF
desapareceu depois de mexer na aba Ordem do painel.

**Na primeira versão isto escondia a aba inteira** atrás de
`bases/pastoral.culto.podePublicar`; pedido explícito do dono do
produto logo a seguir: montar o rascunho, ver a folha, ajustar — sem
depender de ninguém decidir "ativar a sério" primeiro. Compor,
imprimir e guardar modelos nunca tocam em `eventos/{e}.ordem` (só
`publicarOrdemCulto`/`limparOrdemCulto` tocam), por isso só os botões
**"Publicar às dez bases"** e **"Retirar a ordem deste culto"** ficam
desativados sem a claim — o resto da tela (`Ordem.jsx`) fica sempre
visível e funcional, com uma legenda a explicar porquê os dois botões
estão cinzentos. `Domingo.jsx` também deixou de esconder o caminho:
"Montar um rascunho" leva à aba Ordem nos dois casos, só o texto do
botão muda.

O gatilho continua a ser a claim que já existe, não uma flag nova:
`podePublicarCulto` (o mesmo booleano que protege a Cloud Function do
lado do servidor) decide os dois botões do lado do cliente. Sem essa
claim, deixá-los clicáveis levaria a publicar e a apanhar
`permission-denied` só depois de já ter composto tudo — pior do que
mostrá-los desativados com a legenda.

**Para ativar de vez:** troca `culto: { podePublicar: false }` para
`true` em `scripts/seedPastoral.mjs`, corre o script outra vez, e
combina com quem cuida da Backstage qual dos dois caminhos fica ativo
— os dois ao mesmo tempo continuam a ter o mesmo risco de
sobrescrita, só que deliberado em vez de acidental. Quem já tinha
sessão aberta só vê os botões desbloquear depois de sair e voltar a
entrar (os claims recalculam só em `entrar`/`trocarBase`).

### O que mudou, e o que não

O PDF **continua a existir e a Backstage continua a poder subi-lo**
(decisão explícita: nenhum domingo fica dependente de uma tela nova no
primeiro mês). `functions/ordemCultoPdf.js` não foi tocado.

O que mudou é haver um caminho onde não há nada para adivinhar. O
analisador do PDF reconstrói uma grelha de seis colunas a partir das
coordenadas de cada pedaço de texto — e já engoliu três avisos de
quatro por causa disso (ver o cabeçalho desse ficheiro). Aqui os
campos são campos.

### O documento gravado é o mesmo

`eventos/{e}.ordem`, com `momentos[]` e `avisos[]`, pela **mesma**
`publicarOrdemCulto`. Nenhuma das dez bases precisa de saber de onde
veio a ordem que está a ler — é isso que fez esta tela nascer
compatível com todas, sem uma linha de código em nenhuma delas.

`origem: "manual"` distingue as duas no documento. **Não é um campo
novo**: a Backstage já o gravava quando o analisador falhava e o líder
escrevia tudo à mão.

### Publica direto

O pastor publica, não envia para aprovação (decisão do dono do
produto). A Backstage continua com a mesma claim, continua a poder
editar por cima, e continua dona das `notas` dela — que aparecem por
cima da ordem e nunca se confundem com o que o pastor escreveu.

### Modelos

`bases/pastoral/modelosOrdem/{id}`, escrita direta (regra nova, no
mesmo molde de `avisosModelos`). Existem porque sem eles montar no
painel seria mais trabalhoso do que mandar o PDF de sempre, e ninguém
trocaria.

Guardam a **espinha**, não o domingo: as horas e os nomes ficam, o
responsável de cada momento não. Quem prega muda de semana para
semana, e um modelo que trouxesse o nome da semana passada publicava
o pregador errado.

**"Recalcular horas" é um botão, não automático.** Um culto pode ter
uma folga de propósito entre dois momentos, e recalcular a cada tecla
apagava-a sem ninguém pedir.

É o único sítio do repo onde se apaga a sério (regra 5 do `CLAUDE.md`
raiz), e é uma exceção consciente: um modelo não é histórico de nada —
é um rascunho de trabalho, e nenhuma ordem publicada depende dele (a
publicação **copia** os momentos, não aponta para o modelo).

## O recado

De ida, sem resposta, sem estado. O pastor escreve, aparece no Início
da base, o líder lê e dispensa. **Não é uma `solicitacao`** — essa tem
prazo, atribuição, transferência e histórico de estados, e nada disso
se aplica a "no próximo domingo chegamos às 9h".

Coleção própria na raiz (`recados`), e não `bases/{b}/avisos`: os
avisos são do líder para a equipa dele e **só a Louvor tem tela para
eles**. Misturar as duas coisas obrigava a Louvor a distinguir origens
no mesmo ecrã, e as outras nove a ganhar o ecrã de avisos inteiro só
para ver um recado.

Do lado das bases são duas linhas por app:
`packages/shared/src/components/RecadoPastoral.jsx` +
`lib/recados.js`, e `<RecadoPastoral papel={papel} />` no topo de cada
`Inicio.jsx`. Usa o `.destaque` que o Início já usa para "isto precisa
de ti" — um estilo novo só ensinaria a equipa a ler mais um formato.

**Também chega por push** (`notificarRecado`,
`functions/notificacoes.js`), a quem o tiver ligado. O cartão no Início
continua a ser o caminho garantido: nem toda a gente ativa
notificações, e no iPhone elas só funcionam com a app instalada no ecrã
principal. A folha de envio diz as duas coisas, em vez de prometer que
toca um telemóvel.

Toda a equipa lê; só o líder (ou auxiliar) dispensa — quem não pode
não vê o botão, em vez de ver um botão que rebenta ao toque.

## O funil de visitantes

Seis etapas: **visita → contactado → gd → membro → voluntario →
servindo**. A lista vive em dois sítios (`lib/contactos.js` e
`functions/pastoral.js`) e tem de ser mudada nos dois — o servidor
recusa o que não conhece, que é o que se quer.

`voluntario` e `servindo` são etapas diferentes de propósito: entre
dizer "quero servir" e estar numa escala há semanas de conversa, e
juntar as duas escondia exatamente o sítio onde as pessoas se perdem.

**Passar por aqui nunca cria `pessoas/{id}`.** A identidade cria-se no
Painel do líder da base, como sempre — duplicá-la aqui partia a regra
2 do `CLAUDE.md` raiz (identidade e PIN globais).

Andar para trás é permitido: quem foi marcado como "Membro" por engano
tem de poder voltar, e o histórico regista as duas direções, por isso
não se perde nada ao corrigir. Mover é Cloud Function
(`moverEtapaContacto`), não escrita direta — o histórico tem de ficar
gravado na mesma escrita.

**"Excluir" um contacto** (pedido 2026-09) nunca apaga o documento —
`arquivarContactoPastoral` grava `arquivado:true`, o MESMO campo que a
Base Pessoal já usa no Formulário dela (`arquivarContacto`,
`apps/pessoal/src/lib/contactos.js`). `ouvirContactos` já filtra por
ele dos dois lados, por isso a lista perde o contacto sozinha assim
que a escrita chega — nenhum estado extra a sincronizar. As
`firestore.rules` só deixam `minhaBase('pessoal')` escrever em
`contactos/{id}` (mesmo comentário de sempre: "o painel NÃO escreve
por esta via"), por isso é Cloud Function, como mover de etapa —
nunca escrita direta do painel.

## Trocar o líder de uma base

Pedido 2026-09: "um menu onde o pastor possa alterar os líderes de
cada base". É a exceção mais séria à regra "o painel observa" — a
única escrita deste painel numa base que não é a própria, fora da
ordem/etapa/recado/arquivar acima.

Vive dentro da aba **Bases**, no cartão de cada base já expandido (não
um menu à parte): "Líder da base" mostra o nome, "Trocar" abre
`SheetTrocarLider.jsx`, que lista a equipa ativa dessa base
(`pessoasPastoral()`, a mesma chamada da aba Pessoas — pedida só
quando o sheet abre, não sempre) e grava com `definirLiderBase`.

`definirLiderBase` (functions/pastoral.js) é deliberadamente diferente
de `editarVoluntario` (functions/index.js, o que cada líder já usa
para editar a própria base): essa lê `baseId` do TOKEN de quem chama
(regra 4 do CLAUDE.md raiz) e por isso só mexe na base de quem está
autenticado — não serve para o pastor, cujo `baseId` é sempre
"pastoral". `definirLiderBase` recebe `baseId` como argumento,
protegida por `ve_tudo_pastoral` em vez de "sou desta base", e seguindo
o MESMO invariante de sempre: só um líder de cada vez — promover
alguém demove automaticamente quem lá estava para "voluntario".

Quem for demovido ou promovido só vê os claims mudarem depois de sair
e voltar a entrar (recalculam só em `entrar`/`trocarBase`, mesma
ressalva de sempre neste repo).

## Gráficos

Três regras, e nenhuma é de gosto:

- **Um eixo por gráfico, sempre.** Presenças e oferta são grandezas
  diferentes e vivem em gráficos separados. Sobrepô-las num só, com
  duas escalas, inventaria uma correlação que os dados não têm — é a
  forma mais comum de um painel de gestão mentir sem ninguém reparar.
- **O funil é uma rampa de um tom só** (`CORES_ETAPA`), não seis
  cores. As etapas são um caminho ordenado, não seis identidades: dar
  a cada uma o seu tom seria um arco-íris a codificar uma ordem que já
  está na posição, e em daltonismo os seis tons viram seis cinzentos
  iguais. Os passos saíram de um validador de paletas (lightness
  monótona, salto mínimo entre passos, e o passo mais claro ainda a
  destacar-se do branco — foi esse que reprovou duas vezes), não de
  escolher a olho.
- **O atraso é estado, não série.** Usa as cores `.oc-atraso-*` que a
  ordem do culto ao vivo da Técnica já usa, com os mesmos limiares. Um
  atraso verde num ecrã e laranja no outro seria pior do que não
  mostrar nada. E nunca só cor: leva sempre os minutos por extenso.

`components/Barras.jsx` é o do Financeiro com uma diferença — o
`formatar` entra por prop, porque aqui o valor nem sempre é dinheiro.

## Detalhes já decididos

- **Zero significa zero; "não se aplica" não é zero.** Uma base sem
  checklist mostra `null`, não 0% — aparecer a vermelho todas as
  semanas ensina a ignorar a cor, e aí a cor deixa de servir para o
  resto.
- **Só contagens fechadas entram nas tendências — EXCETO a acomodação.**
  Uma contagem a meio apareceria no gráfico como um domingo fraco, e
  não é isso que aconteceu — é só que ninguém acabou de contar ainda.
  O mapa do auditório é a exceção deliberada (pedido 2026-09): entra
  ao vivo, fechado ou não — `historicoPastoral` lê
  `eventos/{e}/acomodacao/mapa` (`resumoAcomodacaoAoVivo`) sempre que
  não há resumo fechado (`bases/pessoal/acomodacaoResumos/{e}`). A
  diferença é que uma contagem a meio MENTE (parece fraca por estar
  incompleta), mas um mapa a meio já diz a verdade sobre os lugares
  marcados até agora — não há "incompleto" possível na mesma forma.
- **Financeiro e Pastoral nunca "sem escala".**
  `bases/{b}.semEscalaDeCulto = true` marca as duas — nenhuma escala
  ninguém para o culto de domingo, e sem isto apareciam vermelhas
  todas as semanas para sempre (script
  `scripts/marcarBasesSemEscalaDeCulto.mjs`). `resumoDaBase` devolve
  `escalaAplicavel: b.semEscalaDeCulto !== true`; `Bases.jsx` e
  `Domingo.jsx` filtram por ele. `escalasCrossBase`
  (functions/index.js, partilhada com a Backstage) devolve o campo de
  forma aditiva — não muda o que já existia para quem não olha para
  ele.
- **O valor do património é sempre um mínimo conhecido.**
  `valorCompra` é opcional em todo o repo; o ecrã diz quantos itens
  não o têm, em vez de apresentar um número que parece completo.
- **A ordem dos cartões de base é por urgência, não alfabética**
  (`PESOS` em `Bases.jsx`). Dez cartões iguais obrigariam a ler os dez
  todas as semanas para encontrar os dois que interessam. Não é uma
  nota de qualidade da base — é "quão depressa isto estraga um
  domingo".
- **A própria base pastoral não aparece nas vistas cruzadas**
  (`basesDaIgreja` filtra `visaoPastoral !== true`). Não tem escala,
  checklist nem inventário; seria uma linha permanentemente vazia em
  todos os ecrãs.
- Todo sheet leva botão de fechar, mesmo tendo ação primária — regra
  herdada do Financeiro (um popup sem saída visível já foi reportado
  como bug).

## Por fazer / débito consciente

- ~~O mapa de calor da acomodação~~ — feito (`components/MapaCalor.jsx`,
  em Números). Era a quarta peça que estava no repo à espera deste
  painel, e a única que tinha ficado por usar.
- ~~Sem push/email~~ — o push existe desde 2026-09
  (`functions/notificacoes.js`). **Email continua a não existir**: o
  push cobre quem tem a app instalada, e um canal de email precisa de
  um fornecedor e de uma conta — decisão com custo, não uma linha de
  código. Se vier, o sítio é o `notificar()`, que já é o único ponto
  por onde tudo passa.
- **Os agregadores não têm cache.** `panoramaPastoral` são ~9 leituras
  × 10 bases a cada montagem da aba; `historicoPastoral` ganhou mais
  10 leituras por culto em 2026-09 (as escalas, para "Voluntários por
  culto") — num ano isso é ~500 leituras extra numa chamada já cara.
  Com o uso real (uma pessoa, umas vezes por semana) não é problema;
  se um dia a equipa pastoral crescer, o sítio para pôr uma cache de
  minutos é o próprio agregador, não o cliente.
- ~~A contagem da Kinder não entra no "nas salas"~~ — cruzada em
  Números ("Crianças: dois números da mesma coisa"). Compara só Baby e
  Junior/Fun: a New e a SHIFT têm sala própria e não passam pelo
  check-in da Kinder, por isso os **totais** nunca bateriam certo por
  construção, e compará-los daria um alarme permanente e falso.
- **O desgaste conta cultos, não horas.** Quem serve duas bases no
  mesmo domingo conta um domingo — é o mais honesto que os dados
  permitem, mas esconde que essa pessoa esteve lá o dobro do tempo. Se
  um dia isso interessar, é a duração de cada função que falta gravar,
  e isso não existe em lado nenhum hoje.
