import { useEffect, useRef, useState } from "react";
import { useTour } from "../lib/TourContext.jsx";
import { procurarAlvoTour } from "../lib/procurarAlvoTour.js";

const MARGEM = 14;

/** Calcula onde pousar o balão a partir do rect do alvo — sempre
 *  dentro do ecrã, com fallback para centrado (mobile-first, telas
 *  pequenas). `null` de rect = passo centrado (boas-vindas/fechamento). */
function calcularPosicao(rect) {
  if (!rect) return { modo: "centrado" };
  const vw = window.innerWidth, vh = window.innerHeight;
  const espacoAbaixo = vh - rect.bottom;
  const emBaixo = espacoAbaixo > 160 || espacoAbaixo > rect.top;
  const top = emBaixo ? rect.bottom + MARGEM : undefined;
  const bottom = emBaixo ? undefined : vh - rect.top + MARGEM;
  let left = rect.left + rect.width / 2;
  left = Math.min(Math.max(left, 160), vw - 160);
  return { modo: "alvo", top, bottom, left, rect };
}

export default function Tour() {
  const { aberto, passo, passos, passoAtual, proximo, pular } = useTour();
  const [rect, setRect] = useState(null);
  const [pronto, setPronto] = useState(false);
  const abortoRef = useRef(null);

  useEffect(() => {
    if (!aberto || !passo) return;
    setPronto(false);
    abortoRef.current = { aborted: false };
    const sinal = abortoRef.current;

    // dá um tick de layout à troca de página/montagem condicional
    // (painel/montar/perfil só montam quando a página muda) antes de
    // procurar o alvo — ver Sessao.jsx de cada app.
    const temporizador = setTimeout(async () => {
      if (!passo.alvo) {
        if (!sinal.aborted) { setRect(null); setPronto(true); }
        return;
      }
      const el = await procurarAlvoTour(passo.alvo, { sinal });
      if (sinal.aborted) return;
      if (!el) {
        // requisito 8: elemento não existe nesta tela/base/pessoa — pula
        // o passo em silêncio, sem travar nem mostrar erro.
        proximo();
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => {
        if (sinal.aborted) return;
        setRect(el.getBoundingClientRect());
        setPronto(true);
      }, 260);
    }, 60);

    return () => { sinal.aborted = true; clearTimeout(temporizador); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, passo]);

  if (!aberto || !passo || !pronto) return null;

  const posicao = calcularPosicao(rect);
  const ultimo = passoAtual === passos.length - 1;

  return (
    <>
      <div className="tour-veu">
        {posicao.modo === "alvo" && (
          <div
            className="tour-realce"
            style={{
              top: posicao.rect.top - 8,
              left: posicao.rect.left - 8,
              width: posicao.rect.width + 16,
              height: posicao.rect.height + 16,
            }}
          />
        )}
      </div>
      <div
        className={`tour-balao${posicao.modo === "centrado" ? " centrado" : ""}`}
        style={
          posicao.modo === "alvo"
            ? { top: posicao.top, bottom: posicao.bottom, left: posicao.left }
            : undefined
        }
        role="dialog" aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="tour-progresso">{passoAtual + 1} de {passos.length}</p>
        {passo.titulo && <h3>{passo.titulo}</h3>}
        <p>{passo.texto}</p>
        <div className="tour-acoes">
          <button className="btn sec" onClick={pular}>Pular tour</button>
          <button className="btn" onClick={proximo}>{ultimo ? "Concluir" : "Próximo"}</button>
        </div>
      </div>
    </>
  );
}
