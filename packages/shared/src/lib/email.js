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
 * O endereço CONFIRMA-SE com um código de 6 dígitos (2026-09 — "assim
 * que a pessoa colocar o e-mail, recebe um e-mail para confirmar"):
 * `pedirCodigoEmail` grava-o por confirmar e manda o código;
 * `confirmarCodigoEmail` confere-o e o servidor marca `verificado:
 * true` — o cliente nunca o consegue escrever (ver functions/email.js).
 * Só os confirmados recebem avisos. Por isso o endereço passa por Cloud
 * Function; o "não tenho e-mail" continua escrita direta (as regras
 * validam o formato) e funciona sem rede, como antes.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, chamar, db } from "./firebase.js";

/** Mesmo formato que a regra do Firestore exige. */
export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const refEmail = () => (auth.currentUser ? doc(db, `pessoas/${auth.currentUser.uid}/privado/email`) : null);

/** O meu e-mail, ao vivo: `undefined` a carregar, `null` se nunca
 *  respondi, ou `{ email, semEmail, verificado }`. */
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

const limpar = (email) => String(email || "").trim().toLowerCase();

/** Grava o e-mail (por confirmar) e manda-lhe um código. Resolve com
 *  `{ enviado }` ou `{ jaConfirmado }`. Os erros trazem `motivo`
 *  (`espera`, `pessoa`, `teto`, `desligado`, `envio`) quando o e-mail
 *  JÁ ficou gravado e só o código não saiu — ver `emailFicouGravado`. */
export function pedirCodigoEmail(email) {
  const limpo = limpar(email);
  if (!EMAIL_VALIDO.test(limpo) || limpo.length > 254) {
    return Promise.reject(new Error("Esse e-mail não parece certo — confirma se falta alguma letra."));
  }
  return chamar("enviarCodigoEmail")({ email: limpo }).then((r) => r.data);
}

export const emailFicouGravado = (err) => Boolean(err?.details?.motivo);

export function confirmarCodigoEmail(codigo) {
  const so = String(codigo || "").replace(/\D/g, "");
  if (so.length !== 6) return Promise.reject(new Error("O código tem 6 números."));
  return chamar("confirmarCodigoEmail")({ codigo: so }).then((r) => r.data);
}

/** `"confirmado"`, `"porConfirmar"`, `"semEmail"` ou `null` (nunca
 *  respondeu / a carregar). */
export function estadoDoEmail(meu) {
  if (!meu) return null;
  if (meu.semEmail) return "semEmail";
  if (!meu.email) return null;
  return meu.verificado === true ? "confirmado" : "porConfirmar";
}

export const dizerQueNaoTenhoEmail = () =>
  setDoc(refEmail(), { email: null, semEmail: true, atualizadoEm: serverTimestamp() });
