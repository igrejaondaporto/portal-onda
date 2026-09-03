import { useState } from "react";
import GradeTom from "../biblioteca/GradeTom";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Popup rápido para trocar o tom de uma música já no repertório —
 * toca no selo de tom da linha (ver Repertorio.jsx) em vez de ter de
 * ir à Biblioteca. Grava direto na versão (mesma que a Biblioteca
 * edita), por isso vale para qualquer repertório futuro que use essa
 * versão, não só este culto.
 */
export default function SheetEditarTom({ titulo, tomAtual, onFechar, onConfirmar }) {
  const torrada = useTorrada();
  const [tom, setTom] = useState(tomAtual || "");
  const [aGuardar, setAGuardar] = useState(false);

  async function confirmar() {
    if (!tom) return torrada("Escolhe um tom.");
    setAGuardar(true);
    try {
      await onConfirmar(tom);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o tom.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Tom {titulo ? `· ${titulo}` : ""}</h2>
        <GradeTom valor={tom} onEscolher={setTom} />
        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || !tom} onClick={confirmar}>
          {aGuardar ? "A guardar…" : "✓ Confirmar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
