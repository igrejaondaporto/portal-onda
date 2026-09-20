/**
 * O funil de visitantes — seis etapas ordenadas, da visita a estar a
 * servir.
 *
 * Barras horizontais e não um triângulo de funil: o triângulo é bonito
 * e ilegível (a área de cada fatia não é proporcional a nada, e os
 * rótulos nunca cabem nas de baixo). Barras comparam-se ao olho, e é
 * essa a pergunta — "onde é que as pessoas param?".
 *
 * A cor é uma rampa de um tom só, validada (ver CORES_ETAPA em
 * lib/contactos.js): as etapas são um caminho, não seis identidades.
 * A percentagem que aparece é sempre em relação à PRIMEIRA etapa —
 * "de 100 visitas, 12 chegaram a servir" — e não em relação à etapa
 * anterior, que dá seis percentagens que ninguém consegue multiplicar
 * de cabeça.
 *
 * Toca-se numa etapa para filtrar a lista por baixo; a etapa escolhida
 * fica marcada com um anel, não só com a cor, porque a cor aqui já
 * está ocupada a dizer "em que ponto do caminho isto é".
 */
export default function Funil({ etapas, selecionada, onSelecionar }) {
  const base = etapas[0]?.total ?? 0;
  const maior = Math.max(...etapas.map((e) => e.total), 1);

  return (
    <div className="pa-funil">
      {etapas.map((e) => {
        const pct = base > 0 ? Math.round((e.total / base) * 100) : null;
        const ativa = selecionada === e.id;
        return (
          <button
            key={e.id}
            className={`pa-funil-linha${ativa ? " on" : ""}`}
            onClick={() => onSelecionar(ativa ? null : e.id)}
            aria-pressed={ativa}
          >
            <div className="pa-funil-cab">
              <span className="pa-funil-nome">{e.nome}</span>
              <span className="pa-funil-num">
                {e.total}
                {pct !== null && e.id !== etapas[0].id && <i> · {pct}%</i>}
              </span>
            </div>
            <div className="barra">
              <i style={{ width: `${(e.total / maior) * 100}%`, background: e.cor }} />
            </div>
            <span className="pa-funil-desc">{e.descricao}</span>
          </button>
        );
      })}
    </div>
  );
}
