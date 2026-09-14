/**
 * Confirma o fix do bug real: frase e feedback deixaram de ser
 * globais em eventos/{e} e passaram para eventos/{e}/escalas/{baseId}
 * — cada base só vê a sua. Contra os EMULADORES, nunca produção.
 */
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9199";

import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithCustomToken, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const PROJETO = "painel-onda";
admin.initializeApp({ projectId: PROJETO });
const adb = admin.firestore();
const app = initializeApp({ apiKey: "demo", projectId: PROJETO, authDomain: `${PROJETO}.firebaseapp.com` });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8180);
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, "127.0.0.1", 5101);
const chamar = (nome, dados) => httpsCallable(fns, nome)(dados).then((r) => r.data);

let passou = 0, falhou = 0;
async function teste(nome, fn) {
  try { await fn(); console.log(`✔ ${nome}`); passou++; }
  catch (e) { console.error(`✘ ${nome} — ${e.message}`); falhou++; }
}
const afirmar = (c, m) => { if (!c) throw new Error(m); };
async function como(uid, claims) { await signOut(auth); await signInWithCustomToken(auth, await admin.auth().createCustomToken(uid, claims)); }

const HOJE = "2026-09-14";
await adb.doc("bases/apoio").set({ nome: "Apoio", ativa: true });
await adb.doc("bases/backstage").set({ nome: "Backstage", ativa: true, feedbackAberto: true });
await adb.doc(`eventos/${HOJE}`).set({ data: HOJE, tipo: null });
await adb.doc(`eventos/${HOJE}/escalas/apoio`).set({ baseId: "apoio", liderEscala: "lider-apoio", pessoas: ["lider-apoio"] });
await adb.doc(`eventos/${HOJE}/escalas/backstage`).set({ baseId: "backstage", liderEscala: "lider-bs", pessoas: ["lider-bs"] });

for (let i = 0; i < 60; i++) { try { await fetch("http://127.0.0.1:5101/"); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

await teste("Apoio grava a sua frase; Backstage não a vê no documento global do evento", async () => {
  await como("lider-apoio", { baseId: "apoio", papel: "lider_base" });
  await chamar("definirFrase", { eventoId: HOJE, frase: "Frase secreta da Apoio" });
  const evGlobal = (await adb.doc(`eventos/${HOJE}`).get()).data();
  afirmar(evGlobal.frase === undefined, `frase escapou para o documento global: ${JSON.stringify(evGlobal.frase)}`);
  const escApoio = (await adb.doc(`eventos/${HOJE}/escalas/apoio`).get()).data();
  afirmar(escApoio.frase === "Frase secreta da Apoio", "frase não ficou na escala da Apoio");
  const escBs = (await adb.doc(`eventos/${HOJE}/escalas/backstage`).get()).data();
  afirmar(escBs.frase === undefined, "a frase da Apoio vazou para a escala da Backstage");
});

await teste("Backstage grava o seu feedback (feedback_aberto); Apoio não o vê", async () => {
  await como("lider-bs", { baseId: "backstage", papel: "lider_base", feedback_aberto: true });
  await chamar("definirFeedback", { eventoId: HOJE, texto: "Feedback da Backstage" });
  const evGlobal = (await adb.doc(`eventos/${HOJE}`).get()).data();
  afirmar(evGlobal.feedback === undefined, "feedback escapou para o documento global");
  const escBs = (await adb.doc(`eventos/${HOJE}/escalas/backstage`).get()).data();
  afirmar(escBs.feedback?.texto === "Feedback da Backstage", "feedback não ficou na escala da Backstage");
  const escApoio = (await adb.doc(`eventos/${HOJE}/escalas/apoio`).get()).data();
  afirmar(escApoio.feedback === undefined, "o feedback da Backstage vazou para a escala da Apoio");
  afirmar(escApoio.frase === "Frase secreta da Apoio", "a frase da Apoio, gravada antes, foi apagada por engano");
});

await teste("Apoio lê a escala da Backstage e não vê o feedback dela (regras)", async () => {
  await como("lider-apoio", { baseId: "apoio", papel: "lider_base" });
  try {
    await getDoc(doc(db, `eventos/${HOJE}/escalas/backstage`));
    throw new Error("devia ter sido recusado pelas regras");
  } catch (e) {
    afirmar(e.code === "permission-denied" || /permission/i.test(e.message), `erro inesperado: ${e.message}`);
  }
});

console.log(`\n${passou} passaram, ${falhou} falharam.`);
process.exit(falhou ? 1 : 0);
