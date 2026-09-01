import { useEffect, useState } from "react";
import { ouvirVersoes } from "../../lib/biblioteca";

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolher música e, se houver mais do que uma versão, qual delas —
 *  sem versão nenhuma cadastrada, entra no repertório sem versaoId
 *  (mostra só o nome, sem tom/BPM). */
export default function SheetEscolherMusica({ musicas, onFechar, onEscolhida }) {
  const [busca, setBusca] = useState("");
  const [musicaEscolhida, setMusicaEscolhida] = useState(null);
  const [versoes, setVersoes] = useState([]);

  useEffect(() => {
    if (!musicaEscolhida) { setVersoes([]); return; }
    return ouvirVersoes(musicaEscolhida.id, setVersoes);
  }, [musicaEscolhida]);

  const q = norm(busca.trim());
  const filtradas = musicas.filter((m) => !q || norm(m.titulo).includes(q) || norm(m.artista).includes(q));

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {!musicaEscolhida ? (
          <>
            <h2>Escolher música</h2>
            <div className="bib-busca" style={{ marginTop: 12 }}>
              <span aria-hidden="true">🔎</span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título ou artista" autoFocus />
            </div>
            <div style={{ marginTop: 8, maxHeight: "50vh", overflowY: "auto" }}>
              {filtradas.map((m) => (
                <div className="bib-item" key={m.id} onClick={() => setMusicaEscolhida(m)}>
                  <div className="bib-capa" style={m.capaUrl ? { backgroundImage: `url(${m.capaUrl})` } : {}}>
                    {!m.capaUrl && m.titulo[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{m.titulo}</p>
                    <p className="ds">{m.artista}</p>
                  </div>
                </div>
              ))}
              {filtradas.length === 0 && <div className="vaz">Nenhuma música encontrada.</div>}
            </div>
          </>
        ) : (
          <>
            <h2>{musicaEscolhida.titulo}</h2>
            <p className="sb2">{musicaEscolhida.artista}</p>
            <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>Qual versão entra no repertório?</p>
            <div style={{ marginTop: 12 }}>
              {versoes.map((v) => (
                <div className="linha" style={{ cursor: "pointer" }} key={v.id} onClick={() => onEscolhida(musicaEscolhida.id, v.id)}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">
                      {v.nome}
                      {v.id === musicaEscolhida.versaoPadraoId && <span className="tag lim" style={{ marginLeft: 8 }}>padrão</span>}
                    </p>
                    <p className="ds">{[v.tom && `Tom ${v.tom}`, v.bpm && `${v.bpm} BPM`].filter(Boolean).join(" · ") || "Sem dados"}</p>
                  </div>
                  <span className="seta">›</span>
                </div>
              ))}
              {versoes.length === 0 && (
                <button className="btn full" onClick={() => onEscolhida(musicaEscolhida.id, null)}>
                  Adicionar sem versão definida
                </button>
              )}
            </div>
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setMusicaEscolhida(null)}>Voltar</button>
          </>
        )}
      </div>
    </>
  );
}
