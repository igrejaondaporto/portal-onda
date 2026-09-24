import { useEffect, useRef, useState } from "react";
import { podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { MESES, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetFeedback from "../components/culto/SheetFeedback";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";
import MelhoriasTab from "../components/culto/MelhoriasTab";

export default function Culto({ uid, papel, mes, ano, mudarMes, abaInicial, ativo, definirCabecalho, onVerFuncoes, podePublicarCulto, feedbackAberto, aoVivoGravando }) {
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
  // Próximos/Anteriores na Ordem do culto — mesmo padrão da Técnica
  // (pedido 2026-09: "fazer isso em todas as bases"). null = decide sozinho.
  const [filtroCulto, setFiltroCulto] = useState(null);
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); setFiltroCulto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    const hoje = hojeISO();
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes]);

  const comFeedback = eventosMes.filter((e) => e.escala.feedback?.texto).length;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Culto</em>,
      subtitulo: aba === "ordem"
        ? "A ordem do culto que o pastor envia"
        : aba === "feedbacks" ? "O que ficou registado de cada domingo" : "O que precisa de ser melhorado",
      chips: aba === "ordem" ? [MESES[mes]] : aba === "feedbacks" ? [MESES[mes], `${comFeedback} de ${eventosMes.length} com feedback`] : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, mes, eventosMes.length, comFeedback]);

  const hoje = hojeISO();

  // A ordem do culto serve para preparar o próximo, não para reler os
  // que já passaram — os anteriores continuam a um toque. Num mês já
  // passado (sem próximos) abre sozinho nos anteriores.
  const proximos = eventosMes.filter((e) => e.data >= hoje);
  const anteriores = eventosMes.filter((e) => e.data < hoje);
  const verAnteriores = filtroCulto === "anteriores" || (filtroCulto === null && !proximos.length && anteriores.length > 0);
  const listaOrdem = verAnteriores ? anteriores : proximos;

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>
          Ordem do culto
          {aoVivoGravando && <span className="oc-subtab-alerta" />}
        </button>
        <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
        <button data-on={aba === "melhorias" ? 1 : 0} onClick={() => setAba("melhorias")}>Melhorias</button>
      </div>

      {aba !== "melhorias" && (
        <div className="cabecalho" style={{ paddingTop: 14 }}>
          <h3>{MESES[mes]} {ano}</h3>
          <span className="calnav">
            <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
            <button className="calbt" onClick={() => mudarMes(1)}>›</button>
          </span>
        </div>
      )}
      {aba !== "melhorias" && !eventosMes.length && <div className="vaz">Sem cultos marcados neste mês.</div>}

      {aba === "melhorias" ? (
        <MelhoriasTab uid={uid} papel={papel} />
      ) : aba === "ordem" ? (
        <div style={{ marginTop: 16 }}>
        {anteriores.length > 0 && proximos.length > 0 && (
          <div className="subtabs" style={{ margin: "0 0 14px" }}>
            <button data-on={!verAnteriores ? 1 : 0} onClick={() => setFiltroCulto("proximos")}>
              Próximos ({proximos.length})
            </button>
            <button data-on={verAnteriores ? 1 : 0} onClick={() => setFiltroCulto("anteriores")}>
              Anteriores ({anteriores.length})
            </button>
          </div>
        )}
        {listaOrdem.length === 0 && (
          <div className="vaz">
            {anteriores.length ? "Não há mais cultos este mês." : "Ainda não há cultos neste mês."}
          </div>
        )}
        {listaOrdem.map((ev) => (
          <OrdemCultoCard
            key={ev.id} evento={ev} podePublicar={podePublicar}
            aberto={cardAberto === ev.id} onAbrir={() => setCardAberto(cardAberto === ev.id ? null : ev.id)}
            chegada={ev.horaChegada || base?.horaChegada || "08:00"}
            pdfUrlExistente={ordens[ev.id]}
            onPdfEnviado={(eventoId, url) => setOrdens((o) => ({ ...o, [eventoId]: url }))}
            onNotasGuardadas={(eventoId, notas) => setEventosMes((lista) => lista.map((e) => (e.id === eventoId ? { ...e, notas } : e)))}
            onVerFuncoes={onVerFuncoes}
          />
        ))}
        </div>
      ) : (
        <>
          <p className="nota" style={{ marginTop: 16 }}>
            {feedbackAberto
              ? "Depois do culto, qualquer voluntário escreve o que correu bem e o que faltou. Fica aqui para toda a base ler."
              : "Depois do culto, o líder de escala escreve o que correu bem e o que faltou. Fica aqui para toda a base ler."}
          </p>
          {eventosMes.map((ev) => {
            const pode = feedbackAberto || podeDistribuir(papel, uid, ev.escala);
            const autorPessoa = ev.escala.feedback?.autorUid ? voluntarios.find((p) => p.id === ev.escala.feedback.autorUid) : null;
            return (
              <div className="sect" key={ev.id}>
                <div className="cabecalho">
                  <h3>
                    {dataPorExtenso(ev.data)}
                    {ev.data === hoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
                  </h3>
                  {ev.escala.liderEscala && <span className="cap">{voluntarios.find((p) => p.id === ev.escala.liderEscala)?.nome}</span>}
                </div>
                {ev.escala.feedback?.texto ? (
                  <div className="caixa">
                    <p style={{ fontSize: 15, lineHeight: 1.6 }}>{ev.escala.feedback.texto}</p>
                    <div className="linha" style={{ border: 0, padding: "14px 0 0" }}>
                      {autorPessoa && <Avatar pessoa={autorPessoa} tamanho={34} fonte={14} />}
                      <div style={{ flex: 1 }}><p className="ds">{autorPessoa?.nome ?? "alguém da base"}</p></div>
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
              e.id === sheetFeedback ? { ...e, escala: { ...e.escala, feedback: novoTexto ? { texto: novoTexto, autorUid: uid } : null } } : e
            )));
            setSheetFeedback(null);
          }}
        />
      )}
    </>
  );
}
