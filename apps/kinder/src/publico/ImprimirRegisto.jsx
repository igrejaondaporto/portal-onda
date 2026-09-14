import CodigoQR from "../components/CodigoQR";
import { linkRegisto } from "../lib/kinder";

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
 * /registo/imprimir — o cartaz para colar na porta do Kinder. Página
 * própria (sem casca de app, sem menu) só para isto: cabeçalho do
 * Kinder, o QR bem grande, e o link do site por baixo com o ícone de
 * site, para quem olha perceber que aquilo é um link. Tudo pensado
 * para caber numa folha A4 só — ver kinder.css, .kin-cartaz.
 */
export default function ImprimirRegisto() {
  const link = linkRegisto();

  return (
    <div className="kin-cartaz">
      <button className="btn full kin-cartaz-btn" onClick={() => window.print()}>Imprimir</button>
      <div className="kin-cartaz-folha">
        <header className="crista kin-cartaz-cab">
          <div className="lin">
            <span className="logo"><i>igreja</i><b>onda</b></span>
          </div>
          <h1 style={{ marginTop: 18 }}>
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
          <p className="kin-cartaz-nota">Kinder · Igreja Onda</p>
        </div>
      </div>
    </div>
  );
}
