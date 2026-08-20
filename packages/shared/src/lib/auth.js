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

/** Entrada de dev — mesmo mecanismo do PIN (bloqueio de tentativas
 *  incluído), mas sem pessoa nenhuma por trás: dá acesso de líder da
 *  base sem depender do código de ninguém. Ver `entrarComoDev` em
 *  functions/index.js. */
export async function entrarComoDev(senha) {
  try {
    const { data } = await chamar("entrarComoDev")({ baseId: BASE_ID, senha });
    await signInWithCustomToken(auth, data.token);
    return { ok: true };
  } catch (e) {
    const d = e.details || {};
    if (e.message === "bloqueado" || d.bloqueado) {
      return { ok: false, bloqueado: true, faltamSegundos: d.faltamSegundos ?? 900 };
    }
    return { ok: false, restam: d.restam ?? null };
  }
}

export const sair = () => signOut(auth);

/** Portas do `npm run dev` de cada app — tem de bater com o
 *  `server.port` do vite.config.js respectivo. */
export const PORTAS_DEV = {
  apoio: 5173,
  tecnica: 5174,
  backstage: 5175,
  comunicacao: 5176,
};

/** Troca de base sem pedir PIN outra vez. Cada base é uma app e um
 *  domínio separados (apoio.igrejaonda.pt, tecnica.igrejaonda.pt…) —
 *  trocar os claims do token sozinho não muda qual app está a
 *  correr no browser. Por isso isto navega mesmo para o domínio da
 *  base nova, levando o token novo na fragment da URL (nunca vai para
 *  o servidor nem fica em logs); a app que abre lê-o em `lerTokenDaUrl`
 *  e entra sem pedir PIN outra vez. Em localhost navega para a porta
 *  da app de destino, se a conhecermos; senão troca os claims no sítio. */
export async function trocarBase(novoBaseId) {
  try {
    const { data } = await chamar("trocarBase")({ novoBaseId });
    const local = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    if (local) {
      const porta = PORTAS_DEV[novoBaseId];
      if (porta && window.location.port !== String(porta)) {
        const url = `http://localhost:${porta}/#tok=${encodeURIComponent(data.token)}`;
        window.location.assign(url);
        return { ok: true, url };
      }
      await signInWithCustomToken(auth, data.token);
      return { ok: true };
    }
    // O domínio sai de onde esta app está a correr, não de uma
    // constante: troca-se só o primeiro rótulo. A 17/08/2026 as bases
    // mudaram de `painelonda.pt` para `igrejaonda.pt` e esta linha,
    // que tinha o domínio escrito à mão, ficou a mandar toda a gente
    // para um sítio que já não existia. Assim a próxima mudança de
    // domínio não parte nada — basta os subdomínios continuarem a ser
    // o baseId, que é o que os torna endereçáveis.
    const dominio = window.location.hostname.split(".").slice(1).join(".");
    const url = `https://${novoBaseId}.${dominio}/#tok=${encodeURIComponent(data.token)}`;
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

/** O papel vem do token, não do Firestore — o cliente não o pode forjar.
 *  `veTodasEscalas` e `podePublicarCulto` são capacidades de base (ver
 *  bases/{b}.veEscalas e bases/{b}.culto.podePublicar no CLAUDE.md
 *  raiz) — nas bases sem a capacidade vêm sempre false, claim ausente. */
export async function meuPapel() {
  const t = await auth.currentUser?.getIdTokenResult();
  return {
    papel: t?.claims?.papel ?? null,
    baseId: t?.claims?.baseId ?? null,
    veTodasEscalas: t?.claims?.ve_todas_escalas === true,
    podePublicarCulto: t?.claims?.pode_publicar_culto === true,
    feedbackAberto: t?.claims?.feedback_aberto === true,
  };
}
