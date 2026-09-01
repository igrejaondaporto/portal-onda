import { useState } from "react";
import {
  novaMusicaId, novaVersaoId, criarMusica, criarVersao, encontrarDuplicata,
  buscarCapaDeezer, aplicarCapaDeezer, CLASSIFICACOES,
} from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Duas etapas: procurar (título/artista + capa no Deezer) e conferir
 * (classificações, links, tom/BPM/observação da primeira versão —
 * tudo à mão nesta fase, ver CLAUDE.md desta base). Nunca bloqueia por
 * duplicata: só avisa e deixa continuar (decisão 9).
 */
export default function SheetAdicionarMusica({ uid, musicas, onFechar, onCriada }) {
  const torrada = useTorrada();
  const [etapa, setEtapa] = useState("procurar");
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [aBuscar, setABuscar] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [capaEscolhida, setCapaEscolhida] = useState(null); // resultado do Deezer
  const [duplicata, setDuplicata] = useState(null);
  const [ignorarAviso, setIgnorarAviso] = useState(false);

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
    if (!titulo.trim() || !artista.trim()) return torrada("Preenche o título e o artista.");
    const dup = encontrarDuplicata(musicas, titulo, artista);
    setDuplicata(dup);
    setABuscar(true);
    try {
      const r = await buscarCapaDeezer(titulo.trim(), artista.trim());
      setResultados(r || []);
    } catch (e) {
      torrada(e.message || "Não foi possível procurar no Deezer — segue sem capa.");
      setResultados([]);
    } finally {
      setABuscar(false);
      setEtapa("conferir");
    }
  }

  function alternarClassif(id) {
    setClassificacoes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function guardar() {
    setAGuardar(true);
    try {
      const musicaId = novaMusicaId();
      await criarMusica(musicaId, {
        titulo, artista, classificacoes, autoral,
        duracao: capaEscolhida?.duracao ?? null,
        links: { letra, cifra, audio, video },
        criadoPor: uid,
      });
      const versaoId = novaVersaoId(musicaId);
      await criarVersao(musicaId, versaoId, {
        nome: "Onda",
        tom, bpm: bpm ? Number(bpm) : null,
        duracao: duracaoVersao ? Number(duracaoVersao) : null,
        observacao, criadoPor: uid,
      });
      if (capaEscolhida?.deezerId) {
        aplicarCapaDeezer(musicaId, capaEscolhida.deezerId).catch(() => {
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
        {etapa === "procurar" ? (
          <>
            <h2>Adicionar música</h2>
            <p className="ds" style={{ textAlign: "center", marginTop: 6 }}>
              Título e artista identificam a música — um cover é música separada.
            </p>
            <label className="rot">Título</label>
            <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Lugar Secreto" autoFocus />
            <label className="rot">Artista</label>
            <input className="campo" value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Gabriela Rocha" />
            <button className="btn full" style={{ marginTop: 18 }} disabled={aBuscar} onClick={procurar}>
              {aBuscar ? "A procurar…" : "Procurar capa no Deezer"}
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => { setResultados([]); setCapaEscolhida(null); setEtapa("conferir"); }}>
              Continuar sem procurar
            </button>
          </>
        ) : (
          <>
            <h2>Confirmar dados</h2>
            <p className="sb2">{titulo} · {artista}</p>

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

            {resultados.length > 0 && (
              <>
                <label className="rot">Capa (Deezer)</label>
                <div className="bib-capas-opcoes">
                  {resultados.map((r) => (
                    <div
                      key={r.deezerId} className="bib-capa-opcao"
                      data-on={capaEscolhida?.deezerId === r.deezerId ? 1 : 0}
                      style={{ backgroundImage: `url(${r.capa})` }}
                      onClick={() => setCapaEscolhida(capaEscolhida?.deezerId === r.deezerId ? null : r)}
                      title={`${r.titulo} · ${r.artista}`}
                    />
                  ))}
                </div>
              </>
            )}

            <label className="rot">Classificações</label>
            <div className="bib-chips" style={{ margin: 0, padding: "4px 0" }}>
              {CLASSIFICACOES.map((c) => (
                <button key={c.id} className="bib-chip" data-on={classificacoes.includes(c.id) ? 1 : 0} onClick={() => alternarClassif(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>

            <label className="rot">Tom (versão Onda)</label>
            <input className="campo" value={tom} onChange={(e) => setTom(e.target.value)} placeholder="A" />
            <label className="rot">BPM</label>
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
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setEtapa("procurar")}>Voltar</button>
          </>
        )}
      </div>
    </>
  );
}
