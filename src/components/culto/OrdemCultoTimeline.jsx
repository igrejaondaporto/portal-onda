import { MESES } from "../../lib/data";

const NOSSOS = /volunt|café dos|pré-culto/i;

/** A cronologia nativa que os voluntários veem — sem clicar em nada.
 *  Espelha a vista de resultado do culto-transcrito.html. */
export default function OrdemCultoTimeline({ ordem, chegada }) {
  if (!ordem) return null;

  return (
    <>
      <div className="oc-nossa">
        <div className="l"><span>Chegada da Base de Apoio</span><b>{chegada}</b></div>
        <div className="l"><span>Portas abertas</span><b>{ordem.inicio ?? "—"}</b></div>
        <div className="l"><span>Fim do culto</span><b>{ordem.fim ?? "—"}</b></div>
        <div className="l"><span>Arrumação a partir de</span><b>{ordem.fim ?? "—"}</b></div>
      </div>

      <div>
        {ordem.momentos.map((m, i) => (
          <div className={`oc-mom${NOSSOS.test(m.momento) ? " destaque" : ""}`} key={i}>
            <div className="oc-hora"><b>{m.hora}</b><span>{m.minutos}min</span></div>
            <div className="oc-trilho" />
            <div className="txt">
              <p className="nm">{m.momento}</p>
              <p className="meta">{[m.responsavel, m.projecao].filter(Boolean).join(" · ") || "—"}</p>
              {m.detalhe && /volunt/i.test(m.detalhe) && <span className="oc-marca">{m.detalhe}</span>}
            </div>
          </div>
        ))}
      </div>

      {ordem.avisos?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="cap">Avisos locais</p>
          {ordem.avisos.map((a, i) => {
            const [d, mm] = String(a.data || "").split("/");
            return (
              <div className="oc-aviso" key={i}>
                <span className="oc-dt"><b>{d}</b><span>{MESES[Number(mm) - 1]?.slice(0, 3).toLowerCase()}</span></span>
                <div style={{ flex: 1 }}>
                  <p className="nm" style={{ fontSize: 14.5, fontWeight: 700 }}>{a.nome}</p>
                  <p className="ds">{a.info}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ordem.pdfUrl && (
        <a className="link" href={ordem.pdfUrl} target="_blank" rel="noreferrer" style={{ marginTop: 16 }}>
          Ver o PDF original ›
        </a>
      )}
    </>
  );
}
