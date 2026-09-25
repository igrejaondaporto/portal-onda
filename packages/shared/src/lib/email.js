/**
 * O e-mail para os avisos — pedido 2026-09: "quero que as notificações
 * importantes também cheguem por e-mail".
 *
 * Vive em `pessoas/{uid}/privado/email`: global (quem serve em duas
 * bases tem um e-mail, não dois) e só da própria pessoa — as regras
 * não deixam nenhum líder lê-lo, mesmo padrão do IBAN em
 * `privado/pagamento`. As Cloud Functions leem-no pelo Admin SDK para
 * enviar (functions/email.js).
 *
 * Duas respostas válidas, e as regras só aceitam estas: um endereço,
 * ou "não tenho e-mail" (`semEmail: true`). As duas fecham o pop-up
 * do primeiro login (`PedirEmail.jsx`); só a primeira recebe e-mails.
 *
 * Escrita direta, não Cloud Function: o documento é da própria pessoa
 * e as regras já validam o formato. O pop-up fecha pelo `onSnapshot`
 * (que dispara logo com a escrita local), não pelo fim da promessa —
 * sem rede, a escrita fica em fila e o pop-up não prende ninguém à
 * porta da igreja.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

/** Mesmo formato que a regra do Firestore exige. */
export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const refEmail = () => (auth.currentUser ? doc(db, `pessoas/${auth.currentUser.uid}/privado/email`) : null);

/** O meu e-mail, ao vivo: `undefined` a carregar, `null` se nunca
 *  respondi, ou `{ email, semEmail }`. */
export function ouvirMeuEmail(cb) {
  const ref = refEmail();
  if (!ref) { cb(null); return () => {}; }
  return onSnapshot(ref, (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}

/** O pop-up do login está ligado? (`config/email.pedirNoLogin`, ligado
 *  por `scripts/definirEnvioEmail.mjs` quando o envio fica pronto.) */
export function ouvirPedirEmailNoLogin(cb) {
  return onSnapshot(doc(db, "config/email"), (s) => cb(s.exists() && s.data().pedirNoLogin === true), () => cb(false));
}

export function guardarMeuEmail(email) {
  const limpo = String(email || "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(limpo) || limpo.length > 254) {
    return Promise.reject(new Error("Esse e-mail não parece certo — confirma se falta alguma letra."));
  }
  return setDoc(refEmail(), { email: limpo, semEmail: false, atualizadoEm: serverTimestamp() });
}

export const dizerQueNaoTenhoEmail = () =>
  setDoc(refEmail(), { email: null, semEmail: true, atualizadoEm: serverTimestamp() });
