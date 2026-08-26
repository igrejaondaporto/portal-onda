# Base Pessoal — igrejaonda

Contexto específico desta base. Lê primeiro o `CLAUDE.md` da raiz do
repositório (regras que valem para todas as bases, RGPD, stack).

## O que é

A Base Pessoal cuida das pessoas: recebe à entrada, acomoda no
auditório, conta o público do prédio todo, serve o café e recolhe
contactos de quem quer ser chamado pelo pastor.

Cerca de 17 voluntários, um culto por domingo (10h), líder própria —
**Camila**. Como em qualquer outra base, o nome do líder é sempre uma
variável (`papel === "lider_base"`), nunca um nome fixo no código da
UI; quando o painel do pastor existir, ele vai poder trocar quem é
líder de qualquer base, incluindo esta.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as
portas. Não é um dashboard de escritório. Se uma tarefa exige mais de
três toques, está mal desenhada.

## Estado

Em desenvolvimento em `pessoal.igrejaonda.pt`. O protótipo original
(`painel-base-pessoal ok.html`, fornecido pelo dono do produto) foi a
especificação visual e funcional inicial do módulo **Acomodação** —
esse é o único módulo já portado 1:1. Início (contagem completa),
Formulário e Inventário ainda são placeholder — ver "Débitos
conscientes" no fim deste ficheiro.

## Fronteiras — o que esta base NÃO faz

- **Não há cadastro de visitantes.** As pessoas do Formulário não têm
  login, não são utilizadoras do sistema e não se registam a si
  próprias — um voluntário preenche por elas.
- **Não há acompanhamento.** A base recolhe e entrega. Quem contacta é
  o pastor, no painel dele (ainda não existe).
- **Não há cadastro de GDs.** Lista fixa por agora. O cadastro real
  nasce no painel do pastor.
- **O mapa de Acomodação não preenche a Contagem.** São universos
  diferentes — ver "Contagem" abaixo.
- **O funil de seis etapas do contacto** (visita → contactado → gd →
  membro → voluntário → servindo) não se implementa aqui. O documento
  de contacto nasce com os campos certos para o painel do pastor ler
  sem migração, mas só a Base Pessoal escreve a primeira etapa.

## Módulos

| Aba | Quem vê | Conteúdo |
|---|---|---|
| Início | todos | Contagem do culto + escala pessoal + avisos do líder |
| Escala | todos | Escala do mês por função |
| Funções | todos (edita a líder) | Café, Drive, Acomodação, Recepção |
| Formulário | todos | Novo contacto + lista do culto |
| Inventário | todos | ~30 consumíveis do café, conferência semanal |
| Acomodação | todos leem, escreve o Drive | Mapa do auditório |
| Enquetes | **só a líder** | Disponibilidade mensal |

## Vocabulário — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Líder da base** | Fixa (Camila). Vê e edita tudo, em qualquer data |
| **Escala** | Quem serve em cada culto |
| **Função** | Café, Drive, Acomodação, Recepção — catálogo, sem funções especiais por agora |
| **Culto** | O evento. Domingos 10h |
| **Drive** | Quem tem a função Drive nesse culto — a única pessoa que escreve no mapa de Acomodação |
| **Contagem** | As nove categorias do prédio todo — nunca confundir com o mapa de Acomodação |

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.
`bases/pessoal/pessoas/{uid}` guarda o que é específico desta base
(papel, telefone, cor, ativo); a identidade e o PIN são globais (ver
`CLAUDE.md` da raiz, regra 2/6).

### Função "Drive" — id determinístico

`bases/pessoal/funcoes/drive` é a única função de catálogo desta base
com **id fixo** (`"drive"`, não auto-id) — é o que permite à regra de
segurança do mapa de Acomodação (ver `firestore.rules` e
`functions/index.js`) apontar sempre a
`eventos/{evento}/atribuicoes/drive` sem lookup. **Nome reservado**:
nenhuma outra base pode ter uma função com id `"drive"` —
`atribuicoes` é uma coleção plana (`eventos/{e}/atribuicoes/{funcaoId}`),
sem namespace de base.

### Acomodação — mapa do auditório

- **Planta/configuração** — `bases/pessoal/acomodacao/planta` (doc
  único): fileiras A–L (12 lugares cada, 144 total), reservados fixos
  A1–A4, bloqueios permanentes (cadeira partida), parâmetros de
  desenho, preferência de cores invertidas da líder. Muda sem deploy.
  Leitura: qualquer pessoa da base. Escrita: só a líder.
- **Estado ao vivo por culto** — `eventos/{AAAA-MM-DD}/acomodacao/mapa`
  (doc único): campo `lugares` (mapa id→estado, as 144 chaves sempre
  preenchidas desde a criação), `fechado`, `criadoEm`, `iniciadoPor`.
  Escrita por lugar via `updateDoc` com dot-notation
  (`lugares.A1`), nunca reescrevendo o doc inteiro — é o que torna o
  offline seguro. **Escreve só quem tem a função Drive nesse culto**
  (ou a líder); todos os outros só leem (`onSnapshot`). Regra em
  `firestore.rules`, ao lado do bloco `checklist`.
