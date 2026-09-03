import { useEffect, useState } from "react";
import { obterEventosDoMes } from "../../lib/painel";
import { obterEventosPorIds } from "../../lib/enquetes";
import { guardarRascunho, publicarRascunho } from "../../lib/rascunho";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { MESES, nomeEvento, dataPorExtenso } from "@portal/shared/lib/data.js";
import SheetEscala from "./SheetEscala";

/**
 * Editor de um rascunho — reaproveita a interação de SheetEscala.jsx
 * (tocar para escalar, estrela para líder de escala) através do prop
 * `aoMudar`: em vez de gravar direto na escala ao vivo, guarda no
 * estado local `itens`, só persistido a valer ao tocar "Guardar
 * rascunho". Publicar corre a validação completa (conflito entre
 * bases incluído) no servidor, um domingo de cada vez, e marca a
 * escala ao vivo de todos como publicada de uma só vez — nunca
 * parcial (decisão do líder, ver CLAUDE.md).
 */
export default function SheetRascunho({ rascunho, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [nome, setNome] = useState(rascunho?.nome || "");
  const [itens, setItens] = useState(() => (rascunho?.itens ? [...rascunho.itens] : []));
  const [eventosPorId, setEventosPorId] = useState({});
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [eventosMes, setEventosMes] = useState([]);
  const [aCarregarMes, setACarregarMes] = useState(false);
  const [eventoAEscalar, setEventoAEscalar] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aPublicar, setAPublicar] = useState(false);
  const [aConfirmarPublicar, setAConfirmarPublicar] = useState(false);

  // nomes/datas dos domingos já no rascunho (ao abrir para editar um
  // já existente, antes de sequer navegar até ao mês deles)
  useEffect(() => {
    const ids = itens.map((it) => it.eventoId);
    if (!ids.length) return;
    obterEventosPorIds(ids).then((mapa) => setEventosPorId((s) => ({ ...mapa, ...s })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setACarregarMes(true);
    obterEventosDoMes(ano, mes).then((evs) => { setEventosMes(evs); setACarregarMes(false); });
  }, [ano, mes]);

  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }

  function alternarNoRascunho(ev) {
    setEventosPorId((s) => ({ ...s, [ev.id]: ev }));
    setItens((atual) =>
      atual.some((it) => it.eventoId === ev.id)
        ? atual.filter((it) => it.eventoId !== ev.id)
        : [...atual, { eventoId: ev.id, liderEscala: null, escalados: [] }]
    );
  }

  function removerDoRascunho(id) {
    setItens((atual) => atual.filter((it) => it.eventoId !== id));
  }

  function aoMudarEscala(eventoId, escalados, liderEscala) {
    setItens((atual) => atual.map((it) => (it.eventoId === eventoId ? { ...it, escalados, liderEscala } : it)));
  }

  async function guardar(fechar = true) {
    if (!itens.length) { torrada("Escolhe pelo menos um domingo."); return null; }
    setAGuardar(true);
    try {
      const r = await guardarRascunho({ rascunhoId: rascunho?.id, nome, itens });
      if (fechar) onGuardado("Rascunho guardado");
      return r.rascunhoId;
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o rascunho.");
      return null;
    } finally {
      setAGuardar(false);
    }
  }

  async function publicar() {
    setAPublicar(true);
    try {
      const id = rascunho?.id || (await guardar(false));
      if (!id) return;
      const r = await publicarRascunho(id);
      onGuardado(`Escala publicada — ${r.domingos} domingo${r.domingos === 1 ? "" : "s"}`);
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
  }

  const ordenados = [...itens].sort((a, b) => a.eventoId.localeCompare(b.eventoId));
  const itemAEscalar = eventoAEscalar ? itens.find((it) => it.eventoId === eventoAEscalar) : null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{rascunho ? "Editar rascunho" : "Novo rascunho"}</h2>
        <p className="sb2">Monta a escala de vários domingos antes de publicar — os voluntários só veem depois de "Publicar".</p>

        <label className="rot">Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Escala de Outubro" />

        <label className="rot" style={{ marginTop: 14 }}>Domingos no rascunho ({ordenados.length})</label>
        {!ordenados.length && <div className="vaz">Nenhum ainda — escolhe abaixo.</div>}
        {ordenados.map((it) => {
          const ev = eventosPorId[it.eventoId];
          const n = it.escalados?.length || 0;
          return (
            <div className="linha" style={{ cursor: "pointer" }} key={it.eventoId} onClick={() => setEventoAEscalar(it.eventoId)}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{ev ? nomeEvento(ev) : dataPorExtenso(it.eventoId)}</p>
                <p className="ds">{n ? `${n} pessoa${n === 1 ? "" : "s"}` : "Ninguém escalado"}{it.liderEscala ? " · líder definido" : ""}</p>
              </div>
              <button className="btn sec" style={{ padding: "6px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); removerDoRascunho(it.eventoId); }}>
                Remover
              </button>
              <span className="seta">›</span>
            </div>
          );
        })}

        <div className="cabecalho" style={{ marginTop: 18 }}>
          <h3>Adicionar domingos de {MESES[mes]} {ano}</h3>
          <span className="calnav">
            <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
            <button className="calbt" onClick={() => mudarMes(1)}>›</button>
          </span>
        </div>
        {aCarregarMes && <div className="vaz">A carregar…</div>}
        {!aCarregarMes && !eventosMes.length && <div className="vaz">Sem cultos criados para este mês ainda.</div>}
        {!aCarregarMes && eventosMes.map((ev) => (
          <div className="linha" style={{ cursor: "pointer" }} key={ev.id} onClick={() => alternarNoRascunho(ev)}>
            <button className={`chk${itens.some((it) => it.eventoId === ev.id) ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternarNoRascunho(ev); }}>✓</button>
            <div style={{ flex: 1 }}>
              <p className="nmt">{nomeEvento(ev)}</p>
            </div>
          </div>
        ))}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || aPublicar} onClick={() => guardar(true)}>
          {aGuardar ? "A guardar…" : "Guardar rascunho"}
        </button>

        {!aConfirmarPublicar ? (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aGuardar || aPublicar || !ordenados.length} onClick={() => setAConfirmarPublicar(true)}>
            Publicar
          </button>
        ) : (
          <div className="caixa" style={{ background: "#EFF3FF", border: 0, marginTop: 9 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Publicar {ordenados.length} domingo{ordenados.length === 1 ? "" : "s"}?</p>
            <p className="ds" style={{ marginTop: 4 }}>
              Todos de uma vez — a escala fica visível para os voluntários em cada um desses domingos.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, fontSize: 12.5 }} disabled={aPublicar} onClick={publicar}>
                {aPublicar ? "A publicar…" : "Publicar tudo"}
              </button>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aPublicar} onClick={() => setAConfirmarPublicar(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>

      {itemAEscalar && (
        <SheetEscala
          evento={{
            id: eventoAEscalar,
            ...eventosPorId[eventoAEscalar],
            escopo: undefined,
            escala: { escalados: itemAEscalar.escalados || [], liderEscala: itemAEscalar.liderEscala || null },
          }}
          voluntarios={voluntarios}
          aoMudar={(escalados, liderEscala) => aoMudarEscala(eventoAEscalar, escalados, liderEscala)}
          onFechar={() => setEventoAEscalar(null)}
          onGuardado={() => setEventoAEscalar(null)}
        />
      )}
    </>
  );
}
