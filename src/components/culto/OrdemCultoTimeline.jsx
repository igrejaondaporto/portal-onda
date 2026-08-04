import { useEffect, useState } from "react";
import { MESES } from "../../lib/data";

const NOSSOS = /volunt|café dos|pré-culto/i;
const paraMinutos = (hora) => { const [h, m] = hora.split(":").map(Number); return h * 60 + m; };

/** Onde estamos agora, em relação à ordem do culto — só faz sentido
 *  no dia do culto, por isso "hoje" vem de fora. */
function calcularAgora(momentos) {
  if (!momentos.length) return { fase: "sem-horas" };
  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  if (minAgora < paraMinutos(momentos[0].hora)) return { fase: "antes" };
  for (let i = 0; i < momentos.length; i++) {
    const inicio = paraMinutos(momentos[i].hora);
    const fim = inicio + Number(momentos[i].minutos || 0);
    if (minAgora >= inicio && minAgora < fim) return { fase: "durante", indice: i };
  }
  return { fase: "depois" };
}

/** A cronologia nativa que os voluntários veem — sem clicar em nada.
 *  Espelha a vista de resultado do culto-transcrito.html. No dia do
 *  culto, mostra também um marcador "agora" que avança sozinho de
 *  momento em momento, conforme as horas.*/
export default function OrdemCultoTimeline({ ordem, chegada, hoje }) {
  const [, reavaliar] = useState(0);

  useEffect(() => {
    if (!hoje) return;
    const id = setInterval(() => reavaliar((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [hoje]);

  if (!ordem) return null;
  const agora = hoje ? calcularAgora(ordem.momentos) : null;

  return (
    <>
      <div className="oc-nossa">
        <div className="l"><span>Chegada da Base de Apoio</span><b>{chegada}</b></div>
        <div className="l"><span>Portas abertas</span><b>{ordem.inicio ?? "—"}</b></div>
        <div className="l"><span>Fim do culto</span><b>{ordem.fim ?? "—"}</b></div>
        <div className="l"><span>Arrumação a partir de</span><b>{ordem.fim ?? "—"}</b></div>
      </div>

      {agora?.fase === "antes" && (
        <p className="ds" style={{ margin: "0 0 4px", color: "var(--magenta)", fontWeight: 600 }}>
          Ainda não começou — abre às {ordem.inicio}
        </p>
      )}
      {agora?.fase === "depois" && (
        <p className="ds" style={{ margin: "0 0 4px" }}>Este culto já terminou.</p>
      )}

      <div>
        {ordem.momentos.map((m, i) => (
          <div
            className={`oc-mom${NOSSOS.test(m.momento) ? " oc-destaque" : ""}${agora?.indice === i ? " agora" : ""}`}
            key={i}
          >
            <div className="oc-hora"><b>{m.hora}</b><span>{m.minutos}min</span></div>
            <div className="oc-trilho" />
            <div className="txt">
              <p className="nm">
                {m.momento}
                {agora?.indice === i && <span className="oc-agora">agora</span>}
              </p>
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
