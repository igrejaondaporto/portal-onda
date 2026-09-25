/**
 * As Cloud Functions do painel — tudo o que exige ler as outras bases
 * pelo Admin SDK (ver o cabeçalho de `functions/pastoral.js`).
 *
 * Nenhuma destas é ao vivo: são retratos, pedidos uma vez quando a aba
 * abre. O que tem de ser ao vivo (checklist, culto ao vivo, contagem,
 * escala) é `onSnapshot` direto, em `lib/culto.js` — chamar uma função
 * a cada toque de checkbox das dez bases seria caro e lento.
 */
import { chamar } from "@portal/shared/lib/firebase.js";

/** O estado das dez bases numa chamada. `eventoId` é opcional: sem
 *  ele, o resumo vem sem a coluna "escala deste culto". */
export const panoramaPastoral = (eventoId) =>
  chamar("panoramaPastoral")({ eventoId: eventoId ?? null }).then((r) => r.data);

/** Uma linha por pessoa da igreja, com as bases onde serve — é daqui
 *  que sai quem serve em mais do que uma base. */
export const pessoasPastoral = () => chamar("pessoasPastoral")({}).then((r) => r.data);

/** Inventário e património das dez bases, achatado. */
export const patrimonioPastoral = () => chamar("patrimonioPastoral")({}).then((r) => r.data);

/** Os números que viram gráfico, numa janela de datas (máx. 3 anos). */
export const historicoPastoral = (desde, ate) =>
  chamar("historicoPastoral")({ desde, ate }).then((r) => r.data);

/** Quem serviu quantos dos domingos do período, somando todas as
 *  bases. Conta CULTOS e não escalas: servir em duas bases no mesmo
 *  domingo é um domingo. */
export const desgastePastoral = (desde, ate) =>
  chamar("desgastePastoral")({ desde, ate }).then((r) => r.data);

/** Move um visitante no funil. Andar para trás é permitido — quem foi
 *  marcado por engano tem de poder voltar (o histórico regista as
 *  duas direções). */
/** `gdId` só com `etapa: "gd"` — em que GD ficou (catálogo global
 *  `gds/{gd}`, da Pessoal). Opcional: sem ele, move como sempre. */
export const moverEtapaContacto = (contactoId, etapa, nota, gdId) =>
  chamar("moverEtapaContacto")({ contactoId, etapa, nota: nota ?? null, ...(gdId ? { gdId } : {}) }).then((r) => r.data);

/** "Excluir" um contacto — nunca um delete a sério, `arquivado:true`
 *  (regra 5 do CLAUDE.md raiz). */
export const arquivarContactoPastoral = (contactoId) =>
  chamar("arquivarContactoPastoral")({ contactoId }).then((r) => r.data);

/** Corrige a DURAÇÃO de um momento de um culto já fechado (não a hora
 *  de relógio — ninguém sabe de cor a que horas algo entrou, sabe
 *  quanto tempo durou). O registo ao vivo, uma vez finalizado, fica
 *  congelado sem isto. */
export const corrigirDuracaoSecaoCulto = (eventoId, nome, duracaoMin) =>
  chamar("corrigirDuracaoSecaoCulto")({ eventoId, nome, duracaoMin }).then((r) => r.data);

/** Troca o líder de uma base. Um líder de cada vez — promover alguém
 *  demove quem lá estava para "voluntario". */
export const definirLiderBase = (baseId, pessoaId) =>
  chamar("definirLiderBase")({ baseId, pessoaId }).then((r) => r.data);

/** Recado de ida para uma base. Sem resposta e sem estado — o líder lê
 *  e dispensa, e é tudo (decisão do dono do produto). */
export const enviarRecadoPastoral = (baseId, texto, urgente) =>
  chamar("enviarRecadoPastoral")({ baseId, texto, urgente: !!urgente }).then((r) => r.data);

/** Os recados já enviados, para o pastor ver o que ainda não foi lido. */
export const recadosPastoral = () => chamar("recadosPastoral")({}).then((r) => r.data);

/** Cria alguém na equipa pastoral (ou liga, sozinho, a uma pessoa que
 *  já existe noutra base — pelo telefone). Todo membro da equipa pode
 *  chamar isto, não só quem tem "lider_base": aqui não existe outro
 *  papel com poder a mais, é uma equipa pequena (pedido 2026-09,
 *  esclarecido: "só dentro da equipa Pastoral"). */
export const criarPessoaPastoral = (nome, telefone, papel) =>
  chamar("criarPessoaPastoral")({ nome, telefone, papel }).then((r) => r.data);

/** Repõe o código de outro membro da equipa para o valor fixo de
 *  sempre — a pessoa troca no próximo acesso. */
export const reporPinPastoral = (pessoaId) =>
  chamar("reporPinPastoral")({ pessoaId }).then((r) => r.data);

/* ── a ordem do culto: funções que já existiam ────────────────
 * O painel publica com a MESMA `publicarOrdemCulto` que a Backstage
 * usa desde que a ordem do culto existe — a claim `pode_publicar_culto`
 * (de `bases/{b}.culto.podePublicar`) já cobre as duas bases, e não há
 * função nova nenhuma para isto. O PDF continua a ser o caminho da
 * Backstage; aqui monta-se de raiz, e o campo `origem:"manual"` que
 * `publicarOrdemCulto` já aceitava é o que distingue as duas origens
 * no documento do evento. */
export const publicarOrdemCulto = (dados) => chamar("publicarOrdemCulto")(dados).then((r) => r.data);
export const limparOrdemCulto = (eventoId) => chamar("limparOrdemCulto")({ eventoId }).then((r) => r.data);
export const criarCultoEspecial = (dados) => chamar("criarCultoEspecial")(dados).then((r) => r.data);
export const gerarDomingos = (ano) => chamar("gerarDomingos")({ ano }).then((r) => r.data);

/** Só a etiqueta do culto (`eventos/{e}.tipoCulto`) — não toca na
 *  ordem, que continua a subir pela Backstage em PDF. */
export const definirTipoCulto = (eventoId, tipoCulto) =>
  chamar("definirTipoCulto")({ eventoId, tipoCulto }).then((r) => r.data);

/** Evento da igreja (`eventos/{data}`) — criar ou editar, com as bases
 *  que servem. As outras ficam em `dispensadaPor`. */
export const guardarEventoIgreja = (dados) => chamar("guardarEventoIgreja")(dados).then((r) => r.data);

/** Só eventos futuros; leva as escalas de todas as bases. */
export const apagarEventoIgreja = (eventoId) => chamar("apagarEventoIgreja")({ eventoId }).then((r) => r.data);

/* ── e-mail dos avisos (Resend) — functions/email.js ─────────── */
// A chave vai só num sentido: daqui para o servidor. Nenhuma destas
// devolve a chave — só `chaveFim` (os últimos 4 caracteres).
export const estadoEnvioEmail = () => chamar("estadoEnvioEmail")({}).then((r) => r.data);
export const configurarEnvioEmail = (dados) => chamar("configurarEnvioEmail")(dados).then((r) => r.data);
export const enviarEmailTeste = (para) => chamar("enviarEmailTeste")({ para }).then((r) => r.data);
