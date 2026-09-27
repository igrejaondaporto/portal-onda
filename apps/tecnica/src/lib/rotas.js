/**
 * URL real por página — piloto pedido pelo líder (2026-09), só na
 * Técnica por agora ("quero testar antes... para depois replicarmos
 * para os demais"). Sem router: o padrão já existe no repo em
 * apps/kinder/src/App.jsx, que resolve a página a partir de
 * `window.location.pathname` sem nenhuma biblioteca.
 *
 * O caminho segue o que a pessoa vê e diria ("escala",
 * "equipamentos"), não a chave interna que o resto do código usa há
 * mais tempo ("inventario") — por isso o mapa não é um prefixo
 * automático da chave.
 */
export const PATH_POR_CHAVE = {
  inicio: "/inicio",
  escala: "/escala",
  culto: "/culto",
  inventario: "/equipamentos",
  wiki: "/wiki",
  montar: "/montar",
  perfil: "/perfil",
  reembolsos: "/reembolsos",
  painel: "/painel",
};

const CHAVE_POR_PATH = Object.fromEntries(
  Object.entries(PATH_POR_CHAVE).map(([chave, path]) => [path, chave])
);

/** "/" (endereço principal) e qualquer caminho desconhecido caem no
 *  Início — nunca em ecrã em branco. */
export function chaveDoPath(pathname) {
  return CHAVE_POR_PATH[pathname] ?? "inicio";
}
