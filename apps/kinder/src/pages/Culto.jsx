import { useEffect, useRef, useState } from "react";
import { podeDistribuir, souLider } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { hojeLocal } from "../lib/kinder";
import { MESES, dataPorExtenso } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetFeedback from "../components/culto/SheetFeedback";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";
import ChecklistSala from "../components/sala/ChecklistSala";
import Inventario from "./Inventario";

const ABAS = [
  ["checklist", "Checklist", "Abrir e fechar a sala"],
  ["inventario", "Inventário", "O material de cada sala — a lista de compras é dos líderes"],
  ["ordem", "Ordem do culto", "A ordem do culto que o pastor envia"],
  ["feedbacks", "Feedbacks", "O que ficou registado de cada domingo"],
];

/** O domingo em si, em sub-abas. Chamadas tem menu próprio (era
 *  sub-aba daqui); Contagem/Ocorrências saiu — a contagem já aparece
 *  direto no Check-in, chamar os pais já é o menu Chamadas. */
export default function Culto({ uid, papel, pessoa, mes, ano, abaInicial, ativo, definirCabecalho, podePublicarCulto, aoVivoGravando, onIrReembolsos }) {
  const lider = souLider(papel);
  const podePublicar = lider && podePublicarCulto;
  const [aba, setAba] = useState(abaInicial ?? "checklist");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [ordens, setOrdens] = useState({});
  const [sheetFeedback, setSheetFeedback] = useState(null);
  const [cardAberto, setCardAberto] = useState(null);
  const hoje = hojeLocal();

  useEffect(() => { setAba(abaInicial ?? "checklist"); }, [abaInicial]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);

  useEffect(() => {
    if (aba !== "ordem" || !eventosMes.length) return;
    let cancelado = false;
    Promise.all(eventosMes.map((ev) => obterOrdemCulto(ev.id).then((url) => [ev.id, url])))
      .then((pares) => { if (!cancelado) setOrdens(Object.fromEntries(pares)); });
    return () => { cancelado = true; };
  }, [eventosMes, aba]);

  const escolheuPadrao = useRef(false);
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes, hoje]);

  useEffect(() => {
    if (!ativo) return;
    const a = ABAS.find(([k]) => k === aba);
    definirCabecalho({ titulo: <em>Culto</em>, subtitulo: a?.[2] ?? "", chips: [MESES[mes]] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, mes]);

  return (
    <>
      <div className="subtabs kin-subtabs">
        {ABAS.map(([k, t]) => (
          <button key={k} data-on={aba === k ? 1 : 0} onClick={() => setAba(k)}>
            {t}
            {k === "ordem" && aoVivoGravando && <span className="oc-subtab-alerta" />}
          </button>
        ))}
      </div>

      {aba === "checklist" && <ChecklistSala uid={uid} papel={papel} pessoa={pessoa} />}
      {aba === "inventario" && (
        <Inventario uid={uid} papel={papel} pessoa={pessoa} ativo={false} definirCabecalho={() => {}} onIrReembolsos={onIrReembolsos} />
      )}
      {aba === "ordem" && (
        <div style={{ marginTop: 16 }}>
          {eventosMes.map((ev) => (
            <OrdemCultoCard
              key={ev.id} evento={ev} podePublicar={podePublicar}
              aberto={cardAberto === ev.id} onAbrir={() => setCardAberto(cardAberto === ev.id ? null : ev.id)}
              chegada={ev.horaChegada || base?.horaChegada || "08:30"}
              pdfUrlExistente={ordens[ev.id]}
              onPdfEnviado={(eventoId, url) => setOrdens((o) => ({ ...o, [eventoId]: url }))}
              onNotasGuardadas={(eventoId, notas) => setEventosMes((l) => l.map((e) => (e.id === eventoId ? { ...e, notas } : e)))}
            />
          ))}
        </div>
      )}

      {aba === "feedbacks" && (
        <>
          <p className="nota" style={{ marginTop: 16 }}>
            Depois do culto, a líder escreve o que correu bem e o que faltou. Fica aqui para toda a base ler.
          </p>
          {eventosMes.map((ev) => {
            const pode = podeDistribuir(papel);
            const autor = ev.escala.feedback?.autorUid ? voluntarios.find((p) => p.id === ev.escala.feedback.autorUid) : null;
            return (
              <div className="sect" key={ev.id}>
                <div className="cabecalho">
                  <h3>
                    {dataPorExtenso(ev.data)}
                    {ev.data === hoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
                  </h3>
                </div>
                {ev.escala.feedback?.texto ? (
                  <div className="caixa">
                    <p style={{ fontSize: 15, lineHeight: 1.6 }}>{ev.escala.feedback.texto}</p>
                    <div className="linha" style={{ border: 0, padding: "14px 0 0" }}>
                      {autor && <Avatar pessoa={autor} tamanho={34} fonte={14} />}
                      <div style={{ flex: 1 }}><p className="ds">{autor?.nome ?? "líder de escala"} · líder de escala</p></div>
                      {pode && <button className="btn sec" style={{ padding: "8px 15px", fontSize: 12.5 }} onClick={() => setSheetFeedback(ev.id)}>Editar</button>}
                    </div>
                  </div>
                ) : (
                  <div className="vaz">
                    Ainda sem feedback deste domingo.
                    {pode && (<><br /><button className="btn sec" style={{ marginTop: 12, padding: "10px 18px", fontSize: 13.5 }} onClick={() => setSheetFeedback(ev.id)}>Escrever feedback</button></>)}
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
            setEventosMes((l) => l.map((e) => (e.id === sheetFeedback ? { ...e, escala: { ...e.escala, feedback: novoTexto ? { texto: novoTexto, autorUid: uid } : null } } : e)));
            setSheetFeedback(null);
          }}
        />
      )}
    </>
  );
}
