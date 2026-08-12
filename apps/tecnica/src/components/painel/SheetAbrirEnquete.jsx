import { useEffect, useState } from "react";
import { abrirEnquete } from "../../lib/enquetes";
import { obterEventosDoMes } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const pad2 = (n) => String(n).padStart(2, "0");

// sugestão inicial: o mês seguinte ao de hoje — é sempre esse que se
// pergunta (ver CLAUDE.md: "se hoje ≥ dia 15 e não existe enquete
// aberta para o mês seguinte")
function mesSeguinte(hoje) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export default function SheetAbrirEnquete({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [mes, setMes] = useState(mesSeguinte(hoje));
  const [prazo, setPrazo] = useState(`${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-25`);
  const [eventos, setEventos] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [aCarregar, setACarregar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    const [ano, m] = mes.split("-").map(Number);
    setACarregar(true);
    obterEventosDoMes(ano, m - 1)
      .then((evs) => {
        setEventos(evs);
        setSelecionados(Object.fromEntries(evs.map((e) => [e.id, true])));
      })
      .finally(() => setACarregar(false));
  }, [mes]);

  function alternar(id) {
    setSelecionados((s) => ({ ...s, [id]: !s[id] }));
  }

  async function guardar() {
    const domingos = eventos.filter((e) => selecionados[e.id]).map((e) => e.id);
    if (!domingos.length) return torrada("Escolhe pelo menos um culto.");
    if (!prazo) return torrada("Falta o prazo.");
    setAEnviar(true);
    try {
      await abrirEnquete({ mes, prazo, domingos });
      onGuardado("Enquete aberta");
    } catch (e) {
      torrada(e.message || "Não foi possível abrir a enquete.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Abrir enquete de indisponibilidade</h2>
        <p className="sb2">"Tens alguma indisponibilidade este mês?"</p>

        <label className="rot">Mês</label>
        <input className="campo" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />

        <label className="rot">Prazo para responder</label>
        <input className="campo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />

        <label className="rot" style={{ marginTop: 14 }}>Cultos deste mês</label>
        {aCarregar && <div className="vaz">A carregar…</div>}
        {!aCarregar && !eventos.length && <div className="vaz">Sem cultos criados para este mês ainda.</div>}
        {eventos.map((ev) => (
          <div className="linha" style={{ cursor: "pointer" }} key={ev.id} onClick={() => alternar(ev.id)}>
            <button className={`chk${selecionados[ev.id] ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternar(ev.id); }}>✓</button>
            <div style={{ flex: 1 }}>
              <p className="nmt">{ev.tipo || dataPorExtenso(ev.data)}</p>
              {ev.tipo && <p className="ds">{dataPorExtenso(ev.data)}</p>}
            </div>
          </div>
        ))}

        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || aCarregar} onClick={guardar}>
          {aEnviar ? "A abrir…" : "Abrir enquete"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
