import { useEffect, useMemo, useRef, useState } from "react";
import { ouvirMusicas, ouvirVersoes, obterPreviaDeezer } from "../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
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

/** As classificações do LouveApp vieram todas iguais ("Louvor" em
 *  todas as 211 músicas importadas, sem exceção) — não servem pra
 *  filtrar nada, então saíram da Biblioteca (o campo continua a
 *  existir no cadastro manual, só não filtra mais aqui). No lugar,
 *  ordenar por frescor (o que já era o padrão) ou A-Z, que são os
 *  dois eixos com dado de verdade em toda música. */
const MODOS_ORDEM = [
  { id: "descansadas", nome: "Descansadas primeiro" },
  { id: "recentes", nome: "Tocadas recentemente" },
  { id: "az", nome: "A-Z" },
];
function ordenarMusicas(lista, modo) {
  const arr = [...lista];
  if (modo === "az") return arr.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
  const ts = (m) => m.ultimaVezTocada?.toDate?.().getTime() ?? null;
  if (modo === "recentes") return arr.sort((a, b) => (ts(b) ?? -1) - (ts(a) ?? -1));
  return arr.sort((a, b) => (ts(a) ?? -1) - (ts(b) ?? -1)); // descansadas: nunca tocada primeiro
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
  const torrada = useTorrada();
  const [musicas, setMusicas] = useState([]);
  const [busca, setBusca] = useState("");
  const [modoOrdem, setModoOrdem] = useState("descansadas");
  const [aAdicionar, setAAdicionar] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const versoesAberta = useVersoesDe(abertaId);
  const [aTocarId, setATocarId] = useState(null);
  const [aCarregarPreview, setACarregarPreview] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => ouvirMusicas(setMusicas), []);
  useEffect(() => () => audioRef.current?.pause(), []);

  async function alternarPreview(e, musica) {
    e.stopPropagation();
    if (!musica.deezerId) return;
    const audio = audioRef.current;
    if (aTocarId === musica.id) {
      audio.pause();
      setATocarId(null);
      return;
    }
    setACarregarPreview(musica.id);
    try {
      // o link gravado (previewUrl) é só um token do Deezer que
      // expira em poucas horas — pede sempre um novo pelo deezerId.
      const preview = await obterPreviaDeezer(musica.deezerId);
      if (!preview) { torrada("Sem prévia para esta música."); return; }
      audio.src = preview;
      await audio.play();
      setATocarId(musica.id);
    } catch {
      torrada("Não foi possível tocar a prévia.");
    } finally {
      setACarregarPreview(null);
    }
  }

  const filtradas = useMemo(() => {
    const q = norm(busca.trim());
    const base = q ? musicas.filter((m) => norm(m.titulo).includes(q) || norm(m.artista).includes(q)) : musicas;
    return ordenarMusicas(base, modoOrdem);
  }, [musicas, busca, modoOrdem]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Biblioteca",
      subtitulo: MODOS_ORDEM.find((m) => m.id === modoOrdem)?.nome,
      chips: [`${musicas.length} ${musicas.length === 1 ? "música" : "músicas"}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, musicas.length, modoOrdem]);

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
        {MODOS_ORDEM.map((m) => (
          <button
            key={m.id} className="bib-chip" data-on={modoOrdem === m.id ? 1 : 0}
            onClick={() => setModoOrdem(m.id)}
          >
            {m.nome}
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
                {m.deezerId && (
                  <button className="bib-preview-play" onClick={(e) => alternarPreview(e, m)} aria-label="Tocar prévia">
                    {aCarregarPreview === m.id ? "…" : <IconePlay aTocar={aTocarId === m.id} />}
                  </button>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">{m.titulo}</p>
                <p className="ds">{m.artista}</p>
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
