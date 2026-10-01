import { REGIOES, categoriasDe } from "../lib/util.js";

/** Categoria + região num botão só ("Filtro"), em vez de duas fileiras
 *  de pílulas sempre visíveis — pedido explícito, 2026-09: os dois
 *  filtros juntos, escondidos até a pessoa querer usar. Mesmo padrão
 *  de folha do DetalheAnuncio (.veu + .pin). */
export default function FiltroSheet({ natureza, tipo, regiao, setRegiao, categoria, setCategoria, onFechar }) {
  // em "Tudo" (Ofereço e Procuro juntos) as categorias não fazem
  // sentido — "Vendo" e "Compro" não são a mesma coisa —, só a região
  const categorias = tipo === "tudo" ? [] : categoriasDe(natureza, tipo);
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Filtrar anúncios">
        <div className="pux" />
        <h2 style={{ textAlign: "left" }}>Filtrar</h2>

        {categorias.length > 0 && (
          <>
            <span className="rot" style={{ marginTop: 6 }}>Categoria</span>
            <div className="menu" style={{ padding: "8px 0 4px", position: "static" }}>
              <button data-on={categoria === "todas" ? 1 : 0} onClick={() => setCategoria("todas")}>Tudo</button>
              {categorias.map((c) => (
                <button key={c.id} data-on={categoria === c.id ? 1 : 0} onClick={() => setCategoria(c.id)}>{c.nome}</button>
              ))}
            </div>
          </>
        )}

        <span className="rot">Região</span>
        <div className="menu" style={{ padding: "8px 0 4px", position: "static" }}>
          <button data-on={regiao === "todas" ? 1 : 0} onClick={() => setRegiao("todas")}>Todas</button>
          {REGIOES.map((r) => (
            <button key={r.id} data-on={regiao === r.id ? 1 : 0} onClick={() => setRegiao(r.id)}>{r.nome}</button>
          ))}
        </div>

        <button className="btn full" onClick={onFechar}>Ver anúncios</button>
      </div>
    </>
  );
}
