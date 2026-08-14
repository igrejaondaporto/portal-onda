/**
 * Procura no DOM o elemento `data-tour="{alvo}"` de um passo do tour,
 * com um timeout — dá tempo a uma troca de aba/montagem de componente
 * terminar antes de desistir. Se não encontrar, resolve `null` e quem
 * chama avança o passo em silêncio (nunca quebra o tour por um
 * elemento que não existe nesta tela/base/pessoa).
 *
 * 5s de folga, não 1.5 — no primeiro login o tour pode disparar antes
 * de o Firestore devolver dados de que a própria tela do voluntário
 * depende (ex.: `meuEvento` em Inicio.jsx, de que a checklist e o
 * calendário precisam para sequer renderizar): num telemóvel com rede
 * fraca, 1.5s não chegava, e o passo saltava sozinho antes dos dados
 * chegarem — não por o elemento não existir, só por ainda não ter
 * carregado. */
const INTERVALO_MS = 80;
const TIMEOUT_MS = 5000;

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
