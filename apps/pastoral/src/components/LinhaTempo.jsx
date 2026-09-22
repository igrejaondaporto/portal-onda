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

  const iPrimeiro = 0;
  const iMax = valores.indexOf(max);
  const iUltimo = validos.length - 1;
  // primeiro, recorde e último ficam sempre com o valor à vista, sem
  // precisar de tocar — o primeiro tinha ficado de fora (bug real,
  // reportado 2026-09: "não aparece o número certo do primeiro
  // valor" era isto, o ponto nunca tinha rótulo nenhum ao lado)
  const rotulados = new Set([iPrimeiro, iMax, iUltimo]);
  const mostrado = foco ?? { i: iUltimo, ponto: validos[iUltimo] };

  // grelha com o valor que cada fio representa — sem isto ("falta
  // legenda", mesmo relato) os três fios não diziam nada, só cortavam
  // o gráfico ao meio
  const grelha = [0.25, 0.5, 0.75].map((f) => ({ chave: f, y: 100 - f * 100, valor: Math.round(topo * f) }));

  return (
    <div className="pa-graf" style={{ height: altura }}>
      <svg
        className="pa-graf-svg" viewBox="0 0 100 100" preserveAspectRatio="none"
        aria-hidden="true" focusable="false"
      >
        {/* grelha: fios sólidos, um tom acima do fundo — tracejado
            leria como "previsão" ou "limite", e isto é só uma grelha */}
        {grelha.map((g) => (
          <line key={g.chave} x1="0" y1={g.y} x2="100" y2={g.y} stroke="var(--fio)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={area} fill="var(--azul)" opacity="0.08" />
        <polyline
          points={linha} fill="none" stroke="var(--azul)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* o valor de cada fio da grelha, fora do SVG esticado pela
          mesma razão dos pontos/rótulos abaixo */}
      {grelha.map((g) => (
        <span key={`g${g.chave}`} className="pa-graf-grelha" style={{ top: `${g.y}%` }}>{formatar(g.valor)}</span>
      ))}

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
        <span>{validos[iPrimeiro].rotulo}</span>
        {/* só entra um terceiro rótulo no meio quando o tocado não é
            já o primeiro nem o último — sem esta condição, o estado
            por omissão (mostrado = último) repetia a MESMA data duas
            vezes seguidas (bug real, mesmo relato) */}
        {mostrado.i !== iPrimeiro && mostrado.i !== iUltimo && <b>{mostrado.ponto.rotulo}</b>}
        <span>{validos[iUltimo].rotulo}</span>
      </div>
    </div>
  );
}
