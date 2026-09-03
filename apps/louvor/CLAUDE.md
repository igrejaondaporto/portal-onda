# Base de Louvor — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A banda e ministração do culto. Chegam às 07:00 de domingo (afinação
e passagem de som), o culto é às 10:30 na Casa do Povo de Vermoim.
Além de servir no culto, esta base mantém a **biblioteca de músicas**
da Onda e monta o **repertório** de cada domingo — a Base Técnica lê
o repertório para a projeção.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em produção em `louvor.igrejaonda.pt`. As seis abas (Início, Escala,
Culto, Equipamentos, Biblioteca, Repertório) todas funcionais.
Biblioteca já com resolução automática de tom/BPM/links na busca por
nome (ver secção 5); cadastro manual continua possível a qualquer
momento. "Solicitar BG" à Comunicação está ligado (item "A base" no
Início, só para o líder — mesmo componente partilhado que Apoio/
Técnica/Backstage já usavam).

**Deliberadamente fora desta entrega** (mais simples do que o
`CLAUDE.md` original da biblioteca previa, para caber num primeiro
lançamento):
- **Enquete de indisponibilidade + sugestor de escala** ("Montar") —
  o schema/Cloud Functions já são genéricos (ver `CLAUDE.md` raiz,
  "O que NÃO precisa de mudar"), só falta portar se vier a fazer
  falta.

Repertório reordena por arrasto (Pointer Events lavrados à mão, sem
dependência nova — pega pelo ⠿ à esquerda de cada item) **e** pelas
setas ↑/↓, os dois lado a lado (`src/pages/Repertorio.jsx`).

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo (Adriel). Vê e edita tudo, em qualquer data |
| **Auxiliar** | Papel na base (`pessoas/{id}.papel`), não da escala — mesmas funções do líder da base, ver "Auxiliar" abaixo |
| **Líder de escala** | Rotativo, um por culto |
| **Escala** | Quem serve em cada culto, e em que papel |
| **Papel** (da escala) | Lead, Co-lead, Back, Teclado, Guitarra, Baixo ou Bateria — não há titular/aprendiz, o líder de escala escolhe livremente quantos por papel |
| **Música** | Título + artista — um cover de outro artista é música separada, nunca uma versão |
| **Versão** | Um arranjo da música (tom, BPM, duração, observação) — só o Adriel marca a "versão padrão da Onda" |
| **Repertório** | A lista de músicas e momentos de um domingo |
| **Momento** | Item do repertório que não é música (Ceia, Oferta…) |
| **Culto** | O evento. Domingos 10:30, mais especiais |

Não digas "líder do dia", "turno", "ministério" (a Louvor não tem
ministérios, tem papéis) nem "faixa" (é "música") na interface.

## Escala: papéis, sem titular/aprendiz

```js
eventos/{e}/escalas/louvor
  liderEscala: "adriel-louvor"
  escalados: [
    { papel: "lead", pessoaId: "..." },
    { papel: "back", pessoaId: "..." },
    { papel: "guitarra", pessoaId: "..." },
  ]
  pessoas: [...]                                // união plana, recalculada no servidor
  enfase: "ceia" | "contribua" | "familia"       // ver ENFASES em lib/modelo.js
  coresRoupa: ["#0092D4", "#D8F24B"]             // 1 a 3 hex
  dataEnsaio: "2026-09-10" | null
  observacaoLider: "texto livre" | null
```

Os sete papéis são uma lista fixa em código (`src/lib/modelo.js`,
`PAPEIS`, cada um com emoji — 🎤 para os três de vocal, 🎹/🎸/🎸/🥁
para os instrumentos) — sem catálogo no Firestore, sem CRUD. Mudar a
lista é editar ali (e a cópia server-side em `functions/index.js`,
`PAPEIS_LOUVOR`, usada por `guardarEscalaLouvor` para validar). Uma
pessoa não pode ocupar dois papéis no mesmo culto. Sem níveis:
qualquer voluntário serve em qualquer papel que o líder lhe atribuir.
"Vocal" virou três papéis em 2026-09 (Lead/Co-lead/Back, pedido do
líder) — escalados antigos com `papel:"vocal"` continuam gravados,
só perdem o nome bonito.

