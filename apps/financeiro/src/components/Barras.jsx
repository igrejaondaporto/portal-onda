import { eur } from "@portal/shared/lib/data.js";

/**
 * Barras horizontais de magnitude — um hue só, ordenadas de maior
 * para menor, com o valor sempre à vista à direita. É a mesma forma
 * ("quanto foi para quê") em Início e em Relatórios, por isso é um
 * componente e não duas cópias.
 *
 * `cor` por linha é opcional: só se usa quando a cor JÁ significa
 * alguma coisa (a cor da base, que o resto da app usa para a mesma
 * base). Para categorias ou meses não há cor própria nenhuma — aí
 * fica tudo a azul, que é magnitude e não identidade.
 */
export default function Barras({ linhas, vazio = "Ainda não há nada para mostrar." }) {
  if (!linhas.length) return <div className="vaz">{vazio}</div>;
  const maior = Math.max(...linhas.map((l) => l.valor), 1);
  return (
    <>
      {linhas.map((l) => (
        <div className="fila" style={{ paddingTop: 13 }} key={l.chave}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.02em", display: "flex", alignItems: "center", minWidth: 0 }}>
              {l.cor && <span className="quadmin" style={{ background: l.cor }} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.rotulo}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", flex: "none" }}>
              {eur(l.valor)}
            </span>
          </div>
          <div className="barra" style={{ marginTop: 7 }}>
            <i style={{ width: `${(l.valor / maior) * 100}%`, background: l.cor ?? "var(--azul)" }} />
          </div>
        </div>
      ))}
    </>
  );
}
