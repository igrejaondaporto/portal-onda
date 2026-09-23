const NOTAS = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"];
// primeiro nome de cada opção ("C#/Db" → "C#") é o que se grava —
// mesmo formato de sempre nas versões, só a forma de escolher mudou.
const notaBase = (rotulo) => rotulo.split("/")[0];

/**
 * Grade de 12 notas (bemol/sustenido juntos, como o líder pediu) +
 * alternador "menor" — substitui o campo de tom livre. `valor` é a
 * string gravada na versão ("A", "F#m"…), continua o mesmo formato.
 */
export default function GradeTom({ valor, onEscolher }) {
  const menor = (valor || "").endsWith("m");
  const semMenor = menor ? valor.slice(0, -1) : valor || "";
  const selecionada = NOTAS.find((n) => notaBase(n) === semMenor) ?? null;

  function escolherNota(rotulo) {
    const base = notaBase(rotulo);
    onEscolher(menor ? `${base}m` : base);
  }

  function alternarMenor() {
    if (!semMenor) return;
    onEscolher(menor ? semMenor : `${semMenor}m`);
  }

  return (
    <div className="grade-tom-wrap">
      <div className="grade-tom">
        {NOTAS.map((n) => (
          <button
            key={n} type="button"
            data-on={selecionada === n ? 1 : 0}
            onClick={() => escolherNota(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        type="button" className="grade-tom-menor"
        data-on={menor ? 1 : 0} disabled={!semMenor}
        onClick={alternarMenor}
      >
        menor (m)
      </button>
    </div>
  );
}
