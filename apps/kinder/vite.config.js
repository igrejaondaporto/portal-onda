import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Uma app, três portas de entrada (ver src/App.jsx): o Portal com PIN
// na raiz, o kiosk de chamadas em /chamadas (sem login, como sempre
// foi) e as páginas dos pais em /registo e /familia/<token>. O PWA é
// o do Portal — o kiosk e as páginas dos pais só beneficiam da cache.
export default defineConfig({
  server: { port: 5178, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // registo manual em main.jsx (registarAtualizacaoAutomatica) — ver
      // packages/shared/src/lib/pwa.js
      injectRegister: false,
      // o service worker do PWA importa o handler das notificações
      // de fundo (gerado por scripts/gerar-push-sw.mjs). É importado
      // e não registado à parte: dois service workers no mesmo
      // âmbito substituem-se um ao outro, e o que se perdia era a
      // atualização automática da app.
      workbox: { importScripts: ["push-sw.js"] },
      manifest: {
        name: "Base Kinder — igrejaonda",
        short_name: "Kinder",
        description: "Portal do voluntário do Kinder da Igreja Onda, Porto",
        start_url: "/",
        display: "standalone",
        background_color: "#001ED1",
        theme_color: "#001ED1",
        lang: "pt-PT",
        icons: [
          { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
