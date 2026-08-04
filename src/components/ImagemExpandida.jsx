/** Toca numa foto pequena (função, item de inventário…) e ela abre em
 *  ecrã cheio — fecha ao tocar fora ou no ✕. Reutilizado em vários
 *  sítios, por isso vive à parte em vez de duplicado. */
export default function ImagemExpandida({ src, alt = "", onFechar }) {
  if (!src) return null;
  return (
    <div className="lightbox" onClick={onFechar}>
      <button className="lightbox-fechar" onClick={onFechar} aria-label="Fechar">✕</button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
