/**
 * "De que ministério?" — só aparece nas bases que têm ministérios (a
 * Técnica é a primeira). Sem isto, o líder da Técnica veria sempre o
 * painel de quem não serve nesse domingo, que é o menos útil dos
 * painéis possíveis: o que ele quer confirmar é o que a pessoa da
 * Projeção vê ao domingo de manhã.
 *
 * `ministerios` vazio ou ausente = a base não tem ministérios e esta
 * folha nem chega a ser aberta (ver Sessao de cada app).
 */
export default function SheetEscolherVista({ ministerios = [], onEscolher, onFechar }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Ver como voluntário</h2>
        <p className="sb2">De que ministério queres ver o painel?</p>

        {ministerios.map((m) => (
          <button
            key={m.id} className="btn sec full" style={{ marginTop: 9, textAlign: "left" }}
            onClick={() => onEscolher(m.id, m.nome)}
          >
            <span className="quadmin" style={{ background: m.cor }} />
            {m.nome}
          </button>
        ))}

        {/* quem não serve nesse domingo também tem um painel, e é o que
          * mais gente vê na semana em que está de fora */}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => onEscolher(null, null)}>
          Sem ministério
        </button>
        <button
          className="btn sec full"
          style={{ marginTop: 14, background: "none", color: "var(--cinza)" }}
          onClick={onFechar}
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
