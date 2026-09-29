/**
 * Favicon, ícones e imagem de partilha do teste "Onde vais servir?"
 * (apps/voluntario) — o mesmo fundo de todas as apps (gradiente azul
 * #001ed1 → #0019be → #001594), só muda o texto. Cópia do padrão de
 * scripts/gerarIconesMural.mjs.
 *
 * Já corrido uma vez (os ficheiros estão em apps/voluntario/public/):
 *
 *   node scripts/gerarIconesVoluntario.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "apps/voluntario/public";
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

await gerar("icone-192.png", quadrado(192, "servir", 36));
await gerar("icone-512.png", quadrado(512, "servir", 96));
await gerar("apple-touch-icon.png", quadrado(180, "servir", 34));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRAD}</defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
    font-family="${FONTE}" font-weight="800" font-size="26" fill="#ffffff">SV</text>
</svg>`;
writeFileSync(`${OUT}/favicon.svg`, favicon);
console.log("✓ favicon.svg");
// .ico: um PNG 32×32 dentro do contentor (igual ao Mural)
const png32 = await sharp(Buffer.from(favicon)).resize(32, 32).png().toBuffer();
const cabecalho = Buffer.alloc(6);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(1, 4);
const entrada = Buffer.alloc(16);
entrada.writeUInt16LE(1, 4);
entrada.writeUInt16LE(32, 6);
entrada.writeUInt32LE(png32.length, 8);
entrada.writeUInt32LE(22, 12);
writeFileSync(`${OUT}/favicon.ico`, Buffer.concat([cabecalho, entrada, png32]));
console.log("✓ favicon.ico");

// og-image: é o que aparece no WhatsApp quando o pastor partilha o link
const og = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="120" cy="60" r="320" fill="rgba(120,150,255,.28)"/>
  <text x="90" y="230" font-family="${FONTE}" font-weight="400" font-size="52" fill="#ffffff">igreja<tspan font-weight="800">onda</tspan></text>
  <text x="90" y="340" font-family="${FONTE}" font-weight="800" font-size="84" letter-spacing="-2" fill="#ffffff">Onde vais <tspan fill="#d8f24b">servir?</tspan></text>
  <text x="90" y="410" font-family="${FONTE}" font-weight="700" font-size="30" letter-spacing="8" fill="#d8f24b">PORTAL DO VOLUNTÁRIO</text>
  <path d="M0 630V560c200 40 400 40 600 10s360-50 600-10v70z" fill="#ffffff" opacity=".08"/>
</svg>`;
await gerar("og-image.png", og);
