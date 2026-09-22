/**
 * Opções globais das Cloud Functions — região e CORS.
 *
 * Ficheiro próprio (e não no topo do index.js, onde viveu até à Base
 * Kinder) porque os `import` correm ANTES do corpo do módulo: um
 * ficheiro importado pelo index (ex.: kinder.js) define as suas
 * funções antes de o index chegar ao setGlobalOptions — e elas
 * nasciam em us-central1, sem CORS, dando "not-found" a quem as
 * chamasse em europe-west1. Apanhado no emulador. Todo o ficheiro
 * que define funções importa este primeiro.
 */
import { setGlobalOptions } from "firebase-functions/v2";

// O frontend vive no Cloudflare, não no domínio das Functions — sem isto
// os pedidos são bloqueados como cross-origin. Cobre o domínio de cada
// base (apoio.igrejaonda.pt…), o domínio antigo ainda em DNS, os
// previews do Workers Builds, e o dev local em localhost/127.0.0.1
// em qualquer porta — de propósito, para uma base nova não ter de
// mexer aqui. As portas concretas de cada app vivem só no cliente
// (PORTAS_DEV em packages/shared/src/lib/auth.js).
export const ORIGENS_PERMITIDAS = [
  /^https:\/\/([a-z0-9-]+\.)?igrejaonda\.pt$/,
  /^https:\/\/([a-z0-9-]+\.)?painelonda\.pt$/,
  /^https:\/\/[a-z0-9-]+\.workers\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
];

// Portugal → o datacenter mais próximo. Poupa ~80ms por chamada.
//
// `invoker: "public"` — reportado 2026-09: funções NOVAS (chamadas
// pela primeira vez depois de criadas) davam "CORS policy: no
// 'Access-Control-Allow-Origin' header" no preflight, e o cliente via
// isso como "internal" (a chamada nem chega ao corpo da função — o
// SDK falha antes, sem resposta nenhuma para interpretar). Cloud
// Functions 2ª geração corre sobre Cloud Run, que por defeito exige
// uma política de IAM (`roles/run.invoker`) antes de aceitar qualquer
// pedido — incluindo o OPTIONS do preflight, que nunca chega a `cors`
// acima. `setGlobalOptions({ cors })` cobre as origens; não cobre o
// IAM. A segurança a sério já está dentro de cada função
// (`exigeVisaoPastoral`/`exigeLider`/etc., por claim do token) — nunca
// foi para depender do IAM do Cloud Run, por isso tornar as funções
// publicamente invocáveis não abre nada que já não estivesse aberto.
setGlobalOptions({ region: "europe-west1", maxInstances: 10, cors: ORIGENS_PERMITIDAS, invoker: "public" });
