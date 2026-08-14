import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

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
