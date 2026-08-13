import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { FASES } from "../lib/modelo";
import {
  ouvirVoluntarios, ouvirFuncoes, ouvirBase, ouvirMinisterios,
  obterEventosDoMes, reporTodosPins, gerarDomingos,
} from "../lib/painel";
import { ouvirIndiceWiki } from "../lib/wiki";
import { MESES, dataPorExtenso } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import Avatares from "@portal/shared/components/Avatares.jsx";
import Bola from "../components/Bola";
import SheetEscalaMinisterios from "../components/painel/SheetEscalaMinisterios";
import SheetNovoCulto from "../components/painel/SheetNovoCulto";
import SheetExcluirCulto from "../components/painel/SheetExcluirCulto";
import SheetLigarPessoa from "@portal/shared/components/SheetLigarPessoa.jsx";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SheetFuncao from "../components/painel/SheetFuncao";
import SheetMinisterio from "../components/painel/SheetMinisterio";
import SheetEsqueletoWiki from "../components/painel/SheetEsqueletoWiki";
import SheetDefinicoesBase from "../components/painel/SheetDefinicoesBase";

export default function PainelLider({ baseId, definirCabecalho, aoVoltar }) {
  const torrada = useTorrada();
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  // dezembro › janeiro (e o inverso) passam para o ano seguinte/anterior
  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }
  const [base, setBase] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [wikiItens, setWikiItens] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [eventosRef, setEventosRef] = useState({});
  const [sheet, setSheet] = useState(null);
  const [filtroChecklist, setFiltroChecklist] = useState(null); // null = todos os ministérios
  const [aConfirmarRepor, setAConfirmarRepor] = useState(false);
  const [aRepor, setARepor] = useState(false);
  const [aGerarDomingos, setAGerarDomingos] = useState(false);

  const anoQueVem = hoje.getFullYear() + 1;
  async function gerarDomingosDoAnoQueVem() {
    setAGerarDomingos(true);
    try {
      const r = await gerarDomingos(anoQueVem);
      torrada(`${r.criados} domingos de ${anoQueVem} criados`);
    } catch (e) {
      torrada(e.message || "Não foi possível criar os domingos.");
    } finally {
      setAGerarDomingos(false);
    }
  }

  async function reporTodosOsCodigos() {
    setARepor(true);
    try {
      const r = await reporTodosPins();
      torrada(`${r.repostos} códigos repostos`);
      setAConfirmarRepor(false);
    } catch (e) {
      torrada(e.message || "Não foi possível repor os códigos.");
    } finally {
      setARepor(false);
    }
  }

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirIndiceWiki(setWikiItens), []);

  const recarregarMes = useCallback(() => {
    obterEventosDoMes(ano, mes).then(setEventosMes);
  }, [ano, mes]);
  useEffect(() => { recarregarMes(); }, [recarregarMes]);

  // funções só de um culto podem apontar para qualquer data — vai buscar
  // só as que faltam, para conseguir escrever o nome do culto no catálogo
  useEffect(() => {
    const ids = [...new Set(funcoes.filter((f) => f.eventoId).map((f) => f.eventoId))];
    const faltam = ids.filter((id) => !eventosRef[id]);
    if (!faltam.length) return;
    Promise.all(
      faltam.map((id) => getDoc(doc(db, `eventos/${id}`)).then((s) => [id, s.exists() ? s.data() : { data: id }]))
    ).then((pares) => setEventosRef((prev) => ({ ...prev, ...Object.fromEntries(pares) })));
  }, [funcoes, eventosRef]);

  const catalogo = funcoes.filter((f) => !f.eventoId);
  const especiais = funcoes.filter((f) => f.eventoId);
  const especiaisPorEvento = especiais.reduce((acc, f) => {
    (acc[f.eventoId] ||= []).push(f);
    return acc;
  }, {});

  useEffect(() => {
    definirCabecalho({
      titulo: "Painel do líder",
      subtitulo: "Ministérios, escalas e checklists",
      chips: [
        `${voluntarios.length} voluntários`,
        `${ministerios.length} ministérios`,
        `${catalogo.length} na checklist`,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voluntarios.length, ministerios.length, catalogo.length]);

  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);

  return (
    <>
      <button className="sair" style={{ marginTop: 0 }} onClick={aoVoltar}>‹ Início</button>

      <div className="duas">
        <div>
          <div className="sect">
            <div className="cabecalho">
              <h3>Escala de {MESES[mes]} {ano}</h3>
              <span className="calnav">
                <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
                <button className="calbt" onClick={() => mudarMes(1)}>›</button>
              </span>
            </div>
            <p className="ds" style={{ padding: "8px 0 2px" }}>
              Os domingos são criados sozinhos. Falta dizer o titular e o aprendiz de cada ministério.
            </p>
            {eventosMes.map((ev) => {
              const pessoasEscala = ev.escala.pessoas.map(pessoaPorId).filter(Boolean);
              const lider = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
              const preenchidos = (ev.escala.lugares || []).filter((l) => l.titularId).length;
              return (
                <div
                  className="linha" style={{ cursor: "pointer" }} key={ev.id}
                  onClick={() => setSheet({ tipo: "escala", eventoId: ev.id })}
                >
                  <div style={{ flex: 1 }}>
                    <p className="nmt">
                      {ev.tipo || dataPorExtenso(ev.data)}
                      {ev.tipo && <span className="tag esp">especial</span>}
                    </p>
                    <p className="ds">
                      {ministerios.length
                        ? `${preenchidos} de ${ministerios.length} ministérios · ${lider ? lider.nome + " lidera" : "líder por definir"}`
                        : "Cria os ministérios antes de montar a escala"}
                    </p>
                  </div>
                  {pessoasEscala.length ? <Avatares pessoas={pessoasEscala.slice(0, 4)} /> : <span className="tag cinz">definir</span>}
                  <span className="seta">›</span>
                </div>
              );
            })}
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setSheet({ tipo: "novoCulto" })}>
              Adicionar culto especial
            </button>
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Ministérios</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "ministerio", ministerioId: null })}>
                Novo
              </button>
            </div>
            {ministerios.length ? ministerios.map((m) => (
              <div className="linha" key={m.id}>
                <span className="bola" style={{ width: 34, height: 34, background: m.cor }} />
                <div style={{ flex: 1 }}>
                  <p className="nmt">{m.nome}</p>
                  <p className="ds">
                    {voluntarios.filter((p) => p.ministerios?.[m.id] === "titular").length} titular(es) ·{" "}
                    {voluntarios.filter((p) => p.ministerios?.[m.id] === "aprendiz").length} em treino
                  </p>
                </div>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => setSheet({ tipo: "ministerio", ministerioId: m.id })}>
                  Editar
                </button>
              </div>
            )) : (
              <div className="vaz">Ainda sem ministérios — cria o Áudio, Iluminação, Projeção…</div>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Voluntários</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "pessoa", pessoaId: null })}>
                Adicionar
              </button>
            </div>
            {voluntarios.map((p) => (
              <div className="linha" key={p.id}>
                <Avatar pessoa={p} tamanho={38} fonte={15} />
                <div style={{ flex: 1 }}>
                  <p className="nmt">{p.nome}</p>
                  <p className="ds">
                    {p.papel === "lider_base" ? "Líder da base · 6 dígitos" : "Voluntário · 4 dígitos"}
                    {ministerios.length > 0 && (() => {
                      const niveis = ministerios
                        .filter((m) => p.ministerios?.[m.id])
                        .map((m) => `${m.nome} (${p.ministerios[m.id] === "titular" ? "titular" : "em treino"})`);
                      return niveis.length ? ` · ${niveis.join(", ")}` : " · sem ministério";
                    })()}
                  </p>
                </div>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => setSheet({ tipo: "pessoa", pessoaId: p.id })}>
                  Editar
                </button>
              </div>
            ))}
            {!aConfirmarRepor ? (
              <button
                className="btn sec full" style={{ marginTop: 14, color: "var(--magenta)" }}
                onClick={() => setAConfirmarRepor(true)}
              >
                Repor todos os códigos
              </button>
            ) : (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Repor o código de toda a gente?</p>
                <p className="ds" style={{ marginTop: 4 }}>
                  Volta a 1234 para voluntários e 123456 para líder da base. Ninguém entra até usar o código novo.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aRepor} onClick={reporTodosOsCodigos}>
                    {aRepor ? "A repor…" : "Repor tudo"}
                  </button>
                  <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aRepor} onClick={() => setAConfirmarRepor(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="sect">
            <div className="cabecalho">
              <h3>Checklists</h3>
              <button
                className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} disabled={!ministerios.length}
                onClick={() => setSheet({ tipo: "funcao", funcaoId: null })}
              >
                Nova
              </button>
            </div>
            {!ministerios.length && <div className="vaz">Cria os ministérios primeiro.</div>}
            {ministerios.length > 1 && (
              <div className="subtabs" style={{ marginTop: 0 }}>
                <button data-on={filtroChecklist === null ? 1 : 0} onClick={() => setFiltroChecklist(null)}>Todos</button>
                {ministerios.map((m) => (
                  <button key={m.id} data-on={filtroChecklist === m.id ? 1 : 0} onClick={() => setFiltroChecklist(m.id)}>
                    {m.nome}
                  </button>
                ))}
              </div>
            )}
            {ministerios.filter((m) => !filtroChecklist || m.id === filtroChecklist).map((m) => {
              const doMinisterio = catalogo.filter((f) => f.ministerioId === m.id);
              if (!doMinisterio.length) return null;
              return (
                <div key={m.id}>
                  <p className="cap" style={{ padding: "14px 0 4px", color: m.cor }}>{m.nome} · {doMinisterio.length}</p>
                  {FASES.map(([k, t]) => {
                    const doF = doMinisterio.filter((f) => f.fase === k);
                    if (!doF.length) return null;
                    return (
                      <div key={k}>
                        <p className="ds" style={{ padding: "6px 0 2px" }}>{t}</p>
                        {doF.map((f) => (
                          <div className="linha" style={{ cursor: "pointer" }} key={f.id} onClick={() => setSheet({ tipo: "funcao", funcaoId: f.id })}>
                            <Bola funcao={f} tamanho={34} />
                            <div style={{ flex: 1 }}>
                              <p className="nmt" style={{ fontSize: 15 }}>{f.nome}</p>
                              <p className="ds">{f.descricao ? (f.foto ? "Com foto" : "Sem foto") : "Falta a explicação"}</p>
                            </div>
                            <span className="seta">›</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {especiais.length > 0 && (
              <>
                <div className="cabecalho" style={{ marginTop: 24 }}><h3>Só em cultos específicos</h3></div>
                {Object.entries(especiaisPorEvento).map(([eventoId, todasFs]) => {
                  const fs = filtroChecklist ? todasFs.filter((f) => f.ministerioId === filtroChecklist) : todasFs;
                  if (!fs.length) return null;
                  const ev = eventosRef[eventoId];
                  const rotulo = ev ? (ev.tipo ? `${ev.tipo} · ${dataPorExtenso(ev.data)}` : dataPorExtenso(ev.data)) : eventoId;
                  return (
                    <div key={eventoId}>
                      <p className="cap" style={{ padding: "14px 0 4px" }}>{rotulo} · {fs.length}</p>
                      {fs.map((f) => (
                        <div className="linha" style={{ cursor: "pointer" }} key={f.id} onClick={() => setSheet({ tipo: "funcao", funcaoId: f.id })}>
                          <Bola funcao={f} tamanho={34} />
                          <div style={{ flex: 1 }}>
                            <p className="nmt" style={{ fontSize: 15 }}>{f.nome}</p>
                            <p className="ds">{f.descricao ? "com explicação" : "falta a explicação"}</p>
                          </div>
                          <span className="seta">›</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Wiki</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "esqueletoWiki" })}>
                Criar esqueleto
              </button>
            </div>
            <p className="ds" style={{ padding: "8px 0 2px" }}>
              {wikiItens.length} publicados · {wikiItens.filter((w) => w.esqueleto).length} por escrever
            </p>
            {wikiItens.filter((w) => w.esqueleto).map((w) => (
              <div className="linha" key={w.id}>
                <div style={{ flex: 1 }}><p className="nmt">{w.titulo}</p></div>
                <span className="tag cinz">por escrever</span>
              </div>
            ))}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Definições da base</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "definicoesBase" })}>
                Editar
              </button>
            </div>
            <div className="linha">
              <div style={{ flex: 1 }}><p className="nmt">Hora de chegada</p><p className="ds">Igual em todos os domingos</p></div>
              <span className="tag cinz">{base?.horaChegada ?? "—"}</span>
            </div>
            <div className="linha">
              <div style={{ flex: 1 }}><p className="nmt">Hora do culto</p><p className="ds">{base?.nome ?? "—"}</p></div>
              <span className="tag cinz">{base?.horaCulto ?? "—"}</span>
            </div>
            <div className="linha">
              <div style={{ flex: 1 }}>
                <p className="nmt">Domingos de {anoQueVem}</p>
                <p className="ds">Os cultos não se criam sozinhos de um ano para o outro — gera aqui perto do fim de {ano}.</p>
              </div>
              <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} disabled={aGerarDomingos} onClick={gerarDomingosDoAnoQueVem}>
                {aGerarDomingos ? "A criar…" : "Gerar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {sheet?.tipo === "escala" && (
        <SheetEscalaMinisterios
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
          ministerios={ministerios}
          voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
          onExcluir={(eventoId) => setSheet({ tipo: "excluirCulto", eventoId })}
        />
      )}
      {sheet?.tipo === "excluirCulto" && (
        <SheetExcluirCulto
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
          onFechar={() => setSheet(null)}
          onVoltar={(eventoId) => setSheet({ tipo: "escala", eventoId })}
          onExcluido={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "novoCulto" && (
        <SheetNovoCulto
          ano={ano} mes={mes}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "pessoa" && (
        <SheetPessoa
          pessoa={sheet.pessoaId ? pessoaPorId(sheet.pessoaId) : null}
          ministerios={ministerios}
          pessoaExistente={sheet.pessoaExistente}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onRemover={(pessoaId) => setSheet({ tipo: "removerPessoa", pessoaId })}
          onLigarPessoa={() => setSheet({ tipo: "ligarPessoa" })}
          onDesligarPessoa={() => setSheet({ tipo: "pessoa" })}
        />
      )}
      {sheet?.tipo === "ligarPessoa" && (
        <SheetLigarPessoa
          onFechar={() => setSheet({ tipo: "pessoa" })}
          onEscolhida={(pessoaExistente) => setSheet({ tipo: "pessoa", pessoaExistente })}
        />
      )}
      {sheet?.tipo === "removerPessoa" && (
        <SheetRemoverPessoa
          pessoa={pessoaPorId(sheet.pessoaId)}
          onFechar={() => setSheet(null)}
          onVoltar={(pessoaId) => setSheet({ tipo: "pessoa", pessoaId })}
          onRemovido={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "funcao" && (
        <SheetFuncao
          funcao={sheet.funcaoId ? funcoes.find((f) => f.id === sheet.funcaoId) : null}
          ministerios={ministerios}
          eventosDisponiveis={eventosMes}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "ministerio" && (
        <SheetMinisterio
          ministerio={sheet.ministerioId ? ministerios.find((m) => m.id === sheet.ministerioId) : null}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "esqueletoWiki" && (
        <SheetEsqueletoWiki
          ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "definicoesBase" && (
        <SheetDefinicoesBase
          base={base}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
