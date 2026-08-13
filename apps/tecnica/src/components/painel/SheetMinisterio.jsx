import { useState } from "react";
import { criarMinisterio, guardarMinisterio, desativarMinisterio, novoMinisterioId } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const CORES = ["#0092D4", "#D8F24B", "#FF2E88", "#7B5CFF", "#00A88F", "#F5A300"];

export default function SheetMinisterio({ ministerio, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(ministerio?.nome ?? "");
  const [cor, setCor] = useState(ministerio?.cor ?? CORES[0]);
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O ministério precisa de um nome");
    setAEnviar(true);
    try {
      const dados = { nome: n, cor, temChecklist: true };
      if (ministerio) {
        await guardarMinisterio(ministerio.id, dados);
        onGuardado("Ministério atualizado");
      } else {
        await criarMinisterio(novoMinisterioId(), { ...dados, ordem: 99 });
        onGuardado("Ministério criado");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarMinisterio(ministerio.id);
      onGuardado("Ministério desativado");
    } catch (e) {
      torrada(e.message || "Não foi possível desativar.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{ministerio ? "Editar ministério" : "Novo ministério"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Áudio" />
        <label className="rot">Cor</label>
        <div className="subtabs">
          {CORES.map((c) => (
            <button
              key={c} data-on={cor === c ? 1 : 0} onClick={() => setCor(c)}
              style={{ background: cor === c ? c : undefined, color: cor === c ? "#fff" : undefined }}
            >
              &nbsp;
            </button>
          ))}
        </div>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {ministerio && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
            Desativar ministério
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
