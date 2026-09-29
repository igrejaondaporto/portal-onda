# "Onde vais servir?" — igrejaonda

Lê primeiro o `CLAUDE.md` da raiz. Isto é o que é diferente aqui.

## O que é

Um teste de vocação curto para quem acabou de sair da **reunião de
novos voluntários**: o pastor mostra o link/QR
(`voluntario.igrejaonda.pt`), a pessoa escreve nome e telemóvel e
responde a 10 perguntas no máximo. **Não é uma base** (como o Mural):
não há login, nem PIN, nem `bases/voluntario`.

- 8 perguntas objetivas, estilo entrevista (uma qualidade, um hobby,
  uma profissão…), **5 respostas cada**, cada resposta vale 1 ponto
  para uma só base. Cada base aparece **exatamente 4 vezes** — nenhuma
  tem mais hipóteses do que outra (`DESENHO` no `index.html`).
- Empate em 1.º lugar: uma pergunta extra; se ainda sobrar, um
  sorteio **por pessoa** (semente = telemóvel), nunca a ordem da lista
  — já deu viés para a Apoio uma vez, por desempatar pela ordem.
- Até 2 perguntas sobre a **área** da 1.ª base (Técnica, Comunicação,
  Pessoal, Louvor, Louvor Kinder, Kinder). As idades da Kinder
  (Baby/Fun/Júnior) só aparecem aqui, nunca nas 8 gerais; SHIFT
  (pré-adolescentes) e New (adolescentes) são bases diferentes.
- No fim é uma **sugestão**: a pessoa aceita as duas bases, ou abre a
  lista com os pontos dela e escolhe outra/troca a ordem. Só depois
  "envia".
- Quem faz o teste vê os pontos dela, **nunca a tabela de quanto vale
  cada resposta** — isso é só do pastor. Por isso a vista `#pastor`
  da prévia (Artifact) ficou de fora desta app.

## Estado (2026-09): só publicado, NÃO ligado

Decisão do dono do produto: publicar no domínio, mas ainda sem ligar a
nada. Hoje é **um `index.html` estático** (Vite só copia; sem React,
sem Firebase):

- "Enviar ao pastor" **não envia nada** — grava só no `localStorage`
  do telemóvel da pessoa (`onda.teste-bases.v7`). O selo "PRÉVIA" e o
  botão "Apagar e repetir" da prévia saíram a pedido do dono do
  produto: a página já se apresenta como a versão final.
- "Um teste por telemóvel" é só neste browser.
- Telemóvel primeiro, mas **não só**: a partir de 760px abre para um
  ecrã de computador (cabeçalho a toda a largura, início em duas
  colunas, respostas em duas colunas, as duas bases lado a lado) —
  o bloco `@media (min-width: 760px)` no fim do CSS. Uma coluna de
  480px no meio do ecrã parecia "uma vista de telemóvel".

Para ligar a sério (quando for pedido): uma Cloud Function pública
(sem login) que grava o resultado, garante um teste por telemóvel no
servidor e cria as candidaturas nas duas bases escolhidas
(`functions/candidaturas.js`), com a revisão no Painel Pastoral. A Function vai em PR à parte
(CLAUDE.md raiz, "Trabalhar numa base sem mexer nas outras").

## Deploy

Worker `portal-voluntario` (`wrangler.toml`), publicado pelo
`.github/workflows/cloudflare.yml` como as outras apps. O domínio é um
Custom Domain do Worker (ligado uma vez, fora do repo — ver o passo 11
de `.claude/skills/nova-base/SKILL.md`). Fica fora dos motores de
busca (`<meta name="robots" content="noindex">`) enquanto não for
oficial. Ícones e `og-image.png` (o que aparece ao partilhar o link no
WhatsApp): `node scripts/gerarIconesVoluntario.mjs`.
