/**
 * Procura no DOM o elemento `data-tour="{alvo}"` de um passo do tour,
 * com um pequeno timeout — dá tempo a uma troca de aba/montagem de
 * componente terminar antes de desistir. Se não encontrar, resolve
 * `null` e quem chama avança o passo em silêncio (nunca quebra o tour
 * por um elemento que não existe nesta tela/base/pessoa).
 *
 * Curto de propósito — nada aqui deve sentir-se a demorar. Os passos
 * que dependem de dados da Firestore (checklist, calendário) ficam
 * sempre no fim da sequência de cada base (ver scripts/seedTour.mjs),
 * depois de vários passos fixos (botões do menu) que já deram tempo
 * de sobra a esses dados chegarem — por isso não precisa de um
 * timeout longo pra "esperar carregar". Isto é só a margem para o
 * React montar o DOM depois de `irPara`, não pra esperar rede. */
const INTERVALO_MS = 60;
const TIMEOUT_MS = 900;

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
