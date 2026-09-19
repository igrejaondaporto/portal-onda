# Portal do Voluntário — igrejaonda

Contexto para o Claude Code. Lê isto antes de escrever qualquer coisa.
Este ficheiro é o resumo do monorepo; cada base tem o seu próprio
`CLAUDE.md` com o vocabulário, as telas e as decisões específicas dela.

## O que é

Intranet da Igreja Onda (Porto/Maia). Cada equipa de voluntários é uma
**base** (Apoio, Técnica…). Todas servem no mesmo culto: domingo, 10:30,
Casa do Povo de Vermoim.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as portas.
Não é um dashboard de escritório. Se uma tarefa exige mais de três toques,
está mal desenhada.

## Estrutura do repositório (monorepo)

```
functions/            Cloud Functions — um conjunto só, serve todas as bases
firestore.rules, firestore.indexes.json, storage.rules   idem
packages/shared/       Código genuinamente igual em qualquer base:
                        login por PIN, troca de base, compressão de fotos,
                        Avatar/lightbox, cache offline, o sistema visual
                        base (styles/global.css). Uma correção aqui chega
                        a todas as bases de uma vez — é para isso que existe.
apps/apoio/             App da Base de Apoio. Domínio: apoio.igrejaonda.pt
apps/tecnica/           App da Base Técnica. Domínio: tecnica.igrejaonda.pt
apps/backstage/         App da Backstage. Domínio: back.igrejaonda.pt
apps/comunicacao/       App da Comunicação. Domínio: comunicacao.igrejaonda.pt
apps/new/               App da Base New. Domínio: new.igrejaonda.pt
apps/shift/             App da Base SHIFT. Domínio: shift.igrejaonda.pt
apps/financeiro/        App do Financeiro. Domínio: financeiro.igrejaonda.pt
apps/mural/              Mural Onda — anúncios de dou/vendo/arrendo e de
                        procuro, da igreja toda. NÃO é uma base (é como
                        eventos/: da igreja, não de uma equipa de
                        voluntários) — mesmo assim é um Worker Cloudflare
                        próprio, como qualquer app. Domínio: mural.igrejaonda.pt
```

Cada `apps/*` tem o seu próprio `wrangler.toml`, `.env.production`
(`VITE_BASE_ID`) e deploy — Workers Cloudflare independentes, um bug
numa base nunca derruba outra. O que é `packages/shared` só entra numa
tela se for **mesmo** igual em todas as bases hoje e sempre; o resto
(telas, regras de negócio específicas) vive dentro de cada `apps/*`,
mesmo que pareça repetido entre bases no início.

### Trabalhar numa base sem mexer nas outras

Com uma base por pessoa, o risco deixa de ser o conflito de merge e
passa a ser o silencioso: alterar o partilhado a pensar numa base e
repintar as outras no deploy seguinte. Vale para quem corrige bugs
como para quem constrói uma base nova.

Cada `apps/<base>` carrega o `global.css` partilhado e, **a seguir**,
o seu próprio `src/styles/<base>.css`. Como o CSS aplica a última
regra de igual peso, esse ficheiro local ajusta tokens e classes sem
tocar no partilhado — e, por viver dentro da app, nunca entra no
bundle de outra. É o sítio por omissão de qualquer mudança visual.

Componente partilhado que precisa de mudar só numa base: copiar para
`apps/<base>/src/components/adaptados/`, com a origem, a data e o
porquê no topo. Antes disso, tentar sempre o CSS local ou uma prop
nova com o comportamento atual por defeito. Ver o `LEIA-ME.md` dessa
pasta.

Antes de abrir PR, para ver o que sai da tua app:

```
npm run verificar:isolamento -- <base>
```

Sai com código 1 se a branch tocar em `functions/`, nas `rules` ou em
`packages/shared` — o que muda todas as bases, e no caso das
functions e das rules **faz deploy sozinho ao entrar na `main`**
(`.github/workflows/firebase.yml`). Não é proibição: é para essas
alterações irem em PR à parte, revistas por quem cuida das outras
bases, nunca no mesmo commit que uma correção local.

