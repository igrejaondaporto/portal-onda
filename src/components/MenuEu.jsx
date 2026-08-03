import { sair } from "../lib/auth";

export default function MenuEu({ pessoa, papel, onFechar, onAbrirPainel, onAbrirPerfil }) {
  const lider = papel === "lider_base";
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="pux" />
        <div
          className="perfilav"
          style={{
            width: 74, height: 74, fontSize: 29,
            ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: pessoa?.cor || "#0019BE" }),
          }}
        >
          {pessoa?.foto ? "" : pessoa?.nome?.[0]}
        </div>
        <h2>{pessoa?.nome ?? "…"}</h2>
        <p className="sb2">{lider ? "Líder da base" : "Voluntário da base de apoio"}</p>
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
