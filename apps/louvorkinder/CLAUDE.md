# Louvor Kinder — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

O louvor do culto das crianças (Kinder). Base própria desde 2026-09,
**cópia da app da Louvor** (`apps/louvor`): mesmas abas (Início,
Escala, Culto, Biblioteca, Repertório), mesmo Painel do líder, mesmas
Cloud Functions. Tudo o que está em `apps/louvor/CLAUDE.md` sobre
biblioteca, versões, histórico de tons, repertório, rascunho de
escala, enquete e confirmação de presença vale aqui também, com as
diferenças abaixo. Lê esse ficheiro antes de mexer em qualquer uma
destas partes.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Se uma tarefa exige mais de três toques, está mal desenhada.

## Porquê uma base e não uma secção dentro da Louvor

Pedido 2026-09: quem é do Louvor Kinder só vê a sua própria escala,
biblioteca (infantil) e repertório; as bibliotecas **nunca se
misturam**; só o líder da Louvor vê as duas. Uma base nova dá isto de
graça pelas regras do Firestore: tudo o que a Louvor grava vive em
`bases/{baseId}/...` (músicas, versões, repertórios, índice de
cantores, rascunhos) e `eventos/{e}/escalas/{baseId}`, e as regras
isolam por `minhaBase(base)`. Um voluntário do Louvor Kinder não
consegue ler `bases/louvor/musicas` nem que tente. Fazer isto dentro
da Louvor pedia um segundo nível de isolamento na mesma base — uma
claim nova e reescrever meia dúzia de blocos de regras.

O líder da Louvor é líder nas duas bases: a mesma pessoa (um PIN só,
global), ligada às duas, que troca pelo menu (`trocarBase`). O
primeiro vínculo foi feito por `scripts/seedLouvorKinder.mjs` (o
arranque — não havia ninguém nesta base para usar o Painel); os
restantes voluntários entram pelo Painel do líder → Adicionar.

## Diferenças para a Louvor

| O quê | Louvor | Louvor Kinder |
|---|---|---|
| `baseId` / domínio | `louvor` / `louvor.igrejaonda.pt` | `louvorkinder` / `louvorkinder.igrejaonda.pt` |
| Papéis da escala | Lead, Co-lead, Back, Teclado, Guitarra, Baixo, Bateria | **Voz, Violão, Cajón** |
| Quem canta (`PAPEL_LEAD`) | `lead` | `voz` |
| Biblioteca | a da Onda | **infantil**, própria (`bases/louvorkinder/musicas`) |
| Técnica lê o repertório? | sim, para a projeção | **não** (pedido do líder) — a regra genérica ainda o permite, mas a Técnica só consulta `bases/louvor/repertorios` |

O subdomínio **tem de ser igual ao `baseId`**: `trocarBase`
(`packages/shared/src/lib/auth.js`) e os links das notificações
(`functions/notificacoes.js`) constroem `https://{baseId}.igrejaonda.pt`.
Mudar o domínio é mudar o `baseId`, e isso é migrar dados.

### Papéis da escala

`PAPEIS` em `src/lib/modelo.js` (`voz`, `violao`, `cajon`) e a cópia
server-side em `functions/index.js`, `ESCALA_LOUVOR_POR_BASE.louvorkinder`,
que valida `guardarEscalaLouvor`/rascunhos. **Mudar um obriga a mudar o
outro** — o servidor recusa qualquer papel que não conheça para esta
base. `PAPEL_LEAD`/`PAPEIS_VOCAL` (também em `modelo.js`) substituem
os `"lead"`/`["lead","colead","back"]` que a app da Louvor tinha
escritos à mão em `Repertorio.jsx`, `Biblioteca.jsx` e `SheetVersao.jsx`.

### A mesma pessoa em dois papéis

Ao contrário da Louvor, aqui a mesma pessoa pode servir em mais de um
papel no mesmo culto (ex.: canta e toca violão) — pedido do líder,
2026-09. No servidor é `variosPapeisPorPessoa` em
`ESCALA_LOUVOR_POR_BASE.louvorkinder` (`functions/index.js`,
`limparEscaladosLouvor`): só recusa a mesma pessoa duas vezes no
MESMO papel. No cliente, `SheetEscala.jsx` trata cada toque como o par
pessoa+papel daquele bloco (escalar soma, tirar só tira daquele
papel; o líder de escala só cai se a pessoa sair de todos), e as
listas de "quem serve" (`Escala.jsx`, `Inicio.jsx`,
`SheetConfirmarPresenca.jsx`, `SheetRascunho.jsx`) usam
`pessoasEscaladas` (`lib/modelo.js`) — uma linha por pessoa, com os
papéis juntos ("🎤 Voz · 🎸 Violão"), e contagens de pessoas, nunca de
entradas. O quadro do mês continua por papel (a pessoa aparece nas
duas linhas). `pessoas[]` no documento da escala continua sem
repetidos — notificações, confirmação e Painel Pastoral não mudam.

