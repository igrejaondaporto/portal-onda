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
apps/apoio/             App da Base de Apoio. Domínio: apoio.painelonda.pt
apps/tecnica/           App da Base Técnica. Domínio: tecnica.painelonda.pt
```

Cada `apps/*` tem o seu próprio `wrangler.toml`, `.env.production`
(`VITE_BASE_ID`) e deploy — Workers Cloudflare independentes, um bug
numa base nunca derruba outra. O que é `packages/shared` só entra numa
tela se for **mesmo** igual em todas as bases hoje e sempre; o resto
(telas, regras de negócio específicas) vive dentro de cada `apps/*`,
mesmo que pareça repetido entre bases no início.

| Base | App | Domínio | `CLAUDE.md` |
|---|---|---|---|
| Apoio | `apps/apoio` | `apoio.painelonda.pt` | `apps/apoio/CLAUDE.md` |
| Técnica | `apps/tecnica` | `tecnica.painelonda.pt` | `apps/tecnica/CLAUDE.md` |

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

## RGPD

Fotos, nomes, telefones e faturas de pessoas identificadas. O aviso
curto no primeiro login basta — não há formulário em papel. Retenção:
operacional 2 meses, reembolsos 5 anos, voluntários inativos 1 ano.
