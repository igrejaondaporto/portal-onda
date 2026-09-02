import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5177, strictPort: true },
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
        name: "Base Pessoal — igrejaonda",
        short_name: "Base Pessoal",
        description: "Portal do voluntário da Igreja Onda, Porto",
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
