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

/* ── Login rápido (2026-10: "3 s para aparecer a lista de pessoas",
 * "30, 40 s para entrar depois do código") ──────────────────────
 * As bases e as pessoas de CADA base guardam-se no localStorage e
 * mostram-se logo na visita seguinte, enquanto a versão nova chega
 * em fundo (`preCarregarEntrada`, chamado ao abrir a Entrada — a
 * pessoa ainda está a ler "Já serves numa base?" e as listas já vêm
 * a caminho). São os mesmos nomes/fotos que `dadosEntrada` já
 * devolve a qualquer um, sem sessão — nada que não fosse público.
 * Storage em try/catch: sem ele (navegação privada) só fica mais
 * lento, nunca parte. */
const CHAVE_BASES = "mural.entrada.bases";
const chavePessoas = (baseId) => `mural.entrada.pessoas.${baseId}`;
function ler(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave) || "null");
  } catch {
    return null;
  }
}
function guardar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch { /* sem storage, segue sem cache */ }
}
export const basesGuardadas = () => ler(CHAVE_BASES);
export const pessoasGuardadas = (baseId) => ler(chavePessoas(baseId));

export async function listarBasesMural() {
  const { data } = await chamar("listarBasesMural")();
  guardar(CHAVE_BASES, data.bases);
  return data.bases;
}

// um pedido por base de cada vez: se já vai a caminho, reaproveita-o
const aCaminho = new Map();
export function dadosEntradaBase(baseId) {
  if (!aCaminho.has(baseId)) {
    const p = chamar("dadosEntrada")({ baseId })
      .then(({ data }) => {
        guardar(chavePessoas(baseId), data.pessoas);
        return data;
      })
      .finally(() => setTimeout(() => aCaminho.delete(baseId), 30_000));
    aCaminho.set(baseId, p);
  }
  return aCaminho.get(baseId);
}

/** Bases + as pessoas de todas, em paralelo. Devolve as bases. */
export async function preCarregarEntrada() {
  const bases = await listarBasesMural();
  bases.forEach((b) => dadosEntradaBase(b.id).catch(() => {}));
  return bases;
}

/** Acorda a função `entrar` enquanto a pessoa ainda escreve o PIN —
 *  o servidor responde `{quente:true}` sem ler nada (functions/
 *  aquecer.js). Erros ignorados: é só uma ajuda. */
export const aquecerEntrar = () => chamar("entrar")({ aquecer: true }).catch(() => {});
export const aquecerEntrarMural = () => chamar("entrarMural")({ aquecer: true }).catch(() => {});

/** Quem está a entrar (nome/foto já conhecidos da lista de rostos ou
 *  do registo) — App.jsx mostra-o logo, sem esperar pelo Firestore. */
let pessoaEmCurso = null;
export const definirPessoaEmCurso = (p) => { pessoaEmCurso = p; };
export const pessoaQueEntrou = () => pessoaEmCurso;

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
