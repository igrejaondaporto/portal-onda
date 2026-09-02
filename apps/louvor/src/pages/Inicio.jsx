import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, meusPapeisNoCulto, nomePapel } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterMeuEvento, definirFrase } from "../lib/culto";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirRepertorio } from "../lib/repertorio";
import { ouvirMusicas } from "../lib/biblioteca";
import { dataPorExtenso, eur, nomeCurto } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";

// Referência estável para "sem itens" — ver o mesmo cuidado em
// Repertorio.jsx (comentário lá tem a história completa do bug).
const ITENS_VAZIOS = [];

/** "há X" desde um Timestamp do Firestore — mesmo texto que o
 *  Repertório usa no selo de atualização. */
function haQuanto(ts) {
  if (!ts?.toDate) return "agora mesmo";
  const min = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrCulto, onIrBiblioteca, onIrRepertorio, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLider = papel === "lider_base";
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [repertorio, setRepertorio] = useState(null);
  const [musicas, setMusicas] = useState([]);
  const [frase, setFrase] = useState("");
  const [aEditarFrase, setAEditarFrase] = useState(false);
  const [aEnviarFrase, setAEnviarFrase] = useState(false);
  const [meusReembolsos, setMeusReembolsos] = useState([]);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null); // { tipo: "lista" | "abrir" | "detalhe", solicitacao? }

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusReembolsos), [uid]);
  useEffect(() => ouvirMusicas(setMusicas), []);
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

  useEffect(() => ouvirRepertorio(meuEvento?.id, setRepertorio), [meuEvento?.id]);

  useEffect(() => { setFrase(meuEvento?.frase ?? ""); }, [meuEvento?.id, meuEvento?.frase]);

  const souLiderEscala = !!meuEvento && meuEvento.escala.liderEscala === uid;
  const sirvo = !!meuEvento && (meuEvento.escala.pessoas || []).includes(uid);
  const meusPapeis = meuEvento ? meusPapeisNoCulto(meuEvento.escala, uid).map(nomePapel) : [];
  const liderNome = meuEvento?.escala.liderEscala
    ? voluntarios.find((p) => p.id === meuEvento.escala.liderEscala)?.nome
    : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "07:00";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);
  const itensRep = repertorio?.itens ?? ITENS_VAZIOS;
  const nMusicasRep = itensRep.filter((i) => i.tipo === "musica").length;
  const emCurso = minhasSolicitacoes.filter((s) => s.status !== "entregue" && s.status !== "recusada").length;

  // Prévia simplificada do repertório — ordem, nome, artista, e um
  // medley colado ao número da música que "puxa" (mesma regra de
  // numerosOrdinais em Repertorio.jsx: uma continuação de medley não
  // avança o número, só se junta ao bloco anterior).
  const musicaPorId = Object.fromEntries(musicas.map((m) => [m.id, m]));
  const blocosRepertorio = [];
  itensRep.forEach((item, i) => {
    if (item.tipo !== "musica") return;
    const continuaMedley = item.medley === true && itensRep[i - 1]?.tipo === "musica";
    const entrada = { m: musicaPorId[item.musicaId], observacaoMedley: item.observacaoMedley || null };
    if (continuaMedley && blocosRepertorio.length) {
      blocosRepertorio.at(-1).itens.push(entrada);
    } else {
      blocosRepertorio.push({ numero: blocosRepertorio.length + 1, itens: [entrada] });
    }
  });

  function fecharAvisoReembolso() {
    marcarReembolsoVisto(reembolsoIndeferido.id).catch(() => {});
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
        ? `Serves no domingo, ${dataPorExtenso(meuEvento.data)}`
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)}`,
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

  if (!meuEvento) return null;

  return (
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

        {/* Fundo azul (mesmo .blococor de "O teu papel" abaixo) pra ler
          * como uma área à parte, não mais um .sect branco igual aos
          * outros — pedido do líder depois de ver o mesmo bloco na
          * Técnica. Os itens dentro ficam brancos (.rep-mini-item),
          * senão desapareciam contra o próprio fundo do cartão. */}
        <div className="blococor" data-tour="repertorio-bloco" onClick={() => onIrRepertorio?.()} style={{ cursor: "pointer" }}>
          <div className="cabecalho">
            <h3>Repertório de {dataPorExtenso(meuEvento.data)}</h3>
            <span className="seta">›</span>
          </div>
          {repertorio ? (
            <>
              <p className="ds">{nMusicasRep} {nMusicasRep === 1 ? "música" : "músicas"} no repertório · atualizado {haQuanto(repertorio.atualizadoEm)}</p>
              {blocosRepertorio.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {blocosRepertorio.map((b) => (
                    <div key={b.numero}>
                      {b.itens.map((it, i) => {
                        const medleyTopo = i === 0 && b.itens.length > 1;
                        const medleyCauda = i > 0;
                        return (
                          <div key={i}>
                            <div className={`rep-mini-item${medleyTopo ? " medley-topo" : ""}${medleyCauda ? " medley-cauda" : ""}`}>
                              <span className="rep-num">{b.numero}ª</span>
                              <div
                                className="bib-capa"
                                style={it.m?.capaUrl ? { backgroundImage: `url(${it.m.capaUrl})` } : {}}
                              >
                                {!it.m?.capaUrl && (it.m?.titulo?.[0]?.toUpperCase() ?? "?")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="nmt">
                                  {it.m?.titulo ?? "Música removida"}
                                  {medleyCauda && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
                                </p>
                                <p className="ds">{it.m?.artista ?? ""}</p>
                              </div>
                            </div>
                            {medleyCauda && it.observacaoMedley && (
                              <div className="rep-medley-obs" style={{ margin: "0 0 8px" }}>"{it.observacaoMedley}"</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="vaz" style={{ border: 0 }}>Ainda ninguém montou o repertório deste domingo.</div>
          )}
        </div>

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
          </div>
        )}
      </div>

      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Calendário</h3></div>
          <Calendario
            ano={ano} mes={mes} eventosMes={eventosMes} uid={uid}
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
                  resumo={nomePapel(e.papel)}
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
    </>
  );
}
