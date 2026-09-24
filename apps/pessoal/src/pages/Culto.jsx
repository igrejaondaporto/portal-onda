import { useEffect, useRef, useState } from "react";
import { podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { MESES, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";
import SheetFeedback from "../components/culto/SheetFeedback";
import ContagemCulto from "../components/ContagemCulto";
import HistoricoContagem from "../components/HistoricoContagem";
import Inventario from "./Inventario";

const SEM_CABECALHO = () => {};

const SUBTITULOS = {
  ordem: "A ordem do culto que o pastor envia",
  feedbacks: "O que ficou registado de cada domingo",
  inventario: "O material da base, sempre atualizado",
  contagem: "Cada número tem o seu próprio significado",
};

/**
 * Quatro coisas que giram à volta do próprio domingo, antes vivendo
 * espalhadas (Contagem no Início, Inventário na sua própria aba,
 * Ordem do culto e Feedbacks nem tinham interface): agrupadas aqui, a
 * pedido do dono do produto — o menu principal fica mais curto e cada
 * uma continua exatamente com a lógica que já tinha (Inventário e
 * Contagem são os mesmos componentes de sempre, só que embrulhados
 * numa subaba em vez de página própria; Ordem do culto e Feedbacks
 * são cópia direta dos componentes de Apoio/Técnica/Backstage/
 * Comunicação, já genéricos por evento).
 */
export default function Culto({
  uid, papel, mes, ano, mudarMes, abaInicial, ativo, definirCabecalho,
  onVerFuncoes, podePublicarCulto, onIrReembolsos, aoVivoGravando,
}) {
  const souLiderBase = papel === "lider_base";
  const podePublicar = souLiderBase && podePublicarCulto;
  const [aba, setAba] = useState(abaInicial ?? "ordem");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [ordens, setOrdens] = useState({});
  const [cardAberto, setCardAberto] = useState(null);
  const [filtroCulto, setFiltroCulto] = useState(null);
  const [sheetFeedback, setSheetFeedback] = useState(null);
  // qual culto a Contagem está a mostrar — a Contagem precisa de
  // poder voltar a um domingo já passado que ainda não foi marcado
  // (pedido 2026-09: "hoje é dia 23/09 e o culto de 20/09 não foi
  // marcado, eu quero marcar essa data"), por isso não usa "quando
  // sirvo a seguir" como as outras subabas — escolhe dentro do
  // próprio mês carregado (eventosMes), com setas para andar entre
  // cultos.
  const [contagemEventoId, setContagemEventoId] = useState(null);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => { setAba(abaInicial ?? "ordem"); }, [abaInicial]);

  useEffect(() => {
    if (!eventosMes.length) return;
    let cancelado = false;
    Promise.all(eventosMes.map((ev) => obterOrdemCulto(ev.id).then((url) => [ev.id, url])))
      .then((pares) => { if (!cancelado) setOrdens(Object.fromEntries(pares)); });
    return () => { cancelado = true; };
  }, [eventosMes]);

  // um único cronograma aberto de cada vez, por defeito o do próximo
  // culto por data (ou o último, se já não houver nenhum por vir este
  // mês) — mas só na primeira vez; depois disso é o clique que manda.
  const escolheuPadrao = useRef(false);
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); setFiltroCulto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    const hoje = hojeISO();
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes]);

  // mesmo padrão de omissão do cardAberto acima (próximo culto do
  // mês, ou o último se já não houver nenhum por vir), só na primeira
  // vez que o mês carrega — depois disso é a seta ‹ › que manda.
  const contagemEscolheuPadrao = useRef(false);
  useEffect(() => { contagemEscolheuPadrao.current = false; }, [mes, ano]);
  useEffect(() => {
    if (contagemEscolheuPadrao.current || !eventosMes.length) return;
    contagemEscolheuPadrao.current = true;
    const hoje = hojeISO();
    setContagemEventoId((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes]);

  // anda para trás/frente dentro dos cultos do mês carregado — troca
  // de mês continua a ser a seta lá em cima (MESES[mes] ‹ ›), esta é
  // só dentro do que já está na lista.
  function moverContagem(delta) {
    const i = eventosMes.findIndex((e) => e.id === contagemEventoId);
    const proximo = eventosMes[i + delta];
    if (proximo) setContagemEventoId(proximo.id);
  }

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: <em>Culto</em>, subtitulo: SUBTITULOS[aba], chips: [] });
  }, [ativo, aba, definirCabecalho]);

  const hoje = hojeISO();

  // A ordem do culto serve para preparar o próximo, não para reler os
  // que já passaram. Com o mês todo na lista, chegar ao domingo 23 no
  // fim de agosto obrigava a rolar por cima de quatro cultos mortos.
  // Os anteriores continuam a um toque — são histórico, não lixo.
  const proximosOrdem = eventosMes.filter((e) => e.data >= hoje);
  const anterioresOrdem = eventosMes.filter((e) => e.data < hoje);
  // Num mês já passado não há "próximos": aí abre nos anteriores, senão
  // navegar para trás dava uma página vazia sem explicação.
  const verAnterioresOrdem = filtroCulto === "anteriores" || (filtroCulto === null && !proximosOrdem.length && anterioresOrdem.length > 0);
  const listaOrdem = verAnterioresOrdem ? anterioresOrdem : proximosOrdem;


  // Feedbacks: só os cultos que já aconteceram (hoje incluído), do mais
  // recente para trás — os 3 últimos, e "Ver mais" para o resto do mês
  // (pedido 2026-09: os domingos que ainda não aconteceram apareciam
  // todos, sempre vazios).
  const [verTodosFeedbacks, setVerTodosFeedbacks] = useState(false);
  useEffect(() => setVerTodosFeedbacks(false), [mes, ano]);
  const cultosFeitos = eventosMes.filter((e) => e.data <= hoje).slice().reverse();
  const feedbacksVisiveis = verTodosFeedbacks ? cultosFeitos : cultosFeitos.slice(0, 3);
  return (
    <>
      <div className="cabecalho" style={{ paddingTop: 14 }}>
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => mudarMes(1)}>›</button>
        </span>
      </div>
      <div className="subtabs">
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>
          Ordem do culto
          {aoVivoGravando && <span className="oc-subtab-alerta" />}
        </button>
        <button data-on={aba === "contagem" ? 1 : 0} onClick={() => setAba("contagem")}>Contagem</button>
        <button data-on={aba === "inventario" ? 1 : 0} onClick={() => setAba("inventario")}>Inventário</button>
        <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
      </div>

      {aba === "ordem" && (
        <div style={{ marginTop: 16 }}>
          {anterioresOrdem.length > 0 && proximosOrdem.length > 0 && (
            <div className="subtabs" style={{ margin: "12px 0 14px", justifyContent: "space-between" }}>
              <button data-on={verAnterioresOrdem ? 1 : 0} onClick={() => setFiltroCulto("anteriores")}>
                Anteriores ({anterioresOrdem.length})
              </button>
              <button data-on={!verAnterioresOrdem ? 1 : 0} onClick={() => setFiltroCulto("proximos")}>
                Próximos ({proximosOrdem.length})
              </button>
            </div>
          )}
          {listaOrdem.length === 0 && (
            <div className="vaz">
              {anterioresOrdem.length ? "Não há mais cultos este mês." : "Ainda não há cultos neste mês."}
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
      )}

      {aba === "feedbacks" && (
        <>
          <p className="nota" style={{ marginTop: 16 }}>
            Depois do culto, o responsável escreve o que correu bem e o que faltou. Fica aqui para toda a base ler.
          </p>
          {feedbacksVisiveis.map((ev) => {
            const pode = podeDistribuir(papel, uid, ev.escala);
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
                      <div style={{ flex: 1 }}><p className="ds">{autorPessoa?.nome ?? "responsável"} · responsável</p></div>
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
          {cultosFeitos.length === 0 && (
            <div className="vaz" style={{ marginTop: 12 }}>Ainda não houve culto este mês.</div>
          )}
          {cultosFeitos.length > 3 && (
            <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setVerTodosFeedbacks((v) => !v)}>
              {verTodosFeedbacks ? "Ver menos" : `Ver mais (${cultosFeitos.length - 3})`}
            </button>
          )}
        </>
      )}

      {aba === "inventario" && (
        <div style={{ marginTop: 16 }}>
          <Inventario uid={uid} papel={papel} ativo={false} definirCabecalho={SEM_CABECALHO} onIrReembolsos={onIrReembolsos} />
        </div>
      )}

      {aba === "contagem" && (
        <div style={{ marginTop: 16 }}>
          {(() => {
            const i = eventosMes.findIndex((e) => e.id === contagemEventoId);
            const eventoContagem = i >= 0 ? eventosMes[i] : null;
            if (!eventoContagem) return <div className="vaz">Sem culto para contar ainda.</div>;
            return (
              <>
                <div className="cabecalho" style={{ marginTop: 0 }}>
                  <button className="calbt" disabled={i <= 0} onClick={() => moverContagem(-1)}>‹</button>
                  <h3 style={{ textAlign: "center", flex: 1 }}>
                    {dataPorExtenso(eventoContagem.data)}
                    {eventoContagem.data === hoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
                  </h3>
                  <button className="calbt" disabled={i >= eventosMes.length - 1} onClick={() => moverContagem(1)}>›</button>
                </div>
                <p className="ds" style={{ textAlign: "center", marginTop: -6, marginBottom: 14 }}>
                  A marcar a contagem deste domingo — usa as setas para voltar a um culto ainda por contar.
                </p>
                <ContagemCulto eventoId={eventoContagem.id} uid={uid} voluntarios={voluntarios} />
              </>
            );
          })()}
          <HistoricoContagem uid={uid} voluntarios={voluntarios} />
        </div>
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
