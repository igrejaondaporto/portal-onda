# Base SHIFT — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

Base nova, 2026-09. Cópia exata da estrutura da Base New (mesmas
telas/abas/funções, a pedido do líder) — ainda por preencher: quantas
pessoas, o que fazem, a que horas chegam — perguntar à Melissa
(líder da base) e atualizar esta secção antes do primeiro seed a
sério.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Scaffolding inicial — cópia direta da Base New (equipa única, sem
ministérios, com "Lição" em vez de "Montar"), seguindo o skill
`nova-base`. Ainda por fazer antes de estar pronta para voluntários a
sério:
- Seed de pessoas/funções/inventário reais (hoje só a líder Melissa,
  `scripts/seedShift.mjs`, PIN provisório).
- Ligar o domínio `shift.igrejaonda.pt` no Cloudflare (Workers →
  `portal-shift` → Domains & Routes) — ver `CLAUDE.md` raiz, "Ao
  criar uma base nova", passo 11.
- Confirmar cor (`#7B5CFF`, escolhida por não colidir com nenhuma
  outra base) e hora de chegada (`09:00`, herdada da New como
  placeholder) com a Melissa.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo (Melissa). Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa/posto do voluntário nesse culto |
| **Culto** | O evento. Domingos 10:30, mais especiais |
| **Lição** | O documento (.docx) que a líder sobe, visível para toda a base |

Por enquanto sem vocabulário específico a evitar — a definir com a
Melissa à medida que a base ganha forma.

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/shift/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6).

Escala: **cópia direta da Apoio/New**, equipa única sem ministérios —
`guardarEscalaApoio` (`functions/index.js`) já é genérica por
`baseId`, zero Cloud Function nova precisou de ser escrita para esta
base.

### Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todos os cultos
- `"AAAA-MM-DD"` → só naquele culto

Só a líder da base cria no catálogo.

### Lição

```js
bases/shift/licoes/{id}
  titulo, arquivoUrl, arquivoNome, enviadoPor, criadoEm
```

Só a líder sobe (`lib/licoes.js`, `Licao.jsx`) — escrita direta do
cliente (sem Cloud Function), mesmo padrão de `avisos`/`funcoes`:
sem autoria mista, sem campo calculado no servidor. O ficheiro
(sempre `.docx`, validado tanto no `<input accept>` do cliente como
no `contentType` da regra do Storage) vive em
`bases/shift/licoes/{id}.docx`; o Firestore só guarda o link e
quem/quando enviou. Toda a base lê a lista (mais recente primeiro),
tocar abre/descarrega o ficheiro. "Excluir" aqui apaga a sério (documento
+ ficheiro) — ao contrário da regra 5 do `CLAUDE.md` raiz
("nada se apaga"), não faz sentido manter um `.docx` antigo indefinidamente
só marcado como inativo; reconsiderar se um dia precisar de histórico.

## O que esta base NÃO tem (herdado do molde da New/Apoio, removido de propósito)

- **"Montar"** (enquete de indisponibilidade + sugestor de escala) —
  não foi pedido para esta base. `lib/enquetes.js` e o balão de
  "responder enquete" em `Inicio.jsx` continuam no código (o molde
  trazia), mas ficam inertes: sem a aba "Montar" para abrir uma
  enquete, nenhuma chega a ser criada para `baseId: "shift"`, o
  balão nunca aparece. Se um dia fizer falta, portar de volta
  (ver `apps/apoio/src/pages/Montar.jsx` e
  `apps/apoio/src/components/painel/SugestorEscala.jsx`).
- **Reembolsos** não é uma aba (nunca foi, nem na Apoio/New) —
  continua alcançável por "A base" no Início, herdado do molde, não
  pedido nem removido explicitamente. Confirmar com a Melissa se deve
  continuar visível.

## Detalhes ainda por fechar com a líder

- Chegada, cor, nome bonito das funções, se há ministérios (hoje
  não) — tudo herdado do molde da New como placeholder.
- Quem pode enviar Lição — hoje só a líder da base; se outras
  voluntárias também puderem, é mudar `souLiderBase(base)` para
  `minhaBase(base)` em `firestore.rules`/`storage.rules` (dois
  sítios, PR à parte de qualquer mudança de app).
