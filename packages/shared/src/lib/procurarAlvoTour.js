/**
 * Procura no DOM o elemento `data-tour="{alvo}"` de um passo do tour,
 * com um pequeno timeout — dá tempo a uma troca de aba/montagem de
 * componente terminar antes de desistir. Se não encontrar, resolve
 * `null` e quem chama avança o passo em silêncio (nunca quebra o tour
 * por um elemento que não existe nesta tela/base/pessoa).
 */
const INTERVALO_MS = 80;
const TIMEOUT_MS = 1500;

export function procurarAlvoTour(alvo, { sinal } = {}) {
  if (!alvo) return Promise.resolve(null);

  return new Promise((resolver) => {
    const inicio = Date.now();

    function tentar() {
      if (sinal?.aborted) return resolver(null);
      const el = document.querySelector(`[data-tour="${alvo}"]`);
      if (el) return resolver(el);
      if (Date.now() - inicio >= TIMEOUT_MS) return resolver(null);
      setTimeout(tentar, INTERVALO_MS);
    }
    tentar();
  });
}
