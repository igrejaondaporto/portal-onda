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
