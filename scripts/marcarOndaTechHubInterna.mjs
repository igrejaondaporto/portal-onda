/**
 * Marca `bases/ondatechhub` como `interna: true` e
 * `semEscalaDeCulto: true` (pedido 2026-09: "a Onda Tech Hub é só uma
 * página para controlar as melhorias, não precisa aparecer nas
 * estatísticas").
 *
 * - `interna`: tira-a de tudo o que conta "as bases da igreja" —
 *   `basesDaIgreja` (Painel Pastoral: Bases, Pessoas, Números,
 *   Património, agenda), `escalasCrossBase`/`checklistCrossBase`
 *   (Backstage e Domingo do painel) e `listarBasesMural`.
 * - `semEscalaDeCulto`: nunca aparece como "sem escala" nem na escolha
 *   de bases da agenda (que lê `bases` direto no cliente).
 *
 * O login, o PIN, a troca de base e os relatos continuam iguais — ela
 * continua a ser uma "base" na arquitetura, só não conta.
 *
 *   node scripts/marcarOndaTechHubInterna.mjs   (com service-account.json na raiz)
 *
 * Idempotente (merge).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });

await admin.firestore().doc("bases/ondatechhub").set({ interna: true, semEscalaDeCulto: true }, { merge: true });
console.log("bases/ondatechhub: interna = true, semEscalaDeCulto = true");
