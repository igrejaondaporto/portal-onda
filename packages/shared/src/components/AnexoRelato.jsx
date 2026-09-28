import { useState } from "react";
import ImagemExpandida from "./ImagemExpandida.jsx";

/** Mostra o anexo de um relato (foto ou vídeo) — usado tanto por quem
 *  reportou (`SheetDetalheRelato`) como pelo Onda Tech Hub
 *  (`SheetRelatoAdmin`, apps/ondatechhub), por isso vive aqui e não
 *  duplicado nos dois. Nada a mostrar depois de "resolvido" — o
 *  ficheiro já foi apagado do Storage (ver functions/relatos.js). */
export default function AnexoRelato({ url, tipo }) {
  const [expandida, setExpandida] = useState(false);
  if (!url) return null;
  const video = tipo?.startsWith("video/");

  return (
    <>
      <label className="rot" style={{ marginTop: 14 }}>Anexo</label>
      {video ? (
        <video src={url} controls style={{ width: "100%", borderRadius: 12, marginTop: 6 }} />
      ) : (
        <img
          src={url} alt="Anexo do relato" style={{ width: "100%", borderRadius: 12, marginTop: 6, cursor: "pointer" }}
          onClick={() => setExpandida(true)}
        />
      )}
      {expandida && <ImagemExpandida src={url} alt="Anexo do relato" onFechar={() => setExpandida(false)} />}
    </>
  );
}
