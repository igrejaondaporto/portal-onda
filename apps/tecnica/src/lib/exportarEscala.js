/**
 * Desenha a escala publicada como imagem (canvas puro, sem
 * dependências) — mesmo formato da tabela do menu "Escala": colunas
 * são os domingos, uma linha por ministério (titular e "+aprendiz" na
 * mesma célula). O Responsável é quem lidera o culto — não tem uma
 * linha à parte para isso, só a dele mesmo, destacada. O líder
 * exporta e já manda a imagem direto no grupo do WhatsApp.
 */
import { chaveSlot } from "./sugestor";
import { dataCurta } from "@portal/shared/lib/data.js";

const COR_TINTA = "#0a0f2e";
const COR_CINZA = "#6a7192";
const COR_FIO = "#e1e3ef";
const COR_AGUA = "#eaeeff";
const COR_AZUL = "#0019be";

export function desenharEscalaCanvas({ mesLabel, domingos, ministerios, resultado, voluntarios }) {
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "por definir";

  const colMinisterio = 150;
  const colDomingo = 168;
  const linhaAlt = 52;
  const cabecalhoAlt = 96;
  const linhaHeaderAlt = 46;
  const rodapeAlt = 34;
  const pad = 24;

  const largura = pad * 2 + colMinisterio + domingos.length * colDomingo;
  const altura = cabecalhoAlt + linhaHeaderAlt + ministerios.length * linhaAlt + rodapeAlt + pad;

  const escala = 2; // exporta em 2x pra ficar nítido no telemóvel
  const canvas = document.createElement("canvas");
  canvas.width = largura * escala;
  canvas.height = altura * escala;
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);

  // fundo
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);

  // cabeçalho
  const grad = ctx.createLinearGradient(0, 0, largura, cabecalhoAlt);
  grad.addColorStop(0, "#001ed1");
  grad.addColorStop(1, "#001594");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, largura, cabecalhoAlt);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 15px Arial";
  ctx.fillText("igreja onda · Base Técnica", pad, 34);
  ctx.font = "800 26px Arial";
  ctx.fillText(`Escala de ${mesLabel}`, pad, 68);

  let y = cabecalhoAlt;

  // cabeçalho da tabela (domingos)
  ctx.fillStyle = COR_AGUA;
  ctx.fillRect(0, y, largura, linhaHeaderAlt);
  ctx.fillStyle = COR_CINZA;
  ctx.font = "700 11px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("MINISTÉRIO", pad, y + linhaHeaderAlt / 2);
  domingos.forEach((d, i) => {
    const x = pad + colMinisterio + i * colDomingo;
    ctx.fillStyle = COR_TINTA;
    ctx.font = "700 12.5px Arial";
    ctx.fillText((d.tipo || dataCurta(d.data)).toUpperCase(), x, y + linhaHeaderAlt / 2);
  });
  y += linhaHeaderAlt;

  function linhaDivisoria(yy) {
    ctx.strokeStyle = COR_FIO;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(largura, yy);
    ctx.stroke();
  }

  // um bloco por ministério — o Responsável (ordem 0) é quem lidera
  // o culto, por isso ganha destaque visual em vez de uma linha à parte
  ministerios.forEach((m) => {
    const destaque = m.ordem === 0;
    if (destaque) {
      ctx.fillStyle = COR_AGUA;
      ctx.fillRect(0, y, largura, linhaAlt);
    }
    ctx.fillStyle = m.cor || COR_AZUL;
    ctx.beginPath();
    ctx.arc(pad + 5, y + linhaAlt / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR_TINTA;
    ctx.font = `700 ${destaque ? 14.5 : 13.5}px Arial`;
    ctx.fillText(m.nome, pad + 16, y + linhaAlt / 2);

    domingos.forEach((d, i) => {
      const x = pad + colMinisterio + i * colDomingo;
      const r = resultado[chaveSlot(d.id, m.id)];
      ctx.fillStyle = destaque ? COR_AZUL : COR_TINTA;
      ctx.font = destaque ? "700 13.5px Arial" : "600 13px Arial";
      const titular = r?.titularId ? nomeDe(r.titularId) : "—";
      ctx.fillText(titular, x, y + linhaAlt / 2 - (r?.aprendizId ? 8 : 0));
      if (r?.aprendizId) {
        ctx.fillStyle = COR_CINZA;
        ctx.font = "500 11px Arial";
        ctx.fillText(`+ ${nomeDe(r.aprendizId)} em treino`, x, y + linhaAlt / 2 + 10);
      }
    });
    y += linhaAlt;
    linhaDivisoria(y);
  });

  ctx.fillStyle = COR_CINZA;
  ctx.font = "500 11px Arial";
  ctx.fillText("tecnica.igrejaonda.pt", pad, y + rodapeAlt / 2);

  return canvas;
}

/** Web Share API com ficheiro quando dá (a maioria dos telemóveis) —
 *  abre já o menu de partilhar do sistema, com o WhatsApp como opção.
 *  Sem suporte, cai para download normal. */
export function compartilharOuBaixarCanvas(canvas, nomeArquivo) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(false);
      const ficheiro = new File([blob], nomeArquivo, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
        try {
          await navigator.share({ files: [ficheiro], title: nomeArquivo });
          resolve(true);
          return;
        } catch {
          // cancelou o share — cai para download normal
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      resolve(true);
    }, "image/png");
  });
}
