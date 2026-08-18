import { useEffect, useRef, useState } from "react";
import { podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { MESES, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetFeedback from "../components/culto/SheetFeedback";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";

export default function Culto({ uid, papel, mes, ano, abaInicial, ativo, definirCabecalho, onVerFuncoes, podePublicarCulto }) {
  const souLiderBase = papel === "lider_base";
  const podePublicar = souLiderBase && podePublicarCulto;
  const [aba, setAba] = useState(abaInicial ?? "ordem");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [ordens, setOrdens] = useState({});
  const [sheetFeedback, setSheetFeedback] = useState(null);
  const [cardAberto, setCardAberto] = useState(null);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);

  useEffect(() => {
    if (!eventosMes.length) return;
    let cancelado = false;
    Promise.all(eventosMes.map((ev) => obterOrdemCulto(ev.id).then((url) => [ev.id, url])))
      .then((pares) => { if (!cancelado) setOrdens(Object.fromEntries(pares)); });
    return () => { cancelado = true; };
  }, [eventosMes]);

  // um único cronograma aberto de cada vez, por defeito o do próximo
  // culto por data (ou o último, se já não houver nenhum por vir este
  // mês) — mas só na primeira vez; depois disso é o clique que manda,
  // incluindo fechar tudo ao clicar outra vez na data já aberta
  const escolheuPadrao = useRef(false);
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    const hoje = hojeISO();
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
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

  const hoje = hojeISO();

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>Ordem do culto</button>
        <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
      </div>

      {aba === "ordem" ? (
        eventosMes.map((ev) => (
          <OrdemCultoCard
            key={ev.id} evento={ev} podePublicar={podePublicar}
            aberto={cardAberto === ev.id} onAbrir={() => setCardAberto(cardAberto === ev.id ? null : ev.id)}
            chegada={ev.horaChegada || base?.horaChegada || "08:00"}
            pdfUrlExistente={ordens[ev.id]}
            onPdfEnviado={(eventoId, url) => setOrdens((o) => ({ ...o, [eventoId]: url }))}
            onNotasGuardadas={(eventoId, notas) => setEventosMes((lista) => lista.map((e) => (e.id === eventoId ? { ...e, notas } : e)))}
            onVerFuncoes={onVerFuncoes}
          />
        ))
      ) : (
        <>
          <p className="nota" style={{ marginTop: 16 }}>
            Depois do culto, o líder de escala escreve o que correu bem e o que faltou. Fica aqui para toda a base ler.
          </p>
          {eventosMes.map((ev) => {
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
