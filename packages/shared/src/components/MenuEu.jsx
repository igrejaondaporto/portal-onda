import { useEffect, useState } from "react";
import { sair } from "../lib/auth";
import { useTrocarBase } from "../lib/useTrocarBase";
import ImagemExpandida from "./ImagemExpandida";
import SheetPrivacidade from "./SheetPrivacidade.jsx";
import SheetServirNoutraBase from "./SheetServirNoutraBase.jsx";
import { ouvirMeuPedido } from "../lib/candidaturas.js";

export default function MenuEu({ pessoa, papel, baseIdAtual, basesDisponiveis = [], onFechar, onAbrirPainel, onAbrirPerfil, onVerComoVoluntario }) {
  // "Rever tour" saiu do menu (2026-10, pedido do dono do produto); as
  // apps ainda passam `onAbrirTour`, que fica sem uso.
  // "auxiliar" só existe na Louvor e tem as mesmas funções do líder
  // da base (ver apps/louvor/src/lib/modelo.js) — nenhuma outra base
  // consegue produzir esse papel no token, seguro tratar aqui.
  const lider = papel === "lider_base" || papel === "auxiliar";
  const [expandida, setExpandida] = useState(false);
  const [verPrivacidade, setVerPrivacidade] = useState(false);
  // "Servir noutra base" (functions/candidaturas.js) — o pedido à
  // espera, se houver, aparece no próprio botão
  const [verServir, setVerServir] = useState(false);
  const [meuPedido, setMeuPedido] = useState(null);
  useEffect(() => ouvirMeuPedido(setMeuPedido), []);
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
        {/* Mural Onda (2026-10, pedido do dono do produto): um atalho para o
          * mural da igreja, a lima do "Onda". O e-mail para avisos, que
          * estava aqui, passou para o Perfil (EmailNoPerfil). */}
        <a className="btn full mural-menu" style={{ marginTop: 9 }} href="https://mural.igrejaonda.pt">
          Mural Onda
        </a>
        {/* em todas as bases: pedir para servir também
          * noutra base. Azul mais cheio que os outros, de propósito
          * (pedido do dono do produto) — é um convite, não definições. */}
        <button className="btn full sv-menu" style={{ marginTop: 9 }} onClick={() => setVerServir(true)}>
          🙋 Servir noutra base
          {meuPedido && <span className="sv-menu-estado">Pedido à {meuPedido.baseNome} · à espera</span>}
        </button>
        {lider && (
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={onAbrirPainel}>
            Painel do líder
          </button>
        )}
        {/* Ver o painel pelos olhos da equipa. Só o líder o tem, e
          * enquanto a vista está ligada este menu é o de um
          * voluntário — a saída fica na faixa (BarraVistaVoluntario),
          * sempre à vista. */}
        {lider && onVerComoVoluntario && (
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => { onFechar(); onVerComoVoluntario(); }}>
            Painel do voluntário
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
        <p style={{ textAlign: "center", marginTop: 6 }}>
          <button
            type="button" onClick={() => setVerPrivacidade(true)}
            style={{ background: "none", border: 0, padding: 4, font: "inherit", fontSize: 12, color: "var(--cinza)", textDecoration: "underline", cursor: "pointer" }}
          >
            Privacidade
          </button>
        </p>
      </div>
      {verPrivacidade && <SheetPrivacidade onFechar={() => setVerPrivacidade(false)} />}
      {verServir && (
        <SheetServirNoutraBase
          basesOndeServe={[baseIdAtual, ...basesDisponiveis.map((b) => b.id)].filter(Boolean)}
          pedido={meuPedido}
          onFechar={() => setVerServir(false)}
        />
      )}
    </>
  );
}
