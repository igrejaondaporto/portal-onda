import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Zoom/pan do mapa — porte do protótipo (wheel, drag de 1 dedo, pinça
 * de 2 dedos, com clamps). Estado local, nunca toca no Firestore.
 * `transform` alimenta um único <g> wrapper à volta das 144 cadeiras —
 * arrastar/ampliar nunca re-renderiza os lugares em si.
 *
 * `moveuRef` fica exposto para quem trata cliques nos lugares saber
 * se o gesto foi um arrasto (e por isso ignorar o toque) — o mesmo
 * truque do protótipo (`moveu>8` antes de tratar como toque).
 */
export function useZoomPan(wrapRef, largura, altura) {
  const [transform, setTransform] = useState({ escala: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const limitesRef = useRef({ zMin: 1, zMax: 5 });
  const arrastRef = useRef({ ativo: false, x: 0, y: 0 });
  const moveuRef = useRef(0);
  const toquesRef = useRef({ dist0: 0, z0: 1 });

  const limites = useCallback((t) => {
    const wrap = wrapRef.current;
    if (!wrap) return t;
    const r = wrap.getBoundingClientRect();
    const lw = largura * t.escala, lh = altura * t.escala;
    const tx = lw <= r.width ? (r.width - lw) / 2 : Math.min(0, Math.max(r.width - lw, t.tx));
    const ty = lh <= r.height ? (r.height - lh) / 2 : Math.min(0, Math.max(r.height - lh, t.ty));
    return { ...t, tx, ty };
  }, [wrapRef, largura, altura]);

  const zoomPara = useCallback((novaEscala, cx, cy) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const centroX = cx ?? r.width / 2, centroY = cy ?? r.height / 2;
    setTransform((t) => {
      const { zMin, zMax } = limitesRef.current;
      const escala = Math.max(zMin, Math.min(zMax, novaEscala));
      const k = escala / t.escala;
      const tx = centroX - (centroX - t.tx) * k, ty = centroY - (centroY - t.ty) * k;
      return limites({ escala, tx, ty });
    });
  }, [wrapRef, limites]);

  // arranca a ~121% do enquadramento completo, ocupando o wrap — como no protótipo
  const ajustar = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const contem = Math.min(r.width / largura, r.height / altura);
    limitesRef.current = { zMin: contem, zMax: contem * 8 };
    const escala = contem * 1.21;
    const tx = (r.width - largura * escala) / 2;
    const lh = altura * escala;
    const ty = lh > r.height ? -(lh - r.height) * 0.46 : (r.height - lh) / 2;
    setTransform(limites({ escala, tx, ty }));
  }, [wrapRef, largura, altura, limites]);

  const verTudo = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const { zMin } = limitesRef.current;
    const tx = (r.width - largura * zMin) / 2, ty = (r.height - altura * zMin) / 2;
    setTransform(limites({ escala: zMin, tx, ty }));
  }, [wrapRef, largura, altura, limites]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function aoRodar(e) {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      zoomPara(transformRef.current.escala * (e.deltaY < 0 ? 1.16 : 1 / 1.16), e.clientX - r.left, e.clientY - r.top);
    }
    function aoDescer(e) {
      if (e.target.closest(".zoomer")) return;
      arrastRef.current = { ativo: true, x: e.clientX, y: e.clientY };
      moveuRef.current = 0;
      wrap.setPointerCapture(e.pointerId);
    }
    function aoMover(e) {
      if (!arrastRef.current.ativo) return;
      const dx = e.clientX - arrastRef.current.x, dy = e.clientY - arrastRef.current.y;
      moveuRef.current += Math.abs(dx) + Math.abs(dy);
      arrastRef.current.x = e.clientX; arrastRef.current.y = e.clientY;
      setTransform((t) => limites({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
    }
    function aoSoltar() { arrastRef.current.ativo = false; }
    function aoIniciarToque(e) {
      if (e.touches.length === 2) {
        toquesRef.current.dist0 = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        toquesRef.current.z0 = transformRef.current.escala;
        arrastRef.current.ativo = false;
      }
    }
    function aoMoverToque(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const r = wrap.getBoundingClientRect();
        zoomPara(
          toquesRef.current.z0 * (d / toquesRef.current.dist0),
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
        );
      }
    }

    wrap.addEventListener("wheel", aoRodar, { passive: false });
    wrap.addEventListener("pointerdown", aoDescer);
    wrap.addEventListener("pointermove", aoMover);
    wrap.addEventListener("pointerup", aoSoltar);
    wrap.addEventListener("pointercancel", aoSoltar);
    wrap.addEventListener("touchstart", aoIniciarToque, { passive: false });
    wrap.addEventListener("touchmove", aoMoverToque, { passive: false });
    return () => {
      wrap.removeEventListener("wheel", aoRodar);
      wrap.removeEventListener("pointerdown", aoDescer);
      wrap.removeEventListener("pointermove", aoMover);
      wrap.removeEventListener("pointerup", aoSoltar);
      wrap.removeEventListener("pointercancel", aoSoltar);
      wrap.removeEventListener("touchstart", aoIniciarToque);
      wrap.removeEventListener("touchmove", aoMoverToque);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapRef, zoomPara, limites]);

  useEffect(() => {
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustar]);

  return { transform, moveuRef, zoomPara, ajustar, verTudo };
}
