import { dataPorExtenso } from "../lib/data";

/**
 * Um culto na Escala: cartão fechado que abre ao toque.
 *
 * Nasceu na Técnica. A lista mostrava todos os cultos do mês abertos,
 * com toda a gente de cada um — com seis domingos e cinco pessoas em
 * cada, chegar ao último era rolar a página inteira. O mesmo acontecia
 * na Apoio, pelo mesmo motivo, por isso o cartão vive aqui.
 *
 * Só a casca é partilhada: cabeçalho, destaque, seta, corpo que abre.
 * **Quem serve, e como se descreve, é de cada base** e entra por
 * `children` — a Apoio tem uma lista de pessoas com funções, a Técnica
 * tem titular e aprendiz por ministério. Tentar partilhar isso também
 * era forçar duas coisas genuinamente diferentes a caber numa só.
 *
 * @param evento     { id, data, tipo?, horaCulto?, horaChegada? }
 * @param hoje       ISO de hoje (`hojeISO()`) — vem de fora para a tela
 *                   inteira concordar com ela própria numa só leitura
 * @param sirvo      a pessoa serve neste culto → o cartão ganha destaque
 * @param resumo     linha por baixo do título ("Serves · Áudio",
 *                   "5 pessoas") — cada base sabe o que lá pôr
 * @param aberto     controlado por quem usa, para o foco do calendário
 *                   poder abrir o cartão certo
 * @param realcado   pisca ao chegar vindo do calendário
 * @param etiqueta   nó opcional ao lado do título (ex.: ênfase do
 *                   culto na Louvor) — nenhuma outra base passa isto,
 *                   sem prop fica exatamente como sempre foi.
 */
export default function CartaoCulto({
  evento, hoje, sirvo, resumo, aberto, onAlternar, realcado, refCartao, etiqueta, children,
}) {
  const passou = evento.data < hoje;
  const eHoje = evento.data === hoje;
  return (
    <div
      className={`mincartao cartaoculto${realcado ? " realce" : ""}`}
      data-sirvo={sirvo ? 1 : 0} data-passou={passou ? 1 : 0}
      ref={refCartao}
    >
      <div className="mincartao-barra" />
      <button
        className="mincartao-cab cabtoque"
        data-aberto={aberto ? 1 : 0}
        aria-expanded={aberto}
        onClick={onAlternar}
      >
        {/* Empilhado, não lado a lado: o nome de um culto especial é
          * texto livre que o líder escreve, e "Vigília de Ano Novo" ao
          * lado de "Serves · Responsável · Iluminação" parte as duas
          * colunas em duas linhas cada. */}
        <span className="cartaoculto-txt">
          <span className="nome">
            {evento.tipo || dataPorExtenso(evento.data)}
            {etiqueta}
            {eHoje && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
            {passou && " ✅"}
          </span>
          <span className="ds">
            {/* Num culto especial o título é o nome, e a data não
              * aparece em mais lado nenhum com o cartão fechado — tem de
              * vir aqui. Ver a regra em MELHORIAS-ENTRE-BASES.md. */}
            {evento.tipo && `${dataPorExtenso(evento.data)} · `}
            {resumo}
          </span>
        </span>
        <span className="cabtoque-seta" aria-hidden="true">›</span>
      </button>
      {aberto && <div className="cartaoculto-corpo">{children}</div>}
    </div>
  );
}
