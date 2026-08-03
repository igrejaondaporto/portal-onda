## Segredos a criar no GitHub

Settings → Secrets and variables → Actions:

- `FIREBASE_PROJECT_ID` — o id do projeto
- `FIREBASE_SERVICE_ACCOUNT` — o JSON da conta de serviço, colado inteiro

No passo do deploy, escreve o segundo para `sa.json` antes de correr o
firebase deploy:

```yaml
- run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > sa.json
```

**Nunca** faças commit do `service-account.json`. Se acontecer, vai a
Firebase → Definições → Contas de serviço e revoga a chave imediatamente.
