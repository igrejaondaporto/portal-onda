import { useState } from "react";
import { criarCultoEspecial } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { MESES } from "@portal/shared/lib/data.js";

const pad2 = (n) => String(n).padStart(2, "0");

export default function SheetNovoCulto({ ano, mes, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState("");
  const [horaCulto, setHoraCulto] = useState("10:30");
  const [horaChegada, setHoraChegada] = useState("08:00");
  const [aEnviar, setAEnviar] = useState(false);

  const maxDia = new Date(ano, mes + 1, 0).getDate();

  async function guardar() {
    const n = nome.trim();
    const d = parseInt(dia, 10);
    if (!n) return torrada("O culto precisa de um nome");
    if (!d || d < 1 || d > maxDia) return torrada(`O dia tem de estar entre 1 e ${maxDia}`);

    const data = `${ano}-${pad2(mes + 1)}-${pad2(d)}`;
    setAEnviar(true);
    try {
      await criarCultoEspecial({
        data, tipo: n,
        horaCulto: horaCulto.trim() || "10:30",
        horaChegada: horaChegada.trim() || "08:00",
      });
      onGuardado(`${n} criado a ${d} de ${MESES[mes].toLowerCase()}`);
    } catch (e) {
      torrada(e.message || "Não foi possível criar o culto.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Culto especial</h2>
        <p className="sb2">{MESES[mes]} {ano} · fora dos domingos</p>
        <label className="rot">Nome do culto</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Culto de Mulheres" />
        <label className="rot">Dia do mês</label>
        <input className="campo" type="number" min="1" max={maxDia} value={dia} onChange={(e) => setDia(e.target.value)} placeholder="14" />
        <label className="rot">Hora do culto</label>
        <input className="campo" value={horaCulto} onChange={(e) => setHoraCulto(e.target.value)} placeholder="20:00" />
        <label className="rot">Hora de chegada da base</label>
        <input className="campo" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} placeholder="18:30" />
        <p className="ds" style={{ marginTop: 10 }}>Os domingos já existem todos. Isto serve para cultos fora do domingo.</p>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>Criar culto</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
