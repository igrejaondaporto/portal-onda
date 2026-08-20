---
name: nova-base
description: Cria uma base (equipa de voluntários) nova no monorepo igrejaonda — scaffolding da app, Firestore, CI, ícones, tour, acesso dev. Usar sempre que for adicionar uma equipa nova (ex.: Louvor, Kids, Recepção) ao Portal do Voluntário.
---

# Criar uma base nova

Checklist completo, na ordem certa, para pôr uma base nova no ar —
do scaffolding ao primeiro deploy. Cada passo tem o ficheiro exato a
tocar. Lê primeiro o `CLAUDE.md` da raiz do repo (regras que valem
para todas as bases) — este skill é o "como", aquele é o "porquê".

**Antes de começar, decide com quem pediu:**
- **Nome da base** (ex.: "Louvor") e **slug** minúsculo sem acentos
  (ex.: `louvor`) — o slug é `baseId`, `VITE_BASE_ID`, subdomínio e
  nome de pasta, todos o mesmo.
- **Domínio**: `<slug>.igrejaonda.pt`.
- **Tem ministérios** (subdivisões com titular/aprendiz, como a
  Técnica) **ou é uma equipa só** (lista simples, como a Apoio)? Isto
  decide qual app copiar como ponto de partida no passo 1.
- **Cor** (`bases/{slug}.cor`) — só para a Backstage distinguir bases
  nas vistas cruzadas. Evita `--verde`/`--magenta` (reservados a
  estados de checklist/perigo). Reaproveita uma paleta com contraste
  das já usadas: `apoio #0019BE` `tecnica #7B5CFF` `backstage
  #F5A300` `comunicacao #0092D4`.
- **Hora de chegada** da equipa (a hora do culto é sempre 10:30, já
  fixa em todo o lado).

Ao longo deste guia, `<slug>` é o nome escolhido (ex.: `louvor`),
`<Nome>` é o nome bonito (ex.: `Louvor`), `<TEMPLATE>` é `apoio`
(sem ministérios) ou `tecnica` (com ministérios).

## 1. Copiar a app-molde

```bash
cp -r apps/<TEMPLATE> apps/<slug>
rm -rf apps/<slug>/node_modules apps/<slug>/dist
```

Depois, em `apps/<slug>/package.json`:
```json
"name": "@portal/<slug>",
```
e em `apps/<slug>/wrangler.toml`:
```toml
name = "portal-<slug>"
account_id = "64f79471e56bd25e222e36b24e7f7f27"   # fixo — ver comentário no wrangler.toml de qualquer app
```
(o wrangler.toml da Apoio não tem `account_id` — copia o comentário e
o valor de qualquer outra app, ex. `apps/backstage/wrangler.toml`).

Em `apps/<slug>/vite.config.js`, dentro do `manifest` do
`VitePWA(...)`: `name`, `short_name`, `description`,
`background_color`/`theme_color` (a cor da base, hex).

Em `apps/<slug>/index.html`: `<title>`, `<meta name="theme-color">`,
`<meta name="description">`, e as quatro linhas de `og:url` /
`og:title` / `og:description` / `og:image` / `twitter:*` — todas têm
o domínio ou o nome da base copiados do template, trocar todas.

`apps/<slug>/public/_headers` não muda — cache/headers genéricos,
copia tal e qual.

## 2. Variáveis de ambiente

`apps/<slug>/.env.production` — os valores `VITE_FB_*` são os mesmos
em qualquer app (projeto Firebase único, partilhado — ver `CLAUDE.md`
raiz), só troca:
```
VITE_BASE_ID=<slug>
```
Cria também um `apps/<slug>/.env.local` igual, para conseguires
correr `npm run dev` localmente (fica fora do git).

