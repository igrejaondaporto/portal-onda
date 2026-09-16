import { useState } from "react";
import { eur } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ROTULO_METODO } from "../lib/reembolsosFinanceiro";
import { registarDespesaFixa } from "../lib/fornecedores";

/** Regista um pagamento já feito a um fornecedor — não passa pelo
 *  ciclo de reembolso (não há voluntário nenhum a pedir), é o
 *  Financeiro a lançar diretamente o que já saiu. Histórico
 *  imutável (ver despesasFixas em firestore.rules): sem editar
 *  nem apagar depois de criado, corrige-se com um lançamento novo. */
export default function SheetRegistarDespesa({ fornecedor, uid, onFechar, onFeito }) {
  const torrada = useTorrada();
  const [valor, setValor] = useState(fornecedor.valorHabitual ? String(fornecedor.valorHabitual) : "");
  const [metodo, setMetodo] = useState("transferencia");
  const [referencia, setReferencia] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const v = Number(valor);
    if (!v || v <= 0) return torrada("Escreve o valor pago");
    setAEnviar(true);
    try {
      await registarDespesaFixa(uid, {
        fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome, categoria: fornecedor.categoria,
        valor: v, metodo, referencia: referencia.trim(),
      });
      torrada(`${eur(v)} registado para ${fornecedor.nome}`);
      onFeito?.();
    } catch (e) {
      torrada(e.message || "Não foi possível registar o pagamento.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Registar pagamento</h2>
        <p className="sb2">{fornecedor.nome}</p>

        <label className="rot" style={{ marginTop: 14 }}>Valor pago</label>
        <input className="campo" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />

        <label className="rot">Método</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
          {Object.entries({ ...ROTULO_METODO, numerario: "Numerário" }).map(([m, rotulo]) => (
            <button
              key={m} className="btn sec" style={{ padding: "12px 8px", fontSize: 13.5, ...(metodo === m ? { background: "var(--azul)", color: "#fff" } : null) }}
              onClick={() => setMetodo(m)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <label className="rot">Referência (opcional)</label>
        <input className="campo" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nº da transferência, por exemplo" />

        <button className="btn full" style={{ marginTop: 20 }} disabled={aEnviar} onClick={guardar}>Registar pagamento</button>
      </div>
    </>
  );
}
