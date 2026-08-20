import { useEffect, useState } from "react";
import { obterMinisteriosComunicacao, excluirMinhaSolicitacao } from "../lib/solicitacoes.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import { dataPorExtenso } from "../lib/data.js";
import { ROTULO_STATUS_SOLICITACAO, COR_STATUS_SOLICITACAO } from "./SheetSolicitacoesBase.jsx";

/** Vista só de leitura do pedido, do lado de quem pediu — quem
 *  produz/revê/recusa é sempre a Comunicação (ver apps/comunicacao),
 *  aqui só se acompanha. Mesmos campos do formulário de abertura
 *  (`SheetAbrirSolicitacao`), mais o estado atual e, se recusado, o
 *  motivo — tirado do histórico, não há campo `motivo` solto no
 *  documento.
 *
 *  Ministério: não aparece mais aqui como campo do pedido — quem
 *  escolhe agora é o líder da Comunicação, na triagem (ver
 *  `apps/comunicacao/CLAUDE.md`), não o solicitante ao abrir. Fica
 *  "por atribuir" enquanto isso não acontece; mostrar aqui só
 *  confundiria (o solicitante nunca escolheu isso).
 *
 *  Excluir: só o líder da base que pediu, só enquanto "fila" — uma
 *  vez assumido pela Comunicação, cancelar sozinho desapareceria sem
 *  avisar quem já está a produzir. */
export default function SheetDetalheSolicitacao({ solicitacao, papel, onFechar, onExcluido }) {
  const torrada = useTorrada();
  const [ministerios, setMinisterios] = useState([]);
  const [aExcluir, setAExcluir] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  useEffect(() => { obterMinisteriosComunicacao().then(setMinisterios); }, []);
  const ministerio = ministerios.find((m) => m.id === solicitacao.ministerioId);
  const motivoRecusa = solicitacao.status === "recusada"
    ? [...(solicitacao.historico || [])].reverse().find((h) => h.para === "recusada")?.motivo
    : null;
  const souLider = papel === "lider_base";
  const podeExcluir = souLider && solicitacao.status === "fila";

  function excluir() {
    setAEnviar(true);
    excluirMinhaSolicitacao(solicitacao.id)
      .then(() => { torrada("Pedido excluído"); onExcluido?.(); })
      .catch((e) => torrada(e.message || "Não foi possível excluir."))
      .finally(() => setAEnviar(false));
  }

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

        <label className="rot" style={{ marginTop: 14 }}>Ministério</label>
        <p className="ds">
          {ministerio ? (<><span className="quadmin" style={{ background: ministerio.cor }} />{ministerio.nome}</>) : "Por atribuir"}
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

        {podeExcluir && (
          !aExcluir ? (
            <button className="btn sec full" style={{ marginTop: 16, color: "var(--magenta)" }} onClick={() => setAExcluir(true)}>
              Excluir pedido
            </button>
          ) : (
            <div className="caixa" style={{ marginTop: 16 }}>
              <p className="ds">Tens a certeza? Ainda não foi assumido — o pedido sai da lista para sempre.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn" style={{ flex: 1, fontSize: 12.5, background: "var(--magenta)" }} disabled={aEnviar} onClick={excluir}>
                  Confirmar exclusão
                </button>
                <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar} onClick={() => setAExcluir(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
