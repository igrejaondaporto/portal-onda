/**
 * Valor de património das bases em modo património (Técnica, Louvor)
 * — soma feita no servidor via Admin SDK, porque `bases/{b}/inventario`
 * é fechado por `minhaBase(b)` nas rules (ver obterPatrimonioBases,
 * functions/index.js). Só o Relatório usa isto.
 */
import { chamar } from "@portal/shared/lib/firebase.js";

export const obterPatrimonioBases = () => chamar("obterPatrimonioBases")().then((r) => r.data);
