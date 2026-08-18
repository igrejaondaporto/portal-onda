import { useState } from "react";
import { assumirSolicitacao, mudarStatusSolicitacao } from "../../lib/solicitacoes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const ROTULO_STATUS = {
  fila: "Na fila", producao: "Em produção", revisao: "Em revisão",
  entregue: "Entregue", recusada: "Recusada",
};

export default function SheetSolicitacao({ solicitacao, uid, onFechar }) {
  const torrada = useTorrada();
  const [entregaUrl, setEntregaUrl] = useState(solicitacao.entregaUrl ?? "");
  const [motivo, setMotivo] = useState("");
  const [aRecusar, setARecusar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  if (!solicitacao) return null;
  const fechada = solicitacao.status === "entregue" || solicitacao.status === "recusada";

  async function assumir() {
    setAEnviar(true);
    try {
      await assumirSolicitacao(solicitacao.id);
      torrada("Assumiste este pedido");
    } catch (e) {
      torrada(e.message || "Não foi possível assumir.");
    } finally {
      setAEnviar(false);
    }
  }

  async function mudar(novoStatus, extra = {}) {
    setAEnviar(true);
    try {
      await mudarStatusSolicitacao({ id: solicitacao.id, novoStatus, ...extra });
      torrada(`Passou para ${ROTULO_STATUS[novoStatus]}`);
      if (novoStatus === "entregue" || novoStatus === "recusada") onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAEnviar(false);
    }
  }

  function entregar() {
    if (!entregaUrl.trim()) return torrada("Falta o link da entrega.");
    mudar("entregue", { entregaUrl: entregaUrl.trim() });
  }

  function recusar() {
    if (!motivo.trim()) return torrada("Falta o motivo.");
    mudar("recusada", { motivo: motivo.trim() });
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{solicitacao.titulo}</h2>
        <p className="sb2">
          {solicitacao.baseSolicitanteId} · {solicitacao.solicitanteNome} · prazo {dataPorExtenso(solicitacao.prazo)}
          {solicitacao.foraDoPrazo && " · fora do prazo mínimo"}
        </p>

        <label className="rot" style={{ marginTop: 14 }}>O que precisa</label>
        <p className="ds">{solicitacao.oQue}</p>
        <label className="rot" style={{ marginTop: 10 }}>Onde vai ser usado</label>
        <p className="ds">{solicitacao.ondeUsa}</p>
        {solicitacao.textoFinal && (
          <>
            <label className="rot" style={{ marginTop: 10 }}>Texto final</label>
            <p className="ds">{solicitacao.textoFinal}</p>
          </>
        )}
        {solicitacao.linkReferencia && (
          <>
            <label className="rot" style={{ marginTop: 10 }}>Referência</label>
            <p className="ds"><a href={solicitacao.linkReferencia} target="_blank" rel="noreferrer">{solicitacao.linkReferencia}</a></p>
          </>
        )}

        <label className="rot" style={{ marginTop: 14 }}>Estado</label>
        <p className="ds">
          {ROTULO_STATUS[solicitacao.status]}
          {solicitacao.responsavelNome && ` · ${solicitacao.responsavelNome}`}
        </p>

        {!fechada && !solicitacao.responsavelId && (
          <button className="btn full" style={{ marginTop: 14 }} disabled={aEnviar} onClick={assumir}>Assumir</button>
        )}

        {!fechada && solicitacao.responsavelId === uid && (
          <>
            {solicitacao.status === "producao" && (
              <button className="btn sec full" style={{ marginTop: 10 }} disabled={aEnviar} onClick={() => mudar("revisao")}>
                Passar para revisão
              </button>
            )}
            {solicitacao.status === "revisao" && (
              <button className="btn sec full" style={{ marginTop: 10 }} disabled={aEnviar} onClick={() => mudar("producao")}>
                Voltar para produção
              </button>
            )}
            <label className="rot" style={{ marginTop: 14 }}>Link da entrega</label>
            <input className="campo" value={entregaUrl} onChange={(e) => setEntregaUrl(e.target.value)} placeholder="Drive, Canva…" />
            <button className="btn full" style={{ marginTop: 10 }} disabled={aEnviar} onClick={entregar}>Marcar como entregue</button>

            {!aRecusar ? (
              <button className="btn sec full" style={{ marginTop: 10, color: "var(--magenta)" }} onClick={() => setARecusar(true)}>
                Recusar pedido
              </button>
            ) : (
              <div className="caixa" style={{ marginTop: 10 }}>
                <label className="rot">Motivo</label>
                <textarea className="campo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Porque não dá para fazer" />
                <button className="btn" style={{ marginTop: 10, background: "var(--magenta)" }} disabled={aEnviar} onClick={recusar}>
                  Confirmar recusa
                </button>
              </div>
            )}
          </>
        )}

        {solicitacao.historico?.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Histórico</label>
            {solicitacao.historico.map((h, i) => (
              <p className="ds" key={i}>
                {h.para} — {h.porNome ?? "alguém"}{h.motivo ? ` · ${h.motivo}` : ""}
              </p>
            ))}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
