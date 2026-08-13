import { useState } from "react";
import { sair, trocarBase } from "../lib/auth";
import { useTorrada } from "../lib/TorradaContext";
import ImagemExpandida from "./ImagemExpandida";

export default function MenuEu({ pessoa, papel, baseIdAtual, basesDisponiveis = [], onFechar, onAbrirPainel, onAbrirPerfil }) {
  const torrada = useTorrada();
  const lider = papel === "lider_base";
  const [expandida, setExpandida] = useState(false);
  const [aTrocar, setATrocar] = useState(false);
  const [destino, setDestino] = useState(null); // { nome, url } — link de reserva se a navegação sozinha não acontecer

  async function escolherBase(base) {
    if (base.id === baseIdAtual || aTrocar) return;
    setATrocar(true);
    setDestino(null);
    const r = await trocarBase(base.id);
    if (!r.ok) { torrada(r.mensagem); setATrocar(false); return; }
    // em localhost troca no sítio (sem url); noutro domínio, mostra já o
    // link de reserva — nem toda app instalada deixa um script navegar
    // sozinho para outro domínio, mas um toque num link real sempre passa.
    if (r.url) {
      setDestino({ nome: base.nome, url: r.url });
      // se a navegação automática não tirar daqui, os separadores voltam a
      // responder — sem isto ficavam desativados para sempre, só o link
      // de reserva continuaria a funcionar
      setTimeout(() => setATrocar(false), 2500);
    }
  }

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
                onClick={() => escolherBase(b)}
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
