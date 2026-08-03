# Portal do Voluntário — igrejaonda

Contexto para o Claude Code. Lê isto antes de escrever qualquer coisa.

## O que é

Intranet da Igreja Onda (Porto/Maia). Primeiro módulo: **Base de Apoio**,
a equipa de limpeza e manutenção, ~17 pessoas. Chegam às 08:00 de domingo,
preparam a Casa do Povo de Vermoim, o culto é às 10:30.

Uso real: telemóvel pessoal, em pé, com pressa, antes de abrir as portas.
Não é um dashboard de escritório. Se uma tarefa exige mais de três toques,
está mal desenhada.

## Estado

- **Protótipo fechado e aprovado**: `../portal-base-de-apoio.html`.
  Ficheiro único, dados na memória. **É a especificação visual e funcional.**
  Todo o ecrã, texto, cor, animação e regra estão lá. Abre-o antes de portar.
- **Esta pasta**: o esqueleto real. Configuração, regras, Cloud Functions,
  camada de dados e o script de seed. Falta a UI em React.

## Stack

React + Vite (SPA, sem SSR — é tudo privado atrás de login), Firestore,
Storage, Cloud Functions em `europe-west1`, PWA.
Ícones: `lucide-react`. Tipografia: Outfit (Google Fonts).

Hosting do frontend: **Cloudflare Workers** (projeto `portal-onda`, static
assets — `wrangler.toml`), não Firebase Hosting. O resto (Firestore,
Storage, Auth, Cloud Functions) continua no Firebase.

## Regras que não se negoceiam

1. **O PIN nunca é verificado no cliente.** Só a Cloud Function `entrar`.
   Se puseres um `if (pin === ...)` no React, qualquer pessoa entra como outra.
2. **O hash do PIN vive em `pessoas/{p}/privado/auth`**, não no documento da
   pessoa. As regras do Firestore não escondem campos — escondem documentos.
3. **As atribuições passam pela função `atribuirFuncao`.** É lá que se
   verifica que o líder de escala só mexe no culto em que está nomeado.
   O cliente esconde botões; a função é que decide.
4. **O papel vem do token** (`request.auth.token.papel`), nunca do Firestore.
5. **Nada é apagado, é desativado.** Voluntários e funções levam `ativo:false`.
   O histórico dos domingos passados depende deles.
6. **Multi-base desde já.** Tudo pendurado em `bases/{baseId}`. A Base Técnica
   entra como um documento novo, não como uma reescrita.
7. **O culto pertence à igreja, não à base.** `eventos/{AAAA-MM-DD}` é global;
   `eventos/{e}/escalas/{baseId}` é que é da base. Assim o PDF da ordem do
   culto é subido uma vez para todas as bases.

## Vocabulário da igreja — usa exatamente estes termos

| Termo | O que é |
|---|---|
| **Base** | Equipa de voluntários (Apoio, Técnica, Pessoal…) |
| **Líder da base** | Fixo. O Alan. Vê e edita tudo, em qualquer data |
| **Líder de escala** | Rotativo, um por culto. Distribui funções **só do culto dele** |
| **Escala** | Quem serve em cada culto |
| **Função** | A tarefa (Sala de amamentação, WC Homens…) |
| **Culto** | O evento. Domingos 10:30, mais especiais (Culto de Mulheres) |

Não digas "líder do dia", "tarefa", "turno" nem "evento" na interface.

## Modelo de dados

Ver `src/lib/modelo.js` — os caminhos estão todos lá, com comentários.

Nota do Firestore: **não há junções.** As atribuições guardam uma cópia do
nome da função, para o ecrã de funções carregar de uma vez.

## Funções: catálogo vs. especiais

`funcoes/{id}.eventoId`:
- `null` → catálogo, aparece em todos os cultos
- `"2026-08-14"` → só naquele culto (ex.: "Subir as coisas da Loja")

Só o líder da base cria no catálogo. O líder de escala só cria especiais,
e só para o culto dele.

## Ordem de construção

1. `entrar` + grelha de fotos + teclado do PIN — a fundação e o maior risco.
   Testa com duas pessoas reais antes de continuar.
2. Painel do líder: voluntários, escala do mês, catálogo de funções.
3. Início (checklist + progresso + calendário) e Escala.
4. Funções, com fases e atribuição múltipla.
5. Inventário, Culto, Feedbacks, Reembolsos, Perfil.
6. Notificações (FCM) e TWA para a Play Store.

Vai para produção depois do passo 4. Os restantes podem entrar a correr.

## Detalhes que já foram decididos e não se discutem outra vez

- Chegada 08:00, fixa por base, editável só pelo líder da base.
- Sem confirmação de presença. Quem não pode avisa pelo WhatsApp.
- Bloqueio do PIN: 3 erros → 15 min → mais 5 tentativas → conta bloqueada.
- Voluntário 4 dígitos, líder da base 6.
- Uma função aceita várias pessoas.
- Funções feitas descem para o fim da lista.
- Reembolso vai para o líder da base, que reencaminha ao Financeiro.
  Nunca escrevas o nome do responsável financeiro na interface.
- O nome do líder é sempre uma variável. Nunca "Alan" no código da UI.
- Português de Portugal, tratamento por tu.

## RGPD

Fotos, nomes, telefones e faturas de pessoas identificadas. O aviso curto no
primeiro login basta — não há formulário em papel. Retenção: operacional
2 meses, reembolsos 5 anos, voluntários inativos 1 ano.
