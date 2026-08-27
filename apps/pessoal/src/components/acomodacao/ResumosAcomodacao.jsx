import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { cResumosAcomodacao } from "../../lib/modelo";
import { dataPorExtenso, MESES } from "@portal/shared/lib/data.js";

const SETA = '<path d="M6 9l6 6 6-6"/>';

/**
 * Arquivo dos cultos já fechados — toda a base lê (não só a líder),
 * é o que vai alimentar o mapa de calor do painel do pastor mais
 * tarde. Fica fechado por omissão para não ocupar espaço no ecrã do
 * dia a dia; a caixa e a seta deixam claro que dá para abrir.
 *
 * O "X" reabre um culto fechado (Cloud Function reabrirAcomodacao):
 * apaga este resumo e devolve o mapa a "aberto", para corrigir e
 * fechar de novo — nunca um delete a sério (o mapa ao vivo não é
 * tocado, só o `fechado`). Só a líder vê o botão; quem tinha a
 * função Drive nesse culto também tem permissão no servidor, mas a
 * UI não sabe, sem mais uma leitura por linha, quem foi Drive de
 * cada culto passado.
 */
export default function ResumosAcomodacao({ souLiderBase }) {
  const torrada = useTorrada();
  const [resumos, setResumos] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [aReabrir, setAReabrir] = useState(null);
  const [confirmarReabrir, setConfirmarReabrir] = useState(null);
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

  async function reabrir(eventoId) {
    setAReabrir(eventoId);
    try {
      await chamar("reabrirAcomodacao")({ eventoId });
      setConfirmarReabrir(null);
      torrada("Culto reaberto — o mapa volta a aceitar marcações");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir.");
    } finally {
      setAReabrir(null);
    }
  }

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
            <>
              <div className="tbl-wrap" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--tinta-fraca, #6b7280)" }}>
                      <th style={{ padding: "6px 8px" }}>Culto</th>
                      <th style={{ padding: "6px 8px" }}>Ocupados</th>
                      <th style={{ padding: "6px 8px" }}>Visitantes</th>
                      <th style={{ padding: "6px 8px" }}>Livres</th>
                      <th style={{ padding: "6px 8px" }}>Reservados</th>
                      <th style={{ padding: "6px 8px" }}>Bloqueados</th>
                      <th style={{ padding: "6px 8px" }}>Lotação</th>
                      {souLiderBase && <th style={{ padding: "6px 8px" }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {doMes.map((r) => (
                      <tr key={r.eventoId} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                        <td style={{ padding: "6px 8px" }}>{dataPorExtenso(r.eventoId)}</td>
                        <td style={{ padding: "6px 8px" }}>{r.ocupados}</td>
                        <td style={{ padding: "6px 8px" }}>{r.visitantes}</td>
                        <td style={{ padding: "6px 8px" }}>{r.livres ?? "—"}</td>
                        <td style={{ padding: "6px 8px" }}>{r.reservados}</td>
                        <td style={{ padding: "6px 8px" }}>{r.bloqueados}</td>
                        <td style={{ padding: "6px 8px" }}>{Math.round((r.percentagem ?? 0) * 100)}%</td>
                        {souLiderBase && (
                          <td style={{ padding: "6px 8px" }}>
                            <button
                              className="oc-icobt mag" aria-label="Reabrir culto" title="Reabrir"
                              disabled={aReabrir === r.eventoId}
                              onClick={() => setConfirmarReabrir(r.eventoId)}
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ds" style={{ marginTop: 10 }}>
                A lotação conta só sobre os lugares úteis (sem reservados nem bloqueados) — reservados e
                bloqueados contam como indisponíveis, tal como ocupados, nunca como livres.
              </p>
              {confirmarReabrir && (
                <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Reabrir {dataPorExtenso(confirmarReabrir)}?</p>
                  <p className="ds" style={{ marginTop: 4 }}>
                    Sai da lista de fechados e o mapa desse culto volta a aceitar marcações — dá para corrigir e fechar de novo.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                      disabled={aReabrir === confirmarReabrir}
                      onClick={() => reabrir(confirmarReabrir)}
                    >
                      {aReabrir === confirmarReabrir ? "A reabrir…" : "Reabrir"}
                    </button>
                    <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={() => setConfirmarReabrir(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="ds">Nenhum culto fechado neste mês.</p>
          )}
        </div>
      )}
    </div>
  );
}
