import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Um QR a partir de um texto — gerado aqui no aparelho, sem serviço
 *  externo (nada do conteúdo sai do telemóvel). */
export default function CodigoQR({ texto, rotulo }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelado = false;
    QRCode.toDataURL(texto, { margin: 1, width: 480, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelado) setSrc(url); })
      .catch(() => { if (!cancelado) setSrc(null); });
    return () => { cancelado = true; };
  }, [texto]);

  if (!src) return null;
  return <img className="kin-qr" src={src} alt={rotulo || "Código QR"} />;
}
