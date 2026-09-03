import { useState } from "react";
import { sair } from "../lib/auth";
import { useTrocarBase } from "../lib/useTrocarBase";
import ImagemExpandida from "./ImagemExpandida";

export default function MenuEu({ pessoa, papel, baseIdAtual, basesDisponiveis = [], onFechar, onAbrirPainel, onAbrirPerfil, onAbrirTour }) {
  // "auxiliar" só existe na Louvor e tem as mesmas funções do líder
  // da base (ver apps/louvor/src/lib/modelo.js) — nenhuma outra base
  // consegue produzir esse papel no token, seguro tratar aqui.
  const lider = papel === "lider_base" || papel === "auxiliar";
  const [expandida, setExpandida] = useState(false);
  const { aTrocar, destino, escolherBase } = useTrocarBase();

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="pux" />
        <div
          className="perfilav"
          style={{
            width: 74, height: 74, fontSize: 29,
            ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" } : { background: pessoa?.cor || "#0019BE" }),
          }}
          onClick={pessoa?.foto ? () => setExpandida(true) : undefined}
        >
          {pessoa?.foto ? "" : pessoa?.nome?.[0]}
        </div>
        {expandida && <ImagemExpandida src={pessoa.foto} alt={pessoa.nome} onFechar={() => setExpandida(false)} />}
        <h2>{pessoa?.nome ?? "…"}</h2>
        <p className="sb2">{lider ? "Líder da base" : "Voluntário"}</p>
        {basesDisponiveis.length > 1 && (
          <div className="subtabs" style={{ marginTop: 14 }}>
            {basesDisponiveis.map((b) => (
              <button
                key={b.id} data-on={b.id === baseIdAtual ? 1 : 0} disabled={aTrocar}
                onClick={() => b.id !== baseIdAtual && escolherBase(b)}
              >
                {b.nome}
              </button>
            ))}
          </div>
        )}
        {destino && (
          <p className="ds" style={{ marginTop: 10 }}>
            Não abriu sozinho?{" "}
            <a href={destino.url} style={{ color: "var(--azul, #0019BE)", fontWeight: 600 }}>
              Toca aqui para continuar em {destino.nome}
            </a>
          </p>
        )}
        <button className="btn full" style={{ marginTop: 20 }} onClick={onAbrirPerfil}>
          Ver perfil
        </button>
        {lider && (
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={onAbrirPainel}>
            Painel do líder
          </button>
        )}
        {onAbrirTour && (
          <button
            className="btn sec full" style={{ marginTop: 9 }}
            onClick={() => { onFechar(); onAbrirTour(); }}
          >
            Rever tour
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={sair}>
          Terminar sessão
        </button>
        <button
          className="btn sec full"
          style={{ marginTop: 9, background: "none", color: "var(--cinza)" }}
          onClick={onFechar}
        >
          Fechar
        </button>
      </div>
    </>
  );
}
