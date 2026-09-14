import { Fragment, useEffect, useState } from "react";
import { obterEventosDoMes } from "../../lib/painel";
import { obterCheckinsDe, hojeLocal, hora } from "../../lib/kinder";
import { CATEGORIAS, nomeCategoria, varsCategoria } from "../../lib/modelo";
import { MESES, dataCurta } from "@portal/shared/lib/data.js";

/** Relatórios: presenças por culto (de outros domingos, não só o de
 *  hoje) e por sala, famílias novas, tempo médio na sala, e quem tem
 *  alergias/restrições/necessidades (para preparar lanches e
 *  atividades). Qualquer líder abre — uma líder de sala (`restrita`)
 *  só vê a própria sala em tudo aqui, mesmo isolamento do resto do
 *  Check-in; só a líder geral vê as três. Cada culto abre (toca na
 *  linha) para a lista de registos — quem entrou, a que horas, quem
 *  levantou, se saiu sem código e com que motivo, e os check-ins
 *  anulados — nunca só os números agregados. */
export default function Relatorios({ criancas, familias, restrita, onFechar }) {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [linhas, setLinhas] = useState(null);
  const [abertos, setAbertos] = useState({});
  const categoriasVisiveis = restrita ? CATEGORIAS.filter((c) => c.id === restrita) : CATEGORIAS;
  const criancasVisiveis = restrita ? criancas.filter((c) => c.categoria === restrita) : criancas;
  const idsFamiliasVisiveis = new Set(criancasVisiveis.map((c) => c.familiaId));
  const familiasVisiveis = restrita ? familias.filter((f) => idsFamiliasVisiveis.has(f.id)) : familias;

  useEffect(() => {
    let cancelado = false;
    setLinhas(null);
    setAbertos({});
    (async () => {
      const hoje = hojeLocal();
      const eventos = (await obterEventosDoMes(ano, mes)).filter((e) => e.data <= hoje);
      const porEvento = await obterCheckinsDe(eventos.map((e) => e.id));
      if (cancelado) return;
      setLinhas(eventos.map((ev) => {
        const todos = (porEvento[ev.id] || []).filter((c) => !restrita || c.categoria === restrita);
        const cs = todos.filter((c) => !c.anulado);
        const durações = cs.filter((c) => c.saidaEm && c.entradaEm).map((c) => c.saidaEm.toMillis() - c.entradaEm.toMillis());
        const media = durações.length ? Math.round(durações.reduce((a, b) => a + b, 0) / durações.length / 60000) : null;
        const novas = familiasVisiveis.filter((f) => {
          const d = f.criadoEm?.toDate?.();
          return d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === ev.data;
        }).length;
        return {
          ev, total: cs.length, novas, media,
          porSala: Object.fromEntries(categoriasVisiveis.map((c) => [c.id, cs.filter((k) => k.categoria === c.id).length])),
          semCodigo: cs.filter((c) => c.saidaForcada).length,
          // todos os registos do culto, entrada por entrada — inclui os
          // anulados (marcados), para nunca esconder o que aconteceu.
          registos: [...todos].sort((a, b) => (a.entradaEm?.toMillis() ?? 0) - (b.entradaEm?.toMillis() ?? 0)),
        };
      }));
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, restrita, familiasVisiveis.length]);

  function mudarMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a -= 1; } else if (m > 11) { m = 0; a += 1; }
    setMes(m); setAno(a);
  }

  const comCuidados = criancasVisiveis.filter((c) => c.alergias || c.restricoesAlimentares || c.necessidades);

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
                  {categoriasVisiveis.map((c) => <th key={c.id}>{c.nome}</th>)}
                  <th>Total</th><th>Novas</th><th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Fragment key={l.ev.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setAbertos((a) => ({ ...a, [l.ev.id]: !a[l.ev.id] }))}>
                      <td className="papel">{dataCurta(l.ev.data)} {abertos[l.ev.id] ? "▾" : "▸"}</td>
                      {categoriasVisiveis.map((c) => <td key={c.id}>{l.porSala[c.id]}</td>)}
                      <td><b>{l.total}</b></td>
                      <td>{l.novas}</td>
                      <td>{l.media != null ? `${l.media} min` : "—"}</td>
                    </tr>
                    {abertos[l.ev.id] && (
                      <tr>
                        <td colSpan={categoriasVisiveis.length + 4} style={{ padding: "8px 0" }}>
                          {l.registos.length === 0 ? <div className="vaz">Sem check-ins neste culto.</div> : l.registos.map((r) => (
                            <div className="linha" key={r.criancaId}>
                              <div style={{ flex: 1 }}>
                                <p className="nmt">{r.nome}{r.anulado ? " · anulado" : ""}</p>
                                <p className="ds">
                                  Entrou às {hora(r.entradaEm)}
                                  {r.saidaEm ? ` · saiu às ${hora(r.saidaEm)} com ${r.levantadoPor}` : r.anulado ? "" : " · ainda na sala"}
                                  {r.saidaForcada ? ` · sem código: ${r.saidaForcada.motivo}` : ""}
                                </p>
                              </div>
                              {!restrita && r.categoria && <span className="kin-tagcat" style={varsCategoria(r.categoria)}>{nomeCategoria(r.categoria)}</span>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
        <p className="ds" style={{ marginTop: 12 }}>{familiasVisiveis.length} famílias registadas · {criancasVisiveis.length} crianças.</p>
        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
