import { useState } from "react";
import { criarDuvida } from "../../lib/wiki";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SeletorMinisterios from "./SeletorMinisterios";

export default function SheetNovaDuvida({ ministerios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [ministeriosSel, setMinisteriosSel] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);

  function alternarMinisterio(id) {
    setMinisteriosSel((atual) => (atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id]));
  }

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("A dúvida precisa de um título");
    setAEnviar(true);
    try {
      await criarDuvida({ titulo: t, corpo: corpo.trim(), ministerios: ministeriosSel });
      onGuardado("Dúvida publicada");
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Nova dúvida</h2>
        <label className="rot" style={{ marginTop: 14 }}>Pergunta</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Como ligo a transmissão?" />
        <label className="rot">Mais detalhe (opcional)</label>
        <textarea className="campo" rows={4} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="O que já tentaste, onde travou…" />
        {ministerios?.length > 0 && (
          <>
            <label className="rot">Ministério (opcional)</label>
            <SeletorMinisterios ministerios={ministerios} selecionados={ministeriosSel} onToggle={alternarMinisterio} />
          </>
        )}
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Publicar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
