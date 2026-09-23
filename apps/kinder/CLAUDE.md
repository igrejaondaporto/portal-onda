# Base Kinder — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack) e o
plano original em `.claude/plans` (2026-09) para o raciocínio completo
por trás das decisões abaixo — este ficheiro é o resumo vivo.

## O que é

O ministério infantil da Onda, dividido em três salas fixas — **Baby**
(0-3 anos, roxo), **Fun** (4-7, amarelo), **Júnior** (8-11, azul) —
cada uma com a sua cor em todos os menus. Líder geral **Maria**
(`lider_base`); uma líder por sala — **Thamirys** (Baby), **Carol**
(Fun), **Larissa** (Júnior) — papel `auxiliar`, com exatamente as
mesmas permissões da líder geral (ver `souLider` em `lib/modelo.js`),
mas presa à sua sala em tudo o que é visibilidade (ver "Isolamento
por sala" abaixo). Chegada 09:00. Uso real: telemóvel na mão, criança
ao colo, com pressa — se um ecrã pede mais de três toques, está mal
desenhado.

Chamadas ("kinder.igrejaonda.pt") já existiam como kiosk sem login
antes desta base nascer — ver "Quatro rotas, um domínio" abaixo.

## Quatro rotas, um domínio

Uma única app Vite (`apps/kinder`), decidida por caminho em
`src/App.jsx` — `not_found_handling = "single-page-application"` no
`wrangler.toml` já devolve o `index.html` para qualquer um destes:

| Rota | Quem usa | Sessão |
|---|---|---|
| `/` (raiz) | Voluntários — o Portal normal | PIN (`entrar`) |
| `/chamadas` | Aparelhos fixos de cada sala | Anónima (kiosk, sem pessoa) |
| `/registo` | Pais, pela primeira vez, pelo QR na porta | Nenhuma |
| `/familia/<token>` | Pais, depois disso — código do dia, dados | Nenhuma (o token é o segredo) |

`/chamadas` é o `KioskChamadas.jsx` de sempre (movido de `App.jsx` para
`src/kiosk/`), sem alterações de comportamento — só ganhou um link
"Entrar no Portal" no fim, que marca `kinder-portal` no
`localStorage` desse aparelho. Sem essa marca, um aparelho que já
escolheu a sua sala continua a abrir direto em `/chamadas` quando
alguém visita a raiz — é assim que os aparelhos fixos das salas
continuam a funcionar exatamente como antes, sem ninguém ter de
reconfigurar nada. `App.jsx` trata sessão anónima como "sem sessão"
(`!utilizador.isAnonymous`), para o kiosk nunca ser confundido com
login do Portal.

## Vocabulário

| Termo | O que é |
|---|---|
| **Sala** (nunca "categoria" na UI) | Baby, Fun ou Júnior — `pessoas/{p}.categoria` no cliente |
| **Líder geral** | Maria. `papel: "lider_base"`. Vê e edita as três salas |
| **Líder de sala** | Thamirys/Carol/Larissa. `papel: "auxiliar"` + `categoria`. Mesmas permissões da líder geral |
| **Família** | `bases/kinder/familias/{f}` — responsáveis + autorizados a levantar |
| **Link da família** | `/familia/<token>` — o que os pais têm em vez de conta |
| **Código de levantamento** | 4 caracteres, por família, por culto — confere na saída |
| **Mestra** | Voluntária escolhida por sala em cada culto (Escala) — não é um papel fixo, mas ganha a permissão da líder em dois pontos, só nesse culto e só na sua sala (ver abaixo) |

## Mestra: permissão da líder, só nesse culto e nessa sala

A Mestra (`eventos/{e}/escalas/kinder.mestras[sala] = pessoaId`,
escolhida na Escala — ver `guardarMestraKinder`) começou como só uma
etiqueta. Ganhou depois a mesma permissão da líder em dois pontos
específicos (2026-09, pedido do líder) — **nunca** um papel geral:

- **Forçar saída sem código** (`Checkin.jsx`/`SheetSaida.jsx`,
  `checkoutKinder` em `functions/kinder.js`) — só na sala em que é
  Mestra nesse culto; uma Mestra da Baby não força saída no Fun.
- **Publicar/editar/remover a lição do dia** (`Licao.jsx`/
  `SheetLicao.jsx`, `guardarLicaoKinder`/`desativarLicaoKinder` em
  `functions/kinder.js`) — só para um culto em que é Mestra de pelo
  menos uma das salas da lição (uma lição sem `eventoId`, ou de outro
  culto, continua só-líder: não há como confirmar Mestra sem culto).

`souMestra(escala, sala, uid)` em `lib/modelo.js` é o helper client-side
(gate de UI, nunca a segurança a sério) — as duas Cloud Functions
confirmam sempre de novo, lendo a Escala do culto no servidor, nunca
confiando no token nem no que o cliente diz. Por isso a lição deixou
de ser escrita direta (`setDoc`/`updateDoc`, como a firestore.rules →
licoes ainda sugere) e passou por Cloud Function — é o único jeito de
dar a mesma permissão da líder a alguém que não tem papel de líder
nenhum, as rules não têm como confirmar isso ficheiro a ficheiro. O
upload do FICHEIRO em si continua direto do cliente para o Storage
(`storage.rules` aceita qualquer pessoa da Kinder nesse caminho — só
o que fica mesmo publicado na app é que passa pela função); um
ficheiro solto sem lição associada é inofensivo. Fora destes dois
pontos (montar a escala, feedback do culto, etc.), Mestra continua
sem permissão nenhuma — só `souLider`.

## Isolamento por sala

Permissão (`souLider`) e visibilidade são coisas diferentes aqui. Uma
líder de sala tem as mesmas permissões da líder geral — mas em
**visibilidade**, fica presa à sua sala como um voluntário: Baby não
vê nada do Fun, Fun não vê nada do Júnior, etc. Só a líder geral
(Maria) vê e mexe nas três. Duas funções em `lib/modelo.js`:

- `souLiderGeral(papel)` — só `lider_base`. É permissão, não
  visibilidade (não confundir com `souLider`, que também inclui
  `auxiliar`).
- `minhaSalaRestrita(papel, pessoa)` — a sala a que a pessoa fica
  limitada em todo o Portal; `null` só para a líder geral.

**ÚNICA EXCEÇÃO: a Escala** (`Escala.jsx`, tela e quadro do mês) —
mostra as três salas a qualquer pessoa, de propósito, e por isso
nunca usa `minhaSalaRestrita`. (A montagem da escala, em
`SheetEscala`/`PainelLider.jsx`, continua a restringir quem cada
líder pode escalar à sua própria sala — isso é uma regra diferente,
já existia antes desta, sobre "montar", não sobre "ver".)

De resto, o padrão em cada tela é sempre o mesmo: quando
`minhaSalaRestrita` devolve uma sala, esconde o seletor de 3 chips e
mostra uma etiqueta fixa (`<p className="kin-tagcat">`); quando
devolve `null` (líder geral), mostra o seletor normal. Onde há
listener do Firestore, o filtro entra na própria query — nunca só na
UI — para uma sala restrita nunca ter os dados de outra na cache
local. Já aplicado em: Início, Check-in (famílias/crianças só da
sala, `FormFamilia` com `salaFixa`, e a visão geral da contagem),
Chamadas, Culto → Checklist/Inventário, e Lição (lições visíveis e "para
que salas" ao publicar uma nova). `PainelLider.jsx` filtra a lista de
voluntários da mesma forma — uma líder de sala só vê e edita a sua
própria equipa.

**Escala é a exceção com quadro próprio**: o quadro grande do mês
mostra os três blocos (Baby/Fun/Júnior) sempre coloridos na cor cheia
da sala, um divisor por bloco (`salasQuadro` em `Escala.jsx`) — e o
nome de quem serve fica sempre em branco, nunca tingido pela sala
(a cor já está no fundo do bloco; só quem és tu fica sublinhado).

A aba "Compras" (`Inventario.jsx` — o nome do ficheiro ficou, só o
rótulo mudou) é a única exceção a "sem sala não vê nada": a lista de
compras (`bases/kinder/listasCompras/{id}`) não tem `categoria`
nenhuma — é sempre a líder geral (Maria) quem compra, para as três
salas. Por isso `ouvirListaCompraFechada` (`lib/inventario.js`) só é
escutado por ela, e um aviso "Lista de compras para rever" aparece no
Início dela sempre que alguém (qualquer líder) fecha uma lista — some
sozinho quando ela a marca como enviada (botão "Enviar para compras",
que abre o WhatsApp sem número fixo, ver `linkListaComprasWhatsApp`).

## Modelo de dados

Ver `src/lib/modelo.js` (a app) e `functions/kinder.js` (famílias/
crianças/check-in — sempre por Cloud Function, nunca escrita direta:
são dados de menores e de saúde, e os pais escrevem sem conta). Fio
condutor: **nunca** ler nada sensível atrás de `autenticado()` sozinho
— essa função dá `true` também para a sessão anónima do kiosk em
`/chamadas`, que corre no mesmo domínio/Firebase. `familias` e
`criancas` exigem sempre `minhaBase('kinder')`.

```
bases/kinder
bases/kinder/pessoas/{p}              ← + categoria: "baby"|"fun"|"junior"|null
bases/kinder/pessoas/{p}/capacitacoes/{cap}   ← comprovanteUrl/comprovanteNome, feitaEm, validaAte (registo criminal)
bases/kinder/capacitacoes/{cap}       ← catálogo, só a líder mantém
bases/kinder/familias/{f}             ← só por Cloud Function; responsaveis[]/autorizados[] com {id, foto}
bases/kinder/criancas/{c}             ← idem — familiaId, alergias…, foto
bases/kinder/licoes/{id}              ← categorias[], licao/recursos[]/atividades[] (PDF/foto/.docx), resumo, resumoPais, louvor
bases/kinder/checklistSala/{item}     ← titulo, subtitulo, horario, categoria, fase pre|durante|pos
bases/kinder/definicoes/categorias    ← faixas etárias (só sugerem a sala)
bases/kinder/definicoes/consentimento ← texto + versão, a líder edita
bases/kinder/definicoes/grupoPais     ← link do grupo dos pais, a líder edita
bases/kinder/inventario/{item}        ← + sala: "baby"|"fun"|"junior"|"partilhado"
eventos/{e}/escalas/kinder            ← lista simples (guardarEscalaApoio)
eventos/{e}/checkinKinder/{crianca}   ← só por Cloud Function
eventos/{e}/codigosKinder/{familia}   ← idem
eventos/{e}/checklistKinder/{sala}    ← itens marcados, escrita direta
eventos/{e}/contagemKinder/geral      ← correção manual por sala
```

**Capacitações — comprovativo, não um "marquei que fiz".** Em vez de
um toggle "Já fiz"/"Já entreguei", a pessoa sobe o próprio documento
que prova a entrega (o certificado de registo criminal digitalizado,
uma foto do certificado do curso…) — `enviarComprovanteCapacitacao`
(`lib/kinder.js`) comprime se for imagem e sobe para
`bases/kinder/pessoas/{uid}/capacitacoes/{capId}.<jpg|pdf>`
(`storage.rules`, só a própria pessoa e a líder da base, nunca
`minhaBase` sozinho — mais sensível que a foto de perfil ao lado).
`estadoCapacitacao` passa a decidir "falta"/"ok"/"caducada" pelo
`comprovanteUrl`, não pelo `feitaEm` — sem comprovativo, está em
falta, mesmo que alguém tenha marcado a data à mão antes. "Remover"
limpa o campo (fica o documento em `capacitacoes/{p}/{cap}`, com
quem mexeu — nunca um delete a sério). Em "A equipa" (só líder), "Ver
quem falta" mostra também o nome de quem já entregou como link direto
para o ficheiro — sem isso, exigir comprovativo não serviria de nada
se a líder não pudesse mesmo abri-lo.

## Foto da criança e de cada responsável/autorizado

Para o voluntário reconhecer quem é quem à entrada ("Na sala agora",
`Checkin.jsx`) e confirmar quem vem buscar à saída (`SheetSaida.jsx`)
— pedido do líder, 2026-09. `FormFamilia.jsx` é o ponto único onde se
sobe (registo, receção, edição pelos pais ou pelo líder — as quatro
situações ganham a foto de uma vez, é o mesmo componente).

Os pais **não têm sessão nenhuma** (registo e link da família são
sem conta) — não há como um `storage.rules` deixá-los escrever
direto no Storage. Por isso a foto nunca sobe do cliente: comprime-se
no browser (`comprimirImagem`) e viaja em base64 dentro do próprio
pedido a `registarFamiliaKinder`/`editarFamiliaKinder`; é a função,
com o Admin SDK (`guardarFotoPessoa`, `functions/kinder.js`, `sharp`
redimensiona sempre para 480×480), que sobe ao Storage — o único
caminho que serve pais e voluntários da mesma forma. `storage.rules`
tem as duas regras (`bases/kinder/criancas/{f}`, `bases/kinder/
familias/{fam}/pessoas/{f}`) só como documentação/defesa — o link
devolvido já leva o próprio token de leitura, nunca passa pelas
regras a sério.

Criança tem um `foto` direto no documento; responsável e autorizado
não têm documento próprio (são só um array na família) — por isso
ganham um `id` (gerado no cliente, `crypto.randomUUID()`, na
primeira vez; devolvido e reenviado nas edições seguintes) que dá um
caminho estável à foto de cada um. Um item do payload sem
`fotoBase64` nem `removerFoto` nunca é tocado — o servidor lê o que
já lá estava (`resolverFotosPessoas`) antes de reescrever o array
por inteiro, senão editar um perdia a foto de outro.

## Check-in — paridade com o My Kids (app usada antes)

Sem impressora (hoje não imprimem etiqueta/pulseira) e sem cartas
colecionáveis (fora da v1, de propósito — ver plano original). O
resto tem equivalente:

- **Registo**: `/registo` (QR na porta, sem sessão) ou na receção,
  por um voluntário (`SheetNovaFamilia`) — os dois ficam `estado:
  "confirmada"` já ao registar, sem passo de confirmação nenhum
  (decisão de 2026-09: registo livre, sem fricção — antes ficava
  `pendente` até ao primeiro check-in). `confirmarFamiliaKinder` foi
  removida; o bloco em `checkinKinder` que confirmava uma família
  `pendente` sozinha fica só para dados antigos, nunca apagado.
- **Entrada**: ler o QR do link da família (`LeitorQR.jsx`, câmara —
  `BarcodeDetector` quando existe, senão `jsqr` carregado sob
  demanda) ou procurar pelo nome/telefone. Um código por **família**,
  não por criança — irmãos entram e saem juntos com o mesmo código
  (`checkinKinder`, transação, gera uma vez por família por culto).
  Funciona a qualquer hora, mesmo sem `eventos/{AAAA-MM-DD}` criado
  para hoje (de propósito, decisão de 2026-09: testar/ensaiar fora de
  domingo não deve ficar bloqueado). Se o QR disser "não encontrada"
  mas a família tiver acabado de se registar, `aoLerQR` (Checkin.jsx)
  confirma no servidor (`obterFamiliaDoServidor`, `getDocFromServer`)
  antes de desistir — a escuta ao vivo local pode não ter sincronizado
  ainda.
- **Todas as famílias**: secção colapsável no fim do Check-in (mesmo
  filtro por sala de tudo o resto) — é onde se vê quem já está
  registado, sem precisar de procurar pelo nome.
- **Saída**: o código tem de bater certo. Sem código, só uma líder
  (`souLider`) — ou a Mestra da sala dessa criança nesse culto (ver
  "Mestra" acima) —, e com o motivo — fica registado em
  `saidaForcada.motivo`, nunca em silêncio. Já saída, um ✕ ao lado
  do nome (`.oc-icobt.mag`) chama `anularCheckinKinder` direto da
  lista "Já saíram" — mesma permissão de sempre (líder ou quem fez o
  check-in).
- **"Visão geral" e "Na sala agora"** têm fundo verde-água
  (`.kin-atencao`, `kinder.css`) — as duas únicas secções que mostram
  quem está NA SALA agora, de propósito diferentes do resto do ecrã
  (histórico, procura…), que fica sem fundo nenhum.
- **Chamar os pais**: telão da sala (menu Chamadas, próprio na barra
  de baixo — o mesmo `PainelChamadas` partilhado, ver `Chamadas.jsx`)
  e/ou WhatsApp com `linkWhatsApp` (sem API paga).
- **Contagem**: a "visão geral" (quantas crianças em cada sala,
  corrigível à mão) vive direto no Check-in, sempre visível — deixou
  de ter aba própria dentro do Culto. As "Ocorrências" (queda, febre…)
  saíram de propósito: chamar os pais já é o menu Chamadas.
- **Relatórios**: qualquer líder abre (Check-in → Relatórios, botão
  gate `souLider` — não `souLiderGeral`; era só a líder geral e uma
  líder de sala ficava sem ver o histórico de nenhum culto passado,
  corrigido 2026-09) — presenças por sala/mês (de qualquer domingo já
  passado, não só o de hoje), famílias novas, tempo médio na sala,
  quem tem alergias/restrições/necessidades. Uma líder de sala
  (`restrita`) só vê a própria sala em tudo isto, mesmo isolamento do
  resto do Check-in; só a líder geral vê as três. Cada linha de culto
  abre (toca) para a lista de registos desse domingo — cada criança,
  a que horas entrou/saiu, quem a levantou, se saiu sem código e o
  motivo, e os check-ins anulados (marcados, nunca escondidos); os
  números da linha (Total, por sala…) continuam a excluir os
  anulados, só a lista aberta os mostra.

## Membro da Onda e grupo dos pais

No registo (`/registo`, e na receção por um voluntário —
`SheetNovaFamilia`), além de "primeira vez na Onda" há um checkbox
"Somos membros da Igreja Onda" (`FormFamilia.jsx`, campo `membro` na
família — nunca tocado depois por uma edição, mesmo padrão do
`visitante`: só a Cloud Function de registo o grava). Quem se disser
membro vê, no fim do registo, um botão para entrar no grupo dos pais
do Kinder — só aparece se a líder tiver definido o link (Painel →
Salas e consentimento → "Link do grupo dos pais", `definicoes/
grupoPais`, devolvido por `dadosRegistoKinder`); vazio = o botão nem
aparece. Sem grupo nenhum criado ainda por omissão — é a líder que
cola o link quando o grupo existir.

RGPD: o texto de `definicoes/consentimento` é o padrão que a igreja
decidiu (2026-09) — a líder pode sempre ajustar em Painel → Salas e
consentimento, mas mudar o número de meses ou o que é dito sobre a
foto pede também mudar `MESES_RETENCAO`/`CONSENTIMENTO_PADRAO` em
`functions/kinder.js`, para o texto continuar a bater certo com o
que a função faz a sério.

**Retenção — apaga a sério, não é `ativo:false`.** Única excepção à
regra 5 do repositório: `purgarFamiliasInativasKinder`
(`functions/kinder.js`, agendada, todos os dias) apaga família,
crianças e as fotos no Storage de quem não faz check-in nenhum há
`MESES_RETENCAO` (6) — quem voltar tem de se registar de novo. Conta
por `ultimoCheckinEm` (atualizado em cada `checkinKinder`); sem
nenhum ainda, é `criadoEm` que decide. O consentimento já avisa a
família disto — é essa avisa que torna a exclusão a sério aceitável
aqui, ao contrário do resto do Portal.

## Lição — documento subido à mão, sem automação da Kiwify

As lições chegam da área de membros da Kiwify como documento(s) —
geralmente um PDF, às vezes a foto de uma página impressa ou um
.docx. A API da Kiwify só tem webhooks de pagamento (nenhum de
conteúdo), e a conta do Kinder é de aluna, não de produtora — não há
como saber "saiu documento novo" por fora, nem ligar direto à
Kiwify. Por isso é sempre a líder a descarregar o(s) documento(s) e a
subi-los aqui (`SheetLicao.jsx`, `lib/licoes.js`, para `bases/kinder/
licoes/{id}-<licao|recurso-N|atividade-N>.<extensão real>` no Storage
— nunca um link) e escolher a(s) sala(s) — muitas vezes Fun e Júnior
partilham a mesma lição.

A aba "Lições" mostra um bloco por culto do mês (estilo Escala —
`CartaoCulto` partilhado, com navegação de mês `‹ ›`), fechado por
omissão, com as lições desse dia lá dentro; quem não tiver
`eventoId` (ou for de um culto fora do mês visível) cai numa secção
"Sem culto marcado" à parte, sempre visível, para nunca desaparecer.
`Licao.jsx` recebe `mes`/`ano`/`mudarMes` de `Sessao.jsx` — o mesmo
"mês atual" partilhado com Início/Escala/Culto, não um estado à
parte.

Documento da lição do dia (`licao`, obrigatório, 1 só) mais
`recursos[]` e `atividades[]` — cada um zero ou mais, com o seu botão
"+ Recurso"/"+ Atividade" em `SheetLicao.jsx` para acrescentar quantos
precisar (ex.: mais de um PDF de recurso na mesma lição). Cada entrada
é `{url, nome}`. Na visualização do voluntário (`Licao.jsx`), cada
documento presente ganha o seu botão — "ABRIR LIÇÃO DO DIA", "ABRIR
RECURSO" (ou "ABRIR RECURSO 1"/"2"/… quando há mais de um), "ABRIR
ATIVIDADE 1"/"2" etc. — nunca um botão genérico "Abrir". Editar uma
lição preserva os documentos não trocados (`recursosAtuais`/
`atividadesAtuais` em `guardarLicao`, `lib/licoes.js`) — a líder só
sobe o que mudou. Além dos documentos, a lição traz resumo para os
voluntários, materiais a preparar, um campo de Louvor (músicas/bandas
que a líder indica para o culto, texto livre) e um resumo curto para
os pais que aparece no link da família (`resumoPais`). Os botões do
detalhe têm cor própria: Lição do dia em verde (`var(--verde)`),
Recursos em azul (`var(--azul)`), Atividades no estilo secundário de
sempre.

**Sem compressão nenhuma** (nem de PDF nem de .docx — só imagem tem
`comprimirImagem`, e mesmo essa não entra aqui) e até 20 MB por
documento (`storage.rules` + `SheetLicao.jsx`), sem limite de quantos
recursos/atividades uma lição pode ter — um culto sozinho pode chegar
perto de 100 MB (lição + vários recursos + várias atividades).
Decisão da igreja (2026-09): em vez de comprimir (arriscado para PDF,
ganho pequeno), os ANEXOS (nunca a lição em si — título, resumo e
resumo para os pais ficam) de lições com mais de
`MESES_RETENCAO_LICOES` (3) são apagados a sério do Storage por
`purgarAnexosLicoesAntigasKinder` (`functions/kinder.js`,
`onSchedule`, corre todos os dias — mesmo padrão de
`purgarFamiliasInativasKinder`); o documento fica com
`licao`/`recursos`/`atividades` a `null`/`[]` e um `anexosExcluidosEm`.
O caminho a apagar vem do próprio `url` guardado (nunca precisa de
reconstruir o nome, que varia com a extensão real do ficheiro) —
`caminhoDeUrlStorage()` extrai o caminho do download URL do Firebase.

## Quantas crianças estão presentes — popup no Início

Pedido 2026-09: "logo NA TELA inicial do domingo já apareça um POP UP
GRANDE perguntando quantas crianças estão presentes... e essa
contagem já vai direto pra contagem da base pessoal, que também já
apareça na contagem do Painel Pastoral." `ContagemCriancas.jsx`
(`components/`), montado no topo do Início.

**Não é o check-in.** É um número manual, rápido, por sala — nada a
ver com `CHECKIN_ATIVO`/famílias/QR (esse continua desligado por
pedido da líder, ver "O que este base tem" mais abaixo). Escreve
direto em `eventos/{e}/contagem/geral` — a Contagem da Base Pessoal,
não `eventos/{e}/contagemKinder` (essa é a correção do check-in ao
vivo, outra pergunta, hoje sem uso). Cloud Function
`registarContagemSala` (`functions/contagemSalas.js`, partilhada com
SHIFT e New) valida que só se escreve a categoria certa
(`baby`/`fun`/`junior`) e, para quem não é líder geral, só a da
própria sala (`bases/kinder/pessoas/{uid}.categoria`) — mesmo
isolamento por sala do resto da app.

O popup aparece sozinho, uma vez por domingo, enquanto faltar alguma
sala por preencher (a líder geral vê as três; uma líder de sala só a
sua). Depois de preenchido fica um cartão (`.kin-num`, a paleta suave
da sala — já "menos vibrante" por natureza); por preencher usa a cor
cheia (`.kin-num.porfazer`) para continuar a chamar a atenção mesmo
que o popup tenha sido fechado sem preencher. Tocar reabre o mesmo
popup para corrigir.

## Checklist da sala — Pré-culto/Durante/Pós-culto

Mesmo padrão de fases das outras bases (Apoio, Backstage,
Comunicação…): `FASES` em `lib/modelo.js`, `pre|durante|pos` →
"Pré-culto"/"Durante o culto"/"Pós-culto" — nunca "ao abrir"/"ao
fechar a sala" (versão antiga, trocada 2026-09). Cada item
(`bases/kinder/checklistSala/{id}`) tem `titulo`, `subtitulo`
(opcional) e `horario` (opcional, "HH:MM") — a linha mostra sempre o
horário primeiro, `"09:00 · Higienizar brinquedos"`, com o subtítulo
por baixo. Escrita direta do cliente (`criarItemChecklist`,
`lib/kinder.js`), só a líder cria/remove; qualquer voluntário marca —
a marca (`eventos/{e}/checklistKinder/{sala}`) funciona sem rede,
sincroniza quando a ligação voltar (a Casa do Povo nem sempre tem
sinal).

`ItensChecklist.jsx` (`components/sala/`) é o render partilhado —
fases + itens + checkbox — usado por `ChecklistSala.jsx` (a página em
Culto, com o formulário de "+ item" e o "✕" de remover, só para a
líder) e por `Inicio.jsx` (só ver e marcar, sem gerir o catálogo,
`mostrarFasesVazias={false}` para não mostrar "Pós-culto 0/0" antes
de a líder criar itens nessa fase). Pedido do líder (2026-09): os
itens da checklist da minha sala aparecem direto no Início, iguais ao
resto do que outras bases já mostram lá — não só o atalho para a
página.

## Entrada e cartaz de impressão

`Entrada.jsx` agrupa a lista de voluntários por sala (Baby → Fun →
Júnior, com a líder geral e outras pessoas sem sala num grupo
"Liderança" no topo) — quem vai logar já vê primeiro a sua categoria,
em vez de uma lista só. É a única tela do Portal (fora do login) sem
sessão nenhuma, por isso não usa `minhaSalaRestrita` — é só ordenação
para achar o próprio nome mais rápido, não isolamento de dados.

`ImprimirRegisto.jsx` (`/registo/imprimir`) tem cabeçalho "KINDER -
BABY/FUN/JÚNIOR" (o nome da sala ao lado do "KINDER", não mais numa
etiqueta em baixo) e, quando não vem `?sala=` fixo na URL, um
seletor para a líder geral escolher qual cartaz imprimir; uma líder
de sala cai direto na sua (`?sala=`, montado em `PainelLider.jsx` a
partir de `minhaSalaRestrita`). O nome da sala "BABY" fica sempre num
verde-água (`#5be7c4`) — pedido do líder; as outras salas ficam a
branco, como o resto do cabeçalho.

## O que este base tem, que nenhuma outra tem

- **Papel `auxiliar` fora da Louvor** — `BASES_COM_AUXILIAR` em
  `functions/index.js` passou a incluir `"kinder"`. `souLiderBase`
  (rules) e `PAPEIS_LIDER` (functions) já tratavam "auxiliar" de
  forma genérica; só faltava esta base entrar na lista.
- **Sessão anónima partilhada com o Portal** — nenhuma outra base tem
  um kiosk sem login no mesmo domínio/Firebase que o Portal com PIN.
  Qualquer regra nova nesta base tem de perguntar "e se for a sessão
  anónima do kiosk?", não só "e se for outra base?".
- **Escrita sem sessão nenhuma** (`/registo`, `/familia/<token>`) —
  as únicas Cloud Functions do repo chamadas por quem não tem conta
  nenhuma. Limitadas por IP (`limitarRegistoPublico`) e pelo token
  (hash guardado, nunca em claro).

## Detalhes ainda por fechar com a líder

- Texto de consentimento — a igreja já fechou o prazo de retenção
  (6 meses) e a menção à foto (2026-09); o resto do texto continua
  livre para a líder ajustar.
- Se/quando imprimir etiqueta ou pulseira (hoje não imprimem).
- Cor da base para a Backstage (`bases/kinder.cor` — hoje o roxo do
  Baby, `#7B5CFF`, escolhido por não colidir com nenhuma outra base).
- Nomes/telefones reais dos voluntários de cada sala (entram pelo
  Painel do líder, nunca por seed — ver `garantirIdSemColisao`).

## Testar localmente

`node scripts/teste-kinder-emulador.mjs` corre 25 verificações contra
os emuladores (registo, link, check-in, saída, regras, papel
auxiliar) — nunca contra produção. `node scripts/seed-kinder-emulador.mjs`
semeia o mínimo para testar a app manualmente (líderes, uma
voluntária, capacitações) — precisa dos emuladores no ar primeiro
(ver a memória "Gotchas do Firebase local": JDK 21+).
