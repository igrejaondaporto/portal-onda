import { registerSW } from "virtual:pwa-register";
import { marcarAcabouDeAtualizar } from "./avisoAtualizacao.js";

/**
 * `registerType:"autoUpdate"` (vite.config.js de cada app) já faz o
 * service worker atualizar-se sozinho em segundo plano — mas a página
 * já aberta não sabia disso: ficava a mostrar a versão antiga até
 * alguém recarregar, às vezes várias vezes seguidas, à espera de
 * calhar numa janela sem cache stale. `virtual:pwa-register` avisa
 * quando há atualização (`onNeedRefresh`) e `updateSW(true)` força o
 * recarregar assim que ela é detetada, em vez de deixar ao acaso.
 *
 * O recarregar em si é mudo — sem aviso nenhum, alguém a meio de algo
 * só via a tela mudar sozinha (pedido do líder da Louvor, 2026-09,
 * mas vale para qualquer base: ficou aqui em `packages/shared`).
 * `marcarAcabouDeAtualizar` (avisoAtualizacao.js) grava no
 * sessionStorage ANTES do reload (sobrevive a ele); `TorradaProvider`
 * lê essa marca ao montar e mostra o aviso, já na versão nova. Só
 * uma app que chama `registarAtualizacaoAutomatica` (as que têm o
 * plugin VitePWA) importa este ficheiro — nunca `TorradaContext.jsx`
 * direto, para não obrigar quem não é PWA a resolver
 * `virtual:pwa-register` (ver comentário em avisoAtualizacao.js). */
export function registarAtualizacaoAutomatica() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      marcarAcabouDeAtualizar();
      updateSW(true);
    },
  });
}
