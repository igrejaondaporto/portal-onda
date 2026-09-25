import { useState } from "react";
import { dizerQueNaoTenhoEmail, emailFicouGravado, pedirCodigoEmail } from "../lib/email.js";

/**
 * O campo do e-mail e os dois botões — o mesmo no pop-up obrigatório
 * do login (`PedirEmail`) e na folha do menu (`SheetEmail`), para a
 * pessoa ver sempre a mesma coisa nos dois sítios.
 *
 * "Enviar código" grava o e-mail (por confirmar) e manda-lhe um código
 * (ver `lib/email.js`); o passo seguinte é o `ConfirmarEmail`. Se o
 * e-mail ficou gravado mas o código não saiu (teto do dia, espera de um
 * minuto…), segue na mesma para o passo do código, com o aviso — a
 * pessoa não tem de escrever o e-mail outra vez.
 *
 * "Não tenho e-mail" continua escrita direta e não espera pela rede: a
 * escrita local já dispara o `onSnapshot` de quem está a ouvir, e é
 * isso que fecha o pop-up à porta da igreja, mesmo sem rede.
 */
export default function FormEmail({ inicial = "", textoNaoTenho = "Não tenho e-mail", onCodigoPedido, onFeito, onMaisTarde }) {
  const [email, setEmail] = useState(inicial);
  const [erro, setErro] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [falhou, setFalhou] = useState(false);

  function enviar(e) {
    e?.preventDefault();
    setErro(null);
    setAGuardar(true);
    pedirCodigoEmail(email)
      .then((r) => {
        setAGuardar(false);
        if (r?.jaConfirmado) onFeito?.();
        else onCodigoPedido?.({ email: email.trim().toLowerCase(), falha: null });
      })
      .catch((err) => {
        setAGuardar(false);
        if (emailFicouGravado(err)) {
          onCodigoPedido?.({ email: email.trim().toLowerCase(), falha: { mensagem: err.message, motivo: err.details.motivo } });
          return;
        }
        setErro(err.message || "Não foi possível guardar.");
        setFalhou(true);
      });
  }

  function naoTenho() {
    setErro(null);
    setAGuardar(true);
    dizerQueNaoTenhoEmail()
      .then(() => onFeito?.())
      .catch((err) => { setErro(err.message || "Não foi possível guardar."); setAGuardar(false); });
    if (!navigator.onLine) onFeito?.();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label className="rot" htmlFor="campo-email" style={{ marginTop: 16 }}>O teu e-mail</label>
      <input
        id="campo-email" className="campo" type="email" inputMode="email" autoComplete="email"
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        placeholder="nome@exemplo.pt" value={email} maxLength={254}
        onChange={(e) => { setEmail(e.target.value); setErro(null); }}
      />
      <p className="ds" style={{ marginTop: 6 }}>Mandamos-te um código para confirmar que é teu.</p>
      {erro && <p className="ds" role="alert" style={{ marginTop: 6, color: "var(--magenta, #d6005c)" }}>{erro}</p>}
      <button className="btn full" type="submit" style={{ marginTop: 14 }} disabled={aGuardar || !email.trim()}>
        {aGuardar ? "A enviar…" : "Enviar código"}
      </button>
      <button
        className="btn sec full" type="button" style={{ marginTop: 9, background: "none", color: "var(--cinza)" }}
        disabled={aGuardar} onClick={naoTenho}
      >
        {textoNaoTenho}
      </button>
      {/* só depois de uma falha (sem rede, sobretudo): o pop-up não
        * prende ninguém à porta da igreja — volta no próximo login */}
      {falhou && onMaisTarde && (
        <button
          className="btn sec full" type="button" style={{ marginTop: 9, background: "none", color: "var(--cinza)" }}
          onClick={onMaisTarde}
        >
          Responder mais tarde
        </button>
      )}
    </form>
  );
}
