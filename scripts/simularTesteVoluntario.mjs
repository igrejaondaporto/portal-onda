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
 *   - ao acaso: ~10% a cada base (a média sobre sementes oscila ±1%;
 *     o desenho é exatamente 10%);
 *   - quem responde sempre como a sua base: 100% de acerto;
 *   - no máximo 8 perguntas no funil.
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

function caminhos(semente, pA) {
  const g1 = Object.fromEntries(IDS.map((b) => [b, 0])); let nq = 0, max = 0;
  (function andar(lista, p) {
    run(`semente = ${semente}; prepararSorteio(semente); resps = ${JSON.stringify(lista)};`);
    const pg = run("proximaPergunta()");
    if (!pg) { g1[run("ordenadas(contagem())")[0]] += p; nq += p * lista.length; max = Math.max(max, lista.length); return; }
    const a = pA(pg);
    if (a > 0) andar([...lista, { id: pg.id, r: "a" }], p * a);
    if (a < 1) andar([...lista, { id: pg.id, r: "b" }], p * (1 - a));
  })([], 1);
  return { g1, nq, max };
}

const N = 200, tot = Object.fromEntries(IDS.map((b) => [b, 0])); let nq = 0, max = 0;
for (let s = 1; s <= N; s++) {
  const r = caminhos((s * 7919) % 999983, () => 0.5);
  IDS.forEach((b) => { tot[b] += r.g1[b] / N; }); nq += r.nq / N; max = Math.max(max, r.max);
}
console.log(`Ao acaso (${N} pessoas): ` + IDS.map((b) => `${b} ${(tot[b] * 100).toFixed(1)}%`).join(" · "));
console.log(`Perguntas no funil: ${nq.toFixed(2)} em média, ${max} no máximo`);

let falhas = 0;
const lado = (pg, b) => run(`ladoDe(BANCO.find((x) => x.id === ${JSON.stringify(pg.id)}), ${JSON.stringify(b)})`);
const linha = IDS.map((alvo) => {
  let ok = 0;
  for (let s = 1; s <= 10; s++) ok += caminhos((s * 104729) % 999983, (pg) => { const l = lado(pg, alvo); return l === "a" ? 1 : l === "b" ? 0 : 0.5; }).g1[alvo] / 10;
  if (ok < 0.999) falhas++;
  return `${alvo} ${Math.round(ok * 100)}%`;
});
console.log("Quem responde como a base: " + linha.join(" · "));
const fora = IDS.filter((b) => Math.abs(tot[b] - 0.1) > 0.015);
if (falhas || fora.length || max > 8) { console.error(`\n✗ Falhou: ${falhas} base(s) sem 100%, desequilíbrio em [${fora}], máximo ${max}.`); process.exit(1); }
console.log("\n✓ Equilibrado e certeiro.");
