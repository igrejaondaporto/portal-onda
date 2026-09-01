import { useEffect, useMemo, useRef, useState } from "react";
import { ouvirMusicas, ouvirVersoes, CLASSIFICACOES } from "../lib/biblioteca";
import SheetAdicionarMusica from "../components/biblioteca/SheetAdicionarMusica";
import SheetMusicaDetalhe from "../components/biblioteca/SheetMusicaDetalhe";
import IconePlay from "../components/biblioteca/IconePlay";

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function frescor(musica) {
  if (!musica.ultimaVezTocada?.toDate) return { texto: "Nunca tocada", classe: "descansada" };
  const dias = Math.round((Date.now() - musica.ultimaVezTocada.toDate().getTime()) / 86400000);
  const semanas = Math.round(dias / 7);
  if (semanas <= 3) return { texto: `Há ${semanas <= 1 ? "1 semana" : semanas + " semanas"}`, classe: "recente" };
  return { texto: `Há ${semanas} semanas`, classe: "descansada" };
}

/** Só carrega as versões da música aberta — 500 músicas com todas as
 *  versões de todas ao mesmo tempo seria caro à toa (ver CLAUDE.md). */
function useVersoesDe(musicaId) {
  const [versoes, setVersoes] = useState([]);
  useEffect(() => {
    if (!musicaId) { setVersoes([]); return; }
    return ouvirVersoes(musicaId, setVersoes);
  }, [musicaId]);
  return versoes;
}

export default function Biblioteca({ uid, papel, ativo, definirCabecalho }) {
  const souLider = papel === "lider_base";
  const [musicas, setMusicas] = useState([]);
  const [busca, setBusca] = useState("");
  const [classifAtiva, setClassifAtiva] = useState(null);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const versoesAberta = useVersoesDe(abertaId);
  const [aTocarId, setATocarId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => ouvirMusicas(setMusicas), []);
  useEffect(() => () => audioRef.current?.pause(), []);

  function alternarPreview(e, musica) {
    e.stopPropagation();
    if (!musica.previewUrl) return;
    const audio = audioRef.current;
    if (aTocarId === musica.id) {
      audio.pause();
      setATocarId(null);
      return;
    }
    audio.src = musica.previewUrl;
    audio.play().catch(() => {});
    setATocarId(musica.id);
  }

  const filtradas = useMemo(() => {
    const q = norm(busca.trim());
    return musicas.filter((m) => {
      if (classifAtiva && !(m.classificacoes || []).includes(classifAtiva)) return false;
      if (!q) return true;
      return norm(m.titulo).includes(q) || norm(m.artista).includes(q);
    });
  }, [musicas, busca, classifAtiva]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Biblioteca",
      subtitulo: "Descansadas há mais tempo primeiro",
      chips: [`${musicas.length} ${musicas.length === 1 ? "música" : "músicas"}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, musicas.length]);

  const musicaAberta = musicas.find((m) => m.id === abertaId) ?? null;

  return (
    <>
      <div className="bib-busca">
        <span aria-hidden="true">🔎</span>
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Título ou artista"
        />
      </div>
      <div className="bib-chips">
        <button className="bib-chip" data-on={classifAtiva === null ? 1 : 0} onClick={() => setClassifAtiva(null)}>
          Todas
        </button>
        {CLASSIFICACOES.map((c) => (
          <button
            key={c.id} className="bib-chip" data-on={classifAtiva === c.id ? 1 : 0}
            onClick={() => setClassifAtiva((v) => (v === c.id ? null : c.id))}
            title={c.ajuda}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 6 }}>
        {filtradas.length === 0 && (
          <div className="vaz">
            {musicas.length === 0 ? "Ainda não há músicas na biblioteca." : "Nenhuma música encontrada."}
          </div>
        )}
        {filtradas.map((m) => {
          const f = frescor(m);
          return (
            <div className="bib-item" key={m.id} onClick={() => setAbertaId(m.id)}>
              <div
                className="bib-capa"
                style={m.capaUrl ? { backgroundImage: `url(${m.capaUrl})` } : {}}
              >
                {!m.capaUrl && m.titulo[0]?.toUpperCase()}
                {m.previewUrl && (
                  <button className="bib-preview-play" onClick={(e) => alternarPreview(e, m)} aria-label="Tocar prévia">
                    <IconePlay aTocar={aTocarId === m.id} />
                  </button>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">{m.titulo}</p>
                <p className="ds">{m.artista}{(m.classificacoes || []).length ? ` · ${m.classificacoes.length} classificação${m.classificacoes.length > 1 ? "ões" : ""}` : ""}</p>
              </div>
              <span className={`bib-frescor ${f.classe}`}>{f.texto}</span>
            </div>
          );
        })}
      </div>

      <button className="bib-fab" onClick={() => setAAdicionar(true)} aria-label="Adicionar música">+</button>

      {aAdicionar && (
        <SheetAdicionarMusica
          uid={uid} musicas={musicas}
          onFechar={() => setAAdicionar(false)}
          onCriada={(musicaId) => { setAAdicionar(false); setAbertaId(musicaId); }}
        />
      )}
      {musicaAberta && (
        <SheetMusicaDetalhe
          uid={uid} souLider={souLider}
          musica={musicaAberta} versoes={versoesAberta}
          onFechar={() => setAbertaId(null)}
        />
      )}
      <audio ref={audioRef} onEnded={() => setATocarId(null)} style={{ display: "none" }} />
    </>
  );
}
