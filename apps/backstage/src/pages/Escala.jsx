import { useEffect, useRef, useState } from "react";
import { funcoesDoCulto } from "../lib/modelo";
import {
  ouvirEventosDoMes, ouvirVoluntarios, ouvirFuncoes, ouvirBase, obterEscalasDeTodasAsBases, obterProximoEvento,
  obterCatalogoChecklistDeTodasAsBases, ouvirChecklistDoEvento,
} from "../lib/painel";
import { obterAtribuicoes } from "../lib/culto";
import { MESES, dataPorExtenso, dataCurta, ordenarEscala, hojeISO } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";

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
  const [contactoAberto, setContactoAberto] = useState(null); // "baseId:pessoaId"

  useEffect(() => { obterProximoEvento().then(setEvento); }, []);
  useEffect(() => {
    if (!evento) { setBases(null); return; }
    setBases(null);
    setContactoAberto(null);
    obterEscalasDeTodasAsBases(evento.id).then(setBases);
  }, [evento]);

  const alternarContacto = (chave) => setContactoAberto((c) => (c === chave ? null : chave));

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
                    <div style={{ marginTop: 8 }}>
                      {b.pessoas.map((p) => {
                        const chave = `${b.baseId}:${p.id}`;
                        return (
                          <LinhaPessoaContacto
                            key={p.id} pessoa={p}
                            resumo="Toca para chamar no WhatsApp"
                            tagExtra={p.id === b.liderEscalaId ? <span className="tag lim">Líder de escala</span> : null}
                            aberta={contactoAberto === chave}
                            onToggle={() => alternarContacto(chave)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {b.tipo === "lugares" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {b.itens.map((it, i) => (
                        <div key={i}>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cinza)", textTransform: "uppercase", letterSpacing: 0.4, margin: "10px 0 2px" }}>
                            {it.ministerio}
                          </p>
                          {it.titular ? (
                            <LinhaPessoaContacto
                              pessoa={it.titular} resumo="Titular · toca para chamar no WhatsApp"
                              aberta={contactoAberto === `${b.baseId}:${i}:titular`}
                              onToggle={() => alternarContacto(`${b.baseId}:${i}:titular`)}
                            />
                          ) : (
                            <p className="ds">Por definir</p>
                          )}
                          {it.aprendiz && (
                            <LinhaPessoaContacto
                              pessoa={it.aprendiz} resumo="Aprendiz · toca para chamar no WhatsApp"
                              aberta={contactoAberto === `${b.baseId}:${i}:aprendiz`}
                              onToggle={() => alternarContacto(`${b.baseId}:${i}:aprendiz`)}
                            />
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

/** Segmento "Checklist" — a mesma ideia de "Todas as bases", mas para
 *  o que falta fazer, não quem serve. Pedido explícito do líder: ver
 *  em tempo real a checklist da igreja toda, com um aviso quando
 *  estiver tudo pronto. Diferente do resto de "Todas as bases" (que é
 *  propositadamente só escala, sem progresso — decisão registada em
 *  CLAUDE.md desta app, revista agora a pedido dele).
 *
 *  Catálogo (que função existe, de que ministério/fase, nomes de
 *  quem está ativo em cada base) vem uma vez da Cloud Function
 *  `checklistCrossBase` — bases/{b}/funcoes e /pessoas são
 *  restritos à própria base nas rules, só o Admin SDK lê cruzado.
 *  O estado (feito, quem, a que hora) é ao vivo: eventos/{e}/checklist
 *  já é global (`allow read: if autenticado()`), não pede Cloud
 *  Function nenhuma para isso — só assim fica "em tempo real" sem
 *  chamar a função a cada toque de checkbox de qualquer base.
 *
 *  Um cartão por base, fechado por omissão (mesmo `.mincartao` que a
 *  Comunicação já usa para agrupar Wiki/Acervo/Solicitações) — dentro,
 *  agrupado por ministério (Técnica/Comunicação) ou por fase
 *  (Apoio/Backstage, que não têm ministérios). Só leitura: marcar a
 *  checklist continua a ser sempre da própria base (rules já exigem
 *  estar na escala dela para escrever ali). */
function ChecklistTodasAsBases() {
  const [evento, setEvento] = useState(undefined); // undefined = a carregar, null = nenhum
  const [catalogo, setCatalogo] = useState(null); // null = a carregar
  const [checklist, setChecklist] = useState({});
  const [abertos, setAbertos] = useState({});

  useEffect(() => { obterProximoEvento().then(setEvento); }, []);
  useEffect(() => {
    if (!evento) { setCatalogo(null); return; }
    setCatalogo(null);
    setAbertos({});
    obterCatalogoChecklistDeTodasAsBases(evento.id).then(setCatalogo);
  }, [evento]);
  useEffect(() => {
    if (!evento) { setChecklist({}); return; }
    return ouvirChecklistDoEvento(evento.id, setChecklist);
  }, [evento]);

  const total = catalogo ? catalogo.reduce((s, b) => s + b.total, 0) : 0;
  const feitas = catalogo
    ? catalogo.reduce((s, b) => s + b.grupos.reduce((s2, g) => s2 + g.funcoes.filter((f) => checklist[f.id]).length, 0), 0)
    : 0;
  const tudoPronto = total > 0 && feitas === total;

  return (
    <div className="sect">
      <div className="cabecalho">
        <h3>Checklist do próximo culto</h3>
      </div>

      {evento === undefined && <div className="vaz">A carregar…</div>}
      {evento === null && <div className="vaz">Sem cultos marcados.</div>}

      {evento && (
        <>
          <p className="ds" style={{ marginBottom: 10 }}>{evento.tipo || dataPorExtenso(evento.data)}</p>

          {catalogo === null && <div className="vaz">A carregar…</div>}

          {catalogo && catalogo.map((b) => {
            const aberto = !!abertos[b.baseId];
            const feitasBase = b.grupos.reduce((s, g) => s + g.funcoes.filter((f) => checklist[f.id]).length, 0);
            return (
              <div className="mincartao" key={b.baseId}>
                <div className="mincartao-barra" style={{ background: b.cor || "var(--fio)" }} />
                <button
                  className="mincartao-cab cabtoque"
                  data-aberto={aberto ? 1 : 0} aria-expanded={aberto}
                  onClick={() => setAbertos((v) => ({ ...v, [b.baseId]: !v[b.baseId] }))}
                >
                  <span className="ponto" style={{ background: b.cor || "var(--cinza)" }} />
                  <span className="nome">{b.nome}</span>
                  <span className="conta">{b.total === 0 ? "sem funções" : `${feitasBase} de ${b.total}`}</span>
                  <span className="cabtoque-seta" aria-hidden="true">›</span>
                </button>
                {aberto && (
                  <div style={{ padding: "0 12px 12px" }}>
                    {b.total === 0 && <div className="vaz" style={{ border: 0 }}>Nada para este culto.</div>}
                    {b.grupos.map((g) => (
                      <div key={g.chave}>
                        <div className="fasecab">
                          <h4>
                            {g.cor && <span className="quadmin" style={{ background: g.cor }} />}
                            {g.titulo}
                          </h4>
                          <em>{g.funcoes.filter((f) => checklist[f.id]).length}/{g.funcoes.length}</em>
                        </div>
                        {g.funcoes.map((f) => {
                          const c = checklist[f.id];
                          const ok = !!c;
                          return (
                            <div className={`linha${ok ? " feita" : ""}`} key={f.id}>
                              <span className={`chk${ok ? " on" : ""}`} style={{ cursor: "default" }}>✓</span>
                              <div style={{ flex: 1 }}>
                                <p className="nmt" style={{ fontSize: 15 }}>{f.nome}</p>
                                <p className="ds">{ok ? `${b.pessoas[c.por] ?? "alguém"} · ${c.hora}` : "Por fazer"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {catalogo && total > 0 && (
            <div
              style={{
                marginTop: 16, padding: "16px 20px", borderRadius: 100, textAlign: "center",
                fontWeight: 700, fontSize: 15,
                background: tudoPronto ? "var(--verde)" : "var(--agua)",
                color: tudoPronto ? "#fff" : "var(--cinza)",
              }}
            >
              {tudoPronto ? "✅ Tudo pronto pro culto!" : `Faltam ${total - feitas} de ${total} tarefas`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Escala({ uid, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho, onVerFuncoes, veTodasEscalas }) {
  const [abaEscala, setAbaEscala] = useState("minha"); // "minha" | "todas" | "checklist"
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
        <td className="papel">{i === 0 ? "Treinamento" : ""}</td>
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
          <button className={`btn ${abaEscala === "checklist" ? "" : "sec"}`} style={{ flex: 1, fontSize: 13 }} onClick={() => setAbaEscala("checklist")}>
            Checklist
          </button>
        </div>
      )}
      {abaEscala === "todas" ? (
        <TodasAsBases />
      ) : abaEscala === "checklist" ? (
        <ChecklistTodasAsBases />
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
