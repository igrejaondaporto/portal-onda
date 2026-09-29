/**
 * Simula o teste "Onde vais servir?" (apps/voluntario) com o código da
 * PRÓPRIA página: corre o <script> do index.html num vm e percorre
 * TODOS os caminhos do funil (cada resposta a/b), para várias pessoas
 * (sementes) diferentes.
 *
 * Correr sempre que se mexe no BANCO de perguntas:
 *
 *   node scripts/simularTesteVoluntario.mjs
 *
 * O que tem de dar (ver apps/voluntario/CLAUDE.md):
 *   - ao acaso, entre quem canta ou toca: ~10% a cada base (a média
 *     sobre sementes oscila ±2%);
 *   - quem NÃO canta nem toca: nunca Louvor nem Louvor Kinder, nem em
 *     1.º nem em 2.º;
 *   - quem responde sempre como a sua base: 100% de acerto (nas bases
 *     que não são de música, toque ou não);
 *   - no máximo 8 perguntas no funil (9 quando a da música aparece a
 *     mais no fim, para não sugerir Louvor a quem não toca).
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../apps/voluntario/index.html", import.meta.url), "utf8");
const js = html.split("<script>")[1].split("</script>")[0];
const stub = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === "querySelectorAll" ? () => [] : k === "querySelector" ? () => stub() : k === "classList" ? { add() {} } : undefined),
  set: (t, k, v) => ((t[k] = v), true),
});
const ctx = { document: { getElementById: () => stub() }, localStorage: { getItem: () => null, setItem() {} }, scrollTo() {}, setTimeout, addEventListener() {}, location: { hash: "" }, console };
vm.createContext(ctx);
vm.runInContext(js, ctx);
const run = (c) => vm.runInContext(c, ctx);
const IDS = run("IDS");
const MUSICA = run("MUSICA");
const lado = (pg, b) => run(`ladoDe(perguntaPorId(${JSON.stringify(pg.id)}), ${JSON.stringify(b)})`);

/* pA(pergunta) = probabilidade de responder "a" */
function caminhos(semente, pA) {
  const g1 = Object.fromEntries(IDS.map((b) => [b, 0])), g2 = Object.fromEntries(IDS.map((b) => [b, 0]));
  let nq = 0, max = 0;
  (function andar(lista, p) {
    run(`semente = ${semente}; prepararSorteio(semente); resps = ${JSON.stringify(lista)};`);
    const pg = run("proximaPergunta()");
    if (!pg) {
      const o = run("ordemFinal()");
      g1[o[0]] += p; g2[o[1]] += p; nq += p * lista.length; max = Math.max(max, lista.length);
      return;
    }
    const a = pA(pg);
    if (a > 0) andar([...lista, { id: pg.id, r: "a" }], p * a);
    if (a < 1) andar([...lista, { id: pg.id, r: "b" }], p * (1 - a));
  })([], 1);
  return { g1, g2, nq, max };
}

let falhas = 0;

// 1) ao acaso, entre quem canta ou toca
const N = 200, tot = Object.fromEntries(IDS.map((b) => [b, 0])); let nq = 0, max = 0;
for (let s = 1; s <= N; s++) {
  const r = caminhos((s * 7919) % 999983, (pg) => (pg.id === "musica" ? 1 : 0.5));
  IDS.forEach((b) => { tot[b] += r.g1[b] / N; }); nq += r.nq / N; max = Math.max(max, r.max);
}
console.log(`Ao acaso, quem canta ou toca (${N} pessoas): ` + IDS.map((b) => `${b} ${(tot[b] * 100).toFixed(1)}%`).join(" · "));
console.log(`Perguntas no funil: ${nq.toFixed(2)} em média, ${max} no máximo`);
const fora = IDS.filter((b) => Math.abs(tot[b] - 0.1) > 0.02);

// 2) quem não toca nunca recebe Louvor nem Louvor Kinder
let musicaSemTocar = 0;
for (let s = 1; s <= 40; s++) {
  const r = caminhos((s * 6007) % 999983, (pg) => (pg.id === "musica" ? 0 : 0.5));
  MUSICA.forEach((b) => { musicaSemTocar += r.g1[b] + r.g2[b]; });
}
console.log(`Ao acaso, quem NÃO toca: Louvor/Louvor Kinder sugeridos ${(musicaSemTocar * 100).toFixed(2)}% das vezes`);
if (musicaSemTocar > 0) falhas++;

// 3) quem responde sempre como a sua base
const linha = IDS.map((alvo) => {
  const toca = MUSICA.includes(alvo) ? [1] : [1, 0];
  let ok = 0;
  for (const t of toca) {
    for (let s = 1; s <= 10; s++) {
      ok += caminhos((s * 104729) % 999983, (pg) => {
        if (pg.id === "musica") return t;
        const l = lado(pg, alvo);
        return l === "a" ? 1 : l === "b" ? 0 : 0.5;
      }).g1[alvo] / (10 * toca.length);
    }
  }
  if (ok < 0.999) falhas++;
  return `${alvo} ${Math.round(ok * 100)}%`;
});
console.log("Quem responde como a base: " + linha.join(" · "));

if (falhas || fora.length || max > 9) {
  console.error(`\n✗ Falhou: ${falhas} verificação(ões) de acerto/música, desequilíbrio em [${fora}], máximo ${max}.`);
  process.exit(1);
}
console.log("\n✓ Equilibrado e certeiro.");
