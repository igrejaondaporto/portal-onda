import { useCallback, useEffect, useMemo, useState } from "react";
import { ouvirVoluntarios, ouvirBase, obterEventosDoMes, reporTodosPins, gerarDomingos, excluirCultoEspecial } from "../lib/painel";
import { ouvirAvisos, ouvirAvisosModelos, excluirAviso } from "../lib/avisos";
import { nomePapelBase } from "../lib/modelo";
import { MESES, nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import Avatares from "@portal/shared/components/Avatares.jsx";
import SheetEscala from "../components/painel/SheetEscala";
import SheetNovoCulto from "../components/painel/SheetNovoCulto";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SheetDefinicoesBase from "../components/painel/SheetDefinicoesBase";
import SheetAviso from "../components/painel/SheetAviso";
import SecaoEnquetes from "../components/painel/SecaoEnquetes";
import SecaoRascunhos from "../components/painel/SecaoRascunhos";
import SheetLigarPessoa from "@portal/shared/components/SheetLigarPessoa.jsx";
import SheetPerguntaLigacao from "@portal/shared/components/SheetPerguntaLigacao.jsx";
import SheetExcluirCulto from "@portal/shared/components/SheetExcluirCulto.jsx";

export default function PainelLider({ uid, definirCabecalho, aoVoltar }) {
  const torrada = useTorrada();
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [base, setBase] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [avisosModelos, setAvisosModelos] = useState([]);
  const [sheet, setSheet] = useState(null);
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
  useEffect(() => ouvirAvisos(setAvisos), []);
  useEffect(() => ouvirAvisosModelos(setAvisosModelos), []);

  async function apagarAviso(id) {
    try {
      await excluirAviso(id);
      torrada("Aviso removido");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  const recarregarMes = useCallback(() => {
    obterEventosDoMes(ano, mes).then(setEventosMes);
  }, [ano, mes]);
  useEffect(() => { recarregarMes(); }, [recarregarMes]);

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Painel do líder</em>,
      subtitulo: "Escalas, voluntários e definições",
      chips: [`${voluntarios.length} voluntários`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voluntarios.length]);

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
              Os domingos são criados sozinhos. Só falta dizer quem serve, em que papel, e quem lidera.
            </p>
            {eventosMes.map((ev) => {
              const pessoasEscala = (ev.escala.pessoas || []).map(pessoaPorId).filter(Boolean);
              const lider = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
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
                      {pessoasEscala.length
                        ? `${pessoasEscala.length} pessoas · ${lider ? lider.nome + " lidera" : "líder por definir"}`
                        : "Ninguém escalado"}
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

          <SecaoEnquetes voluntarios={voluntarios} />
          <SecaoRascunhos voluntarios={voluntarios} />

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
                  <p className="nmt">{p.nome}</p>
                  <p className="ds">{nomePapelBase(p.papel)} · {p.papel === "voluntario" ? "4" : "6"} dígitos</p>
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

          <div className="sect">
            <div className="cabecalho">
              <h3>Avisos</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "aviso" })}>
                Novo aviso
              </button>
            </div>
            {avisos.length === 0 ? (
              <div className="vaz">Nenhum aviso ativo.</div>
            ) : (
              avisos.map((a) => (
                <div className="linha" key={a.id}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{a.texto}</p>
                    <p className="ds">
                      <span className={`tag ${a.urgencia === "urgente" ? "" : "cinz"}`} style={a.urgencia === "urgente" ? { background: "var(--magenta)", color: "#fff" } : {}}>
                        {a.urgencia === "urgente" ? "urgente" : "normal"}
                      </span>
                      {" "}· {a.duracaoDias} {a.duracaoDias === 1 ? "dia" : "dias"}
                    </p>
                  </div>
                  <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--magenta)" }} onClick={() => apagarAviso(a.id)}>
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="ds" style={{ padding: "0 4px" }}>
            Equipamento (instrumentos e som) gere-se na aba Equipamentos. Músicas e repertório vivem nas abas
            Biblioteca e Repertório.
          </p>
        </div>
      </div>

      {sheet?.tipo === "escala" && (
        <SheetEscala
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
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
      {sheet?.tipo === "aviso" && (
        <SheetAviso
          uid={uid}
          modelos={avisosModelos}
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