| Base | App | Domínio | `CLAUDE.md` |
|---|---|---|---|
| Apoio | `apps/apoio` | `apoio.igrejaonda.pt` | `apps/apoio/CLAUDE.md` |
| Técnica | `apps/tecnica` | `tecnica.igrejaonda.pt` | `apps/tecnica/CLAUDE.md` |
| Backstage | `apps/backstage` | `back.igrejaonda.pt` | `apps/backstage/CLAUDE.md` |
| Comunicação | `apps/comunicacao` | `comunicacao.igrejaonda.pt` | `apps/comunicacao/CLAUDE.md` |
| Pessoal | `apps/pessoal` | `pessoal.igrejaonda.pt` | `apps/pessoal/CLAUDE.md` |
| Louvor | `apps/louvor` | `louvor.igrejaonda.pt` | `apps/louvor/CLAUDE.md` |
| New | `apps/new` | `new.igrejaonda.pt` | `apps/new/CLAUDE.md` |
| SHIFT | `apps/shift` | `shift.igrejaonda.pt` | `apps/shift/CLAUDE.md` |
| Kinder | `apps/kinder` | `kinder.igrejaonda.pt` | `apps/kinder/CLAUDE.md` |
| Financeiro | `apps/financeiro` | `financeiro.igrejaonda.pt` | `apps/financeiro/CLAUDE.md` |

Fora desta tabela de propósito — não é uma base, é da igreja toda
(mesma lógica de `eventos/`): **Mural Onda**, `apps/mural`,
`mural.igrejaonda.pt`, `apps/mural/CLAUDE.md`.

## Stack

React + Vite (SPA, sem SSR — tudo privado atrás de login), Firestore,
Storage, Cloud Functions em `europe-west1`, PWA. Ícones: `lucide-react`.
Tipografia: Outfit (Google Fonts).

Hosting do frontend: **Cloudflare Workers**, um por app (`[assets]` em
cada `wrangler.toml`), não Firebase Hosting. O resto (Firestore,
Storage, Auth, Cloud Functions) é **um projeto Firebase só, partilhado
por todas as bases** — é aí que mora o multi-base, não no deploy do
frontend (ver regra 6 abaixo).

Deploy do frontend: manual por `wrangler deploy` a partir de cada
`apps/<base>` (ou a Git integration nativa da Cloudflare, configurada
com "Root directory" apontado para essa pasta). Deploy de Functions/
regras: `npm run deploy:functions` / `deploy:rules` na raiz, ou o
workflow `.github/workflows/firebase.yml`.

**Depois de todo deploy de Functions, corre `npm run smoke`** — chama
`dadosEntrada` das duas bases a sério (sem PIN, é público) e falha
alto se alguma rebentar. `node --check`/build só apanha erro de
sintaxe; um erro de runtime (ex.: `.exists()` em vez de `.exists` no
Admin SDK — os dois SDKs do Firestore não são iguais nisto, e já
partiu o ecrã de entrada em produção uma vez) só aparece a chamar a
função a sério. Não dês um deploy de Functions por terminado sem isto
passar.

## Regras que não se negoceiam (valem em qualquer base)

1. **O PIN nunca é verificado no cliente.** Só a Cloud Function `entrar`.
2. **O hash do PIN vive em `pessoas/{p}/privado/auth`** — global, um só
   PIN por pessoa, em qualquer base onde sirva (ver `trocarBase`). As
   regras do Firestore não escondem campos, escondem documentos.
3. **As atribuições/escalas passam por Cloud Function**, nunca por
   escrita direta do cliente para o que é do líder decidir.
4. **O papel vem do token** (`request.auth.token.papel`/`baseId`),
   nunca do Firestore.
5. **Nada é apagado, é desativado.** `ativo:false`. O histórico
   depende disso.
6. **Multi-base desde o dia 1, no Firestore.** `bases/{baseId}` para o
   que é específico da base; `pessoas/{uid}` (global) para identidade
   e PIN. Uma base nova é um documento novo, nunca uma reescrita.
7. **O culto pertence à igreja, não à base.** `eventos/{AAAA-MM-DD}` é
   global; `eventos/{e}/escalas/{baseId}` é da base. O PDF da ordem do
   culto sobe uma vez para todas.
8. Português de Portugal, tratamento por tu, em todas as bases.
9. **`pessoas/{id}` nunca leva um id "nome cru"** (`"camila"`, `"alan"`,
   `"joao"`...) num seed. Já aconteceu colidir com uma pessoa real de
   outra base — a identidade e o PIN são globais (regra 2), por isso o
   `set({...}, {merge:true})` do segundo seed reescreveu sozinho o
   `bases` e o PIN da pessoa da primeira base, sem erro nenhum a
   avisar (ver `scripts/corrigirColisaoCamila.mjs`, o script que
   reparou o estrago). `scripts/seed.mjs` (Apoio, o seed original) já
   usa ids crus para 17 pessoas — todos reservados, minas para
   qualquer base nova com alguém do mesmo primeiro nome. Todo seed que
   escreve `pessoas/{id}` com um id escolhido à mão chama
   `garantirIdSemColisao` (`scripts/lib/semearPessoaSegura.mjs`)
   primeiro, e usa um id namespaced (`"<nome>-<baseId>"`) quando o
   nome já existir. Uma pessoa a servir em duas bases a sério nunca
   nasce por seed — é sempre pelo Painel do líder → Adicionar → "já é
   voluntário(a) noutra base?" (liga o perfil existente, não duplica).

