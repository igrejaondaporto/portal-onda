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
 * `virtual:pwa-register` (ver comentário em avisoAtualizacao.js).
 *
 * `onNeedRefresh` só dispara quando o BROWSER decide verificar se o
 * sw.js mudou — e isso, por spec, é limitado a uma vez a cada 24h por
 * registo, a não ser que algo chame `registration.update()` a valer.
 * Sem isto, quem deixa a aba aberta (ou o PWA instalado, sem fechar
 * por completo) só via correções como esta de scroll um dia depois —
 * confirmado ao vivo, 2026-09-07: uma aba nova, minutos depois de um
 * deploy, ainda trazia o bundle antigo, com um service worker novo
 * já instalado mas parado em "waiting", à espera desta verificação
 * que nunca era pedida. Os 60s abaixo forçam a verificação sempre que
 * a app está aberta, sem depender do relógio de 24h do browser. */
export function registarAtualizacaoAutomatica() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), 60 * 1000);
    },
    onNeedRefresh() {
      marcarAcabouDeAtualizar();
      updateSW(true);
    },
  });
}
