import { useState } from "react";
import { responderEnquete } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

export default function SheetResponderEnquete({ enquete, uid, minhaResposta, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [selecionadas, setSelecionadas] = useState(minhaResposta?.opcoes ?? []);
  const [aEnviar, setAEnviar] = useState(false);

  function alternar(opcao) {
    if (enquete.multiplaEscolha) {
      setSelecionadas((atual) => atual.includes(opcao) ? atual.filter((o) => o !== opcao) : [...atual, opcao]);
    } else {
      setSelecionadas([opcao]);
    }
  }

  async function guardar() {
    if (!selecionadas.length) return torrada("Escolhe pelo menos uma opção.");
    setAEnviar(true);
    try {
      await responderEnquete(enquete.id, uid, selecionadas);
      onGuardado("Resposta guardada");
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
        <h2>{enquete.pergunta}</h2>
        <p className="sb2">
          {enquete.multiplaEscolha ? "Podes escolher mais do que uma opção" : "Escolhe uma opção"}
          {enquete.prazo && ` · até ${dataPorExtenso(enquete.prazo)}`}
        </p>

        <div style={{ marginTop: 10 }}>
          {enquete.opcoes.map((o) => {
            const sel = selecionadas.includes(o);
            return (
              <button className="opcao" key={o} onClick={() => alternar(o)}>
                <span style={{ flex: 1, fontSize: 15 }}>{o}</span>
                <span className={`chk${sel ? " on" : ""}`}>✓</span>
              </button>
            );
          })}
        </div>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>
          {aEnviar ? "A guardar…" : "Guardar resposta"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
