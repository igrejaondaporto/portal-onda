import { useEffect, useState } from "react";
import { obterEventosDoMes } from "../../lib/painel";
import { obterCheckinsDe, hojeLocal } from "../../lib/kinder";
import { CATEGORIAS, nomeCategoria, varsCategoria } from "../../lib/modelo";
import { MESES, dataCurta } from "@portal/shared/lib/data.js";

/** Relatórios das líderes: presenças por culto e por sala, famílias
 *  novas, tempo médio na sala, e quem tem alergias/restrições/
 *  necessidades (para preparar lanches e atividades). */
export default function Relatorios({ criancas, familias, onFechar }) {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [linhas, setLinhas] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLinhas(null);
    (async () => {
      const hoje = hojeLocal();
      const eventos = (await obterEventosDoMes(ano, mes)).filter((e) => e.data <= hoje);
      const porEvento = await obterCheckinsDe(eventos.map((e) => e.id));
      if (cancelado) return;
      setLinhas(eventos.map((ev) => {
        const cs = (porEvento[ev.id] || []).filter((c) => !c.anulado);
        const durações = cs.filter((c) => c.saidaEm && c.entradaEm).map((c) => c.saidaEm.toMillis() - c.entradaEm.toMillis());
        const media = durações.length ? Math.round(durações.reduce((a, b) => a + b, 0) / durações.length / 60000) : null;
        const novas = familias.filter((f) => {
          const d = f.criadoEm?.toDate?.();
          return d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === ev.data;
        }).length;
        return {
          ev, total: cs.length, novas, media,
          porSala: Object.fromEntries(CATEGORIAS.map((c) => [c.id, cs.filter((k) => k.categoria === c.id).length])),
          semCodigo: cs.filter((c) => c.saidaForcada).length,
        };
      }));
    })();
    return () => { cancelado = true; };
  }, [ano, mes, familias]);

  function mudarMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a -= 1; } else if (m > 11) { m = 0; a += 1; }
    setMes(m); setAno(a);
  }

  const comCuidados = criancas.filter((c) => c.alergias || c.restricoesAlimentares || c.necessidades);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Relatórios</h2>
        <div className="cabecalho" style={{ marginTop: 10 }}>
          <h3>{MESES[mes]} {ano}</h3>
          <span className="calnav">
            <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
            <button className="calbt" onClick={() => mudarMes(1)}>›</button>
          </span>
        </div>
        {!linhas ? <div className="vaz">A contar…</div> : linhas.length === 0 ? <div className="vaz">Sem cultos já passados neste mês.</div> : (
          <div className="tabwrap">
            <table className="tab">
              <thead>
                <tr>
                  <th>Culto</th>
                  {CATEGORIAS.map((c) => <th key={c.id}>{c.nome}</th>)}
                  <th>Total</th><th>Novas</th><th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.ev.id}>
                    <td className="papel">{dataCurta(l.ev.data)}</td>
                    {CATEGORIAS.map((c) => <td key={c.id}>{l.porSala[c.id]}</td>)}
                    <td><b>{l.total}</b></td>
                    <td>{l.novas}</td>
                    <td>{l.media != null ? `${l.media} min` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {linhas?.some((l) => l.semCodigo) && (
          <p className="ds" style={{ marginTop: 8 }}>Saídas sem código este mês: {linhas.reduce((a, l) => a + l.semCodigo, 0)} (o motivo fica no check-in de cada domingo).</p>
        )}

        <p className="rot" style={{ marginTop: 18 }}>Alergias, restrições e necessidades · {comCuidados.length}</p>
        {comCuidados.length === 0 && <p className="ds">Nenhuma criança com cuidados registados.</p>}
        {comCuidados.sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nome.localeCompare(b.nome, "pt")).map((c) => (
          <div className="linha" key={c.id}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{c.nome}</p>
              {c.alergias && <span className="kin-alerta">Alergias: {c.alergias}</span>}
              {c.restricoesAlimentares && <span className="kin-alerta info">{c.restricoesAlimentares}</span>}
              {c.necessidades && <span className="kin-alerta info">{c.necessidades}</span>}
            </div>
            {c.categoria && <span className="kin-tagcat" style={varsCategoria(c.categoria)}>{nomeCategoria(c.categoria)}</span>}
          </div>
        ))}
        <p className="ds" style={{ marginTop: 12 }}>{familias.length} famílias registadas · {criancas.length} crianças.</p>
        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
