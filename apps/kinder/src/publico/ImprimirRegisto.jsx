import { useState } from "react";
import CodigoQR from "../components/CodigoQR";
import { linkRegisto } from "../lib/kinder";
import { CATEGORIAS, categoria, nomeCategoria, varsCategoria } from "../lib/modelo";

/** Ícone de "site" — um globo simples, para quem olha para o cartaz
 *  perceber de imediato que aquele texto é o link do site, não um
 *  código qualquer. SVG cru (sem depender de nenhuma lib de ícones,
 *  como o resto do Kinder). */
function IconeSite() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

/**
 * /registo/imprimir?sala=baby|fun|junior — o cartaz para colar na
 * porta de cada sala do Kinder. Página própria (sem casca de app, sem
 * menu) só para isto: "KINDER" e o cabeçalho de sempre, o nome da
 * sala, o QR bem grande, e o link do site por baixo com o ícone de
 * site. Tudo pensado para caber numa folha A4 só (kinder.css, .kin-
 * cartaz).
 *
 * A sala vem da query — uma líder de sala (o Painel do líder já
 * monta o link com a sua) cai direto no cartaz dela, sem escolher
 * nada; a líder geral (sem sala fixa) abre sem `sala` na query e
 * escolhe qual das três quer imprimir agora, aqui mesmo.
 */
export default function ImprimirRegisto() {
  const daQuery = new URLSearchParams(window.location.search).get("sala");
  const fixa = CATEGORIAS.some((c) => c.id === daQuery) ? daQuery : null;
  const [sala, setSala] = useState(fixa);
  const link = linkRegisto();

  return (
    <div className="kin-cartaz">
      {!fixa && (
        <div className="kin-cartaz-escolha">
          <p className="ds" style={{ textAlign: "center" }}>Escolhe a sala para imprimir</p>
          <div className="kin-cats" style={{ justifyContent: "center" }}>
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" className="kin-cat" style={varsCategoria(c.id)} data-on={sala === c.id ? 1 : 0} onClick={() => setSala(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      )}
      {sala && (
        <button className="btn full kin-cartaz-btn" onClick={() => window.print()}>Imprimir</button>
      )}
      {sala ? (
        <div className="kin-cartaz-folha">
          <header className="crista kin-cartaz-cab" style={{ ...varsCategoria(sala), background: categoria(sala)?.cor }}>
            <div className="lin">
              <span className="logo"><i>igreja</i><b>onda</b></span>
            </div>
            <p className="kin-cartaz-kinder">KINDER</p>
            <h1 style={{ marginTop: 2 }}>
              Regista a <em>família</em>
            </h1>
            <p className="sob">Aponta a câmara do telemóvel ao código</p>
            <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
              <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
            </svg>
          </header>

          <div className="kin-cartaz-corpo">
            <CodigoQR texto={link} rotulo="QR do registo" tamanho={640} className="kin-cartaz-qr" />
            <div className="kin-cartaz-link">
              <IconeSite />
              <span>{link.replace(/^https?:\/\//, "")}</span>
            </div>
            <p className="kin-cartaz-sala" style={varsCategoria(sala)}>{nomeCategoria(sala).toUpperCase()}</p>
            <p className="kin-cartaz-nota">Kinder · Igreja Onda</p>
          </div>
        </div>
      ) : (
        <p className="ds kin-cartaz-vazio">Escolhe uma sala em cima para veres o cartaz.</p>
      )}
    </div>
  );
}
