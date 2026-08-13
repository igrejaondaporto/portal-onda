import { useState } from "react";
import { criarEsqueletoWiki } from "../../lib/wiki";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SeletorMinisterios from "../wiki/SeletorMinisterios";

/** O líder só dá o título e diz a quem serve — o conteúdo em si é
 *  escrito depois por quem quiser reclamar o artigo (ver Wiki.jsx). */
export default function SheetEsqueletoWiki({ ministerios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [titulo, setTitulo] = useState("");
  const [ministeriosSel, setMinisteriosSel] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);

  function alternarMinisterio(id) {
    setMinisteriosSel((atual) => (atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id]));
  }

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("O artigo precisa de um título");
    setAEnviar(true);
    try {
      await criarEsqueletoWiki({ titulo: t, ministerios: ministeriosSel });
      onGuardado("Esqueleto criado — falta alguém escrever");
    } catch (e) {
      torrada(e.message || "Não foi possível criar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Novo esqueleto de artigo</h2>
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar a mesa de som" />
        <SeletorMinisterios ministerios={ministerios} selecionados={ministeriosSel} onToggle={alternarMinisterio} />
        <p className="ds" style={{ marginTop: 8 }}>Fica visível como "por escrever" até alguém preencher.</p>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Criar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
