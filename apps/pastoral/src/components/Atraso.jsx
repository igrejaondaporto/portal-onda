/**
 * "O culto começou a horas?" — a diferença entre a hora prevista e a
 * hora a que a coisa entrou mesmo no ar.
 *
 * É um estado, não uma série: usa as cores de estado que o produto já
 * reserva para isto — as mesmas de `.oc-atraso-verde/-laranja/
 * -vermelho` que a ordem do culto ao vivo usa na Técnica, com os
 * mesmos limiares. Um atraso que é verde num ecrã e laranja no outro
 * seria pior do que não mostrar nada.
 *
 * Nunca só cor: leva sempre o sinal e os minutos por extenso. Quem não
 * distingue verde de laranja continua a ler "+12 min".
 *
 * Adiantado é `--verde` tal como "a horas" de propósito: um culto que
 * começou dois minutos mais cedo não é um problema a assinalar, e
 * pintá-lo de outra cor fazia parecer que era.
 */
const LARANJA = 5;      // a partir daqui já se nota na sala
const VERMELHO = 15;    // a partir daqui o culto saiu do plano

export function corAtraso(min) {
  if (min === null || min === undefined) return null;
  if (min <= LARANJA) return "oc-atraso-verde";
  if (min < VERMELHO) return "oc-atraso-laranja";
  return "oc-atraso-vermelho";
}

export function textoAtraso(min) {
  if (min === null || min === undefined) return "—";
  if (min === 0) return "a horas";
  return `${min > 0 ? "+" : "−"}${Math.abs(min)} min`;
}

export default function Atraso({ minutos, rotulo }) {
  if (minutos === null || minutos === undefined) {
    return <span className="pa-atraso"><b className="oc-hora-prevista">—</b>{rotulo && <i>{rotulo}</i>}</span>;
  }
  return (
    <span className="pa-atraso">
      <b className={corAtraso(minutos)}>{textoAtraso(minutos)}</b>
      {rotulo && <i>{rotulo}</i>}
    </span>
  );
}
