import { useEffect, useRef, useState } from "react";
import { ouvirEventosDoMes, ouvirVoluntarios, ouvirBase } from "../lib/painel";
import { CATEGORIAS, categoriaInicial, nomeCategoria, varsCategoria } from "../lib/modelo";
import { hojeLocal } from "../lib/kinder";
import { MESES } from "@portal/shared/lib/data.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import SeletorCategoria from "../components/SeletorCategoria";

/**
 * A escala do mês, um cartão por culto (fechado), e dentro de cada um
 * as três salas com a sua cor. A escala em si é uma lista simples
 * (guardarEscalaApoio) — a sala de cada pessoa é a dela, fixa
 * (`pessoas/{p}.categoria`), por isso não precisa de ir na escala.
 *
 * Regra dos dois: nunca um adulto sozinho com as crianças. Uma sala
 * com uma pessoa só fica assinalada.
 */
export default function Escala({ uid, papel, pessoa, mes, ano, mudarMes, eventoIdFoco, focoSeq, ativo, definirCabecalho }) {
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [sala, setSala] = useState(null);
  const [salaDefinida, setSalaDefinida] = useState(false);
  const [abertos, setAbertos] = useState({});
  const [realcado, setRealcado] = useState(null);
  const [contactoAberto, setContactoAberto] = useState(null);
  const refsEventos = useRef({});
  const hoje = hojeLocal();

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirBase(setBase), []);
  // a sala por omissão só se escolhe uma vez, quando a pessoa chega
  useEffect(() => {
    if (salaDefinida || !pessoa) return;
    setSala(categoriaInicial(papel, pessoa));
    setSalaDefinida(true);
  }, [pessoa, papel, salaDefinida]);

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

  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const temEscala = eventosMes.some((e) => e.escala.pessoas.length);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Escala</em>,
      subtitulo: `Os cultos de ${MESES[mes].toLowerCase()}`,
      chips: [`${eventosMes.length} cultos`, temEscala ? `Chegada ${base?.horaChegada ?? "08:30"}` : "Escala por definir"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventosMes.length, temEscala, mes, base]);

  const salasVisiveis = sala ? CATEGORIAS.filter((c) => c.id === sala) : CATEGORIAS;

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
        <SeletorCategoria valor={sala} onMudar={setSala} />
      </div>

      <div className="sect">
        {eventosMes.length === 0 && <div className="vaz">Sem cultos criados neste mês.</div>}
        {eventosMes.map((ev) => {
          const pessoas = ev.escala.pessoas.map(pessoaPorId).filter(Boolean);
          const sirvo = ev.escala.pessoas.includes(uid);
          const semSala = pessoas.filter((p) => !p.categoria);
          const linha = (p) => (
            <LinhaPessoaContacto
              key={p.id} pessoa={p}
              resumo={p.id === uid ? "tu" : p.categoria ? `Sala ${nomeCategoria(p.categoria)}` : "Geral"}
              funcoesDaPessoa={[]}
              tagExtra={ev.escala.liderEscala === p.id ? <span className="tag lim">Líder de escala</span> : null}
              aberta={contactoAberto?.eventoId === ev.id && contactoAberto?.pessoaId === p.id}
              onToggle={() => setContactoAberto((a) => (a?.eventoId === ev.id && a?.pessoaId === p.id ? null : { eventoId: ev.id, pessoaId: p.id }))}
            />
          );
          return (
            <CartaoCulto
              key={ev.id} evento={ev} hoje={hoje} sirvo={sirvo} aberto={!!abertos[ev.id]}
              realcado={realcado === ev.id}
              refCartao={(el) => { refsEventos.current[ev.id] = el; }}
              onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
              resumo={sirvo ? `Serves${pessoa?.categoria ? ` · ${nomeCategoria(pessoa.categoria)}` : ""}` : `${pessoas.length} pessoas`}
            >
              {pessoas.length === 0 && <div className="vaz">Ainda ninguém escalado.</div>}
              {pessoas.length > 0 && salasVisiveis.map((c) => {
                const daSala = pessoas.filter((p) => p.categoria === c.id);
                return (
                  <div className="kin-faixa" key={c.id} style={varsCategoria(c.id)}>
                    <div className="kin-faixa-cab">
                      <h4>{c.nome}</h4>
                      <span className="kin-tagcat">{daSala.length} {daSala.length === 1 ? "pessoa" : "pessoas"}</span>
                    </div>
                    {daSala.length === 1 && <span className="kin-alerta">Só um adulto — nunca sozinho com as crianças</span>}
                    {daSala.length === 0 ? <p className="ds" style={{ marginTop: 6 }}>Ninguém nesta sala.</p> : daSala.map(linha)}
                  </div>
                );
              })}
              {pessoas.length > 0 && !sala && semSala.length > 0 && (
                <div className="kin-faixa" style={varsCategoria(null)}>
                  <div className="kin-faixa-cab"><h4>Geral</h4></div>
                  {semSala.map(linha)}
                </div>
              )}
            </CartaoCulto>
          );
        })}
      </div>
      <p className="nota">Quem não pode servir avisa pelo WhatsApp. As líderes atualizam a escala no Painel.</p>
    </>
  );
}
