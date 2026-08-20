import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, FASES, funcoesDoCulto } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { ouvirChecklist, ouvirAtribuicoes, marcarFeito, desmarcarFeito, definirFrase, obterMeuEvento } from "../lib/culto";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirInventario } from "../lib/inventario";
import { dataPorExtenso, eur, nomeCurto } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import Avatares from "@portal/shared/components/Avatares.jsx";
import Bola from "../components/Bola";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";

function ordenarPorAtribuicao(lista, atribuicoes, checklist, voluntarios) {
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "";
  const nomesDe = (ids) => [...ids].map(nomeDe).sort((a, b) => a.localeCompare(b, "pt")).join(" e ");
  return [...lista]
    .sort((a, b) => {
      const na = nomesDe(atribuicoes[a.id] || []) || "zzzz";
      const nb = nomesDe(atribuicoes[b.id] || []) || "zzzz";
      return na.localeCompare(nb, "pt") || a.nome.localeCompare(b.nome, "pt");
    })
    .sort((a, b) => (checklist[a.id] ? 1 : 0) - (checklist[b.id] ? 1 : 0));
}

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrInventario, onIrCulto, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [atribuicoes, setAtribuicoes] = useState({});
  const [eventosMes, setEventosMes] = useState([]);
  const [frase, setFrase] = useState("");
  const [aEditarFrase, setAEditarFrase] = useState(false);
  const [aEnviarFrase, setAEnviarFrase] = useState(false);
  const [pendentes, setPendentes] = useState([]);
  const [meusReembolsos, setMeusReembolsos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [checklistAberta, setChecklistAberta] = useState(false);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null); // { tipo: "lista" | "abrir" | "detalhe", solicitacao? }

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusReembolsos), [uid]);

  // a escala do culto que vamos mostrar no Início tem de ser ao vivo — se
  // o líder mudar quem serve ou o líder de escala, não é preciso refresh.
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuEvento?.id]);
  useEffect(() => {
    if (!souLiderBase) return;
    return ouvirReembolsos(true, uid, (lista) => setPendentes(lista.filter((r) => r.estado === "submetido")));
  }, [souLiderBase, uid]);
  useEffect(() => ouvirInventario(setInventario), []);
  useEffect(() => {
    if (!souLiderBase) return;
    return ouvirMinhasSolicitacoes(setMinhasSolicitacoes);
  }, [souLiderBase]);

  useEffect(() => {
    if (!meuEvento) return;
    const p1 = ouvirChecklist(meuEvento.id, setChecklist);
    const p2 = ouvirAtribuicoes(meuEvento.id, setAtribuicoes);
    return () => { p1(); p2(); };
  }, [meuEvento?.id]);

  useEffect(() => { setFrase(meuEvento?.frase ?? ""); }, [meuEvento?.id, meuEvento?.frase]);

  const souLiderEscala = !!meuEvento && meuEvento.escala.liderEscala === uid;
  const sirvo = !!meuEvento && meuEvento.escala.pessoas.includes(uid);
  const funcoesCulto = meuEvento ? funcoesDoCulto(funcoes, meuEvento.id) : [];
  const minhas = funcoesCulto.filter((f) => (atribuicoes[f.id] || []).includes(uid));
  const total = funcoesCulto.length;
  const feitas = Object.keys(checklist).length;
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  const liderNome = meuEvento?.escala.liderEscala
    ? voluntarios.find((p) => p.id === meuEvento.escala.liderEscala)?.nome
    : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:00";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);

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
        ? (meuEvento.tipo ? `Serves no ${meuEvento.tipo}, ${dataPorExtenso(meuEvento.data)}` : `Serves no domingo, ${dataPorExtenso(meuEvento.data)}`)
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)}`,
      chips: sirvo
        ? [`Chegada ${chegada}`, `Líder de escala · ${liderNome ?? "por definir"}`, minhas.length ? `${minhas.length} ${minhas.length === 1 ? "função" : "funções"}` : "Funções por distribuir"]
        : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, liderNome, minhas.length, chegada]);

  // não se espera pela promessa: a marca (ou a limpeza) tem de aparecer já,
  // vinda da cache local — sem rede, a escrita fica pendente e sincroniza
  // sozinha quando ela voltar. Esperar aqui deixaria o toque sem efeito
  // nenhum enquanto a Casa do Povo não tiver sinal.
  function alternarFeito(funcaoId) {
    if (!meuEvento) return;
    const escrita = checklist[funcaoId] ? desmarcarFeito(meuEvento.id, funcaoId) : marcarFeito(meuEvento.id, funcaoId, uid);
    escrita.catch((e) => torrada(e.message || "Não foi possível atualizar."));
  }

  async function marcarTodas(valor) {
    if (!meuEvento) return;
    try {
      funcoesCulto.forEach((f) => {
        (valor ? marcarFeito(meuEvento.id, f.id, uid) : desmarcarFeito(meuEvento.id, f.id))
          .catch((e) => torrada(e.message || "Não foi possível atualizar."));
      });
      torrada(valor ? "Tudo marcado como feito" : "Checklist limpo");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
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

  if (!meuEvento) return null;

  return (
    <>
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

        <div className="blococor" data-tour="checklist-bloco">
          <div className="cabecalho">
            <h3>As tuas funções</h3>
            <span className="cap">{dataPorExtenso(meuEvento.data)}</span>
          </div>
          {minhas.length ? (
            FASES.map(([k, t]) => {
              const doF = ordenarPorAtribuicao(minhas.filter((f) => f.fase === k), atribuicoes, checklist, voluntarios);
              if (!doF.length) return null;
              return (
                <div key={k}>
                  <div className="fasecab"><h4>{t}</h4><em>{doF.filter((f) => checklist[f.id]).length}/{doF.length}</em></div>
                  {doF.map((f) => {
                    const ok = !!checklist[f.id];
                    const outros = (atribuicoes[f.id] || []).filter((id) => id !== uid);
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
                              : outros.length
                                ? `Contigo: ${outros.map((id) => voluntarios.find((p) => p.id === id)?.nome).filter(Boolean).join(" e ")}`
                                : (f.descricao || "").slice(0, 52) + ((f.descricao || "").length > 52 ? "…" : "")}
                          </p>
                        </div>
                        <Bola funcao={f} tamanho={34} />
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="vaz" style={{ border: 0 }}>
              {liderNome ? `${liderNome} ainda não distribuiu as funções deste domingo.` : "O líder de escala ainda não foi definido."}
            </div>
          )}
        </div>

        <div className="sect">
          <div className="cabecalho"><h3>Como está o domingo</h3><span className="cap">{feitas} de {total}</span></div>
          <div className="barra"><i style={{ width: `${pct}%` }} /></div>
          <p className="ds" style={{ marginTop: 10 }}>
            {total === 0 ? "Ainda não há funções para este culto." : feitas === total ? "Está tudo feito. Podem abrir as portas." : `Faltam ${total - feitas} tarefas.`}
          </p>
          {total > 0 && (
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setChecklistAberta((a) => !a)}>
              {checklistAberta ? "Ocultar checklist" : "Ver Checklist do dia"}
            </button>
          )}
          {checklistAberta && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn sec" style={{ flex: 1, padding: "11px 8px", fontSize: 13 }} onClick={() => marcarTodas(true)}>Marcar tudo</button>
                <button className="btn sec" style={{ flex: 1, padding: "11px 8px", fontSize: 13 }} onClick={() => marcarTodas(false)}>Limpar tudo</button>
              </div>
              {FASES.map(([k, t]) => {
                const doF = ordenarPorAtribuicao(funcoesCulto.filter((f) => f.fase === k), atribuicoes, checklist, voluntarios);
                if (!doF.length) return null;
                const fe = doF.filter((f) => checklist[f.id]).length;
                return (
                  <div key={k}>
                    <div className="fasecab"><h4>{t}</h4><em>{fe}/{doF.length}</em></div>
                    {doF.map((f) => {
                      const ok = !!checklist[f.id];
                      const ids = atribuicoes[f.id] || [];
                      return (
                        <div className={`linha${ok ? " feita" : ""}`} key={f.id}>
                          <button className={`chk${ok ? " on" : ""}`} onClick={() => alternarFeito(f.id)}>✓</button>
                          <div style={{ flex: 1 }}>
                            <p className="nmt" style={{ fontSize: 15 }}>{f.nome}</p>
                            <p className="ds">
                              {ok
                                ? `${voluntarios.find((p) => p.id === checklist[f.id].por)?.nome ?? "alguém"} · ${checklist[f.id].hora}`
                                : ids.length
                                  ? ids.map((id) => voluntarios.find((p) => p.id === id)?.nome).filter(Boolean).join(" e ")
                                  : "Por atribuir"}
                            </p>
                          </div>
                          <Avatares pessoas={ids.map((id) => voluntarios.find((p) => p.id === id)).filter(Boolean)} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
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
          {meuEvento.escala.pessoas.filter((id) => id !== uid).length ? (
            meuEvento.escala.pessoas.filter((id) => id !== uid).map((id) => {
              const p = voluntarios.find((x) => x.id === id);
              if (!p) return null;
              const fs = funcoesCulto.filter((f) => (atribuicoes[f.id] || []).includes(id));
              const fe = fs.filter((f) => checklist[f.id]).length;
              return (
                <LinhaPessoaContacto
                  key={id} pessoa={p}
                  resumo={fs.length ? `${fe} de ${fs.length} feitas` : "Sem funções atribuídas"}
                  funcoesDaPessoa={fs}
                  tagExtra={meuEvento.escala.liderEscala === id ? <span className="tag lim">Líder de escala</span> : null}
                  aberta={contactoAberto === id}
                  onToggle={() => setContactoAberto((a) => (a === id ? null : id))}
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
            ["inventario", "Inventário", "Material de limpeza", () => onIrInventario?.()],
            ["culto", "Culto", "Ordem do domingo", () => onIrCulto?.("ordem")],
            ["reembolsos", "Reembolsos", "Nota e valor", () => onIrReembolsos?.()],
            ...(souLiderBase ? [["comunicacao", "Solicitar BG", "Peças gráficas, vídeo ou fotografia", () => setSheetComunicacao({ tipo: "lista" })]] : []),
          ].map(([k, t, d, ir]) => {
            const falta = k === "inventario" ? inventario.filter((i) => i.quantidade < i.minimo).length : 0;
            const emCurso = k === "comunicacao" ? minhasSolicitacoes.filter((s) => s.status !== "entregue" && s.status !== "recusada").length : 0;
            return (
              <div className="linha" style={{ cursor: "pointer" }} key={k} onClick={ir}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{t}</p>
                  <p className="ds">{d}</p>
                </div>
                {falta ? <span className="tag" style={{ marginLeft: "auto" }}>{falta} em falta</span>
                  : emCurso ? <span className="tag" style={{ marginLeft: "auto" }}>{emCurso} em curso</span>
                  : <span className="seta">›</span>}
              </div>
            );
          })}
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
