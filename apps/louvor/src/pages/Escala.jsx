import { useEffect, useRef, useState } from "react";
import { PAPEIS, nomePapel, emojiPapel, nomeCor, podeDistribuir, souLiderOuAuxiliar } from "../lib/modelo";
import { ouvirConfirmacoesPorCulto, ouvirConfirmacoesEnsaioPorCulto } from "../lib/confirmacao";
import { nomeTipoCulto, tipoCultoDefault } from "@portal/shared/lib/tipoCulto.js";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirBase } from "../lib/painel";
import { definirDetalhesCultoLouvor } from "../lib/culto";
import { ouvirRepertorio, agruparItensMedley } from "../lib/repertorio";
import { ouvirMusicas, obterTonsDosItens } from "../lib/biblioteca";
import { MESES, dataCurta, dataPorExtenso, diaSemanaAbrev, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import CalendarioSemanal from "../components/CalendarioSemanal";

/** Cabide — não existe emoji universal para isto, por isso é um ícone
 *  próprio (mesmo padrão de IconeLinkExterno em SheetMusicaDetalhe.jsx). */
function IconeCabide() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a1.5 1.5 0 1 0-1.5 1.5" />
      <path d="M12 4.5V7" />
      <path d="M12 7 3.5 13.5A2 2 0 0 0 3 15a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1 2 2 0 0 0-.5-1.5L12 7Z" />
      <path d="M6 15h12" />
    </svg>
  );
}

// Referência estável para "sem itens" — mesmo cuidado documentado em
// Repertorio.jsx/Inicio.jsx: um `?? []` novo a cada render quebraria
// o useEffect que busca os tons (dependência muda sempre, mesmo sem
// dado novo nenhum).
const ITENS_VAZIOS_REP = [];

/** Quem serve + repertório resumido + roupa/ensaio/observação de um
 *  culto, cada assunto na sua caixinha — só monta quando o cartão
 *  está aberto (é `children` do CartaoCulto). `podeEditar` já vem
 *  calculado (líder da base, auxiliar, ou líder de escala deste
 *  culto, ver podeDistribuir). */
