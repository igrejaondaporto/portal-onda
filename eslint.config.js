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
import react from "eslint-plugin-react";
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
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // A razão de tudo isto. Erro, sempre, sem exceção.
      "react-hooks/rules-of-hooks": "error",

      // Aviso, não erro: as dependências em falta que restam são
      // deliberadas nuns sítios e por rever noutros, e nenhuma delas
      // parte a app. Fica à vista sem travar ninguém.
      "react-hooks/exhaustive-deps": "warn",

      // **Estas duas não são opcionais numa app React.** O
      // `no-unused-vars` do ESLint não sabe ler JSX: sem elas, dá por
      // não usado todo o componente que só aparece dentro de JSX — o
      // `App` do `main.jsx`, o `Inicio` do `Sessao.jsx`, e mais 150.
      // A primeira versão desta config não as tinha e o resultado foi
      // 169 falsos positivos que quase passaram por "código morto a
      // limpar". Com elas, o número real é 13.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",

      // As duas apps estão a zero (PR #29 na Técnica, #31 na Apoio),
      // por isso deixa de ser aviso: daqui para a frente um import
      // esquecido trava o PR em vez de se acumular. Importa
      // sobretudo para uma base nova — nasce copiada de uma destas, e
      // é assim que não herda lixo desde o primeiro dia.
      //   ignoreRestSiblings: `const { _k, ...m } = momento` é como se
      //   tira a chave da lista antes de gravar — o `_k` existe para
      //   ficar de fora, não é esquecimento (ver SheetRevisaoOrdem).
      "no-unused-vars": ["error", {
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
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

      // Aviso, não erro, ao contrário do frontend: falta uma
      // ocorrência (`cMelhorias` em `functions/index.js`), e esse
      // ficheiro **faz deploy sozinho ao entrar na `main`**. Um import
      // por limpar não justifica arrastar um deploy de backend por
      // arrasto — vai em PR próprio, com o smoke a seguir, e aí isto
      // passa a erro como o resto.
      "no-unused-vars": ["warn", {
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],

      // `try { ... } catch {}` a sondar se uma ref existe é
      // deliberado no `verificar-isolamento.mjs` — ignorar a falha é
      // o comportamento, não um esquecimento.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
