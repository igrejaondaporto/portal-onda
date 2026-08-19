/**
 * Escala sugerida — só IFs, sem IA (briefing §6.8). Preenche lugares
 * vazios, nunca sobrescreve o que o líder já escolheu à mão.
 *
 * Diferente do sugestor da Técnica: esta base não tem enquete de
 * indisponibilidade (ver CLAUDE.md desta base), por isso não há
 * "quem está de fora este domingo" para filtrar — a sugestão usa só
 * quem serviu há mais tempo nesse ministério, sem repetir pessoa no
 * mesmo culto. O líder confirma ou troca antes de guardar, sempre.
 */

/** Candidatos de um nível (titular/aprendiz) num ministério, ordenados
 *  por quem está há mais tempo sem servir (nunca serviu vem primeiro). */
function candidatosOrdenados(voluntarios, ministerioId, nivel, estatisticas) {
  return voluntarios
    .filter((p) => p.ministerios?.[ministerioId] === nivel)
    .map((p) => ({ pessoa: p, ultima: estatisticas[p.id]?.ultima ?? null, vezes: estatisticas[p.id]?.vezes ?? 0 }))
    .sort((a, b) => {
      if (!a.ultima && b.ultima) return -1;
      if (a.ultima && !b.ultima) return 1;
      if (a.ultima !== b.ultima) return (a.ultima ?? "").localeCompare(b.ultima ?? "");
      return a.vezes - b.vezes;
    })
    .map((c) => c.pessoa);
}

/** `lugaresAtuais`: [{ministerioId, titularId, aprendizId}]. Devolve
 *  uma cópia com os vazios preenchidos — nunca troca quem já lá está. */
export function sugerirLugares(ministerios, voluntarios, estatisticas, lugaresAtuais) {
  const usados = new Set(lugaresAtuais.flatMap((l) => [l.titularId, l.aprendizId]).filter(Boolean));

  return ministerios.map((m) => {
    const atual = lugaresAtuais.find((l) => l.ministerioId === m.id) ?? { ministerioId: m.id, titularId: null, aprendizId: null };
    const novo = { ...atual };

    if (!novo.titularId) {
      const candidato = candidatosOrdenados(voluntarios, m.id, "titular", estatisticas).find((p) => !usados.has(p.id));
      if (candidato) { novo.titularId = candidato.id; usados.add(candidato.id); }
    }
    if (!novo.aprendizId && novo.titularId) {
      const candidato = candidatosOrdenados(voluntarios, m.id, "aprendiz", estatisticas).find((p) => !usados.has(p.id));
      if (candidato) { novo.aprendizId = candidato.id; usados.add(candidato.id); }
    }
    return novo;
  });
}
