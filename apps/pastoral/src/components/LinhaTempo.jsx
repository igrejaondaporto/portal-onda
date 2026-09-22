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

/** O passo da grelha em número fechado (50, 100, 150…), nunca uma
 *  fração do topo do gráfico — um fio a dizer "37" não ajuda ninguém a
 *  fazer contas de cabeça. Escolhe 1, 2 ou 5 vezes uma potência de
 *  dez, o mesmo truque de qualquer eixo de gráfico. */
function passoAgradavel(bruto) {
  if (!(bruto > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(bruto));
  const frac = bruto / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

export default function LinhaTempo({
  pontos, formatar = String, vazio = "Ainda não há números para mostrar.", altura = 132,
}) {
  const [foco, setFoco] = useState(null);
  const validos = pontos.filter((p) => typeof p.valor === "number");
  if (validos.length < 2) return <div className="vaz">{vazio}</div>;

  const valores = validos.map((p) => p.valor);
  const max = Math.max(...valores);

  // a grelha define o topo, não o contrário: a última linha fica
  // sempre ACIMA do maior valor de verdade, nunca abaixo — bug real,
  // reportado 2026-09 ("em 13 de set teve 13 visitantes, e a linha
  // maior do gráfico é o 10"), porque antes o topo vinha de max*1.15 e
  // a grelha parava na última linha ANTES desse topo, que podia cair
  // abaixo do máximo. O eixo começa em zero de propósito: numa
  // contagem de presenças, um eixo que começa no mínimo transforma
  // uma oscilação de 5% num precipício, e é a forma mais fácil de um
  // gráfico mentir sem mentir.
  const passo = passoAgradavel((max || 1) / 3);
  const linhasGrelha = [];
  for (let v = passo; v <= max; v += passo) linhasGrelha.push(v);
  linhasGrelha.push((linhasGrelha.at(-1) ?? 0) + passo); // sempre uma acima do máximo
  const topo = linhasGrelha.at(-1);

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

  // grelha com o valor que cada fio representa, em números fechados —
  // sem isto ("falta legenda", mesmo relato) os fios não diziam nada,
  // só cortavam o gráfico ao meio. Os valores já saíram calculados
  // acima (é o que define o topo); só falta a posição de cada um.
  const grelha = linhasGrelha.map((v) => ({ chave: v, y: 100 - (v / topo) * 100, valor: v }));

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

      {/* a data de cada domingo com informação à vista, sempre por
          baixo da própria bolinha — não numa faixa fixa lá em baixo,
          que só dava para mostrar três datas de cada vez e confundia
          qual pertencia a qual (mesmo relato: "a data devia estar
          abaixo da bolinha com a informação") */}
      {validos.map((p, i) => (rotulados.has(i) || i === mostrado.i ? (
        <span key={`d${p.chave ?? i}`} className="pa-graf-data" style={{ left: `${x(i)}%`, top: `${y(p.valor)}%` }}>
          {p.rotulo}
        </span>
      ) : null))}
    </div>
  );
}
