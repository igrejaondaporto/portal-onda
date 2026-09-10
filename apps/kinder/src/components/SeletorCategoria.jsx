import { CATEGORIAS, varsCategoria } from "../lib/modelo";

/**
 * Os três botões coloridos (Baby roxo, Fun amarelo, Júnior azul) que
 * dividem cada menu por sala — mais "Todas" para quem vê as três.
 * `valor` null = Todas. `contagens` (opcional): { baby: 3, … } — o
 * número aparece dentro do botão.
 */
export default function SeletorCategoria({ valor, onMudar, comTodas = true, rotuloTodas = "Todas", contagens }) {
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
      {CATEGORIAS.map((c) => (
        <button
          key={c.id} type="button" role="tab" className="kin-cat" style={varsCategoria(c.id)}
          data-on={valor === c.id ? 1 : 0} aria-selected={valor === c.id} onClick={() => onMudar(c.id)}
        >
          {c.nome}
          {contagens?.[c.id] != null && <span className="kin-cat-n">{contagens[c.id]}</span>}
        </button>
      ))}
    </div>
  );
}
