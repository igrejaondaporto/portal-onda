/**
 * Seed mínimo da Base Kinder, contra os EMULADORES (nunca produção) —
 * para testar a app manualmente no browser. As portas batem com
 * firebase.kinder-teste.json / apps/kinder/.env.local.
 *
 *   PORTA_FIRESTORE=8180 PORTA_AUTH=9199 node scripts/seed-kinder-emulador.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${process.env.PORTA_FIRESTORE || 8180}`;
import admin from "firebase-admin";
import { randomBytes, scryptSync } from "node:crypto";

admin.initializeApp({ projectId: "painel-onda" });
const db = admin.firestore();
const hash = (pin) => { const s = randomBytes(16).toString("hex"); return `${s}:${scryptSync(pin, s, 64).toString("hex")}`; };
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function pessoa(id, nome, papel, categoria, pin) {
  await db.doc(`bases/kinder/pessoas/${id}`).set({ nome, papel, categoria, ativo: true, foto: null, telefone: "" });
  await db.doc(`pessoas/${id}`).set({ nome, foto: null, bases: { kinder: true } });
  await db.doc(`pessoas/${id}/privado/auth`).set({ pinHash: hash(pin), pinDigitos: pin.length, provisorio: false, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
}

await db.doc("bases/kinder").set({ nome: "Kinder", cor: "#7B5CFF", horaChegada: "09:00", horaCulto: "10:30", local: "Casa do Povo de Vermoim, Maia", ativa: true });
await db.doc(`eventos/${hoje()}`).set({ data: hoje(), tipo: null, horaCulto: "10:30", ativo: true });
await pessoa("maria-kinder", "Maria", "lider_base", null, "123456");
await pessoa("thamirys-kinder", "Thamirys", "auxiliar", "baby", "123456");
await pessoa("carol-kinder", "Carol", "auxiliar", "fun", "123456");
await pessoa("larissa-kinder", "Larissa", "auxiliar", "junior", "123456");
await pessoa("vol-baby-kinder", "Sofia", "voluntario", "baby", "1234");
await db.doc(`eventos/${hoje()}/escalas/kinder`).set({ baseId: "kinder", liderEscala: "thamirys-kinder", pessoas: ["thamirys-kinder", "vol-baby-kinder"] });
await db.collection("bases/kinder/capacitacoes").doc("primeiros-socorros").set({ titulo: "Primeiros socorros", obrigatoria: true, temValidade: false, ativo: true, ordem: 1 });
await db.collection("bases/kinder/capacitacoes").doc("registo-criminal").set({ titulo: "Certificado de registo criminal", obrigatoria: true, temValidade: true, ativo: true, ordem: 2 });

console.log("Seed da Kinder (emulador) pronto — líderes com PIN 123456, voluntária 1234.");
process.exit(0);
