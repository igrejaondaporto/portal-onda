import { useEffect, useRef, useState } from "react";
import { podeDistribuir, ministeriosDaEscala } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase, ouvirMinisterios } from "../lib/painel";
import { obterOrdemCulto } from "../lib/culto";
import { MESES, dataCurta, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import SheetFeedback from "../components/culto/SheetFeedback";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";

/** Culto reúne as três coisas do domingo num só menu — pedido do
 *  líder: "Escala" (era a aba "Domingo" de Agenda, que deixou de
 *  existir — Solicitações virou menu próprio, Escala mudou-se para
 *  cá), "Ordem do culto" e "Feedbacks". Escala vem primeiro — é a
 *  pergunta mais comum ("quem serve?"), antes de "o que toca?" ou
 *  "como correu?". */
export default function Culto({ uid, papel, mes, ano, mudarMes, abaAlvo, eventoIdFoco, focoSeq, ativo, definirCabecalho, onVerFuncoes, podePublicarCulto, aoVivoGravando }) {
  const souLiderBase = papel === "lider_base";
  const podePublicar = souLiderBase && podePublicarCulto;
  const [aba, setAba] = useState(abaAlvo ?? "escala");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [base, setBase] = useState(null);
  const [ordens, setOrdens] = useState({});
  const [sheetFeedback, setSheetFeedback] = useState(null);
  const [cardAberto, setCardAberto] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [abertos, setAbertos] = useState({}); // que cultos estão abertos, na Escala
  const [contactoAberto, setContactoAberto] = useState(null); // { eventoId, pessoaId }
  const refsEventos = useRef({});

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
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

  // Culto fica montado o tempo todo (só troca de display:none) — sem
  // isto, navegar de novo pra cá (ex.: "Ordem do domingo" no Início,
  // depois de já se ter mudado a sub-aba à mão) ficava preso na
  // última aba tocada, ignorando o alvo. focoSeq muda a cada
  // navegação (mesmo destino ou não), sempre junto com abaAlvo.
  useEffect(() => {
    if (!abaAlvo) return;
    setAba(abaAlvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoSeq]);

  // vir do calendário do Início (aba Escala) tem de abrir o cartão do
  // culto certo, senão a pessoa toca num dia e aterra num cartão
  // fechado, sem perceber porquê. Só existe ref para os cartões
  // enquanto a aba Escala está montada — se veio de Ordem/Feedbacks,
  // o efeito acima ainda muda a aba nesta mesma leva de efeitos, sem
  // o DOM da Escala existir ainda; por isso `aba` também entra nas
  // dependências, para tentar de novo assim que ela virar "escala".
  useEffect(() => {
    if (aba !== "escala" || !eventoIdFoco || !eventosMes.length) return;
    const el = refsEventos.current[eventoIdFoco];
    if (!el) return;
    setAbertos((v) => ({ ...v, [eventoIdFoco]: true }));
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setRealcado(eventoIdFoco);
    const t = setTimeout(() => setRealcado(null), 1600);
    return () => clearTimeout(t);
    // focoSeq muda a cada clique no calendário, mesmo que o culto-alvo seja o mesmo de antes
  }, [eventoIdFoco, focoSeq, eventosMes.length, aba]);

  const comFeedback = eventosMes.filter((e) => e.feedback?.texto).length;
  const temEscala = eventosMes.some((e) => (e.escala.lugares || []).some((l) => l.titularId));

  useEffect(() => {
    if (!ativo) return;
    if (aba === "escala") {
      definirCabecalho({
        titulo: "Culto",
        subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
        chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "08:30"}` : "Escala por definir"],
      });
      return;
    }
    definirCabecalho({
      titulo: "Culto",
      subtitulo: aba === "ordem" ? "A ordem do culto que o pastor envia" : "O que ficou registado de cada domingo",
      chips: aba === "ordem" ? [MESES[mes]] : [MESES[mes], `${comFeedback} de ${eventosMes.length} com feedback`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, mes, eventosMes.length, comFeedback, temEscala, base]);

  const hoje = hojeISO();
  const lugarDe = (ev, ministerioId) => (ev.escala.lugares || []).find((l) => l.ministerioId === ministerioId);
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  // só 3 dos 7 ministérios têm gente escalada na hora do culto — os
  // outros são produção/edição, sem posto ao vivo no domingo (ver
  // ministeriosDaEscala em lib/modelo.js)
  const ministeriosEscala = ministeriosDaEscala(ministerios);
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "escala" ? 1 : 0} onClick={() => setAba("escala")}>Escala</button>
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>
          Ordem do culto
          {aoVivoGravando && <span className="oc-subtab-alerta" />}
        </button>
        <button data-on={aba === "feedbacks" ? 1 : 0} onClick={() => setAba("feedbacks")}>Feedbacks</button>
      </div>

      {aba === "escala" && (
        <>
          <div className="sect" style={{ marginTop: 16 }}>
            <div className="cabecalho">
              <h3>{MESES[mes]} {ano}</h3>
              <span className="calnav">
                <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
                <button className="calbt" onClick={() => mudarMes(1)}>›</button>
              </span>
            </div>
            {temEscala ? (
              <>
                <div className="tabwrap">
                  <table className="tab">
                    <thead>
                      <tr>
                        <th>Ministério</th>
                        {eventosMes.map((ev) => (
                          <th key={ev.id} className={ev.data === hoje ? "hj" : ""}>
                            {dataCurta(ev.data)}{ev.data === hoje ? " · hoje" : ev.data < hoje ? " ✅" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ministeriosEscala.map((m) => (
                        <tr key={m.id} className={m.ordem === 0 ? "lid" : undefined}>
                          <td className="papel"><span className="quadmin" style={{ background: m.cor }} />{m.nome}</td>
                          {eventosMes.map((ev) => {
                            const lugar = lugarDe(ev, m.id);
                            const titular = lugar?.titularId ? pessoaPorId(lugar.titularId) : null;
                            const aprendiz = lugar?.aprendizId ? pessoaPorId(lugar.aprendizId) : null;
                            const souEu = titular?.id === uid || aprendiz?.id === uid;
                            return (
                              <td key={ev.id} className={souEu ? "mim" : ""}>
                                {titular ? titular.nome : "—"}
                                {aprendiz && <span style={{ opacity: 0.7 }}> +{aprendiz.nome}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ds" style={{ marginTop: 12 }}>O teu nome aparece a azul. "+nome" é quem está em treino.</p>
              </>
            ) : (
              <div className="semescala" style={{ marginTop: 16 }}>
                Os {eventosMes.length} cultos já existem, falta dizer quem serve.
              </div>
            )}
          </div>

          {/* Um cartão por culto, fechado. Antes vinham todos abertos com toda
            * a gente dentro: com seis domingos e cinco pessoas em cada, chegar
            * ao último era rolar a página inteira. O mês cabe agora num ecrã, e
            * abre-se só o dia que interessa. */}
          <div className="sect">
            {eventosMes.map((ev) => {
              const souEuNoCulto = (ev.escala.pessoas || []).includes(uid);
              const aberto = !!abertos[ev.id];
              // em que ministério sirvo nesse dia — o Responsável acumula com
              // um operacional, por isso pode ser mais do que um
              const meusMinisterios = ministeriosEscala
                .filter((m) => { const l = lugarDe(ev, m.id); return l?.titularId === uid || l?.aprendizId === uid; })
                .map((m) => m.nome);
              return (
                <CartaoCulto
                  key={ev.id}
                  evento={ev} hoje={hoje} sirvo={souEuNoCulto} aberto={aberto}
                  realcado={realcado === ev.id}
                  refCartao={(el) => { refsEventos.current[ev.id] = el; }}
                  onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
                  resumo={souEuNoCulto
                    ? `Serves${meusMinisterios.length ? ` · ${meusMinisterios.join(" · ")}` : ""}`
                    : `${(ev.escala.pessoas || []).length} pessoas`}
                >
                {ev.tipo && (
                  <p className="ds" style={{ padding: "6px 0 2px" }}>
                    {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
                  </p>
                )}
                {ministeriosEscala.some((m) => lugarDe(ev, m.id)?.titularId) ? (
                  ministeriosEscala.map((m) => {
                    const lugar = lugarDe(ev, m.id);
                    if (!lugar?.titularId) return null;
                    const titular = pessoaPorId(lugar.titularId);
                    const aprendiz = lugar.aprendizId ? pessoaPorId(lugar.aprendizId) : null;
                    return (
                      <div key={m.id}>
                        {titular && (
                          <LinhaPessoaContacto
                            pessoa={titular}
                            resumo={`${m.nome} · titular${titular.id === uid ? " · tu" : ""}`}
                            corMinisterio={m.cor}
                            aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === titular.id}
                            onToggle={() => setContactoAberto((a) =>
                              a?.eventoId === ev.id && a?.pessoaId === titular.id ? null : { eventoId: ev.id, pessoaId: titular.id })}
                          />
                        )}
                        {aprendiz && (
                          <LinhaPessoaContacto
                            pessoa={aprendiz}
                            resumo={`${m.nome} · 📝 em treino${aprendiz.id === uid ? " · tu" : ""}`}
                            corMinisterio={m.cor}
                            aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === aprendiz.id}
                            onToggle={() => setContactoAberto((a) =>
                              a?.eventoId === ev.id && a?.pessoaId === aprendiz.id ? null : { eventoId: ev.id, pessoaId: aprendiz.id })}
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="vaz">Ainda ninguém escalado.</div>
                )}
                {ministeriosEscala.some((m) => lugarDe(ev, m.id)?.titularId) && (
                  <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => onVerFuncoes?.(ev.id)}>
                    Ver as funções deste culto
                  </button>
                )}
                </CartaoCulto>
              );
            })}
          </div>
          <p className="nota">Quem não pode servir avisa pelo WhatsApp. O {nomeLiderBase} atualiza a escala aqui.</p>
        </>
      )}

      {aba === "ordem" && (
        <div style={{ marginTop: 16 }}>
        {eventosMes.map((ev) => (
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
