import { useEffect, useRef, useState } from "react";
import { ouvirLicoes, enviarLicao, excluirLicao } from "../lib/licoes";
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

/** Lição — uma por domingo (culto), não uma lista solta: o líder sobe
 *  o .docx da semana, os voluntários abrem para passar aos jovens.
 *  Mesma casca de cartão por culto que a Escala já usa. */
export default function Licao({ uid, papel, mes, ano, mudarMes, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const inputRef = useRef(null);
  const [eventosMes, setEventosMes] = useState([]);
  const [licoes, setLicoes] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [abertos, setAbertos] = useState({});
  const [eventoAEnviar, setEventoAEnviar] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [ficheiro, setFicheiro] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);
  const hoje = hojeISO();

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirLicoes(setLicoes), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

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

      {eventosMes.length === 0 && <div className="vaz" style={{ marginTop: 12 }}>Sem cultos criados neste mês ainda.</div>}

      {eventosMes.map((ev) => {
        const licao = licoes[ev.id];
        const pessoa = licao && pessoaPorId(licao.enviadoPor);
        return (
          <CartaoCulto
            key={ev.id} evento={ev} hoje={hoje} aberto={!!abertos[ev.id]}
            onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
            resumo={licao ? licao.titulo : "Ainda sem lição"}
          >
            {licao ? (
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
    </div>
  );
}