### Sem paleta de cores nem ensaio

O box de cada culto na Escala (`DetalhesCulto`, `Escala.jsx`) mostra
só quem serve, o repertório e a observação — a "Paleta de Cores" e o
"Ensaio" da Louvor saíram, porque o louvor infantil não os usa
(pedido do líder, 2026-09). "Editar observação" grava só
`observacao`; o servidor (`definirDetalhesCultoLouvor`) deixa
intactos os campos que não recebe. Os ecrãs que dependem de
`dataEnsaio` (lembrete e confirmação de ensaio no Início, o dia
pintado no Calendário) ficaram, mas nunca aparecem sem data marcada.

### Tirar do repertório pela Biblioteca

Cada música da Biblioteca tem o atalho "+" para o repertório do
próximo culto; quando já lá está, o botão fica verde com ✓ e tocar
pede confirmação e tira (`removerMusicaDoRepertorio`,
`lib/repertorio.js` — todas as entradas dessa música, e desfaz o uso
de cada versão, igual ao ✕ do Repertório). O detalhe da música tem
também "Tirar do repertório". Pedido do líder, 2026-09. Nada sai da
biblioteca — "excluir a música" da biblioteca continua a não existir
(regra 5: nada é apagado).

### Biblioteca infantil

Importada do export do LouveApp do louvor infantil (2026-09) com o
mesmo script da Louvor, por base:

```
node scripts/importarLouveAppLouvor.mjs export.xlsx --base=louvorkinder --dry-run
```

(`NODE_USE_ENV_PROXY=1` à frente, num ambiente com proxy — o `fetch`
do Node não lê `HTTPS_PROXY` sozinho e o Deezer "não encontra" nada.)
Repetir não duplica. Das 19, 16 ficaram com capa do Deezer; "A Cristo
dai Louvor", "Aperte a mão do amigo" e "A alegria está no coração"
ficaram com placeholder (sem correspondência) — o líder escolhe na
Biblioteca.

**Classificações próprias**: além das seis da Louvor, `CLASSIFICACOES`
(`src/lib/biblioteca.js`) tem `infantil`, `animada`, `calma`,
`biblica` e `antiga` — as que o LouveApp infantil usava. O script tem
a mesma lista em `POR_BASE.louvorkinder` — **mudar uma obriga a mudar
a outra**, senão a importação deixa cair a classificação em silêncio
(avisa, mas não grava).

## O que é partilhado com a Louvor (e não se copia)

As Cloud Functions com "Louvor" no nome (`guardarEscalaLouvor`,
`publicarEscalaLouvor`, `registarUsoVersaoLouvor`,
`pesquisarMusicaLouvor`, `confirmarPresencaLouvor`,
`definirDetalhesCultoLouvor`…) são as mesmas: leem o `baseId` do
token, não há `if (baseId === "louvor")`. Uma correção lá chega às
duas. O que é da app (telas, textos) está duplicado de propósito
(regra do monorepo) — **uma correção na app da Louvor tem de ser
avaliada para esta também**, e vice-versa (ver
`MELHORIAS-ENTRE-BASES.md`).

Listas fixas no servidor que incluem esta base: `BASES_COM_AUXILIAR`
(`functions/index.js`) e `BASES_COM_CONFIRMACAO`
(`functions/notificacoes.js`, lembrete de confirmação de presença).

## Por fazer

- ~~Popular a biblioteca infantil~~ — feito (2026-09): 19 músicas do
  LouveApp do louvor infantil, ver "Biblioteca infantil" abaixo. As
  próximas entram pela Biblioteca, como na Louvor.
- ~~Ligação ao Kinder~~ — feito (2026-09): o repertório deste painel
  aparece no bloco da Lição do Início da Kinder, o mesmo para as três
  salas (`apps/kinder/src/components/licao/RepertorioLouvorKinder.jsx`).
  A Kinder só lê `bases/louvorkinder/repertorios` (regra em
  `firestore.rules`) — **o que se grava em cada item do repertório
  (título, artista, capa, links) é o que a Kinder vê**, porque a
  biblioteca continua fechada a ela.
- ~~Escala no Painel Pastoral e na Backstage~~ — já aparece sem código
  novo: `basesDaIgreja`/`escalasCrossBase` listam qualquer `bases/{id}`
  ativa, e a escala grava `pessoas[]` como as outras (confirmado em
  produção, 2026-09). Mostram os nomes de quem serve, não o papel —
  igual à Louvor.
- Confirmar com o líder: hora de chegada (`08:30` é placeholder,
  igual à Kinder) e a cor (`#FF7A59`, só usada nas vistas cruzadas).
