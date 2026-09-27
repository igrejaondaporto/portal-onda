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

/** uid → número (quantas vezes a pessoa disse que consegue servir
 *  este mês) — só entra quem respondeu isso; quem não respondeu, ou
 *  deixou em branco, fica sem entrada nenhuma no mapa (sem limite,
 *  comportamento de sempre). Diferente de `indisponibilidades`: dá
 *  para estar disponível em vários domingos e mesmo assim só poder
 *  servir uma vez — "o Kairan está disponível em 2 domingos de
 *  outubro, mas só pode servir 1x no mês" (pedido do líder, 2026-09).
 *  Quantas vezes JÁ está escalada é o `contagemMes` que o motor (ou
 *  `contagemMesDoResultado`) já mantém; este mapa é só o teto. */
export function construirLimitesMes(respostas) {
  const mapa = {};
  respostas.forEach((r) => {
    if (Number.isInteger(r.maxVezesMes) && r.maxVezesMes > 0) mapa[r.id] = r.maxVezesMes;
  });
  return mapa;
}

/** Quantas vezes cada pessoa já aparece num `resultado` (a tabela
 *  inteira, como titular OU aprendiz, em qualquer domingo e
 *  ministério) — a mesma soma que `validarSugestao` já fazia por
 *  dentro para o aviso de sobrecarga, extraída para ser reutilizada
 *  por quem precisa do número sem precisar de repetir os dois
 *  `forEach` aninhados. */
export function contagemMesDoResultado(resultado) {
  const contagem = {};
  Object.values(resultado).forEach((r) => {
    if (r?.titularId) contagem[r.titularId] = (contagem[r.titularId] ?? 0) + 1;
    if (r?.aprendizId) contagem[r.aprendizId] = (contagem[r.aprendizId] ?? 0) + 1;
  });
  return contagem;
}

/** Funde o mapa da enquete com o de compromissos cruzados entre
 *  bases (quem já está escalado na Apoio nesse domingo) — mesmo
 *  formato uid → Set(domingoId), união simples. Quem está bloqueado
 *  numa base ou noutra conta como indisponível aqui, sem distinção;
 *  o motivo não interessa ao motor, só ao aviso mostrado ao líder. */
