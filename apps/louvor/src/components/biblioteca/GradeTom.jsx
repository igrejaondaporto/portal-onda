const NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Grade de 12 notas + alternador "menor" — substitui o campo de tom
 * livre (decisão do líder: toque em vez de digitar). `valor` é a
 * string gravada na versão ("A", "F#m"…), continua o mesmo formato
 * de sempre, só a forma de escolher mudou.
 */
export default function GradeTom({ valor, onEscolher }) {
  const menor = (valor || "").endsWith("m");
  const notaBase = menor ? valor.slice(0, -1) : valor || "";

  function escolherNota(nota) {
    onEscolher(menor ? `${nota}m` : nota);
  }

  function alternarMenor() {
    if (!notaBase) return;
    onEscolher(menor ? notaBase : `${notaBase}m`);
  }

  return (
    <div className="grade-tom-wrap">
      <div className="grade-tom">
        {NOTAS.map((n) => (
          <button
            key={n} type="button"
            data-on={notaBase === n ? 1 : 0}
            onClick={() => escolherNota(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        type="button" className="grade-tom-menor"
        data-on={menor ? 1 : 0} disabled={!notaBase}
        onClick={alternarMenor}
      >
        menor (m)
      </button>
    </div>
  );
}
