import { useState } from "react";
import { useTorrada } from "../lib/TorradaContext";
import { dataPorExtenso } from "../lib/data.js";

/** Confirmação para excluir um culto especial — nunca um domingo (a
 *  Cloud Function excluirCultoEspecial recusa). `excluir` é o wrapper
 *  já ligado à Cloud Function de cada app (`lib/painel.js`). */
export default function SheetExcluirCulto({ evento, excluir, onFechar, onVoltar, onExcluido }) {
  const torrada = useTorrada();
  const [aEnviar, setAEnviar] = useState(false);
  if (!evento) return null;

  async function confirmar() {
    setAEnviar(true);
    try {
      await excluir(evento.id);
      onExcluido(`${evento.tipo} excluído`);
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Excluir {evento.tipo}?</h2>
        <p className="sb2">{dataPorExtenso(evento.data)}</p>
        <p className="ds" style={{ marginTop: 10 }}>
          Some da escala e das checklists. Se já havia gente escalada ou ordem publicada, isso fica no histórico — só o culto deixa de aparecer.
        </p>
        <button className="btn full" style={{ marginTop: 20, background: "var(--magenta)" }} disabled={aEnviar} onClick={confirmar}>
          {aEnviar ? "A excluir…" : "Excluir culto"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => onVoltar(evento.id)}>
          Voltar atrás
        </button>
      </div>
    </>
  );
}
