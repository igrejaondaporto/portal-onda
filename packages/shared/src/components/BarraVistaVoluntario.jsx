/**
 * "Estás a ver como voluntário" — a faixa que fica à vista enquanto o
 * líder espreita o painel pelos olhos da equipa.
 *
 * Tem de ser persistente e impossível de perder: no modo de vista, o
 * menu do perfil passa a ser o de um voluntário (é esse o objetivo),
 * e sem esta faixa o líder ficava sem caminho de volta a não ser
 * recarregar a página.
 *
 * Fica acima da barra de navegação no telemóvel e no canto de baixo no
 * computador — nunca por cima do conteúdo que se está a avaliar.
 */
export default function BarraVistaVoluntario({ etiqueta, onSair }) {
  return (
    <div className="vistavol">
      <span className="vistavol-txt">
        A ver como voluntário{etiqueta ? ` · ${etiqueta}` : ""}
      </span>
      <button className="vistavol-sair" onClick={onSair}>Sair</button>
    </div>
  );
}
