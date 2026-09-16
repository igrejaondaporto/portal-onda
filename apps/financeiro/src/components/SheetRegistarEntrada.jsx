import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { eur } from "@portal/shared/lib/data.js";
import { FUNDOS, METODOS_ENTRADA, registarEntrada } from "../lib/entradas";

/** Regista uma entrada — dízimo, oferta, ou qualquer outra receita.
 *  Sempre o próprio Financeiro, nunca a base que recebeu (nenhuma tem
 *  esse dado). Um lançamento por fundo+método, para o total "por
 *  método + por fundo" bater certo sem ter de somar texto livre.
 *  Imutável depois de criado (ver firestore.rules) — corrige-se com
 *  um lançamento novo.
 *
 *  `fonte`, quando vem de uma fonte fixa (aluguel, doação combinada),
 *  pré-preenche fundo e valor habitual e liga o lançamento a ela
 *  (fonteId/fonteNome) — continua um registo normal em `entradas`. */
export default function SheetRegistarEntrada({ uid, fonte, onFechar, onFeito }) {
  const torrada = useTorrada();
  const [valor, setValor] = useState(fonte?.valorHabitual ? String(fonte.valorHabitual) : "");
  const [fundo, setFundo] = useState(fonte?.fundo ?? FUNDOS[0][0]);
  const [metodo, setMetodo] = useState(METODOS_ENTRADA[0][0]);
  const [referencia, setReferencia] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const v = Number(valor);
    if (!v || v <= 0) return torrada("Escreve o valor recebido");
    setAEnviar(true);
    try {
      await registarEntrada(uid, {
        valor: v, fundo, metodo, referencia: referencia.trim(),
        fonteId: fonte?.id, fonteNome: fonte?.nome,
      });
      torrada(`${eur(v)} registado`);
      onFeito?.();
    } catch (e) {
      torrada(e.message || "Não foi possível registar a entrada.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Registar entrada</h2>
        {fonte && <p className="sb2">{fonte.nome}</p>}

        <label className="rot" style={{ marginTop: 14 }}>Valor</label>
        <input className="campo" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />

        <label className="rot">Fundo</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {FUNDOS.map(([f, rotulo]) => (
            <button
              key={f} className="btn sec" style={{ padding: "12px 8px", fontSize: 13.5, ...(fundo === f ? { background: "var(--azul)", color: "#fff" } : null) }}
              onClick={() => setFundo(f)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <label className="rot">Método</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
          {METODOS_ENTRADA.map(([m, rotulo]) => (
            <button
              key={m} className="btn sec" style={{ padding: "12px 8px", fontSize: 13.5, ...(metodo === m ? { background: "var(--azul)", color: "#fff" } : null) }}
              onClick={() => setMetodo(m)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <label className="rot">Referência (opcional)</label>
        <input className="campo" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex.: culto de domingo, 14/09" />

        <button className="btn full" style={{ marginTop: 20 }} disabled={aEnviar} onClick={guardar}>Registar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
