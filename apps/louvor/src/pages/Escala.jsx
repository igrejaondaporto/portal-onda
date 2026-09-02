import { useEffect, useRef, useState } from "react";
import { PAPEIS, nomePapel } from "../lib/modelo";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirBase } from "../lib/painel";
import { MESES, dataCurta, hojeISO } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";

export default function Escala({ uid, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho }) {
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [realcado, setRealcado] = useState(null);
  const [abertos, setAbertos] = useState({});
  const [contactoAberto, setContactoAberto] = useState(null);
  const refsEventos = useRef({});

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirBase(setBase), []);

  useEffect(() => {
    if (!eventoIdFoco || !eventosMes.length) return;
    const el = refsEventos.current[eventoIdFoco];
    if (!el) return;
    setAbertos((v) => ({ ...v, [eventoIdFoco]: true }));
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setRealcado(eventoIdFoco);
    const t = setTimeout(() => setRealcado(null), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoIdFoco, focoSeq, eventosMes.length]);

  const temEscala = eventosMes.some((e) => (e.escala.escalados || []).length > 0);
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";
  const hoje = hojeISO();

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Escala</em>,
      subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
      chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "07:00"}` : "Escala por definir"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventosMes.length, temEscala, mes, base]);

  const escaladosDoPapel = (ev, papelId) => (ev.escala.escalados || []).filter((e) => e.papel === papelId);

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
        {eventosMes.length === 0 ? (
          <div className="semescala" style={{ marginTop: 16 }}>Sem cultos criados neste mês ainda.</div>
        ) : (
          <>
            {/* A tabela fica sempre pronta, com as cinco linhas de sempre
              * (Vocal/Teclado/Guitarra/Baixo/Bateria) — antes só aparecia
              * depois de alguém já estar escalado, e até lá mostrava só
              * um aviso. As células vêm direto de escalados, por isso já
              * se atualizam sozinhas quando o líder junta ou tira alguém
              * (nenhum estado próprio aqui, é sempre o que está gravado). */}
            {!temEscala && (
              <div className="semescala" style={{ marginTop: 16, marginBottom: 12 }}>
                Os {eventosMes.length} cultos já existem, falta dizer quem serve.
              </div>
            )}
            <div className="tabwrap">
              <table className="tab">
                <thead>
                  <tr>
                    <th>Papel</th>
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
                  {PAPEIS.map((papel) => (
                    <tr key={papel.id}>
                      <td className="papel"><span className="quadmin" style={{ background: papel.cor }} />{papel.nome}</td>
                      {eventosMes.map((ev) => {
                        const nomes = escaladosDoPapel(ev, papel.id).map((e) => pessoaPorId(e.pessoaId)).filter(Boolean);
                        const souEu = nomes.some((p) => p.id === uid);
                        return (
                          <td key={ev.id} className={souEu ? "mim" : ""}>
                            {nomes.length ? nomes.map((p) => p.nome).join(", ") : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ds" style={{ marginTop: 12 }}>O teu nome aparece a azul. Desliza a tabela se não couber.</p>
          </>
        )}
      </div>

      <div className="sect">
        {eventosMes.map((ev) => {
          const souEuNoCulto = (ev.escala.pessoas || []).includes(uid);
          const aberto = !!abertos[ev.id];
          return (
            <CartaoCulto
              key={ev.id}
              evento={ev} hoje={hoje} sirvo={souEuNoCulto} aberto={aberto}
              realcado={realcado === ev.id}
              refCartao={(el) => { refsEventos.current[ev.id] = el; }}
              onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
              resumo={souEuNoCulto ? "Serves" : `${(ev.escala.pessoas || []).length} pessoas`}
            >
            {ev.tipo && (
              <p className="ds" style={{ padding: "6px 0 2px" }}>
                {ev.horaCulto} · chegada {ev.horaChegada || base?.horaChegada}
              </p>
            )}
            {(ev.escala.escalados || []).length ? (
              (ev.escala.escalados || []).map((e) => {
                const p = pessoaPorId(e.pessoaId);
                if (!p) return null;
                return (
                  <LinhaPessoaContacto
                    key={`${ev.id}-${e.pessoaId}`} pessoa={p}
                    resumo={nomePapel(e.papel)}
                    tagExtra={ev.escala.liderEscala === e.pessoaId ? <span className="tag lim">Líder de escala</span> : null}
                    aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === e.pessoaId}
                    onToggle={() => setContactoAberto((a) =>
                      a?.eventoId === ev.id && a?.pessoaId === e.pessoaId ? null : { eventoId: ev.id, pessoaId: e.pessoaId })}
                  />
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
