import { useState } from "react";
import { criarCategoriaRecurso, renomearCategoriaRecurso, desativarCategoriaRecurso } from "../../lib/marcas";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Categorias de recurso são por marca — Logos/Fontes/Cores/Outros
 *  vêm por omissão (garantirCategoriasPadrao), o líder acrescenta
 *  mais aqui quando uma marca precisa de outra divisão. */
export default function SheetCategoriaRecurso({ marcaId, categoria, onFechar, onGuardado, onDesativada }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome da categoria.");
    setAEnviar(true);
    try {
      if (categoria) {
        await renomearCategoriaRecurso(marcaId, categoria.id, n);
        onGuardado("Categoria atualizada");
      } else {
        await criarCategoriaRecurso(marcaId, n);
        onGuardado("Categoria criada");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarCategoriaRecurso(marcaId, categoria.id);
      onDesativada?.("Categoria removida");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{categoria ? "Editar categoria" : "Nova categoria"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vídeos" />

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {categoria && (
          <>
            <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
              Remover categoria
            </button>
            <p className="ds" style={{ marginTop: 6, textAlign: "center" }}>
              Os recursos já nela ficam sem categoria — nada se apaga.
            </p>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
