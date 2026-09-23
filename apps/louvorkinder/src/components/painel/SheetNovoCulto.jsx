import { useState } from "react";
import { criarCultoEspecial } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { MESES } from "@portal/shared/lib/data.js";

const pad2 = (n) => String(n).padStart(2, "0");

export default function SheetNovoCulto({ ano, mes, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [horaCulto, setHoraCulto] = useState("10:30");
  const [horaChegada, setHoraChegada] = useState("08:00");
  const [aEnviar, setAEnviar] = useState(false);

  const maxDia = new Date(ano, mes + 1, 0).getDate();
  const dataMin = `${ano}-${pad2(mes + 1)}-01`;
  const dataMax = `${ano}-${pad2(mes + 1)}-${pad2(maxDia)}`;

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O culto precisa de um nome");
    if (!data || data < dataMin || data > dataMax) return torrada(`Escolhe um dia dentro de ${MESES[mes]}.`);

    const d = Number(data.slice(8, 10));
    setAEnviar(true);
    try {
      await criarCultoEspecial({
        data, tipo: n, escopo: "base",
        horaCulto: horaCulto.trim() || "10:30",
        horaChegada: horaChegada.trim() || "08:00",
      });
      // segundo argumento opcional — quem só lê msg (ex.: PainelLider)
      // continua igual; SheetRascunho usa isto para já adicionar o
      // culto especial recém-criado ao rascunho, sem reconsultar o mês.
      onGuardado(`${n} criado a ${d} de ${MESES[mes].toLowerCase()}`, { id: data, data, tipo: n });
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
        <input className="campo" type="date" min={dataMin} max={dataMax} value={data} onChange={(e) => setData(e.target.value)} />
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