## RGPD

Fotos, nomes, telefones e faturas de pessoas identificadas. O aviso
curto no primeiro login basta — não há formulário em papel. Retenção:
operacional 2 meses, reembolsos 5 anos, voluntários inativos 1 ano.

## Ao criar uma base nova

Usa o skill `nova-base` (`.claude/skills/nova-base/SKILL.md`) — é o
checklist completo, passo a passo com ficheiros exatos, do
scaffolding da app ao primeiro deploy. O que fica abaixo são só as
quatro coisas que mais se esquecem por não serem tela nem regra de
negócio — fazer sempre, antes de dar a base por pronta:

1. **Ícone, favicon e imagem de partilha (`og-image.png`) com o nome
   da base.** Todas as bases usam o mesmo fundo (gradiente azul
   `#001ed1 → #0019be → #001594`, o mesmo de sempre) — o que muda é só
   o texto, para dar para distinguir bases à vista (separador do
   browser, ecrã principal do telemóvel depois de instalar o PWA,
   pré-visualização ao partilhar um link). Em cada `apps/<base>/public/`:
   - `favicon.svg`/`favicon.ico` (pequenos): abreviação de 2-3 letras,
     maiúsculas — `AP`, `TEC`, `BS`.
   - `apple-touch-icon.png`, `icone-192.png`, `icone-512.png`: nome
     curto e minúsculo, de preferência igual ao subdomínio —
     `apoio`, `tecnica`/`técnica`, `back`.
   - `og-image.png`: o design `igrejaonda` de sempre (logo + "PORTAL
     DO VOLUNTÁRIO" + curva lima) fica igual; acrescenta só o nome da
     base por baixo, maiúsculo e espaçado, a lima (`#c3dc54`).
   Não é para desenhar à mão: gerar por script (gradiente + texto
   centrado, fonte Outfit ou uma sans-serif redonda parecida — ver o
   histórico da PR que criou a Backstage para o script de referência).
2. **Conteúdo do tour de primeiro login** (`bases/{baseId}/tour/config`,
   via `scripts/seedTour.mjs`). Não precisa de ser elaborado — uma
   frase curta por passo, uma por cada botão principal da barra
   inferior (`data-tour="nav-<chave>"`, gerado sozinho pelo `NavBar.jsx`)
   mais boas-vindas/escala/checklist/fechamento, no mesmo espírito do
   que a Apoio e a Técnica já têm. Sem isto, o primeiro login da base
   nova não quebra (passos apontando a `data-tour` inexistente pulam
   em silêncio — ver `TourContext.jsx`), só fica sem a visita guiada.
3. **O gatilho do acesso de dev, no `Entrada.jsx` da base nova.**
   A Cloud Function (`entrarComoDev`) e a senha (`config/devAccess`,
   partilhada — uma só para todas as bases, ver
   `scripts/definirSenhaDev.mjs`) já servem qualquer base sem mais
   nada; o que falta por base é só embrulhar o logo no
   `GatilhoDev` (5 toques abrem a `SheetAcessoDev`), copiando o padrão
   de `apps/apoio/src/pages/Entrada.jsx` — duas linhas (import +
   `<GatilhoDev>` à volta do `<span className="logo">`). Sem isto, a
   base nova só entra por PIN, como antes de este mecanismo existir.
4. **Porta fixa no `vite.config.js` e uma linha em `PORTAS_DEV`.**
   Cada app de dev corre numa porta sua (`server.port` +
   `strictPort: true`), para as quatro poderem estar no ar ao mesmo
   tempo. O mapa em `packages/shared/src/lib/auth.js` tem de bater
   certo com essa porta — sem a linha, o `trocarBase` em localhost
   troca os claims na app em que estás e ficas a olhar para a UI
   errada, sem erro nenhum. A próxima porta livre depois das que já
   existem (5173–5176). **O CORS das functions não precisa de
   mudança**: aceita `localhost`/`127.0.0.1` em qualquer porta, de
   propósito, para uma base nova não disparar deploy de functions.

## Melhorias entre bases

Ver `MELHORIAS-ENTRE-BASES.md`. Sempre que implementares algo novo
numa base — funcionalidade ou correção —, antes de dar por terminado
avalia se serve a outra base já construída ou a uma futura, e
acrescenta uma linha lá (portar / já partilhado / específico desta
base e porquê). É assim que uma ideia boa numa base não fica esquecida
só por termos começado por ela.
