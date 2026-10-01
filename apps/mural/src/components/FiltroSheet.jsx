import { ORDENS, REGIOES, categoriasDe, chaveCategoria } from "../lib/util.js";

const GRUPOS = [
  { tipo: "ofereco", titulo: "Ofereço" },
  { tipo: "procuro", titulo: "Procuro" },
];

/** Categoria + região num botão só ("Filtro"), em vez de duas fileiras
 *  de pílulas sempre visíveis — pedido explícito, 2026-09: os dois
 *  filtros juntos, escondidos até a pessoa querer usar. Mesmo padrão
 *  de folha do DetalheAnuncio (.veu + .pin).
 *
 *  Revisto com Produtos/Serviços (2026-10): as categorias são só as da
 *  natureza aberta (Serviços nunca mostra "Vendo"), e em "Tudo" já não
 *  desaparecem — aparecem em dois grupos, Ofereço e Procuro, porque
 *  "Faço serviços" e "Preciso de um serviço" são o mesmo id com
 *  sentidos opostos. Por isso a escolha guarda o tipo junto
 *  (`chaveCategoria`, lib/util.js). */
export default function FiltroSheet({ natureza, tipo, regiao, setRegiao, categoria, setCategoria, ordem, setOrdem, onFechar }) {
  const grupos = GRUPOS
    .filter((g) => tipo === "tudo" || g.tipo === tipo)
    .map((g) => ({ ...g, categorias: categoriasDe(natureza, g.tipo) }));
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Filtrar anúncios">
        <div className="pux" />
        <h2 style={{ textAlign: "left" }}>Filtrar {natureza === "servico" ? "serviços" : "produtos"}</h2>

        {/* Ordenar (2026-10): "Mais baratos" = grátis primeiro, depois
            do menor para o maior valor. Com foto sobe sempre (ver
            ordenar em lib/util.js). */}
        <span className="rot" style={{ marginTop: 6 }}>Ordenar</span>
        <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
          {ORDENS.map((o) => (
            <button key={o.id} data-on={ordem === o.id ? 1 : 0} onClick={() => setOrdem(o.id)}>{o.nome}</button>
          ))}
        </div>
        <p className="ds" style={{ margin: "2px 0 4px" }}>Os anúncios com foto aparecem sempre primeiro.</p>

        <span className="rot">Categoria</span>
        <div className="menu" style={{ padding: "8px 0 0", position: "static" }}>
          <button data-on={categoria === "todas" ? 1 : 0} onClick={() => setCategoria("todas")}>Todas as categorias</button>
        </div>
        {grupos.map((g) => (
          <div key={g.tipo}>
            {grupos.length > 1 && <span className="rot" style={{ marginTop: 6 }}>{g.titulo}</span>}
            <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
              {g.categorias.map((c) => {
                const chave = chaveCategoria(g.tipo, c.id);
                return (
                  <button key={chave} data-on={categoria === chave ? 1 : 0} onClick={() => setCategoria(chave)}>{c.nome}</button>
                );
              })}
            </div>
          </div>
        ))}

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
