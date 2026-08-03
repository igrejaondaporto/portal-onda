export default function TecladoNumerico({ desativado, podeApagar, onTecla, onApagar }) {
  return (
    <div className="tec">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} className="k" disabled={desativado} onClick={() => onTecla(String(n))}>
          {n}
        </button>
      ))}
      <span />
      <button className="k" disabled={desativado} onClick={() => onTecla("0")}>
        0
      </button>
      <button className="k g" disabled={desativado || !podeApagar} onClick={onApagar}>
        Apagar
      </button>
    </div>
  );
}
