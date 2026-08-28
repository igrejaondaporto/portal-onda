import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, funcoesDosMeusMinisterios, meusLugares } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, ouvirEventosDoMes, ouvirBase, ouvirMinisterios, ouvirEquipamentos } from "../lib/painel";
import { ouvirChecklist, marcarFeito, desmarcarFeito, obterMeuEvento } from "../lib/culto";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds } from "../lib/enquetes";
import { ouvirTransferenciasPendentes, aceitarTransferencia, recusarTransferencia, ouvirSolicitacoes, assumirSolicitacao } from "../lib/solicitacoes";
import { dataPorExtenso, eur, nomeCurto, MESES } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Bola from "../components/Bola";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetPassarEquipamento from "../components/inicio/SheetPassarEquipamento";
import SheetResponderEnquete from "../components/SheetResponderEnquete";

/** A checklist é espelho de Funções — mesma ordem (o líder reordena
 *  lá, com as setas ↑/↓), nunca outra. A lista já chega ordenada por
 *  "ordem" (ver ouvirFuncoes em lib/painel.js), então aqui só falta
 *  mandar quem já está feito para o fim — sort é estável, por isso
 *  preserva a ordem de Funções dentro de cada grupo (feitas / por
 *  fazer). Já existiu uma versão que ordenava por fase + nome — foi
 *  removida por quebrar o espelho. */
