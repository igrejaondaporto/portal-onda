import { registerSW } from "virtual:pwa-register";

/**
 * `registerType:"autoUpdate"` (vite.config.js de cada app) já faz o
 * service worker atualizar-se sozinho em segundo plano — mas a página
 * já aberta não sabia disso: ficava a mostrar a versão antiga até
 * alguém recarregar, às vezes várias vezes seguidas, à espera de
 * calhar numa janela sem cache stale. `virtual:pwa-register` avisa
 * quando há atualização (`onNeedRefresh`) e `updateSW(true)` força o
 * recarregar assim que ela é detetada, em vez de deixar ao acaso.
 */
export function registarAtualizacaoAutomatica() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
  });
}
