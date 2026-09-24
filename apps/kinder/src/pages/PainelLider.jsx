import { useCallback, useEffect, useMemo, useState } from "react";
import { ouvirVoluntarios, ouvirBase, obterEventosDoMes, reporTodosPins, gerarDomingos, excluirCultoEspecial } from "../lib/painel";
import { CATEGORIAS, minhaSalaRestrita, nomeCategoria, rotuloPapel, varsCategoria, CHECKIN_ATIVO } from "../lib/modelo";
import { linkRegisto } from "../lib/kinder";
import { MESES, nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import Avatares from "@portal/shared/components/Avatares.jsx";
import SheetLigarPessoa from "@portal/shared/components/SheetLigarPessoa.jsx";
import SheetPerguntaLigacao from "@portal/shared/components/SheetPerguntaLigacao.jsx";
import SheetExcluirCulto from "@portal/shared/components/SheetExcluirCulto.jsx";
import SheetEscala from "../components/painel/SheetEscala";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SheetDefinicoesBase from "../components/painel/SheetDefinicoesBase";
import SheetDefinicoesKinder from "../components/painel/SheetDefinicoesKinder";
import CodigoQR from "../components/CodigoQR";

/** Painel das líderes (a geral e as três de sala — as mesmas
 *  permissões). Escala do mês, voluntários por sala, definições.
 *
 *  Restrição por sala: a líder geral (`lider_base`) monta a escala
 *  das três salas; a líder de sala (`auxiliar`) só vê e só monta a
 *  sua — `minhaSala` filtra a lista de voluntários que entra no
 *  SheetEscala, para nunca lhe aparecer (nem deixá-la tocar) gente
 *  de outra sala. */
export default function PainelLider({ papel, pessoa, definirCabecalho, aoVoltar }) {
  const torrada = useTorrada();
  const minhaSala = minhaSalaRestrita(papel, pessoa);
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [base, setBase] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
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
  const recarregarMes = useCallback(() => { obterEventosDoMes(ano, mes).then(setEventosMes); }, [ano, mes]);
  useEffect(() => { recarregarMes(); }, [recarregarMes]);

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Painel do líder</em>,
      subtitulo: "Escalas, voluntários e definições",
      chips: (minhaSala ? CATEGORIAS.filter((c) => c.id === minhaSala) : CATEGORIAS)
        .map((c) => `${c.nome} ${voluntarios.filter((p) => p.categoria === c.id).length}`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voluntarios, minhaSala]);

  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const gruposVisiveis = minhaSala ? CATEGORIAS.filter((c) => c.id === minhaSala) : [...CATEGORIAS, { id: null, nome: "Sem sala" }];

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
            <p className="ds" style={{ padding: "8px 0 2px" }}>Cada pessoa serve na sua sala. Pelo menos dois adultos por sala.</p>
            {eventosMes.map((ev) => {
              const pessoas = ev.escala.pessoas.map(pessoaPorId).filter(Boolean);
              const porSala = CATEGORIAS.map((c) => `${c.nome.slice(0, 1)}${pessoas.filter((p) => p.categoria === c.id).length}`).join(" · ");
              const salasRelevantes = minhaSala ? [minhaSala] : CATEGORIAS.map((c) => c.id);
              const mestrasDefinidas = salasRelevantes.filter((s) => ev.escala.mestras?.[s]).length;
              return (
                <div className="linha" style={{ cursor: "pointer" }} key={ev.id} onClick={() => setSheet({ tipo: "escala", eventoId: ev.id })}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{nomeEvento(ev)}</p>
                    <p className="ds">{pessoas.length ? `${porSala} · ${mestrasDefinidas}/${salasRelevantes.length} mestras definidas` : "Ninguém escalado"}</p>
                  </div>
                  {pessoas.length ? <Avatares pessoas={pessoas.slice(0, 4)} /> : <span className="tag cinz">definir</span>}
                  <span className="seta">›</span>
                </div>
              );
            })}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Voluntários</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "perguntaLigacao" })}>Adicionar</button>
            </div>
            {gruposVisiveis.map((g) => {
              const doGrupo = voluntarios.filter((p) => (p.categoria ?? null) === g.id);
              if (!doGrupo.length) return null;
              return (
                <div key={g.id ?? "sem"}>
                  <p className="rot"><span className="kin-tagcat" style={varsCategoria(g.id)}>{g.nome} · {doGrupo.length}</span></p>
                  {doGrupo.map((p) => (
                    <div className="linha" key={p.id}>
                      <Avatar pessoa={p} tamanho={38} fonte={15} />
                      <div style={{ flex: 1 }}>
                        <p className="nmt">{p.nome}</p>
                        <p className="ds">{rotuloPapel(p.papel, p.categoria)} · {p.papel === "voluntario" ? "4" : "6"} dígitos</p>
                      </div>
                      <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => setSheet({ tipo: "pessoa", pessoaId: p.id })}>Editar</button>
                    </div>
                  ))}
                </div>
              );
            })}
            {!aConfirmarRepor ? (
              <button className="btn sec full" style={{ marginTop: 14, color: "var(--magenta)" }} onClick={() => setAConfirmarRepor(true)}>Repor todos os códigos</button>
            ) : (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Repor o código de toda a gente?</p>
                <p className="ds" style={{ marginTop: 4 }}>Volta a 1234 para voluntários e 123456 para líderes. Ninguém entra até usar o código novo.</p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aRepor} onClick={reporTodosOsCodigos}>{aRepor ? "A repor…" : "Repor tudo"}</button>
                  <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aRepor} onClick={() => setAConfirmarRepor(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          {CHECKIN_ATIVO && (
            <div className="sect">
              <div className="cabecalho"><h3>Registo das famílias</h3></div>
              <p className="ds">Imprime este QR e cola-o na porta do Kinder. Os pais registam-se sozinhos, sem conta.</p>
              <CodigoQR texto={linkRegisto()} rotulo="QR do registo" />
              <p className="ds" style={{ textAlign: "center", wordBreak: "break-all" }}>{linkRegisto()}</p>
              <a
                className="btn sec full" style={{ marginTop: 10, display: "block", textAlign: "center" }}
                href={minhaSala ? `/registo/imprimir?sala=${minhaSala}` : "/registo/imprimir"}
                target="_blank" rel="noreferrer"
              >
                Abrir cartaz para imprimir
              </a>
            </div>
          )}

          <div className="sect">
            <div className="cabecalho">
              <h3>Definições da base</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "definicoesBase" })}>Horas</button>
            </div>
            <div className="linha">
              <div style={{ flex: 1 }}><p className="nmt">Hora de chegada</p><p className="ds">Igual em todos os domingos</p></div>
              <span className="tag cinz">{base?.horaChegada ?? "—"}</span>
            </div>
            <div className="linha" style={{ cursor: "pointer" }} onClick={() => setSheet({ tipo: "definicoesKinder" })}>
              <div style={{ flex: 1 }}><p className="nmt">Idades das salas e consentimento</p><p className="ds">{CATEGORIAS.map((c) => nomeCategoria(c.id)).join(", ")} · texto que os pais aceitam</p></div>
              <span className="seta">›</span>
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
        <SheetEscala
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
          voluntarios={minhaSala ? voluntarios.filter((v) => v.categoria === minhaSala) : voluntarios}
          sala={minhaSala}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
          onExcluir={(eventoId) => setSheet({ tipo: "excluirCulto", eventoId })}
        />
      )}
      {sheet?.tipo === "excluirCulto" && (
        <SheetExcluirCulto
          evento={eventosMes.find((e) => e.id === sheet.eventoId)} excluir={excluirCultoEspecial}
          onFechar={() => setSheet(null)}
          onVoltar={(eventoId) => setSheet({ tipo: "escala", eventoId })}
          onExcluido={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "perguntaLigacao" && (
        <SheetPerguntaLigacao onFechar={() => setSheet(null)} onNao={() => setSheet({ tipo: "pessoa" })} onSim={() => setSheet({ tipo: "ligarPessoa" })} />
      )}
      {sheet?.tipo === "pessoa" && (
        <SheetPessoa
          pessoa={sheet.pessoaId ? pessoaPorId(sheet.pessoaId) : null} pessoaExistente={sheet.pessoaExistente}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onRemover={(pessoaId) => setSheet({ tipo: "removerPessoa", pessoaId })}
          onDesligarPessoa={() => setSheet({ tipo: "ligarPessoa" })}
        />
      )}
      {sheet?.tipo === "ligarPessoa" && (
        <SheetLigarPessoa onFechar={() => setSheet({ tipo: "pessoa" })} onEscolhida={(pessoaExistente) => setSheet({ tipo: "pessoa", pessoaExistente })} />
      )}
      {sheet?.tipo === "removerPessoa" && (
        <SheetRemoverPessoa
          pessoa={pessoaPorId(sheet.pessoaId)} onFechar={() => setSheet(null)}
          onVoltar={(pessoaId) => setSheet({ tipo: "pessoa", pessoaId })}
          onRemovido={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "definicoesBase" && (
        <SheetDefinicoesBase base={base} onFechar={() => setSheet(null)} onGuardado={(msg) => { setSheet(null); torrada(msg); }} />
      )}
      {sheet?.tipo === "definicoesKinder" && (
        <SheetDefinicoesKinder onFechar={() => setSheet(null)} onGuardado={(msg) => { setSheet(null); torrada(msg); }} />
      )}
    </>
  );
}
