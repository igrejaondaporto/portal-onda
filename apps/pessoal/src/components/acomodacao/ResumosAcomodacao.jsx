import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { cResumosAcomodacao } from "../../lib/modelo";
import { dataPorExtenso, MESES } from "@portal/shared/lib/data.js";

const SETA = '<path d="M6 9l6 6 6-6"/>';

/**
 * Arquivo dos cultos já fechados — toda a base lê (não só a líder),
 * é o que vai alimentar o mapa de calor do painel do pastor mais
 * tarde. Fica fechado por omissão para não ocupar espaço no ecrã do
 * dia a dia; a caixa e a seta deixam claro que dá para abrir.
 */
export default function ResumosAcomodacao() {
  const [resumos, setResumos] = useState(null);
  const [aberto, setAberto] = useState(false);
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    const q = query(cResumosAcomodacao(), orderBy("eventoId", "desc"));
    return onSnapshot(q, (snap) => setResumos(snap.docs.map((d) => d.data())));
  }, []);

  const meses = useMemo(() => {
    const vistos = new Set((resumos ?? []).map((r) => r.eventoId.slice(0, 7)));
    vistos.add(mes); // o mês atual aparece sempre, mesmo sem cultos fechados ainda
    return [...vistos].sort().reverse();
  }, [resumos, mes]);

  const doMes = (resumos ?? []).filter((r) => r.eventoId.startsWith(mes));

  if (!resumos) return null;

  return (
    <div className="caixa" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setAberto((a) => !a)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
          background: "none", border: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit",
        }}
      >
        <div style={{ flex: 1 }}>
          <p className="nmt" style={{ margin: 0 }}>Cultos fechados</p>
          <p className="ds" style={{ margin: 0 }}>{resumos.length ? `${resumos.length} no total` : "Nenhum ainda"}</p>
        </div>
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: "none", transition: "transform .18s", transform: aberto ? "rotate(180deg)" : "none" }}
          dangerouslySetInnerHTML={{ __html: SETA }}
        />
      </button>
      {aberto && (
        <div style={{ padding: "0 16px 16px" }}>
          <select
            value={mes} onChange={(e) => setMes(e.target.value)}
            className="campo" style={{ marginBottom: 12, width: "auto", display: "inline-block" }}
          >
            {meses.map((m) => {
              const [ano, mm] = m.split("-");
              return <option key={m} value={m}>{MESES[Number(mm) - 1]} {ano}</option>;
            })}
          </select>
          {doMes.length ? (
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
                  {doMes.map((r) => (
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
            <p className="ds">Nenhum culto fechado neste mês.</p>
          )}
        </div>
      )}
    </div>
  );
}
