# Base Técnica — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack,
monorepo). O que estava aqui sobre arquitetura de deploy e sobre
pessoas/PIN globais **já não se aplica** — ver a nota no fim.

## O que é

A equipa de som, luz e projeção, ~16 pessoas. Chegam mais cedo que a
Apoio (ver `bases/tecnica.horaChegada`), preparam o equipamento, o
culto é às 10:30 na Casa do Povo de Vermoim.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Ainda a construir. `apps/apoio` foi o ponto de partida (cópia literal,
para ter algo no ar rápido) — as telas abaixo ainda não existem, são
a especificação a portar, uma de cada vez, cada uma com o seu plano
próprio antes de começar a codificar.

O protótipo visual (`portal-base-tecnica.html`, partilhado à parte)
é **a especificação visual e funcional** — abre-o antes de portar
qualquer ecrã. Duas coisas nele são andaimes, não se portam: a barra
preta no topo que troca de pessoa (é só para demonstrar), e o `HOJE`
fixo a 20/ago/2026 (no real vem do relógio).

## Modelo de dados desta base

```js
bases/tecnica
  nome: "Base Técnica"
  cor: "#001ED1"
  horaChegada: "08:30"
  ministerios_ativos: true     // Apoio: false — liga o modo ministérios

bases/tecnica/ministerios/{id}
  nome: "Áudio" | "Iluminação" | "Projeção" | "Responsável"
  ordem, cor, ativo, temChecklist

bases/tecnica/funcoes/{id}
  ministerioId: "audio"        // [novo] — null nas bases sem ministérios
  nome, descricao, foto, fase: "pre"|"durante"|"pos", ordem, ativo
```

**"Responsável" é modelado como ministério**, apesar de ser um papel.
Tem checklist própria, ocupa uma linha na tabela da escala, é
preenchido pelos líderes de culto. Tratá-lo à parte só criaria um
caso especial em todo o lado. `ordem: 0`, sem aprendiz.

Na Técnica **não há aba "Funções"** — o conteúdo chega ao voluntário
tocando no item da checklist na Home, que abre uma folha com o passo
a passo e a foto. O líder edita no Painel do Líder → Checklists, com
uma aba por ministério.

### Escala: titular + aprendiz, não uma lista

```js
eventos/{e}/escalas/tecnica
  liderEscala: "julio"          // já existe — é o líder de culto
  lugares: [
    { ministerioId: "audio",       titularId: "kairan", aprendizId: "carlos" },
    { ministerioId: "iluminacao",  titularId: "wallace", aprendizId: null },
    { ministerioId: "projecao",    titularId: "igor",   aprendizId: null },
    { ministerioId: "responsavel", titularId: "julio",  aprendizId: null }
  ]
```

**Um lugar = 1 titular + 0 ou 1 aprendiz.** Não é a lista `pessoas[]`
que a Apoio usa — torna impossível de construir o que é proibido:
nunca dois aprendizes juntos, nunca um aprendiz sozinho, o titular é
sempre expert (ou `sem_nivel`, se o líder assim decidir). Cada lugar
guarda cópia do nome do ministério e das pessoas (o Firestore não faz
junções). **Uma pessoa serve num só ministério operacional por
culto** (Áudio/Iluminação/Projeção) — validar na Cloud Function que
grava a escala. **O Responsável é a exceção**: é um papel de
liderança, não um posto operacional, por isso acumula com um
ministério (o Jorge pode ser Responsável e titular do Áudio no mesmo
domingo).

O nível (`não serve` / `em treino` / `titular`) é **por ministério**,
não da pessoa — o Vinicius é aprendiz no Áudio e titular na
Iluminação. Guardar em `bases/tecnica/pessoas/{uid}.ministerios`.

## Navegação

Barra inferior: `Início · Escala · Culto · Equipamentos · Wiki` (+
`Montar`, só o líder da base — enquete de disponibilidade e montagem
da escala do mês). O Perfil não é aba, abre tocando na foto — como já
funciona hoje (`packages/shared/components/MenuEu.jsx`).

