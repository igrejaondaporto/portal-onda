/**
 * Escala sugerida — só IFs, sem IA (briefing §6.8). Preenche lugares
 * vazios, nunca sobrescreve o que o líder já escolheu à mão.
 *
 * Usa a enquete de indisponibilidade do mês do culto (ver
 * lib/enquetes.js) para nunca sugerir quem marcou que não pode
 * naquele domingo — mesma restrição do sugestor da Técnica, só que
 * sem o resto da complexidade dela (lugares travados, alertas de
 * sobrecarga, texto para WhatsApp): a Comunicação não precisa disso
 * ainda, e meter agora só sem necessidade real é o tipo de coisa que
 * fica por testar. Se um dia fizer falta, entra aí.
 */

/** Candidatos de um nível (titular/aprendiz) num ministério,
 *  descartando quem está indisponível nesse culto, ordenados por
 *  quem está há mais tempo sem servir (nunca serviu vem primeiro). */
function candidatosOrdenados(voluntarios, ministerioId, nivel, estatisticas, indisponiveis) {
  return voluntarios
    .filter((p) => p.ministerios?.[ministerioId] === nivel && !indisponiveis.has(p.id))
    .map((p) => ({ pessoa: p, ultima: estatisticas[p.id]?.ultima ?? null, vezes: estatisticas[p.id]?.vezes ?? 0 }))
    .sort((a, b) => {
      if (!a.ultima && b.ultima) return -1;
      if (a.ultima && !b.ultima) return 1;
      if (a.ultima !== b.ultima) return (a.ultima ?? "").localeCompare(b.ultima ?? "");
      return a.vezes - b.vezes;
    })
    .map((c) => c.pessoa);
}

/** A partir das respostas de uma enquete de indisponibilidade (ver
 *  obterRespostas em lib/enquetes.js) e do id do culto, quem marcou
 *  que não pode nesse domingo. Sem enquete aberta para o mês (ou sem
 *  domingo marcado), o conjunto fica vazio — a sugestão degrada para
 *  "sem restrição de indisponibilidade", nunca trava por falta dela. */
export function indisponiveisNoCulto(respostas, eventoId) {
  return new Set(
    (respostas || [])
      .filter((r) => (r.indisponivelEm || []).includes(eventoId))
      .map((r) => r.id)
  );
}

/** `lugaresAtuais`: [{ministerioId, titularId, aprendizId}]. Devolve
 *  uma cópia com os vazios preenchidos — nunca troca quem já lá está.
 *  `indisponiveis`: Set de pessoaIds (ver indisponiveisNoCulto). */
export function sugerirLugares(ministerios, voluntarios, estatisticas, lugaresAtuais, indisponiveis = new Set()) {
  const usados = new Set(lugaresAtuais.flatMap((l) => [l.titularId, l.aprendizId]).filter(Boolean));

  return ministerios.map((m) => {
    const atual = lugaresAtuais.find((l) => l.ministerioId === m.id) ?? { ministerioId: m.id, titularId: null, aprendizId: null };
    const novo = { ...atual };

    if (!novo.titularId) {
      const candidato = candidatosOrdenados(voluntarios, m.id, "titular", estatisticas, indisponiveis).find((p) => !usados.has(p.id));
      if (candidato) { novo.titularId = candidato.id; usados.add(candidato.id); }
    }
    if (!novo.aprendizId && novo.titularId) {
      const candidato = candidatosOrdenados(voluntarios, m.id, "aprendiz", estatisticas, indisponiveis).find((p) => !usados.has(p.id));
      if (candidato) { novo.aprendizId = candidato.id; usados.add(candidato.id); }
    }
    return novo;
  });
}
