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
listener do Firestore (`ouvirOcorrencias`, por exemplo), o filtro
entra na própria query — nunca só na UI — para uma sala restrita
nunca ter os dados de outra na cache local. Já aplicado em: Início,
Check-in (famílias/crianças só da sala, `FormFamilia` com
`salaFixa`), Culto → Chamadas/Checklist/Inventário/Contagem e
Ocorrências, e Lição (lições visíveis e "para que salas" ao publicar
uma nova). `PainelLider.jsx` filtra a lista de voluntários da mesma
forma — uma líder de sala só vê e edita a sua própria equipa.

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
bases/kinder/pessoas/{p}/capacitacoes/{cap}   ← feitaEm, validaAte (registo criminal)
bases/kinder/capacitacoes/{cap}       ← catálogo, só a líder mantém
bases/kinder/familias/{f}             ← só por Cloud Function
bases/kinder/criancas/{c}             ← idem — familiaId, alergias…
bases/kinder/licoes/{id}              ← categorias[], licao/recurso/atividades[] (PDF/foto/.docx), resumo, resumoPais
bases/kinder/checklistSala/{item}     ← texto, categoria, fase abrir|fechar
bases/kinder/ocorrencias/{o}          ← autor lê as suas, líder lê todas
bases/kinder/definicoes/categorias    ← faixas etárias (só sugerem a sala)
bases/kinder/definicoes/consentimento ← texto + versão, a líder edita
bases/kinder/inventario/{item}        ← + sala: "baby"|"fun"|"junior"|"partilhado"
eventos/{e}/escalas/kinder            ← lista simples (guardarEscalaApoio)
eventos/{e}/checkinKinder/{crianca}   ← só por Cloud Function
eventos/{e}/codigosKinder/{familia}   ← idem
eventos/{e}/checklistKinder/{sala}    ← itens marcados, escrita direta
eventos/{e}/contagemKinder/geral      ← correção manual por sala
```

## Check-in — paridade com o My Kids (app usada antes)

Sem impressora (hoje não imprimem etiqueta/pulseira) e sem cartas
colecionáveis (fora da v1, de propósito — ver plano original). O
resto tem equivalente:

- **Registo**: `/registo` (QR na porta, sem sessão) → `pendente`,
  confirmada sozinha no primeiro check-in; ou na receção, por um
  voluntário (`SheetNovaFamilia`) → já `confirmada`.
- **Entrada**: ler o QR do link da família (`LeitorQR.jsx`, câmara —
  `BarcodeDetector` quando existe, senão `jsqr` carregado sob
  demanda) ou procurar pelo nome/telefone. Um código por **família**,
  não por criança — irmãos entram e saem juntos com o mesmo código
  (`checkinKinder`, transação, gera uma vez por família por culto).
- **Saída**: o código tem de bater certo. Sem código, só uma líder
  (`souLider`), e com o motivo — fica registado em
  `saidaForcada.motivo`, nunca em silêncio.
- **Chamar os pais**: telão da sala (aba Chamadas do Culto — o mesmo
  `PainelChamadas` partilhado) e/ou WhatsApp com `linkWhatsApp` (sem
  API paga).
- **Relatórios**: só líderes, em Check-in → Relatórios — presenças
  por sala/mês, famílias novas, tempo médio na sala, quem tem
  alergias/restrições/necessidades.

RGPD: o texto de `definicoes/consentimento` é **placeholder** — tem
de ser validado pela igreja antes de ir para os pais a sério (editar
em Painel → Salas e consentimento). Retenção (crianças sem check-in
há X tempo) ainda não está automatizada — decisão pendente.

## Lição — documento subido à mão, sem automação da Kiwify

As lições chegam da área de membros da Kiwify como documento(s) —
geralmente um PDF, às vezes a foto de uma página impressa ou um
.docx. A API da Kiwify só tem webhooks de pagamento (nenhum de
conteúdo), e a conta do Kinder é de aluna, não de produtora — não há
como saber "saiu documento novo" por fora, nem ligar direto à
Kiwify. Por isso é sempre a líder a descarregar o(s) documento(s) e a
subi-los aqui (`SheetLicao.jsx`, `lib/licoes.js`, para `bases/kinder/
licoes/{id}-<licao|recurso|atividade-N>.<extensão real>` no Storage
— nunca um link) e escolher a(s) sala(s) — muitas vezes Fun e Júnior
partilham a mesma lição.

Até quatro documentos por lição, cada um com o seu botão em
`SheetLicao.jsx`: `licao` (o documento do dia, obrigatório),
`recurso` (opcional) e `atividades[]` (zero ou mais, "+ Atividade").
Cada um é `{url, nome}` ou `null`/`[]`. Na visualização do
voluntário (`Licao.jsx`), cada documento presente ganha o seu botão
— "ABRIR LIÇÃO DO DIA", "ABRIR RECURSO", "ABRIR ATIVIDADE 1",
"ABRIR ATIVIDADE 2" etc. — nunca um botão genérico "Abrir". Editar
uma lição preserva os documentos não trocados (`atividadesAtuais` em
`guardarLicao`, `lib/licoes.js`) — a líder só sobe o que mudou.
Além dos documentos, a lição traz resumo para os voluntários,
materiais a preparar, e um resumo curto para os pais que aparece no
link da família (`resumoPais`).

## Entrada e cartaz de impressão

`Entrada.jsx` agrupa a lista de voluntários por sala (Baby → Fun →
Júnior, com a líder geral e outras pessoas sem sala num grupo
"Liderança" no topo) — quem vai logar já vê primeiro a sua categoria,
em vez de uma lista só. É a única tela do Portal (fora do login) sem
sessão nenhuma, por isso não usa `minhaSalaRestrita` — é só ordenação
para achar o próprio nome mais rápido, não isolamento de dados.

`ImprimirRegisto.jsx` (`/registo/imprimir`) tem cabeçalho "KINDER" e
um seletor de sala embaixo (Baby/Fun/Júnior) para a líder escolher
qual cartaz imprimir; para a líder geral aparecem as três opções,
para uma líder de sala só a sua (`?sala=` na URL, montado em
`PainelLider.jsx` a partir de `minhaSalaRestrita`).

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

- Texto de consentimento e prazos de retenção — validar com a igreja.
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
