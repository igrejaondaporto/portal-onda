import { useEffect, useRef, useState } from "react";
import { funcoesDoCulto } from "../lib/modelo";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirFuncoes, ouvirBase, ouvirMinisterios } from "../lib/painel";
import { MESES, dataPorExtenso, dataCurta, hojeISO } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";

export default function Escala({ uid, mes, ano, definirMes, eventoIdFoco, focoSeq, ativo, definirCabecalho }) {
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [base, setBase] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [contactoAberto, setContactoAberto] = useState(null); // { eventoId, pessoaId }
  const refsEventos = useRef({});

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirBase(setBase), []);

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

  const temEscala = eventosMes.some((e) => (e.escala.lugares || []).some((l) => l.titularId));
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";
  const hoje = hojeISO();

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Escala",
      subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
      chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "08:30"}` : "Escala por definir"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventosMes.length, temEscala, mes, base]);

  const lugarDe = (ev, ministerioId) => (ev.escala.lugares || []).find((l) => l.ministerioId === ministerioId);

  return (
    <>
      <div className="sect">
        <div className="cabecalho">
          <h3>{MESES[mes]} {ano}</h3>
          <span className="calnav">
            <button className="calbt" disabled={mes === 0} onClick={() => definirMes(Math.max(0, mes - 1))}>‹</button>
            <button className="calbt" disabled={mes === 11} onClick={() => definirMes(Math.min(11, mes + 1))}>›</button>
          </span>
        </div>
        {temEscala ? (
          <>
            <div className="tabwrap">
              <table className="tab">
                <thead>
                  <tr>
                    <th>Ministério</th>
                    {eventosMes.map((ev) => (
                      <th key={ev.id} className={ev.data === hoje ? "hj" : ""}>
                        {dataCurta(ev.data)}{ev.data === hoje ? " · hoje" : ev.data < hoje ? " ✅" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="lid">
                    <td className="papel">Líder de culto</td>
                    {eventosMes.map((ev) => {
                      const p = ev.escala.liderEscala ? pessoaPorId(ev.escala.liderEscala) : null;
                      return <td key={ev.id} className={p?.id === uid ? "mim" : ""}>{p ? p.nome : "por definir"}</td>;
                    })}
                  </tr>
                  {ministerios.map((m) => (
                    <tr key={m.id}>
                      <td className="papel">{m.nome}</td>
                      {eventosMes.map((ev) => {
                        const lugar = lugarDe(ev, m.id);
                        const titular = lugar?.titularId ? pessoaPorId(lugar.titularId) : null;
                        const aprendiz = lugar?.aprendizId ? pessoaPorId(lugar.aprendizId) : null;
                        const souEu = titular?.id === uid || aprendiz?.id === uid;
                        return (
                          <td key={ev.id} className={souEu ? "mim" : ""}>
                            {titular ? titular.nome : "—"}
                            {aprendiz && <span style={{ opacity: 0.7 }}> +{aprendiz.nome}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ds" style={{ marginTop: 12 }}>O teu nome aparece a azul. "+nome" é quem está em treino.</p>
          </>
        ) : (
          <div className="semescala" style={{ marginTop: 16 }}>
            Os {eventosMes.length} cultos já existem, falta dizer quem serve.
          </div>
        )}
      </div>

      {eventosMes.map((ev) => {
        const souEuNoCulto = (ev.escala.pessoas || []).includes(uid);
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
              {souEuNoCulto ? (
                <span className="tag verd">Serves</span>
              ) : (
                <span className="cap">{(ev.escala.pessoas || []).length} pessoas</span>
              )}
            </div>
            {ev.tipo && (
              <p className="ds" style={{ padding: "6px 0 2px" }}>
                {dataPorExtenso(ev.data)} · {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
              </p>
            )}
            {ministerios.some((m) => lugarDe(ev, m.id)?.titularId) ? (
              ministerios.map((m) => {
                const lugar = lugarDe(ev, m.id);
                if (!lugar?.titularId) return null;
                const titular = pessoaPorId(lugar.titularId);
                const aprendiz = lugar.aprendizId ? pessoaPorId(lugar.aprendizId) : null;
                const fs = funcoesDoCulto(funcoes, ev.id).filter((f) => f.ministerioId === m.id);
                return (
                  <div key={m.id}>
                    {titular && (
                      <LinhaPessoaContacto
                        pessoa={titular}
                        resumo={`${m.nome} · titular${titular.id === uid ? " · tu" : ""}`}
                        funcoesDaPessoa={fs}
                        tagExtra={ev.escala.liderEscala === titular.id ? <span className="tag lim">Líder de culto</span> : null}
                        aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === titular.id}
                        onToggle={() => setContactoAberto((a) =>
                          a?.eventoId === ev.id && a?.pessoaId === titular.id ? null : { eventoId: ev.id, pessoaId: titular.id })}
                      />
                    )}
                    {aprendiz && (
                      <LinhaPessoaContacto
                        pessoa={aprendiz}
                        resumo={`${m.nome} · 📝 em treino${aprendiz.id === uid ? " · tu" : ""}`}
                        funcoesDaPessoa={fs}
                        aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === aprendiz.id}
                        onToggle={() => setContactoAberto((a) =>
                          a?.eventoId === ev.id && a?.pessoaId === aprendiz.id ? null : { eventoId: ev.id, pessoaId: aprendiz.id })}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="vaz">Ainda ninguém escalado.</div>
            )}
          </div>
        );
      })}
      <p className="nota">Quem não pode servir avisa pelo WhatsApp. O {nomeLiderBase} atualiza a escala aqui.</p>
    </>
  );
}
