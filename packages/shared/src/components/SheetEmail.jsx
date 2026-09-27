import { useEffect, useState } from "react";
import { estadoDoEmail, ouvirMeuEmail } from "../lib/email.js";
import ConfirmarEmail, { SeloEmail } from "./ConfirmarEmail.jsx";
import FormEmail from "./FormEmail.jsx";

/** Ver e mudar o e-mail dos avisos — aberto pelo menu da foto
 *  (`MenuEu`), em qualquer base. O mesmo formulário do pop-up do
 *  login, com saída (este fecha-se, aquele não). Mostra se o e-mail
 *  está confirmado (a bolinha verde) e, se não estiver, o passo do
 *  código aqui mesmo. */
export default function SheetEmail({ onFechar }) {
  const [meu, setMeu] = useState(undefined);
  const [pedido, setPedido] = useState(null); // { email, falha }
  const [mudar, setMudar] = useState(false);
  useEffect(() => ouvirMeuEmail(setMeu), []);

  const estado = estadoDoEmail(meu);
  const emailPorConfirmar = mudar ? null : pedido?.email ?? (estado === "porConfirmar" ? meu.email : null);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="E-mail para avisos">
        <div className="pux" />
        <h2>E-mail para avisos</h2>
        <p className="sb2">
          {meu === undefined ? "A carregar…"
            : meu?.email && estado === "confirmado" ? <>Recebes os avisos em <b>{meu.email}</b>.</>
            : meu?.email ? <>O teu e-mail: <b>{meu.email}</b>.</>
            : meu?.semEmail ? "Disseste que não tens e-mail — não recebes avisos por e-mail."
            : "Ainda não deixaste um e-mail."}
        </p>
        {meu?.email && !meu?.semEmail && (
          <p style={{ marginTop: 6, textAlign: "center" }}><SeloEmail estado={estado} /></p>
        )}
        {estado === "porConfirmar" && (
          <p className="ds" style={{ marginTop: 6, textAlign: "center" }}>Só recebes avisos por e-mail depois de o confirmares.</p>
        )}
        <p className="ds" style={{ marginTop: 8 }}>
          A tua escala do mês (um e-mail quando sai) e avisos só teus, como reembolsos. Ninguém da equipa vê o teu e-mail.
        </p>
        {meu !== undefined && (emailPorConfirmar ? (
          <ConfirmarEmail
            key={emailPorConfirmar}
            email={emailPorConfirmar}
            codigoPedido={pedido?.email === emailPorConfirmar}
            falha={pedido?.email === emailPorConfirmar ? pedido.falha : null}
            onConfirmado={() => setPedido(null)}
            onMudar={() => { setPedido(null); setMudar(true); }}
          />
        ) : (
          <FormEmail
            key={meu?.email ?? "vazio"}
            inicial={meu?.email ?? ""}
            textoNaoTenho={meu?.email ? "Deixar de receber por e-mail" : "Não tenho e-mail"}
            onCodigoPedido={(p) => { setPedido(p); setMudar(false); }}
            onFeito={onFechar}
          />
        ))}
        <button className="btn sec full" style={{ marginTop: 9, background: "none", color: "var(--cinza)" }} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}
