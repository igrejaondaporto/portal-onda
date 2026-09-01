import { useState } from "react";
import {
  novaMusicaId, novaVersaoId, criarMusica, criarVersao, encontrarDuplicata,
  pesquisarMusica, aplicarCapaDeezer, CLASSIFICACOES,
} from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Três etapas: procurar (só o nome), escolher entre os candidatos
 * (cada um já com capa/tom/BPM/links resolvidos — ver
 * pesquisarMusicaLouvor em functions/index.js) e conferir (tudo
 * editável antes de guardar). Nunca bloqueia por duplicata — só
 * avisa e deixa continuar (decisão 9).
 */
export default function SheetAdicionarMusica({ uid, musicas, onFechar, onCriada }) {
  const torrada = useTorrada();
  const [etapa, setEtapa] = useState("procurar");
  const [nomeBusca, setNomeBusca] = useState("");
  const [aBuscar, setABuscar] = useState(false);
  const [aBuscarMais, setABuscarMais] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [candidatoEscolhido, setCandidatoEscolhido] = useState(null);
  const [duplicata, setDuplicata] = useState(null);
  const [ignorarAviso, setIgnorarAviso] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [classificacoes, setClassificacoes] = useState([]);
  const [autoral, setAutoral] = useState(false);
  const [letra, setLetra] = useState("");
  const [cifra, setCifra] = useState("");
  const [audio, setAudio] = useState("");
  const [video, setVideo] = useState("");
  const [tom, setTom] = useState("");
  const [bpm, setBpm] = useState("");
  const [duracaoVersao, setDuracaoVersao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  async function procurar() {
    if (!nomeBusca.trim()) return torrada("Escreve o nome da música.");
    setABuscar(true);
    try {
      const { candidatos: r, temMais: m } = await pesquisarMusica(nomeBusca.trim(), 0);
      if (!r.length) torrada("Nada encontrado — podes cadastrar à mão.");
      setCandidatos(r);
      setPagina(0);
      setTemMais(m);
      setEtapa("candidatos");
    } catch (e) {
      torrada(e.message || "Não foi possível procurar.");
    } finally {
      setABuscar(false);
    }
  }

  async function procurarMais() {
    setABuscarMais(true);
    try {
      const proxima = pagina + 1;
      const { candidatos: r, temMais: m } = await pesquisarMusica(nomeBusca.trim(), proxima);
      setCandidatos((atual) => [...atual, ...r]);
      setPagina(proxima);
      setTemMais(m);
    } catch (e) {
      torrada(e.message || "Não foi possível procurar mais.");
    } finally {
      setABuscarMais(false);
    }
  }

  function preencherDe(candidato) {
    setTitulo(candidato?.titulo || nomeBusca);
    setArtista(candidato?.artista || "");
    setTom(candidato?.tom || "");
    setBpm(candidato?.bpm ? String(candidato.bpm) : "");
    setDuracaoVersao(candidato?.duracao ? String(candidato.duracao) : "");
    setCifra(candidato?.linkCifra || "");
    setLetra(candidato?.linkLetra || "");
    setAudio(candidato?.linkAudio || "");
  }

  function escolher(candidato) {
    setCandidatoEscolhido(candidato);
    preencherDe(candidato);
    const dup = encontrarDuplicata(musicas, candidato.titulo, candidato.artista);
    setDuplicata(dup);
    setIgnorarAviso(false);
    setEtapa("conferir");
  }

  function cadastroManual() {
    setCandidatoEscolhido(null);
    preencherDe(null);
    setDuplicata(null);
    setEtapa("conferir");
  }

  function alternarClassif(id) {
    setClassificacoes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function guardar() {
    if (!titulo.trim() || !artista.trim()) return torrada("Preenche o título e o artista.");
    setAGuardar(true);
    try {
      const musicaId = novaMusicaId();
      await criarMusica(musicaId, {
        titulo, artista, classificacoes, autoral,
        duracao: candidatoEscolhido?.duracao ?? null,
        links: { letra, cifra, audio, video },
        criadoPor: uid,
      });
      const versaoId = novaVersaoId(musicaId);
      await criarVersao(musicaId, versaoId, {
        nome: "Onda",
        tom, bpm: bpm ? Number(bpm) : null,
        duracao: duracaoVersao ? Number(duracaoVersao) : null,
        observacao,
        fonteTom: candidatoEscolhido?.fonteTom || "manual",
        fonteBpm: candidatoEscolhido?.fonteBpm || "manual",
        criadoPor: uid,
      });
      if (candidatoEscolhido?.deezerId) {
        aplicarCapaDeezer(musicaId, candidatoEscolhido.deezerId).catch(() => {
          torrada("Música guardada, mas a capa falhou — tenta outra vez no detalhe da música.");
        });
      }
      torrada("Música adicionada à biblioteca");
      onCriada(musicaId);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a música.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {etapa === "procurar" && (
          <>
            <h2>Adicionar música</h2>
            <p className="ds" style={{ textAlign: "center", marginTop: 6 }}>
              Escreve só o nome — mostramos os candidatos com tom, BPM e links já preenchidos.
            </p>
            <label className="rot" style={{ marginTop: 12 }}>Nome da música</label>
            <input
              className="campo" value={nomeBusca} onChange={(e) => setNomeBusca(e.target.value)}
              placeholder="Lugar Secreto" autoFocus
              onKeyDown={(e) => e.key === "Enter" && procurar()}
            />
            <button className="btn full" style={{ marginTop: 18 }} disabled={aBuscar} onClick={procurar}>
              {aBuscar ? "A procurar…" : "Procurar"}
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={cadastroManual}>
              Cadastrar à mão, sem procurar
            </button>
          </>
        )}

        {etapa === "candidatos" && (
          <>
            <h2>Escolhe a música certa</h2>
            <p className="ds" style={{ textAlign: "center", marginTop: 6 }}>"{nomeBusca}"</p>
            <div style={{ marginTop: 12, maxHeight: "55vh", overflowY: "auto" }}>
              {candidatos.map((c) => (
                <div className="bib-item" key={c.deezerId} onClick={() => escolher(c)}>
                  <div className="bib-capa" style={c.capa ? { backgroundImage: `url(${c.capa})` } : {}}>
                    {!c.capa && c.titulo[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{c.titulo}</p>
                    <p className="ds">
                      {c.artista}
                      {c.tom ? ` · Tom ${c.tom}` : ""}
                      {c.bpm ? ` · ${c.bpm} BPM` : ""}
                    </p>
                  </div>
                  <span className="seta">›</span>
                </div>
              ))}
              {candidatos.length === 0 && <div className="vaz">Nada encontrado.</div>}
              {temMais && (
                <button className="btn sec full" style={{ marginTop: 10 }} disabled={aBuscarMais} onClick={procurarMais}>
                  {aBuscarMais ? "A procurar mais…" : "Ver mais resultados"}
                </button>
              )}
            </div>
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={cadastroManual}>
              Nenhuma destas — cadastrar à mão
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setEtapa("procurar")}>Voltar</button>
          </>
        )}

        {etapa === "conferir" && (
          <>
            <h2>Confirmar dados</h2>

            {duplicata && !ignorarAviso && (
              <div className="caixa" style={{ background: "#FFF7E0", border: 0, marginTop: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>Já existe "{duplicata.titulo}" · {duplicata.artista}</p>
                <p className="ds" style={{ marginTop: 4 }}>É uma versão nova desta música, ou é mesmo outra?</p>
                <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => { onFechar(); onCriada(duplicata.id); }}>
                  Ver música existente
                </button>
                <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => setIgnorarAviso(true)}>
                  É outra música mesmo, continuar
                </button>
              </div>
            )}

            {candidatoEscolhido?.capa && (
              <div className="bib-capa-grande" style={{ backgroundImage: `url(${candidatoEscolhido.capa})` }} />
            )}

            <label className="rot" style={{ marginTop: 12 }}>Título</label>
            <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Lugar Secreto" />
            <label className="rot">Artista</label>
            <input className="campo" value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Gabriela Rocha" />

            <label className="rot">Classificações</label>
            <div className="bib-chips" style={{ margin: 0, padding: "4px 0" }}>
              {CLASSIFICACOES.map((c) => (
                <button key={c.id} className="bib-chip" data-on={classificacoes.includes(c.id) ? 1 : 0} onClick={() => alternarClassif(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>

            <label className="rot">Tom (versão Onda){candidatoEscolhido?.fonteTom && <span className="ds" style={{ marginLeft: 6 }}>· {candidatoEscolhido.fonteTom}</span>}</label>
            <input className="campo" value={tom} onChange={(e) => setTom(e.target.value)} placeholder="A" />
            <label className="rot">BPM{candidatoEscolhido?.fonteBpm && <span className="ds" style={{ marginLeft: 6 }}>· {candidatoEscolhido.fonteBpm}</span>}</label>
            <input className="campo" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="70" />
            <label className="rot">Duração (segundos)</label>
            <input className="campo" inputMode="numeric" value={duracaoVersao} onChange={(e) => setDuracaoVersao(e.target.value)} placeholder="310" />
            <label className="rot">Observação</label>
            <input className="campo" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Entra só com teclado…" />

            <label className="rot">Letra (link)</label>
            <input className="campo" value={letra} onChange={(e) => setLetra(e.target.value)} placeholder="https://…" />
            <label className="rot">Cifra (link)</label>
            <input className="campo" value={cifra} onChange={(e) => setCifra(e.target.value)} placeholder="https://…" />
            <label className="rot">Áudio (link)</label>
            <input className="campo" value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="https://…" />
            <label className="rot">Vídeo (link)</label>
            <input className="campo" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…" />

            <label className="opcao" style={{ marginTop: 10 }} onClick={() => setAutoral((v) => !v)}>
              <span style={{ flex: 1 }}>Música autoral (sem plataforma)</span>
              <span className={`chk${autoral ? " on" : ""}`}>✓</span>
            </label>

            <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
              {aGuardar ? "A guardar…" : "Guardar música"}
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setEtapa(candidatos.length ? "candidatos" : "procurar")}>Voltar</button>
          </>
        )}
      </div>
    </>
  );
}