**No Cloudflare Pages/Workers Builds (dashboard, Environment
Variables → Production)**, define as mesmas `VITE_FB_*` +
`VITE_BASE_ID=<slug>` — são build-time, têm de estar lá mesmo já
estando no `.env.production` do repo (ver `CLAUDE.md` raiz, "Envs
VITE_* são build-time").

## 3. Registar no workspace e no CI

`apps/<slug>` já entra no workspace automaticamente
(`apps/*` no `package.json` da raiz) — só falta:

`.github/workflows/cloudflare.yml` → `strategy.matrix.app`, acrescentar
`<slug>` à lista `[apoio, tecnica, backstage, comunicacao]`. **Sem
isto o deploy automático nunca publica a base nova** — é uma lista
fixa, não descobre pastas sozinha.

```bash
npm install   # workspace novo entra no lockfile
```

## 4. Documento da base no Firestore

`bases/{slug}` é o único doc que faltava — não há Cloud Function
para isto, é `setDoc` direto (uma vez, via script ou Firebase console).
Campos, a partir do que as outras bases já têm:

```js
{
  nome: "<Nome>",
  slug: "<slug>",
  cor: "#......",              // hex escolhido acima
  ativa: true,
  horaChegada: "08:00",        // a da equipa
  horaCulto: "10:30",
  local: "Casa do Povo de Vermoim, Maia",

  // só se aplicável — cada flag entra numa claim do token (ver
  // claimsExtraDaBase em functions/index.js); omite as que não usas
  ministeriosAtivos: false,       // true → modo ministérios (titular/aprendiz), como a Técnica
  veEscalas: "todas",             // → claim ve_todas_escalas (só a Backstage usa hoje)
  culto: { podePublicar: true },  // → claim pode_publicar_culto (só quem publica a ordem do culto)
  eventos: { podeCriarGlobal: true }, // → claim pode_criar_evento_global
  feedbackAberto: true,
}
```

Não crias claims nem regras novas para isto — `claimsExtraDaBase`
(`functions/index.js`) já lê `bases/{qualquerBase}` genericamente.

## 5. Escala: lista simples ou ministérios?

- **Lista simples (como a Apoio)**: nada a fazer no backend —
  `eventos/{e}/escalas/<slug>` já aceita `{pessoas: [...],
  liderEscala}` por qualquer base, via uma Cloud Function
  `guardarEscala<Nome>` **nova** (cada base tem a sua — ver
  `guardarEscalaApoio` em `functions/index.js` como modelo, é
  pequena). Sem isso o cliente não pode escrever a escala (regras
  bloqueiam escrita direta).
- **Ministérios (como a Técnica)**: além da Cloud Function de
  guardar escala (shape `{liderEscala, lugares: [{ministerioId,
  titularId, aprendizId}]}`), precisas de `bases/<slug>/ministerios/{id}`
  (seed manual) e o resto do modelo descrito em
  `apps/tecnica/CLAUDE.md`, secção "Escala: titular + aprendiz".

Isto é o único passo que toca em `functions/index.js` — **PR à
parte**, nunca no mesmo commit que o resto (o deploy de functions é
automático ao entrar na `main`, ver `CLAUDE.md` raiz). Corre
`npm run verificar:isolamento -- <slug>` antes de cada commit para
confirmar o que é isolado e o que não é.

## 6. Ícones, favicon, og-image

Sem script genérico — copia e adapta
`scripts/gerar-assets-comunicacao.mjs` (usa `sharp`, já é dependência
do repo):
- Troca `../apps/comunicacao/public/` pela pasta da base nova.
- Troca as siglas do favicon (2-3 letras maiúsculas, ex. `LV`) e o
  texto do og-image (nome curto maiúsculo e espaçado, cor `#c3dc54`).
- O gradiente (`#001ed1 → #0019be → #001594`) e o layout ficam iguais
  em todas as bases — só o texto muda.

```bash
node scripts/gerar-assets-<slug>.mjs
```

Gera: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`,
`icone-192.png`, `icone-512.png`, `og-image.png` — todos dentro de
`apps/<slug>/public/`.

## 7. Tour de primeiro login

Em `scripts/seedTour.mjs`, acrescenta uma entrada `<slug>: { passos:
[...], passosLider: [...] }` no objeto `TOURS` — molde numa base
parecida (Apoio se for lista simples, Técnica/Backstage se tiver
mais ecrãs). Um passo por botão principal da barra inferior
(`data-tour="nav-<chave>"`, os botões são gerados automaticamente
pelo `NavBar.jsx` a partir de `ABAS`) + boas-vindas + o resto do
fluxo específico da base. Não quebra se ficar incompleto — passos
apontando a `data-tour` inexistente são ignorados em silêncio
(`TourContext.jsx`), só falta a visita guiada.

```bash
GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json" npm run seed:tour
```

## 8. Acesso de dev

Em `apps/<slug>/src/pages/Entrada.jsx`: importa `GatilhoDev` de
`@portal/shared/components/GatilhoDev.jsx` e embrulha o
`<span className="logo">` com ele (copia o padrão de
`apps/apoio/src/pages/Entrada.jsx`, é literalmente duas linhas). A
Cloud Function (`entrarComoDev`) e a senha (`config/devAccess`, já
definida, partilhada entre todas as bases) não precisam de nada
novo — só falta este gatilho visual nesta app.

## 9. `CLAUDE.md` da base nova

Cria `apps/<slug>/CLAUDE.md` a partir de `apps/apoio/CLAUDE.md` (base
simples) ou `apps/tecnica/CLAUDE.md` (base com ministérios) como
molde. Secções mínimas: O que é (quantas pessoas, o que fazem),
Vocabulário (termos exatos a usar/evitar na interface), Modelo de
dados (o que é específico desta base vs. global), Decisões já
fechadas. Acrescenta a linha da base na tabela do `CLAUDE.md` da raiz
(secção "Estrutura do repositório").

## 10. Seed inicial de dados

Copia `scripts/seed.mjs` (ou `seedBackstage.mjs`/`seedComunicacao.mjs`,
o que for mais parecido) para `scripts/seed<Nome>.mjs`, troca `BASE`,
a lista de `PESSOAS` (PIN provisório: `123456` líder / `1234`
voluntário — força troca no primeiro acesso), funções/ministérios,
inventário. Roda uma vez:

```bash
node scripts/seed<Nome>.mjs
```

## 11. Domínio (Cloudflare, fora do repo)

`wrangler deploy` publica o Worker; o domínio `<slug>.igrejaonda.pt`
tem de ser ligado a ele no dashboard da Cloudflare (Workers →
`portal-<slug>` → Settings → Domains & Routes → Add Custom Domain) —
não há automação disto no repo hoje. Dá para fazer via API em vez do
dashboard (`PUT /accounts/{account_id}/workers/domains`), mas o
token precisa de "Workers Routes > Edit" e "DNS > Edit" na zona
`igrejaonda.pt` — confirma os dois antes de tentar.

## 12. Antes de dar por pronta

```bash
npm run build --workspace=@portal/<slug>
npx eslint apps/<slug>/src
npm run verificar:isolamento -- <slug>
```

Testa localmente: acrescenta `<slug>-dev` a `.claude/launch.json`
(copia uma entrada existente, troca `--workspace`), corre o dev
server, entra com um token de teste (`createCustomToken(uid, {
baseId: "<slug>", papel: "lider_base" })`, mesmo padrão usado nas
outras bases). Confirma: entrada por PIN, NavBar com os separadores
certos, tour a arrancar, Painel do líder a abrir.

Só depois do primeiro deploy (`git push`, CI do Cloudflare verde),
liga o domínio (passo 11) e confirma em produção.

## O que NÃO precisa de mudar

- `firestore.rules` — os padrões `bases/{base}/...` já são genéricos
  por `baseId`, uma base nova não abre buraco nenhum sozinha.
- `packages/shared` — login por PIN, NavBar, troca de base, tudo já
  serve qualquer `baseId`.
- Enquetes de indisponibilidade / sugestor de escala (se a base
  quiser este fluxo) — o schema e as Cloud Functions
  (`abrirEnquete`/`fecharEnquete`/`responderEnquete`/...) já são
  genéricos; só falta portar `lib/enquetes.js` + os componentes de
  UI para `apps/<slug>` (ver como foi feito na Apoio,
  `apps/apoio/src/lib/sugestor.js` e
  `apps/apoio/src/components/painel/SugestorEscala.jsx`, se a base
  não tiver ministérios).