`enfase`/`coresRoupa`/`dataEnsaio`/`observacaoLider` são gravados
pela Cloud Function `definirDetalhesCultoLouvor` (`lib/culto.js`),
separada de `guardarEscalaLouvor` — editar "quem serve" e editar
"detalhes do culto" são gestos distintos. `enfase` tem um default
calculado no cliente quando ainda não foi definida (`enfaseDefault`
em `lib/modelo.js`): primeiro domingo do mês é sempre Ceia, os outros
começam em Culto da Família — o líder troca livremente depois.

O cartão de cada culto em Escala (`Escala.jsx`, `DetalhesCulto`)
mostra tudo isto em caixinhas separadas, cada uma com uma cor leve de
fundo — Escala (quem serve), Repertório (resumo com tom), Roupa (🧥
+ cores), Ensaio (🏋️ em negrito) e Observação — todas dentro do
mesmo cartão grande do culto (`packages/shared/CartaoCulto.jsx`, que
só é a casca; o conteúdo é todo desta base, via `children`).

Cada pessoa tem também `instrumentos: string[]` no perfil (os mesmos
ids de `PAPEIS`, pode ter mais do que um — ver `SheetPessoa.jsx`),
opcional e só informativo: ao montar a escala (`SheetEscala.jsx`), os
voluntários aparecem agrupados por instrumento, um bloco por papel,
"como se fosse um ministério" — mas isso é só filtro de exibição,
**não** trava quem o líder pode escalar em quê. Quem ainda não tem
instrumento no perfil cai num bloco "Sem instrumento definido", com o
seletor de papel manual de sempre. Campo aceite por `criarVoluntario`/
`editarVoluntario` (genéricas, `functions/index.js`) sem validação de
enum — mesmo tratamento que `ministerios`/`nivel`/`cargo` já têm nas
outras bases.

## Auxiliar — papel na base, não papel de escala

`pessoas/{id}.papel` passou a ter três valores nesta base (as outras
continuam com dois): `"voluntario"`, `"auxiliar"`, `"lider_base"` —
ver `PAPEIS_BASE` em `lib/modelo.js`, escolhido no mesmo seletor de
sempre em `SheetPessoa.jsx`. **Auxiliar tem exatamente as mesmas
funções do líder da base** (pedido do líder, 2026-09) — acede ao
Painel do líder, edita voluntários, publica avisos, tudo. A única
diferença é o nome.

Implementado sem tocar no formato do token para as outras bases:
`papel:"auxiliar"` só é aceite pelas Cloud Functions quando
`baseId === "louvor"` (`validarPapelBase`, `functions/index.js`) —
noutra base cai no mesmo erro de "papel inválido" que qualquer valor
desconhecido. Como nenhuma outra base consegue produzir esse valor,
é seguro tratar "auxiliar" de forma genérica em três sítios
partilhados por todas as bases, sem criar um caso especial só da
Louvor neles:
- `exigeLider`/`PAPEIS_LIDER` (`functions/index.js`) — líder-only em
  qualquer Cloud Function genérica.
- `souLiderBase(b)` (`firestore.rules`) — líder-only em qualquer
  regra genérica (ex.: `avisos`, `musicas`).
- `MenuEu.jsx` (`packages/shared`) — mostra "Painel do líder" no menu.

No cliente da Louvor, use sempre `souLiderOuAuxiliar(papel)`
(`lib/modelo.js`) em vez de comparar `papel === "lider_base"` direto
— é o que todas as telas desta base já fazem.

## Culto: Ordem, Feedbacks — Equipamentos é aba própria

Duas sub-abas dentro de Culto (`src/pages/Culto.jsx`), ecrã genérico
partilhado com Apoio/Técnica (nada de especial aqui). **Equipamentos**
já foi uma terceira sub-aba aqui, mas ganhou aba própria na barra de
baixo (2026-09) — é o "Inventário em modo património" da Técnica
(`bases/louvor/inventario/{item}`, Cloud Functions `criarEquipamento`/
`guardarEquipamento`/`desativarEquipamento`, genéricas por `baseId` —
nenhuma função nova precisou de ser escrita) com o agrupamento por
ministério trocado pelos cinco papéis da escala (ver `PAPEIS` acima)
em vez de uma coleção `ministerios` — um amplificador ou um microfone
tem um papel, não um ministério.

