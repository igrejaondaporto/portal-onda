/**
 * Sugestor de escala — só IFs, sem IA. Corre depois da enquete de
 * indisponibilidade fechar. Nunca publica sozinho: propõe, alerta, o
 * líder ajusta e confirma (ver apps/tecnica/CLAUDE.md).
 *
 * É lógica pura (sem Firestore aqui dentro) — quem chama já trouxe
 * domingos, ministérios, voluntários, indisponibilidades e as
 * estatísticas de quem serviu quando. Isso torna a função testável
 * e fácil de rodar de novo (regenerar) sem reler nada da rede.
 */
import { dataCurta } from "@portal/shared/lib/data.js";

export const RECOMENDADO_MES = 2;
export const ALERTA_MES = 3;
export const DIAS_SEM_SERVIR_ALERTA = 60; // "2 meses"
export const VEZES_PARA_SUGERIR_PROMOCAO = 3;

export const chaveSlot = (domingoId, ministerioId) => `${domingoId}|${ministerioId}`;

/** uid → Set(domingoId) em que a pessoa está indisponível — a partir
 *  das respostas da enquete (quem não respondeu não entra aqui, e por
 *  isso conta como disponível; a falta de resposta vira um alerta à
 *  parte, nunca bloqueia a pessoa). */
export function construirIndisponibilidades(respostas) {
  const mapa = {};
  respostas.forEach((r) => {
    mapa[r.id] = r.semIndisponibilidade ? new Set() : new Set(r.indisponivelEm || []);
  });
  return mapa;
}

/** uid → { ministerioId: vezes } — quantas vezes serviu como aprendiz
 *  em cada ministério, para a promoção sugerida. */
export function calcularVezesAprendiz(historicoLugares) {
  const mapa = {};
  historicoLugares.forEach(({ lugares }) => {
    (lugares || []).forEach((l) => {
      if (!l.aprendizId) return;
      (mapa[l.aprendizId] ??= {});
      mapa[l.aprendizId][l.ministerioId] = (mapa[l.aprendizId][l.ministerioId] ?? 0) + 1;
    });
  });
  return mapa;
}

/** O motor: preenche primeiro os lugares com menos candidatos (evita
 *  o beco sem saída de sobrar um domingo sem ninguém no fim). Um slot
 *  só sai 🔒 quando não havia alternativa (0 ou 1 candidato) — isso é
 *  tudo que o cadeado significa; não é um "fixar" manual.
 *
 *  Importante: "há mais tempo sem servir" e "vezes como aprendiz nesse
 *  ministério" são recalculados a cada atribuição desta própria
 *  geração (não só a partir do histórico real) — senão quem tinha a
 *  data mais antiga no início ficava sempre em primeiro e levava toda
 *  vaga do mês, mesmo depois de já ter sido escalado nesta sugestão. */
