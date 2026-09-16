import { useRef, useState } from "react";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import { ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { marcarReembolsosPagos, devolverReembolso, subirComprovativoPagamento, mostrarDestino, ROTULO_METODO } from "../lib/reembolsosFinanceiro";

/** Detalhe de um pedido aprovado — pagar ou devolver. As duas ações
 *  são Cloud Function (ver lib/reembolsosFinanceiro.js); esta folha só
 *  recolhe o método/referência ou o motivo e fecha ao sucesso. */
export default function SheetDetalheReembolso({ pedido, nomeBase, corBase, onFechar, onFeito }) {
  const torrada = useTorrada();
  const [metodo, setMetodo] = useState(pedido.pagamento?.metodo ?? "transferencia");
  const [referencia, setReferencia] = useState("");
  const [comprovativo, setComprovativo] = useState(null);
  const inputComprovativoRef = useRef(null);
  const [aDevolver, setADevolver] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  function escolherComprovativo(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) setComprovativo(f);
  }

  async function pagar() {
    setAEnviar(true);
    try {
      // opcional — se falhar o upload, o pagamento não fica bloqueado
      // por causa disso; só avisa e segue sem o comprovativo.
      let comprovativoUrl = null;
      if (comprovativo) {
        try {
          comprovativoUrl = await subirComprovativoPagamento(pedido, comprovativo);
        } catch {
          torrada("Não foi possível subir o comprovativo — a marcar como pago mesmo assim.");
        }
      }
      await marcarReembolsosPagos([pedido], metodo, referencia.trim(), comprovativoUrl);
      torrada("Pedido marcado como pago");
      onFeito?.();
    } catch (e) {
      torrada(e.message || "Não foi possível marcar como pago.");
    } finally {
      setAEnviar(false);
    }
  }

  async function confirmarDevolucao() {
    if (!motivo.trim()) return torrada("Escreve o que está mal no pedido");
    setAEnviar(true);
    try {
      await devolverReembolso(pedido.baseId, pedido.id, motivo.trim());
      torrada("Pedido devolvido à líder");
      onFeito?.();
    } catch (e) {
      torrada(e.message || "Não foi possível devolver.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{eur(pedido.valor)}</h2>
        <p className="sb2">
          <span className="quadmin" style={{ background: corBase }} />
          {nomeBase} · {pedido.pessoaNome ?? "…"} · {dataTimestamp(pedido.criadoEm)}
        </p>

        <label className="rot" style={{ marginTop: 14 }}>O que foi</label>
        <p className="ds">
          {pedido.descricao}
          {pedido.categoria ? ` · ${ROTULO_CATEGORIA_DESPESA[pedido.categoria] ?? pedido.categoria}` : ""}
        </p>

        {pedido.anexo && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Fatura</label>
            <p className="ds"><a href={pedido.anexo} target="_blank" rel="noreferrer">Ver ficheiro</a></p>
          </>
        )}

        <label className="rot" style={{ marginTop: 14 }}>Pagar para</label>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 8 }}>
          <span className="rot" style={{ marginTop: 0, color: "var(--azul)", opacity: 0.75 }}>
            {ROTULO_METODO[pedido.pagamento?.metodo] ?? pedido.pagamento?.metodo}
          </span>
          <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {pedido.pagamento ? mostrarDestino(pedido.pagamento.metodo, pedido.pagamento.destino) : "—"}
          </p>
        </div>

        {aDevolver ? (
          <>
            <label className="rot" style={{ marginTop: 14 }}>O que está mal no pedido</label>
            <textarea className="campo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: fatura ilegível, falta o NIF da igreja" />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn full" disabled={aEnviar} onClick={confirmarDevolucao}>Confirmar devolução</button>
              <button className="btn sec" style={{ flex: "none", padding: "13px 18px" }} onClick={() => setADevolver(false)}>Cancelar</button>
            </div>
          </>
        ) : (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Pago por</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 8 }}>
              {Object.entries({ ...ROTULO_METODO, numerario: "Numerário" }).map(([m, rotulo]) => (
                <button
                  key={m} className="btn sec" style={{ padding: "12px 10px", fontSize: 13.5, ...(metodo === m ? { background: "var(--azul)", color: "#fff" } : null) }}
                  onClick={() => setMetodo(m)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <label className="rot">Referência (opcional)</label>
            <input className="campo" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nº da transferência, por exemplo" />

            <label className="rot">Comprovativo de pagamento (opcional)</label>
            <input ref={inputComprovativoRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={escolherComprovativo} />
            <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => inputComprovativoRef.current.click()}>
              {comprovativo ? "Comprovativo anexado ✓" : "Escolher ficheiro"}
            </button>

            <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
              <button className="btn full" disabled={aEnviar} onClick={pagar}>Marcar como pago</button>
              <button className="btn sec" style={{ flex: "none", padding: "13px 16px", color: "var(--magenta)" }} onClick={() => setADevolver(true)}>
                Devolver
              </button>
            </div>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
