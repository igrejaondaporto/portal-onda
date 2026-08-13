import { useEffect, useState } from "react";
import { responderEnquete } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, MESES } from "@portal/shared/lib/data.js";

const nomeMes = (mes) => MESES[Number(mes.split("-")[1]) - 1];

/** Voto privado — só a própria pessoa vê a resposta dela (ver
 *  firestore.rules). "Não tenho indisponibilidades" só marca a
 *  escolha — como qualquer outra opção, só grava mesmo ao tocar em
 *  "Guardar resposta", pra não haver toque sem querer a valer voto.
 *
 *  Quando o líder abre dois meses de uma vez, `enquetes` traz os
 *  dois — a pessoa responde a um de cada vez, 1/2 e depois 2/2, sem
 *  precisar de abrir a folha duas vezes. */
export default function SheetResponderEnquete({ enquetes, eventosPorId, minhasRespostas, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [passo, setPasso] = useState(0);
  const [semIndisponibilidade, setSemIndisponibilidade] = useState(false);
  const [indisponivel, setIndisponivel] = useState({});
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  const enquete = enquetes[passo];
  const ultimoPasso = passo === enquetes.length - 1;

  useEffect(() => {
    const resposta = minhasRespostas?.[enquete.id];
    setSemIndisponibilidade(!!resposta?.semIndisponibilidade);
    setIndisponivel(Object.fromEntries((resposta?.indisponivelEm || []).map((id) => [id, true])));
    setNota(resposta?.nota || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquete.id]);

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
      if (ultimoPasso) {
        onGuardado("Resposta guardada");
      } else {
        setPasso((p) => p + 1);
        setAEnviar(false);
        torrada(`Guardado — falta ${nomeMes(enquetes[passo + 1].id)}`);
      }
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
        {enquetes.length > 1 && (
          <p className="sb2" style={{ marginBottom: 4 }}>
            Esta enquete é para os meses de {enquetes.map((e) => nomeMes(e.id)).join(" e ")} — passo {passo + 1}/{enquetes.length}
          </p>
        )}
        <h2>Tens alguma indisponibilidade em {nomeMes(enquete.id)}?</h2>
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
          {aEnviar ? "A guardar…" : ultimoPasso ? "Guardar resposta" : `Guardar e ir para ${nomeMes(enquetes[passo + 1]?.id)} (${passo + 2}/${enquetes.length})`}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
