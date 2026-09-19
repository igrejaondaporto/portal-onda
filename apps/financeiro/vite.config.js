import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5182, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // registo manual em main.jsx (registarAtualizacaoAutomatica) —
      // sem isto, o script auto-injetado só regista o SW e nunca
      // recarrega a página quando há versão nova (ver packages/shared
      // /src/lib/pwa.js).
      injectRegister: false,
      // o service worker do PWA importa o handler das notificações
      // de fundo (gerado por scripts/gerar-push-sw.mjs). É importado
      // e não registado à parte: dois service workers no mesmo
      // âmbito substituem-se um ao outro, e o que se perdia era a
      // atualização automática da app.
      workbox: { importScripts: ["push-sw.js"] },
      manifest: {
        name: "Financeiro — igrejaonda",
        short_name: "Financeiro",
        description: "Painel financeiro do Portal do Voluntário da Igreja Onda",
        start_url: "/",
        display: "standalone",
        background_color: "#0019BE",
        theme_color: "#0019BE",
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