export function mesclarIndisponibilidades(...mapas) {
  const saida = {};
  const uids = new Set(mapas.flatMap((m) => Object.keys(m)));
  uids.forEach((uid) => {
    saida[uid] = new Set(mapas.flatMap((m) => [...(m[uid] || [])]));
  });
  return saida;
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
export function gerarSugestao({ domingos, ministerios, voluntarios, indisponibilidades, estatisticas, vezesAprendizPorMinisterio, limitesMes = {} }) {
  const ministerioResponsavel = ministerios.find((m) => m.ordem === 0) ?? null;
  const usoPorDomingo = {};
  const contagemMes = {};
  const somar = (id) => { contagemMes[id] = (contagemMes[id] ?? 0) + 1; };
  const usar = (domingoId, id) => { (usoPorDomingo[domingoId] ??= new Set()).add(id); };
  // "só posso servir 1x este mês" — contagemMes já vai sendo somado
  // slot a slot NESTA MESMA geração, por isso a segunda vez que o
  // motor tenta escalar o Kairan ele já não aparece, mesmo que esteja
  // livre nesse domingo (pedido do líder, 2026-09).
  const dentroDoLimite = (id) => (contagemMes[id] ?? 0) < (limitesMes[id] ?? Infinity);

  const ultimaEfetiva = {};
  voluntarios.forEach((p) => { ultimaEfetiva[p.id] = estatisticas[p.id]?.ultima ?? ""; });
  const aprendizEfetivo = {};
  Object.entries(vezesAprendizPorMinisterio).forEach(([uid, porM]) => { aprendizEfetivo[uid] = { ...porM }; });
  const aprendizMes = {}; // uid → vezes escalado como aprendiz neste mês (em qualquer ministério)

  const resultado = {};
  const indisponivel = (uid, domingoId) => indisponibilidades[uid]?.has(domingoId) ?? false;

  function candidatosTitular(ministerioId, domingoId) {
    return voluntarios
      .filter((p) => p.ministerios?.[ministerioId] === "titular")
      .filter((p) => !indisponivel(p.id, domingoId))
      .filter((p) => dentroDoLimite(p.id))
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

  // treinar não precisa acontecer toda semana — 2x no mês já basta
  // pra rodar entre os aprendizes e respeitar o limite saudável (ver
  // RECOMENDADO_MES). Quem já bateu o limite simplesmente sai da
  // lista de candidatos — o slot fica sem aprendiz nesse domingo, o
  // que é normal, não é obrigatório preencher.
  function candidatosAprendiz(ministerioId, domingoId, excluirId) {
    return voluntarios
      .filter((p) => p.ministerios?.[ministerioId] === "aprendiz")
      .filter((p) => p.id !== excluirId)
      .filter((p) => !indisponivel(p.id, domingoId))
      .filter((p) => dentroDoLimite(p.id))
      .filter((p) => !usoPorDomingo[domingoId]?.has(p.id))
      .filter((p) => (aprendizMes[p.id] ?? 0) < RECOMENDADO_MES)
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
          aprendizMes[aprendiz.id] = (aprendizMes[aprendiz.id] ?? 0) + 1;
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

/** A mesma forma que `gerarSugestao` devolve ({resultado, contagemMes}),
 *  só que a partir da escala JÁ PUBLICADA (lida do Firestore por
 *  `obterEscalasDosEventos`) em vez de propor do zero — "Editar
 *  escala" carrega isto para o líder poder trocar uma célula (alguém
 *  avisou que afinal não pode) sem arriscar reescrever o mês inteiro
 *  com uma sugestão nova e aleatória.
 *
 *  `travado`/`motivoTravado`/`semCandidato` ficam sempre neutros: não
 *  há "só havia essa opção" a dizer sobre uma escolha que já foi
 *  publicada, e um lugar sem titular aqui é "por definir", não "sem
 *  candidato" — essa distinção só existe durante a geração automática.
 *
 *  `escalasPorDomingo`: {domingoId: {lugares: [{ministerioId,
 *  titularId, aprendizId}]}} — a forma que `obterEscalasDosEventos`
 *  devolve. */
export function resultadoDaEscalaAtual(domingos, ministerios, escalasPorDomingo) {
  const resultado = {};
  const contagemMes = {};
  const somar = (id) => { if (id) contagemMes[id] = (contagemMes[id] ?? 0) + 1; };

  domingos.forEach((d) => {
    const lugares = escalasPorDomingo[d.id]?.lugares || [];
    ministerios.forEach((m) => {
      const l = lugares.find((x) => x.ministerioId === m.id);
      resultado[chaveSlot(d.id, m.id)] = {
        titularId: l?.titularId ?? null, aprendizId: l?.aprendizId ?? null,
        travado: false, motivoTravado: null, semCandidato: false,
      };
      somar(l?.titularId);
      somar(l?.aprendizId);
    });
  });

  return { resultado, contagemMes };
}

/** Quem pode aparecer no seletor de uma célula, ao editar à mão UMA
 *  sugestão já gerada (`SugestorEscala.jsx`) — as mesmas duas
 *  restrições duras do motor acima (`candidatosTitular`/
 *  `candidatosAprendiz`), só que aplicadas ao estado ATUAL da tabela,
 *  não à geração: fora quem votou indisponível nesse domingo, fora
 *  quem já está noutro ministério OPERACIONAL nesse mesmo domingo
 *  (Responsável acumula por regra — nunca entra nesta conta, ver
 *  CLAUDE.md, "a exceção"). Antes disto o `<select>` listava TODA A
 *  GENTE daquele nível, indisponível incluído — o líder marcava
 *  "Julio: indisponível no Encontro de Mulheres" na enquete e via na
 *  mesma o Julio como opção para o escalar nesse dia.
 *
 *  O que NÃO entra aqui: os limites "suaves" (sobrecarregado no mês,
 *  aprendiz já treinou 2× este mês, não respondeu à enquete) — esses
 *  continuam a ser avisos AMARELOS depois de escolhido
 *  (`validarSugestao`), não uma porta fechada; só o vermelho vira
 *  filtro. A pessoa já selecionada nessa célula fica sempre na lista,
 *  mesmo inválida — é assim que o aviso vermelho por baixo do
 *  `<select>` continua a apontar para um nome visível, em vez de o
 *  campo ficar em branco sem se perceber porquê.
 *
 *  Uma terceira restrição dura, ao lado das duas de sempre: quem já
 *  atingiu o número de vezes que disse conseguir servir este mês
 *  (`limitesMes`, ver `construirLimitesMes`) — "o Kairan está
 *  disponível em 2 domingos, mas só pode servir 1x". Ao contrário de
 *  `usadoNoutroLugar` (só o mesmo domingo), esta conta o MÊS INTEIRO,
 *  por isso não é `operacional`-condicionada como aquela — um limite
 *  que a própria pessoa deu não tem a exceção do Responsável, que
 *  existe só porque ele é um papel, não um posto a competir por vaga. */
export function candidatosParaEditar({
  voluntarios, ministerios, resultado, indisponibilidades, limitesMes = {},
  ministerioId, nivel, domingoId, atual = null, excluirId = null,
}) {
  const ministerioResponsavel = ministerios.find((m) => m.ordem === 0) ?? null;
  const operacional = ministerioId !== ministerioResponsavel?.id;
  const chaveDoSlot = chaveSlot(domingoId, ministerioId);
  const indisponivel = (uid) => indisponibilidades[uid]?.has(domingoId) ?? false;
  const usadoNoutroLugar = (uid) => operacional && ministerios.some((m) => {
    if (m.id === ministerioResponsavel?.id) return false;   // Responsável não conta
    const chave = chaveSlot(domingoId, m.id);
    if (chave === chaveDoSlot) return false;                 // a própria célula não conta contra si
    const r = resultado[chave];
    return r?.titularId === uid || r?.aprendizId === uid;
  });
  const contagemMes = contagemMesDoResultado(resultado);
  const limiteAtingido = (uid) => (contagemMes[uid] ?? 0) >= (limitesMes[uid] ?? Infinity);

  return voluntarios
    .filter((p) => p.ministerios?.[ministerioId] === nivel)
    .filter((p) => p.id !== excluirId)
    .filter((p) => p.id === atual || (!indisponivel(p.id) && !usadoNoutroLugar(p.id) && !limiteAtingido(p.id)));
}

/** Tudo que merece o olhar do líder antes de publicar — nenhum destes
 *  itens bloqueia nada, são avisos, não regras. */
export function calcularAlertas({ domingos, ministerios, voluntarios, resultado, contagemMes, estatisticas, vezesAprendizPorMinisterio }) {
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
        alertas.push({
          tipo: "promocao", pessoaId: p.id, ministerioId: m.id,
          texto: `${p.nome} já serviu ${vezes}× no ${m.nome} como aprendiz. Promover a titular?`,
        });
      }
    });
  });

  return alertas;
}