export function gerarSugestao({ domingos, ministerios, voluntarios, indisponibilidades, estatisticas, vezesAprendizPorMinisterio }) {
  const ministerioResponsavel = ministerios.find((m) => m.ordem === 0) ?? null;
  const usoPorDomingo = {};
  const contagemMes = {};
  const somar = (id) => { contagemMes[id] = (contagemMes[id] ?? 0) + 1; };
  const usar = (domingoId, id) => { (usoPorDomingo[domingoId] ??= new Set()).add(id); };

  const ultimaEfetiva = {};
  voluntarios.forEach((p) => { ultimaEfetiva[p.id] = estatisticas[p.id]?.ultima ?? ""; });
  const aprendizEfetivo = {};
  Object.entries(vezesAprendizPorMinisterio).forEach(([uid, porM]) => { aprendizEfetivo[uid] = { ...porM }; });

  const resultado = {};
  const indisponivel = (uid, domingoId) => indisponibilidades[uid]?.has(domingoId) ?? false;

  function candidatosTitular(ministerioId, domingoId) {
    return voluntarios
      .filter((p) => p.ministerios?.[ministerioId] === "titular")
      .filter((p) => !indisponivel(p.id, domingoId))
      .filter((p) => ministerioId === ministerioResponsavel?.id || !usoPorDomingo[domingoId]?.has(p.id))
      .sort((a, b) => {
        const ua = ultimaEfetiva[a.id] ?? "";
        const ub = ultimaEfetiva[b.id] ?? "";
        if (ua !== ub) return ua.localeCompare(ub); // nunca serviu ("") vem primeiro
        const va = estatisticas[a.id]?.vezes ?? 0;
        const vb = estatisticas[b.id]?.vezes ?? 0;
        if (va !== vb) return va - vb;
        const ca = contagemMes[a.id] ?? 0, cb = contagemMes[b.id] ?? 0;
        if (ca !== cb) return ca - cb;
        return Math.random() - 0.5; // empate de verdade — dá pra variar ao regenerar
      });
  }

  function candidatosAprendiz(ministerioId, domingoId, excluirId) {
    return voluntarios
      .filter((p) => p.ministerios?.[ministerioId] === "aprendiz")
      .filter((p) => p.id !== excluirId)
      .filter((p) => !indisponivel(p.id, domingoId))
      .filter((p) => !usoPorDomingo[domingoId]?.has(p.id))
      .sort((a, b) => {
        const va = aprendizEfetivo[a.id]?.[ministerioId] ?? 0;
        const vb = aprendizEfetivo[b.id]?.[ministerioId] ?? 0;
        if (va !== vb) return va - vb; // rotação: quem serviu menos vezes como aprendiz aqui
        const ca = contagemMes[a.id] ?? 0, cb = contagemMes[b.id] ?? 0;
        if (ca !== cb) return ca - cb;
        return Math.random() - 0.5;
      });
  }

  let pendentes = [];
  domingos.forEach((d) => {
    ministerios.forEach((m) => {
      pendentes.push({ domingoId: d.id, ministerioId: m.id, chave: chaveSlot(d.id, m.id) });
    });
  });

  while (pendentes.length) {
    let melhorIdx = 0, melhorN = Infinity;
    pendentes.forEach((s, i) => {
      const n = candidatosTitular(s.ministerioId, s.domingoId).length;
      if (n < melhorN) { melhorN = n; melhorIdx = i; }
    });
    const slot = pendentes[melhorIdx];
    pendentes.splice(melhorIdx, 1);

    const cands = candidatosTitular(slot.ministerioId, slot.domingoId);
    const titular = cands[0] ?? null;
    const operacional = slot.ministerioId !== ministerioResponsavel?.id;
    let aprendizId = null;

    if (titular) {
      if (operacional) usar(slot.domingoId, titular.id);
      somar(titular.id);
      ultimaEfetiva[titular.id] = slot.domingoId; // eventoId é sempre "AAAA-MM-DD"
      if (operacional) {
        const candsAp = candidatosAprendiz(slot.ministerioId, slot.domingoId, titular.id);
        const aprendiz = candsAp[0] ?? null;
        if (aprendiz) {
          aprendizId = aprendiz.id;
          usar(slot.domingoId, aprendiz.id);
          somar(aprendiz.id);
          (aprendizEfetivo[aprendiz.id] ??= {});
          aprendizEfetivo[aprendiz.id][slot.ministerioId] = (aprendizEfetivo[aprendiz.id][slot.ministerioId] ?? 0) + 1;
        }
      }
    }

    const forcado = cands.length <= 1; // só havia essa opção (ou nenhuma) — não é um "fixar" manual
    resultado[slot.chave] = {
      titularId: titular?.id ?? null,
      aprendizId,
      travado: forcado,
      motivoTravado: forcado ? (titular ? `só ${titular.nome} disponível` : "ninguém disponível") : null,
      semCandidato: !titular,
    };
  }

  return { resultado, contagemMes };
}

