import { useState } from "react";
import { dizerQueNaoTenhoEmail, guardarMeuEmail } from "../lib/email.js";

/**
 * O campo do e-mail e os dois botões — o mesmo no pop-up obrigatório
 * do login (`PedirEmail`) e na folha do menu (`SheetEmail`), para a
 * pessoa ver sempre a mesma coisa nos dois sítios.
 *
 * Não espera pela rede para dar por feito: a escrita local já dispara
 * o `onSnapshot` de quem está a ouvir (ver `lib/email.js`), e é isso
 * que fecha o pop-up. Só um erro a sério (regra recusou) volta aqui.
 */
export default function FormEmail({ inicial = "", textoNaoTenho = "Não tenho e-mail", onFeito }) {
  const [email, setEmail] = useState(inicial);
  const [erro, setErro] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);

  function guardar(e) {
    e?.preventDefault();
    setErro(null);
    setAGuardar(true);
    const p = guardarMeuEmail(email);
    p.then(() => onFeito?.()).catch((err) => { setErro(err.message || "Não foi possível guardar."); setAGuardar(false); });
    // sem rede a promessa só resolve quando a ligação voltar — o
    // pop-up já fechou pelo onSnapshot; a folha do menu fecha aqui
    if (!navigator.onLine) onFeito?.();
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
    <form onSubmit={guardar} noValidate>
      <label className="rot" htmlFor="campo-email" style={{ marginTop: 16 }}>O teu e-mail</label>
      <input
        id="campo-email" className="campo" type="email" inputMode="email" autoComplete="email"
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        placeholder="nome@exemplo.pt" value={email} maxLength={254}
        onChange={(e) => { setEmail(e.target.value); setErro(null); }}
      />
      {erro && <p className="ds" role="alert" style={{ marginTop: 6, color: "var(--magenta, #d6005c)" }}>{erro}</p>}
      <button className="btn full" type="submit" style={{ marginTop: 14 }} disabled={aGuardar || !email.trim()}>
        {aGuardar ? "A guardar…" : "Guardar"}
      </button>
      <button
        className="btn sec full" type="button" style={{ marginTop: 9, background: "none", color: "var(--cinza)" }}
        disabled={aGuardar} onClick={naoTenho}
      >
        {textoNaoTenho}
      </button>
    </form>
  );
}
