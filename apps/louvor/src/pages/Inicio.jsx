import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, meusPapeisNoCulto, nomePapel, emojiPapel, souLiderOuAuxiliar } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterMeuEvento, definirFrase } from "../lib/culto";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirMusicas } from "../lib/biblioteca";
import { ouvirAvisos, tempoRestante, percentagemDecorrida } from "../lib/avisos";
import { ouvirConfirmacao, ouvirConfirmacoesDoMes } from "../lib/confirmacao";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds, tempoRestanteVoto, percentagemDecorridaVoto } from "../lib/enquetes";
import { diasAte, fraseDiasAte } from "../lib/aniversarios";
import { dataPorExtenso, dataCurta, eur, nomeCurto } from "@portal/shared/lib/data.js";
import { nomeTipoCulto, tipoCultoDefault } from "@portal/shared/lib/tipoCulto.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";
import SheetAniversarios from "../components/painel/SheetAniversarios";
import SheetConfirmarPresenca from "../components/SheetConfirmarPresenca";
import SheetResponderEnquete from "../components/SheetResponderEnquete";

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrCulto, onIrBiblioteca, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLider = souLiderOuAuxiliar(papel);
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [musicas, setMusicas] = useState([]);
  const [frase, setFrase] = useState("");
  const [aEditarFrase, setAEditarFrase] = useState(false);
  const [aEnviarFrase, setAEnviarFrase] = useState(false);
  const [meusReembolsos, setMeusReembolsos] = useState([]);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null); // { tipo: "lista" | "abrir" | "detalhe", solicitacao? }
  const [avisos, setAvisos] = useState([]);
  const [sheetAniversarios, setSheetAniversarios] = useState(false);
  const [minhaResposta, setMinhaResposta] = useState(null); // {resposta, justificativa?} | null
  const [confirmadosMes, setConfirmadosMes] = useState(() => new Map());
  const [sheetConfirmar, setSheetConfirmar] = useState(false);
  const [enquetesAbertas, setEnquetesAbertas] = useState([]);
  const [minhasRespostasEnquete, setMinhasRespostasEnquete] = useState({});
  const [eventosEnquetePorId, setEventosEnquetePorId] = useState({});
  const [sheetEnquete, setSheetEnquete] = useState(false);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusReembolsos), [uid]);
  useEffect(() => ouvirMusicas(setMusicas), []);
  useEffect(() => ouvirAvisos(setAvisos), []);
  useEffect(() => {
    if (!souLider) return;
    return ouvirMinhasSolicitacoes(setMinhasSolicitacoes);
  }, [souLider]);

  // a escala do culto que vamos mostrar no Início tem de ser ao vivo
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null, escalados: [] };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuEvento?.id]);

  useEffect(() => { setFrase(meuEvento?.frase ?? ""); }, [meuEvento?.id, meuEvento?.frase]);

  const souLiderEscala = !!meuEvento && meuEvento.escala.liderEscala === uid;
  const sirvo = !!meuEvento && (meuEvento.escala.pessoas || []).includes(uid);

  // confirmação de presença — só depois de a escala do próprio culto
  // estar publicada é que faz sentido perguntar (ver lib/confirmacao.js)
  useEffect(() => {
    if (!sirvo || !meuEvento?.escala.publicado) { setMinhaResposta(null); return; }
    return ouvirConfirmacao(meuEvento.id, uid, setMinhaResposta);
  }, [sirvo, meuEvento?.id, meuEvento?.escala.publicado, uid]);

  // o mesmo, mas para todos os cultos do mês visível no Calendário —
  // um listener por culto onde a pessoa está escalada e publicado
  useEffect(() => ouvirConfirmacoesDoMes(eventosMes, uid, setConfirmadosMes), [eventosMes, uid]);

  // enquete de indisponibilidade — o popup obrigatório (EnqueteAutoStart,
  // ver Sessao.jsx) já força a primeira resposta; este balão fica fixo
  // aqui para dar para alterar o voto até ao prazo do líder, e é onde
  // "Não sei ainda" no popup manda a pessoa depois.
  useEffect(() => ouvirEnquetesAbertas(setEnquetesAbertas), []);
  useEffect(() => {
    if (!enquetesAbertas.length) { setMinhasRespostasEnquete({}); return; }
    const paragens = enquetesAbertas.map((e) =>
      ouvirMinhaResposta(e.id, uid, (r) => setMinhasRespostasEnquete((s) => ({ ...s, [e.id]: r })))
    );
    return () => paragens.forEach((p) => p());
  }, [enquetesAbertas, uid]);
  useEffect(() => {
    const ids = [...new Set(enquetesAbertas.flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosEnquetePorId({}); return; }
    obterEventosPorIds(ids).then(setEventosEnquetePorId);
  }, [enquetesAbertas]);

  const meusPapeis = meuEvento
    ? meusPapeisNoCulto(meuEvento.escala, uid).map((id) => `${emojiPapel(id)} ${nomePapel(id)}`)
    : [];
  const liderNome = meuEvento?.escala.liderEscala
    ? voluntarios.find((p) => p.id === meuEvento.escala.liderEscala)?.nome
    : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "07:00";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);
  const emCurso = minhasSolicitacoes.filter((s) => s.status !== "entregue" && s.status !== "recusada").length;
  const proximoAniversario = voluntarios
    .filter((p) => p.aniversario)
    .map((p) => ({ pessoa: p, dias: diasAte(p.aniversario) }))
    .sort((a, b) => a.dias - b.dias)[0] ?? null;

  function fecharAvisoReembolso() {
    marcarReembolsoVisto(reembolsoIndeferido.id).catch(() => {});
  }

  useEffect(() => {
    if (!ativo) return;
    if (!meuEvento) {
      definirCabecalho({ titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>, subtitulo: "", chips: [] });
      return;
    }
    const tipoCulto = nomeTipoCulto(meuEvento.tipoCulto || tipoCultoDefault(meuEvento.data));
    definirCabecalho({
      titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>,
      subtitulo: sirvo
        ? `Serves no domingo, ${dataPorExtenso(meuEvento.data)} · ${tipoCulto}`
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)} · ${tipoCulto}`,
      chips: sirvo
        ? [`Chegada ${chegada}`, `Líder de escala · ${liderNome ?? "por definir"}`, ...meusPapeis]
        : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, liderNome, meusPapeis.join(","), chegada]);

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

  return (
    <>
      {enquetesAbertas.map((e) => {
        const respondeu = !!minhasRespostasEnquete[e.id];
        return (
          <div
            key={e.id} className="destaque" style={{ background: "var(--violeta)", marginBottom: 10, flexWrap: "wrap" }}
            onClick={() => setSheetEnquete(true)}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
                {respondeu ? "Já respondeste — toca para alterar" : "Enquete de indisponibilidade"}
              </p>
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
                Tens alguma indisponibilidade?
              </p>
              {tempoRestanteVoto(e.prazo) && (
                <p style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, marginTop: 3 }}>⏱️ {tempoRestanteVoto(e.prazo)}</p>
              )}
            </div>
            <span style={{ fontSize: 24 }}>🗳️</span>
            {percentagemDecorridaVoto(e.abertaEm, e.prazo) !== null && (
              <>
                <div className="destaque-progresso"><i style={{ width: `${percentagemDecorridaVoto(e.abertaEm, e.prazo)}%` }} /></div>
                <p className="destaque-progresso-data">até {dataCurta(e.prazo)}</p>
              </>
            )}
          </div>
        );
      })}
      {sirvo && meuEvento.escala.publicado && !minhaResposta && (
        <div
          className="destaque" style={{ background: "var(--verde)", marginBottom: 10 }}
          onClick={() => setSheetConfirmar(true)}
        >
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Confirma a tua presença</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              Vais servir {dataPorExtenso(meuEvento.data)}?
            </p>
          </div>
          <span style={{ fontSize: 24 }}>✓</span>
        </div>
      )}
      {avisos.map((a) => (
        <div
          key={a.id} className="destaque"
          style={{ background: a.urgencia === "urgente" ? "var(--magenta)" : "var(--azul)", marginBottom: 10, alignItems: "flex-start", flexWrap: "wrap" }}
        >
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", background: "rgba(255,255,255,.25)", padding: "3px 9px", borderRadius: 100 }}>
              {a.urgencia === "urgente" ? "Urgente" : "Aviso"}
            </span>
            <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, marginTop: 8 }}>{a.texto}</p>
          </div>
          {tempoRestante(a.expiraEm) && (
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, whiteSpace: "nowrap", marginTop: 2 }}>
              ⏱️ {tempoRestante(a.expiraEm)}
            </span>
          )}
          {percentagemDecorrida(a.expiraEm, a.duracaoDias) !== null && (
            <>
              <div className="destaque-progresso"><i style={{ width: `${percentagemDecorrida(a.expiraEm, a.duracaoDias)}%` }} /></div>
              <p className="destaque-progresso-data">até {dataCurta(a.expiraEm.toDate().toISOString().slice(0, 10))}</p>
            </>
          )}
        </div>
      ))}
      {!meuEvento ? null : (
      <>
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
        {souLiderEscala ? (
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
              <p className="cap">És o líder de escala de {dataPorExtenso(meuEvento.data)}</p>
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 7, letterSpacing: "-.03em" }}>Deixa uma palavra à tua equipa</p>
              <p className="ds" style={{ marginTop: 5 }}>Aparece no Início de todos os que servem contigo.</p>
            </div>
          )
        ) : meuEvento.frase ? (
          <div className="frase">
            <p className="txt">“{meuEvento.frase}”</p>
            <p className="aut">{liderNome ?? "líder de escala"} · líder de escala de {dataPorExtenso(meuEvento.data)}</p>
          </div>
        ) : null}

        {sirvo && (
          <div className="blococor">
            <div className="cabecalho">
              <h3>O teu papel</h3>
              <span className="cap">{dataPorExtenso(meuEvento.data)}</span>
            </div>
            {meusPapeis.length ? (
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{meusPapeis.join(" · ")}</p>
            ) : (
              <div className="vaz" style={{ border: 0 }}>
                {liderNome ? `${liderNome} ainda não definiu o teu papel.` : "O líder de escala ainda não foi definido."}
              </div>
            )}
            {meuEvento.escala.publicado && minhaResposta && (
              <div className="confirmado-linha">
                <span style={{ fontSize: 13, fontWeight: 600, color: minhaResposta.resposta === "vai" ? "var(--verde)" : "var(--magenta)" }}>
                  {minhaResposta.resposta === "vai" ? "✓ Vais" : `✗ Avisaste que não vais${minhaResposta.justificativa ? ` — ${minhaResposta.justificativa}` : ""}`}
                </span>
                <button className="btn sec" style={{ padding: "6px 12px", fontSize: 11.5 }} onClick={() => setSheetConfirmar(true)}>
                  Mudar resposta
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Calendário</h3></div>
          <Calendario
            ano={ano} mes={mes} eventosMes={eventosMes} uid={uid}
            confirmados={confirmadosMes}
            onMudarMes={mudarMes}
            onAbrirDia={(eventoId) => onIrEscala?.(eventoId)}
          />
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Servem contigo</h3></div>
          {(meuEvento.escala.escalados || []).filter((e) => e.pessoaId !== uid).length ? (
            (meuEvento.escala.escalados || []).filter((e) => e.pessoaId !== uid).map((e) => {
              const p = voluntarios.find((x) => x.id === e.pessoaId);
              if (!p) return null;
              return (
                <LinhaPessoaContacto
                  key={e.pessoaId} pessoa={p}
                  resumo={`${emojiPapel(e.papel)} ${nomePapel(e.papel)}`}
                  tagExtra={meuEvento.escala.liderEscala === e.pessoaId ? <span className="tag lim">Líder de escala</span> : null}
                  aberta={contactoAberto === e.pessoaId}
                  onToggle={() => setContactoAberto((a) => (a === e.pessoaId ? null : e.pessoaId))}
                />
              );
            })
          ) : (
            <div className="vaz">Ninguém mais escalado ainda.</div>
          )}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>A base</h3></div>
          {[
            ["biblioteca", "Biblioteca", `${musicas.length} ${musicas.length === 1 ? "música" : "músicas"}`, () => onIrBiblioteca?.()],
            ["culto", "Culto", "Ordem e feedback", () => onIrCulto?.("ordem")],
            ...(souLider
              ? [["aniversarios", "Aniversários", proximoAniversario
                    ? `${proximoAniversario.pessoa.nome} · ${fraseDiasAte(proximoAniversario.dias)}`
                    : "Sem datas registadas ainda", () => setSheetAniversarios(true)]]
              : []),
          ].map(([k, t, d, ir]) => (
            <div className="linha" style={{ cursor: "pointer" }} key={k} onClick={ir}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{t}</p>
                <p className="ds">{d}</p>
              </div>
              <span className="seta">›</span>
            </div>
          ))}
          {/* Reembolsos e (para o líder) Solicitar BG só se alcançam por
            * aqui — sem entrada própria na barra de baixo, ao contrário
            * de Biblioteca/Culto acima. Em cor para se distinguirem à
            * vista do resto da lista. */}
          <div className="destaque" style={{ background: "var(--laranja)", marginTop: 14, marginBottom: 0 }} onClick={() => onIrReembolsos?.()}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Reembolsos</p>
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>Nota e valor</p>
            </div>
            <span style={{ fontSize: 24 }}>›</span>
          </div>
          {souLider && (
            <div className="destaque" style={{ background: "var(--violeta)", marginTop: 10, marginBottom: 0 }} onClick={() => setSheetComunicacao({ tipo: "lista" })}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Solicitar BG</p>
                <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>Peças gráficas, vídeo ou fotografia</p>
              </div>
              {emCurso > 0 ? (
                <span style={{ background: "rgba(255,255,255,.25)", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 100, whiteSpace: "nowrap" }}>
                  {emCurso} em curso
                </span>
              ) : (
                <span style={{ fontSize: 24 }}>›</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
      </>
      )}
    {sheetComunicacao?.tipo === "lista" && (
      <SheetSolicitacoesBase
        solicitacoes={minhasSolicitacoes}
        onFechar={() => setSheetComunicacao(null)}
        onNovoPedido={() => setSheetComunicacao({ tipo: "abrir" })}
        onVerDetalhe={(s) => setSheetComunicacao({ tipo: "detalhe", solicitacao: s })}
      />
    )}
    {sheetComunicacao?.tipo === "abrir" && (
      <SheetAbrirSolicitacao
        onFechar={() => setSheetComunicacao({ tipo: "lista" })}
        onGuardado={(msg) => { setSheetComunicacao({ tipo: "lista" }); torrada(msg); }}
      />
    )}
    {sheetComunicacao?.tipo === "detalhe" && (
      <SheetDetalheSolicitacao
        solicitacao={minhasSolicitacoes.find((s) => s.id === sheetComunicacao.solicitacao.id) ?? sheetComunicacao.solicitacao}
        papel={papel}
        onFechar={() => setSheetComunicacao({ tipo: "lista" })}
        onExcluido={() => setSheetComunicacao({ tipo: "lista" })}
      />
    )}
    {sheetAniversarios && (
      <SheetAniversarios voluntarios={voluntarios} onFechar={() => setSheetAniversarios(false)} />
    )}
    {sheetConfirmar && meuEvento && (
      <SheetConfirmarPresenca
        cultos={[meuEvento]}
        minhasRespostas={minhaResposta ? { [meuEvento.id]: minhaResposta } : {}}
        pessoaPorId={(id) => voluntarios.find((p) => p.id === id)}
        onFechar={() => setSheetConfirmar(false)}
        onGuardado={(msg) => { setSheetConfirmar(false); torrada(msg); }}
      />
    )}
    {sheetEnquete && enquetesAbertas.length > 0 && (
      <SheetResponderEnquete
        enquetes={enquetesAbertas}
        eventosPorId={eventosEnquetePorId}
        minhasRespostas={minhasRespostasEnquete}
        onFechar={() => setSheetEnquete(false)}
        onGuardado={(msg) => { setSheetEnquete(false); torrada(msg); }}
      />
    )}
    </>
  );
}
