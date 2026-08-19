import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, funcoesDosMeusMinisterios, meusLugares } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, ouvirEventosDoMes, ouvirBase, ouvirMinisterios, ouvirEquipamentos } from "../lib/painel";
import { ouvirChecklist, marcarFeito, desmarcarFeito, definirFrase, obterMeuEvento } from "../lib/culto";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds } from "../lib/enquetes";
import { dataPorExtenso, eur, nomeCurto, MESES } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Bola from "../components/Bola";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetPassarEquipamento from "../components/inicio/SheetPassarEquipamento";
import SheetResponderEnquete from "../components/SheetResponderEnquete";

const ORDEM_FASE = { pre: 0, durante: 1, pos: 2 };

function ordenarChecklist(lista, checklist) {
  return [...lista].sort((a, b) => {
    const okA = checklist[a.id] ? 1 : 0, okB = checklist[b.id] ? 1 : 0;
    if (okA !== okB) return okA - okB;
    if (ORDEM_FASE[a.fase] !== ORDEM_FASE[b.fase]) return ORDEM_FASE[a.fase] - ORDEM_FASE[b.fase];
    return a.nome.localeCompare(b.nome, "pt");
  });
}

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrCulto, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [eventosMes, setEventosMes] = useState([]);
  const [frase, setFrase] = useState("");
  const [aEditarFrase, setAEditarFrase] = useState(false);
  const [aEnviarFrase, setAEnviarFrase] = useState(false);
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

  useEffect(() => ouvirBase(setBase), []);
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

  useEffect(() => { setFrase(meuEvento?.frase ?? ""); }, [meuEvento?.id, meuEvento?.frase]);

  const sirvo = !!meuEvento && (meuEvento.escala.pessoas || []).includes(uid);
  const meusLugaresHoje = meuEvento ? meusLugares(meuEvento.escala, uid) : [];
  const souAprendiz = meusLugaresHoje.some((l) => l.aprendizId === uid);
  const minhas = meuEvento ? funcoesDosMeusMinisterios(funcoes, meuEvento.id, meuEvento.escala, uid) : [];
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:30";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);

  function fecharAvisoReembolso() {
    marcarReembolsoVisto(reembolsoIndeferido.id).catch(() => {});
  }

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome ?? "";
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome;

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

  async function guardarFrase() {
    if (!meuEvento) return;
    setAEnviarFrase(true);
    try {
      const fraseGuardada = frase.trim();
      await definirFrase(meuEvento.id, fraseGuardada);
      setMeuEvento((ev) => ({ ...ev, frase: fraseGuardada }));
      setAEditarFrase(false);
      torrada("A tua equipa vai ver isto no Início");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAEnviarFrase(false);
    }
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
        {souLiderBase ? (
          aEditarFrase ? (
            <div className="caixa">
              <textarea
                className="campo" rows={3} value={frase} onChange={(e) => setFrase(e.target.value)}
                placeholder="Uma frase curta que os anima antes de começar"
              />
              <button className="btn full" style={{ marginTop: 12 }} disabled={aEnviarFrase} onClick={guardarFrase}>Guardar</button>
              <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => { setAEditarFrase(false); setFrase(meuEvento.frase ?? ""); }}>
                Cancelar
              </button>
            </div>
          ) : meuEvento.frase ? (
            <div className="frase">
              <p className="cap" style={{ color: "rgba(10,15,46,.6)" }}>A tua palavra para a equipa</p>
              <p className="txt" style={{ marginTop: 8 }}>{meuEvento.frase}</p>
              <button
                className="btn sec" style={{ marginTop: 14, padding: "9px 16px", fontSize: 13, background: "rgba(10,15,46,.09)", color: "var(--tinta)" }}
                onClick={() => setAEditarFrase(true)}
              >
                Alterar
              </button>
            </div>
          ) : (
            <div className="convite" onClick={() => setAEditarFrase(true)}>
              <p className="cap">Domingo, {dataPorExtenso(meuEvento.data)}</p>
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 7, letterSpacing: "-.03em" }}>Deixa uma palavra à tua equipa</p>
              <p className="ds" style={{ marginTop: 5 }}>Aparece no Início de todos os que servem contigo.</p>
            </div>
          )
        ) : meuEvento.frase ? (
          <div className="frase">
            <p className="txt">“{meuEvento.frase}”</p>
            <p className="aut">líder da base · {dataPorExtenso(meuEvento.data)}</p>
          </div>
        ) : null}

        {souAprendiz && (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="ds">
              📝 Estás em treino hoje com{" "}
              {meusLugaresHoje.filter((l) => l.aprendizId === uid).map((l) => nomeDe(l.titularId)).filter(Boolean).join(" e ")}
              {" "}— acompanha e pergunta.
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
          {ministerios.some((m) => (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id)?.titularId && m.id !== meusLugaresHoje[0]?.ministerioId) ? (
            ministerios.map((m) => {
              const lugar = (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id);
              if (!lugar?.titularId || meusLugaresHoje.some((l) => l.ministerioId === m.id)) return null;
              const titular = voluntarios.find((p) => p.id === lugar.titularId);
              const aprendiz = lugar.aprendizId ? voluntarios.find((p) => p.id === lugar.aprendizId) : null;
              if (!titular) return null;
              return (
                <LinhaPessoaContacto
                  key={m.id} pessoa={titular}
                  resumo={`${m.nome}${aprendiz ? ` · com ${aprendiz.nome} em treino` : ""}`}
                  corMinisterio={m.cor}
                  aberta={contactoAberto === titular.id}
                  onToggle={() => setContactoAberto((a) => (a === titular.id ? null : titular.id))}
                />
              );
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
