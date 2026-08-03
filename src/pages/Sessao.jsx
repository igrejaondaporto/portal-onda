import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { sair } from "../lib/auth";

/**
 * Placeholder até o Painel (passo 2) existir — só confirma que o
 * login por PIN funciona de facto, ponta a ponta.
 */
export default function Sessao({ uid, papel, baseId }) {
  const [pessoa, setPessoa] = useState(null);

  useEffect(() => {
    getDoc(doc(db, `bases/${baseId}/pessoas/${uid}`)).then((s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  return (
    <div className="sessao">
      <div className="crista" style={{ paddingBottom: 28 }}>
        <div className="lin">
          <span className="logo">
            <i>igreja</i>
            <b>onda</b>
          </span>
        </div>
        <h1 style={{ marginTop: 22 }}>
          Entraste,
          <br />
          <em>{pessoa?.nome ?? "…"}</em>
        </h1>
        <p className="sob">{papel === "lider_base" ? "Líder da base" : "Voluntário"}</p>
      </div>
      <div className="miolo">
        <p className="cap">O resto do portal ainda não existe nesta versão.</p>
        <button className="sair" onClick={sair}>
          Sair
        </button>
      </div>
    </div>
  );
}
