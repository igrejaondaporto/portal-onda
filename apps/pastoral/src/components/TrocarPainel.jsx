import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Trocar entre o Painel Pastoral e o Presença GD (pedido 2026-09: "os
 * pastores, quando clicarem lá em cima, podem já sair do pastoral para
 * o GDs").
 *
 * O Presença GD (`gds.igrejaonda.pt`) é outra app, noutro repositório
 * (`igrejaondaporto/gd-management`) e com outro login (Supabase +
 * Google) — não há sessão partilhada nem `trocarBase` possível. Por
 * isso é só um atalho: abre o endereço, e lá entra-se com a conta de
 * sempre. Mesmo botão redondo e mesmo menu do `BotaoTrocarBase` das
 * outras bases (classes `tb-*` do global.css), para se reconhecer.
 */
const PAINEIS = [
  { id: "gds", sigla: "GD", nome: "Presença GD", url: "https://gds.igrejaonda.pt", cor: "#0F766E" },
];

export default function TrocarPainel() {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botao = useRef(null);

  // o menu fica preso por baixo do botão — mesma conta do BotaoTrocarBase
  useLayoutEffect(() => {
    if (!aberto) return undefined;
    function medir() {
      const r = botao.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 10, direita: Math.max(12, window.innerWidth - r.right - 60), seta: window.innerWidth - (r.left + r.width / 2) });
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto]);

  return (
    <>
      <button
        ref={botao} aria-label="Trocar de painel" aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className={`tb-botao${aberto ? " on" : ""}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
        </svg>
      </button>

      {aberto && pos && createPortal(
        <>
          <div className="tb-veu" onClick={() => setAberto(false)} />
          <div className="tb-menu" role="menu" aria-label="Trocar de painel" style={{ top: pos.top, right: pos.direita }}>
            <span className="tb-seta" style={{ right: pos.seta - pos.direita - 7 }} />
            <p className="tb-titulo">Trocar de painel</p>
            <div className="tb-base atual" role="menuitem" aria-current="true">
              <span className="tb-sigla" style={{ background: "var(--azul)" }}>PA</span>
              <span className="tb-nome">Painel Pastoral<small>estás aqui</small></span>
              <span className="tb-ok" aria-hidden>✓</span>
            </div>
            {PAINEIS.map((p) => (
              <a key={p.id} href={p.url} role="menuitem" className="tb-base" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="tb-sigla" style={{ background: p.cor }}>{p.sigla}</span>
                <span className="tb-nome">{p.nome}<small>{p.url.replace("https://", "")}</small></span>
                <span className="tb-ir" aria-hidden>›</span>
              </a>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
