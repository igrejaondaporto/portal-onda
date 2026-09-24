# Base New — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

Base nova, 2026-09. Ainda por preencher: quantas pessoas, o que
fazem, a que horas chegam — perguntar ao líder da base e atualizar
esta secção antes do primeiro seed a sério.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Scaffolding inicial — cópia da Base de Apoio (equipa única, sem
ministérios) como ponto de partida, seguindo o skill `nova-base`.
Ainda por fazer antes de estar pronta para voluntários a sério:
- Seed de pessoas/funções/inventário reais (hoje só o líder,
  `scripts/seedNew.mjs`, PINs provisórios).
- Ligar o domínio `new.igrejaonda.pt` no Cloudflare (Workers →
  `portal-new` → Domains & Routes).
- Conteúdo do tour de primeiro login (`scripts/seedTour.mjs`).
- Confirmar cor (`#F5A300`, escolhida por não colidir com nenhuma
  outra base ainda) e hora de chegada (`09:00`, placeholder) com o
  líder.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixo. Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa/posto do voluntário nesse culto |
| **Culto** | O evento. Domingos 10:30, mais especiais |
| **Lição** | O documento (.docx) que o líder sobe, visível para toda a base |

Por enquanto sem vocabulário específico a evitar — a definir com o
líder à medida que a base ganha forma.

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/new/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6).

Escala: **cópia direta da Apoio**, equipa única sem ministérios —
`guardarEscalaApoio` (`functions/index.js`) já é genérica por
`baseId` (o nome ficou "Apoio" por ter nascido lá primeiro, a
Pessoal já a reutiliza também), zero Cloud Function nova precisou de
ser escrita para esta base.

### Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todos os cultos
- `"AAAA-MM-DD"` → só naquele culto

Só o líder da base cria no catálogo.

### Lição

```js
bases/new/licoes/{id}
  titulo, arquivoUrl, arquivoNome, enviadoPor, criadoEm
```

Só o líder sobe (`lib/licoes.js`, `Licao.jsx`) — escrita direta do
cliente (sem Cloud Function), mesmo padrão de `avisos`/`funcoes`:
sem autoria mista, sem campo calculado no servidor. O ficheiro
(sempre `.docx`, validado tanto no `<input accept>` do cliente como
no `contentType` da regra do Storage) vive em
`bases/new/licoes/{id}.docx`; o Firestore só guarda o link e
quem/quando enviou. Toda a base lê a lista (mais recente primeiro),
tocar abre/descarrega o ficheiro. "Excluir" aqui apaga a sério (documento
+ ficheiro) — ao contrário da regra 5 do `CLAUDE.md` raiz
("nada se apaga"), não faz sentido manter um `.docx` antigo indefinidamente
só marcado como inativo; reconsiderar se um dia precisar de histórico.

## O que este base NÃO tem (herdado do molde da Apoio, removido de propósito)

- **"Montar"** (enquete de indisponibilidade + sugestor de escala) —
  não foi pedido para esta base. `lib/enquetes.js` e o balão de
  "responder enquete" em `Inicio.jsx` continuam no código (o molde
  da Apoio trazia), mas ficam inertes: sem a aba "Montar" para abrir
  uma enquete, nenhuma chega a ser criada para `baseId: "new"`, o
  balão nunca aparece. Se um dia fizer falta, portar de volta
  (ver `apps/apoio/src/pages/Montar.jsx` e
  `apps/apoio/src/components/painel/SugestorEscala.jsx`).
- **Reembolsos** não é uma aba (nunca foi, nem na Apoio) — continua
  alcançável por "A base" no Início, herdado do molde, não pedido
  nem removido explicitamente. Confirmar com o líder se deve
  continuar visível.

## Quantas crianças estão presentes — popup no Início

Pedido 2026-09: "QUERO O MESMO NO PAINEL DO SHIFT E DO NEW" — mesmo
mecanismo da Kinder (ver `apps/kinder/CLAUDE.md`, "Quantas crianças
estão presentes"), sem divisão por sala: `ContagemCriancas.jsx`
(`components/`), só para o líder da base (`souLiderBase`), um número
só. Popup grande no Início, sozinho, uma vez por domingo, enquanto
não estiver preenchido; depois fica um cartão simples, tocar reabre
para corrigir. Escreve direto em `eventos/{e}/contagem/geral`
(categoria `"new"`) pela Cloud Function `registarContagemSala`
(`functions/contagemSalas.js`, partilhada com Kinder e SHIFT) — a
Contagem da Base Pessoal, que o Painel Pastoral também lê.

**Quem e quando (mudou 2026-09):** aparece a QUALQUER pessoa da base,
não só a quem lidera; marca quem chegar primeiro, se ainda estiver
vazio, e depois só o líder (ou auxiliar) corrige — o servidor recusa o
resto (`functions/contagemSalas.js`). A pergunta é sobre o domingo mais
recente até hoje (`domingoDaContagem`, `lib/contagemCriancas.js`), por
isso fica pendente no Início durante a semana até alguém marcar; o
popup só abre sozinho no próprio domingo.

## Detalhes ainda por fechar com o líder

- Chegada, cor, nome bonito das funções, se há ministérios (hoje
  não) — tudo herdado do molde da Apoio como placeholder.
- Quem pode enviar Lição — hoje só o líder da base; se outros
  voluntários também puderem, é mudar `souLiderBase(base)` para
  `minhaBase(base)` em `firestore.rules`/`storage.rules` (dois
  sítios, PR à parte de qualquer mudança de app).