Dentro de Equipamentos (`src/pages/Equipamentos.jsx`), duas sub-abas
próprias: **Equipamentos** (o catálogo, agrupado por papel — o botão
"Reportar avaria"/"Reportar melhoria" fica visível nas duas) e
**Melhorias** (tudo o que os dois botões de reportar criam —
`bases/louvor/melhorias/{id}`, mesma coleção para avaria e melhoria,
só `gravidade` muda —, com "A precisar de atenção" primeiro e "Já
resolvidas" fechado no fim). Já foi um ecrã só (ver comentário no
código) — voltou a separar-se a pedido do líder; o que evita perder a
"visão completa de um equipamento" é o estado de avaria continuar
inline no catálogo e a ficha do equipamento (`SheetEquipamentoDetalhe`)
continuar a mostrar o histórico de melhorias ligado a ele.

## Biblioteca e Repertório

O que está abaixo é o documento de decisões original desta
funcionalidade, escrito antes de qualquer código — continua a valer
para o modelo de dados e as decisões de produto. A única mudança real
é a Fase 1 (secção "Estado" acima): sem `resolverMusica`.

### 1. Escopo da v1

**Dentro:**
- Biblioteca de músicas com busca, filtro por classificação e histórico de uso
- Cadastro de música nova com capa automática do Deezer (tom/BPM/links à mão nesta fase)
- Versões por música (tom, BPM, duração, observação)
- Montagem do repertório do domingo, com momentos intercalados
- Compartilhamento do repertório com a projeção (leitura pela Base Técnica)

**Fora (fica para depois):**
- Escala de voluntários por instrumento — **feito**, ver secção "Escala" acima
- Tela de leitura do repertório: mora no painel da Técnica, não aqui
- Integração com a timeline de ordem de culto do Painel Kinder
- Letra em texto (o FreeShow já resolve; guardamos só o link)

**Não usamos a API do LouveApp em produção.** Existe parceria de
parceiro aprovada (`songs:read`), mas ela só dá leitura ao repertório
que a própria igreja já cadastrou *dentro do LouveApp* — não é uma
busca na biblioteca geral deles (a API não tem esse endpoint; só
`/songs` amarrado ao `ministryToken`, nunca um catálogo global). Não
serve para "buscar música nova com tom/BPM", que é o que a Biblioteca
precisa — por isso a integração foi desfeita (ver git log por
"LouveApp" se for retomada). A migração de repertório continua
pontual e manual (ver "Importação do LouveApp" abaixo).

### 2. Decisões fechadas

| # | Decisão |
|---|---|
| 1 | Identidade da música = título + artista. Cover de outro artista é **música separada**, não versão. |
| 2 | Cadastrar música nova é só líder/auxiliar (2026-09, era qualquer membro — ver §6). Adicionar versão a uma música já existente continua aberto a todos. |
| 3 | Só o **Adriel** (líder) marca a versão padrão da Onda. |
| 4 | Repertório: um por domingo. Qualquer membro monta. |
| 5 | Sem estado rascunho. O repertório fica compartilhado com a projeção assim que existe, com selo de "atualizado há X". |
| 6 | Momentos são itens da lista, intercalados com músicas. Momento vazio continua aparecendo. |
| 7 | A mesma música pode entrar duas vezes no repertório em versões diferentes. |
| 8 | O que a projeção enxerga: nome, artista, link, momentos e o selo de atualização. Não vê tom, BPM nem observações. A tela que consome esses dados fica no painel da Técnica (ainda por construir). |
| 9 | Duplicata: ao detectar título+artista já existente, perguntar "é uma versão nova?" e mostrar a música já cadastrada. Nunca bloqueia. |
| 10 | Classificações são **múltiplas** por música (toggles). |
| 11 | Autorais sem plataforma: cadastro manual, o líder cola o link que tiver. Sem upload de arquivo. |
| 12 | Histórico conta por **música**, não por versão. |
| 13 | Capa vem do Deezer, é comprimida (WebP 250px, qualidade 80) e copiada para o Storage (`bases/louvor/capas/{musicaId}.webp`). |
| 14 | Uma vez resolvida e confirmada, a música **nunca mais** consulta API externa. |

### Classificações (do LouveApp, confirmadas)

`Adoração` · `Alegria` · `Consagração` · `Contemplação` · `Especiais` · `Louvor` — ver `src/lib/biblioteca.js`, `CLASSIFICACOES` (com o texto de ajuda de cada uma).

### 3. Modelo de dados (Firestore)

