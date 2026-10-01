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
 * Porquê isto e não `minInstances: 1`: uma instância mínima é cobrada
 * 24h por dia, cada função (uns 3 €/mês cada, ~15 € pelas cinco); isto
 * são ~45 mil invocações por mês (o plano grátis cobre 2 milhões) e um
 * job do Cloud Scheduler (0,10 €/mês a partir do 4.º). Se um dia a
 * igreja crescer ao ponto de vários logins em simultâneo serem
 * normais, aí sim, `minInstances` nas duas ou três mais usadas.
 *
 * Uma função nova do caminho do login entra em AQUECER e responde a
 * `req.data?.aquecer` logo na primeira linha — sem isso o pedido
 * "aquece" na mesma, mas lê o Firestore à toa a cada 5 minutos.
 */
import "./opcoes.js";
import { onSchedule } from "firebase-functions/v2/scheduler";
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

export const manterLoginQuente = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Lisbon" }, async () => {
  const id = projeto();
  if (!id) return logger.warn("manterLoginQuente: sem id do projeto");
  const falhas = [];
  await Promise.all(AQUECER.map(async (nome) => {
    try {
      const r = await fetch(`https://europe-west1-${id}.cloudfunctions.net/${nome}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { aquecer: true } }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) falhas.push(`${nome}: ${r.status}`);
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
  }));
  if (falhas.length) logger.warn("manterLoginQuente: algumas não responderam", { falhas });
});
