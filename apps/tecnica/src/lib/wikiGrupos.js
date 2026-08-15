/**
 * Wiki: o mesmo conteúdo por duas entradas.
 *
 * A barra de pesquisa só encontra quem já escreve a palavra que o
 * documento usa — e muitas vezes não usa. Quem chega com a dúvida
 * ("a projeção não dá imagem") não sabe que o artigo se chama
 * "Ligar o ProPresenter ao segundo ecrã", e sai de mãos a abanar.
 *
 * Os grupos por ministério são a outra entrada: abrir "Projeção" e
 * ver tudo o que lá está, sem adivinhar o termo. É também por isso
 * que a ordem aqui é alfabética e não por data — o valor está em
 * cada coisa estar sempre no mesmo sítio, culto após culto.
 *
 * Sem Firestore de propósito: é uma derivação pura do índice que já
 * veio. Fica barata de correr a cada tecla e, por não depender do
 * browser nem de estar com sessão iniciada, pode ser verificada com
 * um `node` e dados inventados — que é como foi.
 */

// sem acentos, minúsculas — para a busca não depender de o utilizador
// escrever "iluminação" com o acento certo
export const normalizarBusca = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * @param itens        índice leve da Wiki (ouvirIndiceWiki)
 * @param ministerios  só os ativos (ouvirMinisterios já filtra)
 * @param busca        texto da barra de pesquisa; "" mostra tudo
 * @returns [{ chave, nome, cor, itens }] — grupos vazios já removidos
 */
export function agruparWikiPorMinisterio(itens, ministerios, busca = "") {
  const b = normalizarBusca(busca);
  const filtrados = !b ? itens : itens.filter((i) =>
    normalizarBusca(i.titulo).includes(b)
    || (i.etiquetas || []).some((e) => normalizarBusca(e).includes(b))
    || normalizarBusca(i.texto).includes(b)
  );
  const porTitulo = [...filtrados].sort((a, c) =>
    (a.titulo || "").localeCompare(c.titulo || "", "pt"));

  // Um item com dois ministérios aparece nos dois grupos, de propósito:
  // quem anda a ver a Projeção tem de o encontrar na Projeção.
  const grupos = [...ministerios]
    .sort((a, c) => (a.nome || "").localeCompare(c.nome || "", "pt"))
    .map((m) => ({
      chave: m.id,
      nome: m.nome,
      cor: m.cor,
      itens: porTitulo.filter((i) => i.ministerios?.includes(m.id)),
    }));

  // Rede de segurança, e não um detalhe: aqui cai o que não tem
  // ministério e o que aponta para um ministério entretanto desativado
  // (ouvirMinisterios só traz os ativos). Sem este grupo, desativar um
  // ministério no Painel fazia desaparecer da Wiki tudo o que estava
  // lá dentro — sem erro, sem aviso, e só se dava por isso à procura.
  grupos.push({
    chave: "geral",
    nome: "Geral",
    cor: null,
    itens: porTitulo.filter((i) =>
      !i.ministerios?.some((id) => ministerios.some((m) => m.id === id))),
  });

  return grupos.filter((g) => g.itens.length);
}
