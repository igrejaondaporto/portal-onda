/**
 * Sugestor de escala — só IFs, sem IA. Corre depois da enquete de
 * indisponibilidade fechar. Nunca publica sozinho: propõe, alerta, o
 * líder ajusta e confirma (ver apps/apoio/CLAUDE.md).
 *
 * Versão simplificada da Técnica (ver apps/tecnica/src/lib/sugestor.js):
 * a Apoio não tem ministérios/titular/aprendiz, é uma equipa só —
 * cada domingo pede N pessoas quaisquer, sem especialização. Por
 * isso não há o problema de "beco sem saída" da Técnica (preencher
 * o slot com menos candidatos primeiro): aqui qualquer pessoa serve
 * para qualquer domingo, então dá para processar em ordem cronológica.
 *
 * É lógica pura (sem Firestore aqui dentro) — quem chama já trouxe
 * domingos, voluntários, indisponibilidades e as estatísticas de
 * quem serviu quando.
 */
import { dataCurta } from "@portal/shared/lib/data.js";

export const RECOMENDADO_MES = 2;
export const ALERTA_MES = 3;
export const DIAS_SEM_SERVIR_ALERTA = 60; // "2 meses"

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

/** Funde o mapa da enquete com o de compromissos cruzados entre
 *  bases (quem já está escalado noutra base nesse domingo) — mesmo
 *  formato uid → Set(domingoId), união simples. */
export function mesclarIndisponibilidades(...mapas) {
  const saida = {};
  const uids = new Set(mapas.flatMap((m) => Object.keys(m)));
  uids.forEach((uid) => {
    saida[uid] = new Set(mapas.flatMap((m) => [...(m[uid] || [])]));
  });
  return saida;
}

/** O motor: para cada domingo, em ordem cronológica, escolhe as
 *  `tamanhoEquipa` pessoas melhor rankeadas entre as disponíveis.
 *  Ranking: nunca serviu primeiro → há mais tempo sem servir → menos
 *  vezes no histórico → menos vezes já escalada nesta própria geração
 *  (fairness dentro do mês) → sorteio no empate de verdade. A líder
 *  de escala é sempre a primeira pessoa escolhida do domingo — o
 *  líder troca depois na tela, é só um ponto de partida. */
export function gerarSugestaoApoio({ domingos, voluntarios, tamanhoEquipa, indisponibilidades, estatisticas }) {
  const contagemMes = {};
  const somar = (id) => { contagemMes[id] = (contagemMes[id] ?? 0) + 1; };

  const ultimaEfetiva = {};
  voluntarios.forEach((p) => { ultimaEfetiva[p.id] = estatisticas[p.id]?.ultima ?? ""; });

  const resultado = {};
  const indisponivel = (uid, domingoId) => indisponibilidades[uid]?.has(domingoId) ?? false;

  function candidatos(domingoId) {
    return voluntarios
      .filter((p) => !indisponivel(p.id, domingoId))
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

  domingos.forEach((d) => {
    const cands = candidatos(d.id).slice(0, tamanhoEquipa);
    cands.forEach((p) => {
      somar(p.id);
      ultimaEfetiva[p.id] = d.id; // eventoId é sempre "AAAA-MM-DD"
    });
    resultado[d.id] = {
      pessoas: cands.map((p) => p.id),
      liderEscala: cands[0]?.id ?? null,
      semCandidatosSuficientes: cands.length < tamanhoEquipa,
    };
  });

  return { resultado, contagemMes };
}

/** Tudo que merece o olhar do líder antes de publicar — nenhum destes
 *  itens bloqueia nada, são avisos, não regras. */
export function calcularAlertas({ domingos, voluntarios, resultado, contagemMes, estatisticas }) {
  const alertas = [];

  Object.entries(contagemMes).forEach(([uid, vezes]) => {
    if (vezes >= ALERTA_MES) {
      const p = voluntarios.find((v) => v.id === uid);
      if (p) alertas.push({ tipo: "sobrecarga", texto: `${p.nome} escalado ${vezes}× este mês (recomendado ${RECOMENDADO_MES})` });
    }
  });

  domingos.forEach((d) => {
    const r = resultado[d.id];
    if (r?.semCandidatosSuficientes) {
      alertas.push({ tipo: "sem_candidato", texto: `Não há gente suficiente disponível para ${d.tipo || dataCurta(d.data || d.id)} (${r.pessoas.length} de ${r.pessoas.length + 1}+ pedidas)` });
    }
  });

  const hoje = new Date().toISOString().slice(0, 10);
  voluntarios.forEach((p) => {
    const ultima = estatisticas[p.id]?.ultima;
    const dias = ultima ? Math.round((new Date(hoje) - new Date(ultima)) / 86400000) : Infinity;
    if (dias >= DIAS_SEM_SERVIR_ALERTA && !contagemMes[p.id]) {
      alertas.push({ tipo: "inativo", texto: `${p.nome} sem servir há ${Number.isFinite(dias) ? dias + " dias" : "sempre"}` });
    }
  });

  return alertas;
}

/** Reavalia a tabela como ela está agora (depois de o líder mexer à
 *  mão) — não a geração, o estado atual do ecrã. Vermelho é um
 *  problema real (a pessoa votou que não pode); amarelo é só um
 *  ponto de atenção (sobrecarga no mês, não respondeu à enquete).
 *  Devolve, por domingo, uid → {nivel: "erro"|"atencao", motivo}. */
export function validarSugestao({ resultado, domingos, indisponibilidades, respondentes }) {
  const indisponivel = (uid, domingoId) => indisponibilidades[uid]?.has(domingoId) ?? false;

  const contagemMes = {};
  domingos.forEach((d) => {
    (resultado[d.id]?.pessoas ?? []).forEach((uid) => {
      contagemMes[uid] = (contagemMes[uid] ?? 0) + 1;
    });
  });

  const avisos = {};
  domingos.forEach((d) => {
    const pessoas = resultado[d.id]?.pessoas ?? [];
    const avisosDomingo = {};
    pessoas.forEach((uid) => {
      if (indisponivel(uid, d.id)) {
        avisosDomingo[uid] = { nivel: "erro", motivo: "indisponível nesse dia" };
        return;
      }
      if ((contagemMes[uid] ?? 0) > RECOMENDADO_MES) {
        avisosDomingo[uid] = { nivel: "atencao", motivo: `escalado ${contagemMes[uid]}× este mês (recomendado ${RECOMENDADO_MES})` };
        return;
      }
      if (!respondentes.has(uid)) {
        avisosDomingo[uid] = { nivel: "atencao", motivo: "não respondeu à enquete" };
        return;
      }
      avisosDomingo[uid] = null;
    });
    avisos[d.id] = avisosDomingo;
  });

  return avisos;
}
