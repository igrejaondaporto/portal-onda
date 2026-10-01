/**
 * Manter o login acordado (2026-10).
 *
 * Reportado: "demora 30, 40 segundos para entrar depois de pôr o
 * código" no Mural. Não era o PIN (é UMA leitura de documento, por id
 * — não há "procurar mais perto"): era o arranque a frio. Uma Cloud
 * Function de 2.ª geração sem pedidos há uns minutos desliga-se, e o
 * pedido seguinte espera que o servidor arranque do zero — e o login
 * do Mural encadeava três (lista de pessoas → PIN → admin).
 *
 * Duas metades:
 *   1. index.js deixou de carregar PDF/sharp/áudio/FreeShow no topo
 *      (ver o comentário lá) — cada arranque a frio ficou mais curto,
 *      em TODAS as funções de todas as bases.
 *   2. Isto: de 5 em 5 minutos, um pedido `{ aquecer: true }` a cada
 *      função do caminho do login, que lhe responde logo sem ler nada.
 *      O Cloud Run mantém uma instância parada viva uns ~15 minutos,
 *      por isso ela nunca chega a desligar-se.
 *
 * CUSTO ZERO, de propósito (pedido do dono do produto: "não tem como
 * não gastar NADA?"). Não é uma função agendada própria: o Cloud
 * Scheduler só dá 3 jobs grátis por conta de faturação e o projeto já
 * tem mais do que isso (cada job a mais são ~0,10 €/mês). Por isso
 * `aquecerLogin` corre DENTRO do `sondarFreeshow` (index.js), que já
 * existe e já corre a cada minuto — de 5 em 5 minutos faz também isto.
 * As invocações (~45 mil/mês) e o CPU cabem no plano grátis do Cloud
 * Run (2 milhões de pedidos/mês). Nada de `minInstances` (cobrado 24h
 * por dia, ~3 €/mês por função).
 *
 * Uma função nova do caminho do login entra em AQUECER e responde a
 * `req.data?.aquecer` logo na primeira linha — sem isso o pedido
 * "aquece" na mesma, mas lê o Firestore à toa a cada 5 minutos.
 */
import "./opcoes.js";
import { logger } from "firebase-functions";

export const AQUECER = ["entrar", "dadosEntrada", "listarBasesMural", "pedirEntradaMural", "entrarMural"];

function projeto() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId;
  } catch {
    return null;
  }
}

/** Só nos minutos múltiplos de 5 — o `sondarFreeshow` chama isto a
 *  cada minuto (ver o topo). */
export async function aquecerLogin(agora = new Date()) {
  if (agora.getMinutes() % 5 !== 0) return;
  const id = projeto();
  if (!id) return logger.warn("aquecerLogin: sem id do projeto");
  const falhas = [];
  await Promise.all(AQUECER.map(async (nome) => {
    try {
      const r = await fetch(`https://europe-west1-${id}.cloudfunctions.net/${nome}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { aquecer: true } }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) falhas.push(`${nome}: ${r.status}`);
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
  }));
  if (falhas.length) logger.warn("aquecerLogin: algumas não responderam", { falhas });
}
