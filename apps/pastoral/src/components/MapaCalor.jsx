import { useEffect, useState } from "react";

/**
 * Ocupação do auditório, domingo a domingo.
 *
 * Uma grelha de quadrados, um por culto, mais escuro quanto mais
 * cheio. É a forma certa para esta pergunta: uma linha responde "está
 * a subir?", mas a pergunta aqui é outra — "quais foram os domingos
 * cheios?" — e num quadriculado isso vê-se sem seguir uma linha.
 *
 * A rampa é de UM tom (a mesma família azul validada de `CORES_ETAPA`,
 * ver `lib/contactos.js`): magnitude é sempre um hue só, do claro ao
 * escuro. Um arco-íris aqui — verde "bom", vermelho "mau" — seria pior
 * do que inútil, porque um domingo cheio não é bom nem mau em si: 95%
 * quer dizer que faltam lugares, e é por isso que o número importa.
 *
 * A escala é FIXA em 0–100% da capacidade útil, nunca normalizada ao
 * máximo do período. Normalizar faria o domingo mais cheio de um mês
 * fraco ficar tão escuro como uma casa cheia, e o mapa passaria a
 * mentir de forma diferente em cada janela de datas.
 */
const RAMPA = ["#9aabee", "#7b8fe6", "#5d74db", "#4059cf", "#2640c5", "#0019be"];

/** 0–1 → um dos seis passos. Zero não é o passo mais claro: é um
 *  quadrado vazio, com contorno — "ninguém" e "poucos" são coisas
 *  diferentes, e no mapa têm de se distinguir sem contar tons. */
function passo(pct) {
  if (!pct) return null;
  return RAMPA[Math.min(RAMPA.length - 1, Math.floor(pct * RAMPA.length))];
}

export default function MapaCalor({ cultos, vazio = "Ainda não há mapas de auditório fechados." }) {
  const [foco, setFoco] = useState(null);
  // sem isto, trocar de período (3 meses/12 meses/Este ano) deixava o
  // quadrado tocado de um período anterior "preso" — a folha de baixo
  // continuava a mostrar o domingo antigo, e tocar num quadrado do
  // período novo parecia não fazer nada porque a informação já
  // esperada (o último domingo) só reaparecia ao tocar duas vezes
  useEffect(() => setFoco(null), [cultos]);
  if (!cultos.length) return <div className="vaz">{vazio}</div>;

  const comMapa = cultos.filter((c) => c.acomodacao);
  const mostrado = foco ?? comMapa.at(-1) ?? null;
  const a = mostrado?.acomodacao ?? null;
  const pct = a ? Math.round(a.percentagem * 100) : null;

  return (
    <>
      <div className="pa-calor">
        {/* TODOS os cultos do período entram, não só os fechados — um
            domingo sem mapa some da grelha em vez de aparecer, e é
            isso que parecia bug ("não dá pra clicar, pq não fechou é
            isso?", reportado 2026-09). Aqui aparece, cinzento e sem
            toque, para responder à própria pergunta. */}
        {cultos.map((c) => {
          if (!c.acomodacao) {
            return (
              <span
                key={c.eventoId}
                className="pa-calor-q porfechar"
                aria-label={`${c.data}: mapa ainda por fechar`}
                title="A Base Pessoal ainda não fechou o mapa deste domingo"
              />
            );
          }
          const cor = passo(c.acomodacao.percentagem);
          const ativo = mostrado && c.eventoId === mostrado.eventoId;
          return (
            <button
              key={c.eventoId}
              className={`pa-calor-q${ativo ? " on" : ""}${cor ? "" : " vazio"}`}
              style={cor ? { background: cor } : undefined}
              onClick={() => setFoco(c)}
              aria-label={`${c.data}: ${Math.round(c.acomodacao.percentagem * 100)}% de ocupação`}
            />
          );
        })}
      </div>

      {mostrado ? (
        <div className="caixa" style={{ marginTop: 14 }}>
          <p className="ds" style={{ marginTop: 0 }}>{mostrado.data}</p>
          <p className="pa-num">{pct}%</p>
          <p className="ds" style={{ marginTop: 2 }}>
            {a.ocupados + a.visitantes} de {a.capacidadeUtil} lugares úteis
            {a.visitantes > 0 ? ` · ${a.visitantes} de visitante` : ""}
            {a.reservados > 0 || a.bloqueados > 0
              ? ` · ${a.reservados + a.bloqueados} fora de contagem`
              : ""}
          </p>
        </div>
      ) : (
        <p className="ds" style={{ marginTop: 10 }}>
          Os quadrados cinzentos são domingos cujo mapa a Base Pessoal ainda não fechou.
        </p>
      )}
    </>
  );
}
