import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Base de Apoio — igrejaonda",
        short_name: "Base de Apoio",
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
