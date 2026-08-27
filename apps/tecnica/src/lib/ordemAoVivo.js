/**
 * Cálculos puros para cruzar o previsto (eventos/{e}.ordem.momentos, do
 * PDF) com o real (eventos/{e}/cultoAoVivo/registo.secoesReais, do
 * FreeShow) — sem Firebase, para dar para testar isolado. Ver
 * functions/freeshow.js (o mesmo normalizarNome do lado das Functions)
 * e o plano da funcionalidade para o desenho completo.
 */
export function normalizarNome(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

const paraMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};
const paraHora = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Para cada momento previsto, encontra a primeira secção real com o
 *  mesmo nome correspondente (é a vez que entrou ao ar) — e devolve
 *  também as secções reais que nunca corresponderam a nenhum momento
 *  previsto (mostrar mesmo assim, regra 6.5: "melhor mostrar algo
 *  desconhecido do que esconder o que está a acontecer"). */
export function cruzarComReal(momentos, secoesReais = []) {
  const chavesMomentos = new Set(momentos.map((m) => normalizarNome(m.momento)));
  const porNome = new Map();
  for (const s of secoesReais) {
    const chave = normalizarNome(s.nomeCorrespondente || s.nomeFreeshow);
    if (!porNome.has(chave)) porNome.set(chave, s); // primeira ocorrência = quando entrou ao ar
  }
  const linhas = momentos.map((m) => ({ ...m, real: porNome.get(normalizarNome(m.momento)) || null }));
  const extras = [...porNome.entries()].filter(([chave]) => !chavesMomentos.has(chave)).map(([, s]) => s);
  return { linhas, extras };
}

/** Previsão em cascata: o horário de cada momento futuro (sem hora real
 *  ainda) = hora real da última secção conhecida + soma das durações
 *  previstas das secções entre elas. O atraso propaga-se para a frente
 *  até à próxima secção que já tiver hora real. */
export function calcularPrevisoes(linhas) {
  let baseMin = null;
  let acumulado = 0;
  return linhas.map((l) => {
    if (l.real) {
      baseMin = paraMinutos(l.real.horaReal);
      acumulado = Number(l.minutos) || 0;
      return { ...l, horaPrevista: null };
    }
    if (baseMin == null) return { ...l, horaPrevista: l.hora };
    const horaPrevista = paraHora(baseMin + acumulado);
    acumulado += Number(l.minutos) || 0;
    return { ...l, horaPrevista };
  });
}

/** Uma linha ficou "pulada" quando o culto já passou por ela sem
 *  nunca a ter posto no ar — sabe-se isso quando uma linha MAIS À
 *  FRENTE já tem hora real (regra 5.4: nunca adivinha, só reflete o
 *  que aconteceu de verdade). */
export function marcarPuladas(linhas) {
  return linhas.map((l, i) => ({
    ...l,
    pulada: !l.real && linhas.slice(i + 1).some((depois) => depois.real),
  }));
}
