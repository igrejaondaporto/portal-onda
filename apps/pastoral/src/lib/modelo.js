/**
 * Caminhos do Firestore usados por esta app.
 *
 * O Painel Pastoral é a segunda base sem escala, funções nem culto
 * próprio (a primeira foi o Financeiro) — tem gente
 * (`bases/pastoral/pessoas`, para entrar por PIN como qualquer base) e
 * lê a igreja inteira por cima das outras dez.
 *
 * O que está aqui é só o que o CLIENTE lê direto, e é sempre uma de
 * duas coisas:
 *
 *   1. já era legível por qualquer pessoa autenticada antes deste
 *      painel existir (`eventos/**`, `bases/{id}`) — e é lido em
 *      `onSnapshot` de propósito, porque o ecrã de domingo tem de ser
 *      ao vivo; ou
 *   2. abriu-se para a claim `ve_tudo_pastoral` nas regras, por ser
 *      uma lista a sério que perderia o tempo real dentro de uma
 *      função (`contactos`, `estatisticasCulto`, `recados`).
 *
 * Todo o resto (inventário, melhorias, wiki e pessoas das outras
 * bases) vem das Cloud Functions em `lib/pastoral.js` — ver o
 * cabeçalho de `functions/pastoral.js` para o porquê.
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

/* ── esta base ─────────────────────────────────────────────── */
export const cBase    = () => doc(db, "bases", BASE_ID);
export const cPessoas = () => collection(db, `bases/${BASE_ID}/pessoas`);
/** Modelos de ordem do culto — o domingo típico, guardado para não
 *  ser remontado de raiz toda a semana. Vive nesta base porque é do
 *  pastor, não da igreja: cada um tem o seu jeito de montar o culto. */
export const cModelosOrdem = () => collection(db, `bases/${BASE_ID}/modelosOrdem`);
export const cModeloOrdem  = (id) => doc(db, `bases/${BASE_ID}/modelosOrdem/${id}`);

/* ── a igreja (global, já legível a qualquer base) ──────────── */
export const cBases      = () => collection(db, "bases");
export const cEventos    = () => collection(db, "eventos");
export const cEvento     = (ev) => doc(db, `eventos/${ev}`);
export const cChecklist  = (ev) => collection(db, `eventos/${ev}/checklist`);
export const cContagem   = (ev) => doc(db, `eventos/${ev}/contagem/geral`);
export const cCultoAoVivo = (ev) => doc(db, `eventos/${ev}/cultoAoVivo/registo`);
export const cPonteiroAoVivo = () => doc(db, "config/cultoAoVivo");

/* ── aberto à claim ve_tudo_pastoral ────────────────────────── */
export const cContactos  = () => collection(db, "contactos");
export const cContacto   = (id) => doc(db, `contactos/${id}`);
export const cRecados    = () => collection(db, "recados");
