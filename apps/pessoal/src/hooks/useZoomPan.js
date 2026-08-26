import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react";

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
export function useZoomPan(wrapRef, largura, altura, enquadramento) {
  const [transform, setTransform] = useState({ escala: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const limitesRef = useRef({ zMin: 1, zMax: 5 });
  const arrastRef = useRef({ ativo: false, capturado: false, pointerId: null, x: 0, y: 0 });
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

  // Enquadramento inicial fixo, não "cabe tudo": corta o telão a meio
  // em cima e mostra a fileira L inteira (até à etiqueta ENTRADA) em
  // baixo — pedido explícito de quem usa. `enquadramento.topo/fundo`
  // são coordenadas do desenho (unidades de largura/altura), não
  // pixels do ecrã. Este É o zoom mínimo (zMin): a sala ocupa sempre
  // o ecrã, nunca se afasta até sobrar espaço vazio à volta. "Tudo"
  // (verTudo) repõe este mesmo enquadramento.
  const ajustar = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !enquadramento) return;
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const { topo, fundo } = enquadramento;
    const escala = r.height / (fundo - topo);
    limitesRef.current = { zMin: escala, zMax: escala * 6 };
    const tx = (r.width - largura * escala) / 2;
    const ty = -topo * escala;
    setTransform(limites({ escala, tx, ty }));
  }, [wrapRef, largura, enquadramento, limites]);

  const verTudo = useCallback(() => ajustar(), [ajustar]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function aoRodar(e) {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      zoomPara(transformRef.current.escala * (e.deltaY < 0 ? 1.16 : 1 / 1.16), e.clientX - r.left, e.clientY - r.top);
    }
    // Não captura o ponteiro logo no pointerdown — um toque simples num
    // lugar também passa por aqui, e capturar cedo de mais rouba o
    // click do <Cadeira> (o browser deixa de o sintetizar no alvo
    // original). Só se torna "arrasto" — e só aí pede a captura — depois
    // de passar um limiar de movimento; um toque que nunca se mexe
    // chega inteiro ao onClick do lugar.
    function aoDescer(e) {
      if (e.target.closest(".zoomer")) return;
      arrastRef.current = { ativo: true, capturado: false, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      moveuRef.current = 0;
    }
    function aoMover(e) {
      const a = arrastRef.current;
      if (!a.ativo) return;
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      moveuRef.current += Math.abs(dx) + Math.abs(dy);
      a.x = e.clientX; a.y = e.clientY;
      if (!a.capturado) {
        if (moveuRef.current < 6) return; // ainda pode ser só um toque
        a.capturado = true;
        wrap.setPointerCapture(a.pointerId);
      }
      setTransform((t) => limites({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
    }
    function aoSoltar() {
      const a = arrastRef.current;
      if (a.capturado) { try { wrap.releasePointerCapture(a.pointerId); } catch { /* já foi libertado */ } }
      a.ativo = false; a.capturado = false;
    }
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

  // ResizeObserver, não só "resize" da janela: as abas desta app ficam
  // sempre montadas, só escondidas com display:none ao trocar (ver
  // Sessao.jsx) — quando a Acomodação monta escondida (o mais comum,
  // já que Início é a aba inicial), o wrap tem tamanho 0 nesse momento
  // e ajustar() desiste em silêncio. display:none → "" nunca dispara
  // "resize" da janela, mas dispara o ResizeObserver assim que o wrap
  // ganha tamanho a sério — é o que mantém o mapa enquadrado ao trocar
  // de aba, não só ao mudar o tamanho da janela.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    ajustar();
    const ro = new ResizeObserver(() => ajustar());
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustar]);

  return { transform, moveuRef, zoomPara, ajustar, verTudo };
}
