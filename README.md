## Frontend — Cloudflare Workers (`portal-onda`)

O deploy do frontend é feito pela **Git integration nativa da Cloudflare**
(Workers Builds), não por GitHub Actions. Ela já está ligada a este repo e
publica sozinha a cada push/PR.

No dashboard Cloudflare → `portal-onda` → Settings → Builds, confirma:
- **Build command**: `npm run build`
- **Deploy command**: `npx wrangler deploy`
- **Root directory**: `/`

E em Settings → Variables and Secrets, adiciona as variáveis que o build
do Vite precisa (mesmos valores do `.env.example`):
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
