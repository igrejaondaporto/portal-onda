/**
 * Verifica se as alterações desta branch saem da app em que dizes
 * estar a trabalhar.
 *
 *     node scripts/verificar-isolamento.mjs tecnica
 *     npm run verificar:isolamento -- tecnica
 *
 * Não proíbe nada: há alterações partilhadas que são mesmo para
 * fazer. O que faz é garantir que ninguém toca no que serve todas
 * as bases sem dar por isso — o caso mau não é a mudança errada, é
 * a mudança certa feita no sítio que também repinta a Apoio.
 *
 * Sai com código 1 se encontrar ficheiros de risco, para poder ser
 * usado num hook de commit ou no CI.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const app = process.argv[2];

if (!app) {
  console.error("Falta dizer a app. Exemplo: node scripts/verificar-isolamento.mjs tecnica");
  process.exit(2);
}
if (!existsSync(`apps/${app}`)) {
  console.error(`Não existe apps/${app}. Apps disponíveis: veja a pasta apps/.`);
  process.exit(2);
}

/** Zonas partilhadas, e o que cada uma parte quando muda. */
const ZONAS = [
  ["functions/", "backend de TODAS as bases — e faz deploy sozinho ao entrar na main"],
  ["firestore.rules", "permissões de TODAS as bases — deploy automático"],
  ["storage.rules", "permissões de ficheiros de TODAS as bases — deploy automático"],
  ["firestore.indexes.json", "índices de TODAS as bases — deploy automático"],
  [".github/workflows/", "o que publica em produção — mexe em TODAS as bases"],
  ["packages/shared/src/styles/", "o visual de TODAS as bases"],
  ["packages/shared/", "código partilhado por TODAS as bases"],
  ["package-lock.json", "dependências do monorepo — conflitos difíceis de resolver à mão"],
];

const base = (() => {
  for (const ref of ["origin/main", "main"]) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: "ignore" });
      return ref;
    } catch {}
  }
  console.error("Não encontrei a branch main para comparar. Corre `git fetch origin`.");
  process.exit(2);
})();

const alterados = execSync(`git diff --name-only ${base}...HEAD; git diff --name-only; git ls-files -o --exclude-standard`)
  .toString()
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const unicos = [...new Set(alterados)];

if (!unicos.length) {
  console.log(`Sem alterações face a ${base}.`);
  process.exit(0);
}

const meus = unicos.filter((f) => f.startsWith(`apps/${app}/`));
const partilhados = unicos
  .map((f) => {
    const zona = ZONAS.find(([prefixo]) => f === prefixo || f.startsWith(prefixo));
    return zona ? { ficheiro: f, porque: zona[1] } : null;
  })
  .filter(Boolean);
const outros = unicos.filter(
  (f) => !f.startsWith(`apps/${app}/`) && !partilhados.some((p) => p.ficheiro === f)
);

console.log(`\nAlterações nesta branch, comparado com ${base}:\n`);
console.log(`  apps/${app}/  ${meus.length} ficheiro(s) — isolado, não afeta mais ninguém`);

if (outros.length) {
  console.log(`\n  Fora da tua app (${outros.length}):`);
  for (const f of outros) console.log(`    ${f}`);
  const outrasApps = outros.filter((f) => f.startsWith("apps/"));
  if (outrasApps.length) {
    console.log(`\n  ⚠️  Há ficheiros de OUTRA app aí em cima. Isso é de outra base.`);
  }
}

if (partilhados.length) {
  console.log(`\n  ⚠️  PARTILHADO — muda outras bases (${partilhados.length}):\n`);
  for (const { ficheiro, porque } of partilhados) {
    console.log(`    ${ficheiro}`);
    console.log(`      → ${porque}\n`);
  }
  console.log("  Se é mesmo para fazer, tudo bem — mas que vá em PR à parte,");
  console.log("  revisto por quem cuida das outras bases, e nunca no mesmo");
  console.log("  commit que uma correção da tua app.\n");
  process.exit(1);
}

console.log("\n✓ Nada partilhado tocado. Podes seguir.\n");
process.exit(0);
