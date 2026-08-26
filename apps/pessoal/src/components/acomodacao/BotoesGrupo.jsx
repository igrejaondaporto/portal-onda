export default function BotoesGrupo({ n, onPedir, onConfirmar, onCancelar }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", opacity: 0.6, marginBottom: 10 }}>
        Chegou grupo de
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5, 6].map((g) => (
          <button
            key={g}
            className="btn sec"
            style={{ width: 52, height: 52, padding: 0, fontSize: 19, fontWeight: 700, ...(n === g ? { background: "var(--lima, #C8F02E)" } : {}) }}
            onClick={() => onPedir(g)}
          >
            {g}
          </button>
        ))}
        {n != null && (
          <>
            <button className="btn" style={{ height: 52 }} onClick={onConfirmar}>Confirmar</button>
            <button className="btn sec" style={{ height: 52 }} onClick={onCancelar}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
