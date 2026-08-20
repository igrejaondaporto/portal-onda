import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { FASES, ministeriosDaEscala } from "../lib/modelo";
import {
  ouvirVoluntarios, ouvirFuncoes, ouvirBase, ouvirMinisterios, ouvirEquipamentos,
  obterEventosDoMes, reporTodosPins, gerarDomingos, excluirCultoEspecial,
} from "../lib/painel";
import { ouvirEnquetesMontar, obterEventosPorIds } from "../lib/enquetes";
import { MESES, nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import Avatares from "@portal/shared/components/Avatares.jsx";
import Bola from "../components/Bola";
import SheetEscalaMinisterios from "../components/painel/SheetEscalaMinisterios";
import SheetNovoCulto from "../components/painel/SheetNovoCulto";
import SheetExcluirCulto from "@portal/shared/components/SheetExcluirCulto.jsx";
import SheetLigarPessoa from "@portal/shared/components/SheetLigarPessoa.jsx";
import SheetPerguntaLigacao from "@portal/shared/components/SheetPerguntaLigacao.jsx";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SheetFuncao from "../components/painel/SheetFuncao";
import SheetMinisterio from "../components/painel/SheetMinisterio";
import SheetEquipamento from "../components/painel/SheetEquipamento";
import SheetAbrirEnquete from "../components/painel/SheetAbrirEnquete";
import SheetIndisponibilidade from "../components/painel/SheetIndisponibilidade";
import SheetDefinicoesBase from "../components/painel/SheetDefinicoesBase";

export default function PainelLider({ definirCabecalho, aoVoltar }) {
  const torrada = useTorrada();
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [base, setBase] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [enquetes, setEnquetes] = useState([]);
  const [eventosEnquete, setEventosEnquete] = useState({});
  const [eventosMes, setEventosMes] = useState([]);
  const [eventosRef, setEventosRef] = useState({});
  const [sheet, setSheet] = useState(null);
  const [filtroChecklist, setFiltroChecklist] = useState(null);
  const [aConfirmarRepor, setAConfirmarRepor] = useState(false);
  const [aRepor, setARepor] = useState(false);
  const [aGerarDomingos, setAGerarDomingos] = useState(false);

  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }

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
  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => ouvirEnquetesMontar(setEnquetes), []);
  useEffect(() => {
    const ids = [...new Set(enquetes.flatMap((e) => e.domingos || []))];
    const faltam = ids.filter((id) => !eventosEnquete[id]);
    if (!faltam.length) return;
    obterEventosPorIds(faltam).then((novos) => setEventosEnquete((prev) => ({ ...prev, ...novos })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquetes.map((e) => e.id).join(",")]);

  const recarregarMes = useCallback(() => {
    obterEventosDoMes(ano, mes).then(setEventosMes);
  }, [ano, mes]);
  useEffect(() => { recarregarMes(); }, [recarregarMes]);

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
      subtitulo: "Ministérios, escalas e equipamentos",
      chips: [
        `${voluntarios.length} voluntários`,
        `${ministerios.length} ministérios`,
        `${catalogo.length} funções`,
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
          <div className="sect" data-tour="painel-escala-bloco">
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
              const pessoasEscala = (ev.escala.pessoas || []).map(pessoaPorId).filter(Boolean);
              const preenchidos = (ev.escala.lugares || []).filter((l) => l.titularId).length;
              return (
                <div
                  className="linha" style={{ cursor: "pointer" }} key={ev.id}
                  onClick={() => setSheet({ tipo: "escala", eventoId: ev.id })}
                >
                  <div style={{ flex: 1 }}>
                    <p className="nmt">
                      {nomeEvento(ev)}
                      {ev.tipo && <span className="tag esp">especial</span>}
                    </p>
                    <p className="ds">
                      {ministerios.length
                        ? `${preenchidos} de ${ministerios.length} ministérios`
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
              <div className="vaz">Ainda sem ministérios — cria o primeiro.</div>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Voluntários</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "perguntaLigacao" })}>
                Adicionar
              </button>
            </div>
            {voluntarios.map((p) => (
              <div className="linha" key={p.id}>
                <Avatar pessoa={p} tamanho={38} fonte={15} />
                <div style={{ flex: 1 }}>
                  <p className="nmt">{p.nome}{p.cargo && <span className="tag cinz" style={{ marginLeft: 8 }}>{p.cargo}</span>}</p>
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
              <h3>Catálogo de funções</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "funcao", funcaoId: null })}>
                Nova
              </button>
            </div>
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
            {FASES.map(([k, t]) => {
              const doF = catalogo.filter((f) => f.fase === k && (!filtroChecklist || f.ministerioId === filtroChecklist));
              if (!doF.length) return null;
              return (
                <div key={k}>
                  <p className="cap" style={{ padding: "14px 0 4px" }}>{t} · {doF.length}</p>
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
            {especiais.length > 0 && (
              <>
                <div className="cabecalho" style={{ marginTop: 24 }}><h3>Só em cultos específicos</h3></div>
                {Object.entries(especiaisPorEvento).map(([eventoId, fs]) => {
                  const doEvento = filtroChecklist ? fs.filter((f) => f.ministerioId === filtroChecklist) : fs;
                  if (!doEvento.length) return null;
                  const ev = eventosRef[eventoId];
                  const rotulo = ev ? nomeEvento(ev) : eventoId;
                  return (
                    <div key={eventoId}>
                      <p className="cap" style={{ padding: "14px 0 4px" }}>{rotulo} · {doEvento.length}</p>
                      {doEvento.map((f) => (
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
              <h3>Equipamentos</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "equipamento" })}>
                Novo
              </button>
            </div>
            {equipamentos.length ? equipamentos.map((eq) => (
              <div className="linha" key={eq.id}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{eq.nome}</p>
                  <p className="ds">{eq.responsavelId ? `Com ${pessoaPorId(eq.responsavelId)?.nome ?? "alguém"}` : "Sem responsável"}</p>
                </div>
              </div>
            )) : (
              <div className="vaz">Ainda sem equipamentos — o "Passar" fica disponível no Início assim que criares um.</div>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Indisponibilidades</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "abrirEnquete" })}>
                Abrir enquete
              </button>
            </div>
            <p className="ds" style={{ padding: "8px 0 2px" }}>
              "Sugestão automática" (dentro de cada culto, em Escala) usa isto para não sugerir quem está de fora.
            </p>
            {enquetes.length ? enquetes.map((e) => (
              <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "indisponibilidade", enqueteId: e.id })}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{MESES[Number(e.id.split("-")[1]) - 1]} {e.id.split("-")[0]}</p>
                  <p className="ds">{(e.domingos || []).length} cultos</p>
                </div>
                <span className={`tag ${e.estado === "aberta" ? "verd" : "cinz"}`}>{e.estado === "aberta" ? "aberta" : "fechada"}</span>
              </div>
            )) : (
              <div className="vaz">Ainda sem enquetes.</div>
            )}
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
          ministerios={ministeriosDaEscala(ministerios)}
          voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
          onExcluir={(eventoId) => setSheet({ tipo: "excluirCulto", eventoId })}
        />
      )}
      {sheet?.tipo === "excluirCulto" && (
        <SheetExcluirCulto
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
          excluir={excluirCultoEspecial}
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
      {sheet?.tipo === "perguntaLigacao" && (
        <SheetPerguntaLigacao
          onFechar={() => setSheet(null)}
          onNao={() => setSheet({ tipo: "pessoa" })}
          onSim={() => setSheet({ tipo: "ligarPessoa" })}
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
          onDesligarPessoa={() => setSheet({ tipo: "ligarPessoa" })}
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
      {sheet?.tipo === "equipamento" && (
        <SheetEquipamento
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "abrirEnquete" && (
        <SheetAbrirEnquete
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "indisponibilidade" && (
        <SheetIndisponibilidade
          enquete={enquetes.find((e) => e.id === sheet.enqueteId)}
          voluntarios={voluntarios}
          eventosPorId={eventosEnquete}
          onFechar={() => setSheet(null)}
          onMudou={() => {}}
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
