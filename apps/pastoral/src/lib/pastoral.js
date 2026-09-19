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

/** Move um visitante no funil. Andar para trás é permitido — quem foi
 *  marcado por engano tem de poder voltar (o histórico regista as
 *  duas direções). */
export const moverEtapaContacto = (contactoId, etapa, nota) =>
  chamar("moverEtapaContacto")({ contactoId, etapa, nota: nota ?? null }).then((r) => r.data);

/** Recado de ida para uma base. Sem resposta e sem estado — o líder lê
 *  e dispensa, e é tudo (decisão do dono do produto). */
export const enviarRecadoPastoral = (baseId, texto, urgente) =>
  chamar("enviarRecadoPastoral")({ baseId, texto, urgente: !!urgente }).then((r) => r.data);

/** Os recados já enviados, para o pastor ver o que ainda não foi lido. */
export const recadosPastoral = () => chamar("recadosPastoral")({}).then((r) => r.data);

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
