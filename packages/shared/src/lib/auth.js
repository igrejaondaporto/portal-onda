import { auth, chamar, signInWithCustomToken, signOut, BASE_ID } from "./firebase";

/**
 * Login por PIN.
 * O PIN vai para o servidor e volta um token. Nada é verificado aqui —
 * se fosse, qualquer pessoa com o browser aberto entrava como outra.
 */
export async function entrarComPin(pessoaId, pin) {
  try {
    const { data } = await chamar("entrar")({ baseId: BASE_ID, pessoaId, pin });
    await signInWithCustomToken(auth, data.token);
    return { ok: true, deveTrocarPin: data.deveTrocarPin };
  } catch (e) {
    const d = e.details || {};
    if (e.message === "bloqueado" || d.bloqueado) {
      return { ok: false, bloqueado: true, faltamSegundos: d.faltamSegundos ?? 900 };
    }
    return { ok: false, restam: d.restam ?? null };
  }
}

export const sair = () => signOut(auth);

/** Troca de base sem pedir PIN outra vez. Cada base é uma app e um
 *  domínio separados (apoio.painelonda.pt, tecnica.painelonda.pt…) —
 *  trocar os claims do token sozinho não muda qual app está a
 *  correr no browser. Por isso isto navega mesmo para o domínio da
 *  base nova, levando o token novo na fragment da URL (nunca vai para
 *  o servidor nem fica em logs); a app que abre lê-o em `lerTokenDaUrl`
 *  e entra sem pedir PIN outra vez. Em localhost (dev, uma app só)
 *  não há para onde navegar — troca os claims no sítio, como antes. */
export async function trocarBase(novoBaseId) {
  try {
    const { data } = await chamar("trocarBase")({ novoBaseId });
    if (window.location.hostname === "localhost") {
      await signInWithCustomToken(auth, data.token);
      return { ok: true };
    }
    const url = `https://${novoBaseId}.painelonda.pt/#tok=${encodeURIComponent(data.token)}`;
    window.location.assign(url);
    // devolve o url mesmo tendo tentado navegar sozinho — numa app instalada
    // (PWA) ou nalgum browser, a navegação para outro domínio por script
    // pode não acontecer; quem chama mostra um link de reserva com isto.
    return { ok: true, url };
  } catch (e) {
    return { ok: false, mensagem: e.message || "Não foi possível trocar de base." };
  }
}

/** Lê um token deixado na fragment da URL por `trocarBase` (vindo de
 *  outra base) e entra com ele — chamar uma vez, cedo, antes de
 *  decidir se mostra o ecrã de entrada ou a sessão. Limpa a URL a
 *  seguir, para o token nunca ficar visível nem no histórico. */
export async function entrarComTokenDaUrl() {
  const hash = window.location.hash;
  if (!hash.startsWith("#tok=")) return false;
  const token = decodeURIComponent(hash.slice("#tok=".length));
  history.replaceState(null, "", window.location.pathname + window.location.search);
  try {
    await signInWithCustomToken(auth, token);
    return true;
  } catch {
    return false;
  }
}

/** Troca o PIN provisório pelo código próprio da pessoa. */
export async function trocarPin(pinAtual, pinNovo) {
  try {
    await chamar("trocarPin")({ pinAtual, pinNovo });
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: e.message || "Não foi possível trocar o código." };
  }
}

/** O papel vem do token, não do Firestore — o cliente não o pode forjar. */
export async function meuPapel() {
  const t = await auth.currentUser?.getIdTokenResult();
  return { papel: t?.claims?.papel ?? null, baseId: t?.claims?.baseId ?? null };
}