```
bases/louvor/musicas/{musicaId}
  titulo, artista, chaveIdentidade, slug
  classificacoes: string[]
  duracao, capaUrl, capaOrigem: "deezer"|"manual"|"placeholder"
  deezerId, previewUrl, links: { letra, cifra, audio, video }
  autoral, criadoPor, criadoEm
  ultimaVezTocada, vezes90d        ← escrito pela trigger aoGravarRepertorioLouvor
  versaoPadraoId                    ← só o líder escreve (ver firestore.rules)

bases/louvor/musicas/{musicaId}/versoes/{versaoId}
  nome, tom, bpm, duracao, observacao
  fonteTom, fonteBpm: "manual", "cifraclub" ou "audio" — ver secção 5
  (cadastro à mão continua a permitir editar por cima)

bases/louvor/repertorios/{eventoId}     ← o próprio id do culto, "um por domingo"
  itens: [{ tipo:"musica", id, musicaId, versaoId } | { tipo:"momento", id, nome }]
  montadoPor, atualizadoEm, atualizadoPor
```

Array de itens, não subcoleção: no máximo ~20 itens, uma escrita só
por edição (ver `src/lib/repertorio.js`).

> **Compatibilidade com o Painel Kinder.** O campo `nome` do momento
> usa a mesma nomenclatura das seções da spec de ordem de culto — a
> ponte ainda não existe, mas o vocabulário já está alinhado.

### 4. Sincronização e cache

A biblioteca fica abaixo de 500 documentos: `ouvirMusicas`
(`src/lib/biblioteca.js`) carrega tudo com `onSnapshot` uma vez;
busca e filtros correm no cliente. As versões de uma música só são
lidas quando essa música é aberta (`ouvirVersoes`).

### Importação do LouveApp

O export vem em `.xlsx` com este cabeçalho:

```
nomeMusica | nomeArtista | observacaoMusica | nomeVersao | observacaoVersao |
tom | bpm | duracao | classificacoes | letra | cifra | audio | video | referencias
```

Mapeamento:

| Coluna | Destino |
|---|---|
| `nomeMusica`, `nomeArtista` | `musicas.titulo`, `musicas.artista` |
| `observacaoMusica` | observação da versão importada |
| `nomeVersao`, `observacaoVersao` | `versoes.nome`, `versoes.observacao` |
| `tom`, `bpm`, `duracao` | `versoes.*`, com `fonteTom`/`fonteBpm` = `"louveapp"` |
| `classificacoes` | `musicas.classificacoes` (separar por vírgula) |
| `letra`, `cifra`, `audio`, `video` | `musicas.links` |

Regras:
- **URLs mobile** (`m.letras.mus.br`, `m.cifraclub.com.br`) são mantidas — 95% do acesso é celular.
- **Parâmetros `#key=` são mantidos** nas músicas importadas (o tom já vem certo do LouveApp). Nas músicas novas cadastradas depois, o link é gerado limpo, e o tom da versão aparece ao lado do botão para o líder transpor no Cifra Club.
- **Capas não vêm no export** — resolvidas em lote pelo script, uma busca no Deezer por música (mesma função que `buscarCapaDeezer`/`processarCapaMusica` usam, chamada direto via Admin SDK em vez de `onCall` — o script não tem sessão de utilizador). Sem correspondência clara, fica placeholder; o líder resolve depois pela Biblioteca.
- Linhas com o mesmo `nomeMusica` + `nomeArtista` viram **uma música com várias versões** (`chaveIdentidade` é quem decide, não o texto exato da linha).
- Roda uma vez, direto no Firestore de produção (Admin SDK, como os outros `scripts/seed*.mjs`) — repetir não duplica: música existente (mesma `chaveIdentidade`) ganha só a versão nova, se `nomeVersao` também for novo.

Script: `scripts/importarLouveAppLouvor.mjs <ficheiro.xlsx>`. Só precisa do `service-account.json` na raiz (já existe) e do export do LouveApp.

## 5. Resolução automática — capa e busca por nome

**Capa:** `buscarCapaDeezer` (callable) procura no Deezer público,
sem chave, e devolve candidatos (capa, duração, preview). Nada é
gravado até o cadastro ser confirmado. `processarCapaMusica`
(callable) baixa a capa escolhida, converte para WebP 250px/q80
(`sharp`, `functions/package.json`) e copia para o Storage — grava
`capaUrl`/`capaOrigem`/`deezerId`/`previewUrl` na música.
`obterPreviaDeezer` (callable) devolve um link de prévia sempre
fresco a partir do `deezerId` — o link do Deezer (`preview`) é um
token que expira em poucas horas, nunca gravar e tocar depois.

