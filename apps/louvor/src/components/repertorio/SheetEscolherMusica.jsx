import { useEffect, useState } from "react";
import { ouvirVersoes } from "../../lib/biblioteca";

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolher música e, se houver mais do que uma versão, qual delas —
 *  sem versão nenhuma cadastrada, entra no repertório sem versaoId
 *  (mostra só o nome, sem tom/BPM). `comoMedley` decide o modo — quem
 *  chama já sabe (botão "+ Música" vs. "+ Medley" em Repertorio.jsx),
 *  por isso não há mais um toggle de sim/não aqui dentro: em modo
 *  medley, pede sempre a observação; fora dele, nunca pergunta nada
 *  de medley. A observação é sobre a música que está a ENTRAR agora
 *  (ex.: "só o refrão") — não sobre onde ela encaixa na anterior,
 *  porque quem projeta precisa saber o que vem, não o timing exato
 *  (decisão do líder, 2026-09). */
export default function SheetEscolherMusica({ musicas, musicaAnteriorTitulo, comoMedley, onFechar, onEscolhida }) {
  const [busca, setBusca] = useState("");
  const [musicaEscolhida, setMusicaEscolhida] = useState(null);
  const [versoes, setVersoes] = useState([]);
  const [versaoEscolhida, setVersaoEscolhida] = useState(undefined);
  const [observacaoMedley, setObservacaoMedley] = useState("");

  useEffect(() => {
    if (!musicaEscolhida) { setVersoes([]); return; }
    return ouvirVersoes(musicaEscolhida.id, setVersoes);
  }, [musicaEscolhida]);

  function escolherVersao(versaoId) {
    if (!comoMedley) { onEscolhida(musicaEscolhida.id, versaoId, null); return; }
    setVersaoEscolhida(versaoId);
  }

  function confirmar() {
    onEscolhida(musicaEscolhida.id, versaoEscolhida, { observacaoMedley: observacaoMedley.trim() || null });
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
            <h2>{comoMedley ? `Medley com "${musicaAnteriorTitulo}"` : "Escolher música"}</h2>
            {/* sem autoFocus de propósito — o teclado a abrir sozinho
             * por cima da lista, mal o sheet aparece, confundia mais
             * do que ajudava (relato do líder). */}
            <div className="bib-busca" style={{ marginTop: 12 }}>
              <span aria-hidden="true">🔎</span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título ou artista" />
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
            <label className="rot" style={{ marginTop: 18 }}>Qual parte desta música vai ser usada?</label>
            <input
              className="campo" value={observacaoMedley} onChange={(e) => setObservacaoMedley(e.target.value)}
              placeholder="Só o refrão, a partir da ponte…" autoFocus
            />
            <button className="btn full" style={{ marginTop: 18 }} onClick={confirmar}>Adicionar ao repertório</button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setVersaoEscolhida(undefined)}>Voltar</button>
          </>
        )}
      </div>
    </>
  );
}
