import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useTrocarBase } from "../lib/useTrocarBase";

/** As iniciais no quadradinho de cada base — as mesmas abreviações do
 *  favicon de cada app (ver "Ao criar uma base nova" no CLAUDE.md raiz),
 *  para a pessoa reconhecer a base pelo mesmo sinal do separador. */
const SIGLA = {
  apoio: "AP", tecnica: "TEC", backstage: "BS", comunicacao: "COM", pessoal: "PE",
  louvor: "LV", louvorkinder: "LK", kinder: "KI", new: "NEW", shift: "SH",
  financeiro: "FIN", pastoral: "PA", ondatechhub: "OTH",
};
const siglaDe = (b) => SIGLA[b.id] ?? String(b.nome ?? b.id).replace(/^Base (de |da |do )?/, "").slice(0, 2).toUpperCase();

/** Botão redondo no cabeçalho, ao lado da foto — só aparece a quem
 *  serve em mais do que uma base. Uma base só para trocar: troca
 *  direto. Mais do que uma: abre um menu branco por cima de tudo.
 *
 *  O menu vive num portal no `<body>`, e não dentro do botão: o
 *  cabeçalho (`.crista`) tem `overflow:hidden` (por causa da curva e do
 *  brilho), e a lista antiga ficava cortada por ele e sem fundo — as
 *  letras apareciam por cima do "Olá, …", transparentes (reportado
 *  2026-09). Com um véu por trás, tocar fora fecha. */
export default function BotaoTrocarBase({ baseIdAtual, basesDisponiveis = [] }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const [cores, setCores] = useState({});
  const botao = useRef(null);
  const { aTrocar, destino, escolherBase } = useTrocarBase();
  const outras = basesDisponiveis.filter((b) => b.id !== baseIdAtual);
  const atual = basesDisponiveis.find((b) => b.id === baseIdAtual);

  // a cor de cada base (`bases/{id}.cor`, legível por qualquer sessão),
  // só quando o menu abre pela primeira vez
  useEffect(() => {
    if (!aberto || Object.keys(cores).length) return;
    let vivo = true;
    Promise.all(basesDisponiveis.map((b) => getDoc(doc(db, `bases/${b.id}`)).then((s) => [b.id, s.data()?.cor]).catch(() => [b.id, null])))
      .then((pares) => { if (vivo) setCores(Object.fromEntries(pares)); });
    return () => { vivo = false; };
  }, [aberto, basesDisponiveis, cores]);

  // o menu fica preso por baixo do botão, à direita do ecrã
  useLayoutEffect(() => {
    if (!aberto && !destino) return undefined;
    function medir() {
      const r = botao.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 10, direita: Math.max(12, window.innerWidth - r.right - 60), seta: window.innerWidth - (r.left + r.width / 2) });
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto, destino]);

  if (!outras.length) return null;

  function tocar() {
    if (aTrocar) return;
    if (outras.length === 1) { escolherBase(outras[0]); return; }
    setAberto((a) => !a);
  }

  const cor = (b) => cores[b.id] || "var(--azul)";

  return (
    <>
      <button
        ref={botao}
        aria-label="Trocar de base" aria-expanded={aberto}
        onClick={tocar}
        disabled={aTrocar}
        className={`tb-botao${aberto ? " on" : ""}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
        </svg>
      </button>

      {aberto && outras.length > 1 && pos && createPortal(
        <>
          <div className="tb-veu" onClick={() => setAberto(false)} />
          <div className="tb-menu" role="menu" aria-label="Trocar de base" style={{ top: pos.top, right: pos.direita }}>
            <span className="tb-seta" style={{ right: pos.seta - pos.direita - 7 }} />
            <p className="tb-titulo">Trocar de base</p>
            {atual && (
              <div className="tb-base atual" role="menuitem" aria-current="true">
                <span className="tb-sigla" style={{ background: cor(atual) }}>{siglaDe(atual)}</span>
                <span className="tb-nome">{atual.nome}<small>estás aqui</small></span>
                <span className="tb-ok" aria-hidden>✓</span>
              </div>
            )}
            {outras.map((b) => (
              <button
                key={b.id} type="button" role="menuitem" className="tb-base"
                onClick={() => { setAberto(false); escolherBase(b); }}
              >
                <span className="tb-sigla" style={{ background: cor(b) }}>{siglaDe(b)}</span>
                <span className="tb-nome">{b.nome}</span>
                <span className="tb-ir" aria-hidden>›</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}

      {destino && pos && createPortal(
        <div className="tb-menu" style={{ top: pos.top, right: pos.direita, padding: 14 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            Não abriu sozinho?{" "}
            <a href={destino.url} style={{ color: "var(--azul, #0019BE)", fontWeight: 600 }}>
              Toca aqui para continuar em {destino.nome}
            </a>
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
