/** Redimensiona (nunca amplia) e reexporta como JPEG antes do upload —
 *  o mesmo truque do WhatsApp/Instagram. Nunca bloqueia o envio: se o
 *  browser não conseguir processar (formato raro), devolve o ficheiro
 *  original sem alterar nada. */
export async function comprimirImagem(ficheiro, { maxDimensao = 1600, qualidade = 0.8 } = {}) {
  if (!ficheiro.type.startsWith("image/")) return ficheiro;
  try {
    const bitmap = await createImageBitmap(ficheiro);
    const escala = Math.min(1, maxDimensao / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob) return ficheiro;
    return new File([blob], ficheiro.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return ficheiro; // formato não suportado (raro) — segue com o original
  }
}
