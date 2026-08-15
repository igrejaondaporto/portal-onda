/**
 * ESLint do monorepo — a rede que faltava.
 *
 * Porque é que isto existe: a 15/08/2026 subiu para produção um
 * `useMemo` colocado **abaixo** de um `if (!meuEvento) return null;`
 * no Início da Base Técnica. Violação das regras dos hooks → erro
 * React #310 → ecrã branco, a base inteira inacessível. O
 * `vite build` passou sem uma única queixa: ele compila, não valida
 * ordem de hooks nem identificadores por definir.
 *
 * A regra que interessa, e a única que **bloqueia**, é
 * `react-hooks/rules-of-hooks`. O resto é acompanhamento.
 *
 * Uma config só, na raiz, a cobrir `apps/*` e `packages/shared` —
 * é código partilhado, e mudanças aqui mudam o que o CI diz a todas
 * as bases. Ver a regra do isolamento no CLAUDE.md da raiz.
 */

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    // Sem isto o eslint analisa o bundle minificado e devolve
    // centenas de falsos positivos.
    ignores: ["**/dist/**", "**/dev-dist/**", "**/node_modules/**"],
  },

  {
    // Há comentários `// eslint-disable-next-line
    // react-hooks/exhaustive-deps` espalhados pelo código das apps, e
    // alguns já não são precisos. Denunciá-los aqui obrigaria a mexer
    // no código de outra base no mesmo PR que a config — exatamente o
    // que a regra do isolamento pede para não fazer. Limpar isso é
    // trabalho de cada base, no PR dela.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },

  // ── Frontend: as apps e o partilhado ────────────────────────────
  {
    files: ["apps/*/src/**/*.{js,jsx}", "packages/*/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // A razão de tudo isto. Erro, sempre, sem exceção.
      "react-hooks/rules-of-hooks": "error",

      // Aviso, não erro: as dependências em falta que restam são
      // deliberadas nuns sítios e por rever noutros, e nenhuma delas
      // parte a app. Fica à vista sem travar ninguém.
      "react-hooks/exhaustive-deps": "warn",

      // Desligada por agora: são ~170 ocorrências antigas espalhadas
      // pelas duas apps, e limpá-las é um PR por base, não este.
      // Ligar quando estiverem tratadas.
      "no-unused-vars": "off",
    },
  },

  // ── Node: scripts da raiz, functions e ficheiros de configuração ─
  {
    files: [
      "scripts/**/*.{js,mjs}",
      "functions/**/*.js",
      "*.config.js",
      "apps/*/vite.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",

      // `try { ... } catch {}` a sondar se uma ref existe é
      // deliberado no `verificar-isolamento.mjs` — ignorar a falha é
      // o comportamento, não um esquecimento.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
