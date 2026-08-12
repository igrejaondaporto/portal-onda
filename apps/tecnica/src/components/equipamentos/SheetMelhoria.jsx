import { useEffect, useState } from "react";
import {
  ouvirMelhoria, ouvirEventosMelhoria, comentarMelhoria, definirEstadoMelhoria,
  definirMetaPrevisao, resolverMelhoria, transformarMelhoriaEmArtigoWiki, corMelhoria, GRAVIDADES,
} from "../../lib/melhorias";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const NOMES_EVENTO = {
  abertura: "Abriu a melhoria", comentario: "comentou", estado: "mudou o estado para",
  meta: "definiu a meta para", previsao: "definiu a previsão para", resolucao: "resolveu",
};

export default function SheetMelhoria({ melhoriaId, uid, papel, voluntarios, equipamentos, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [melhoria, setMelhoria] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [comentario, setComentario] = useState("");
  const [meta, setMeta] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [notaResolucao, setNotaResolucao] = useState("");
  const [aResolver, setAResolver] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => ouvirMelhoria(melhoriaId, setMelhoria), [melhoriaId]);
  useEffect(() => ouvirEventosMelhoria(melhoriaId, setEventos), [melhoriaId]);
  useEffect(() => { setMeta(melhoria?.meta ?? ""); setPrevisao(melhoria?.previsao ?? ""); }, [melhoria?.meta, melhoria?.previsao]);

  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "alguém";
  const equipamento = melhoria?.equipamentoId ? equipamentos.find((e) => e.id === melhoria.equipamentoId) : null;
  const gravidadeTexto = GRAVIDADES.find(([k]) => k === melhoria?.gravidade)?.[1];

  async function enviarComentario() {
    const t = comentario.trim();
    if (!t) return torrada("Escreve o comentário antes de enviar.");
    setAEnviar(true);
    try {
      await comentarMelhoria(melhoriaId, t);
      setComentario("");
    } catch (e) {
      torrada(e.message || "Não foi possível comentar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function marcarEmCurso() {
    try {
      await definirEstadoMelhoria(melhoriaId, "em_curso");
    } catch (e) {
      torrada(e.message || "Não foi possível mudar o estado.");
    }
  }

  async function reabrir() {
    try {
      await definirEstadoMelhoria(melhoriaId, "aberta");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir.");
    }
  }

  async function guardarMeta() {
    try {
      await definirMetaPrevisao(melhoriaId, { meta: meta || null });
      torrada("Meta atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a meta.");
    }
  }

  async function guardarPrevisao() {
    try {
      await definirMetaPrevisao(melhoriaId, { previsao: previsao || null });
      torrada("Previsão atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a previsão.");
    }
  }

  async function resolver() {
    const n = notaResolucao.trim();
    if (!n) return torrada("A nota de resolução é obrigatória.");
    setAResolver(true);
    try {
      await resolverMelhoria(melhoriaId, n);
      torrada("Melhoria resolvida");
    } catch (e) {
      torrada(e.message || "Não foi possível resolver.");
      setAResolver(false);
    }
  }

  async function transformarEmArtigo() {
    try {
      await transformarMelhoriaEmArtigoWiki(melhoriaId);
      torrada("Transformada em artigo da Wiki");
    } catch (e) {
      torrada(e.message || "Não foi possível transformar.");
    }
  }

  if (!melhoria) return null;
  const { cor, texto: corTexto } = corMelhoria(melhoria);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{melhoria.titulo}</h2>
        <p className="ds" style={{ marginTop: 6 }}>
          {gravidadeTexto} · {equipamento ? equipamento.nome : "sem equipamento ligado"}
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <span className={`tag ${melhoria.estado === "resolvida" ? "verd" : melhoria.estado === "em_curso" ? "lim" : "cinz"}`}>
            {melhoria.estado === "resolvida" ? "Resolvida" : melhoria.estado === "em_curso" ? "Em curso" : "Aberta"}
          </span>
          {melhoria.estado !== "resolvida" && <span className={`tag ${cor}`}>{corTexto}</span>}
        </div>
        {melhoria.descricao && <p style={{ marginTop: 12, lineHeight: 1.6 }}>{melhoria.descricao}</p>}
        {melhoria.foto && <img src={melhoria.foto} className="fotofn" alt="" style={{ marginTop: 10 }} />}

        {melhoria.estado === "resolvida" ? (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="cap">Nota de resolução</p>
            <p style={{ marginTop: 6, lineHeight: 1.6 }}>{melhoria.notaResolucao}</p>
            <p className="ds" style={{ marginTop: 6 }}>Resolvida por {nomeDe(melhoria.resolvidaPor)}</p>
          </div>
        ) : (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Meta {souLiderBase ? "" : "(só o líder da base define)"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="campo" type="date" value={meta} disabled={!souLiderBase} onChange={(e) => setMeta(e.target.value)} />
              {souLiderBase && <button className="btn sec" style={{ padding: "10px 14px", fontSize: 12.5 }} onClick={guardarMeta}>Guardar</button>}
            </div>
            <label className="rot">Previsão de quem está a tratar</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="campo" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              <button className="btn sec" style={{ padding: "10px 14px", fontSize: 12.5 }} onClick={guardarPrevisao}>Guardar</button>
            </div>
          </>
        )}

        <label className="rot" style={{ marginTop: 16 }}>Linha do tempo</label>
        {eventos.map((ev) => (
          <div key={ev.id} className="linha" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <p className="nmt" style={{ fontSize: 14 }}>{nomeDe(ev.autorId)} {NOMES_EVENTO[ev.tipo] ?? ev.tipo}{ev.tipo !== "comentario" && ev.tipo !== "abertura" && ev.tipo !== "resolucao" ? ` ${ev.texto}` : ""}</p>
              {(ev.tipo === "comentario" || ev.tipo === "abertura" || ev.tipo === "resolucao") && ev.texto && (
                <p className="ds" style={{ marginTop: 2 }}>{ev.texto}</p>
              )}
            </div>
          </div>
        ))}

        {melhoria.estado !== "resolvida" && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Comentar</label>
            <textarea className="campo" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreve aqui" />
            <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviar} onClick={enviarComentario}>Comentar</button>

            {melhoria.estado === "aberta" && (
              <button className="btn sec full" style={{ marginTop: 10 }} onClick={marcarEmCurso}>Marcar em curso</button>
            )}

            <label className="rot" style={{ marginTop: 14 }}>Resolver — nota obrigatória</label>
            <textarea className="campo" rows={3} value={notaResolucao} onChange={(e) => setNotaResolucao(e.target.value)} placeholder="O que foi feito para resolver" />
            <button className="btn full" style={{ marginTop: 8 }} disabled={aResolver} onClick={resolver}>Resolver</button>
          </>
        )}

        {melhoria.estado === "resolvida" && (
          <>
            <button className="btn full" style={{ marginTop: 16 }} onClick={transformarEmArtigo}>Transformar em artigo da Wiki</button>
            {souLiderBase && <button className="btn sec full" style={{ marginTop: 9 }} onClick={reabrir}>Reabrir</button>}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
