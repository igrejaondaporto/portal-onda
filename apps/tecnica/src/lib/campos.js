/**
 * Num computador, rodar a roda do rato por cima de um
 * `<input type="number">` com foco MUDA O VALOR em vez de rolar a
 * página. Numa folha que rola, isto é uma armadilha: escreves 17 no
 * dia do culto especial, rodas para descer até ao botão, e o dia
 * passa a 16 sem a folha se mexer — e o culto é criado na data
 * errada. Reproduzido com input real (roda de rato pelo DevTools
 * Protocol) numa janela de 1000×498, 2026-09.
 *
 * Tirar o foco no primeiro movimento da roda devolve-lhe o papel de
 * rolar, e o valor fica como foi escrito. No telemóvel não há roda, e
 * nada muda.
 *
 * Uso: <input type="number" onWheel={largarAoRodar} … />
 */
export const largarAoRodar = (e) => e.currentTarget.blur();
