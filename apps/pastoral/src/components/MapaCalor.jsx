import { useState } from "react";

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
  const comMapa = cultos.filter((c) => c.acomodacao);
  if (!comMapa.length) return <div className="vaz">{vazio}</div>;

  const mostrado = foco ?? comMapa.at(-1);
  const a = mostrado.acomodacao;
  const pct = Math.round(a.percentagem * 100);

  return (
    <>
      <div className="pa-calor">
        {comMapa.map((c) => {
          const cor = passo(c.acomodacao.percentagem);
          const ativo = c.eventoId === mostrado.eventoId;
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

      {/* legenda: a escala é fixa, por isso pode ser desenhada uma vez
          e não muda com o período — é o que a torna comparável entre
          janelas de datas */}
      <div className="pa-calor-legenda">
        <span>0%</span>
        {RAMPA.map((c) => <i key={c} style={{ background: c }} />)}
        <span>100%</span>
      </div>

      <div className="caixa" style={{ marginTop: 12 }}>
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
    </>
  );
}
