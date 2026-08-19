import { useState } from "react";
import { criarItemAcervo, guardarItemAcervo, novoItemAcervoId, desativarItemAcervo } from "../../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const ORIGENS = ["Google Drive", "Canva", "Dropbox", "Outro"];

export default function SheetItemAcervo({ item, onFechar, onGuardado, onDesativado }) {
  const torrada = useTorrada();
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [thumbUrl, setThumbUrl] = useState(item?.thumbUrl ?? "");
  const [origem, setOrigem] = useState(item?.origem ?? "Google Drive");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("Falta o título.");
    if (!url.trim()) return torrada("Falta o link.");
    setAEnviar(true);
    try {
      const dados = { titulo: t, descricao: descricao.trim(), url: url.trim(), thumbUrl: thumbUrl.trim() || null, origem };
      if (item) {
        await guardarItemAcervo(item.id, dados);
        onGuardado("Item atualizado");
      } else {
        await criarItemAcervo(novoItemAcervoId(), dados);
        onGuardado("Item adicionado ao acervo");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarItemAcervo(item.id);
      onDesativado?.("Item removido do acervo");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{item ? "Editar item" : "Novo item do acervo"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Fotos do Culto de Jovens — julho" />

        <label className="rot">Descrição (opcional)</label>
        <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

        <label className="rot">Link</label>
        <input className="campo" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Drive, Canva, Dropbox…" />

        <label className="rot">Miniatura (opcional)</label>
        <input className="campo" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} placeholder="Link de uma imagem" />

        <label className="rot">Origem</label>
        <div className="subtabs" style={{ marginTop: 0 }}>
          {ORIGENS.map((o) => (
            <button key={o} data-on={origem === o ? 1 : 0} onClick={() => setOrigem(o)}>{o}</button>
          ))}
        </div>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {item && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
            Remover do acervo
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
