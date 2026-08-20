import { useState } from "react";
import { criarCategoriaAcervo, renomearCategoriaAcervo, desativarCategoriaAcervo } from "../../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Categorias só dividem a lista do Acervo — sem mais nenhum efeito
 *  no sistema. Desativar não apaga os itens já nela: eles caem em
 *  "Sem categoria" (ver Brand.jsx), nunca desaparecem. */
export default function SheetCategoriaAcervo({ categoria, onFechar, onGuardado, onDesativada }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome da categoria.");
    setAEnviar(true);
    try {
      if (categoria) {
        await renomearCategoriaAcervo(categoria.id, n);
        onGuardado("Categoria atualizada");
      } else {
        await criarCategoriaAcervo(n);
        onGuardado("Categoria criada");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarCategoriaAcervo(categoria.id);
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
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fotos de culto" />

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {categoria && (
          <>
            <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
              Remover categoria
            </button>
            <p className="ds" style={{ marginTop: 6, textAlign: "center" }}>
              Os itens já nela ficam em "Sem categoria" — nada se apaga.
            </p>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
