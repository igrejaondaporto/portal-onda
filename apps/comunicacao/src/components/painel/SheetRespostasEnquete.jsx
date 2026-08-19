import { useEffect, useState } from "react";
import { ouvirRespostas, contarPorOpcao, fecharEnquete, reabrirEnquete } from "../../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

export default function SheetRespostasEnquete({ enquete, voluntarios, onFechar, onMudou }) {
  const torrada = useTorrada();
  const [respostas, setRespostas] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => ouvirRespostas(enquete.id, setRespostas), [enquete.id]);

  const contagem = contarPorOpcao(enquete.opcoes, respostas);
  const total = respostas.length;
  const responderam = new Set(respostas.map((r) => r.id));
  const naoResponderam = voluntarios.filter((p) => !responderam.has(p.id));

  async function alternarEstado() {
    setAEnviar(true);
    try {
      if (enquete.ativa) {
        await fecharEnquete(enquete.id);
        torrada("Enquete encerrada");
      } else {
        await reabrirEnquete(enquete.id);
        torrada("Enquete reaberta");
      }
      onMudou?.();
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
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
          {total} resposta{total === 1 ? "" : "s"}{enquete.prazo && ` · prazo ${dataPorExtenso(enquete.prazo)}`}
        </p>

        <label className="rot" style={{ marginTop: 14 }}>Resultado</label>
        {enquete.opcoes.map((o) => {
          const n = contagem[o] || 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <div key={o} style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span>{o}</span>
                <span className="ds">{n} · {pct}%</span>
              </div>
              <div className="barra" style={{ marginTop: 5 }}><i style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}

        {naoResponderam.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 16 }}>Ainda não responderam ({naoResponderam.length})</label>
            <p className="ds">{naoResponderam.map((p) => p.nome).join(", ")}</p>
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={alternarEstado}>
          {enquete.ativa ? "Encerrar enquete" : "Reabrir enquete"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
