import { useEffect, useState } from "react";
import { responderEnquete } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

/** Voto privado — só a própria pessoa vê a resposta dela (ver
 *  firestore.rules). "Não tenho indisponibilidades" é o caminho de
 *  90% das pessoas: um toque e pronto, sem marcar nada. */
export default function SheetResponderEnquete({ enquete, eventosPorId, minhaResposta, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [indisponivel, setIndisponivel] = useState({});
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (!minhaResposta) return;
    setIndisponivel(Object.fromEntries((minhaResposta.indisponivelEm || []).map((id) => [id, true])));
    setNota(minhaResposta.nota || "");
  }, [minhaResposta]);

  function alternar(id) {
    setIndisponivel((s) => ({ ...s, [id]: !s[id] }));
  }

  async function enviar(semIndisponibilidade) {
    setAEnviar(true);
    try {
      await responderEnquete({
        mes: enquete.id,
        indisponivelEm: semIndisponibilidade ? [] : Object.keys(indisponivel).filter((id) => indisponivel[id]),
        semIndisponibilidade,
        nota: nota.trim(),
      });
      onGuardado("Resposta guardada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a resposta.");
      setAEnviar(false);
    }
  }

  const marcadas = Object.values(indisponivel).some(Boolean);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Tens alguma indisponibilidade?</h2>
        <p className="sb2">Prazo até {dataPorExtenso(enquete.prazo)}</p>

        <button
          className="btn full" style={{ marginTop: 14, background: "var(--verde)" }}
          disabled={aEnviar} onClick={() => enviar(true)}
        >
          NÃO TENHO INDISPONIBILIDADES
        </button>

        <label className="rot" style={{ marginTop: 16 }}>Ou marca os cultos em que não podes</label>
        {(enquete.domingos || []).map((id) => {
          const ev = eventosPorId?.[id];
          return (
            <div className="linha" style={{ cursor: "pointer" }} key={id} onClick={() => alternar(id)}>
              <button className={`chk${indisponivel[id] ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternar(id); }}>✓</button>
              <div style={{ flex: 1 }}>
                <p className="nmt">{ev?.tipo || dataPorExtenso(ev?.data || id)}</p>
                {ev?.tipo && <p className="ds">{dataPorExtenso(ev.data)}</p>}
              </div>
            </div>
          );
        })}

        <label className="rot" style={{ marginTop: 14 }}>Nota (opcional)</label>
        <textarea className="campo" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: só de manhã, ou até às 12h" />

        <button className="btn sec full" style={{ marginTop: 16 }} disabled={aEnviar || !marcadas} onClick={() => enviar(false)}>
          {aEnviar ? "A guardar…" : "Guardar indisponibilidades marcadas"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