function ordenarChecklist(lista, checklist) {
  return [...lista].sort((a, b) => (checklist[a.id] ? 1 : 0) - (checklist[b.id] ? 1 : 0));
}

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrCulto, onIrReembolsos, onIrSolicitacoes }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [eventosMes, setEventosMes] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [meusReembolsos, setMeusReembolsos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [aPassar, setAPassar] = useState(null); // itemId
  const [contactoAberto, setContactoAberto] = useState(null);
  const [verChecklistToda, setVerChecklistToda] = useState(false);
  const [enquetesAbertas, setEnquetesAbertas] = useState([]);
  const [minhasRespostas, setMinhasRespostas] = useState({}); // { [mes]: resposta|null }
  const [eventosEnquete, setEventosEnquete] = useState({});
  const [aResponderEnquete, setAResponderEnquete] = useState(false);
  const [transferencias, setTransferencias] = useState([]);
  const [aResponderTransferencia, setAResponderTransferencia] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [aAssumir, setAAssumir] = useState(false);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirTransferenciasPendentes(uid, setTransferencias), [uid]);
  useEffect(() => ouvirSolicitacoes(setSolicitacoes), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => ouvirEnquetesAbertas(setEnquetesAbertas), []);
  useEffect(() => {
    const paragens = enquetesAbertas.map((e) =>
      ouvirMinhaResposta(e.id, uid, (r) => setMinhasRespostas((m) => ({ ...m, [e.id]: r })))
    );
    return () => paragens.forEach((p) => p());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquetesAbertas.map((e) => e.id).join(","), uid]);
  useEffect(() => {
    const ids = [...new Set(enquetesAbertas.flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosEnquete({}); return; }
    obterEventosPorIds(ids).then(setEventosEnquete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquetesAbertas.map((e) => e.id).join(",")]);

  // a escala do culto que vamos mostrar no Início tem de ser ao vivo — se
  // o líder mudar quem serve, não é preciso refresh.
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null, lugares: [] };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
  }, [meuEvento?.id]);
  useEffect(() => {
    if (!souLiderBase) return;
    return ouvirReembolsos(true, uid, (lista) => setPendentes(lista.filter((r) => r.estado === "submetido")));
  }, [souLiderBase, uid]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusReembolsos), [uid]);

  useEffect(() => {
    if (!meuEvento) return;
    return ouvirChecklist(meuEvento.id, setChecklist);
  }, [meuEvento?.id]);

  const sirvo = !!meuEvento && (meuEvento.escala.pessoas || []).includes(uid);
  const meusLugaresHoje = meuEvento ? meusLugares(meuEvento.escala, uid) : [];
  // "em treino" continua a ser uma etiqueta da pessoa (pessoa.ministerios),
  // não do lugar na escala — a escala em si já não distingue titular/aprendiz.
  const meuMinisterioHoje = meusLugaresHoje[0]?.ministerioId;
  const souAprendiz = !!meuMinisterioHoje && pessoa?.ministerios?.[meuMinisterioHoje] === "aprendiz";
  const colegasDeHoje = souAprendiz
    ? (meusLugaresHoje[0]?.pessoas || [])
      .filter((id) => id !== uid)
      .map((id) => voluntarios.find((p) => p.id === id)?.nome)
      .filter(Boolean)
    : [];
  const minhas = meuEvento ? funcoesDosMeusMinisterios(funcoes, meuEvento.id, meuEvento.escala, uid) : [];
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:30";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);

  function fecharAvisoReembolso() {
    marcarReembolsoVisto(reembolsoIndeferido.id).catch(() => {});
  }

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome ?? "";

  // Solicitações em fila — dois avisos diferentes no Início:
  // 1) o líder vê as que ainda não têm ministério nem pessoa nenhuma
  //    (por triar); 2) qualquer um vê as que já apontam para ele —
  //    de propósito (designadoParaId) ou porque o ministério dele foi
  //    escolhido sem pessoa específica. Some da lista assim que
  //    alguém assume (responsavelId passa a existir).
  const emFila = solicitacoes.filter((s) => s.status === "fila" && !s.responsavelId && !s.transferePendente);
  const porTriar = emFila.filter((s) => !s.ministerioId && !s.designadoParaId);
  const minhaPessoa = voluntarios.find((p) => p.id === uid);
  const paraMim = emFila.filter((s) =>
    s.designadoParaId === uid || (s.ministerioId && !s.designadoParaId && minhaPessoa?.ministerios?.[s.ministerioId])
  );

  function assumirDoInicio(id) {
    setAAssumir(true);
    assumirSolicitacao(id)
      .then(() => torrada("Assumiste este pedido"))
      .catch((e) => torrada(e.message || "Não foi possível assumir."))
      .finally(() => setAAssumir(false));
  }

  useEffect(() => {
    if (!ativo) return;
    if (!meuEvento) {
      definirCabecalho({ titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>, subtitulo: "", chips: [] });
      return;
    }
    definirCabecalho({
      titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>,
      subtitulo: sirvo
        ? (meuEvento.tipo ? `Serves no ${meuEvento.tipo}, ${dataPorExtenso(meuEvento.data)}` : `Serves no domingo, ${dataPorExtenso(meuEvento.data)}`)
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)}`,
      chips: sirvo
        ? [`Chegada ${chegada}`, meusLugaresHoje.length ? nomeMinisterio(meusLugaresHoje[0].ministerioId) : "Ministério por definir"]
        : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, meusLugaresHoje.length, chegada]);

  function alternarFeito(funcaoId) {
    if (!meuEvento) return;
    const escrita = checklist[funcaoId] ? desmarcarFeito(meuEvento.id, funcaoId) : marcarFeito(meuEvento.id, funcaoId, uid);
    escrita.catch((e) => torrada(e.message || "Não foi possível atualizar."));
  }

  async function aceitar(id) {
    setAResponderTransferencia(true);
    try { await aceitarTransferencia(id); torrada("Ficaste responsável por este pedido"); }
    catch (e) { torrada(e.message || "Não foi possível aceitar."); }
    finally { setAResponderTransferencia(false); }
  }
  async function recusar(id) {
    setAResponderTransferencia(true);
    try { await recusarTransferencia(id); torrada("Voltou para a fila"); }
    catch (e) { torrada(e.message || "Não foi possível recusar."); }
    finally { setAResponderTransferencia(false); }
  }

  // fica visível até ao prazo, mesmo depois de responder — para quem
  // quiser alterar o voto ainda dentro do prazo do líder. Se o líder
  // abriu dois meses de uma vez, as duas contam pra este alerta.
  const hojeISO = new Date().toISOString().slice(0, 10);
  const enquetesDentroDoPrazo = enquetesAbertas.filter((e) => !e.prazo || hojeISO <= e.prazo);
  const carregandoRespostas = enquetesDentroDoPrazo.some((e) => !(e.id in minhasRespostas));
  const todasRespondidas = enquetesDentroDoPrazo.length > 0 && enquetesDentroDoPrazo.every((e) => !!minhasRespostas[e.id]);
  const mesesEnquete = enquetesDentroDoPrazo.map((e) => MESES[Number(e.id.split("-")[1]) - 1]).join(" e ");

  if (!meuEvento) return null;

  return (
    <>
      {transferencias.map((s) => (
        <div className="destaque" style={{ background: "var(--violeta)" }} key={s.id}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{s.transferePendente?.deNome} transferiu-te um pedido</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>{s.titulo}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                className="btn" style={{ padding: "9px 16px", fontSize: 13, background: "#fff", color: "var(--violeta)" }}
                disabled={aResponderTransferencia} onClick={() => aceitar(s.id)}
              >
                Aceitar
              </button>
              <button
                className="btn sec" style={{ padding: "9px 16px", fontSize: 13, background: "rgba(255,255,255,.18)", color: "#fff" }}
                disabled={aResponderTransferencia} onClick={() => recusar(s.id)}
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      ))}
      {souLiderBase && porTriar.length > 0 && (
        <div className="destaque" onClick={() => onIrSolicitacoes?.()}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {porTriar.length} {porTriar.length === 1 ? "pedido novo" : "pedidos novos"} por atribuir
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>{porTriar[0].titulo}</p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {paraMim.map((s) => (
        <div className="destaque" style={{ background: "var(--azul)" }} key={s.id}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
              {s.designadoParaId === uid ? "Um pedido para ti" : `Para ${nomeMinisterio(s.ministerioId)}`}
            </p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>{s.titulo}</p>
            <button
              className="btn" style={{ marginTop: 10, padding: "9px 16px", fontSize: 13, background: "#fff", color: "var(--azul)" }}
              disabled={aAssumir} onClick={() => assumirDoInicio(s.id)}
            >
              Assumir
            </button>
          </div>
        </div>
      ))}
      {enquetesDentroDoPrazo.length > 0 && !carregandoRespostas && (
        <div className="destaque" onClick={() => setAResponderEnquete(true)}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti — indisponibilidades de {mesesEnquete}</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {todasRespondidas ? "Já respondeste — queres alterar?" : "Tens alguma indisponibilidade nesse período?"}
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Prazo até {dataPorExtenso(enquetesDentroDoPrazo[0].prazo)}</p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {souLiderBase && pendentes.length > 0 && (
        <div className="destaque" onClick={() => onIrReembolsos?.()}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {pendentes.length} {pendentes.length === 1 ? "pedido" : "pedidos"} de reembolso
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {voluntarios.find((p) => p.id === pendentes[0].pessoaId)?.nome} · {eur(pendentes[0].valor)}
            </p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {reembolsoIndeferido && (
        <div className="destaque" style={{ background: "var(--magenta)" }} onClick={() => { fecharAvisoReembolso(); onIrReembolsos?.(); }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>O teu pedido de reembolso</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              Indeferido · {eur(reembolsoIndeferido.valor)}
            </p>
            {reembolsoIndeferido.comentarioLider && (
              <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>{reembolsoIndeferido.comentarioLider}</p>
            )}
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
    <div className="duas">
      <div>
        <p className="cap">Domingo, {dataPorExtenso(meuEvento.data)}</p>

        {souAprendiz && (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="ds">
              📝 Estás em treino hoje{colegasDeHoje.length ? ` com ${colegasDeHoje.join(" e ")}` : ""} — acompanha e pergunta.
            </p>
          </div>
        )}

        <div className="blococor" data-tour="checklist-bloco">
          <div className="cabecalho">
            <h3>{meusLugaresHoje.length ? nomeMinisterio(meusLugaresHoje[0].ministerioId) : "As tuas funções"}</h3>
            <span className="cap">{minhas.filter((f) => checklist[f.id]).length}/{minhas.length}</span>
          </div>
          {minhas.length ? (
            (() => {
              const ordenadas = ordenarChecklist(minhas, checklist);
              const visiveis = verChecklistToda ? ordenadas : ordenadas.slice(0, 3);
              return (
                <>
                  {visiveis.map((f) => {
                    const ok = !!checklist[f.id];
                    return (
                      <div
                        className={`linha${ok ? " feita" : ""}`} key={f.id} style={{ cursor: "pointer" }}
                        onClick={() => alternarFeito(f.id)}
                      >
                        <button className={`chk${ok ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternarFeito(f.id); }}>✓</button>
                        <div style={{ flex: 1 }}>
                          <p className="nmt">{f.nome}</p>
                          <p className="ds">
                            {ok
                              ? `Feito às ${checklist[f.id].hora}`
                              : (f.descricao || "").slice(0, 52) + ((f.descricao || "").length > 52 ? "…" : "")}
                          </p>
                        </div>
                        <Bola funcao={f} tamanho={34} />
                      </div>
                    );
                  })}
                  {ordenadas.length > 3 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerChecklistToda((v) => !v)}>
                      {verChecklistToda ? "Ver menos" : `Ver mais (${ordenadas.length - 3})`}
                    </button>
                  )}
                </>
              );
            })()
          ) : (
            <div className="vaz" style={{ border: 0 }}>
              {sirvo ? "Este ministério ainda não tem funções." : "Ainda não estás escalado neste domingo."}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="sect" data-tour="escala-bloco">
          <div className="cabecalho"><h3>Calendário</h3></div>
          <Calendario
            ano={ano} mes={mes} eventosMes={eventosMes} uid={uid}
            onMudarMes={mudarMes}
            onAbrirDia={(eventoId) => onIrEscala?.(eventoId)}
          />
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Servem contigo</h3></div>
          {ministerios.some((m) => (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id)?.pessoas?.length && m.id !== meusLugaresHoje[0]?.ministerioId) ? (
            ministerios.map((m) => {
              const lugar = (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id);
              if (!lugar?.pessoas?.length || meusLugaresHoje.some((l) => l.ministerioId === m.id)) return null;
              const pessoasDoLugar = lugar.pessoas.map((id) => voluntarios.find((p) => p.id === id)).filter(Boolean);
              if (!pessoasDoLugar.length) return null;
              return pessoasDoLugar.map((p) => (
                <LinhaPessoaContacto
                  key={p.id} pessoa={p}
                  resumo={m.nome}
                  corMinisterio={m.cor}
                  aberta={contactoAberto === p.id}
                  onToggle={() => setContactoAberto((a) => (a === p.id ? null : p.id))}
                />
              ));
            })
          ) : (
            <div className="vaz">Ninguém mais escalado ainda.</div>
          )}
        </div>
        {equipamentos.length > 0 && (
          <div className="sect">
            <div className="cabecalho"><h3>Equipamentos</h3></div>
            {equipamentos.map((eq) => (
              <div className="linha" style={{ cursor: "pointer" }} key={eq.id} onClick={() => setAPassar(eq.id)}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{eq.nome}</p>
                  <p className="ds">
                    {eq.responsavelId ? `Com ${voluntarios.find((p) => p.id === eq.responsavelId)?.nome ?? "alguém"}` : "Sem responsável"}
                  </p>
                </div>
                <span className="tag cinz">Passar</span>
              </div>
            ))}
          </div>
        )}
        <div className="sect">
          <div className="cabecalho"><h3>A base</h3></div>
          {[
            ["culto", "Culto", "Ordem do domingo", () => onIrCulto?.("ordem")],
            ["reembolsos", "Reembolsos", "Nota e valor", () => onIrReembolsos?.()],
          ].map(([k, t, d, ir]) => (
            <div className="linha" style={{ cursor: "pointer" }} key={k} onClick={ir}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{t}</p>
                <p className="ds">{d}</p>
              </div>
              <span className="seta">›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    {aPassar && (
      <SheetPassarEquipamento
        item={equipamentos.find((e) => e.id === aPassar)}
        voluntarios={voluntarios}
        onFechar={() => setAPassar(null)}
        onGuardado={(msg) => { setAPassar(null); torrada(msg); }}
      />
    )}
    {aResponderEnquete && enquetesDentroDoPrazo.length > 0 && (
      <SheetResponderEnquete
        enquetes={enquetesDentroDoPrazo} eventosPorId={eventosEnquete} minhasRespostas={minhasRespostas}
        onFechar={() => setAResponderEnquete(false)}
        onGuardado={(msg) => { setAResponderEnquete(false); torrada(msg); }}
      />
    )}
    </>
  );
}
