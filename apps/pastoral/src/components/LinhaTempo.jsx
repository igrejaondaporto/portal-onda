import { useState } from "react";

/**
 * Presença domingo a domingo — uma série só, ao longo do tempo.
 *
 * Uma série só, por isso não leva legenda: o título do bloco já diz o
 * que é. E não leva um número por ponto — seria caos e ninguém lê;
 * ficam rotulados só o último ponto (onde estamos) e o mais alto (o
 * recorde), que são os dois que alguém procura. O resto sai no toque.
 *
 * Desenhado em SVG à mão, sem biblioteca de gráficos: são ~30 pontos
 * e uma polilinha. Uma dependência nova de 40 kB para isto seria mais
 * peso do que o produto inteiro ganha — o mesmo raciocínio que levou
 * as notas e moedas do Financeiro a serem SVG em vez de imagens.
 *
 * `viewBox` com `preserveAspectRatio="none"` faz o gráfico esticar à
 * largura do telemóvel; por isso os textos e os pontos NÃO vivem
 * dentro dele (esticariam também) — ficam em HTML por cima, em
 * percentagem. É o que mantém a tipografia legível num ecrã estreito.
 */
const L = 8;    // margem interna, em % — dá espaço aos rótulos das pontas

export default function LinhaTempo({
  pontos, formatar = String, vazio = "Ainda não há números para mostrar.", altura = 132,
}) {
  const [foco, setFoco] = useState(null);
  const validos = pontos.filter((p) => typeof p.valor === "number");
  if (validos.length < 2) return <div className="vaz">{vazio}</div>;

  const valores = validos.map((p) => p.valor);
  const max = Math.max(...valores);
  // o eixo começa em zero de propósito: numa contagem de presenças, um
  // eixo que começa no mínimo transforma uma oscilação de 5% num
  // precipício, e é a forma mais fácil de um gráfico mentir sem mentir
  const topo = max * 1.15 || 1;

  const x = (i) => L + (i / (validos.length - 1)) * (100 - 2 * L);
  const y = (v) => 100 - (v / topo) * 100;

  const linha = validos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ");
  const area = `${L},100 ${linha} ${100 - L},100`;

  const iMax = valores.indexOf(max);
  const iUltimo = validos.length - 1;
  // nunca os dois no mesmo sítio: se o último ponto é o recorde, um
  // rótulo só, senão ficariam sobrepostos e ilegíveis
  const rotulados = new Set(iMax === iUltimo ? [iUltimo] : [iMax, iUltimo]);
  const mostrado = foco ?? { i: iUltimo, ponto: validos[iUltimo] };

  return (
    <div className="pa-graf" style={{ height: altura }}>
      <svg
        className="pa-graf-svg" viewBox="0 0 100 100" preserveAspectRatio="none"
        aria-hidden="true" focusable="false"
      >
        {/* grelha: fios sólidos, um tom acima do fundo — tracejado
            leria como "previsão" ou "limite", e isto é só uma grelha */}
        {[25, 50, 75].map((g) => (
          <line key={g} x1="0" y1={g} x2="100" y2={g} stroke="var(--fio)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={area} fill="var(--azul)" opacity="0.08" />
        <polyline
          points={linha} fill="none" stroke="var(--azul)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* os pontos e os rótulos vivem fora do SVG esticado, senão
          esticavam com ele (um círculo viraria uma elipse) */}
      {validos.map((p, i) => (
        <button
          key={p.chave ?? i}
          className={`pa-graf-pt${i === mostrado.i ? " on" : ""}`}
          style={{ left: `${x(i)}%`, top: `${y(p.valor)}%` }}
          onClick={() => setFoco(foco?.i === i ? null : { i, ponto: p })}
          aria-label={`${p.rotulo}: ${formatar(p.valor)}`}
        />
      ))}

      {validos.map((p, i) => (rotulados.has(i) && i !== mostrado.i ? (
        <span key={`r${p.chave ?? i}`} className="pa-graf-rot" style={{ left: `${x(i)}%`, top: `${y(p.valor)}%` }}>
          {formatar(p.valor)}
        </span>
      ) : null))}

      <span className="pa-graf-rot on" style={{ left: `${x(mostrado.i)}%`, top: `${y(mostrado.ponto.valor)}%` }}>
        {formatar(mostrado.ponto.valor)}
      </span>

      <div className="pa-graf-eixo">
        <span>{validos[0].rotulo}</span>
        <b>{mostrado.ponto.rotulo}</b>
        <span>{validos[iUltimo].rotulo}</span>
      </div>
    </div>
  );
}
