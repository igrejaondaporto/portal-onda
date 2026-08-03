## Segredos a criar no GitHub

Settings → Secrets and variables → Actions:

**Firebase (functions, regras, índices)**
- `FIREBASE_PROJECT_ID` — o id do projeto
- `FIREBASE_SERVICE_ACCOUNT` — o JSON da conta de serviço, colado inteiro

**Cloudflare (frontend, projeto Workers `portal-onda`)**
- `CLOUDFLARE_API_TOKEN` — token com permissão de editar Workers
- `CLOUDFLARE_ACCOUNT_ID` — id da conta Cloudflare
- `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`,
  `VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_SENDER_ID`, `VITE_FB_APP_ID`,
  `VITE_FB_VAPID_KEY` — os mesmos valores do `.env.example`, para o build
  do Vite embeber no bundle

No passo do deploy, escreve o segundo para `sa.json` antes de correr o
firebase deploy:

```yaml
- run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > sa.json
```

**Nunca** faças commit do `service-account.json`. Se acontecer, vai a
Firebase → Definições → Contas de serviço e revoga a chave imediatamente.
