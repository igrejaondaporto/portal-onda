import { useEffect, useMemo, useRef, useState } from "react";
import { ouvirMusicas, ouvirVersoes, obterPreviaDeezer } from "../lib/biblioteca";
import { obterEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { souLiderOuAuxiliar } from "../lib/modelo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetAdicionarMusica from "../components/biblioteca/SheetAdicionarMusica";
import SheetMusicaDetalhe from "../components/biblioteca/SheetMusicaDetalhe";
import SheetVersaoParaRepertorio from "../components/biblioteca/SheetVersaoParaRepertorio";
import SheetHistoricoCantor from "../components/biblioteca/SheetHistoricoCantor";
import IconePlay from "../components/biblioteca/IconePlay";

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const POR_PAGINA = 20;

function frescor(musica) {
  if (!musica.ultimaVezTocada?.toDate) return { texto: "Nunca tocada", classe: "descansada" };
  const dias = Math.round((Date.now() - musica.ultimaVezTocada.toDate().getTime()) / 86400000);
  const semanas = Math.round(dias / 7);
  if (semanas <= 3) return { texto: `Há ${semanas <= 1 ? "1 semana" : semanas + " semanas"}`, classe: "recente" };
  return { texto: `Há ${semanas} semanas`, classe: "descansada" };
}

/** As classificações do LouveApp vieram todas iguais ("Louvor" em
 *  todas as 211 músicas importadas, sem exceção) — não servem pra
 *  filtrar nada, ficaram de fora. "Tocadas recentemente" e "A-Z" são
 *  alternáveis (clicar de novo inverte); "Mais tocadas" é sempre
 *  ranking decrescente — não faz muito sentido inverter um ranking. */
function ordenarMusicas(lista, modo, direcao) {
  const arr = [...lista];
  if (modo === "az") {
    arr.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
    return direcao === "desc" ? arr.reverse() : arr;
  }
  if (modo === "maisTocadas") {
    return arr.sort((a, b) => (b.vezes90d || 0) - (a.vezes90d || 0));
  }
  const ts = (m) => m.ultimaVezTocada?.toDate?.().getTime() ?? -Infinity;
  arr.sort((a, b) => ts(b) - ts(a)); // tocada mais recentemente primeiro
  return direcao === "asc" ? arr.reverse() : arr; // invertido = descansada há mais tempo primeiro
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
  const souLider = souLiderOuAuxiliar(papel);
  const podeCadastrar = souLider;
  const torrada = useTorrada();
  const [musicas, setMusicas] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [sheetHistorico, setSheetHistorico] = useState(false);
  const [busca, setBusca] = useState("");
  const [modoOrdem, setModoOrdem] = useState("recentes");
  const [direcao, setDirecao] = useState("desc");
  const [pagina, setPagina] = useState(0);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const versoesAberta = useVersoesDe(abertaId);
  const [aTocarId, setATocarId] = useState(null);
  const [aCarregarPreview, setACarregarPreview] = useState(null);
  const [paraRepertorio, setParaRepertorio] = useState(null); // música escolhida para o atalho "+ repertório"
  const [proximoEventoId, setProximoEventoId] = useState(null);
  const audioRef = useRef(null);
  const paginaAtivaRef = useRef(null);

  useEffect(() => ouvirMusicas(setMusicas), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => () => audioRef.current?.pause(), []);

  // Mantém o número da página atual visível na fileira — sem isto,
  // ir avançando pelas setas ‹ › podia deixar o número aceso fora do
  // que já foi scrollado.
  useEffect(() => {
    paginaAtivaRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pagina]);

  // Resolvido uma vez, para o atalho "+ repertório" de cada música —
  // mesma escolha de "próximo culto" que Repertorio.jsx usa por
  // omissão (o mais próximo daqui pra frente, senão o último do mês).
  useEffect(() => {
    const hoje = new Date();
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()).then((eventos) => {
      if (!eventos.length) return;
      const hojeStr = hoje.toISOString().slice(0, 10);
      setProximoEventoId((eventos.find((e) => e.data >= hojeStr) ?? eventos.at(-1)).id);
    });
  }, []);

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

  function clicarOrdem(modo) {
    if (modoOrdem === modo) {
      setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setModoOrdem(modo);
      setDirecao(modo === "az" ? "asc" : "desc");
    }
    setPagina(0);
  }

  const ordenadas = useMemo(() => {
    const q = norm(busca.trim());
    const base = q ? musicas.filter((m) => norm(m.titulo).includes(q) || norm(m.artista).includes(q)) : musicas;
    return ordenarMusicas(base, modoOrdem, direcao);
  }, [musicas, busca, modoOrdem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const filtradas = ordenadas.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  useEffect(() => {
    if (!ativo) return;
    const nomes = { recentes: "Tocadas recentemente", az: "A-Z", maisTocadas: "Mais tocadas" };
    definirCabecalho({
      titulo: <em>Biblioteca</em>,
      subtitulo: nomes[modoOrdem],
      chips: [`${musicas.length} ${musicas.length === 1 ? "música" : "músicas"}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, musicas.length, modoOrdem]);

  const musicaAberta = musicas.find((m) => m.id === abertaId) ?? null;

  return (
    <>
      <button className="btn sec full" style={{ marginBottom: 10 }} onClick={() => setSheetHistorico(true)}>
        🕓 Histórico por cantor
      </button>
      <div className="bib-busca">
        <span aria-hidden="true">🔎</span>
        <input
          value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
          placeholder="Título ou artista"
        />
      </div>
      {/* Mais tocadas é um modo à parte, não mais uma opção de ordenar —
        * por isso vive no seu próprio menu, não ao lado dos chips de
        * Ordenar (pedido do líder: aqueles são "como ordenar a lista
        * toda", isto é "ver só o ranking"). */}
      <div className="subtabs">
        <button data-on={modoOrdem === "maisTocadas" ? 1 : 0} onClick={() => { setModoOrdem("maisTocadas"); setPagina(0); }}>
          Mais tocadas
        </button>
        <button data-on={modoOrdem !== "maisTocadas" ? 1 : 0} onClick={() => { setModoOrdem("recentes"); setDirecao("desc"); setPagina(0); }}>
          Todas
        </button>
      </div>
      {modoOrdem !== "maisTocadas" && (
        <div className="bib-chips">
          <button className="bib-chip" data-on={modoOrdem === "recentes" ? 1 : 0} onClick={() => clicarOrdem("recentes")}>
            Tocadas recentemente {modoOrdem === "recentes" ? (direcao === "desc" ? "↓" : "↑") : "⇅"}
          </button>
          <button className="bib-chip" data-on={modoOrdem === "az" ? 1 : 0} onClick={() => clicarOrdem("az")}>
            A-Z {modoOrdem === "az" ? (direcao === "asc" ? "↑" : "↓") : "⇅"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        {filtradas.length === 0 && (
          <div className="vaz">
            {musicas.length === 0 ? "Ainda não há músicas na biblioteca." : "Nenhuma música encontrada."}
          </div>
        )}
        {filtradas.map((m, i) => {
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
              <div className="bib-lado">
                {modoOrdem === "maisTocadas" ? (
                  <span className="bib-frescor recente">#{paginaAtual * POR_PAGINA + i + 1} · {m.vezes90d || 0}×</span>
                ) : (
                  <span className={`bib-frescor ${f.classe}`}>{f.texto}</span>
                )}
                <button
                  className="bib-add-rep" aria-label="Adicionar ao repertório"
                  onClick={(e) => { e.stopPropagation(); setParaRepertorio(m); }}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 12H3" /><path d="M16 6H3" /><path d="M16 18H3" /><path d="M18 9v6" /><path d="M21 12h-6" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
        {ordenadas.length > POR_PAGINA && (
          <div className="bib-paginas">
            <button className="calbt" disabled={paginaAtual === 0} onClick={() => setPagina((p) => p - 1)}>‹</button>
            <div className="bib-paginas-nums">
              {Array.from({ length: totalPaginas }, (_, i) => (
                <button
                  key={i} className="bib-pagina-num" data-on={i === paginaAtual ? 1 : 0}
                  ref={i === paginaAtual ? paginaAtivaRef : undefined}
                  onClick={() => setPagina(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button className="calbt" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}>›</button>
          </div>
        )}
      </div>

      {podeCadastrar && (
        <button className="bib-fab" onClick={() => setAAdicionar(true)} aria-label="Adicionar música">+</button>
      )}

      <SheetAdicionarMusica
        aberta={aAdicionar}
        uid={uid} musicas={musicas}
        onFechar={() => setAAdicionar(false)}
        onCriada={(musicaId) => { setAAdicionar(false); setAbertaId(musicaId); }}
      />
      {musicaAberta && (
        <SheetMusicaDetalhe
          uid={uid} souLider={souLider}
          musica={musicaAberta} versoes={versoesAberta}
          onFechar={() => setAbertaId(null)}
          onAdicionarRepertorio={() => { setAbertaId(null); setParaRepertorio(musicaAberta); }}
        />
      )}
      {paraRepertorio && (
        <SheetVersaoParaRepertorio
          uid={uid} musica={paraRepertorio} eventoId={proximoEventoId}
          onFechar={() => setParaRepertorio(null)}
          onAdicionada={() => setParaRepertorio(null)}
        />
      )}
      {sheetHistorico && (
        <SheetHistoricoCantor
          voluntarios={voluntarios}
          onFechar={() => setSheetHistorico(false)}
          onAbrirMusica={(musicaId) => { setSheetHistorico(false); setAbertaId(musicaId); }}
        />
      )}
      <audio ref={audioRef} onEnded={() => setATocarId(null)} style={{ display: "none" }} />
    </>
  );
}
