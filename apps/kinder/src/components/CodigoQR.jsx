import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Um QR a partir de um texto — gerado aqui no aparelho, sem serviço
 *  externo (nada do conteúdo sai do telemóvel). `tamanho` é a
 *  resolução da imagem gerada (não o tamanho em ecrã, que continua a
 *  vir do CSS) — maior para o cartaz de imprimir, para não desfocar. */
export default function CodigoQR({ texto, rotulo, tamanho = 480, className = "kin-qr" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelado = false;
    QRCode.toDataURL(texto, { margin: 1, width: tamanho, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelado) setSrc(url); })
      .catch(() => { if (!cancelado) setSrc(null); });
    return () => { cancelado = true; };
  }, [texto, tamanho]);

  if (!src) return null;
  return <img className={className} src={src} alt={rotulo || "Código QR"} />;
}
