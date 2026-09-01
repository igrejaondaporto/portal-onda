import { useEffect, useMemo, useState } from "react";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { ouvirRepertorio, guardarRepertorio, itemMusica, itemMomento } from "../lib/repertorio";
import { ouvirMusicas } from "../lib/biblioteca";
import { MESES, dataCurta, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetEscolherMusica from "../components/repertorio/SheetEscolherMusica";

function haQuanto(ts) {
  if (!ts?.toDate) return "agora mesmo";
  const min = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export default function Repertorio({ uid, mes, ano, mudarMes, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [musicas, setMusicas] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [repertorio, setRepertorio] = useState(null);
  const [aEscolherMusica, setAEscolherMusica] = useState(false);
  const [aNomearMomento, setANomearMomento] = useState(false);
  const [nomeMomento, setNomeMomento] = useState("");

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMusicas(setMusicas), []);

  useEffect(() => {
    if (eventoId || !eventosMes.length) return;
    const hoje = hojeISO();
    setEventoId((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventosMes]);

  useEffect(() => ouvirRepertorio(eventoId, setRepertorio), [eventoId]);

  const eventoAtual = eventosMes.find((e) => e.id === eventoId) ?? null;
  const itens = repertorio?.itens ?? [];
  const nMusicas = itens.filter((i) => i.tipo === "musica").length;
  const autor = repertorio?.atualizadoPor ? voluntarios.find((p) => p.id === repertorio.atualizadoPor)?.nome : null;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Repertório",
      subtitulo: eventoAtual ? dataPorExtenso(eventoAtual.data) : `${MESES[mes]} ${ano}`,
      chips: [`${nMusicas} ${nMusicas === 1 ? "música" : "músicas"}`, repertorio ? `Atualizado ${haQuanto(repertorio.atualizadoEm)}` : "Ainda não montado"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventoAtual?.id, mes, ano, nMusicas, repertorio?.atualizadoEm]);

  async function persistir(novosItens) {
    if (!eventoId) return;
    try {
      await guardarRepertorio(eventoId, novosItens, uid);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o repertório.");
    }
  }

  function mover(id, delta) {
    const i = itens.findIndex((it) => it.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= itens.length) return;
    const nova = [...itens];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    persistir(nova);
  }

  function remover(id) {
    persistir(itens.filter((it) => it.id !== id));
  }

  function adicionarMusica(musicaId, versaoId) {
    persistir([...itens, itemMusica(musicaId, versaoId)]);
    setAEscolherMusica(false);
  }

  function confirmarMomento() {
    const nome = nomeMomento.trim();
    if (!nome) return;
    persistir([...itens, itemMomento(nome)]);
    setNomeMomento("");
    setANomearMomento(false);
  }

  const musicaPorId = useMemo(() => Object.fromEntries(musicas.map((m) => [m.id, m])), [musicas]);

  return (
    <>
      <div className="cabecalho" style={{ paddingTop: 0 }}>
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => { setEventoId(null); mudarMes(-1); }}>‹</button>
          <button className="calbt" onClick={() => { setEventoId(null); mudarMes(1); }}>›</button>
        </span>
      </div>
      <div className="bib-chips">
        {eventosMes.map((ev) => (
          <button key={ev.id} className="bib-chip" data-on={eventoId === ev.id ? 1 : 0} onClick={() => setEventoId(ev.id)}>
            {dataCurta(ev.data)}
          </button>
        ))}
        {eventosMes.length === 0 && <span className="ds">Sem cultos neste mês.</span>}
      </div>

      {eventoAtual && (
        <p className="rep-selo">
          {repertorio ? `Atualizado ${haQuanto(repertorio.atualizadoEm)}${autor ? ` por ${autor}` : ""} · já visível para a projeção` : "Ainda ninguém montou este repertório — assim que guardares o primeiro item, fica visível."}
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {itens.map((item, i) => {
          if (item.tipo === "momento") {
            return (
              <div className="rep-item momento" key={item.id}>
                <span className="rep-alca">⠿</span>
                <div style={{ flex: 1 }}><p className="nmt">{item.nome}</p><p className="ds">Momento</p></div>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === 0} onClick={() => mover(item.id, -1)}>↑</button>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === itens.length - 1} onClick={() => mover(item.id, 1)}>↓</button>
                <button className="rep-remover" onClick={() => remover(item.id)}>✕</button>
              </div>
            );
          }
          const m = musicaPorId[item.musicaId];
          return (
            <div className="rep-item" key={item.id}>
              <span className="rep-alca">⠿</span>
              <div className="bib-capa" style={m?.capaUrl ? { backgroundImage: `url(${m.capaUrl})` } : {}}>
                {!m?.capaUrl && (m?.titulo?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">{m?.titulo ?? "Música removida"}</p>
                <p className="ds">{m?.artista ?? ""}</p>
              </div>
              <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === 0} onClick={() => mover(item.id, -1)}>↑</button>
              <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === itens.length - 1} onClick={() => mover(item.id, 1)}>↓</button>
              <button className="rep-remover" onClick={() => remover(item.id)}>✕</button>
            </div>
          );
        })}
        {itens.length === 0 && <div className="vaz">Ainda sem itens neste repertório.</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn full" style={{ flex: 1 }} disabled={!eventoId} onClick={() => setAEscolherMusica(true)}>
          + Música
        </button>
        <button className="btn sec full" style={{ flex: 1 }} disabled={!eventoId} onClick={() => setANomearMomento(true)}>
          + Momento
        </button>
      </div>

      {aNomearMomento && (
        <>
          <div className="veu on" onClick={() => setANomearMomento(false)} />
          <div className="pin on" role="dialog" aria-modal="true">
            <div className="pux" />
            <h2>Novo momento</h2>
            <label className="rot" style={{ marginTop: 12 }}>Nome</label>
            <input className="campo" value={nomeMomento} onChange={(e) => setNomeMomento(e.target.value)} placeholder="Ceia, Oferta, Testemunho…" autoFocus />
            <button className="btn full" style={{ marginTop: 18 }} onClick={confirmarMomento}>Adicionar</button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => { setANomearMomento(false); setNomeMomento(""); }}>Cancelar</button>
          </div>
        </>
      )}

      {aEscolherMusica && (
        <SheetEscolherMusica
          musicas={musicas}
          onFechar={() => setAEscolherMusica(false)}
          onEscolhida={adicionarMusica}
        />
      )}
    </>
  );
}
