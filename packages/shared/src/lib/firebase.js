import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
});

export const auth = getAuth(app);
// cache local persistente: quem chega às 08:00 de domingo sem rede na
// Casa do Povo continua a ver e a marcar o checklist — sincroniza
// sozinho quando a rede volta. Single-tab (não multiple-tab): duas abas
// da mesma conta não corrompem a cache uma da outra na mesma (a segunda
// cai sozinha para memória), mas sem a negociação de "aba principal"
// entre abas — essa negociação depende de escrever e ler o IndexedDB
// com sucesso nas duas pontas, e em navegação privada (sobretudo Safari
// no iOS) isso pode nunca resolver, travando a app inteira sem erro
// visível nenhum (nenhum pedido ao Firestore chega a responder). Sem
// IndexedDB disponível, nem tenta — cache em memória direto (sem
// offline, mas nunca trava).
export const db = typeof indexedDB === "undefined"
  ? initializeFirestore(app, { localCache: memoryLocalCache() })
  : initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: false }) }),
    });
export const storage = getStorage(app);
// tem de bater certo com o setGlobalOptions das functions
export const fns = getFunctions(app, "europe-west1");

// Ligar aos Emuladores é opt-in por VITE_USE_EMULATORS=true num
// .env.local que ninguém comita — nunca acontece num build de
// produção (VITE_FB_* de prod não define isto). Serve só para testar
// uma funcionalidade nova de ponta a ponta no Mac, sem tocar no
// Firestore/Functions reais. Cada base pode usar isto sem afetar as
// outras: é local ao browser de quem está a testar.
// As portas vêm do firebase.json por omissão; VITE_EMU_* só servem para
// correr um segundo conjunto de emuladores ao lado de outro já no ar
// (ex.: `--config` com outras portas), sem os dois se pisarem.
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  const porta = (nome, padrao) => Number(import.meta.env[`VITE_EMU_${nome}`] || padrao);
  connectFirestoreEmulator(db, "localhost", porta("FIRESTORE", 8080));
  connectFunctionsEmulator(fns, "localhost", porta("FUNCTIONS", 5001));
  connectAuthEmulator(auth, `http://localhost:${porta("AUTH", 9099)}`, { disableWarnings: true });
}

export const BASE_ID = import.meta.env.VITE_BASE_ID || "apoio";

// as Cloud Functions (entrar, atribuirFuncao…) precisam mesmo de rede —
// ao contrário do Firestore, não têm cache local. Falhar cedo com uma
// mensagem clara é melhor do que ficar pendurado sem se perceber porquê.
export const chamar = (nome) => {
  const fn = httpsCallable(fns, nome);
  return (dados) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return Promise.reject(new Error("Precisas de estar ligado à internet para isto."));
    }
    return fn(dados);
  };
};

export { signInWithCustomToken, signOut, onAuthStateChanged };
