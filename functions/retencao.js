/**
 * Retenção de dados pessoais — RGPD, em código.
 *
 * O `CLAUDE.md` da raiz define os prazos desde o início:
 *
 *     Retenção: operacional 2 meses, reembolsos 5 anos,
 *               voluntários inativos 1 ano.
 *
 * Até agora só a Kinder os aplicava a sério
 * (`purgarFamiliasInativasKinder`, `functions/kinder.js`). As outras
 * nove bases acumulavam — o que é pior do que não ter política
 * nenhuma, porque a política escrita cria a expectativa de que é
 * cumprida.
 *
 * ── A tensão com a regra 5, e como se resolve ───────────────────
 *
 * A regra 5 do `CLAUDE.md` diz "nada é apagado, é desativado — o
 * histórico depende disso". O RGPD diz o contrário para dados
 * pessoais. As duas coisas conciliam-se assim, e é a decisão de
 * desenho deste ficheiro:
 *
 *   **Anonimiza-se a pessoa, não se apaga o registo.**
 *
 * O que sai é o que identifica alguém e já não serve para nada
 * (telefone, foto, o PIN, o IBAN/MB Way). O que fica é o que o
 * histórico precisa: o documento da pessoa, o `nome`, e as escalas
 * onde ela aparece. Apagar o documento partia todas as escalas
 * passadas em que o uid dela consta — ficariam a apontar para nada, e
 * o histórico de dois anos de domingos passava a ter buracos sem que
 * ninguém percebesse porquê.
 *
 * O `nome` fica de propósito: é o mínimo para o histórico continuar
 * legível ("quem serviu neste culto?"), e é uma decisão do
 * responsável pelo tratamento — não deste ficheiro. Está assinalada
 * no `CLAUDE.md` da raiz para poder ser mudada com uma linha aqui.
 *
 * ── Conservador por construção ──────────────────────────────────
 *
 * Isto apaga dados a sério, sozinho, todos os dias, em produção. Três
 * travões, e nenhum é opcional:
 *
 *   1. **Multi-base**: uma pessoa inativa na Apoio mas ativa na
 *      Técnica NÃO é tocada. `pessoas/{uid}` e o PIN são globais
 *      (regra 2) — limpá-los por causa de uma base deixava a pessoa
 *      sem entrar na outra, e isso é um incidente, não uma purga.
 *   2. **Data de referência explícita**: sem uma data fiável de
 *      inatividade, não se toca. Um documento antigo sem
 *      `desativadoEm` nem `criadoEm` fica como está — a dúvida nunca
 *      resolve a favor de apagar.
 *   3. **Rasto**: cada corrida grava o que fez em `logs/retencao`.
 *      Uma purga silenciosa é indistinguível de um bug que apagou
 *      dados.
 */
import "./opcoes.js";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { logger } from "firebase-functions";

const db = () => admin.firestore();

/* Os prazos do CLAUDE.md, num sítio só. Em MESES para todos, para se
 * compararem de relance — 60 meses lê-se pior que 5 anos, mas evita
 * três unidades diferentes no mesmo ficheiro. */
const MESES_OPERACIONAL = 2;
const MESES_VOLUNTARIO_INATIVO = 12;
const MESES_REEMBOLSO = 60;

const limiteMs = (meses) => {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d.getTime();
};

/** "2026-09-19" → ms locais. Usado para as coleções cujo id é a data
 *  (chamadas/{dia}); `new Date(iso)` leria como UTC e, no inverno em
 *  Portugal, recuava um dia — o que aqui significaria apagar um dia a
 *  mais do que devia. */
function msDeIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).getTime();
}

const ms = (ts) => ts?.toMillis?.() ?? null;

async function apagarFicheiroSeExistir(caminho) {
  if (!caminho) return;
  try {
    await admin.storage().bucket().file(caminho).delete();
  } catch { /* já não existe, nada a fazer */ }
}

/** O `anexo`/`comprovativo` de um reembolso é sempre um download URL
 *  do Storage (sobe sempre por `lib/reembolsos.js`), por isso o
 *  caminho real está embutido nele. Mesma função que a Kinder usa
 *  para os anexos das lições, e pelo mesmo motivo: poupa reconstruir
 *  um nome que varia com a extensão. */
function caminhoDeUrlStorage(url) {
  const m = /\/o\/([^?]+)/.exec(String(url || ""));
  return m ? decodeURIComponent(m[1]) : null;
}

/** O rasto. Um documento por corrida, com o que foi tocado — nunca
 *  com os dados em si (seria guardar o que se acabou de apagar). */
