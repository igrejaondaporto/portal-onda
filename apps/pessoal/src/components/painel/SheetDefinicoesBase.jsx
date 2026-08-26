import { useState } from "react";
import { definirBase } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetDefinicoesBase({ base, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [horaChegada, setHoraChegada] = useState(base?.horaChegada ?? "08:00");
  const [horaCulto, setHoraCulto] = useState(base?.horaCulto ?? "10:30");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    if (!/^\d{1,2}:\d{2}$/.test(horaChegada) || !/^\d{1,2}:\d{2}$/.test(horaCulto)) {
      return torrada("Usa o formato HH:MM, ex.: 08:00");
    }
    setAEnviar(true);
    try {
      await definirBase({ horaChegada, horaCulto });
      onGuardado("Definições da base atualizadas");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Definições da base</h2>
        <p className="sb2">Válido para todos os domingos</p>
        <label className="rot" style={{ marginTop: 14 }}>Hora de chegada</label>
        <input className="campo" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} placeholder="08:00" />
        <label className="rot">Hora do culto</label>
        <input className="campo" value={horaCulto} onChange={(e) => setHoraCulto(e.target.value)} placeholder="10:30" />
        <p className="ds" style={{ marginTop: 10 }}>
          Um culto especial pode ter horas próprias — isto só define o padrão dos domingos.
        </p>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
