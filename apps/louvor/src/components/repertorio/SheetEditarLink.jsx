import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Popup rápido para o link de referência de uma versão já no
 * repertório — botão próprio ao lado do selo de tom (ver
 * Repertorio.jsx), separado de SheetEditarTom de propósito (2026-09,
 * pedido do líder: "desmembra isso de Tom"). Grava direto na versão
 * ATUAL do item (`item.versaoId`) — a mesma versão que o Lead está a
 * usar naquele momento, já resolvida por qualquer redirecionamento de
 * tom anterior (ver definirTomComRedirecionamento em Repertorio.jsx);
 * este popup não redireciona nada sozinho, só grava no que já está.
 */
export default function SheetEditarLink({ titulo, linkAtual, onFechar, onConfirmar }) {
  const torrada = useTorrada();
  const [link, setLink] = useState(linkAtual || "");
  const [aGuardar, setAGuardar] = useState(false);

  async function confirmar() {
    setAGuardar(true);
    try {
      await onConfirmar(link.trim());
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o link.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Link da versão {titulo ? `· ${titulo}` : ""}</h2>
        <label className="rot">Link (opcional)</label>
        <input
          className="campo" value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Ex.: link do YouTube desta versão" autoFocus
        />
        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={confirmar}>
          {aGuardar ? "A guardar…" : "✓ Confirmar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
