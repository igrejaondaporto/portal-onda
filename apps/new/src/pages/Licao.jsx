import { useEffect, useRef, useState } from "react";
import { ouvirLicoes, enviarLicao, excluirLicao } from "../lib/licoes";
import { ouvirAdolescentes, criarAdolescente, ouvirPresencas, marcarPresenca } from "../lib/presencaLicao";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { MESES, nomeEvento, haAtras, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

function IconeDocx() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** Só funciona para ficheiros já num URL público (o link do Storage
 *  já é isso) — o visualizador é do Google, não nosso; se um dia
 *  parar de responder ou vier vazio, "Abrir/descarregar" ao lado
 *  continua a ser o caminho garantido. */
function visualizadorUrl(arquivoUrl) {
  return `https://docs.google.com/gview?url=${encodeURIComponent(arquivoUrl)}&embedded=true`;
}

/** Lição — uma por domingo (culto), não uma lista solta: o líder sobe
 *  o .docx da semana, os voluntários abrem para passar aos jovens.
 *  Mesma casca de cartão por culto que a Escala já usa. Cada cartão
 *  também tem a presença dos adolescentes desse domingo — separado
 *  de existir lição ou não (dá para marcar presença mesmo sem
 *  documento enviado essa semana). */
export default function Licao({ uid, papel, mes, ano, mudarMes, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const inputRef = useRef(null);
  const [eventosMes, setEventosMes] = useState([]);
  const [licoes, setLicoes] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [adolescentes, setAdolescentes] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [abertos, setAbertos] = useState({});
  const [aVisualizar, setAVisualizar] = useState(null); // eventoId com o visualizador aberto
  const [eventoAEnviar, setEventoAEnviar] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [ficheiro, setFicheiro] = useState(null);
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

  function abrirEnvio(eventoId) {
    setEventoAEnviar(eventoId);
    setTitulo(`Lição de ${nomeEvento({ data: eventoId })}`);
    setFicheiro(null);
    setTimeout(() => inputRef.current?.click(), 0);
  }

  function escolherFicheiro(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) {
      torrada("Só ficheiros .docx", true);
      return;
    }
    setFicheiro(f);
  }

  async function enviar() {
    if (!ficheiro || !eventoAEnviar) return;
    setAEnviar(true);
    try {
      await enviarLicao(uid, eventoAEnviar, { titulo, ficheiro });
      torrada("Lição enviada");
      setEventoAEnviar(null);
      setFicheiro(null);
    } catch {
      torrada("Não foi possível enviar. Tenta outra vez.", true);
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
      <input
        ref={inputRef} type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: "none" }} onChange={escolherFicheiro}
      />

      <div className="cabecalho">
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => mudarMes(1)}>›</button>
        </span>
      </div>

      {adolescentes.length > 0 && (
        <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setAMostrarResumo(true)}>
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
                  className="linha" href={licao.arquivoUrl} target="_blank" rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ color: "var(--azul)" }}><IconeDocx /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{licao.arquivoNome}</p>
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
                    src={visualizadorUrl(licao.arquivoUrl)} title={licao.titulo}
                    style={{ width: "100%", height: 420, border: "1px solid var(--fio)", borderRadius: 12, marginTop: 8 }}
                  />
                )}
              </>
            ) : (
              <p className="ds">A líder ainda não enviou a lição deste domingo.</p>
            )}
            {souLiderBase && (
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className="btn sec full" onClick={() => abrirEnvio(ev.id)}>
                  {licao ? "Substituir ficheiro" : "Enviar lição (.docx)"}
                </button>
                {licao && <button className="btn sec" onClick={() => excluir(ev.id)}>Excluir</button>}
              </div>
            )}

            <p className="rot" style={{ marginTop: 14 }}>
              Presença · {presentesDoDia.length} de {adolescentes.length}
            </p>
            {adolescentes.length === 0 && eventoANomear !== ev.id && (
              <p className="ds">Ainda não há adolescentes na lista.</p>
            )}
            {adolescentes.map((a) => {
              const presente = presentesDoDia.includes(a.id);
              return (
                <button
                  key={a.id} className="linha"
                  style={{ width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer" }}
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
              );
            })}
            {eventoANomear === ev.id ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
                className="btn sec full" style={{ marginTop: 8 }}
                onClick={() => { setEventoANomear(ev.id); setNovoNome(""); }}
              >
                + Adolescente
              </button>
            )}
          </CartaoCulto>
        );
      })}

      {eventoAEnviar && ficheiro && (
        <div className="veu on" onClick={() => { setEventoAEnviar(null); setFicheiro(null); }} />
      )}
      {eventoAEnviar && ficheiro && (
        <div className="pin on" role="dialog" aria-modal="true">
          <div className="pux" />
          <h2>Enviar lição</h2>
          <p className="sb2">{nomeEvento({ data: eventoAEnviar })}</p>
          <label className="rot" style={{ marginTop: 12 }}>Título</label>
          <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <p className="ds" style={{ marginTop: 8 }}>Ficheiro: {ficheiro.name}</p>
          <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={enviar}>
            {aEnviar ? "A enviar…" : "Publicar para a base"}
          </button>
          <button
            className="btn sec full" style={{ marginTop: 9 }}
            onClick={() => { setEventoAEnviar(null); setFicheiro(null); }}
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
