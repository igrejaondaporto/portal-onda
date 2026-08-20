import { useState } from "react";
import { criarCategoriaAcervo, guardarCategoriaAcervo, desativarCategoriaAcervo } from "../../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const COR_PADRAO = "#0019BE";

/** Categorias só dividem a lista do Acervo — sem mais nenhum efeito
 *  no sistema. Desativar não apaga os itens já nela: eles caem em
 *  "Sem categoria" (ver Brand.jsx), nunca desaparecem.
 *
 *  Cor, não foto — a primeira versão testou uma foto de fundo na
 *  barra e o líder achou feio ("ficou horrível"). Cor é a mesma
 *  barra que a Wiki já usa para agrupar por ministério. */
export default function SheetCategoriaAcervo({ categoria, onFechar, onGuardado, onDesativada }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [cor, setCor] = useState(categoria?.cor ?? COR_PADRAO);
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome da categoria.");
    setAEnviar(true);
    try {
      const dados = { nome: n, cor };
      if (categoria) {
        await guardarCategoriaAcervo(categoria.id, dados);
        onGuardado("Categoria atualizada");
      } else {
        await criarCategoriaAcervo(dados);
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

        <label className="rot">Cor</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 40, height: 40, border: 0, borderRadius: 8, padding: 0 }} />
          <input className="campo" style={{ flex: 1 }} value={cor} onChange={(e) => setCor(e.target.value)} />
        </div>

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
