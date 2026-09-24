import { CORES_LUGAR, contarEstados } from "../../lib/modelo";

// chaves de `contarEstados`: "visitantes"/"apelo" já somam os
// visitantes que responderam ao apelo (`apeloVisitante`) nos dois
const ROTULOS = { livre: "Livre", ocupado: "Ocupado", visitantes: "Visitante", apelo: "Apelo", reservado: "Reservado", bloqueado: "Bloqueado" };
const COR_CHIP = { visitantes: "visitante" };

export default function PainelContadores({ lugaresEstado, corInvertida, onInverter }) {
  const contagem = contarEstados(lugaresEstado);
  const { ocupados, capacidadeUtil } = contagem;
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
        {Object.keys(ROTULOS).filter((k) => k !== "bloqueado" || contagem.bloqueado > 0).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, background: "rgba(0,0,0,.05)", borderRadius: 10, padding: "6px 10px" }}>
            <i style={{ width: 13, height: 11, borderRadius: 3, display: "block", background: cores[COR_CHIP[k] ?? k] }} />
            {ROTULOS[k]} <b style={{ opacity: 0.6 }}>{contagem[k]}</b>
          </div>
        ))}
        {onInverter && (
          <button className="btn sec" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5 }} onClick={onInverter}>
            ⇄ Inverter cores
          </button>
        )}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          ["1 toque", "ocupa ou liberta o lugar"],
          ["2 toques seguidos", "marca visitante"],
          ["Manter o dedo (½ seg.)", "marca apelo (outra vez desfaz)"],
          ["\"Reservar\" + toque", "marca ou desmarca reservado"],
        ].map(([gesto, acao]) => (
          <p key={gesto} className="ds" style={{ fontSize: 12 }}><b>{gesto}</b> — {acao}</p>
        ))}
      </div>
    </div>
  );
}
