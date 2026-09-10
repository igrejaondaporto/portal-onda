import { CATEGORIAS, varsCategoria } from "../lib/modelo";

/**
 * Os três botões coloridos (Baby roxo, Fun amarelo, Júnior azul) que
 * dividem cada menu por sala — mais "Todas" para quem vê as três.
 * `valor` null = Todas. `contagens` (opcional): { baby: 3, … } — o
 * número aparece dentro do botão. `capacidades` (opcional): junto
 * com `contagens`, mostra "3/10" e acende a cor de aviso quando a
 * sala está no limite ou acima (ver capacidadesPorSala em lib/modelo).
 */
export default function SeletorCategoria({ valor, onMudar, comTodas = true, rotuloTodas = "Todas", contagens, capacidades }) {
  return (
    <div className="kin-cats" role="tablist" aria-label="Sala">
      {comTodas && (
        <button
          type="button" role="tab" className="kin-cat" style={varsCategoria(null)}
          data-on={valor === null ? 1 : 0} aria-selected={valor === null} onClick={() => onMudar(null)}
        >
          {rotuloTodas}
        </button>
      )}
      {CATEGORIAS.map((c) => {
        // capacidade 0 = nenhum voluntário dessa sala escalado hoje —
        // mostra só a contagem, não "0/0" (sem voluntário não há como
        // dizer "cabem zero", é só que ainda não sabemos quantas cabem)
        const cap = capacidades?.[c.id] > 0 ? capacidades[c.id] : null;
        const n = contagens?.[c.id];
        const noLimite = cap != null && n != null && n >= cap;
        return (
          <button
            key={c.id} type="button" role="tab" className="kin-cat" style={varsCategoria(c.id)}
            data-on={valor === c.id ? 1 : 0} aria-selected={valor === c.id} onClick={() => onMudar(c.id)}
          >
            {c.nome}
            {n != null && (
              <span className={`kin-cat-n${noLimite ? " no-limite" : ""}`}>
                {cap != null ? `${n}/${cap}` : n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
