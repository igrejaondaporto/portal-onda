import { useEffect, useState } from "react";
import { ouvirRascunhos, excluirRascunho } from "../../lib/rascunho";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetRascunho from "./SheetRascunho";

/** Gestão de rascunhos de escala — cobrem vários domingos de uma vez,
 *  escondidos dos voluntários até "Publicar" (ver SheetRascunho.jsx e
 *  CLAUDE.md desta base). */
export default function SecaoRascunhos({ voluntarios }) {
  const torrada = useTorrada();
  const [rascunhos, setRascunhos] = useState([]);
  const [sheet, setSheet] = useState(null); // { rascunhoId } | { novo: true } | null
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(null);
  const [aExcluir, setAExcluir] = useState(false);

  useEffect(() => ouvirRascunhos(setRascunhos), []);

  async function excluir(id) {
    setAExcluir(true);
    try {
      await excluirRascunho(id);
      torrada("Rascunho excluído");
      setAConfirmarExcluir(null);
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
    } finally {
      setAExcluir(false);
    }
  }

  const rascunhoAberto = sheet?.rascunhoId ? rascunhos.find((r) => r.id === sheet.rascunhoId) : null;

  return (
    <div className="sect">
      <div className="cabecalho">
        <h3>Rascunhos de escala</h3>
        <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ novo: true })}>
          Novo rascunho
        </button>
      </div>
      <p className="ds" style={{ padding: "0 0 4px" }}>
        Monta a escala de vários domingos com calma — só fica visível para os voluntários depois de publicares.
      </p>

      {!rascunhos.length && <div className="vaz">Nenhum rascunho ainda.</div>}
      {rascunhos.map((r) => {
        const n = (r.itens || []).length;
        return (
          <div className="linha" key={r.id}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSheet({ rascunhoId: r.id })}>
              <p className="nmt">{r.nome || "Rascunho sem nome"}</p>
              <p className="ds">
                {n} domingo{n === 1 ? "" : "s"}
                {r.publicado && <span className="tag lim" style={{ marginLeft: 6 }}>publicado</span>}
              </p>
            </div>
            {aConfirmarExcluir === r.id ? (
              <>
                <button className="btn sec" style={{ padding: "8px 12px", fontSize: 12 }} disabled={aExcluir} onClick={() => setAConfirmarExcluir(null)}>Cancelar</button>
                <button className="btn" style={{ padding: "8px 12px", fontSize: 12, background: "var(--magenta)", marginLeft: 6 }} disabled={aExcluir} onClick={() => excluir(r.id)}>
                  {aExcluir ? "…" : "Excluir"}
                </button>
              </>
            ) : (
              <>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => setSheet({ rascunhoId: r.id })}>Editar</button>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, marginLeft: 6, color: "var(--magenta)" }} onClick={() => setAConfirmarExcluir(r.id)}>
                  Excluir
                </button>
              </>
            )}
          </div>
        );
      })}

      {(sheet?.novo || rascunhoAberto) && (
        <SheetRascunho
          rascunho={rascunhoAberto || null}
          voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </div>
  );
}
