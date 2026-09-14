import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { CATEGORIAS, minhaSalaRestrita, nomeCategoria, souLider, souLiderGeral, varsCategoria } from "../../lib/modelo";
import { obterEventosDoMes, ouvirVoluntarios } from "../../lib/painel";
import {
  hojeLocal, hora, ouvirCheckins, ouvirContagem, corrigirContagem,
  ouvirOcorrencias, registarOcorrencia, atualizarOcorrencia,
} from "../../lib/kinder";
import SeletorCategoria from "../SeletorCategoria";

const TIPOS = ["Queda", "Febre ou doente", "Choro prolongado", "Alergia", "Conflito", "Outro"];

/**
 * Quantas crianças em cada sala (automático, a partir do check-in —
 * corrigível à mão) e as ocorrências do culto: queda, febre… Quem
 * regista vê as suas; as líderes veem todas e marcam "pais avisados".
 */
export default function Contagem({ uid, papel, pessoa }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const liderGeral = souLiderGeral(papel);
  const restrita = minhaSalaRestrita(papel, pessoa);
  const escopoOcorrencias = liderGeral ? "geral" : restrita ? "sala" : "propria";
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [correcoes, setCorrecoes] = useState({});
  const [ocorrencias, setOcorrencias] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [aCorrigir, setACorrigir] = useState(null); // { sala, valor }
  const [aRegistar, setARegistar] = useState(false);

  useEffect(() => {
    const agora = new Date();
    const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const hoje = hojeLocal();
    Promise.all([obterEventosDoMes(anterior.getFullYear(), anterior.getMonth()), obterEventosDoMes(agora.getFullYear(), agora.getMonth())])
      .then(([a, b]) => {
        const passados = [...a, ...b].filter((e) => e.data <= hoje).reverse();
        setEventos(passados);
        setEventoId((v) => v ?? passados[0]?.id ?? null);
      });
  }, []);
  useEffect(() => { if (eventoId) return ouvirCheckins(eventoId, setCheckins); }, [eventoId]);
  useEffect(() => { if (eventoId) return ouvirContagem(eventoId, setCorrecoes); }, [eventoId]);
  useEffect(() => ouvirOcorrencias(escopoOcorrencias, escopoOcorrencias === "sala" ? restrita : uid, setOcorrencias), [escopoOcorrencias, restrita, uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  if (!eventoId) return <div className="vaz" style={{ marginTop: 16 }}>Ainda não houve cultos para contar.</div>;

  const categoriasVisiveis = restrita ? CATEGORIAS.filter((c) => c.id === restrita) : CATEGORIAS;
  const validos = checkins.filter((c) => !c.anulado && (!restrita || c.categoria === restrita));
  const auto = Object.fromEntries(CATEGORIAS.map((c) => [c.id, checkins.filter((k) => !k.anulado && k.categoria === c.id).length]));
  const valor = (s) => correcoes[s]?.valor ?? auto[s];
  const total = categoriasVisiveis.reduce((a, c) => a + valor(c.id), 0);
  const doCulto = ocorrencias.filter((o) => o.eventoId === eventoId);

  async function guardarCorrecao() {
    const n = aCorrigir.valor === "" ? null : Number(aCorrigir.valor);
    if (n != null && (!Number.isInteger(n) || n < 0)) return torrada("Tem de ser um número.", true);
    // sem await: fica na cache local e sincroniza quando houver rede
    corrigirContagem(eventoId, aCorrigir.sala, n, uid).catch((e) => torrada(e.message, true));
    setACorrigir(null);
  }

  return (
    <>
      <div className="sect" style={{ marginTop: 12 }}>
        <div className="cabecalho"><h3>Contagem</h3><span className="cap">{total} crianças</span></div>
        <select className="campo" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
          {eventos.map((e) => <option key={e.id} value={e.id}>{nomeEvento(e)}</option>)}
        </select>
        <div className="kin-grelha" style={{ gridTemplateColumns: `repeat(${categoriasVisiveis.length}, 1fr)` }}>
          {categoriasVisiveis.map((c) => (
            <button key={c.id} type="button" className="kin-num" style={{ ...varsCategoria(c.id), border: 0, cursor: "pointer" }}
              onClick={() => setACorrigir({ sala: c.id, valor: String(valor(c.id)) })}>
              <b>{valor(c.id)}</b>
              <span>{c.nome}{correcoes[c.id] ? " · corrigido" : ""}</span>
            </button>
          ))}
        </div>
        <p className="ds" style={{ marginTop: 8 }}>Conta sozinha pelos check-ins. Toca num número para corrigir.</p>
        {aCorrigir && (
          <div className="caixa" style={{ marginTop: 10 }}>
            <p className="nmt" style={{ fontSize: 14 }}>Sala {nomeCategoria(aCorrigir.sala)} · check-ins: {auto[aCorrigir.sala]}</p>
            <input className="campo" type="number" min="0" inputMode="numeric" value={aCorrigir.valor} autoFocus
              onChange={(e) => setACorrigir((a) => ({ ...a, valor: e.target.value }))} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={guardarCorrecao}>Guardar</button>
              {correcoes[aCorrigir.sala] && (
                <button className="btn sec" style={{ flex: 1 }} onClick={() => { corrigirContagem(eventoId, aCorrigir.sala, null, uid); setACorrigir(null); }}>Voltar ao automático</button>
              )}
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setACorrigir(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho">
          <h3>Ocorrências</h3>
          <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setARegistar(true)}>Registar</button>
        </div>
        {doCulto.length === 0 && <div className="vaz">{lider ? "Nenhuma ocorrência neste culto." : "Não registaste nenhuma ocorrência neste culto."}</div>}
        {doCulto.map((o) => (
          <div className="linha" key={o.id}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{o.tipo}{o.criancaNome ? ` · ${o.criancaNome}` : ""}</p>
              <p className="ds">
                {o.categoria ? `Sala ${nomeCategoria(o.categoria)} · ` : ""}{o.hora || hora(o.criadoEm)}
                {" · "}{voluntarios.find((p) => p.id === o.registadoPor)?.nome ?? "voluntário"}
              </p>
              {o.descricao && <p style={{ fontSize: 13.5, marginTop: 4 }}>{o.descricao}</p>}
              <div style={{ marginTop: 4 }}>
                <span className={`kin-alerta${o.paisAvisados ? " info" : ""}`}>{o.paisAvisados ? "Pais avisados" : "Pais ainda não avisados"}</span>
                {o.resolvida && <span className="kin-alerta info">Resolvida</span>}
              </div>
              {lider && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn sec" style={{ flex: 1, padding: "7px", fontSize: 12.5 }} onClick={() => atualizarOcorrencia(o.id, { paisAvisados: !o.paisAvisados }).catch((e) => torrada(e.message, true))}>
                    {o.paisAvisados ? "Desmarcar avisados" : "Pais avisados"}
                  </button>
                  <button className="btn sec" style={{ flex: 1, padding: "7px", fontSize: 12.5 }} onClick={() => atualizarOcorrencia(o.id, { resolvida: !o.resolvida }).catch((e) => torrada(e.message, true))}>
                    {o.resolvida ? "Reabrir" : "Resolvida"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {aRegistar && (
        <SheetOcorrencia
          uid={uid} eventoId={eventoId} salaInicial={restrita ?? pessoa?.categoria ?? CATEGORIAS[0].id} restrita={restrita} checkins={validos}
          onFechar={() => setARegistar(false)} onGuardado={() => { setARegistar(false); torrada("Ocorrência registada"); }}
        />
      )}
    </>
  );
}

function SheetOcorrencia({ uid, eventoId, salaInicial, restrita, checkins, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [sala, setSala] = useState(salaInicial);
  const [criancaId, setCriancaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [paisAvisados, setPaisAvisados] = useState(false);
  const daSala = checkins.filter((c) => c.categoria === sala).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  function guardar() {
    if (!descricao.trim()) return torrada("Descreve o que aconteceu.", true);
    const crianca = daSala.find((c) => c.criancaId === criancaId);
    registarOcorrencia(uid, {
      eventoId, categoria: sala, tipo, descricao: descricao.trim(), paisAvisados,
      criancaId: crianca?.criancaId ?? null, criancaNome: crianca?.nome ?? null, hora: hora(Date.now()),
    }).catch((e) => torrada(e.message || "Não foi possível registar.", true));
    onGuardado();
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Registar ocorrência</h2>
        <p className="sb2">Fica visível para ti e para as líderes</p>
        <label className="rot" style={{ marginTop: 14 }}>O que aconteceu</label>
        <div className="subtabs" style={{ flexWrap: "wrap" }}>
          {TIPOS.map((t) => <button key={t} data-on={tipo === t ? 1 : 0} onClick={() => setTipo(t)}>{t}</button>)}
        </div>
        <label className="rot">Sala</label>
        {restrita ? (
          <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
        ) : (
          <SeletorCategoria valor={sala} onMudar={(v) => { setSala(v); setCriancaId(""); }} comTodas={false} />
        )}
        <label className="rot">Criança (opcional)</label>
        <select className="campo" value={criancaId} onChange={(e) => setCriancaId(e.target.value)}>
          <option value="">—</option>
          {daSala.map((c) => <option key={c.criancaId} value={c.criancaId}>{c.nome}</option>)}
        </select>
        <label className="rot">Descrição</label>
        <textarea className="campo" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que viste e o que fizeste" />
        <label className="linha" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={paisAvisados} onChange={(e) => setPaisAvisados(e.target.checked)} style={{ width: 22, height: 22 }} />
          <p className="nmt" style={{ flex: 1 }}>Os pais já foram avisados</p>
        </label>
        <button className="btn full" style={{ marginTop: 16 }} onClick={guardar}>Registar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
