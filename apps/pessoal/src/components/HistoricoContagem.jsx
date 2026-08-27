import { useEffect, useMemo, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, MESES } from "@portal/shared/lib/data.js";
import { ouvirEventosDoMes } from "../lib/painel";
import { CATEGORIAS_CONTAGEM, limparContagem, ouvirContagem } from "../lib/contagem";
import ContagemCulto from "./ContagemCulto";

/** Os últimos 6 meses (o atual incluído) — mesmo padrão do filtro do Formulário. */
function ultimosMeses(hoje) {
  const lista = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({ valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, ano: d.getFullYear(), mesIndex: d.getMonth() });
  }
  return lista;
}

function horaDe(ts) {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nomeDe(uid, voluntarios) {
  return voluntarios.find((p) => p.id === uid)?.nome ?? null;
}

/**
 * Cultos já contados — só aparecem aqui depois de "Salvar contagem"
 * (campo `finalizadoEm`). Mesmo esquema do Formulário/Acomodação:
 * filtro por mês, cartão fechado por omissão que expande ao tocar,
 * editar (reabre o próprio ContagemCulto desse culto, os mesmos
 * campos com os mesmos botões ±) e excluir (repõe as nove categorias
 * a "por contar" — nunca um delete a sério, ver limparContagem).
 */
export default function HistoricoContagem({ uid, voluntarios }) {
  const torrada = useTorrada();
  const meses = useMemo(() => ultimosMeses(new Date()), []);
  const [mesFiltro, setMesFiltro] = useState(meses[0].valor);
  const [eventosMes, setEventosMes] = useState([]);
  const [contagens, setContagens] = useState({});
  const [abertoId, setAbertoId] = useState(null);
  const [eventoAEditar, setEventoAEditar] = useState(null);
  const [idAConfirmarExcluir, setIdAConfirmarExcluir] = useState(null);
  const [aExcluir, setAExcluir] = useState(false);

  useEffect(() => {
    const { ano, mesIndex } = meses.find((m) => m.valor === mesFiltro) ?? meses[0];
    return ouvirEventosDoMes(ano, mesIndex, setEventosMes);
  }, [mesFiltro, meses]);

  // ao vivo por evento (não uma leitura pontual) — para o cartão
  // aparecer aqui logo que "Salvar contagem" é tocado lá em cima, sem
  // precisar de trocar de mês para forçar uma releitura.
  useEffect(() => {
    setContagens({});
    const paragens = eventosMes.map((ev) => ouvirContagem(ev.id, (c) => {
      setContagens((estado) => ({ ...estado, [ev.id]: c }));
    }));
    return () => paragens.forEach((parar) => parar());
  }, [eventosMes]);

  const contados = eventosMes
    .filter((ev) => contagens[ev.id]?.finalizadoEm)
    .sort((a, b) => b.id.localeCompare(a.id));

  async function excluir(eventoId) {
    setAExcluir(true);
    try {
      await limparContagem(eventoId);
      setIdAConfirmarExcluir(null);
      torrada("Contagem excluída");
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
    } finally {
      setAExcluir(false);
    }
  }

  return (
    <div className="sect" style={{ marginTop: 16 }}>
      <div className="cabecalho">
        <h3>Cultos contados</h3>
        <span className="cap">{contados.length}</span>
      </div>

      <select
        className="campo" style={{ width: "auto", marginTop: 10 }}
        value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
      >
        {meses.map((m) => <option key={m.valor} value={m.valor}>{MESES[m.mesIndex]} {m.ano}</option>)}
      </select>

      {contados.length ? contados.map((ev) => {
        const c = contagens[ev.id];
        const aberto = abertoId === ev.id;
        const preenchidas = CATEGORIAS_CONTAGEM.filter((cat) => c.categorias?.[cat.id]?.valor != null).length;
        return (
          <div className="caixa" key={ev.id} style={{ marginTop: 10 }}>
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
              onClick={() => setAbertoId(aberto ? null : ev.id)}
            >
              <div style={{ flex: 1 }}>
                <p className="nmt">{dataPorExtenso(ev.id)}</p>
                <p className="ds">
                  {preenchidas}/9 preenchidas · guardada
                  {horaDe(c.finalizadoEm) ? ` às ${horaDe(c.finalizadoEm)}` : ""} por {nomeDe(c.finalizadoPor, voluntarios) ?? "alguém da equipa"}
                </p>
              </div>
              <button
                className="oc-icobt" aria-label="Editar contagem" title="Editar"
                onClick={(e) => { e.stopPropagation(); setEventoAEditar(ev.id); }}
              >
                ✎
              </button>
              <button
                className="oc-icobt mag" aria-label="Excluir contagem" title="Excluir"
                onClick={(e) => { e.stopPropagation(); setIdAConfirmarExcluir(ev.id); }}
              >
                ✕
              </button>
            </div>

            {aberto && (
              <div style={{ marginTop: 10, borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 10 }}>
                {CATEGORIAS_CONTAGEM.map((cat) => {
                  const registo = c.categorias?.[cat.id];
                  if (registo?.valor == null) return null;
                  const hora = horaDe(registo?.preenchidoEm);
                  return (
                    <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5 }}>
                      <span>{cat.nome}</span>
                      <span style={{ color: "var(--cinza)" }}>
                        {registo.valor}{hora ? ` · ${hora}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {idAConfirmarExcluir === ev.id && (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir a contagem de {dataPorExtenso(ev.id)}?</p>
                <p className="ds" style={{ marginTop: 4 }}>Volta as nove categorias a "por contar" — não dá para desfazer.</p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aExcluir} onClick={() => excluir(ev.id)}>
                    {aExcluir ? "A excluir…" : "Excluir"}
                  </button>
                  <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aExcluir} onClick={() => setIdAConfirmarExcluir(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }) : (
        <div className="vaz" style={{ marginTop: 10 }}>Nenhum culto contado neste mês.</div>
      )}

      {eventoAEditar && (
        <>
          <div className="veu on" onClick={() => setEventoAEditar(null)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Editar contagem">
            <div className="pux" />
            <h2>Editar contagem</h2>
            <p className="sb2">{dataPorExtenso(eventoAEditar)}</p>
            <ContagemCulto eventoId={eventoAEditar} uid={uid} voluntarios={voluntarios} />
            <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setEventoAEditar(null)}>Fechar</button>
          </div>
        </>
      )}
    </div>
  );
}