## Painel do líder — tudo administrável sem programador

Regra: se o líder precisa de mudar, tem de haver ecrã. Nada de ir à
consola do Firebase.

- **Voluntários** — papel na base, nível por ministério, repor PIN,
  desativar. É aqui que se troca o líder da base.
- **Ministérios** — criar, renomear, cor, reordenar, aceitar
  aprendizes, desativar. O quarto ministério entra por aqui.
- **Checklists** — uma aba por ministério.
- **Equipamentos** — adicionar, editar, estado, localização, ministério.
- **Melhorias** — definir meta, reabrir, fechar.
- **Wiki** — criar esqueletos, convidar a escrever, remover.
- **Definições** — nome, horas. (O "máximo recomendado por mês" e "se
  o treino conta para o máximo" ficam por agora como constantes no
  código — `RECOMENDADO_MES`/`ALERTA_MES` em `lib/sugestor.js` — a
  decisão do líder foi adiar isso para um painel geral da igreja,
  quando existir, em vez de uma definição só desta base.)

## Home do voluntário

1. Alerta de enquete aberta (se houver), com prazo.
2. Alerta de melhorias em atraso (se houver).
3. Próximo culto — data + etiqueta do ministério. Se for aprendiz:
   "📝 Estás em treino hoje com o Kairan — acompanha e pergunta."
4. Checklist do ministério do próximo culto — só desse ministério,
   nunca a base toda.
5. As tuas próximas datas.
6. **Quem serve contigo** — os quatro ministérios daquele domingo, não
   só o dele (responde a "quem vai estar na projeção hoje?").
7. Wiki — atalho, artigos recentes.

## Ordem do culto

Já existe e funciona (`apps/tecnica` herda o ecrã da Apoio tal e
qual) — **não mexer nisso**. O que esta base acrescenta são as deixas
por ministério, por cima do que já existe:

```js
eventos/{e}/ordem            // global — sobe uma vez, serve todas as bases
eventos/{e}/ordemNotas/tecnica
  momentos: { 0: { audio:"...", iluminacao:"...", projecao:"...", responsavel:"..." } }
```

Por defeito o voluntário vê só as deixas do ministério em que serve
naquele domingo — um botão alterna para "Toda a base". As deixas são
da base, não do domingo: ficam guardadas e voltam a aparecer no culto
seguinte (evita reescrever tudo todas as semanas).

## Equipamentos (o "Inventário" da Técnica)

Mesma coleção `bases/{b}/inventario`, mas em modo património:

| | `consumivel` (Apoio) | `patrimonio` (Técnica) |
|---|---|---|
| Unidade | quantidade em stock | item individual |
| Campos | qtd, mínimo, movimentos | modelo, nºsérie, local, estado |
| Alerta | abaixo do mínimo | avariado / em reparação |
| Ação | dar baixa / repor | reportar avaria |

Os equipamentos pertencem sempre a uma base — sem partilha entre
bases. O botão "Reportar avaria" abre uma melhoria já ligada ao
equipamento; o equipamento mostra o histórico de melhorias dele.

## Melhorias

Segmento dentro de Equipamentos (`Equipamentos | Melhorias`), não é
aba própria.

```js
bases/tecnica/melhorias/{id}
  titulo, descricao, foto, equipamentoId?, ministerioId?
  gravidade: "impede_culto" | "atrapalha" | "melhoria"
  estado: "aberta" | "em_curso" | "resolvida"
  meta: date?, previsao: date?
  abertaPor, abertaEm, resolvidaPor, resolvidaEm, notaResolucao

bases/tecnica/melhorias/{id}/eventos/{id}
  tipo: "abertura"|"comentario"|"estado"|"meta"|"previsao"|"resolucao"
  autorId, quando, texto
```

