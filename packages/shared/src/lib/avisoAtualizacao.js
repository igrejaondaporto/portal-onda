/**
 * A marca de "acabei de recarregar sozinha" (ver pwa.js,
 * registarAtualizacaoAutomatica) — separada de pwa.js de propósito.
 * `pwa.js` importa `virtual:pwa-register`, um módulo virtual que só
 * existe em apps com o plugin VitePWA configurado (nem todas têm —
 * o Kinder, por exemplo, não é PWA); `TorradaContext.jsx` é montado
 * por TODAS as apps, então nunca pode depender de `pwa.js` direto,
 * senão o build de quem não tem o plugin rebenta a resolver um
 * import que não existe (aconteceu, corrigido). Este ficheiro não
 * importa nada — só sessionStorage — por isso é seguro em qualquer
 * app, com ou sem VitePWA.
 */
const CHAVE_ACABOU_DE_ATUALIZAR = "pwa-acabou-de-atualizar";

export function marcarAcabouDeAtualizar() {
  try { sessionStorage.setItem(CHAVE_ACABOU_DE_ATUALIZAR, "1"); } catch { /* privado/bloqueado — sem aviso, tudo bem */ }
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
