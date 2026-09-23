/**
 * Ícones, favicon e og-image do Louvor Kinder — mesmo gradiente azul
 * padrão de todas as bases (#001ed1 → #0019be → #001594), só muda o
 * texto (ver CLAUDE.md raiz, "Ao criar uma base nova").
 * Referência de layout: apps/backstage/public/*.
 *
 *     node scripts/gerar-assets-louvorkinder.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = new URL("../apps/louvorkinder/public/", import.meta.url);
const caminho = (ficheiro) => fileURLToPath(new URL(ficheiro, DIR));
const GRAD = `
  <linearGradient id="g" x1="0%" y1="0%" x2="75%" y2="100%">
    <stop offset="0%" stop-color="#001ed1"/>
    <stop offset="52%" stop-color="#0019be"/>
    <stop offset="100%" stop-color="#001594"/>
  </linearGradient>`;

async function png(svg, size, ficheiro) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(caminho(ficheiro));
}

// ── favicon.svg + favicon.ico (16/32, PNG-em-ICO) ──────────────
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>${GRAD}</defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle"
    font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="22" letter-spacing="0.5"
    fill="#ffffff">LK</text>
</svg>`;
writeFileSync(caminho("favicon.svg"), svgFavicon);

function icoHeader(count) {
  const b = Buffer.alloc(6);
  b.writeUInt16LE(0, 0); b.writeUInt16LE(1, 2); b.writeUInt16LE(count, 4);
  return b;
}
function icoEntry(size, offset, dataLength) {
  const b = Buffer.alloc(16);
  b.writeUInt8(size === 256 ? 0 : size, 0);
  b.writeUInt8(size === 256 ? 0 : size, 1);
  b.writeUInt8(0, 2); b.writeUInt8(0, 3);
  b.writeUInt16LE(1, 4); b.writeUInt16LE(32, 6);
  b.writeUInt32LE(dataLength, 8); b.writeUInt32LE(offset, 12);
  return b;
}
async function gerarFavicon() {
  const sizes = [16, 32];
  const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svgFavicon)).resize(s, s).png().toBuffer()));
  const header = icoHeader(sizes.length);
  let offset = header.length + sizes.length * 16;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    entries.push(icoEntry(sizes[i], offset, pngs[i].length));
    offset += pngs[i].length;
  }
  writeFileSync(caminho("favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
}
await gerarFavicon();

// ── apple-touch-icon + icone-192/512 (sem cantos arredondados —
// o SO já aplica a máscara própria) ─────────────────────────────
const svgIconeFinal = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>${GRAD}</defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g font-family="Outfit, Arial, sans-serif" font-weight="800" text-anchor="middle" fill="#ffffff">
    <text x="256" y="238" font-size="118">louvor</text>
    <text x="256" y="362" font-size="118" fill="#c3dc54">kinder</text>
  </g>
</svg>`;
await png(svgIconeFinal, 180, "apple-touch-icon.png");
await png(svgIconeFinal, 192, "icone-192.png");
await png(svgIconeFinal, 512, "icone-512.png");

// ── og-image.png (1200x630) — logo igrejaonda + "PORTAL DO
// VOLUNTÁRIO" + nome da base a lima + curva lima em baixo ──────
const svgOg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${GRAD}</defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g font-family="Outfit, Arial, sans-serif" text-anchor="middle">
    <text x="600" y="300" font-weight="400" font-size="64" fill="#ffffff">igreja<tspan font-weight="800">onda</tspan></text>
    <text x="600" y="352" font-weight="700" font-size="22" letter-spacing="2" fill="#e6e9fb">PORTAL DO VOLUNTÁRIO</text>
    <text x="600" y="405" font-weight="800" font-size="26" letter-spacing="6" fill="#c3dc54">LOUVOR KINDER</text>
  </g>
  <path d="M0,630 C160,560 1040,560 1200,630 L1200,630 L0,630 Z" fill="#c3dc54"/>
</svg>`;
await sharp(Buffer.from(svgOg)).resize(1200, 630).png().toFile(caminho("og-image.png"));

console.log("Assets do Louvor Kinder gerados em apps/louvorkinder/public/");
