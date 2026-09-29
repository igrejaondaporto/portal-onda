# "Onde vais servir?" — igrejaonda

Lê primeiro o `CLAUDE.md` da raiz. Isto é o que é diferente aqui.

## O que é

Um teste de vocação curto para quem acabou de sair da **reunião de
novos voluntários**: o pastor mostra o link/QR
(`voluntario.igrejaonda.pt`), a pessoa escreve nome e telemóvel e
responde a 8 perguntas de duas respostas (mais até 2 sobre a área da
base). **Não é uma base** (como o Mural):
não há login, nem PIN, nem `bases/voluntario`.

- **Funil tipo "Akinator"** (2026-09, pedido do dono do produto — o
  desenho anterior, 8 perguntas de 5 respostas, deixava cada base de
  fora de metade das perguntas): **8 perguntas de 2 respostas**, cada
  resposta aponta para um grupo de bases (+1), as bases fora dos dois
  lados ficam neutras (+0,5). A pergunta seguinte (`proximaPergunta`) é
  primeiro a que separa as bases que vão à frente, depois a que separa
  as que estão perto, e depois uma que envolva a da frente — as de
  **confirmação**. Histórico das decisões: uma versão parava em 3–4
  perguntas ("pouco, põe umas 8 para confirmar"); outra confirmava com
  perguntas parecidas às anteriores ("já disse que prefiro tarefas e
  depois pergunta se prefiro estar à frente ou atrás"). Por isso **cada
  pergunta é um tema diferente** — nunca a mesma ideia por outras
  palavras.
- A **2.ª base** é a que ficou mais perto — mais pontos e, em empate, a
  última a sair da frente (`ordemFinal`). Os 10 pontos por cima da
  pergunta apagam-se à medida que afunila ("restam 5", "a confirmar")
  — sem nomes nem cores, para ninguém ir atrás de uma base.
- **Perguntas sobre o serviço, não sobre a personalidade** (revisão
  pedida pelo dono do produto: "alguém da Técnica também pode ser
  criativo, ou gostar de falar com pessoas, e mesmo assim ser da
  Técnica"). A 1.ª fala de som, luz, imagem, banda / receber, acolher,
  ensinar — não de "gostar de pessoas". Saíram "criativo/organizado",
  "o ouvido ou o olhar", "rotina ou novidade", "a pressão do último
  minuto" (traços que atravessam bases). Simulado: quem é da Técnica e
  responde "criativo(a)" e "no centro" continua a sair Técnica (299 em
  300). Limite conhecido: quem escolher o grupo errado na 1.ª pergunta
  já não volta ao outro (tentou-se um motor bayesiano que volta atrás,
  mas errava mais nos casos normais) — por isso a 1.ª é concreta, e o
  resultado é sempre editável.
- **Desenho simétrico** (`BANCO`): a 1.ª pergunta divide tarefa |
  pessoas; em cada grupo de 5 há 10 perguntas — 5 **de par** (duas bases
  de um lado, três do outro, em ciclo) e 5 **de uma base** ("Mexer na
  mesa de som, nas luzes ou no projetor?" — Adorava / Não é bem a minha
  praia), as de confirmação. Cada pessoa responde a 7 das 10 do seu
  grupo. Ao acaso, cada base sai **~10%** das vezes; quem responde
  sempre como a sua base acerta 100%; com 1 resposta em cada 10
  "trocada" acerta ~84%, igual para todas. Qualquer mudança ao `BANCO`
  tem de manter isto: `node scripts/simularTesteVoluntario.mjs` antes
  de publicar (corre o código da própria página por todos os caminhos;
  sai com erro se desequilibrar).
- **A pergunta da música** ("Cantas ou tocas algum instrumento?",
  `PERGUNTA_MUSICA`): Louvor e Louvor Kinder pedem cantar ou tocar.
  Sem ela, uma pessoa da Técnica que respondeu "criativo(a)" e "uma
  tarefa que aperfeiçoo com a prática" saía Louvor (as duas partilham
  "o ouvido" e "um som mal feito") — reportado pelo dono do produto.
  Não dá pontos; "Não toco nem canto" tira as duas das sugestões (na
  lista para mudar ficam no fim, com "pede cantar ou tocar"). Aparece
  quando uma delas vai à frente (entre 3 ou menos) e conta para as 8,
  ou no fim, a mais (9.ª), se uma delas ia ser sugerida sem se ter
  perguntado. Nunca a abrir o teste. O script de simulação verifica que
  quem não toca nunca as recebe, nem em 2.º.
- Empate que sobre: sorteio **por pessoa** (semente = telemóvel), nunca
  a ordem da lista — já deu viés para a Apoio uma vez.
- Até 2 perguntas sobre a **área** da 1.ª base (Técnica, Comunicação,
  Pessoal, Louvor, Louvor Kinder, Kinder). As idades da Kinder
  (Baby/Fun/Júnior) só aparecem aqui, nunca no funil; SHIFT
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
  do telemóvel da pessoa (`onda.teste-bases.v8`). O selo "PRÉVIA" e o
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
