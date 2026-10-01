import { useEffect, useRef, useState } from "react";

/**
 * Fotos de um anúncio em ecrã cheio, com setas para passar às outras sem
 * fechar e as miniaturas de todas por baixo (2026-10, pedido: "uma
 * setinha ao lado para ver as outras fotos sem ter que desexpandir, e
 * mostrando as 4 em miniatura"). Também desliza com o dedo e com as
 * setas do teclado.
 *
 * Fica no Mural, não no `ImagemExpandida` partilhado: as bases usam esse
 * para uma foto só (função, inventário…), e mudá-lo repintava todas.
 * Reaproveita as classes `.lightbox` do global.css.
 */
export default function GaleriaExpandida({ fotos, inicio = 0, onFechar }) {
  const [i, setI] = useState(inicio);
  const toque = useRef(null);
  const n = fotos.length;
  const ir = (d) => setI((x) => (x + d + n) % n);

  useEffect(() => {
    function tecla(e) {
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
      else if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
      else if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [n, onFechar]);

  const parar = (e) => e.stopPropagation();

  return (
    <div
      className="lightbox galeria"
      onClick={onFechar}
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current == null || n < 2) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
    >
      <button className="lightbox-fechar" onClick={onFechar} aria-label="Fechar">✕</button>
      <div className="galeriaPalco">
        {n > 1 && (
          <button type="button" className="galeriaSeta" aria-label="Foto anterior" onClick={(e) => { parar(e); ir(-1); }}>‹</button>
        )}
        <img src={fotos[i]} alt={`Foto ${i + 1} de ${n}`} onClick={parar} />
        {n > 1 && (
          <button type="button" className="galeriaSeta" aria-label="Foto seguinte" onClick={(e) => { parar(e); ir(1); }}>›</button>
        )}
      </div>
      {n > 1 && (
        <div className="galeriaMinis" onClick={parar}>
          {fotos.map((f, j) => (
            <button
              key={j} type="button" aria-label={`Ver a foto ${j + 1}`} aria-current={j === i ? "true" : undefined}
              data-on={j === i ? 1 : 0} style={{ backgroundImage: `url("${f}")` }} onClick={() => setI(j)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
