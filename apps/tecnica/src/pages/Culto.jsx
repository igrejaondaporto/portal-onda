import { useEffect, useRef, useState } from "react";
import { podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { MESES, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetFeedback from "../components/culto/SheetFeedback";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";
import RepertorioCard from "../components/culto/RepertorioCard";

export default function Culto({ uid, papel, mes, ano, mudarMes, abaInicial, ativo, definirCabecalho, onVerFuncoes, podePublicarCulto, aoVivoGravando }) {
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
  const [filtroCulto, setFiltroCulto] = useState(null); // null = decide sozinho
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); setFiltroCulto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    const hoje = hojeISO();
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes]);

  const comFeedback = eventosMes.filter((e) => e.feedback?.texto).length;

  // Repertório (Culto → Repertório): só líder da base ou quem serve
  // na Projeção (titular ou em treino — os dois contam, ver
  // apps/tecnica/CLAUDE.md, "nível por ministério"). Quem monta é a
  // Base Louvor; aqui é só leitura, para saber a ordem e os medleys.
  const eu = voluntarios.find((p) => p.id === uid);
  const souProjecao = !!eu?.ministerios?.projecao;
  const vejoRepertorio = souLiderBase || souProjecao;

  useEffect(() => {
    if (!ativo) return;
    const subtitulos = { ordem: "A ordem do culto que o pastor envia", feedbacks: "O que ficou registado de cada domingo", repertorio: "O que a Louvor vai tocar, montado por ela" };
    definirCabecalho({
      titulo: <em>Culto</em>,
      subtitulo: subtitulos[aba],
      chips: aba === "feedbacks" ? [`${MESES[mes]} ${ano}`, `${comFeedback} de ${eventosMes.length} com feedback`] : [`${MESES[mes]} ${ano}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, mes, eventosMes.length, comFeedback]);

  const hoje = hojeISO();

  // A ordem do culto serve para preparar o próximo, não para reler os
  // que já passaram. Com o mês todo na lista, chegar ao domingo 23 no
  // fim de agosto obrigava a rolar por cima de quatro cultos mortos.
  // Os anteriores continuam a um toque — são histórico, não lixo.
  const proximos = eventosMes.filter((e) => e.data >= hoje);
  const anteriores = eventosMes.filter((e) => e.data < hoje);
  // Num mês já passado não há "próximos": aí abre nos anteriores, senão
  // navegar para trás dava uma página vazia sem explicação.
  const verAnteriores = filtroCulto === "anteriores" || (filtroCulto === null && !proximos.length && anteriores.length > 0);
  const listaOrdem = verAnteriores ? anteriores : proximos;

  return (
    <>
      <div className="cabecalho">
        <div className="subtabs" style={{ margin: 0 }}>
          <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>
            Ordem do culto
            {aoVivoGravando && <span className="tec-subtab-alerta" />}
          </button>
          {vejoRepertorio && (
            <button data-on={aba === "repertorio" ? 1 : 0} onClick={() => setAba("repertorio")}>Repertório</button>
          )}
          <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
        </div>
        <span className="calnav">
          <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => mudarMes(1)}>›</button>
        </span>
      </div>
      <p className="ds" style={{ margin: "6px 0 2px" }}>{MESES[mes]} {ano}</p>

      {aba === "ordem" ? (
        <div style={{ marginTop: 16 }}>
        {anteriores.length > 0 && proximos.length > 0 && (
          <div className="subtabs tec-filtro-culto">
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
      ) : aba === "repertorio" ? (
        <div style={{ marginTop: 16 }}>
        {anteriores.length > 0 && proximos.length > 0 && (
          <div className="subtabs tec-filtro-culto">
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
          <RepertorioCard
            key={ev.id} evento={ev}
            aberto={cardAberto === ev.id} onAbrir={() => setCardAberto(cardAberto === ev.id ? null : ev.id)}
          />
        ))}
        </div>
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
