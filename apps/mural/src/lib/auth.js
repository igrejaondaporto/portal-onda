import { auth, chamar, signInWithCustomToken, signOut } from "@portal/shared/lib/firebase.js";

/* ── "Sim, sirvo numa base" ───────────────────────────────────────
 * Mesmas Cloud Functions de sempre (dadosEntrada/entrar, em
 * functions/index.js) — nenhuma app de base precisa disto porque
 * cada uma já sabe a sua (VITE_BASE_ID); o Mural serve a igreja
 * toda, por isso acrescenta só o passo de ESCOLHER a base primeiro.
 *
 * `SheetPinBase` (components/adaptados/ — cópia do SheetPin
 * partilhado, ver o LEIA-ME dessa pasta) importa `entrarComPin
 * (pessoaId, pin)` DESTE ficheiro — sem `baseId` no meio, porque nas
 * apps de base ele é sempre o mesmo, fixo por VITE_BASE_ID. Aqui
 * varia conforme a base escolhida na Entrada, por isso fica guardado
 * neste módulo (`definirBaseEmCurso`, chamado assim que a pessoa
 * escolhe a base) — bloqueio de tentativas herdado tal e qual. */
let baseEmCurso = null;
export const definirBaseEmCurso = (baseId) => { baseEmCurso = baseId; };

export async function listarBasesMural() {
  const { data } = await chamar("listarBasesMural")();
  return data.bases;
}
export async function dadosEntradaBase(baseId) {
  const { data } = await chamar("dadosEntrada")({ baseId });
  return data;
}
export async function entrarComPin(pessoaId, pin) {
  try {
    const { data } = await chamar("entrar")({ baseId: baseEmCurso, pessoaId, pin });
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

/* ── "Não, sou da igreja" — telemóvel + PIN (functions/mural.js) ── */
export async function pedirEntradaMural(telefone) {
  const { data } = await chamar("pedirEntradaMural")({ telefone });
  return data; // { existe, digitos? }
}
export async function entrarComPinMural(telefone, pin) {
  try {
    const { data } = await chamar("entrarMural")({ telefone, pin });
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
export async function registarMural({ telefone, pin, nome, gdId }) {
  try {
    const { data } = await chamar("registarMural")({ telefone, pin, nome, gdId });
    await signInWithCustomToken(auth, data.token);
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: e.message || "Não foi possível registar." };
  }
}
export async function trocarPinMural(pinAtual, pinNovo) {
  try {
    await chamar("trocarPinMural")({ pinAtual, pinNovo });
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: e.message || "Não foi possível trocar o código." };
  }
}

export const sair = () => signOut(auth);
