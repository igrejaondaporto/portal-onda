import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataCurta } from "@portal/shared/lib/data.js";
import { souLider } from "../../lib/modelo";
import { ouvirVoluntarios } from "../../lib/painel";
import {
  ouvirCapacitacoes, ouvirCapacitacoesDe, marcarCapacitacao, estadoCapacitacao, hojeLocal,
  criarCapacitacao, guardarCapacitacao, desativarCapacitacao, obterCapacitacoesDeTodos,
} from "../../lib/kinder";

const ESTADO = {
  ok: { texto: "Feita", classe: "tag lim" },
  falta: { texto: "Por fazer", classe: "tag" },
  caducada: { texto: "Por renovar", classe: "tag" },
};

/**
 * As formações do Kinder (as da Kiwify, "Capacitações") e o
 * certificado de registo criminal — obrigatório em Portugal para quem
 * trabalha com menores, e com validade. Cada um marca as suas; a
 * líder vê quem falta na equipa.
 */
export default function Capacitacoes({ uid, papel }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const [caps, setCaps] = useState([]);
  const [minhas, setMinhas] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [daEquipa, setDaEquipa] = useState(null);
  const [aEditar, setAEditar] = useState(null); // { cap } — null = nova

  useEffect(() => ouvirCapacitacoes(setCaps), []);
  useEffect(() => ouvirCapacitacoesDe(uid, setMinhas), [uid]);
  useEffect(() => { if (lider) return ouvirVoluntarios(setVoluntarios); }, [lider]);

  async function verEquipa() {
    if (daEquipa) { setDaEquipa(null); return; }
    try {
      setDaEquipa(await obterCapacitacoesDeTodos(voluntarios));
    } catch (e) {
      torrada(e.message || "Não foi possível carregar.", true);
    }
  }

  function alternarFeita(cap) {
    const feita = !!minhas[cap.id]?.feitaEm;
    marcarCapacitacao(uid, cap.id, { feitaEm: feita ? null : hojeLocal() })
      .catch((e) => torrada(e.message || "Não foi possível guardar.", true));
  }

  function guardarValidade(cap, validaAte) {
    marcarCapacitacao(uid, cap.id, { feitaEm: minhas[cap.id]?.feitaEm || hojeLocal(), validaAte: validaAte || null })
      .catch((e) => torrada(e.message || "Não foi possível guardar.", true));
  }

  return (
    <>
      <div className="sect">
        <div className="cabecalho"><h3>As tuas</h3></div>
        {caps.length === 0 && <div className="vaz">Ainda não há capacitações.</div>}
        {caps.map((c) => {
          const estado = estadoCapacitacao(c, minhas[c.id]);
          const feita = minhas[c.id];
          return (
            <div className="caixa" key={c.id} style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p className="nmt" style={{ flex: 1 }}>{c.titulo}</p>
                <span className={ESTADO[estado].classe}>{ESTADO[estado].texto}</span>
              </div>
              {c.descricao && <p className="ds" style={{ marginTop: 4 }}>{c.descricao}</p>}
              <p className="ds" style={{ marginTop: 4 }}>
                {c.obrigatoria ? "Obrigatória" : "Recomendada"}
                {feita?.feitaEm ? ` · feita a ${dataCurta(feita.feitaEm)}` : ""}
              </p>
              {c.temValidade && (
                <>
                  <label className="rot">Válido até</label>
                  <input className="campo" type="date" defaultValue={feita?.validaAte ?? ""} onBlur={(e) => guardarValidade(c, e.target.value)} />
                </>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {c.url && <a className="btn sec" style={{ flex: 1, textAlign: "center" }} href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
                <button className={`btn${feita?.feitaEm ? " sec" : ""}`} style={{ flex: 1 }} onClick={() => alternarFeita(c)}>
                  {feita?.feitaEm ? "Desmarcar" : c.temValidade ? "Já entreguei" : "Já fiz"}
                </button>
              </div>
              {lider && <button className="btn sec full" style={{ marginTop: 8, padding: "7px", fontSize: 12.5 }} onClick={() => setAEditar({ cap: c })}>Editar</button>}
            </div>
          );
        })}
      </div>

      {lider && (
        <div className="sect">
          <div className="cabecalho">
            <h3>A equipa</h3>
            <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setAEditar({ cap: null })}>Nova</button>
          </div>
          <button className="btn sec full" onClick={verEquipa}>{daEquipa ? "Esconder" : "Ver quem falta"}</button>
          {daEquipa && caps.map((c) => {
            const emFalta = voluntarios.filter((p) => estadoCapacitacao(c, daEquipa[p.id]?.[c.id]) !== "ok");
            return (
              <div className="linha" key={c.id}>
                <div style={{ flex: 1 }}>
                  <p className="nmt" style={{ fontSize: 14.5 }}>{c.titulo}</p>
                  <p className="ds">{emFalta.length ? `Faltam: ${emFalta.map((p) => p.nome).join(", ")}` : "Toda a equipa em dia"}</p>
                </div>
                <span className="tag cinz">{voluntarios.length - emFalta.length}/{voluntarios.length}</span>
              </div>
            );
          })}
        </div>
      )}

      {aEditar && <SheetCapacitacao cap={aEditar.cap} onFechar={() => setAEditar(null)} onGuardado={(m) => { setAEditar(null); torrada(m); }} />}
    </>
  );
}

function SheetCapacitacao({ cap, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [titulo, setTitulo] = useState(cap?.titulo ?? "");
  const [url, setUrl] = useState(cap?.url ?? "");
  const [descricao, setDescricao] = useState(cap?.descricao ?? "");
  const [obrigatoria, setObrigatoria] = useState(cap?.obrigatoria ?? true);
  const [temValidade, setTemValidade] = useState(cap?.temValidade ?? false);

  async function guardar() {
    if (!titulo.trim()) return torrada("Falta o título.");
    const d = { titulo: titulo.trim(), url: url.trim() || null, descricao: descricao.trim(), obrigatoria, temValidade };
    try {
      if (cap) await guardarCapacitacao(cap.id, d); else await criarCapacitacao(d);
      onGuardado(cap ? "Capacitação atualizada" : "Capacitação criada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.", true);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{cap ? "Editar capacitação" : "Nova capacitação"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Primeiros socorros" />
        <label className="rot">Link (Kiwify, opcional)</label>
        <input className="campo" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://members.kiwify.com/…" />
        <label className="rot">Descrição (opcional)</label>
        <textarea className="campo" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="subtabs" style={{ marginTop: 12 }}>
          <button data-on={obrigatoria ? 1 : 0} onClick={() => setObrigatoria(true)}>Obrigatória</button>
          <button data-on={!obrigatoria ? 1 : 0} onClick={() => setObrigatoria(false)}>Recomendada</button>
        </div>
        <div className="subtabs" style={{ marginTop: 8 }}>
          <button data-on={!temValidade ? 1 : 0} onClick={() => setTemValidade(false)}>Sem validade</button>
          <button data-on={temValidade ? 1 : 0} onClick={() => setTemValidade(true)}>Com validade (certificado)</button>
        </div>
        <button className="btn full" style={{ marginTop: 16 }} onClick={guardar}>Guardar</button>
        {cap && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }}
            onClick={() => desativarCapacitacao(cap.id).then(() => onGuardado("Capacitação removida")).catch((e) => torrada(e.message, true))}>
            Remover
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
