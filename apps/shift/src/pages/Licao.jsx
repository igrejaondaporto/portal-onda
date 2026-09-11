import { useEffect, useState } from "react";
import { ouvirLicoes, guardarLicao, excluirLicao } from "../lib/licoes";
import { ouvirAdolescentes, criarAdolescente, removerAdolescente, ouvirPresencas, marcarPresenca } from "../lib/presencaLicao";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { MESES, nomeEvento, haAtras, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

function IconeDrive() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 13 4-7 4 7" />
      <path d="M3.5 19h17L16 4H8L3.5 19Z" />
    </svg>
  );
}

/** Aceita qualquer link do Drive/Docs/Sheets/Slides e devolve o URL
 *  embutível oficial do Google (o `/preview` do próprio dono do
 *  documento, não um serviço de terceiros) — cada produto tem o seu
 *  caminho de preview, mas todos seguem "/d/{id}/preview". Se o link
 *  não tiver um id reconhecível (partilha não pública, formato
 *  diferente), devolve o link tal qual — o iframe pode ficar em
 *  branco nesse caso, mas "Abrir no Drive" ao lado continua a ser o
 *  caminho garantido. */
function driveEmbedUrl(link) {
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return link;
  const id = m[1];
  if (link.includes("docs.google.com/document")) return `https://docs.google.com/document/d/${id}/preview`;
  if (link.includes("docs.google.com/spreadsheets")) return `https://docs.google.com/spreadsheets/d/${id}/preview`;
  if (link.includes("docs.google.com/presentation")) return `https://docs.google.com/presentation/d/${id}/preview`;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function linkDriveValido(link) {
  return /drive\.google\.com|docs\.google\.com/.test(link);
}

/** Lição — uma por domingo (culto), não uma lista solta: a líder cola
 *  o link do Drive da semana, os voluntários abrem (ou veem a
 *  pré-visualização ali mesmo) para passar aos jovens. Mesma casca de
 *  cartão por culto que a Escala já usa. Cada cartão também tem a
 *  presença dos adolescentes desse domingo — separado de existir
 *  lição ou não (dá para marcar presença mesmo sem link colado essa
 *  semana). */
export default function Licao({ uid, papel, mes, ano, mudarMes, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [eventosMes, setEventosMes] = useState([]);
  const [licoes, setLicoes] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [adolescentes, setAdolescentes] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [abertos, setAbertos] = useState({});
  const [aVisualizar, setAVisualizar] = useState(null); // eventoId com o visualizador aberto
  const [eventoAEnviar, setEventoAEnviar] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [eventoANomear, setEventoANomear] = useState(null); // qual cartão está com o campo "+ adolescente" aberto
  const [aMostrarResumo, setAMostrarResumo] = useState(false);
  const hoje = hojeISO();

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirLicoes(setLicoes), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirAdolescentes(setAdolescentes), []);
  useEffect(() => ouvirPresencas(setPresencas), []);

  const nDoMes = eventosMes.filter((ev) => licoes[ev.id]).length;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Lição</em>,
      subtitulo: "O documento da semana, para passar aos jovens",
      chips: [`${nDoMes}/${eventosMes.length} este mês`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, nDoMes, eventosMes.length, mes]);

  function pessoaPorId(id) {
    return voluntarios.find((p) => p.id === id);
  }

  function abrirEnvio(eventoId, licaoAtual) {
    setEventoAEnviar(eventoId);
    setTitulo(licaoAtual?.titulo || `Lição de ${nomeEvento({ data: eventoId })}`);
    setLink(licaoAtual?.link || "");
  }

  async function enviar() {
    if (!eventoAEnviar) return;
    if (!linkDriveValido(link)) {
      torrada("Cola um link do Drive válido", true);
      return;
    }
    setAEnviar(true);
    try {
      await guardarLicao(uid, eventoAEnviar, { titulo, link });
      torrada("Lição guardada");
      setEventoAEnviar(null);
      setLink("");
    } catch {
      torrada("Não foi possível guardar. Tenta outra vez.", true);
    } finally {
      setAEnviar(false);
    }
  }

  async function excluir(eventoId) {
    try {
      await excluirLicao(eventoId);
      torrada("Lição excluída");
    } catch {
      torrada("Não foi possível excluir.", true);
    }
  }

  async function removerDaLista(pessoa) {
    try {
      await removerAdolescente(pessoa.id);
    } catch {
      torrada("Não foi possível remover.", true);
    }
  }

  async function adicionarAdolescente(eventoId) {
    const nome = novoNome.trim();
    if (!nome) return;
    try {
      await criarAdolescente(nome);
      setNovoNome("");
      setEventoANomear(null);
      torrada(`${nome} adicionado`);
    } catch {
      torrada("Não foi possível adicionar.", true);
    }
    // não marca presença automaticamente aqui — quem acabou de
    // adicionar toca no nome a seguir, se for o caso, como qualquer
    // outro. Mantém eventoId só pra saber qual cartão fechar.
    void eventoId;
  }

  // resumo de participação: quantos domingos (com presença registada
  // em QUALQUER mês, não só o visível) cada adolescente esteve.
  const totalDomingosComRegisto = Object.keys(presencas).length;
  const resumoAdolescentes = adolescentes
    .map((a) => ({ ...a, presencas: Object.values(presencas).filter((lista) => lista.includes(a.id)).length }))
    .sort((a, b) => b.presencas - a.presencas || a.nome.localeCompare(b.nome));

  return (
    <div className="sect" style={{ marginTop: 12 }}>
      <div className="cabecalho">
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => mudarMes(1)}>›</button>
        </span>
      </div>

      {adolescentes.length > 0 && (
        <button className="btn sec full" style={{ marginTop: 4, marginBottom: 16 }} onClick={() => setAMostrarResumo(true)}>
          Resumo de participação
        </button>
      )}

      {eventosMes.length === 0 && <div className="vaz" style={{ marginTop: 12 }}>Sem cultos criados neste mês ainda.</div>}

      {eventosMes.map((ev) => {
        const licao = licoes[ev.id];
        const pessoa = licao && pessoaPorId(licao.enviadoPor);
        const presentesDoDia = presencas[ev.id] || [];
        return (
          <CartaoCulto
            key={ev.id} evento={ev} hoje={hoje} aberto={!!abertos[ev.id]}
            onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
            resumo={licao ? licao.titulo : "Ainda sem lição"}
          >
            {licao ? (
              <>
                <a
                  className="linha" href={licao.link} target="_blank" rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ color: "var(--azul)" }}><IconeDrive /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{licao.titulo}</p>
                    <p className="ds">
                      {pessoa ? `${pessoa.nome} · ` : ""}
                      {licao.criadoEm ? haAtras(licao.criadoEm) : "agora"}
                    </p>
                  </div>
                  {pessoa && <Avatar pessoa={pessoa} tamanho={30} fonte={12} />}
                </a>
                <button
                  className="btn sec full" style={{ marginTop: 8 }}
                  onClick={() => setAVisualizar((v) => (v === ev.id ? null : ev.id))}
                >
                  {aVisualizar === ev.id ? "Fechar" : "Ver aqui"}
                </button>
                {aVisualizar === ev.id && (
                  <iframe
                    src={driveEmbedUrl(licao.link)} title={licao.titulo}
                    style={{ width: "100%", height: 420, border: "1px solid var(--fio)", borderRadius: 12, marginTop: 8 }}
                  />
                )}
              </>
            ) : (
              <p className="ds">A líder ainda não colou o link da lição deste domingo.</p>
            )}
            {souLiderBase && (
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className={`btn full${licao ? " sec" : ""}`} onClick={() => abrirEnvio(ev.id, licao)}>
                  {licao ? "Substituir link" : "Colar link do Drive"}
                </button>
                {licao && <button className="btn perigo" onClick={() => excluir(ev.id)}>Excluir</button>}
              </div>
            )}

            <div className="blococor" style={{ marginTop: 14 }}>
              <p className="rot" style={{ paddingTop: 10 }}>
                Presença · {presentesDoDia.length} de {adolescentes.length}
              </p>
              {adolescentes.length === 0 && eventoANomear !== ev.id && (
                <p className="ds">Ainda não há adolescentes na lista.</p>
              )}
              {adolescentes.map((a) => {
                const presente = presentesDoDia.includes(a.id);
                return (
                  <div key={a.id} className="linha">
                    <button
                      type="button"
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, background: "none", border: 0, textAlign: "left", cursor: "pointer", padding: 0 }}
                      onClick={() => marcarPresenca(ev.id, a.id, !presente)}
                    >
                      <span
                        className="check" data-on={presente ? 1 : 0}
                        style={{
                          width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--fio)",
                          display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
                          ...(presente ? { background: "var(--azul)", borderColor: "var(--azul)", color: "#fff" } : {}),
                        }}
                      >
                        {presente ? "✓" : ""}
                      </span>
                      <span className="nmt">{a.nome}</span>
                    </button>
                    <button
                      className="oc-icobt mag" aria-label={`Remover ${a.nome}`} title="Remover"
                      onClick={() => removerDaLista(a)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {eventoANomear === ev.id ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8, paddingBottom: 10 }}>
                  <input
                    className="campo" style={{ flex: 1 }} autoFocus value={novoNome}
                    placeholder="Nome do adolescente"
                    onChange={(e) => setNovoNome(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") adicionarAdolescente(ev.id); }}
                  />
                  <button className="btn" onClick={() => adicionarAdolescente(ev.id)}>Adicionar</button>
                </div>
              ) : (
                <button
                  className="btn sec full" style={{ marginTop: 8, marginBottom: 10 }}
                  onClick={() => { setEventoANomear(ev.id); setNovoNome(""); }}
                >
                  + Adolescente
                </button>
              )}
            </div>
          </CartaoCulto>
        );
      })}

      {eventoAEnviar && (
        <div className="veu on" onClick={() => setEventoAEnviar(null)} />
      )}
      {eventoAEnviar && (
        <div className="pin on" role="dialog" aria-modal="true">
          <div className="pux" />
          <h2>Lição do Drive</h2>
          <p className="sb2">{nomeEvento({ data: eventoAEnviar })}</p>
          <label className="rot" style={{ marginTop: 12 }}>Título</label>
          <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <label className="rot" style={{ marginTop: 12 }}>Link do Drive</label>
          <input
            className="campo" value={link} placeholder="https://drive.google.com/…"
            onChange={(e) => setLink(e.target.value)}
          />
          <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={enviar}>
            {aEnviar ? "A guardar…" : "Publicar para a base"}
          </button>
          <button
            className="btn sec full" style={{ marginTop: 9 }}
            onClick={() => setEventoAEnviar(null)}
          >
            Cancelar
          </button>
        </div>
      )}

      {aMostrarResumo && (
        <>
          <div className="veu on" onClick={() => setAMostrarResumo(false)} />
          <div className="pin on" role="dialog" aria-modal="true">
            <div className="pux" />
            <h2>Resumo de participação</h2>
            <p className="sb2">{totalDomingosComRegisto} domingo{totalDomingosComRegisto === 1 ? "" : "s"} com presença registada</p>
            {resumoAdolescentes.map((a) => (
              <div className="linha" key={a.id}>
                <div style={{ flex: 1 }}><p className="nmt">{a.nome}</p></div>
                <span className="tag cinz">{a.presencas}/{totalDomingosComRegisto}</span>
              </div>
            ))}
            <button className="btn sec full" style={{ marginTop: 16 }} onClick={() => setAMostrarResumo(false)}>Fechar</button>
          </div>
        </>
      )}
    </div>
  );
}
