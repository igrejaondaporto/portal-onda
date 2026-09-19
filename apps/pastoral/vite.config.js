import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5183, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // registo manual em main.jsx (registarAtualizacaoAutomatica) —
      // sem isto, o script auto-injetado só regista o SW e nunca
      // recarrega a página quando há versão nova (ver packages/shared
      // /src/lib/pwa.js).
      injectRegister: false,
      manifest: {
        name: "Pastoral — igrejaonda",
        short_name: "Pastoral",
        description: "Painel Pastoral do Portal do Voluntário da Igreja Onda",
        start_url: "/",
        display: "standalone",
        background_color: "#0F766E",
        theme_color: "#0F766E",
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
