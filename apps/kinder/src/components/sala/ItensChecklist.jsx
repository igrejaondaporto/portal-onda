import { FASES, nomeCategoria } from "../../lib/modelo";

/**
 * As fases (Pré-culto/Durante o culto/Pós-culto) e os itens de uma
 * sala, com checkbox — partilhado entre `ChecklistSala.jsx` (a
 * própria página, com gestão de itens para a líder) e `Inicio.jsx`
 * (só ver e marcar, sem gerir o catálogo). `onRemover`/`renderRodape`
 * ficam de fora quando quem usa isto não precisa de gerir nada.
 */
export default function ItensChecklist({ itens, marcas, voluntarios, sala, onAlternar, onRemover, renderRodape, mostrarFasesVazias = true }) {
  return (
    <>
      {FASES.map(([fase, tituloFase]) => {
        const lista = itens.filter((i) => i.fase === fase);
        if (!mostrarFasesVazias && lista.length === 0) return null;
        return (
          <div key={fase}>
            <div className="fasecab"><h4>{tituloFase}</h4><em>{lista.filter((i) => marcas[i.id]).length}/{lista.length}</em></div>
            {lista.length === 0 && <p className="ds">Sem itens para a sala {nomeCategoria(sala)}.</p>}
            {lista.map((i) => {
              const m = marcas[i.id];
              return (
                <div className={`linha${m ? " feita" : ""}`} key={i.id} style={{ cursor: "pointer" }} onClick={() => onAlternar(i)}>
                  <button className={`chk${m ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); onAlternar(i); }}>✓</button>
                  <div style={{ flex: 1 }}>
                    <p className="nmt" style={{ fontSize: 15 }}>{i.horario ? `${i.horario} · ` : ""}{i.titulo}</p>
                    {i.subtitulo && <p className="ds">{i.subtitulo}</p>}
                    {m && <p className="ds">{voluntarios.find((p) => p.id === m.por)?.nome ?? "alguém"} · {m.hora}</p>}
                  </div>
                  {onRemover && (
                    <button className="oc-icobt mag" aria-label={`Tirar ${i.titulo}`} onClick={(e) => { e.stopPropagation(); onRemover(i); }}>✕</button>
                  )}
                </div>
              );
            })}
            {renderRodape?.(fase)}
          </div>
        );
      })}
    </>
  );
}
