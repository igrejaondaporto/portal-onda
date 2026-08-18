import { useEffect, useRef, useState } from "react";
import { funcoesDoCulto } from "../lib/modelo";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirFuncoes, ouvirBase, obterEscalasDeTodasAsBases, obterProximoEvento } from "../lib/painel";
import { obterAtribuicoes } from "../lib/culto";
import { MESES, dataPorExtenso, dataCurta, ordenarEscala, hojeISO } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

/** Segmento "Todas as bases" — só o próximo domingo (ou próximo culto,
 *  se houver um antes), as bases empilhadas com os nomes de quem
 *  serve. Nunca o mês todo: é uma visão geral rápida, não outro
 *  calendário para navegar (ver CLAUDE.md desta app). Só leitura, sem
 *  progresso nem checklist — "se precisa saber se outra base
 *  terminou, pergunta presencialmente". Base sem escala publicada
 *  aparece a dizer isso, não desaparece — a ausência é informação. */
function TodasAsBases() {
  const [evento, setEvento] = useState(undefined); // undefined = a carregar, null = nenhum
  const [bases, setBases] = useState(null); // null = a carregar

  useEffect(() => { obterProximoEvento().then(setEvento); }, []);
  useEffect(() => {
    if (!evento) { setBases(null); return; }
    setBases(null);
    obterEscalasDeTodasAsBases(evento.id).then(setBases);
  }, [evento]);

  return (
    <div className="sect">
      <div className="cabecalho">
        <h3>Próximo culto</h3>
      </div>

      {evento === undefined && <div className="vaz">A carregar…</div>}
      {evento === null && <div className="vaz">Sem cultos marcados.</div>}

      {evento && (
        <>
          <p className="ds" style={{ marginBottom: 10 }}>{evento.tipo || dataPorExtenso(evento.data)}</p>

          {bases === null && <div className="vaz">A carregar…</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {bases && bases.map((b) => {
              const contagem = b.tipo === "pessoas" ? b.pessoas.length : b.tipo === "lugares" ? b.itens.length : 0;
              return (
                <div
                  key={b.baseId} className="caixa"
                  style={{ margin: 0, borderLeft: `4px solid ${b.cor || "var(--azul)"}`, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }}
                >
                  <div className="cabecalho">
                    <h3 style={{ color: b.cor || undefined }}>{b.nome}</h3>
                    {contagem > 0 && <span className="cap">{contagem} {contagem === 1 ? "pessoa" : "pessoas"}</span>}
                  </div>

                  {b.tipo === "vazio" && (
                    <p className="ds" style={{ marginTop: 6 }}>Escala ainda não publicada.</p>
                  )}

                  {b.tipo === "pessoas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                      {b.pessoas.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <Avatar pessoa={p} tamanho={36} fonte={14} />
                          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{p.nome}</span>
                          {p.id === b.liderEscalaId && <span className="tag lim">Líder de escala</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {b.tipo === "lugares" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                      {b.itens.map((it, i) => (
                        <div key={i}>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cinza)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 7 }}>
                            {it.ministerio}
                          </p>
                          {it.titular ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <Avatar pessoa={it.titular} tamanho={36} fonte={14} />
                              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{it.titular.nome}</span>
                            </div>
                          ) : (
                            <p className="ds">Por definir</p>
                          )}
                          {it.aprendiz && (
                            <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 8, marginLeft: 14 }}>
                              <Avatar pessoa={it.aprendiz} tamanho={30} fonte={12} />
                              <span style={{ fontSize: 13, color: "var(--cinza)" }}>{it.aprendiz.nome} · aprendiz</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function Escala({ uid, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho, onVerFuncoes, veTodasEscalas }) {
  const [abaEscala, setAbaEscala] = useState("minha");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [base, setBase] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [atribuicoesPorEvento, setAtribuicoesPorEvento] = useState({});
  const [contactoAberto, setContactoAberto] = useState(null); // { eventoId, pessoaId }
  const refsEventos = useRef({});

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirBase(setBase), []);

  function alternarContacto(eventoId, pessoaId) {
    setContactoAberto((a) => (a?.eventoId === eventoId && a?.pessoaId === pessoaId ? null : { eventoId, pessoaId }));
    if (!atribuicoesPorEvento[eventoId]) {
      obterAtribuicoes(eventoId).then((a) => setAtribuicoesPorEvento((m) => ({ ...m, [eventoId]: a })));
    }
  }

  useEffect(() => {
    if (!eventoIdFoco || !eventosMes.length) return;
    const el = refsEventos.current[eventoIdFoco];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setRealcado(eventoIdFoco);
    const t = setTimeout(() => setRealcado(null), 1600);
    return () => clearTimeout(t);
    // focoSeq muda a cada clique no calendário, mesmo que o culto-alvo seja o mesmo de antes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoIdFoco, focoSeq, eventosMes.length]);

  const temEscala = eventosMes.some((e) => e.escala.pessoas.length);
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";
  const hoje = hojeISO();

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Escala",
      subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
      chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "08:00"}` : "Escala por definir"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventosMes.length, temEscala, mes, base]);

  const maxLin = Math.max(0, ...eventosMes.map((e) => e.escala.pessoas.filter((id) => id !== e.escala.liderEscala).length));
  const linhas = [];
  for (let i = 0; i < maxLin; i++) {
    linhas.push(
      <tr key={i}>
        <td className="papel">{i === 0 ? "Voluntários" : ""}</td>
        {eventosMes.map((ev) => {
          const outros = ev.escala.pessoas.filter((id) => id !== ev.escala.liderEscala);
          const p = outros[i] ? pessoaPorId(outros[i]) : null;
          return <td key={ev.id} className={p?.id === uid ? "mim" : ""}>{p ? p.nome : "—"}</td>;
        })}
      </tr>
    );
  }

  return (
    <>
      {veTodasEscalas && (
        <div className="segcontrol" data-tour="escala-todas-bases" style={{ display: "flex", gap: 8, padding: "0 0 14px" }}>
          <button className={`btn ${abaEscala === "minha" ? "" : "sec"}`} style={{ flex: 1, fontSize: 13 }} onClick={() => setAbaEscala("minha")}>
            Minha base
          </button>
          <button className={`btn ${abaEscala === "todas" ? "" : "sec"}`} style={{ flex: 1, fontSize: 13 }} onClick={() => setAbaEscala("todas")}>
            Todas as bases
          </button>
        </div>
      )}
      {abaEscala === "todas" ? (
        <TodasAsBases />
      ) : (
      <>
      <div className="sect">
        <div className="cabecalho">
          <h3>{MESES[mes]} {ano}</h3>
          <span className="calnav">
            <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
            <button className="calbt" onClick={() => mudarMes(1)}>›</button>
          </span>
        </div>
        {temEscala ? (
          <>
            <div className="tabwrap">
              <table className="tab">
                <thead>
                  <tr>
                    <th>Backstage</th>
                    {eventosMes.map((ev) => (
                      <th key={ev.id} className={ev.data === hoje ? "hj" : ""}>
                        {dataCurta(ev.data)}{ev.data === hoje ? " · hoje" : ev.data < hoje ? " ✅" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="lid">
                    <td className="papel">Líder de escala</td>
                    {eventosMes.map((ev) => {
                      const p = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
                      return <td key={ev.id} className={p?.id === uid ? "mim" : ""}>{p ? p.nome : "por definir"}</td>;
                    })}
                  </tr>
                  {linhas}
                </tbody>
              </table>
            </div>
            <p className="ds" style={{ marginTop: 12 }}>O teu nome aparece a azul. Desliza a tabela se não couber.</p>
          </>
        ) : (
          <div className="semescala" style={{ marginTop: 16 }}>
            Os {eventosMes.length} cultos já existem, falta dizer quem serve.
          </div>
        )}
      </div>

      {eventosMes.map((ev) => {
        const pessoasOrdenadas = ordenarEscala(ev.escala);
        return (
          <div
            className={`sect${realcado === ev.id ? " realce" : ""}`} key={ev.id}
            ref={(el) => { refsEventos.current[ev.id] = el; }}
          >
            <div className="cabecalho">
              <h3>
                {ev.tipo || dataPorExtenso(ev.data)}
                {ev.data === hoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
                {ev.data < hoje && " ✅"}
              </h3>
              {ev.escala.pessoas.includes(uid) ? (
                <span className="tag verd">Serves</span>
              ) : (
                <span className="cap">{ev.escala.pessoas.length} pessoas</span>
              )}
            </div>
            {ev.tipo && (
              <p className="ds" style={{ padding: "6px 0 2px" }}>
                {dataPorExtenso(ev.data)} · {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
              </p>
            )}
            {pessoasOrdenadas.length ? (
              pessoasOrdenadas.map((id) => {
                const p = pessoaPorId(id);
                if (!p) return null;
                const atribs = atribuicoesPorEvento[ev.id] || {};
                const fs = funcoesDoCulto(funcoes, ev.id).filter((f) => (atribs[f.id] || []).includes(id));
                return (
                  <LinhaPessoaContacto
                    key={id} pessoa={p}
                    resumo={id === uid ? "tu" : fs.length ? `${fs.length} ${fs.length === 1 ? "função" : "funções"}` : "Sem funções atribuídas"}
                    funcoesDaPessoa={fs}
                    tagExtra={ev.escala.liderEscala === id ? <span className="tag lim">Líder de escala</span> : null}
                    aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === id}
                    onToggle={() => alternarContacto(ev.id, id)}
                  />
                );
              })
            ) : (
              <div className="vaz">Ainda ninguém escalado.</div>
            )}
            {ev.escala.pessoas.length > 0 && (
              <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => onVerFuncoes?.(ev.id)}>
                Ver as funções deste culto
              </button>
            )}
          </div>
        );
      })}
      <p className="nota">Quem não pode servir avisa pelo WhatsApp. O {nomeLiderBase} atualiza a escala aqui.</p>
      </>
      )}
    </>
  );
}
