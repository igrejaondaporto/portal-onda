/**
 * Notas e moedas de euro desenhadas em SVG, para a contagem da oferta
 * ser reconhecida de relance em vez de lida.
 *
 * São desenhos, não fotografias: as imagens reais das notas são do
 * Banco Central Europeu e têm regras próprias de reprodução (e
 * pesariam mais do que a app inteira). O que interessa aqui é o
 * sinal — a COR de cada nota é o que a mão já conhece de contar
 * dinheiro a sério, e é essa que está certa. As moedas seguem o
 * mesmo critério: ouro nórdico, cobre, e as duas bimetálicas.
 */

const CORES_NOTA = {
  500: { fundo: "#a887c4", faixa: "#8f6bb0", tinta: "#3b2350" },
  200: { fundo: "#d8bd63", faixa: "#c4a343", tinta: "#4a3a08" },
  100: { fundo: "#8cbd84", faixa: "#6ca367", tinta: "#1f3d1c" },
  50: { fundo: "#eeae57", faixa: "#d9933a", tinta: "#4e3006" },
  20: { fundo: "#7aa5d8", faixa: "#5b8bc6", tinta: "#16304f" },
  10: { fundo: "#dd7d72", faixa: "#c9615a", tinta: "#4d1712" },
  5: { fundo: "#b3b0b6", faixa: "#98959c", tinta: "#302e33" },
};

// ouro nórdico (50/20/10 cênt.), cobre (5/2/1 cênt.) e as duas
// bimetálicas — o 1 € tem o aro dourado e o miolo prateado; o 2 € é
// ao contrário. É a forma mais rápida de os distinguir na mesa.
const CORES_MOEDA = {
  200: { aro: "#c9ced7", miolo: "#dcbb63", tinta: "#4a3a08" },
  100: { aro: "#dcbb63", miolo: "#c9ced7", tinta: "#33373d" },
  50: { aro: "#d8ab45", miolo: "#e0b855", tinta: "#4a3a08" },
  20: { aro: "#d8ab45", miolo: "#e0b855", tinta: "#4a3a08" },
  10: { aro: "#d8ab45", miolo: "#e0b855", tinta: "#4a3a08" },
  5: { aro: "#c07a4a", miolo: "#cd8a5a", tinta: "#4a2510" },
  2: { aro: "#c07a4a", miolo: "#cd8a5a", tinta: "#4a2510" },
  1: { aro: "#c07a4a", miolo: "#cd8a5a", tinta: "#4a2510" },
};

/** Uma nota. `centimos` é a denominação (2000 = nota de 20 €).
 *  Maior que a moeda de propósito: numa mesa com dinheiro, o tamanho
 *  é o primeiro sinal de qual é qual. */
export function Nota({ centimos, largura = 56 }) {
  const valor = centimos / 100;
  const c = CORES_NOTA[valor] ?? CORES_NOTA[5];
  const altura = Math.round(largura * 0.52);
  // o "500" precisa de mais espaço que o "5" — encolhe a tinta em vez
  // de deixar o número transbordar da nota.
  const tamanhoTexto = String(valor).length >= 3 ? 12 : 14;
  return (
    <svg
      width={largura} height={altura} viewBox="0 0 56 29" aria-hidden="true"
      style={{ flex: "none", display: "block" }}
    >
      <rect x="0.5" y="0.5" width="55" height="28" rx="3.5" fill={c.fundo} stroke={c.faixa} strokeWidth="1" />
      <rect x="3.5" y="3.5" width="9" height="22" rx="1.5" fill={c.faixa} opacity="0.85" />
      <rect x="43" y="8" width="8.5" height="13" rx="1.5" fill="#fff" opacity="0.35" />
      <text
        x="28" y="13" textAnchor="middle" dominantBaseline="central"
        fontSize={tamanhoTexto} fontWeight="800" fill={c.tinta} letterSpacing="-0.4"
      >
        {valor}
      </text>
      <text x="28" y="22.5" textAnchor="middle" dominantBaseline="central" fontSize="6" fontWeight="700" fill={c.tinta} opacity="0.75" letterSpacing="0.5">
        EURO
      </text>
    </svg>
  );
}

/** Uma moeda. `centimos` é a denominação (50 = meio euro).
 *  Só o número lá dentro: o "c"/"€" em cima do algarismo fica ilegível
 *  a este tamanho, e o rótulo ao lado já diz "50 cênt." por extenso. */
export function Moeda({ centimos, tamanho = 32 }) {
  const c = CORES_MOEDA[centimos] ?? CORES_MOEDA[1];
  const bimetalica = centimos >= 100;
  const rotulo = bimetalica ? String(centimos / 100) : String(centimos);
  return (
    <svg
      width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true"
      style={{ flex: "none", display: "block" }}
    >
      <circle cx="16" cy="16" r="15" fill={c.aro} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <circle cx="16" cy="16" r={bimetalica ? 9.5 : 11.5} fill={c.miolo} />
      <text
        x="16" y="16.5" textAnchor="middle" dominantBaseline="central"
        fontSize={bimetalica ? 12 : 11} fontWeight="800" fill={c.tinta}
      >
        {rotulo}
      </text>
    </svg>
  );
}