async function registarCorrida(tarefa, resumo) {
  await db().collection("logs").doc("retencao").collection("corridas").add({
    tarefa, ...resumo, em: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info(`retencao/${tarefa}`, resumo);
}

/* ══════════════════════════════════════════════════════════════
 *  1. OPERACIONAL (2 meses) — o histórico de chamadas
 * ══════════════════════════════════════════════════════════════
 *
 * `chamadas/{dia}/canais/{canal}/itens/{item}` é o telão do Kinder e
 * o "Carro" da Técnica. Tem **nomes de crianças e matrículas**, e é
 * `allow read: if true` — leitura pública, de propósito (é um telão
 * num ecrã à porta, sem login). Isso está certo enquanto a chamada
 * está no ar e errado para sempre: um registo de que criança foi
 * chamada em que domingo, público e eterno, é exatamente o tipo de
 * dado que o prazo "operacional 2 meses" existe para limitar.
 *
 * É, de longe, o purgador com melhor razão para existir, e o de menor
 * risco: nada no produto lê chamadas de há dois meses.
 */
export const purgarChamadasAntigas = onSchedule("every 24 hours", async () => {
  const limite = limiteMs(MESES_OPERACIONAL);
  const dias = await db().collection("chamadas").get();

  let diasApagados = 0;

  for (const dia of dias.docs) {
    const quando = msDeIso(dia.id);
    if (quando === null || quando >= limite) continue;   // travão 2: sem data fiável, não se toca

    // recursiveDelete apaga o documento E as subcoleções por baixo
    // (canais/{canal}/itens/{item}) — sem ele, apagar só o documento
    // do dia deixava os itens órfãos, invisíveis e eternos, que é o
    // contrário do que esta função existe para fazer.
    //
    // Conta-se o DIA e não os itens: o item não tem campo `dia`
    // (`registarChamada` grava só canalId/txt/quando), por isso não há
    // como os contar sem os ler um a um antes de os apagar — e um
    // número no log não vale uma varredura de todas as subcoleções.
    await db().recursiveDelete(dia.ref);
    diasApagados++;
  }

  await registarCorrida("chamadas", { diasApagados, limite: new Date(limite).toISOString() });
});

/* ══════════════════════════════════════════════════════════════
 *  2. VOLUNTÁRIOS INATIVOS (1 ano) — anonimizar, não apagar
 * ══════════════════════════════════════════════════════════════ */

/** As bases onde esta pessoa ainda está ATIVA. É o travão 1, e é a
 *  parte que tem mesmo de estar certa: `pessoas/{uid}` e o PIN são
 *  globais (regra 2 do CLAUDE.md), e limpá-los por causa de uma base
 *  onde ela saiu deixaria a pessoa sem conseguir entrar na base onde
 *  continua a servir. Lê o mapa `bases` do documento global e
 *  confirma base a base — nunca confia só no mapa, que é
 *  denormalizado e pode ficar para trás. */
async function basesOndeAindaServe(uid) {
  const global = await db().doc(`pessoas/${uid}`).get();
  if (!global.exists) return [];
  const candidatas = Object.keys(global.data().bases || {});
  const snaps = await Promise.all(
    candidatas.map((b) => db().doc(`bases/${b}/pessoas/${uid}`).get().catch(() => null)));
  return candidatas.filter((_, i) => snaps[i]?.exists && snaps[i].data().ativo !== false);
}

export const purgarDadosDeVoluntariosInativos = onSchedule("every 24 hours", async () => {
  const limite = limiteMs(MESES_VOLUNTARIO_INATIVO);

  const inativos = await db().collectionGroup("pessoas").where("ativo", "==", false).get();

  let anonimizados = 0;
  let saltadosPorServirNoutraBase = 0;
  let saltadosPorFaltaDeData = 0;

  for (const snap of inativos.docs) {
    // collectionGroup("pessoas") apanha bases/{b}/pessoas E
    // bases/kinder/familias/{f}/pessoas se um dia existir — só se
    // aceita o caminho de 4 segmentos que é mesmo um voluntário
    const partes = snap.ref.path.split("/");
    if (partes.length !== 4 || partes[0] !== "bases" || partes[2] !== "pessoas") continue;

    const baseId = partes[1];
    const uid = snap.id;
    const p = snap.data();

    const referencia = ms(p.desativadoEm) ?? ms(p.atualizadoEm) ?? ms(p.criadoEm);
    if (referencia === null || referencia >= limite) {
      if (referencia === null) saltadosPorFaltaDeData++;      // travão 2
      continue;
    }

    const aindaAtiva = await basesOndeAindaServe(uid);
    if (aindaAtiva.length) { saltadosPorServirNoutraBase++; continue; }   // travão 1

    // ── o que sai ──────────────────────────────────────────────
    // O documento da base fica (o histórico das escalas aponta para
    // este uid); saem os campos que identificam a pessoa e já não
    // servem para nada. `nome` fica — ver o cabeçalho.
    const apagar = admin.firestore.FieldValue.delete();
    await snap.ref.set({
      telefone: apagar, foto: apagar,
      anonimizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await Promise.all([
      // a foto no Storage — o URL saiu do documento, mas o ficheiro
      // ficaria lá para sempre, e é publicamente descarregável por
      // quem tenha o link
      apagarFicheiroSeExistir(`bases/${baseId}/pessoas/${uid}`),
      // o PIN, os dados bancários e o e-mail. Só aqui, e só porque já se
      // confirmou que esta pessoa não serve em mais nenhuma base.
      db().doc(`pessoas/${uid}/privado/auth`).delete().catch(() => {}),
      db().doc(`pessoas/${uid}/privado/pagamento`).delete().catch(() => {}),
      // o e-mail dos avisos (2026-09) — mesmo motivo
      db().doc(`pessoas/${uid}/privado/email`).delete().catch(() => {}),
      db().doc(`pessoas/${uid}`).set({ foto: apagar }, { merge: true }),
    ]);

    anonimizados++;
  }

  await registarCorrida("voluntariosInativos", {
    anonimizados, saltadosPorServirNoutraBase, saltadosPorFaltaDeData,
    limite: new Date(limite).toISOString(),
  });
});

/* ══════════════════════════════════════════════════════════════
 *  3. REEMBOLSOS (5 anos)
 * ══════════════════════════════════════════════════════════════
 *
 * Cinco anos é o prazo fiscal, não o operacional — por isso este é o
 * único dos três onde se apaga o documento a sério: passado esse
 * prazo, a igreja já não pode nem deve guardar a fatura de ninguém.
 *
 * Na prática isto não vai apagar nada durante anos (o repo é de
 * 2026). Existe agora porque a alternativa é alguém se lembrar disto
 * em 2031, e ninguém se vai lembrar.
 */
export const purgarReembolsosAntigos = onSchedule("every 24 hours", async () => {
  const limite = limiteMs(MESES_REEMBOLSO);
  const todos = await db().collectionGroup("reembolsos").get();

  let apagados = 0;
  let anexosApagados = 0;

  for (const snap of todos.docs) {
    const r = snap.data();
    const referencia = ms(r.pagoEm) ?? ms(r.decididoEm) ?? ms(r.criadoEm);
    if (referencia === null || referencia >= limite) continue;

    for (const url of [r.anexo, r.comprovativoUrl]) {
      const caminho = caminhoDeUrlStorage(url);
      if (caminho) { await apagarFicheiroSeExistir(caminho); anexosApagados++; }
    }
    await snap.ref.delete();
    apagados++;
  }

  await registarCorrida("reembolsos", { apagados, anexosApagados, limite: new Date(limite).toISOString() });
});

/* ══════════════════════════════════════════════════════════════
 *  ENSAIO — o que aconteceria, sem acontecer
 * ══════════════════════════════════════════════════════════════
 *
 * Três funções que apagam dados sozinhas, todos os dias, e que não
 * têm emulador neste repositório. Isto existe para alguém poder
 * perguntar "o que é que isto ia apagar hoje?" antes de confiar nelas
 * — e para continuar a poder perguntar depois de mudar um prazo.
 *
 * Só conta; nunca escreve nem apaga nada. Fica atrás da capacidade
 * pastoral porque cruza todas as bases, como o resto do painel.
 */
export const ensaiarRetencao = onCall(async (req) => {
  if (req.auth?.token?.ve_tudo_pastoral !== true) {
    throw new HttpsError("permission-denied", "Só a equipa pastoral pode ver isto.");
  }

  const limiteChamadas = limiteMs(MESES_OPERACIONAL);
  const limiteInativos = limiteMs(MESES_VOLUNTARIO_INATIVO);
  const limiteReembolsos = limiteMs(MESES_REEMBOLSO);

  const [dias, inativos, reembolsos] = await Promise.all([
    db().collection("chamadas").get(),
    db().collectionGroup("pessoas").where("ativo", "==", false).get(),
    db().collectionGroup("reembolsos").get(),
  ]);

  const chamadas = dias.docs.filter((d) => {
    const q = msDeIso(d.id);
    return q !== null && q < limiteChamadas;
  }).length;

  let voluntarios = 0;
  let voluntariosSemData = 0;
  for (const snap of inativos.docs) {
    const partes = snap.ref.path.split("/");
    if (partes.length !== 4 || partes[0] !== "bases" || partes[2] !== "pessoas") continue;
    const p = snap.data();
    const referencia = ms(p.desativadoEm) ?? ms(p.atualizadoEm) ?? ms(p.criadoEm);
    if (referencia === null) { voluntariosSemData++; continue; }
    if (referencia >= limiteInativos) continue;
    if ((await basesOndeAindaServe(snap.id)).length) continue;
    voluntarios++;
  }

  const pedidos = reembolsos.docs.filter((d) => {
    const r = d.data();
    const referencia = ms(r.pagoEm) ?? ms(r.decididoEm) ?? ms(r.criadoEm);
    return referencia !== null && referencia < limiteReembolsos;
  }).length;

  return {
    prazos: {
      operacionalMeses: MESES_OPERACIONAL,
      voluntarioInativoMeses: MESES_VOLUNTARIO_INATIVO,
      reembolsoMeses: MESES_REEMBOLSO,
    },
    chamadas: { dias: chamadas },
    voluntarios: { aAnonimizar: voluntarios, semDataDeReferencia: voluntariosSemData },
    reembolsos: { aApagar: pedidos },
  };
});
