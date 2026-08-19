import { useEffect, useState } from "react";
import { ouvirRespostas, fecharEnquete, reabrirEnquete, excluirEnquete, textoWhatsApp, linkWhatsApp } from "../../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, MESES } from "@portal/shared/lib/data.js";

const nomeMes = (mes) => MESES[Number(mes.split("-")[1]) - 1];

/** O líder vê quem respondeu, quem falta, e quem está indisponível em
 *  cada domingo — é este conjunto que "Sugestão automática" (dentro
 *  do editor de escala) usa para excluir gente. Não monta a escala
 *  aqui: isso continua a acontecer culto a culto, em Escala. */
export default function SheetIndisponibilidade({ enquete, voluntarios, eventosPorId, onFechar, onMudou }) {
  const torrada = useTorrada();
  const [respostas, setRespostas] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(false);

  useEffect(() => ouvirRespostas(enquete.id, setRespostas), [enquete.id]);

  const responderam = new Set(respostas.map((r) => r.id));
  const naoResponderam = voluntarios.filter((p) => !responderam.has(p.id));
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "alguém";

  async function fechar() {
    setAEnviar(true);
    try { await fecharEnquete(enquete.id); torrada("Enquete encerrada"); onMudou?.(); }
    catch (e) { torrada(e.message || "Não foi possível encerrar."); }
    finally { setAEnviar(false); }
  }
  async function reabrir() {
    setAEnviar(true);
    try { await reabrirEnquete(enquete.id); torrada("Enquete reaberta"); onMudou?.(); }
    catch (e) { torrada(e.message || "Não foi possível reabrir."); }
    finally { setAEnviar(false); }
  }
  async function excluir() {
    setAEnviar(true);
    try { await excluirEnquete(enquete.id); torrada("Enquete excluída"); onMudou?.(); onFechar(); }
    catch (e) { torrada(e.message || "Não foi possível excluir."); }
    finally { setAEnviar(false); }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Indisponibilidades de {nomeMes(enquete.id)}</h2>
        <p className="sb2">
          {respostas.length} de {voluntarios.length} responderam · prazo {dataPorExtenso(enquete.prazo)}
        </p>

        <a
          className="btn sec full" style={{ marginTop: 14, textDecoration: "none", textAlign: "center" }}
          href={linkWhatsApp(textoWhatsApp({ mes: enquete.id, prazo: enquete.prazo }))}
          target="_blank" rel="noreferrer"
        >
          Copiar texto para o WhatsApp
        </a>

        <label className="rot" style={{ marginTop: 16 }}>Por domingo</label>
        {(enquete.domingos || []).map((id) => {
          const ev = eventosPorId?.[id];
          const indisponiveis = respostas.filter((r) => (r.indisponivelEm || []).includes(id));
          return (
            <div className="linha" key={id}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{ev?.tipo || dataPorExtenso(ev?.data || id)}</p>
                <p className="ds">
                  {indisponiveis.length ? `Sem: ${indisponiveis.map((r) => nomeDe(r.id)).join(", ")}` : "Todos disponíveis, até agora"}
                </p>
              </div>
            </div>
          );
        })}

        {naoResponderam.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 16 }}>Ainda não responderam ({naoResponderam.length})</label>
            <p className="ds">{naoResponderam.map((p) => p.nome).join(", ")}</p>
          </>
        )}

        {enquete.estado === "aberta" ? (
          <button className="btn sec full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={fechar}>Encerrar enquete</button>
        ) : (
          <button className="btn sec full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={reabrir}>Reabrir enquete</button>
        )}
        {!aConfirmarExcluir ? (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => setAConfirmarExcluir(true)}>
            Excluir enquete
          </button>
        ) : (
          <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 9 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir esta enquete?</p>
            <p className="ds" style={{ marginTop: 4 }}>Apaga também todas as respostas já dadas.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aEnviar} onClick={excluir}>Excluir</button>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar} onClick={() => setAConfirmarExcluir(false)}>Cancelar</button>
            </div>
          </div>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
