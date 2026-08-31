import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sem PWA/manifest de propósito — isto não é uma base do Portal (sem
// login, sem PIN, ver App.jsx), só um kiosk de uma função só.
export default defineConfig({
  server: { port: 5178, strictPort: true },
  plugins: [react()],
});
