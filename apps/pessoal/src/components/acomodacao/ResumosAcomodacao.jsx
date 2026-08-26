import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { cResumosAcomodacao } from "../../lib/modelo";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

/**
 * Arquivo dos cultos já fechados — toda a base lê (não só a líder),
 * é o que vai alimentar o mapa de calor do painel do pastor mais
 * tarde. Fica fechado por omissão para não ocupar espaço no ecrã do
 * dia a dia.
 */
export default function ResumosAcomodacao() {
  const [resumos, setResumos] = useState(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const q = query(cResumosAcomodacao(), orderBy("eventoId", "desc"));
    return onSnapshot(q, (snap) => setResumos(snap.docs.map((d) => d.data())));
  }, []);

  if (!resumos) return null;

  return (
    <div className="sect">
      <div className="cabecalho" style={{ cursor: "pointer" }} onClick={() => setAberto((a) => !a)}>
        <h3>Cultos fechados</h3>
        <span className="cap">{resumos.length ? `${resumos.length} · ${aberto ? "ocultar" : "ver"}` : "nenhum ainda"}</span>
      </div>
      {aberto && (
        resumos.length ? (
          <div className="tbl-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--tinta-fraca, #6b7280)" }}>
                  <th style={{ padding: "6px 8px" }}>Culto</th>
                  <th style={{ padding: "6px 8px" }}>Ocupados</th>
                  <th style={{ padding: "6px 8px" }}>Visitantes</th>
                  <th style={{ padding: "6px 8px" }}>Lotação</th>
                </tr>
              </thead>
              <tbody>
                {resumos.map((r) => (
                  <tr key={r.eventoId} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                    <td style={{ padding: "6px 8px" }}>{dataPorExtenso(r.eventoId)}</td>
                    <td style={{ padding: "6px 8px" }}>{r.ocupados}</td>
                    <td style={{ padding: "6px 8px" }}>{r.visitantes}</td>
                    <td style={{ padding: "6px 8px" }}>{Math.round((r.percentagem ?? 0) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ds">Ainda nenhum culto foi fechado.</p>
        )
      )}
    </div>
  );
}
