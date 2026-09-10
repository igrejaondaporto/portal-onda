import { useEffect, useRef, useState } from "react";

/**
 * Lê um QR com a câmara traseira. Usa o BarcodeDetector do browser
 * quando existe (Chrome em Android) e, senão (Safari no iPhone),
 * o jsQR — carregado só quando é preciso, para não pesar no resto.
 */
export default function LeitorQR({ titulo = "Ler QR", onLido, onFechar }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let parar = false;
    let stream = null;
    let temporizador = null;

    async function arrancar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setErro("Sem acesso à câmara. Autoriza a câmara nas definições do browser, ou procura pelo nome.");
        return;
      }
      if (parar) { stream.getTracks().forEach((t) => t.stop()); return; }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      let detetar;
      if ("BarcodeDetector" in window) {
        const detetor = new window.BarcodeDetector({ formats: ["qr_code"] });
        detetar = async () => (await detetor.detect(video))[0]?.rawValue ?? null;
      } else {
        const { default: jsQR } = await import("jsqr");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        detetar = async () => {
          const w = video.videoWidth, h = video.videoHeight;
          if (!w || !h) return null;
          canvas.width = w; canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
        };
      }

      const passo = async () => {
        if (parar) return;
        try {
          const texto = await detetar();
          if (texto) { onLido(texto); return; }
        } catch { /* frame ainda sem imagem — tenta no seguinte */ }
        temporizador = setTimeout(passo, 250);
      };
      passo();
    }

    arrancar();
    return () => {
      parar = true;
      clearTimeout(temporizador);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onLido muda a cada render de quem chama; a câmara não deve reiniciar por isso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{titulo}</h2>
        <p className="sb2">Aponta ao QR do link da família</p>
        {erro ? <p className="aviso" style={{ marginTop: 14 }}>{erro}</p> : <video ref={videoRef} className="kin-video" playsInline muted />}
        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
