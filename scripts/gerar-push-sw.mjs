/**
 * Escreve o `push-sw.js` de cada app.
 *
 * Porque é gerado e não escrito à mão na pasta `public` de cada app: é o
 * mesmo ficheiro nas onze apps, e onze cópias editadas à mão divergem
 * à primeira correção. Mesmo padrão dos geradores de ícones que o repo
 * já tem (os `gerar-assets-<base>.mjs`) — a fonte de verdade é este
 * script, os ficheiros são saída.
 *
 * Porque vive em `public/` e não em `src/`: é um service worker, tem
 * de ser servido na raiz do domínio e não pode passar pelo bundler.
 * O service worker do PWA (gerado pelo `vite-plugin-pwa`) importa-o
 * com `workbox.importScripts` — ver o `vite.config.js` de cada app.
 * **Não se regista um service worker novo**: dois no mesmo âmbito
 * substituem-se um ao outro, e o que se perdia era a atualização
 * automática da app (`registarAtualizacaoAutomatica`).
 *
 * Porque a configuração do Firebase está escrita aqui em vez de vir
 * de `import.meta.env`: `public/` não passa pelo Vite, portanto não há
 * `import.meta.env` nenhum neste ficheiro. Os valores são os mesmos
 * nas onze apps (projeto Firebase único) e são públicos — está
 * escrito no próprio `.env.production`: "não são secretos (a segurança
 * vem das Regras do Firestore/Storage e do Auth, não de esconder
 * isto)".
 *
 *     node scripts/gerar-push-sw.mjs
 */
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APPS = new URL("../apps/", import.meta.url);

// A mesma versão do SDK que as apps usam (ver package.json de cada
// app: firebase ^10.12.0). Os "compat" são os únicos que funcionam
// dentro de um service worker sem bundler.
const SDK = "10.14.1";

const CONTEUDO = `/* GERADO POR scripts/gerar-push-sw.mjs — NÃO EDITAR À MÃO.
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
importScripts("https://www.gstatic.com/firebasejs/${SDK}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${SDK}/firebase-messaging-compat.js");

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
  // Payload só de \`data\`, nunca \`notification\` (ver functions/
  // notificacoes.js): com \`notification\` o browser desenha a
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
`;

const apps = readdirSync(fileURLToPath(APPS), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const app of apps) {
  const pasta = fileURLToPath(new URL(`${app}/public/`, APPS));
  if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });
  writeFileSync(`${pasta}push-sw.js`, CONTEUDO);
  console.log(`apps/${app}/public/push-sw.js`);
}

console.log(`\n${apps.length} ficheiros escritos.`);
console.log("Falta o workbox.importScripts no vite.config.js de cada app (feito uma vez, não é gerado).");
