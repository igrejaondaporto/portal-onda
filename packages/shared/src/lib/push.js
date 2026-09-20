/**
 * Notificações push — o lado do telemóvel.
 *
 * Esta é a infraestrutura que faltava ao produto inteiro. Até agora
 * nenhuma base tinha push nem email (está escrito em três sítios do
 * repo, incluindo o `MELHORIAS-ENTRE-BASES.md`), e por causa disso
 * havia funcionalidades paradas à espera dela: o lembrete de
 * confirmação de presença da Louvor, o aviso de reembolso pago, e o
 * recado do pastor, que aparece no Início mas não bate em lado nenhum.
 *
 * A chave VAPID já estava em `.env.production` desde sempre
 * (`VITE_FB_VAPID_KEY`) — provisionada e nunca usada. É a que isto
 * finalmente gasta.
 *
 * ── O que é preciso saber antes de mexer ────────────────────────
 *
 * 1. **A permissão só se pede a partir de um toque.** Os browsers
 *    ignoram (ou penalizam) um `requestPermission` no arranque da
 *    página, e o Safari recusa-o de todo. Por isso não há nada
 *    automático aqui: quem chama é um botão.
 * 2. **No iPhone só funciona com a app instalada** no ecrã principal.
 *    O Safari não dá push a um site aberto no separador, ponto. Como
 *    metade da equipa usa iPhone, `suportado()` distingue os dois
 *    casos para a interface poder dizer a verdade ("instala primeiro")
 *    em vez de mostrar um botão que nunca vai funcionar.
 * 3. **Um token não é uma pessoa, é um dispositivo.** A mesma pessoa
 *    com telemóvel e portátil tem dois; o token muda sozinho quando o
 *    browser o renova. Por isso é gravado por token
 *    (`pessoas/{uid}/dispositivos/{token}`) e revalidado a cada
 *    arranque — nunca "já pedi uma vez, está feito".
 * 4. **Nada disto bloqueia a app.** Cada passo falha em silêncio e
 *    devolve `false`: sem push a app funciona exatamente como
 *    funcionava ontem, que é como tem de ser.
 */
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, auth, db, BASE_ID } from "./firebase.js";

const VAPID = import.meta.env.VITE_FB_VAPID_KEY;

/** `standalone` = instalada no ecrã principal. O iOS só dá push neste
 *  caso; nos outros browsers é indiferente, mas saber disto deixa a
 *  interface explicar-se em vez de falhar. */
export function instaladaComoApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true
    || window.navigator.standalone === true;
}

const eIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Se este dispositivo pode receber push, e se não, porquê — o motivo
 * é o que deixa a interface dizer algo útil em vez de esconder o
 * botão e deixar a pessoa sem perceber.
 *
 * @returns {{ok: boolean, motivo?: "sem-suporte"|"instalar-primeiro"|"sem-chave"}}
 */
export function suportado() {
  if (!VAPID) return { ok: false, motivo: "sem-chave" };
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, motivo: "sem-suporte" };
  }
  // no iPhone, um site em separador nunca recebe push — e o
  // `Notification.permission` mente, devolvendo "default" como se
  // valesse a pena pedir
  if (eIOS() && !instaladaComoApp()) return { ok: false, motivo: "instalar-primeiro" };
  return { ok: true };
}

/** "default" (nunca respondeu) | "granted" | "denied" | null (não dá). */
export const estadoPermissao = () =>
  ("Notification" in window ? Notification.permission : null);

/** O `firebase/messaging` são ~30 kB que a esmagadora maioria das
 *  sessões nunca precisa de carregar (quem já recusou, quem está num
 *  browser sem suporte, quem só abriu para ver a escala). Import
 *  dinâmico: só entra no bundle de quem chega a ativar. */
async function messaging() {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return null;
  return { instancia: getMessaging(app), getToken };
}

/** O service worker é o do PWA (`vite-plugin-pwa`), que importa o
 *  `push-sw.js` — ver `scripts/gerar-push-sw.mjs`. Não se regista um
 *  segundo: dois service workers no mesmo âmbito substituem-se um ao
 *  outro, e o que se perderia era a atualização automática da app. */
const registoDoSW = () => navigator.serviceWorker?.ready ?? Promise.resolve(null);

/**
 * Pede a permissão (só a partir de um toque) e grava o token.
 * Devolve `true` só se ficou mesmo a receber.
 */
export async function ativarNotificacoes() {
  if (!suportado().ok) return false;
  try {
    if (Notification.permission !== "granted") {
      if (await Notification.requestPermission() !== "granted") return false;
    }
    return await registarDispositivo();
  } catch {
    return false;
  }
}

/**
 * Revalida o token deste dispositivo. Chamar a cada arranque de quem
 * já autorizou: o token do FCM caduca e é renovado pelo browser sem
 * avisar ninguém, e um token velho no Firestore é uma notificação que
 * nunca chega — sem erro nenhum a assinalá-lo.
 *
 * Não pede permissão: se ainda não foi dada, não faz nada.
 */
export async function revalidarDispositivo() {
  if (!suportado().ok || Notification.permission !== "granted") return false;
  try {
    return await registarDispositivo();
  } catch {
    return false;
  }
}

async function registarDispositivo() {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  const m = await messaging();
  if (!m) return false;

  const token = await m.getToken(m.instancia, {
    vapidKey: VAPID,
    serviceWorkerRegistration: (await registoDoSW()) ?? undefined,
  });
  if (!token) return false;

  await setDoc(doc(db, `pessoas/${uid}/dispositivos/${token}`), {
    // a base por onde a pessoa entrou neste dispositivo — serve para
    // o link da notificação abrir a app certa de quem serve em duas
    // bases, não para filtrar quem recebe o quê
    baseId: BASE_ID,
    ativo: true,
    agente: navigator.userAgent.slice(0, 180),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });

  return true;
}

/** Desligar é apagar o token, não marcar um booleano: enquanto o
 *  token existir no Firestore, o servidor continua a mandar, e uma
 *  notificação que chega depois de alguém desligar as notificações é
 *  a pior falha possível nesta funcionalidade.
 *
 *  A permissão do browser em si não se revoga por código (só nas
 *  definições do browser) — por isso quem voltar a ativar não é
 *  perguntado outra vez, só volta a gravar o token. */
export async function desativarNotificacoes() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const m = await messaging();
    if (!m) return;
    const token = await m.getToken(m.instancia, {
      vapidKey: VAPID,
      serviceWorkerRegistration: (await registoDoSW()) ?? undefined,
    });
    if (token) await deleteDoc(doc(db, `pessoas/${uid}/dispositivos/${token}`));
  } catch { /* sem token, não há nada para desligar */ }
}
