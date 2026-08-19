import { useState } from "react";
import { criarRecurso, guardarRecurso, novoRecursoId, removerRecurso } from "../../lib/marcas";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const TIPOS = [
  ["logos", "Logos"],
  ["fontes", "Fontes"],
  ["cores", "Cores"],
  ["outros", "Outros"],
];
const ORIGENS = ["Google Drive", "Canva", "Dropbox", "Outro"];

export default function SheetRecurso({ marcaId, tipoAtual, recurso, onFechar, onGuardado, onRemovido }) {
  const torrada = useTorrada();
  const [tipo, setTipo] = useState(recurso?.tipo ?? tipoAtual ?? "logos");
  const [titulo, setTitulo] = useState(recurso?.titulo ?? "");
  const [descricao, setDescricao] = useState(recurso?.descricao ?? "");
  const [url, setUrl] = useState(recurso?.url ?? "");
  const [thumbUrl, setThumbUrl] = useState(recurso?.thumbUrl ?? "");
  const [origem, setOrigem] = useState(recurso?.origem ?? "Google Drive");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("Falta o título.");
    if (!url.trim()) return torrada("Falta o link.");
    setAEnviar(true);
    try {
      const dados = { tipo, titulo: t, descricao: descricao.trim(), url: url.trim(), thumbUrl: thumbUrl.trim() || null, origem };
      if (recurso) {
        await guardarRecurso(marcaId, recurso.id, dados);
        onGuardado("Recurso atualizado");
      } else {
        await criarRecurso(marcaId, novoRecursoId(marcaId), dados);
        onGuardado("Recurso adicionado");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function remover() {
    try {
      await removerRecurso(marcaId, recurso.id);
      onRemovido?.("Recurso removido");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{recurso ? "Editar recurso" : "Novo recurso"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Tipo</label>
        <div className="subtabs" style={{ marginTop: 0 }}>
          {TIPOS.map(([valor, rotulo]) => (
            <button key={valor} data-on={tipo === valor ? 1 : 0} onClick={() => setTipo(valor)}>{rotulo}</button>
          ))}
        </div>

        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Logo principal, fundo claro" />

        <label className="rot">Descrição (opcional)</label>
        <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

        <label className="rot">Link</label>
        <input className="campo" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Drive, Canva…" />

        <label className="rot">Miniatura (opcional)</label>
        <input className="campo" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} placeholder="Link de uma imagem" />

        <label className="rot">Origem</label>
        <div className="subtabs" style={{ marginTop: 0 }}>
          {ORIGENS.map((o) => (
            <button key={o} data-on={origem === o ? 1 : 0} onClick={() => setOrigem(o)}>{o}</button>
          ))}
        </div>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {recurso && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={remover}>
            Remover
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