- **Arquivo pós-fecho** — `bases/pessoal/acomodacaoResumos/{AAAA-MM-DD}`
  (subcoleção): ocupados, visitantes, reservados, bloqueados,
  capacidade útil, percentagem. Escrito pela Cloud Function
  `fecharAcomodacao` (não pelo cliente direto — fechar é a única ação
  do módulo que exige rede). Alimenta o futuro mapa de calor do painel
  do pastor.
- Estados possíveis de um lugar: `livre | ocupado | visitante |
  reservado | bloqueado`. Cores fixas (não mexer sem avisar a líder):
  livre `#8E2028`, ocupado `#C8F02E`, visitante `#F5C518` (+ ponto
  escuro), reservado `#3B82F6` (+ ponto branco), bloqueado `#5A6072`
  (+ X branco).
- **O mapa não preenche a Contagem.** Pode mostrar-se o nº de lugares
  ocupados como referência ao lado, em texto, nunca copiar para um
  campo da Contagem.

### Contagem (Início) — nove categorias que não somam entre si

`membros`, `visitantes`, `voluntarios`, `mensagem`, `apelo` (manuais);
`new`, `shift`, `juniorFun`, `baby` (viram automáticas quando os
painéis das salas existirem — por agora manuais, com `origem` gravada
por categoria desde já, para a transição não pedir migração). Campo
aceita ficar vazio, guarda quem preencheu cada categoria. **Ainda por
implementar** — ver "Débitos conscientes".

### Formulário de contacto

Substitui o Google Forms atual. Campos automáticos: data, culto, quem
preencheu, etapa inicial (`"visita"`). Concelho é select (não texto
livre) — só assim o futuro sugestor de GD funciona; freguesias
dependentes do concelho (Porto, Maia, Matosinhos, Vila Nova de Gaia,
Gondomar, Valongo). GD **não filtra** por concelho da pessoa (há GDs
em Sines, Lisboa, Barcelos) — mostra todos, agrupados por região.
Duplicados por telemóvel: avisa, não bloqueia. RGPD: checkbox
obrigatório de que a pessoa foi informada + base legal + data
guardados; campo `arquivado` previsto, sem purga automática por agora.
Coleção global `contactos/{id}` (fora de `bases/` e de `pessoas/`),
com um campo que aponta para `pessoas/{id}` só a partir da etapa
"voluntário" — nunca duplicar identidade. **Ainda por implementar.**

### Inventário do café

Mesmo molde de **consumível** da Backstage (`src/lib/inventario.js`,
`SheetItemInventario.jsx`) — quantidade e mínimo, sem património por
item. ~30 itens (copos, palitos, água, café, pão…), conferência
semanal. **Ainda por implementar.**

## Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todo culto (Café, Drive, Acomodação,
  Recepção — todas de catálogo por agora, sem funções especiais)
- `"AAAA-MM-DD"` → só naquele culto

Só a líder da base cria no catálogo.

## Princípios do briefing original (não se discutem outra vez)

- **Avisa, não bloqueia.** Duplicados, stock mínimo, conflitos —
  sempre alerta, nunca impedimento.
- **Campo vazio não renderiza nada.** Sem "—", sem caixa vazia.
- **Sem IA no sugestor de escala.** Só lógica condicional (mesmo
  padrão da Apoio — `src/lib/sugestor.js`).
- **Dados de exemplo claramente fictícios** em seeds/demos, nunca
  nomes reais.
- **Débito documenta-se, não trava** — ver secção abaixo.

## Débitos conscientes

- **Início/Contagem, Formulário, Inventário**: ainda placeholder
  ("em construção") — só o módulo Acomodação foi construído nesta
  fase, por decisão do dono do produto (maior risco técnico primeiro).
  Especificação completa acima, pronta para a próxima sessão.
  `fecharAcomodacao` (Cloud Function) e a regra de `firestore.rules`
  para `eventos/{e}/acomodacao/mapa` também entram em PR separado,
  antes de dar o módulo por pronto em produção.
- Inventário sem património por item (herdado da Backstage).
- Lista de GDs fixa até existir cadastro no painel do pastor.
- Sugestor de GD por perfil/zona só nasce com esse cadastro; o
  Formulário só vai **capturar** os campos que o vão alimentar.
- Sem purga automática de contactos antigos; só o campo `arquivado`.
- Planta de auditório sem editor visual — configura-se por documento
  Firestore (`bases/pessoal/acomodacao/planta`). Editor fica para
  depois.
- Curvatura/inclinação reais das fileiras: o desenho é aproximado às
  fotografias do protótipo, pode precisar de afinação depois do
  primeiro culto a sério.
- Pessoas por função em cada culto (1 a 3): valores por defeito ainda
  não definidos — perguntar à Camila antes de fechar o módulo Funções.
