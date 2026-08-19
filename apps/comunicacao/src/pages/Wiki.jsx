import { useEffect, useState } from "react";
import { ouvirArtigos, agruparPorCategoria } from "../lib/wiki";
import SheetArtigo from "../components/wiki/SheetArtigo";

const COR_CATEGORIA = { passo: "#0019BE", duvida: "#FF2E88", artigo: "#00A88F" };

export default function Wiki({ ativo, definirCabecalho, wikiIdFoco }) {
  const [artigos, setArtigos] = useState([]);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState({});
  const [artigoAberto, setArtigoAberto] = useState(null);

  useEffect(() => ouvirArtigos(setArtigos), []);

  useEffect(() => {
    if (!wikiIdFoco || !artigos.length) return;
    const a = artigos.find((x) => x.id === wikiIdFoco);
    if (a) setArtigoAberto(a);
  }, [wikiIdFoco, artigos]);

  const grupos = agruparPorCategoria(artigos, busca);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Wiki",
      subtitulo: "Passo a passo e artigos da equipa",
      chips: [`${artigos.length} publicados`],
    });
  }, [ativo, artigos.length, definirCabecalho]);

  return (
    <>
      <div className="sect">
        <input
          className="campo" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar por título ou resumo"
        />
      </div>

      <div className="sect">
        {grupos.length === 0 && <div className="vaz">{busca ? "Nada encontrado." : "Ainda não há nada na Wiki."}</div>}
        {grupos.map((g) => {
          const aberto = !!busca || !!abertos[g.chave];
          const cor = COR_CATEGORIA[g.chave];
          return (
            <div className="mincartao" key={g.chave}>
              <div className="mincartao-barra" style={{ background: cor }} />
              <button
                className="mincartao-cab cabtoque"
                data-aberto={aberto ? 1 : 0}
                aria-expanded={aberto}
                onClick={() => setAbertos((v) => ({ ...v, [g.chave]: !v[g.chave] }))}
              >
                <span className="ponto" style={{ background: cor }} />
                <span className="nome">{g.nome}</span>
                <span className="conta">{g.itens.length}</span>
              </button>
              {aberto && g.itens.map((a) => (
                <div className="linha" style={{ cursor: "pointer" }} key={a.id} onClick={() => setArtigoAberto(a)}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{a.titulo}</p>
                    {a.resumo && <p className="ds">{a.resumo}</p>}
                  </div>
                  <span className="seta">›</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {artigoAberto && <SheetArtigo artigo={artigoAberto} onFechar={() => setArtigoAberto(null)} />}
    </>
  );
}
