/**
 * O cabeçalho dos e-mails dos avisos (functions/email.js), como IMAGEM.
 *
 * Porque imagem e não texto: o modo escuro do Gmail (iPhone/Android)
 * inverte as cores do texto de um e-mail — o "igrejaonda" branco e o
 * "PORTAL DO VOLUNTÁRIO" lima sobre o azul ficavam quase pretos,
 * ilegíveis (reportado 2026-09). Uma imagem nunca é invertida.
 *
 * Desenhado no Chromium (Playwright) com a Outfit do Google Fonts, a
 * mesma tipografia do logo do painel (`.logo` em global.css: "igreja"
 * normal + "onda" 800, branco). Sai a 2× (960×200) para ecrãs retina;
 * o e-mail mostra-a a 480 de largura.
 *
 *   node scripts/gerar-cabecalho-email.cjs
 *   (precisa do playwright com um Chromium — PLAYWRIGHT_CHROMIUM=/caminho/do/chrome)
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const path = require("node:path");

const HTML = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  .c{width:480px;height:100px;box-sizing:border-box;padding:24px 24px 0;
     background:linear-gradient(135deg,#001ed1 0%,#0019be 52%,#001594 100%);
     font-family:Outfit,sans-serif;color:#fff}
  .logo{font-size:26px;letter-spacing:-.035em;line-height:1;white-space:nowrap}
  .logo i{font-style:normal;font-weight:400}.logo b{font-weight:800}
  .sub{margin-top:9px;font-size:11.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#1fd5b6}
</style></head><body>
<div class="c"><div class="logo"><i>igreja</i><b>onda</b></div><div class="sub">Portal do Voluntário</div></div>
</body></html>`;

(async () => {
  const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 480, height: 100 }, deviceScaleFactor: 2 });
  await p.setContent(HTML, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const destino = path.join(__dirname, "../apps/pastoral/public/email/cabecalho.png");
  await p.locator(".c").screenshot({ path: destino });
  console.log("gerado:", destino, await p.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight)));
  await b.close();
})();
