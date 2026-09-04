import { registerSW } from "virtual:pwa-register";

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
 * Marca no sessionStorage ANTES do reload (sobrevive a ele, ao
 * contrário de estado em memória) — `TorradaProvider` lê essa marca
 * ao montar e mostra o aviso, já na versão nova. */
const CHAVE_ACABOU_DE_ATUALIZAR = "pwa-acabou-de-atualizar";

export function registarAtualizacaoAutomatica() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      try { sessionStorage.setItem(CHAVE_ACABOU_DE_ATUALIZAR, "1"); } catch { /* privado/bloqueado — sem aviso, tudo bem */ }
      updateSW(true);
    },
  });
}

/** Chamada uma vez por `TorradaProvider` ao montar — devolve true (e
 *  limpa a marca) só na primeira montagem depois de um reload
 *  automático; qualquer navegação normal a seguir não repete o aviso. */
export function acabouDeAtualizar() {
  try {
    if (sessionStorage.getItem(CHAVE_ACABOU_DE_ATUALIZAR) === "1") {
      sessionStorage.removeItem(CHAVE_ACABOU_DE_ATUALIZAR);
      return true;
    }
  } catch { /* privado/bloqueado */ }
  return false;
}
