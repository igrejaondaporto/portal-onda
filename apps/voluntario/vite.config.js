import { defineConfig } from "vite";

export default defineConfig({
  // 5186: a primeira porta livre a seguir às apps que já existem
  // (5173–5185). Não entra em PORTAS_DEV (packages/shared/src/lib/
  // auth.js): não é uma base, não há login nem `trocarBase`.
  server: { port: 5186, strictPort: true },
});
