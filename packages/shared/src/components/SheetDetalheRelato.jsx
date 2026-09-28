import { useState } from "react";
import { excluirMeuRelato, ROTULO_TIPO_RELATO, ROTULO_STATUS_RELATO, COR_STATUS_RELATO } from "../lib/relatos.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import AnexoRelato from "./AnexoRelato.jsx";

/** Vista só de leitura do relato, do lado de quem reportou — quem
 *  muda o estado é sempre o Onda Tech Hub (ver apps/ondatechhub),
 *  aqui só se acompanha. Mesmo padrão de `SheetDetalheSolicitacao`.
 *
 *  Remover: só enquanto "aberto" — uma vez que o Onda Tech Hub mexeu,
 *  cancelar sozinho desapareceria sem avisar quem já está a olhar
 *  (ver `excluirMeuRelato`). */
export default function SheetDetalheRelato({ relato, onFechar, onExcluido }) {
  const torrada = useTorrada();
  const [aExcluir, setAExcluir] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const podeExcluir = relato.status === "aberto";
  const notaFinal = relato.status === "resolvido" || relato.status === "recusado"
    ? [...(relato.historico || [])].reverse().find((h) => h.para === relato.status)?.nota
    : null;

  function excluir() {
    setAEnviar(true);
    excluirMeuRelato(relato.id)
      .then(() => { torrada("Relato removido"); onExcluido?.(); })
      .catch((e) => torrada(e.message || "Não foi possível remover."))
      .finally(() => setAEnviar(false));
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{relato.titulo}</h2>
        <p className="sb2">{ROTULO_TIPO_RELATO[relato.tipo]}</p>

        <label className="rot" style={{ marginTop: 14 }}>O que aconteceu</label>
        <p className="ds">{relato.descricao}</p>

        <AnexoRelato url={relato.anexoUrl} tipo={relato.anexoTipo} />

        <label className="rot" style={{ marginTop: 14 }}>Estado</label>
        <p className="ds">
          <span className="tag" style={{ background: COR_STATUS_RELATO[relato.status] }}>
            {ROTULO_STATUS_RELATO[relato.status]}
          </span>
        </p>
        {notaFinal && <p className="ds" style={{ marginTop: 8 }}>Nota do Onda Tech Hub: {notaFinal}</p>}

        {podeExcluir && (
          !aExcluir ? (
            <button className="btn sec full" style={{ marginTop: 16, color: "var(--magenta)" }} onClick={() => setAExcluir(true)}>
              Remover relato
            </button>
          ) : (
            <div className="caixa" style={{ marginTop: 16 }}>
              <p className="ds">Tens a certeza? Ainda não foi visto pelo Onda Tech Hub — some da lista para sempre.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn" style={{ flex: 1, fontSize: 12.5, background: "var(--magenta)" }} disabled={aEnviar} onClick={excluir}>
                  Confirmar remoção
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
