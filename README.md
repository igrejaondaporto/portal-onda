## Monorepo

`packages/shared` tem o código comum a todas as bases (login, troca de
base, compressão de fotos, componentes genéricos, o CSS base). Cada
`apps/<base>` é uma app independente, com o seu próprio deploy e
domínio. Ver `CLAUDE.md` na raiz para a estrutura completa.

```
npm install                              # uma vez, na raiz — liga os workspaces
npm run dev --workspace=apps/apoio       # http://localhost:5173
npm run dev --workspace=apps/tecnica     # http://localhost:5174
npm run dev --workspace=apps/backstage   # http://localhost:5175
npm run dev --workspace=apps/comunicacao # http://localhost:5176
npm run build --workspace=apps/apoio     # build de produção
npx wrangler deploy                      # a partir de dentro de apps/apoio
```

Cada app tem porta fixa (`strictPort`), para poderes ter as quatro a
correr ao mesmo tempo. O login fala com as Cloud Functions em produção:
o CORS tem de aceitar `localhost` em qualquer porta — se uma app
além da 5173 recusar o PIN, falta um deploy de `functions/`.

## Frontend — Cloudflare Workers

O deploy do frontend é feito pela **Git integration nativa da Cloudflare**
(Workers Builds), não por GitHub Actions — um projeto Cloudflare por app.

No dashboard Cloudflare → cada projeto (`portal-onda`, `portal-tecnica`…)
→ Settings → Builds, confirma:
- **Build command**: `npm install && npm run build --workspace=apps/<base>`
- **Deploy command**: `npx wrangler deploy`
- **Root directory**: `apps/<base>` (ex.: `apps/apoio`)

E em Settings → Variables and Secrets, adiciona as variáveis que o build
do Vite precisa (mesmos valores do `.env.example` de cada app):
`VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`,
`VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_SENDER_ID`, `VITE_FB_APP_ID`,
`VITE_FB_VAPID_KEY`, `VITE_BASE_ID`.

## Segredos a criar no GitHub

Settings → Secrets and variables → Actions:

**Firebase (functions, regras, índices)**
- `FIREBASE_PROJECT_ID` — o id do projeto
- `FIREBASE_SERVICE_ACCOUNT` — o JSON da conta de serviço, colado inteiro

No passo do deploy, escreve o segundo para `sa.json` antes de correr o
firebase deploy:

```yaml
- run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > sa.json
```

**Nunca** faças commit do `service-account.json`. Se acontecer, vai a
Firebase → Definições → Contas de serviço e revoga a chave imediatamente.
