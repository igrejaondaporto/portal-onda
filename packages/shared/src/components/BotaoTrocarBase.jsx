import { useState } from "react";
import { useTrocarBase } from "../lib/useTrocarBase";

/** Botão redondo no cabeçalho, ao lado da foto — só aparece a quem
 *  serve em mais do que uma base. Uma base só para trocar: troca
 *  direto. Mais do que uma: abre uma lista curta por cima. */
export default function BotaoTrocarBase({ baseIdAtual, basesDisponiveis = [] }) {
  const [aberto, setAberto] = useState(false);
  const { aTrocar, destino, escolherBase } = useTrocarBase();
  const outras = basesDisponiveis.filter((b) => b.id !== baseIdAtual);

  if (!outras.length) return null;

  function tocar() {
    if (aTrocar) return;
    if (outras.length === 1) { escolherBase(outras[0]); return; }
    setAberto((a) => !a);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        aria-label="Trocar de base"
        onClick={tocar}
        disabled={aTrocar}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: "none",
          background: "rgba(255,255,255,.18)", display: "flex",
          alignItems: "center", justifyContent: "center", cursor: "pointer",
          color: "#fff", flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
        </svg>
      </button>

      {aberto && outras.length > 1 && (
        <div className="caixa" style={{ position: "absolute", right: 0, top: 42, zIndex: 30, minWidth: 170, color: "#111" }}>
          {outras.map((b) => (
            <div
              key={b.id} className="linha" style={{ cursor: "pointer" }}
              onClick={() => { setAberto(false); escolherBase(b); }}
            >
              <p className="nmt">{b.nome}</p>
            </div>
          ))}
        </div>
      )}

      {destino && (
        <div className="caixa" style={{ position: "absolute", right: 0, top: 42, zIndex: 30, minWidth: 220, color: "#111" }}>
          <p className="ds">
            Não abriu sozinho?{" "}
            <a href={destino.url} style={{ color: "var(--azul, #0019BE)", fontWeight: 600 }}>
              Toca aqui para continuar em {destino.nome}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
