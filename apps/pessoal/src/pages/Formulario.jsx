import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, haAtras } from "@portal/shared/lib/data.js";
import { obterMeuEvento } from "../lib/culto";
import {
  CONCELHOS, FREGUESIAS_POR_CONCELHO,
  ouvirContactosDoEvento, ouvirGDs, criarGD, verificarTelefoneDuplicado,
  criarContacto, marcarEnviadoPastor, linkParaPastor,
} from "../lib/contactos";

/**
 * Novo contacto de visitante + lista dos contactos do culto. Cada
 * campo aceita ser preenchido de pé, à porta — nenhum é grande de
 * mais para não valer a pena escrever (ver "Débitos conscientes" no
 * CLAUDE.md desta base para o que ainda falta: cadastro de GDs a
 * sério, sugestor por zona, painel do pastor).
 */
export default function Formulario({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [meuEvento, setMeuEvento] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [gds, setGds] = useState([]);

  const [nome, setNome] = useState("");
  const [telemovel, setTelemovel] = useState("");
  const [concelho, setConcelho] = useState("");
  const [freguesia, setFreguesia] = useState("");
  const [gdSugerido, setGdSugerido] = useState("");
  const [aceiteRgpd, setAceiteRgpd] = useState(false);
  const [avisoDuplicado, setAvisoDuplicado] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);

  const [aGerirGDs, setAGerirGDs] = useState(false);
  const [novoGdNome, setNovoGdNome] = useState("");
  const [novoGdRegiao, setNovoGdRegiao] = useState("");
  const [aGuardarGd, setAGuardarGd] = useState(false);

  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirGDs(setGds), []);
  useEffect(() => {
    if (!meuEvento?.id) return;
    return ouvirContactosDoEvento(meuEvento.id, setContactos);
  }, [meuEvento?.id]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Formulário", subtitulo: "Novo contacto de visitante",
      chips: contactos.length ? [`${contactos.length} este culto`] : [],
    });
  }, [ativo, definirCabecalho, contactos.length]);

  async function verificarDuplicado() {
    if (telemovel.replace(/\D/g, "").length < 9) { setAvisoDuplicado(null); return; }
    try {
      const existente = await verificarTelefoneDuplicado(telemovel);
      setAvisoDuplicado(existente ? existente.nome : null);
    } catch { /* aviso, não crítico — se falhar, segue sem ele */ }
  }

  function limpar() {
    setNome(""); setTelemovel(""); setConcelho(""); setFreguesia("");
    setGdSugerido(""); setAceiteRgpd(false); setAvisoDuplicado(null);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!nome.trim()) return torrada("Falta o nome.");
    if (telemovel.replace(/\D/g, "").length < 9) return torrada("Telemóvel inválido.");
    if (!concelho) return torrada("Escolhe o concelho.");
    if (!freguesia) return torrada("Escolhe a freguesia.");
    if (!aceiteRgpd) return torrada("Confirma que a pessoa foi informada, antes de guardar.");
    if (!meuEvento) return torrada("Sem culto associado ainda.");
    setAGuardar(true);
    try {
      await criarContacto({ nome, telemovel, concelho, freguesia, gdSugerido, eventoId: meuEvento.id, uid });
      torrada("Contacto guardado");
      limpar();
    } catch (err) {
      torrada(err.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  async function criarNovoGd() {
    if (!novoGdNome.trim() || !novoGdRegiao.trim()) return torrada("Preenche o nome e a região do GD.");
    setAGuardarGd(true);
    try {
      await criarGD(novoGdNome, novoGdRegiao);
      setNovoGdNome(""); setNovoGdRegiao("");
      torrada("GD adicionado");
    } catch (err) {
      torrada(err.message || "Não foi possível adicionar.");
    } finally {
      setAGuardarGd(false);
    }
  }

  async function enviarParaPastor(contacto) {
    window.open(linkParaPastor(contacto, meuEvento.id), "_blank", "noopener");
    try { await marcarEnviadoPastor(contacto.id); } catch { /* o WhatsApp já abriu — o carimbo é só cosmético */ }
  }

  const freguesias = FREGUESIAS_POR_CONCELHO[concelho] ?? [];

  // Mostra sempre todos os GDs, nunca só os da zona da pessoa — há GDs
  // fora dos concelhos servidos (Sines, Lisboa, Barcelos…), agrupados
  // por região só para facilitar encontrar.
  const gdsPorRegiao = Object.entries(
    gds.reduce((mapa, g) => {
      (mapa[g.regiao] ??= []).push(g);
      return mapa;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b, "pt"));

  return (
    <>
      <form className="sect" onSubmit={guardar}>
        <div className="cabecalho"><h3>Novo contacto</h3></div>

        <label className="rot" style={{ marginTop: 12 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />

        <label className="rot">Telemóvel</label>
        <input
          className="campo" value={telemovel} inputMode="tel"
          onChange={(e) => setTelemovel(e.target.value)} onBlur={verificarDuplicado}
          placeholder="912 345 678"
        />
        {avisoDuplicado && (
          <p className="ds" style={{ color: "var(--magenta)", marginTop: 4 }}>
            Já há um contacto com este número: {avisoDuplicado}. Podes continuar — é só um aviso.
          </p>
        )}

        <label className="rot">Concelho</label>
        <select className="campo" value={concelho} onChange={(e) => { setConcelho(e.target.value); setFreguesia(""); }}>
          <option value="">Escolhe o concelho</option>
          {CONCELHOS.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Outro">Outro</option>
        </select>

        <label className="rot">Freguesia</label>
        {concelho === "Outro" ? (
          <input className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)} placeholder="Qual?" />
        ) : (
          <select className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)} disabled={!concelho}>
            <option value="">{concelho ? "Escolhe a freguesia" : "Escolhe primeiro o concelho"}</option>
            {freguesias.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        <label className="rot">GD sugerido (opcional)</label>
        <select className="campo" value={gdSugerido} onChange={(e) => setGdSugerido(e.target.value)}>
          <option value="">Sem GD sugerido</option>
          {gdsPorRegiao.map(([regiao, doGrupo]) => (
            <optgroup key={regiao} label={regiao}>
              {doGrupo.map((g) => <option key={g.id} value={g.nome}>{g.nome}</option>)}
            </optgroup>
          ))}
        </select>

        <div className="linha" style={{ marginTop: 14, cursor: "pointer" }} onClick={() => setAceiteRgpd((a) => !a)}>
          <button
            type="button" className={`chk${aceiteRgpd ? " on" : ""}`}
            onClick={(e) => { e.stopPropagation(); setAceiteRgpd((a) => !a); }}
          >
            ✓
          </button>
          <p className="ds" style={{ flex: 1 }}>
            Confirmo que a pessoa foi informada de que os dados ficam guardados para ser contactada pela igreja.
          </p>
        </div>

        <button className="btn full" style={{ marginTop: 16 }} disabled={aGuardar} type="submit">
          {aGuardar ? "A guardar…" : "Guardar contacto"}
        </button>
      </form>

      <div className="sect">
        <div className="cabecalho">
          <h3>GDs</h3>
          {souLiderBase && (
            <button className="btn sec" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setAGerirGDs((a) => !a)}>
              {aGerirGDs ? "Fechar" : "Gerir"}
            </button>
          )}
        </div>
        {gdsPorRegiao.length ? (
          <div style={{ marginTop: 10 }}>
            {gdsPorRegiao.map(([regiao, doGrupo]) => (
              <div key={regiao} style={{ marginTop: 8 }}>
                <p className="cap">{regiao}</p>
                {doGrupo.map((g) => <p key={g.id} className="ds">{g.nome}</p>)}
              </div>
            ))}
          </div>
        ) : (
          <div className="vaz" style={{ marginTop: 10 }}>Ainda sem GDs cadastrados.</div>
        )}
        {souLiderBase && aGerirGDs && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--fio)" }}>
            <input className="campo" value={novoGdNome} onChange={(e) => setNovoGdNome(e.target.value)} placeholder="Nome do GD" />
            <input
              className="campo" style={{ marginTop: 8 }} value={novoGdRegiao}
              onChange={(e) => setNovoGdRegiao(e.target.value)} placeholder="Região (ex.: Maia)"
            />
            <button className="btn sec full" style={{ marginTop: 8 }} disabled={aGuardarGd} onClick={criarNovoGd}>
              {aGuardarGd ? "A adicionar…" : "Adicionar GD"}
            </button>
          </div>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho">
          <h3>Leads deste culto</h3>
          {meuEvento && <span className="cap">{dataPorExtenso(meuEvento.data)}</span>}
        </div>
        {contactos.length ? contactos.map((c) => (
          <div className="caixa" key={c.id} style={{ marginTop: 10 }}>
            <p className="nmt">{c.nome}</p>
            <p className="ds">{c.telemovel} · {c.concelho} ({c.freguesia})</p>
            {c.gdSugerido && <p className="ds">GD sugerido: {c.gdSugerido}</p>}
            <p className="ds" style={{ marginTop: 4 }}>{haAtras(c.criadoEm)}</p>
            {souLiderBase && (
              c.enviadoPastorEm ? (
                <p className="ds" style={{ color: "var(--verde)", marginTop: 8 }}>
                  Enviado ao pastor · {haAtras(c.enviadoPastorEm)}
                </p>
              ) : (
                <button className="btn sec" style={{ marginTop: 8, fontSize: 12.5 }} onClick={() => enviarParaPastor(c)}>
                  Enviar para o pastor
                </button>
              )
            )}
          </div>
        )) : (
          <div className="vaz">Ainda sem contactos registados neste culto.</div>
        )}
      </div>
    </>
  );
}
