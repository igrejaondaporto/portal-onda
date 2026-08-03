import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cBase, FASES } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, obterEventosDoMes } from "../lib/painel";
import { MESES, dataPorExtenso } from "../lib/data";
import { useTorrada } from "../lib/TorradaContext";
import Avatar from "../components/Avatar";
import Avatares from "../components/Avatares";
import Bola from "../components/Bola";
import SheetEscala from "../components/painel/SheetEscala";
import SheetNovoCulto from "../components/painel/SheetNovoCulto";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SheetFuncao from "../components/painel/SheetFuncao";

export default function PainelLider({ baseId, definirCabecalho, aoVoltar }) {
  const torrada = useTorrada();
  const hoje = useMemo(() => new Date(), []);
  const [ano] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [base, setBase] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [eventosRef, setEventosRef] = useState({});
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    getDoc(cBase()).then((s) => setBase(s.exists() ? s.data() : null));
  }, []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);

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
      subtitulo: "Escalas, voluntários e catálogo",
      chips: [
        `${voluntarios.length} voluntários`,
        `${catalogo.length} no catálogo`,
        `${especiais.length} especiais`,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voluntarios.length, catalogo.length, especiais.length]);

  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);

  return (
    <>
      <button className="sair" style={{ marginTop: 0 }} onClick={aoVoltar}>‹ Início</button>

      <div className="duas">
        <div>
          <div className="sect">
            <div className="cabecalho">
              <h3>Escala de {MESES[mes]}</h3>
              <span className="calnav">
                <button className="calbt" disabled={mes === 0} onClick={() => setMes((m) => Math.max(0, m - 1))}>‹</button>
                <button className="calbt" disabled={mes === 11} onClick={() => setMes((m) => Math.min(11, m + 1))}>›</button>
              </span>
            </div>
            <p className="ds" style={{ padding: "8px 0 2px" }}>
              Os domingos são criados sozinhos. Só falta dizer quem serve e quem lidera.
            </p>
            {eventosMes.map((ev) => {
              const pessoasEscala = ev.escala.pessoas.map(pessoaPorId).filter(Boolean);
              const lider = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
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
                  <p className="ds">{p.papel === "lider_base" ? "Líder da base · 6 dígitos" : "Voluntário · 4 dígitos"}</p>
                </div>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => setSheet({ tipo: "pessoa", pessoaId: p.id })}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="sect">
            <div className="cabecalho">
              <h3>Catálogo de funções</h3>
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "funcao", funcaoId: null, escopo: null })}>
                Nova
              </button>
            </div>
            {FASES.map(([k, t]) => {
              const doF = catalogo.filter((f) => f.fase === k);
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
            <div className="cabecalho"><h3>Definições da base</h3></div>
            <div className="linha">
              <div style={{ flex: 1 }}><p className="nmt">Hora de chegada</p><p className="ds">Igual em todos os domingos</p></div>
              <span className="tag cinz">{base?.horaChegada ?? "—"}</span>
            </div>
            <div className="linha">
              <div style={{ flex: 1 }}><p className="nmt">Hora do culto</p><p className="ds">{base?.nome ?? "—"}</p></div>
              <span className="tag cinz">{base?.horaCulto ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {sheet?.tipo === "escala" && (
        <SheetEscala
          evento={eventosMes.find((e) => e.id === sheet.eventoId)}
          voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); recarregarMes(); torrada(msg); }}
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
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onRemover={(pessoaId) => setSheet({ tipo: "removerPessoa", pessoaId })}
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
          eventosDisponiveis={eventosMes}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
