import { useEffect, useState } from "react";
import { ouvirArtigo, ouvirRespostas, responderDuvida, marcarRespostaCerta, transformarDuvidaEmArtigo } from "../../lib/wiki";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetDuvidaWiki({ wikiId, uid, papel, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [duvida, setDuvida] = useState(null);
  const [respostas, setRespostas] = useState([]);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => ouvirArtigo(wikiId, setDuvida), [wikiId]);
  useEffect(() => ouvirRespostas(wikiId, setRespostas), [wikiId]);

  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "alguém";
  const souEu = duvida?.autorId === uid;
  const souLiderBase = papel === "lider_base";

  async function responder() {
    const t = texto.trim();
    if (!t) return torrada("Escreve a resposta antes de enviar.");
    setAEnviar(true);
    try {
      await responderDuvida(wikiId, t);
      setTexto("");
    } catch (e) {
      torrada(e.message || "Não foi possível responder.");
    } finally {
      setAEnviar(false);
    }
  }

  async function marcarCerta(respostaId) {
    try {
      await marcarRespostaCerta(wikiId, respostaId);
      torrada("Marcada como a resposta certa");
    } catch (e) {
      torrada(e.message || "Não foi possível marcar.");
    }
  }

  async function transformar() {
    try {
      await transformarDuvidaEmArtigo(wikiId);
      onGuardado("Transformada em artigo");
    } catch (e) {
      torrada(e.message || "Não foi possível transformar.");
    }
  }

  if (!duvida) return null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{duvida.titulo}</h2>
        <p className="ds" style={{ marginTop: 4 }}>
          {duvida.resolvidaPorRespostaId ? "Resolvida" : "Em aberto"} · perguntou {nomeDe(duvida.autorId)}
        </p>
        {duvida.corpo && <p style={{ marginTop: 12, lineHeight: 1.6 }}>{duvida.corpo}</p>}

        <label className="rot" style={{ marginTop: 16 }}>Respostas</label>
        {respostas.length === 0 && <div className="vaz">Ainda ninguém respondeu.</div>}
        {respostas.map((r) => {
          const certa = duvida.resolvidaPorRespostaId === r.id;
          return (
            <div key={r.id} className="caixa" style={{ marginTop: 8, background: certa ? "var(--agua)" : undefined }}>
              <p style={{ lineHeight: 1.6 }}>{r.texto}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <p className="ds">{nomeDe(r.autorId)}</p>
                {certa ? (
                  <span className="tag verd">Resposta certa</span>
                ) : (souEu || souLiderBase) && !duvida.resolvidaPorRespostaId ? (
                  <button className="btn sec" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => marcarCerta(r.id)}>
                    Marcar como certa
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        <label className="rot" style={{ marginTop: 14 }}>A tua resposta</label>
        <textarea className="campo" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreve aqui" />
        <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviar} onClick={responder}>
          {aEnviar ? "A enviar…" : "Responder"}
        </button>

        {duvida.resolvidaPorRespostaId && (souEu || souLiderBase) && duvida.tipo === "duvida" && (
          <button className="btn full" style={{ marginTop: 14 }} onClick={transformar}>Transformar em artigo</button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