**Meta** = data-limite (opcional na abertura). **Previsão** = estimativa
de quem está a tratar. Cores: previsão ≤ meta → verde; previsão >
meta → amarelo ("N dias além da meta"); hoje > previsão e ainda
aberta → vermelho ("atrasada há N dias"); sem meta → cinza.

Linha do tempo: comentários e mudanças de estado juntos, por ordem.
Qualquer voluntário comenta e resolve; o líder reabre. **A nota de
resolução é obrigatória** — alimenta o botão "Transformar em artigo
da Wiki", que pré-preenche título, foto e a linha do tempo como passos.

## Wiki

O líder chama-lhe "Fórum" à equipa; na interface é sempre "Wiki".

**Artigo**: `Título · Ministérios · Introdução · [Passo: texto+imagem]× · Conclusão · Etiquetas`
**Dúvida**: pergunta livre com respostas; quem perguntou marca a certa
→ aparece "Transformar em artigo".

```js
bases/tecnica/wiki/{id}
  tipo: "artigo" | "duvida"
  titulo, introducao, conclusao, passos: [{texto, imagem}]
  ministerios: [...], etiquetas: [...]
  autorId, criadoEm, atualizadoEm
  esqueleto: true          // criado pelo líder, ainda por escrever
  resolvidaPorRespostaId?  // dúvidas

bases/tecnica/wiki/{id}/respostas/{id}
```

Feed: artigos dos ministérios da pessoa primeiro, depois os gerais.

**Busca**: o Firestore não faz busca por texto. Solução: uma Cloud
Function reescreve `wikiIndice/tecnica` (lista leve, sem imagens) a
cada publicação; o cliente carrega esse índice uma vez e faz busca
difusa no cliente (ex. Fuse.js). O artigo completo só é buscado ao
tocar no resultado. Acima de ~400 artigos, dividir por ministério —
não fazer isso agora.

Arranque com conteúdo: sem artigos o portal nasce morto. O líder cria
esqueletos (título, sem corpo) e os voluntários reclamam o seu.
Sugestões: como criar um louvor no ProPresenter, ligar/desligar a
mesa de som, configurar a projeção, ligar a transmissão, cenas de
iluminação, o que fazer quando falha o som.

## Enquetes de indisponibilidade

```js
bases/tecnica/enquetes/{AAAA-MM}
  estado: "aberta" | "fechada", prazo: date
  domingos: [...]                          // + eventos especiais

bases/tecnica/enquetes/{AAAA-MM}/respostas/{uid}
  indisponivelEm: [...], semIndisponibilidade: true, nota?, respondidoEm
```

Só se pergunta: "Tens alguma indisponibilidade este mês?" Botão verde
"NÃO TENHO INDISPONIBILIDADES" no topo — caminho de 90% das pessoas,
um toque. Voto privado (cada um vê só o seu; o líder vê o conjunto).

Alerta ao líder: se hoje ≥ dia 15 **e a escala do mês seguinte ainda
não estiver criada** (nem publicada, nem já há uma enquete em curso
para esse mês — aberta ou fechada mas ainda por publicar), cartão
vermelho no Painel com atalho para abrir e, já aberta, texto pronto
para o WhatsApp (`wa.me`). Painel de respostas: respondeu / não
respondeu, com "Lembrar de responder" por pessoa.

## Sugestor de escala — só IFs, sem IA

Corre depois da enquete fechar. **Nunca publica sozinho** — propõe,
alerta, o líder ajusta e confirma.

Restrições duras: indisponível nesse domingo → fora; não apto nesse
ministério → fora; já está noutro ministério nesse domingo → fora;
titular tem de ser expert (ou `sem_nivel`, com aviso); aprendiz nunca
sozinho, nunca dois juntos.

Ordem de preenchimento: **primeiro os lugares com menos candidatos**
(evita o beco sem saída de preencher por data e ficar sem ninguém no
fim). Esses saem travados 🔒 com o motivo à vista.

