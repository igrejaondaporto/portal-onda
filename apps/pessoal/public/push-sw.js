/* GERADO POR scripts/gerar-push-sw.mjs — NÃO EDITAR À MÃO.
 *
 * Notificações que chegam com a app fechada. É importado pelo service
 * worker do PWA (workbox importScripts, ver vite.config.js), nunca
 * registado à parte: dois service workers no mesmo âmbito
 * substituem-se, e perder-se-ia a atualização automática da app.
 *
 * A configuração abaixo é pública (mesma que vai no .env.production de
 * todas as apps — "não são secretos: a segurança vem das Regras do
 * Firestore/Storage e do Auth"). public/ não passa pelo Vite, por isso
 * não há import.meta.env aqui.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCI6P38-lNgXBUXBRRC0uSQkRmpmUsIkbg",
  authDomain: "painel-onda.firebaseapp.com",
  projectId: "painel-onda",
  storageBucket: "painel-onda.firebasestorage.app",
  messagingSenderId: "400975510966",
  appId: "1:400975510966:web:43f11156573b69eee11517",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const d = payload.data || {};
  // Payload só de `data`, nunca `notification` (ver functions/
  // notificacoes.js): com `notification` o browser desenha a
  // notificação sozinho E chama este handler, e a pessoa recebe duas.
  self.registration.showNotification(d.titulo || "igrejaonda", {
    body: d.corpo || "",
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    // agrupa por assunto: três recados seguidos substituem-se em vez
    // de encherem a barra de notificações
    tag: d.tag || "igrejaonda",
    data: { url: d.url || "/" },
  });
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url || "/";
  // Se a app já está aberta, foca-a em vez de abrir um segundo
  // separador da mesma coisa.
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.includes(self.location.origin) && "focus" in j) return j.focus();
      }
      return self.clients.openWindow(destino);
    })
  );
});
