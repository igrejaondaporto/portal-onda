import { useEffect, useState } from "react";
import { obterMinisteriosComunicacao } from "../lib/solicitacoes.js";
import { dataPorExtenso } from "../lib/data.js";
import { ROTULO_STATUS_SOLICITACAO, COR_STATUS_SOLICITACAO } from "./SheetSolicitacoesBase.jsx";

/** Vista só de leitura do pedido, do lado de quem pediu — quem
 *  produz/revê/recusa é sempre a Comunicação (ver apps/comunicacao),
 *  aqui só se acompanha. Mesmos campos do formulário de abertura
 *  (`SheetAbrirSolicitacao`), mais o estado atual e, se recusado, o
 *  motivo — tirado do histórico, não há campo `motivo` solto no
 *  documento. */
export default function SheetDetalheSolicitacao({ solicitacao, onFechar }) {
  const [ministerios, setMinisterios] = useState([]);
  useEffect(() => { obterMinisteriosComunicacao().then(setMinisterios); }, []);
  const ministerio = ministerios.find((m) => m.id === solicitacao.ministerioId);
  const motivoRecusa = solicitacao.status === "recusada"
    ? [...(solicitacao.historico || [])].reverse().find((h) => h.para === "recusada")?.motivo
    : null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{solicitacao.titulo}</h2>
        <p className="sb2">
          prazo {dataPorExtenso(solicitacao.prazo)}
          {solicitacao.foraDoPrazo && " · fora do prazo mínimo"}
        </p>

        {ministerio && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Ministério</label>
            <p className="ds"><span className="quadmin" style={{ background: ministerio.cor }} />{ministerio.nome}</p>
          </>
        )}

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
          <span className="tag" style={{ background: COR_STATUS_SOLICITACAO[solicitacao.status] }}>
            {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
          </span>
        </p>
        {solicitacao.entregaUrl && solicitacao.status === "entregue" && (
          <p className="ds" style={{ marginTop: 8 }}>
            Entrega: <a href={solicitacao.entregaUrl} target="_blank" rel="noreferrer">{solicitacao.entregaUrl}</a>
          </p>
        )}
        {motivoRecusa && <p className="ds" style={{ marginTop: 8 }}>Motivo: {motivoRecusa}</p>}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
