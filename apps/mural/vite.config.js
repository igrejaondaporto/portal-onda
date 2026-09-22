import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // 5183: primeira porta livre a seguir às 10 bases (5173–5182) — ver
  // CLAUDE.md raiz, "Ao criar uma base nova", item 4. O Mural não
  // entra em PORTAS_DEV (packages/shared/src/lib/auth.js): esse mapa
  // só serve o `trocarBase` entre bases, e não há "trocar para o
  // Mural" — quem entra aqui usa entrarMural/registarMural, uma
  // sessão à parte (ver functions/mural.js).
  server: { port: 5183, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // registo manual em main.jsx — ver o mesmo comentário nas apps
      // das bases (packages/shared/src/lib/pwa.js).
      injectRegister: false,
      manifest: {
        name: "Mural Onda — igrejaonda",
        short_name: "Mural Onda",
        description: "Anúncios de dou/vendo/arrendo e de procuro, da Igreja Onda",
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