Candidatos ordenados por: há mais tempo sem servir, menos vezes no
trimestre (já existe — `obterEstatisticasEscala` em
`apps/apoio/src/lib/painel.js`, reutilizar o padrão), menos
disponibilidade sobrando no mês. Aprendizes: encaixar sempre que
houver um disponível, rodando entre eles. Responsável: alternar
Julio/Diogo/Jorge — é sugestão, o Julio decide.

Alertas tão importantes quanto a sugestão: escalado 3× no mês
(recomendado 2), domingo sem ninguém disponível num ministério,
alguém sem servir há 2 meses, gente que não respondeu à enquete,
ministério com cobertura curta. Servir como aprendiz conta para o
limite do mês.

Saída: tabela colunas=domingos, linhas=Responsável/Áudio/Iluminação/
Projeção — igual à escala em papel. Tocar num nome abre substitutos
ordenados, cada um com "serviu há 34 dias · 1× no trimestre ·
disponível". O líder fixa nomes antes de gerar; regenerar respeita o
que está fixo. Ao publicar: texto da escala formatado para o
WhatsApp, com botão de copiar.

Promoção de aprendizes: sem regra automática, mas ao fim de 3-4
serviços como aprendiz num ministério, avisar o líder ("O Carlos já
serviu 4× no Áudio como aprendiz. Promover a titular?").

## Ecrã de preparação — descartado

Estava no plano original, mas não se vai fazer: o líder vai preparar
à parte um documento de treino para cada líder e cada voluntário, em
vez de um ecrã de checklist dentro do portal.

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Ministério** | Subdivisão da base (Áudio, Iluminação, Projeção, Responsável) |
| **Líder da base** | Fixo — Julio. Vê e edita tudo, em qualquer data |
| **Líder de culto** | Rotativo, um por culto (Julio, Diogo, Jorge) — é o `liderEscala` de sempre, só o nome na interface muda |
| **Escala** | Quem serve em cada culto |
| **Função** | O item da checklist |
| **Culto** | Domingos 10:30, mais especiais |
| **Melhoria** | Avaria ou coisa a arranjar |
| **Em treino** | Aprendiz — etiqueta 📝 ao lado do nome na escala |

Não dizer "líder do dia", "tarefa", "turno", "evento", "fórum" nem
"chamado" na interface.

## Dados de seed

16 pessoas, nível por ministério (ver tabela completa na conversa
original com o líder). Julio, Diogo e Jorge levam PIN de 6 dígitos
(líderes); os restantes, 4. **Vitor e Breno já existem na Apoio** —
ligar às contas globais existentes ao criá-los aqui (usar
`procurarPessoaGlobal`/`criarVoluntario` com `pessoaExistenteId`, ver
`functions/index.js`), nunca criar identidade nova para eles.

Importar a escala de agosto/setembro 2026 (já existe em papel) como
eventos passados/futuros — sem isso o "há quanto tempo não serve"
arranca a zero e as primeiras sugestões saem sem sentido.

## O que já está feito, diferente do que este documento pedia

Duas partes do plano original da Técnica já foram resolvidas de forma
mais simples, na fundação partilhada por todas as bases — não
precisam de ser (re)feitas aqui:

- **Login único / pessoas globais**: não se fez a migração para
  `pessoas/{id}` com mapa de papéis embutido. Em vez disso,
  `bases/{b}/pessoas/{uid}` continua a existir por base (papel, ativo,
  cor…), e só a **identidade e o PIN** passaram a ser globais
  (`pessoas/{uid}`, `pessoas/{uid}/privado/auth`). Uma Cloud Function
  `trocarBase` troca os claims do token sem pedir PIN outra vez. Já
  está em produção na Apoio. Ver `functions/index.js` e
  `packages/shared/src/lib/auth.js`.
- **Um repositório, N bases por hostname/config no Firestore**: não
  se fez. Continuam a ser **N apps separadas** (`apps/apoio`,
  `apps/tecnica`…) dentro de um monorepo, cada uma com o seu deploy e
  domínio — só o código genuinamente igual está em `packages/shared`.
  Ver `CLAUDE.md` da raiz.
