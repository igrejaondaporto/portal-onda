import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataCurta } from "@portal/shared/lib/data.js";
import { minhaSalaRestrita, souLider } from "../../lib/modelo";
import { ouvirVoluntarios } from "../../lib/painel";
import {
  ouvirCapacitacoes, ouvirCapacitacoesDe, marcarCapacitacao, estadoCapacitacao,
  enviarComprovanteCapacitacao, criarCapacitacao, guardarCapacitacao, desativarCapacitacao,
  obterCapacitacoesDeTodos,
} from "../../lib/kinder";

const ACEITA = "image/*,application/pdf";

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
export default function Capacitacoes({ uid, papel, pessoa }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const restrita = minhaSalaRestrita(papel, pessoa);
  const [caps, setCaps] = useState([]);
  const [minhas, setMinhas] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [daEquipa, setDaEquipa] = useState(null);
  const [aEditar, setAEditar] = useState(null); // { cap } — null = nova
  const [aEnviar, setAEnviar] = useState(null); // id da capacitação a subir agora

  useEffect(() => ouvirCapacitacoes(setCaps), []);
  useEffect(() => ouvirCapacitacoesDe(uid, setMinhas), [uid]);
  useEffect(() => { if (lider) return ouvirVoluntarios(setVoluntarios); }, [lider]);
  // a líder de sala só vê a equipa da sua própria sala
  const equipaVisivel = restrita ? voluntarios.filter((p) => p.categoria === restrita) : voluntarios;

  async function verEquipa() {
    if (daEquipa) { setDaEquipa(null); return; }
    try {
      setDaEquipa(await obterCapacitacoesDeTodos(equipaVisivel));
    } catch (e) {
      torrada(e.message || "Não foi possível carregar.", true);
    }
  }

  async function enviar(cap, ficheiro) {
    if (!ficheiro) return;
    setAEnviar(cap.id);
    try {
      await enviarComprovanteCapacitacao(uid, cap.id, ficheiro);
    } catch (e) {
      torrada(e.message || "Não foi possível enviar o comprovativo.", true);
    } finally {
      setAEnviar(null);
    }
  }

  function remover(cap) {
    marcarCapacitacao(uid, cap.id, { comprovanteUrl: null, comprovanteNome: null, feitaEm: null, validaAte: null })
      .catch((e) => torrada(e.message || "Não foi possível guardar.", true));
  }

  function guardarValidade(cap, validaAte) {
    marcarCapacitacao(uid, cap.id, { validaAte: validaAte || null })
      .catch((e) => torrada(e.message || "Não foi possível guardar.", true));
  }

  return (
    <>
      <div className="sect">
        <div className="cabecalho"><h3>As tuas</h3></div>
        {caps.length === 0 && <div className="vaz">Ainda não há capacitações.</div>}
        {caps.map((c) => (
          <CartaoCapacitacao key={c.id} cap={c} feita={minhas[c.id]} lider={lider}
            aEnviar={aEnviar === c.id} onEnviar={(f) => enviar(c, f)} onRemover={() => remover(c)}
            onValidade={(v) => guardarValidade(c, v)} onEditar={() => setAEditar({ cap: c })} />
        ))}
      </div>

      {lider && (
        <div className="sect">
          <div className="cabecalho">
            <h3>A equipa</h3>
            <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setAEditar({ cap: null })}>Nova</button>
          </div>
          <button className="btn sec full" onClick={verEquipa}>{daEquipa ? "Esconder" : "Ver quem falta"}</button>
          {daEquipa && caps.map((c) => {
            const emFalta = equipaVisivel.filter((p) => estadoCapacitacao(c, daEquipa[p.id]?.[c.id]) !== "ok");
            return (
              <div className="linha" key={c.id}>
                <div style={{ flex: 1 }}>
                  <p className="nmt" style={{ fontSize: 14.5 }}>{c.titulo}</p>
                  <p className="ds">{emFalta.length ? `Faltam: ${emFalta.map((p) => p.nome).join(", ")}` : "Toda a equipa em dia"}</p>
                </div>
                <span className="tag cinz">{equipaVisivel.length - emFalta.length}/{equipaVisivel.length}</span>
              </div>
            );
          })}
        </div>
      )}

      {aEditar && <SheetCapacitacao cap={aEditar.cap} onFechar={() => setAEditar(null)} onGuardado={(m) => { setAEditar(null); torrada(m); }} />}
    </>
  );
}

function CartaoCapacitacao({ cap: c, feita, lider, aEnviar, onEnviar, onRemover, onValidade, onEditar }) {
  const inputRef = useRef(null);
  const estado = estadoCapacitacao(c, feita);
  return (
    <div className="caixa" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p className="nmt" style={{ flex: 1 }}>{c.titulo}</p>
        <span className={ESTADO[estado].classe}>{ESTADO[estado].texto}</span>
      </div>
      {c.descricao && <p className="ds" style={{ marginTop: 4 }}>{c.descricao}</p>}
      <p className="ds" style={{ marginTop: 4 }}>
        {c.obrigatoria ? "Obrigatória" : "Recomendada"}
        {feita?.feitaEm ? ` · comprovado a ${dataCurta(feita.feitaEm)}` : ""}
      </p>
      {c.temValidade && (
        <>
          <label className="rot">Válido até</label>
          <input className="campo" type="date" defaultValue={feita?.validaAte ?? ""} onBlur={(e) => onValidade(e.target.value)} />
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {c.url && <a className="btn sec" style={{ flex: 1, textAlign: "center" }} href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
        {feita?.comprovanteUrl && (
          <a className="btn sec" style={{ flex: 1, textAlign: "center" }} href={feita.comprovanteUrl} target="_blank" rel="noreferrer">
            Ver comprovativo
          </a>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACEITA} style={{ display: "none" }}
        onChange={(e) => { onEnviar(e.target.files[0] ?? null); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" style={{ flex: 1 }} disabled={aEnviar} onClick={() => inputRef.current?.click()}>
          {aEnviar ? "A enviar…" : feita?.comprovanteUrl ? "Trocar comprovativo" : "Enviar comprovativo"}
        </button>
        {feita?.comprovanteUrl && <button className="btn sec" style={{ flex: 1 }} onClick={onRemover}>Remover</button>}
      </div>
      {lider && <button className="btn sec full" style={{ marginTop: 8, padding: "7px", fontSize: 12.5 }} onClick={onEditar}>Editar</button>}
    </div>
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
