import { CORES_LUGAR } from "../../lib/modelo";

const ROTULOS = { livre: "Livre", ocupado: "Ocupado", visitante: "Visitante", reservado: "Reservado", bloqueado: "Bloqueado" };

export default function PainelContadores({ lugaresEstado, corInvertida, onInverter }) {
  const contagem = { livre: 0, ocupado: 0, visitante: 0, reservado: 0, bloqueado: 0 };
  Object.values(lugaresEstado).forEach((s) => { if (contagem[s] != null) contagem[s]++; });
  const ocupados = contagem.ocupado + contagem.visitante;
  const capacidadeUtil = Object.keys(lugaresEstado).length - contagem.reservado - contagem.bloqueado;
  const pct = capacidadeUtil ? Math.round((ocupados / capacidadeUtil) * 100) : 0;
  const corBarra = pct >= 95 ? "#FF6B5A" : pct >= 80 ? "#F5C518" : "#C8F02E";
  const cores = corInvertida ? { ...CORES_LUGAR, livre: CORES_LUGAR.ocupado, ocupado: CORES_LUGAR.livre } : CORES_LUGAR;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>
          {ocupados}<em style={{ fontStyle: "normal", fontSize: 14, fontWeight: 600, opacity: 0.6 }}> / {capacidadeUtil}</em>
        </span>
        <span className="ds">{pct}% cheio</span>
      </div>
      <div style={{ width: "100%", height: 4, borderRadius: 99, background: "rgba(0,0,0,.1)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: corBarra, transition: "width .3s,background .3s" }} />
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {Object.keys(ROTULOS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, background: "rgba(0,0,0,.05)", borderRadius: 10, padding: "6px 10px" }}>
            <i style={{ width: 13, height: 11, borderRadius: 3, display: "block", background: cores[k] }} />
            {ROTULOS[k]} <b style={{ opacity: 0.6 }}>{contagem[k]}</b>
          </div>
        ))}
        {onInverter && (
          <button className="btn sec" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5 }} onClick={onInverter}>
            ⇄ Inverter cores
          </button>
        )}
      </div>
    </div>
  );
}
