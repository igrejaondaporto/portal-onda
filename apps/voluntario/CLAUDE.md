# "Onde vais servir?" — igrejaonda

Lê primeiro o `CLAUDE.md` da raiz. Isto é o que é diferente aqui.

## O que é

Um teste de vocação curto para quem acabou de sair da **reunião de
novos voluntários**: o pastor mostra o link/QR
(`voluntario.igrejaonda.pt`), a pessoa escreve nome e telemóvel e
responde a 10 perguntas no máximo. **Não é uma base** (como o Mural):
não há login, nem PIN, nem `bases/voluntario`.

- **Funil tipo "Akinator"** (2026-09, pedido do dono do produto — o
  desenho anterior, 8 perguntas de 5 respostas, deixava cada base de
  fora de metade das perguntas): perguntas de **2 respostas**, cada
  resposta aponta para um grupo de bases (+1), as bases fora dos dois
  lados ficam neutras (+0,5). A pergunta seguinte é a que melhor divide
  as bases que vão à frente (`proximaPergunta`); para quando só sobra
  uma a 1,5 pontos das outras (mín. 4, máx. 8 perguntas). Os 10 pontos
  por cima da pergunta apagam-se à medida que afunila — sem nomes nem
  cores, para ninguém ir atrás de uma base.
- **Desenho simétrico** (`BANCO`): a 1.ª pergunta divide 5 | 5
  (tarefa | pessoas) e cada grupo tem 5 perguntas 2 | 3 em ciclo. Por
  isso, respondendo ao acaso, cada base sai **exatamente 10%** das
  vezes, e quem responde sempre como a sua base acerta 100% em 5–6
  perguntas. Qualquer mudança ao `BANCO` tem de manter isto:
  `node scripts/simularTesteVoluntario.mjs` antes de publicar (corre o
  código da própria página por todos os caminhos; sai com erro se
  desequilibrar).
- Empate que sobre: sorteio **por pessoa** (semente = telemóvel), nunca
  a ordem da lista — já deu viés para a Apoio uma vez.
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
