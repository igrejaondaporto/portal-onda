# Portal do Voluntário — Base de Apoio

Intranet da Igreja Onda, Porto. Ver `CLAUDE.md` para a arquitetura.

## Pôr a andar

### 1. Projeto Firebase
1. console.firebase.google.com → criar projeto
2. **Plano Blaze** (as Cloud Functions exigem-no). Define um
   **alerta de orçamento em 5 €** — para 20 pessoas a fatura fica em 0 €.
3. Ativar: Authentication (nenhum fornecedor, usamos tokens próprios),
   Firestore em `europe-west3` ou `eur3`, Storage, Functions, Hosting.

### 2. Local
```bash
npm install
cd functions && npm install && cd ..
cp .env.example .env      # preencher com a configuração do SDK
```

### 3. Semear
Firebase → Definições → Contas de serviço → Gerar chave privada →
guardar como `service-account.json` na raiz.

```bash
npm run seed
```
Imprime os códigos provisórios de cada voluntário. **Guarda-os** — não
voltam a aparecer. Cada um troca o seu no primeiro acesso.

### 4. Publicar
```bash
firebase login
firebase use --add
npm run deploy
```

### 5. Domínio
Hosting → Adicionar domínio personalizado → `portal.igrejaonda.pt`.
Subdomínio, não subpasta: separa o portal do site institucional.

## Comandos

| | |
|---|---|
| `npm run dev` | servidor local |
| `npm run seed` | semear a base de dados |
| `npm run deploy` | build + publicar tudo |
| `npm run deploy:rules` | só as regras de segurança |
| `npm run deploy:functions` | só as Cloud Functions |

## App Android

O portal é uma PWA. Para a Play Store, embrulha-o numa TWA:

```bash
npx @bubblewrap/cli init --manifest https://portal.igrejaonda.pt/manifest.webmanifest
npx @bubblewrap/cli build
```

Sem iOS por agora — o que também evita a exigência da Apple de instalar
no ecrã principal antes de as notificações funcionarem.

## Estrutura

```
src/lib/firebase.js   ligação e configuração
src/lib/auth.js       login por PIN
src/lib/modelo.js     caminhos do Firestore e regras partilhadas
functions/index.js    PIN, permissões, geração de domingos
firestore.rules       quem lê e escreve o quê
storage.rules         fotos, faturas e PDFs
scripts/seed.mjs      dados iniciais reais
```
