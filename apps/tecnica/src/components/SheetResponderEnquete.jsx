import { useEffect, useState } from "react";
import { responderEnquete } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

/** Voto privado — só a própria pessoa vê a resposta dela (ver
 *  firestore.rules). "Não tenho indisponibilidades" só marca a
 *  escolha — como qualquer outra opção, só grava mesmo ao tocar em
 *  "Guardar resposta", pra não haver toque sem querer a valer voto. */
export default function SheetResponderEnquete({ enquete, eventosPorId, minhaResposta, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [semIndisponibilidade, setSemIndisponibilidade] = useState(false);
  const [indisponivel, setIndisponivel] = useState({});
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (!minhaResposta) return;
    setSemIndisponibilidade(!!minhaResposta.semIndisponibilidade);
    setIndisponivel(Object.fromEntries((minhaResposta.indisponivelEm || []).map((id) => [id, true])));
    setNota(minhaResposta.nota || "");
  }, [minhaResposta]);

  function escolherSemIndisponibilidade() {
    setSemIndisponibilidade(true);
    setIndisponivel({});
  }

  function alternar(id) {
    setSemIndisponibilidade(false);
    setIndisponivel((s) => ({ ...s, [id]: !s[id] }));
  }

  const marcadas = Object.values(indisponivel).some(Boolean);
  const podeGuardar = semIndisponibilidade || marcadas;

  async function guardar() {
    if (!podeGuardar) return torrada("Marca se tens indisponibilidades ou toca em \"Não tenho indisponibilidades\".");
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

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Tens alguma indisponibilidade?</h2>
        <p className="sb2">Prazo até {dataPorExtenso(enquete.prazo)}</p>

        <button
          className="btn full" style={{
            marginTop: 14, background: "var(--verde)",
            outline: semIndisponibilidade ? "3px solid var(--tinta)" : "none",
          }}
          disabled={aEnviar} onClick={escolherSemIndisponibilidade}
        >
          {semIndisponibilidade ? "✓ " : ""}NÃO TENHO INDISPONIBILIDADES
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

        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || !podeGuardar} onClick={guardar}>
          {aEnviar ? "A guardar…" : "Guardar resposta"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