/** Tudo que merece o olhar do líder antes de publicar — nenhum destes
 *  itens bloqueia nada, são avisos, não regras. */
export function calcularAlertas({ domingos, ministerios, voluntarios, resultado, contagemMes, estatisticas, respondentes, vezesAprendizPorMinisterio }) {
  const alertas = [];

  Object.entries(contagemMes).forEach(([uid, vezes]) => {
    if (vezes >= ALERTA_MES) {
      const p = voluntarios.find((v) => v.id === uid);
      if (p) alertas.push({ tipo: "sobrecarga", texto: `${p.nome} escalado ${vezes}× este mês (recomendado ${RECOMENDADO_MES})` });
    }
  });

  Object.entries(resultado).forEach(([chave, r]) => {
    if (!r.semCandidato) return;
    const [domingoId, ministerioId] = chave.split("|");
    const d = domingos.find((x) => x.id === domingoId);
    const m = ministerios.find((x) => x.id === ministerioId);
    alertas.push({ tipo: "sem_candidato", texto: `Ninguém disponível para ${m?.nome ?? ministerioId} em ${d?.tipo || dataCurta(d?.data || domingoId)}` });
  });

  const hoje = new Date().toISOString().slice(0, 10);
  voluntarios.forEach((p) => {
    if (!p.ministerios || !Object.keys(p.ministerios).length) return;
    const ultima = estatisticas[p.id]?.ultima;
    const dias = ultima ? Math.round((new Date(hoje) - new Date(ultima)) / 86400000) : Infinity;
    if (dias >= DIAS_SEM_SERVIR_ALERTA && !contagemMes[p.id]) {
      alertas.push({ tipo: "inativo", texto: `${p.nome} sem servir há ${Number.isFinite(dias) ? dias + " dias" : "sempre"}` });
    }
  });

  voluntarios.forEach((p) => {
    if (!respondentes.has(p.id)) alertas.push({ tipo: "sem_resposta", texto: `${p.nome} não respondeu à enquete` });
  });

  ministerios.forEach((m) => {
    const titulares = voluntarios.filter((p) => p.ministerios?.[m.id] === "titular").length;
    if (titulares < 2) alertas.push({ tipo: "cobertura", texto: `${m.nome} tem só ${titulares} titular${titulares === 1 ? "" : "es"} cadastrado${titulares === 1 ? "" : "s"}` });
  });

  Object.entries(vezesAprendizPorMinisterio).forEach(([uid, porMinisterio]) => {
    Object.entries(porMinisterio).forEach(([ministerioId, vezes]) => {
      if (vezes < VEZES_PARA_SUGERIR_PROMOCAO) return;
      const p = voluntarios.find((v) => v.id === uid);
      const m = ministerios.find((x) => x.id === ministerioId);
      if (p && m && p.ministerios?.[ministerioId] === "aprendiz") {
        alertas.push({ tipo: "promocao", texto: `${p.nome} já serviu ${vezes}× no ${m.nome} como aprendiz. Promover a titular?` });
      }
    });
  });

  return alertas;
}

/** Texto pronto pra colar no WhatsApp — mesmo formato da escala em
 *  papel: um bloco por domingo, uma linha por ministério. */
export function textoEscalaWhatsApp({ mesLabel, domingos, ministerios, resultado, voluntarios }) {
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "por definir";
  const linhas = [`Escala de ${mesLabel} 🎚️`, ""];
  domingos.forEach((d) => {
    linhas.push(`${d.tipo || dataCurta(d.data)}`);
    ministerios.forEach((m) => {
      const r = resultado[chaveSlot(d.id, m.id)];
      if (!r?.titularId) { linhas.push(`${m.nome}: por definir`); return; }
      const aprendiz = r.aprendizId ? ` (+ ${nomeDe(r.aprendizId)} em treino)` : "";
      linhas.push(`${m.nome}: ${nomeDe(r.titularId)}${aprendiz}`);
    });
    linhas.push("");
  });
  return linhas.join("\n").trim();
}