**Busca por nome (`pesquisarMusicaLouvor`, callable, paginada):**
procura no Deezer só pelo nome e enriquece cada candidato em
paralelo — tom só por Cifra Club (raspagem, cifra transcrita à mão);
sem BPM automático nesta camada (GetSongBPM foi removido — a
Cloudflare deles bloqueia o acesso por API há muito, nunca deu para
usar de facto; ver `git log` por "GetSongBPM" se for retomado). Se o
Cifra Club não achar tom, `resolverTomAudioMusica` entra ao escolher
o candidato — análise do preview do Deezer via essentia.js/audio-decode
(tom **e** BPM, `fonteTom`/`fonteBpm: "audio"`). Spotify entra só com
o link de áudio (busca, `Client Credentials`) — **não** dá tom/BPM: a
Spotify descontinuou `audio-features`/`audio-analysis` para qualquer
app criada depois de 27/11/2024 (a nossa é de 2026), 403 sempre,
independente de conta Premium
([anúncio oficial](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)).
Letra (letras.mus.br) e vídeo (YouTube Data API v3) resolvidos à
parte. Uma camada falhar nunca derruba as outras nem o candidato.

**LouveApp já foi tentado e removido** (2026-09): a API de parceiro
só expõe o repertório que a própria igreja cadastrou dentro do
LouveApp (amarrado ao `ministryToken`), nunca uma busca na biblioteca
geral deles — não resolve "buscar música nova com tom/BPM", que era o
objetivo. Não usar de novo para isto sem confirmar antes que mudou
(ver `git log` por "LouveApp" para o código removido).

## 6. Permissões (firestore.rules)

| Ação | Quem |
|---|---|
| Ler biblioteca | membros da base Louvor |
| Criar música nova | só líder ou auxiliar — `souLiderBase('louvor')` (2026-09, era qualquer membro) |
| Adicionar versão a uma música existente | membros da base Louvor |
| Definir `versaoPadraoId` | só o líder/auxiliar — `souLiderBase('louvor')` no `firestore.rules` |
| Editar o tom de uma versão | membros da base Louvor — pela Biblioteca ou tocando na música dentro do Repertório (ver abaixo) |
| Criar/editar repertório | membros da base Louvor |
| Ler repertório | base Louvor + base Técnica |
| Escrever repertório | só base Louvor |

Escrita direta do cliente (sem Cloud Function) para música/versão/
repertório — os campos restritos (`versaoPadraoId`, criar música)
são gate na própria regra (`diff().affectedKeys()` ou
`souLiderBase`), nunca por função.

**Tom por grade de 12 notas** (`components/biblioteca/GradeTom.jsx`):
substitui o campo de texto livre — bemol/sustenido juntos no mesmo
botão (`C#/Db`, `D#/Eb`…), com um alternador "menor" à parte. Usado
em três sítios: cadastro/edição de versão na Biblioteca, e um popup
rápido (`components/repertorio/SheetEditarTom.jsx`) ao tocar no selo
de tom de uma música dentro do Repertório — grava direto na versão
(`guardarVersao`), por isso vale para qualquer repertório futuro que
reuse essa versão, não só o culto aberto na hora.

## 7. Riscos e débito técnico

| Risco | Mitigação |
|---|---|
| `sharp` como dependência nativa das Functions | Node 20, `firebase deploy` reinstala no Linux do Cloud Build — testar o primeiro deploy antes de confiar. |
| Deezer sem resultado / API fora do ar | `buscarCapaDeezer` nunca bloqueia o cadastro — segue sem capa (placeholder lima com a inicial do título). |
| Repertório consumido pela projeção antes de estar pronto | `atualizadoEm` a cada escrita; a Técnica (quando ligar a leitura) mostra "atualizado há X" e sabe que ainda pode mudar. |
| Listener `onSnapshot` órfão | Desanexar em todo `useEffect` — principal risco de custo (ver `CLAUDE.md` raiz). |

## Dados de seed

Só o Adriel (`scripts/seedLouvor.mjs`), PIN provisório de 6 dígitos.
Restantes voluntários entram pelo Painel do líder → Adicionar — nunca
por seed (evita colisão de id com outra base, ver `CLAUDE.md` raiz,
regra 9).
