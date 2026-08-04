import { useEffect, useState } from "react";
import { podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, obterEventosDoMes } from "../lib/painel";
import { obterOrdemCulto, enviarOrdemCulto } from "../lib/culto";
import { MESES, dataPorExtenso, hojeISO } from "../lib/data";
import { useTorrada } from "../lib/TorradaContext";
import Avatar from "../components/Avatar";
import SheetFeedback from "../components/culto/SheetFeedback";

export default function Culto({ uid, papel, mes, ano, abaInicial, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [aba, setAba] = useState(abaInicial ?? "ordem");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ordens, setOrdens] = useState({});
  const [aEnviarPdf, setAEnviarPdf] = useState(null);
  const [sheetFeedback, setSheetFeedback] = useState(null);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => { obterEventosDoMes(ano, mes).then(setEventosMes); }, [ano, mes]);

  useEffect(() => {
    if (!eventosMes.length) return;
    let cancelado = false;
    Promise.all(eventosMes.map((ev) => obterOrdemCulto(ev.id).then((url) => [ev.id, url])))
      .then((pares) => { if (!cancelado) setOrdens(Object.fromEntries(pares)); });
    return () => { cancelado = true; };
  }, [eventosMes]);

  const comFeedback = eventosMes.filter((e) => e.feedback?.texto).length;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Culto",
      subtitulo: aba === "ordem" ? "A ordem do culto que o pastor envia" : "O que ficou registado de cada domingo",
      chips: aba === "ordem" ? [MESES[mes]] : [MESES[mes], `${comFeedback} de ${eventosMes.length} com feedback`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, mes, eventosMes.length, comFeedback]);

  async function escolherPdf(eventoId, ficheiro) {
    if (ficheiro.type !== "application/pdf") return torrada("Tem de ser um PDF.");
    setAEnviarPdf(eventoId);
    try {
      const url = await enviarOrdemCulto(eventoId, ficheiro);
      setOrdens((o) => ({ ...o, [eventoId]: url }));
      torrada("Ficheiro subido — a base foi avisada");
    } catch (e) {
      torrada(e.message || "Não foi possível subir o ficheiro.");
    } finally {
      setAEnviarPdf(null);
    }
  }

  const hoje = hojeISO();

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>Ordem do culto</button>
        <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
      </div>

      {aba === "ordem" ? (
        eventosMes.map((ev) => (
          <div className="sect" key={ev.id}>
            <div className="cabecalho">
              <h3>{ev.tipo || dataPorExtenso(ev.data)}</h3>
              {ordens[ev.id] ? <span className="tag verd">Disponível</span> : <span className="tag cinz">À espera</span>}
            </div>
            {ordens[ev.id] ? (
              <a className="linha" href={ordens[ev.id]} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="bola" style={{ background: "var(--violeta)" }}>▤</span>
                <div style={{ flex: 1 }}><p className="nmt">Ordem do culto</p><p className="ds">Abrir PDF</p></div>
                <span className="seta">›</span>
              </a>
            ) : (
              <div className="vaz">O líder costuma subir o ficheiro à quinta-feira.</div>
            )}
            {souLiderBase && (
              <>
                <input
                  type="file" accept="application/pdf" id={`pdf-${ev.id}`} style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) escolherPdf(ev.id, f); }}
                />
                <button
                  className="btn sec" style={{ marginTop: 12, padding: "10px 18px", fontSize: 13.5 }}
                  disabled={aEnviarPdf === ev.id}
                  onClick={() => document.getElementById(`pdf-${ev.id}`).click()}
                >
                  {aEnviarPdf === ev.id ? "A enviar…" : ordens[ev.id] ? "Substituir ficheiro" : "Subir ficheiro"}
                </button>
              </>
            )}
          </div>
        ))
      ) : (
        <>
          <p className="nota" style={{ marginTop: 16 }}>
            Depois do culto, o líder de escala escreve o que correu bem e o que faltou. Fica aqui para toda a base ler.
          </p>
          {[...eventosMes].reverse().map((ev) => {
            const pode = podeDistribuir(papel, uid, ev.escala);
            const autorPessoa = ev.feedback?.autorUid ? voluntarios.find((p) => p.id === ev.feedback.autorUid) : null;
            return (
              <div className="sect" key={ev.id}>
                <div className="cabecalho">
                  <h3>
                    {dataPorExtenso(ev.data)}
                    {ev.data === hoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
                  </h3>
                  {ev.escala.liderEscala && <span className="cap">{voluntarios.find((p) => p.id === ev.escala.liderEscala)?.nome}</span>}
                </div>
                {ev.feedback?.texto ? (
                  <div className="caixa">
                    <p style={{ fontSize: 15, lineHeight: 1.6 }}>{ev.feedback.texto}</p>
                    <div className="linha" style={{ border: 0, padding: "14px 0 0" }}>
                      {autorPessoa && <Avatar pessoa={autorPessoa} tamanho={34} fonte={14} />}
                      <div style={{ flex: 1 }}><p className="ds">{autorPessoa?.nome ?? "líder de escala"} · líder de escala</p></div>
                      {pode && (
                        <button className="btn sec" style={{ padding: "8px 15px", fontSize: 12.5 }} onClick={() => setSheetFeedback(ev.id)}>
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="vaz">
                    Ainda sem feedback deste domingo.
                    {pode && (
                      <>
                        <br />
                        <button className="btn sec" style={{ marginTop: 12, padding: "10px 18px", fontSize: 13.5 }} onClick={() => setSheetFeedback(ev.id)}>
                          Escrever feedback
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {sheetFeedback && (
        <SheetFeedback
          evento={eventosMes.find((e) => e.id === sheetFeedback)}
          onFechar={() => setSheetFeedback(null)}
          onGuardado={(novoTexto) => {
            setEventosMes((lista) => lista.map((e) => (
              e.id === sheetFeedback ? { ...e, feedback: novoTexto ? { texto: novoTexto, autorUid: uid } : null } : e
            )));
            setSheetFeedback(null);
          }}
        />
      )}
    </>
  );
}
