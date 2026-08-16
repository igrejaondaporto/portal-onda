import { useEffect, useRef, useState } from "react";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirBase, ouvirMinisterios } from "../lib/painel";
import { MESES, dataCurta, hojeISO } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";

export default function Escala({ uid, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho }) {
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [base, setBase] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [abertos, setAbertos] = useState({}); // que cultos estão abertos
  const [contactoAberto, setContactoAberto] = useState(null); // { eventoId, pessoaId }
  const refsEventos = useRef({});

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirBase(setBase), []);

  useEffect(() => {
    if (!eventoIdFoco || !eventosMes.length) return;
    const el = refsEventos.current[eventoIdFoco];
    if (!el) return;
    // vir do calendário do Início tem de abrir o cartão, senão a pessoa
    // toca num dia e aterra num cartão fechado, sem perceber porquê
    setAbertos((v) => ({ ...v, [eventoIdFoco]: true }));
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setRealcado(eventoIdFoco);
    const t = setTimeout(() => setRealcado(null), 1600);
    return () => clearTimeout(t);
    // focoSeq muda a cada clique no calendário, mesmo que o culto-alvo seja o mesmo de antes
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
                    <th>Ministério</th>
                    {eventosMes.map((ev) => (
                      <th key={ev.id} className={ev.data === hoje ? "hj" : ""}>
                        {dataCurta(ev.data)}{ev.data === hoje ? " · hoje" : ev.data < hoje ? " ✅" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ministerios.map((m) => (
                    <tr key={m.id} className={m.ordem === 0 ? "lid" : undefined}>
                      <td className="papel"><span className="quadmin" style={{ background: m.cor }} />{m.nome}</td>
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

      {/* Um cartão por culto, fechado. Antes vinham todos abertos com toda
        * a gente dentro: com seis domingos e cinco pessoas em cada, chegar
        * ao último era rolar a página inteira. O mês cabe agora num ecrã, e
        * abre-se só o dia que interessa. */}
      <div className="sect">
        {eventosMes.map((ev) => {
          const souEuNoCulto = (ev.escala.pessoas || []).includes(uid);
          const aberto = !!abertos[ev.id];
          // em que ministério sirvo nesse dia — o Responsável acumula com
          // um operacional, por isso pode ser mais do que um
          const meusMinisterios = ministerios
            .filter((m) => { const l = lugarDe(ev, m.id); return l?.titularId === uid || l?.aprendizId === uid; })
            .map((m) => m.nome);
          return (
            <CartaoCulto
              key={ev.id}
              evento={ev} hoje={hoje} sirvo={souEuNoCulto} aberto={aberto}
              realcado={realcado === ev.id}
              refCartao={(el) => { refsEventos.current[ev.id] = el; }}
              onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
              resumo={souEuNoCulto
                ? `Serves${meusMinisterios.length ? ` · ${meusMinisterios.join(" · ")}` : ""}`
                : `${(ev.escala.pessoas || []).length} pessoas`}
            >
            {/* a data saiu daqui — o cartão já a mostra no cabeçalho */}
            {ev.tipo && (
              <p className="ds" style={{ padding: "6px 0 2px" }}>
                {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
              </p>
            )}
            {ministerios.some((m) => lugarDe(ev, m.id)?.titularId) ? (
              ministerios.map((m) => {
                const lugar = lugarDe(ev, m.id);
                if (!lugar?.titularId) return null;
                const titular = pessoaPorId(lugar.titularId);
                const aprendiz = lugar.aprendizId ? pessoaPorId(lugar.aprendizId) : null;
                return (
                  <div key={m.id}>
                    {titular && (
                      <LinhaPessoaContacto
                        pessoa={titular}
                        resumo={`${m.nome} · titular${titular.id === uid ? " · tu" : ""}`}
                        corMinisterio={m.cor}
                        aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === titular.id}
                        onToggle={() => setContactoAberto((a) =>
                          a?.eventoId === ev.id && a?.pessoaId === titular.id ? null : { eventoId: ev.id, pessoaId: titular.id })}
                      />
                    )}
                    {aprendiz && (
                      <LinhaPessoaContacto
                        pessoa={aprendiz}
                        resumo={`${m.nome} · 📝 em treino${aprendiz.id === uid ? " · tu" : ""}`}
                        corMinisterio={m.cor}
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
            </CartaoCulto>
          );
        })}
      </div>
      <p className="nota">Quem não pode servir avisa pelo WhatsApp. O {nomeLiderBase} atualiza a escala aqui.</p>
    </>
  );
}
