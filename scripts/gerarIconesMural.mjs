/**
 * Gera o favicon, os ícones do PWA e a imagem de partilha do Mural
 * Onda — mesmo fundo (gradiente azul #001ed1 → #0019be → #001594) de
 * todas as bases, só muda o texto (ver CLAUDE.md raiz, "Ao criar uma
 * base nova", item 1). O Mural não é uma base, mas a app é um
 * Cloudflare Worker igual às outras e precisa dos mesmos ficheiros.
 *
 * Já corrido uma vez (os ficheiros estão em apps/mural/public/) —
 * volta a correr só se quiseres gerar de novo (outro texto, outra
 * cor):
 *
 *   npm install   (se ainda não tiveres node_modules)
 *   node scripts/gerarIconesMural.mjs
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "apps/mural/public";
mkdirSync(OUT, { recursive: true });
const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#001ed1"/><stop offset="52%" stop-color="#0019be"/><stop offset="100%" stop-color="#001594"/>
</linearGradient>`;
const FONTE = "Outfit, 'Helvetica Neue', Arial, sans-serif";

const quadrado = (tamanho, texto, tamanhoTexto) => `
<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="${tamanho}" height="${tamanho}" fill="url(#g)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="${FONTE}" font-weight="700" font-size="${tamanhoTexto}" fill="#ffffff">${texto}</text>
</svg>`;

async function gerar(nome, svg) {
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${nome}`);
  console.log(`✓ ${nome}`);
}

await gerar("icone-192.png", quadrado(192, "mural", 34));
await gerar("icone-512.png", quadrado(512, "mural", 92));
await gerar("apple-touch-icon.png", quadrado(180, "mural", 32));

// favicon: abreviação de 2-3 letras, maiúsculas (ver a convenção no
// CLAUDE.md raiz) — SVG serve direto no browser, sem precisar de sharp.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRAD}</defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
    font-family="${FONTE}" font-weight="800" font-size="26" fill="#ffffff">MO</text>
</svg>`;
await import("node:fs/promises").then((fs) => fs.writeFile(`${OUT}/favicon.svg`, favicon));
console.log("✓ favicon.svg");
// .ico é só um contentor — um PNG de 32×32 lá dentro já chega para
// qualquer browser atual (Vista+). Evita depender de mais uma
// ferramenta externa só para isto.
const png32 = await sharp(Buffer.from(favicon)).resize(32, 32).png().toBuffer();
const cabecalho = Buffer.alloc(6);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(1, 4);
const entrada = Buffer.alloc(16);
entrada.writeUInt16LE(1, 4);
entrada.writeUInt16LE(32, 6);
entrada.writeUInt32LE(png32.length, 8);
entrada.writeUInt32LE(22, 12);
await import("node:fs/promises").then((fs) => fs.writeFile(`${OUT}/favicon.ico`, Buffer.concat([cabecalho, entrada, png32])));
console.log("✓ favicon.ico");

// og-image: o design de sempre (logo + "PORTAL DO VOLUNTÁRIO" + curva
// lima), com "MURAL ONDA" por baixo, maiúsculo e espaçado, a lima.
const og = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="120" cy="60" r="320" fill="rgba(120,150,255,.28)"/>
  <text x="90" y="230" font-family="${FONTE}" font-weight="400" font-size="52" fill="#ffffff">igreja<tspan font-weight="800">onda</tspan></text>
  <text x="90" y="330" font-family="${FONTE}" font-weight="800" font-size="72" letter-spacing="-2" fill="#ffffff">PORTAL DO <tspan fill="#d8f24b">VOLUNTÁRIO</tspan></text>
  <text x="90" y="400" font-family="${FONTE}" font-weight="700" font-size="34" letter-spacing="8" fill="#d8f24b">MURAL ONDA</text>
  <path d="M0 630V560c200 40 400 40 600 10s360-50 600-10v70z" fill="#ffffff" opacity=".08"/>
</svg>`;
await gerar("og-image.png", og);

console.log("\nFeito. Falta: favicon.ico (converter favicon.png com uma ferramenta qualquer, ex. https://favicon.io) — o resto das bases também mantém os dois formatos lado a lado.");
