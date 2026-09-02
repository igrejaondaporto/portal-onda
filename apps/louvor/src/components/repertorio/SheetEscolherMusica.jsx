import { useEffect, useState } from "react";
import { ouvirVersoes } from "../../lib/biblioteca";

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolher música e, se houver mais do que uma versão, qual delas —
 *  sem versão nenhuma cadastrada, entra no repertório sem versaoId
 *  (mostra só o nome, sem tom/BPM). Quando já existe uma música antes
 *  no repertório (`musicaAnteriorTitulo`), pergunta se esta entra em
 *  medley com ela — Repertorio.jsx desenha as duas coladas, e a
 *  observação aqui é o que diz à Técnica a hora certa de trocar o
 *  slide (decisão do líder, 2026-09: "fica difícil a projeção saber
 *  em qual momento será o medley"). */
export default function SheetEscolherMusica({ musicas, musicaAnteriorTitulo, onFechar, onEscolhida }) {
  const [busca, setBusca] = useState("");
  const [musicaEscolhida, setMusicaEscolhida] = useState(null);
  const [versoes, setVersoes] = useState([]);
  const [versaoEscolhida, setVersaoEscolhida] = useState(undefined);
  const [ehMedley, setEhMedley] = useState(false);
  const [observacaoMedley, setObservacaoMedley] = useState("");

  useEffect(() => {
    if (!musicaEscolhida) { setVersoes([]); return; }
    return ouvirVersoes(musicaEscolhida.id, setVersoes);
  }, [musicaEscolhida]);

  function escolherVersao(versaoId) {
    if (!musicaAnteriorTitulo) { onEscolhida(musicaEscolhida.id, versaoId, null); return; }
    setVersaoEscolhida(versaoId);
  }

  function confirmar() {
    onEscolhida(musicaEscolhida.id, versaoEscolhida, ehMedley ? { observacaoMedley: observacaoMedley.trim() || null } : null);
  }

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
        ) : versaoEscolhida === undefined ? (
          <>
            <h2>{musicaEscolhida.titulo}</h2>
            <p className="sb2">{musicaEscolhida.artista}</p>
            <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>Qual versão entra no repertório?</p>
            <div style={{ marginTop: 12 }}>
              {versoes.map((v) => (
                <div className="linha" style={{ cursor: "pointer" }} key={v.id} onClick={() => escolherVersao(v.id)}>
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
                <button className="btn full" onClick={() => escolherVersao(null)}>
                  Adicionar sem versão definida
                </button>
              )}
            </div>
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setMusicaEscolhida(null)}>Voltar</button>
          </>
        ) : (
          <>
            <h2>{musicaEscolhida.titulo}</h2>
            <p className="sb2">{musicaEscolhida.artista}</p>
            <label className="opcao" style={{ marginTop: 18 }} onClick={() => setEhMedley((v) => !v)}>
              <span style={{ flex: 1 }}>Medley com "{musicaAnteriorTitulo}"?</span>
              <span className={`chk${ehMedley ? " on" : ""}`}>✓</span>
            </label>
            {ehMedley && (
              <>
                <label className="rot" style={{ marginTop: 10 }}>Em que parte entra? (opcional)</label>
                <input
                  className="campo" value={observacaoMedley} onChange={(e) => setObservacaoMedley(e.target.value)}
                  placeholder="Depois do refrão da anterior…" autoFocus
                />
              </>
            )}
            <button className="btn full" style={{ marginTop: 18 }} onClick={confirmar}>Adicionar ao repertório</button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setVersaoEscolhida(undefined)}>Voltar</button>
          </>
        )}
      </div>
    </>
  );
}