function DetalhesCulto({ evento, musicas, podeEditar, pessoaPorId, confirmados, confirmadosEnsaio, contactoAberto, onToggleContacto }) {
  const torrada = useTorrada();
  const [repertorio, setRepertorio] = useState(null);
  const [tons, setTons] = useState({});
  const [escalaAberta, setEscalaAberta] = useState(false);
  const [aEditar, setAEditar] = useState(false);
  const [cores, setCores] = useState([]);
  const [dataEnsaio, setDataEnsaio] = useState("");
  const [horaEnsaio, setHoraEnsaio] = useState("");
  const [localEnsaio, setLocalEnsaio] = useState("");
  const [observacao, setObservacao] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => ouvirRepertorio(evento.id, setRepertorio), [evento.id]);

  const itensRep = repertorio?.itens ?? ITENS_VAZIOS_REP;
  const blocos = agruparItensMedley(itensRep);
  const musicaPorId = Object.fromEntries(musicas.map((m) => [m.id, m]));

  // Leitura pontual (não onSnapshot) do tom de cada versão do
  // repertório — um listener por música seria demais para algo que
  // quase nunca muda depois de escolhido (ver obterTonsDosItens).
  useEffect(() => {
    let cancelado = false;
    obterTonsDosItens(itensRep).then((mapa) => { if (!cancelado) setTons(mapa); });
    return () => { cancelado = true; };
  }, [itensRep]);

  const coresAtuais = evento.escala.coresRoupa || [];
  const temDetalhes = coresAtuais.length > 0 || !!evento.escala.dataEnsaio || !!evento.escala.horaEnsaio
    || !!evento.escala.localEnsaio || !!evento.escala.observacaoLider;

  function abrirEdicao() {
    setCores(coresAtuais);
    setDataEnsaio(evento.escala.dataEnsaio || "");
    setHoraEnsaio(evento.escala.horaEnsaio || "");
    setLocalEnsaio(evento.escala.localEnsaio || "");
    setObservacao(evento.escala.observacaoLider || "");
    setAEditar(true);
  }

  function adicionarCor() {
    setCores((v) => (v.length >= 3 ? v : [...v, "#0092D4"]));
  }
  function mudarCor(i, valor) {
    setCores((v) => v.map((c, idx) => (idx === i ? valor : c)));
  }
  function removerCor(i) {
    setCores((v) => v.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    setAGuardar(true);
    try {
      await definirDetalhesCultoLouvor(evento.id, {
        coresRoupa: cores, dataEnsaio: dataEnsaio || null,
        horaEnsaio: horaEnsaio || null, localEnsaio, observacao,
      });
      setAEditar(false);
      torrada("Detalhes do culto atualizados");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  const escalados = evento.escala.escalados || [];

  return (
    <>
      <div className="caixinha escala">
        <p
          className="caixinha-titulo" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={() => setEscalaAberta((v) => !v)}
        >
          <span style={{ flex: 1 }}>
            Escala {escalados.length > 0 && `(${escalados.length})`}
          </span>
          <span className="seta">{escalaAberta ? "︿" : "›"}</span>
        </p>
        {escalaAberta && (
          escalados.length ? (
            escalados.map((e) => {
              const p = pessoaPorId(e.pessoaId);
              if (!p) return null;
              return (
                <LinhaPessoaContacto
                  key={e.pessoaId} pessoa={p}
                  resumo={`${emojiPapel(e.papel)} ${nomePapel(e.papel)}`}
                  tagExtra={(
                    <>
                      {evento.escala.liderEscala === e.pessoaId && <span className="tag lim">Líder de escala</span>}
                      {confirmados?.has(e.pessoaId) && <span title="Confirmou presença">👍</span>}
                    </>
                  )}
                  aberta={contactoAberto === e.pessoaId}
                  onToggle={() => onToggleContacto(e.pessoaId)}
                />
              );
            })
          ) : (
            <p className="ds">Ainda ninguém escalado.</p>
          )
        )}
      </div>

      {blocos.length > 0 && (
        <div className="caixinha repertorio">
          <p className="caixinha-titulo">🎵 Repertório</p>
          {blocos.map((b) => (
            <div key={b.numero}>
              {b.itens.map((it, i) => {
                const m = musicaPorId[it.musicaId];
                const medleyCauda = i > 0;
                return (
                  <p key={it.id} className="ds" style={{ margin: "3px 0" }}>
                    {medleyCauda ? "+ " : `${b.numero}. `}
                    {m?.titulo ?? "Música removida"}
                    {m?.artista ? ` · ${m.artista}` : ""}
                    {tons[it.id] ? ` · Tom ${tons[it.id]}` : ""}
                  </p>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {(coresAtuais.length > 0 || podeEditar) && (
        <div className="caixinha roupa">
          <p className="caixinha-titulo"><IconeCabide /> Paleta de Cores:</p>
          {coresAtuais.length > 0 ? (
            <p style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {coresAtuais.map((c, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: c, display: "inline-block", border: "1px solid rgba(10,15,46,.12)" }} />
                  <span className="ds" style={{ fontWeight: 600 }}>{nomeCor(c)}</span>
                </span>
              ))}
            </p>
          ) : (
            <p className="ds">Ainda não definida</p>
          )}
        </div>
      )}

      {(evento.escala.dataEnsaio || podeEditar) && (
        <div className="caixinha ensaio">
          <p className="caixinha-titulo">
            🎙️ <b>Ensaio</b>
            {evento.escala.dataEnsaio && ` - ${diaSemanaAbrev(evento.escala.dataEnsaio)}, ${dataPorExtenso(evento.escala.dataEnsaio)}`}
            {evento.escala.horaEnsaio && ` , ⏰ - ${evento.escala.horaEnsaio}`}
          </p>
          {/* Quem já confirmou o ensaio — mini-fotos numa linha própria,
              abaixo do título (ao lado cortava e não cabia todo mundo),
              nunca uma lista (pedido do líder, "não fica uma lista
              grande"). Ver ouvirConfirmacoesEnsaioPorCulto. */}
          {confirmadosEnsaio?.size > 0 && (
            <div style={{ display: "flex", marginTop: 6 }} title="Já confirmaram o ensaio">
              {[...confirmadosEnsaio].slice(0, 10).map((pessoaId, i) => {
                const p = pessoaPorId(pessoaId);
                return p ? (
                  <span key={pessoaId} style={{ marginLeft: i === 0 ? 0 : -6, border: "2px solid #fff", borderRadius: "50%" }}>
                    <Avatar pessoa={p} tamanho={18} fonte={8} />
                  </span>
                ) : null;
              })}
            </div>
          )}
          {evento.escala.localEnsaio && <p className="ds">📍 {evento.escala.localEnsaio}</p>}
          {!evento.escala.dataEnsaio && <p className="ds">Ainda não marcado</p>}
          <CalendarioSemanal domingoISO={evento.data} ensaioISO={evento.escala.dataEnsaio} />
        </div>
      )}

      {(evento.escala.observacaoLider || podeEditar) && (
        <div className="caixinha obs">
          <p className="caixinha-titulo">💬 Observação</p>
          <p className="ds">{evento.escala.observacaoLider || "Sem observação"}</p>
        </div>
      )}

      {podeEditar && !aEditar && (
        <button className="btn sec full" style={{ marginTop: 8 }} onClick={abrirEdicao}>
          {temDetalhes ? "Editar detalhes" : "+ Cores, ensaio e observação"}
        </button>
      )}

      {aEditar && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <label className="rot"><IconeCabide /> Cores da roupa</label>
          {cores.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                type="color" value={c} onChange={(e) => mudarCor(i, e.target.value)}
                style={{ width: 40, height: 40, border: 0, borderRadius: 8, padding: 0 }}
              />
              <input className="campo" style={{ flex: 1 }} value={c} onChange={(e) => mudarCor(i, e.target.value)} />
              <button className="btn sec" onClick={() => removerCor(i)}>✕</button>
            </div>
          ))}
          {cores.length < 3 && (
            <button className="btn sec full" style={{ marginTop: 8 }} onClick={adicionarCor}>Adicionar cor</button>
          )}
          <label className="rot" style={{ marginTop: 12 }}>🎙️ Data do ensaio — semana de {dataPorExtenso(evento.data)}</label>
          <CalendarioSemanal
            domingoISO={evento.data} ensaioISO={dataEnsaio}
            onSelecionar={(iso) => setDataEnsaio((atual) => (atual === iso ? "" : iso))}
          />
          <label className="rot" style={{ marginTop: 12 }}>⏰ Hora do ensaio</label>
          <input className="campo" type="time" value={horaEnsaio} onChange={(e) => setHoraEnsaio(e.target.value)} />
          <label className="rot" style={{ marginTop: 12 }}>📍 Local do ensaio</label>
          <input
            className="campo" value={localEnsaio} onChange={(e) => setLocalEnsaio(e.target.value)}
            placeholder="Casa do Povo, sala de ensaio…"
          />
          <label className="rot" style={{ marginTop: 12 }}>Observação</label>
          <textarea
            className="campo" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)}
            placeholder="Algum recado para a equipa deste culto"
          />
          <button className="btn full" style={{ marginTop: 14 }} disabled={aGuardar} onClick={guardar}>
            {aGuardar ? "A guardar…" : "Guardar detalhes"}
          </button>
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setAEditar(false)}>Cancelar</button>
        </div>
      )}
    </>
  );
}

export default function Escala({ uid, papel, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho }) {
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [musicas, setMusicas] = useState([]);
  const [base, setBase] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [abertos, setAbertos] = useState({});
  const [contactoAberto, setContactoAberto] = useState(null);
  const [aba, setAba] = useState("minhas");
  const [confirmados, setConfirmados] = useState(() => new Map());
  const [confirmadosEnsaio, setConfirmadosEnsaio] = useState(() => new Map());
  const refsEventos = useRef({});
  const souLider = souLiderOuAuxiliar(papel);

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMusicas(setMusicas), []);
  useEffect(() => ouvirBase(setBase), []);
  // Só o líder/auxiliar vê "quem confirmou" (Escala geral, pedido do
  // líder) — as regras só deixam ler confirmação alheia sendo líder,
  // ver firestore.rules; nem vale a pena montar o listener sem ser.
  useEffect(() => {
    if (!souLider) { setConfirmados(new Map()); return; }
    return ouvirConfirmacoesPorCulto(eventosMes, setConfirmados);
  }, [souLider, eventosMes]);
  useEffect(() => {
    if (!souLider) { setConfirmadosEnsaio(new Map()); return; }
    return ouvirConfirmacoesEnsaioPorCulto(eventosMes, setConfirmadosEnsaio);
  }, [souLider, eventosMes]);

  useEffect(() => {
    if (!eventoIdFoco || !eventosMes.length) return;
    setAba("geral");
    const el = refsEventos.current[eventoIdFoco];
    if (!el) return;
    setAbertos((v) => ({ ...v, [eventoIdFoco]: true }));
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setRealcado(eventoIdFoco);
    const t = setTimeout(() => setRealcado(null), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoIdFoco, focoSeq, eventosMes.length]);

  const temEscala = eventosMes.some((e) => (e.escala.escalados || []).length > 0);
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const hoje = hojeISO();
  const eventosMeus = eventosMes.filter((ev) => (ev.escala.pessoas || []).includes(uid));

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Escala</em>,
      subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
      chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "07:00"}` : "Escala por definir"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventosMes.length, temEscala, mes, base]);

  const escaladosDoPapel = (ev, papelId) => (ev.escala.escalados || []).filter((e) => e.papel === papelId);

  function etiquetaEnfase(ev, mostrarConfirmados) {
    const id = ev.tipoCulto || tipoCultoDefault(ev.data);
    return (
      <>
        <span className="tag cinz" style={{ verticalAlign: "middle", marginLeft: 8 }}>
          {diaSemanaAbrev(ev.data)}
        </span>
        <span className="tag esp" style={{ verticalAlign: "middle", marginLeft: 6 }}>
          {nomeTipoCulto(id)}
        </span>
        {mostrarConfirmados && ev.escala?.publicado && (
          <span className="tag cinz" style={{ verticalAlign: "middle", marginLeft: 6 }}>
            👍 {confirmados.get(ev.id)?.size ?? 0}
          </span>
        )}
      </>
    );
  }

  function CartaoDoCulto({ ev, mostrarConfirmados }) {
    const souEuNoCulto = (ev.escala.pessoas || []).includes(uid);
    const aberto = !!abertos[ev.id];
    return (
      <CartaoCulto
        evento={ev} hoje={hoje} sirvo={souEuNoCulto} aberto={aberto}
        realcado={realcado === ev.id}
        etiqueta={etiquetaEnfase(ev, mostrarConfirmados)}
        refCartao={(el) => { refsEventos.current[ev.id] = el; }}
        onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
        resumo={souEuNoCulto ? "Serves" : `${(ev.escala.pessoas || []).length} pessoas`}
      >
        {ev.tipo && (
          <p className="ds" style={{ padding: "6px 0 2px" }}>
            {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
          </p>
        )}
        <DetalhesCulto
          evento={ev} musicas={musicas} podeEditar={podeDistribuir(papel, uid, ev.escala)}
          pessoaPorId={pessoaPorId}
          confirmados={mostrarConfirmados ? confirmados.get(ev.id) : null}
          confirmadosEnsaio={mostrarConfirmados ? confirmadosEnsaio.get(ev.id) : null}
          contactoAberto={contactoAberto?.eventoId === ev.id ? contactoAberto.pessoaId : null}
          onToggleContacto={(pessoaId) => setContactoAberto((a) =>
            a?.eventoId === ev.id && a?.pessoaId === pessoaId ? null : { eventoId: ev.id, pessoaId })}
        />
      </CartaoCulto>
    );
  }

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "minhas" ? 1 : 0} onClick={() => setAba("minhas")}>Minhas escalas</button>
        <button data-on={aba === "geral" ? 1 : 0} onClick={() => setAba("geral")}>Escala geral</button>
      </div>

      {aba === "minhas" ? (
        <div className="sect" style={{ marginTop: 12 }}>
          <div className="cabecalho">
            <h3>{MESES[mes]} {ano}</h3>
            <span className="calnav">
              <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
              <button className="calbt" onClick={() => mudarMes(1)}>›</button>
            </span>
          </div>
          {eventosMeus.length === 0 ? (
            <div className="vaz" style={{ marginTop: 12 }}>Não estás escalado em nenhum culto este mês.</div>
          ) : (
            eventosMeus.map((ev) => <CartaoDoCulto key={ev.id} ev={ev} />)
          )}
        </div>
      ) : (
        <>
          <div className="sect" style={{ marginTop: 12 }}>
            <div className="cabecalho">
              <h3>{MESES[mes]} {ano}</h3>
              <span className="calnav">
                <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
                <button className="calbt" onClick={() => mudarMes(1)}>›</button>
              </span>
            </div>
            {eventosMes.length === 0 ? (
              <div className="semescala" style={{ marginTop: 16 }}>Sem cultos criados neste mês ainda.</div>
            ) : (
              <>
                {/* A tabela fica sempre pronta, com uma linha por papel
                  * (ver PAPEIS) — antes só aparecia depois de alguém já
                  * estar escalado, e até lá mostrava só um aviso. As
                  * células vêm direto de escalados, por isso já se
                  * atualizam sozinhas quando o líder junta ou tira
                  * alguém (nenhum estado próprio aqui, é sempre o que
                  * está gravado). */}
                {!temEscala && (
                  <div className="semescala" style={{ marginTop: 16, marginBottom: 12 }}>
                    Os {eventosMes.length} cultos já existem, falta dizer quem serve.
                  </div>
                )}
                <div className="tabwrap">
                  <table className="tab">
                    <thead>
                      <tr>
                        <th>Papel</th>
                        {eventosMes.map((ev) => (
                          <th key={ev.id} className={ev.data === hoje ? "hj" : ""}>
                            <span className="tag cinz" style={{ fontSize: 9.5, padding: "1px 6px", marginRight: 4 }}>{diaSemanaAbrev(ev.data)}</span>
                            {dataCurta(ev.data)}{ev.data === hoje ? " · hoje" : ev.data < hoje ? " ✅" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="lid">
                        <td className="papel">Líder de escala</td>
                        {eventosMes.map((ev) => {
                          const p = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
                          return <td key={ev.id} className={p?.id === uid ? "mim" : ""}>{p ? p.nome : "por definir"}</td>;
                        })}
                      </tr>
                      {PAPEIS.map((papelLinha) => (
                        <tr key={papelLinha.id}>
                          <td className="papel"><span className="quadmin" style={{ background: papelLinha.cor }} />{papelLinha.emoji} {papelLinha.nome}</td>
                          {eventosMes.map((ev) => {
                            const nomes = escaladosDoPapel(ev, papelLinha.id).map((e) => pessoaPorId(e.pessoaId)).filter(Boolean);
                            const souEu = nomes.some((p) => p.id === uid);
                            return (
                              <td key={ev.id} className={souEu ? "mim" : ""}>
                                {nomes.length ? nomes.map((p) => p.nome).join(", ") : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ds" style={{ marginTop: 12 }}>O teu nome aparece num box azul. Desliza a tabela se não couber.</p>
              </>
            )}
          </div>

          <div className="sect">
            {eventosMes.map((ev) => <CartaoDoCulto key={ev.id} ev={ev} mostrarConfirmados={souLider} />)}
          </div>
        </>
      )}
    </>
  );
}