/** Reavalia a tabela como ela está agora (depois de o líder mexer à
 *  mão) — não a geração, o estado atual do ecrã. Vermelho é um
 *  problema real (a pessoa votou que não pode, ou já está noutro
 *  ministério nesse domingo); amarelo é só um ponto de atenção
 *  (sobrecarga no mês, não respondeu à enquete). Devolve, por slot,
 *  {titular, aprendiz} — cada um null ou {nivel: "erro"|"atencao", motivo}. */
export function validarSugestao({ resultado, domingos, ministerios, indisponibilidades, respondentes, limitesMes = {} }) {
  const ministerioResponsavel = ministerios.find((m) => m.ordem === 0) ?? null;
  const indisponivel = (uid, domingoId) => indisponibilidades[uid]?.has(domingoId) ?? false;

  const contagemMes = {};
  const aprendizMes = {};
  domingos.forEach((d) => {
    ministerios.forEach((m) => {
      const r = resultado[chaveSlot(d.id, m.id)];
      if (!r) return;
      if (r.titularId) contagemMes[r.titularId] = (contagemMes[r.titularId] ?? 0) + 1;
      if (r.aprendizId) {
        contagemMes[r.aprendizId] = (contagemMes[r.aprendizId] ?? 0) + 1;
        aprendizMes[r.aprendizId] = (aprendizMes[r.aprendizId] ?? 0) + 1;
      }
    });
  });

  const avisos = {};
  domingos.forEach((d) => {
    ministerios.forEach((m) => {
      const chave = chaveSlot(d.id, m.id);
      const r = resultado[chave];
      if (!r) return;
      const operacional = m.id !== ministerioResponsavel?.id;

      function checar(pessoaId, ehAprendiz) {
        if (!pessoaId) return null;
        // pode ser um voto da enquete ou um compromisso na outra base
        // (mesclarIndisponibilidades funde os dois) — a mensagem cobre
        // ambos sem distinguir a origem
        if (indisponivel(pessoaId, d.id)) return { nivel: "erro", motivo: "indisponível nesse dia" };
        // "só posso servir 1x este mês" (ver construirLimitesMes) — um
        // teto que a própria pessoa deu, tão duro quanto indisponível.
        // `>` estrito: exatamente no limite (ex.: 1 vez, disse 1x) está
        // certo, só passar do que disse é que é erro.
        const limite = limitesMes[pessoaId];
        if (limite != null && (contagemMes[pessoaId] ?? 0) > limite) {
          return { nivel: "erro", motivo: `só disse poder servir ${limite}× este mês, já está em ${contagemMes[pessoaId]}` };
        }
        if (operacional) {
          let vezesNoDomingo = 0;
          ministerios.forEach((m2) => {
            if (m2.id === ministerioResponsavel?.id) return;
            const r2 = resultado[chaveSlot(d.id, m2.id)];
            if (r2?.titularId === pessoaId || r2?.aprendizId === pessoaId) vezesNoDomingo++;
          });
          if (vezesNoDomingo > 1) return { nivel: "erro", motivo: "já está escalado noutro ministério nesse domingo" };
        }
        // sobrecarga vem antes de "não respondeu" — as duas são só
        // atenção, mas sobrecarga é a mais acionável das duas e não
        // pode ficar escondida atrás da outra quando as duas se aplicam
        if (ehAprendiz) {
          if ((aprendizMes[pessoaId] ?? 0) > RECOMENDADO_MES) {
            return { nivel: "atencao", motivo: `já treina ${aprendizMes[pessoaId]}× este mês (recomendado ${RECOMENDADO_MES})` };
          }
        } else if ((contagemMes[pessoaId] ?? 0) > RECOMENDADO_MES) {
          return { nivel: "atencao", motivo: `escalado ${contagemMes[pessoaId]}× este mês (recomendado ${RECOMENDADO_MES})` };
        }
        if (!respondentes.has(pessoaId)) return { nivel: "atencao", motivo: "não respondeu à enquete" };
        return null;
      }

      avisos[chave] = { titular: checar(r.titularId, false), aprendiz: checar(r.aprendizId, true) };
    });
  });

  return avisos;
}

