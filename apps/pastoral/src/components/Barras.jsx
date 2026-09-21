/**
 * Barras horizontais de magnitude — a mesma forma que o Financeiro já
 * usa ("quanto foi para quê"), com uma diferença: aqui o valor nem
 * sempre é dinheiro. O `formatar` entra por prop, com o número cru por
 * omissão, em vez de `eur` cravado no componente.
 *
 * Um hue só, ordenadas de maior para menor, valor sempre à vista à
 * direita. `cor` por linha é opcional e só se usa quando a cor JÁ
 * significa alguma coisa — a cor da base, que o resto do produto usa
 * para a mesma base em todo o lado. Para categorias, meses ou
 * qualquer coisa sem identidade própria fica tudo a azul: aí a cor
 * seria a repetir o comprimento da barra, que já diz o mesmo.
 */
const cru = (v) => String(v);

export default function Barras({ linhas, vazio = "Ainda não há nada para mostrar.", formatar = cru }) {
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
              {formatar(l.valor)}
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
