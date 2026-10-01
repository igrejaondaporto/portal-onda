import { ORDENS, TEMAS, categoriasDe, chaveCategoria } from "../lib/util.js";

/** Filtro do mural — uma folha só (pedido 2026-09: escondido até a
 *  pessoa o querer usar). Mesmo padrão de folha do DetalheAnuncio
 *  (.veu + .pin). Três coisas, por esta ordem (revisto 2026-10):
 *
 *  - **Ordenar** — mais recentes / mais baratos (grátis primeiro) /
 *    mais caros; com foto sobe sempre (`ordenar`, lib/util.js).
 *  - **Categoria** — SÓ da natureza aberta (em Serviços nunca aparece
 *    nada de Produtos). Em Ofereço/Procuro, as categorias desse lado;
 *    em "Tudo", temas que juntam os dois ("Boleias" = dou + preciso),
 *    em vez de duas listas com "Outros" repetido (`TEMAS`).
 *  - **Onde** — as cidades que os anúncios trazem (e, escolhida uma,
 *    as freguesias dela), com quantos anúncios tem cada. Não é uma
 *    lista fixa: cresce à medida que se publica com cidade. Os
 *    anúncios antigos, sem cidade, aparecem pela região (Norte…). */
export default function FiltroSheet({ natureza, tipo, categoria, setCategoria, ordem, setOrdem, lugar, setLugar, lugares, onFechar }) {
  const opcoes = tipo === "tudo"
    ? TEMAS[natureza].map((t) => ({ chave: `tema:${t.id}`, nome: t.nome }))
    : categoriasDe(natureza, tipo).map((c) => ({ chave: chaveCategoria(tipo, c.id), nome: c.nome }));
  const [cidadeEscolhida] = lugar === "todas" ? [null] : lugar.split("||");
  const daCidade = lugares.find((l) => l.cidade === cidadeEscolhida);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Filtrar anúncios">
        <div className="pux" />
        <h2 style={{ textAlign: "left" }}>Filtrar {natureza === "servico" ? "serviços" : "produtos"}</h2>

        <span className="rot" style={{ marginTop: 6 }}>Ordenar</span>
        <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
          {ORDENS.map((o) => (
            <button key={o.id} data-on={ordem === o.id ? 1 : 0} onClick={() => setOrdem(o.id)}>{o.nome}</button>
          ))}
        </div>
        <p className="ds" style={{ margin: "2px 0 4px" }}>Os anúncios com foto aparecem sempre primeiro.</p>

        <span className="rot">Categoria</span>
        <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
          <button data-on={categoria === "todas" ? 1 : 0} onClick={() => setCategoria("todas")}>Todas</button>
          {opcoes.map((o) => (
            <button key={o.chave} data-on={categoria === o.chave ? 1 : 0} onClick={() => setCategoria(o.chave)}>{o.nome}</button>
          ))}
        </div>

        <span className="rot">Onde</span>
        <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
          <button data-on={lugar === "todas" ? 1 : 0} onClick={() => setLugar("todas")}>Todo o lado</button>
          {lugares.map((l) => (
            <button key={l.cidade} data-on={cidadeEscolhida === l.cidade ? 1 : 0} onClick={() => setLugar(l.cidade)}>
              {l.cidade} <small className="contaOpcao">{l.n}</small>
            </button>
          ))}
        </div>
        {daCidade?.freguesias.length > 0 && (
          <>
            <span className="rot">Freguesia em {daCidade.cidade}</span>
            <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
              <button data-on={lugar === daCidade.cidade ? 1 : 0} onClick={() => setLugar(daCidade.cidade)}>Todas</button>
              {daCidade.freguesias.map((f) => {
                const chave = `${daCidade.cidade}||${f.nome}`;
                return (
                  <button key={chave} data-on={lugar === chave ? 1 : 0} onClick={() => setLugar(chave)}>
                    {f.nome} <small className="contaOpcao">{f.n}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button className="btn full" onClick={onFechar}>Ver anúncios</button>
      </div>
    </>
  );
}
