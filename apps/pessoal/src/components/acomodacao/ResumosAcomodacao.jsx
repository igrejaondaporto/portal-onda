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
 * Mesmo esquema de cartão do Formulário/Contagem: filtro por mês,
 * cartão fechado que expande ao tocar. "Editar" (lápis) reabre o
 * culto (Cloud Function reabrirAcomodacao) — apaga este resumo e
 * devolve o mapa a "aberto", para corrigir e fechar de novo.
 * "Excluir" (✕) só tira da lista (arquivarResumoAcomodacao, marca
 * `arquivado:true`) sem mexer no mapa, que continua fechado — para
 * descartar um teste sem reabrir o culto para edição. Nenhum dos
 * dois é um delete a sério (nunca se apaga o mapa ao vivo). Só a
 * líder vê os ícones; quem tinha a função Mapa nesse culto também
 * tem permissão no servidor, mas a UI não sabe, sem mais uma leitura
 * por linha, quem teve Mapa em cada culto passado.
 */
export default function ResumosAcomodacao({ souLiderBase }) {
  const torrada = useTorrada();
  const [resumos, setResumos] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [abertoId, setAbertoId] = useState(null);
  const [aAgir, setAAgir] = useState(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    const q = query(cResumosAcomodacao(), orderBy("eventoId", "desc"));
    return onSnapshot(q, (snap) => setResumos(snap.docs.map((d) => d.data()).filter((r) => !r.arquivado)));
  }, []);

  const meses = useMemo(() => {
    const vistos = new Set((resumos ?? []).map((r) => r.eventoId.slice(0, 7)));
    vistos.add(mes); // o mês atual aparece sempre, mesmo sem cultos fechados ainda
    return [...vistos].sort().reverse();
  }, [resumos, mes]);

  const doMes = (resumos ?? []).filter((r) => r.eventoId.startsWith(mes));

  async function editar(eventoId) {
    setAAgir(eventoId);
    try {
      await chamar("reabrirAcomodacao")({ eventoId });
      torrada("Culto reaberto — o mapa volta a aceitar marcações");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir.");
    } finally {
      setAAgir(null);
    }
  }

  async function excluir(eventoId) {
    setAAgir(eventoId);
    try {
      await chamar("arquivarResumoAcomodacao")({ eventoId });
      setConfirmarExcluir(null);
      torrada("Excluído da lista");
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
    } finally {
      setAAgir(null);
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
          {doMes.length ? doMes.map((r) => {
            const expandido = abertoId === r.eventoId;
            return (
              <div className="caixa" key={r.eventoId} style={{ marginTop: 10 }}>
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
                  onClick={() => setAbertoId(expandido ? null : r.eventoId)}
                >
                  <span
                    aria-hidden="true"
                    style={{ flex: "none", marginTop: 3, transition: "transform .18s", transform: expandido ? "rotate(90deg)" : "none", color: "var(--cinza)" }}
                  >
                    ›
                  </span>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{dataPorExtenso(r.eventoId)}</p>
                    <p className="ds">
                      {r.ocupados} ocupados · {r.visitantes} visitantes · {Math.round((r.percentagem ?? 0) * 100)}% de lotação
                    </p>
                  </div>
                  {souLiderBase && (
                    <>
                      <button
                        className="oc-icobt" aria-label="Editar culto" title="Editar"
                        disabled={aAgir === r.eventoId}
                        onClick={(e) => { e.stopPropagation(); editar(r.eventoId); }}
                      >
                        ✎
                      </button>
                      <button
                        className="oc-icobt mag" aria-label="Excluir culto" title="Excluir"
                        disabled={aAgir === r.eventoId}
                        onClick={(e) => { e.stopPropagation(); setConfirmarExcluir(r.eventoId); }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>

                {expandido && (
                  <div style={{ marginTop: 10, borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 10 }}>
                    {[
                      ["Ocupados", r.ocupados], ["Visitantes", r.visitantes], ["Livres", r.livres ?? "—"],
                      ["Reservados", r.reservados], ["Bloqueados", r.bloqueados], ["Lotação", `${Math.round((r.percentagem ?? 0) * 100)}%`],
                    ].map(([rotulo, valor]) => (
                      <div key={rotulo} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5 }}>
                        <span>{rotulo}</span>
                        <b style={{ color: "var(--tinta)" }}>{valor}</b>
                      </div>
                    ))}
                  </div>
                )}

                {confirmarExcluir === r.eventoId && (
                  <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir {dataPorExtenso(r.eventoId)}?</p>
                    <p className="ds" style={{ marginTop: 4 }}>
                      Sai desta lista — o mapa continua fechado, só de leitura. Não dá para desfazer.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                        disabled={aAgir === r.eventoId}
                        onClick={() => excluir(r.eventoId)}
                      >
                        {aAgir === r.eventoId ? "A excluir…" : "Excluir"}
                      </button>
                      <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={() => setConfirmarExcluir(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="ds">Nenhum culto fechado neste mês.</p>
          )}
          {doMes.length > 0 && (
            <p className="ds" style={{ marginTop: 10 }}>
              A lotação conta só sobre os lugares úteis (sem reservados nem bloqueados) — reservados e
              bloqueados contam como indisponíveis, tal como ocupados, nunca como livres.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
