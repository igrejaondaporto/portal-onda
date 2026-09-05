import { useState } from "react";
import GradeTom from "../biblioteca/GradeTom";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Popup rápido para trocar o tom de uma música já no repertório —
 * toca no selo de tom da linha (ver Repertorio.jsx) em vez de ter de
 * ir à Biblioteca. Grava direto na versão (mesma que a Biblioteca
 * edita), por isso vale para qualquer repertório futuro que use essa
 * versão, não só este culto.
 *
 * Ganhou também o link de referência da versão (2026-09, pedido do
 * líder) — mesmo campo `linkReferencia` que SheetVersao.jsx já grava
 * na Biblioteca, só que editável direto daqui, sem sair do
 * Repertório. `onConfirmar(tom, link)` grava os dois; se o tom
 * redirecionar para outra versão (ver definirTomComRedirecionamento
 * em Repertorio.jsx), o link segue junto para a versão final.
 */
export default function SheetEditarTom({ titulo, tomAtual, linkAtual, onFechar, onConfirmar }) {
  const torrada = useTorrada();
  const [tom, setTom] = useState(tomAtual || "");
  const [link, setLink] = useState(linkAtual || "");
  const [aGuardar, setAGuardar] = useState(false);

  async function confirmar() {
    if (!tom) return torrada("Escolhe um tom.");
    setAGuardar(true);
    try {
      await onConfirmar(tom, link.trim());
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
        <label className="rot" style={{ marginTop: 14 }}>Link da versão (opcional)</label>
        <input
          className="campo" value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Ex.: link do YouTube desta versão"
        />
        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || !tom} onClick={confirmar}>
          {aGuardar ? "A guardar…" : "✓ Confirmar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
