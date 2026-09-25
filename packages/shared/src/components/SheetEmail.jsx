import { useEffect, useState } from "react";
import { ouvirMeuEmail } from "../lib/email.js";
import FormEmail from "./FormEmail.jsx";

/** Ver e mudar o e-mail dos avisos — aberto pelo menu da foto
 *  (`MenuEu`), em qualquer base. O mesmo formulário do pop-up do
 *  login, com saída (este fecha-se, aquele não). */
export default function SheetEmail({ onFechar }) {
  const [meu, setMeu] = useState(undefined);
  useEffect(() => ouvirMeuEmail(setMeu), []);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="E-mail para avisos">
        <div className="pux" />
        <h2>E-mail para avisos</h2>
        <p className="sb2">
          {meu === undefined ? "A carregar…"
            : meu?.email ? <>Recebes os avisos em <b>{meu.email}</b>.</>
            : meu?.semEmail ? "Disseste que não tens e-mail — não recebes avisos por e-mail."
            : "Ainda não deixaste um e-mail."}
        </p>
        <p className="ds" style={{ marginTop: 8 }}>
          A tua escala do mês (um e-mail quando sai) e avisos só teus, como reembolsos. Ninguém da equipa vê o teu
          e-mail.
        </p>
        {meu !== undefined && (
          <FormEmail
            key={meu?.email ?? "vazio"}
            inicial={meu?.email ?? ""}
            textoNaoTenho={meu?.email ? "Deixar de receber por e-mail" : "Não tenho e-mail"}
            onFeito={onFechar}
          />
        )}
        <button className="btn sec full" style={{ marginTop: 9, background: "none", color: "var(--cinza)" }} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}
