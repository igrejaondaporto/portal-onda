import { useEffect, useState } from "react";
import { estadoDoEmail, ouvirMeuEmail } from "../lib/email.js";
import { SeloEmail } from "./ConfirmarEmail.jsx";
import SheetEmail from "./SheetEmail.jsx";

/**
 * O e-mail para avisos dentro do Perfil, por baixo do nome e do
 * telemóvel (2026-10, pedido do dono do produto: "o botão de e-mail
 * coloca no perfil: quando clicar em ver perfil, embaixo do nome e do
 * número, já coloca a informação de e-mail"). Antes era um botão no menu
 * da foto (`MenuEu`), que deixou de o ter.
 *
 * Mostra o endereço e se está confirmado; "Alterar" abre o mesmo
 * `SheetEmail` de sempre (código de confirmação incluído). Cada app põe
 * isto no seu `pages/Perfil.jsx`, na caixa "Dados".
 */
export default function EmailNoPerfil() {
  const [meu, setMeu] = useState(undefined);
  const [aberto, setAberto] = useState(false);
  useEffect(() => ouvirMeuEmail(setMeu), []);
  const estado = estadoDoEmail(meu);

  return (
    <>
      <label className="rot">E-mail para avisos</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 15 }}>
          {meu === undefined ? "A carregar…"
            : meu?.email ? meu.email
            : meu?.semEmail ? "Sem e-mail"
            : "Ainda não deixaste um e-mail"}
        </span>
        {meu?.email && <SeloEmail estado={estado} />}
        <button type="button" className="btn sec" style={{ padding: "8px 14px" }} onClick={() => setAberto(true)}>
          {meu?.email ? "Alterar" : "Juntar"}
        </button>
      </div>
      {aberto && <SheetEmail onFechar={() => setAberto(false)} />}
    </>
  );
}
