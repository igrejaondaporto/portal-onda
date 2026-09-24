import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * "Presença na igreja", domingo a domingo — colunas empilhadas
 * (auditório + voluntários + crianças).
 *
 * Colunas e não uma linha: a pergunta é "quanta gente, e feita de
 * quê?" — parte de um todo ao longo do tempo. A linha só dizia o
 * total, e a data de cada ponto andava atrás da bolinha, para cima e
 * para baixo com o valor (o bug reportado 2026-09: "a data não fica
 * no sítio certo"). Aqui cada data mora numa linha fixa por baixo da
 * própria coluna, sempre à mesma altura.
 *
 * As três cores saíram do validador de paletas (daltonismo, contraste
 * e a separação entre vizinhas), não de escolher a olho: o azul da
 * marca (#0019be) é escuro demais para ficar ao lado de outras duas
 * cores e continuar distinguível, por isso a série usa o passo da
 * mesma rampa que o Mapa de Calor já usa (#2640c5). Texto nunca leva
 * a cor da série — o quadradinho ao lado é que diz qual é qual.
 *
 * Com muitos domingos (12 meses ≈ 50) as colunas não cabem num
 * telemóvel sem ficarem fios: o gráfico passa a deslizar para o lado
 * DENTRO do cartão (a página nunca), e abre já no fim — o domingo mais
 * recente é o que se procura primeiro.
 */
export const SERIES = [
  { chave: "auditorio", rotulo: "Auditório", cor: "#2640c5" },
  { chave: "voluntarios", rotulo: "Voluntários", cor: "#0092d4" },
  { chave: "criancas", rotulo: "Crianças", cor: "#ff2e88" },
];

const ALTURA = 168;     // px da área das colunas
const LARGURA_MIN = 31; // px por domingo — abaixo disto a data já não cabe (10 domingos cabem num telemóvel)

function passoAgradavel(bruto) {
  if (!(bruto > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(bruto));
  const frac = bruto / base;
  return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * base;
}

/** `pontos`: `[{ chave, rotulo, data, auditorio, voluntarios, criancas,
 *  total, visitantes, fonte }]`, já filtrados aos que têm total. */
export default function ColunasPresenca({ pontos, vazio }) {
  const [foco, setFoco] = useState(null);
  const scroll = useRef(null);
  const [cabem, setCabem] = useState(true);

  // trocar de período muda os pontos — o domingo tocado antes pode
  // já nem existir, e ficar "preso" nele parecia que o toque não fazia
  // nada (mesmo bug já corrigido no Mapa de Calor)
  useEffect(() => setFoco(null), [pontos]);

  // abre no fim (o domingo mais recente), e só desliza quando não cabe
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setCabem(el.scrollWidth <= el.clientWidth + 1);
  }, [pontos]);

  if (!pontos.length) return <div className="vaz">{vazio}</div>;

  const max = Math.max(...pontos.map((p) => p.total), 1);
  const passo = passoAgradavel(max / 3);
  const grelha = [];
  for (let v = passo; v <= max; v += passo) grelha.push(v);
  grelha.push((grelha.at(-1) ?? 0) + passo); // sempre uma linha acima do máximo
  const topo = grelha.at(-1);

  const iSel = foco === null ? pontos.length - 1 : Math.min(foco, pontos.length - 1);
  const sel = pontos[iSel];
  const iMax = pontos.findIndex((p) => p.total === max);
  // um número em cada coluna só quando há poucas — com 50, seria uma
  // parede de números; aí ficam o primeiro, o recorde e o tocado
  const todos = pontos.length <= 14;
  const comNumero = (i) => todos || i === 0 || i === iMax || i === iSel || i === pontos.length - 1;

  return (
    <div className="pc">
      <div className="pc-legenda">
        {SERIES.map((s) => (
          <span key={s.chave}><i style={{ background: s.cor }} />{s.rotulo}</span>
        ))}
      </div>

      <div className="pc-corpo">
        <div className="pc-eixo" style={{ height: ALTURA }} aria-hidden="true">
          {grelha.map((v) => (
            <span key={v} style={{ bottom: `${(v / topo) * 100}%` }}>{v}</span>
          ))}
          <span style={{ bottom: 0 }}>0</span>
        </div>

        <div className={`pc-scroll${cabem ? "" : " desliza"}`} ref={scroll}>
          <div className="pc-trilho" style={{ minWidth: pontos.length * LARGURA_MIN }}>
            <div className="pc-plot" style={{ height: ALTURA }}>
              {grelha.map((v) => (
                <i key={v} className="pc-fio" style={{ bottom: `${(v / topo) * 100}%` }} />
              ))}
              {pontos.map((p, i) => {
                const on = i === iSel;
                const partes = SERIES.map((s) => ({ ...s, valor: p[s.chave] ?? 0 })).filter((s) => s.valor > 0);
                return (
                  <button
                    key={p.chave}
                    className={`pc-col${on ? " on" : ""}`}
                    onClick={() => setFoco(i)}
                    aria-label={`${p.rotulo}: ${p.total} pessoas — ${SERIES.map((s) => `${s.rotulo} ${p[s.chave] ?? 0}`).join(", ")}`}
                    aria-pressed={on}
                  >
                    <span className="pc-pilha" style={{ height: `${(p.total / topo) * 100}%` }}>
                      {comNumero(i) && <b className="pc-total">{p.total}</b>}
                      {/* de cima para baixo, porque é uma coluna flex
                          invertida: o auditório fica sempre no chão */}
                      {partes.map((s) => (
                        <span key={s.chave} className="pc-seg" style={{ flexGrow: s.valor, background: s.cor }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pc-datas">
              {pontos.map((p, i) => (
                <span key={p.chave} className={i === iSel ? "on" : ""}>{p.rotulo}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!cabem && <p className="cap pc-dica">Desliza para ver domingos anteriores</p>}

      <div className="pc-detalhe" aria-live="polite">
        <div className="pc-detalhe-topo">
          <div>
            <p className="ds" style={{ margin: 0 }}>{sel.rotuloLongo ?? sel.rotulo}</p>
            <p className="pa-num" style={{ marginTop: 2 }}>{sel.total}</p>
          </div>
          <span className="pc-fonte">fonte: {sel.fonte === "mapa" ? "Mapa" : "Contagem"}</span>
        </div>
        <ul className="pc-partes">
          {SERIES.map((s) => (
            <li key={s.chave}>
              <i style={{ background: s.cor }} />
              <span>{s.rotulo}</span>
              <b>{sel[s.chave] ?? "—"}</b>
            </li>
          ))}
        </ul>
        {sel.visitantes !== null && sel.visitantes !== undefined && (
          <p className="ds" style={{ marginTop: 8 }}>
            {sel.visitantes === 0 ? "Nenhum visitante" : `${sel.visitantes} visitante${sel.visitantes === 1 ? "" : "s"}`} no auditório
          </p>
        )}
      </div>
    </div>
  );
}
