import { useState } from "react";
import { passarEquipamento } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetPassarEquipamento({ item, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [paraId, setParaId] = useState(item?.responsavelId ?? "");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    if (!paraId) return torrada("Escolhe quem fica com o equipamento.");
    setAEnviar(true);
    try {
      await passarEquipamento(item.id, paraId);
      onGuardado(`${item.nome} passou para ${voluntarios.find((p) => p.id === paraId)?.nome ?? "outra pessoa"}`);
    } catch (e) {
      torrada(e.message || "Não foi possível passar o equipamento.");
      setAEnviar(false);
    }
  }

  if (!item) return null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Passar {item.nome}</h2>
        <p className="sb2">
          {item.responsavelId
            ? `Está com ${voluntarios.find((p) => p.id === item.responsavelId)?.nome ?? "alguém"}`
            : "Ainda sem responsável"}
        </p>
        <label className="rot" style={{ marginTop: 14 }}>Fica com</label>
        <select className="campo" value={paraId} onChange={(e) => setParaId(e.target.value)}>
          <option value="">Escolhe alguém</option>
          {voluntarios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>
          {aEnviar ? "A guardar…" : "Guardar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
