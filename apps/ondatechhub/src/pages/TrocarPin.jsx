import { useState } from "react";
import { trocarPin } from "@portal/shared/lib/auth.js";
import TecladoNumerico from "@portal/shared/components/TecladoNumerico.jsx";

// mesma regra da Cloud Function `trocarPin` — só para avisar cedo,
// quem decide de facto continua a ser o servidor.
const fraco = (pin) => /^(\d)\1+$/.test(pin) || "0123456789".includes(pin);

/**
 * Ecrã obrigatório depois de entrar com o código provisório
 * (1234 / 123456). Não tem forma de saltar — só sai daqui com um
 * código próprio.
 */
export default function TrocarPin({ papel, codigoAtual, onConcluido }) {
  const dig = papel === "lider_base" ? 6 : 4;

  const [etapa, setEtapa] = useState("novo"); // "novo" | "confirmar"
  const [novo, setNovo] = useState("");
  const [cod, setCod] = useState("");
  const [erro, setErro] = useState("");
  const [tremer, setTremer] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  function reiniciar(mensagem) {
    setEtapa("novo");
    setNovo("");
    setCod("");
    setErro(mensagem || "");
    setTremer(true);
    setTimeout(() => setTremer(false), 400);
  }

  async function completar(pinNovo) {
    setAEnviar(true);
    const r = await trocarPin(codigoAtual, pinNovo);
    setAEnviar(false);
    if (r.ok) onConcluido();
    else reiniciar(r.mensagem);
  }

  function tecla(n) {
    if (aEnviar) return;
    setErro("");
    const c = cod + n;
    setCod(c);
    if (c.length !== dig) return;

    if (etapa === "novo") {
      if (fraco(c)) return reiniciar("Escolhe um código menos óbvio.");
      setNovo(c);
      setCod("");
      setEtapa("confirmar");
    } else if (c === novo) {
      completar(c);
    } else {
      reiniciar("Os códigos não coincidem. Vamos outra vez.");
    }
  }
  function apagar() {
    if (aEnviar) return;
    setCod((c) => c.slice(0, -1));
  }

  return (
    <div className="login">
      <div className="crista entrada">
        <div>
          <div className="lin">
            <span className="logo">
              <i>igreja</i>
              <b>onda</b>
            </span>
          </div>
          <h1>
            Cria o teu <em>código</em>
          </h1>
          <p className="sob">É a primeira vez que entras — escolhe um código só teu.</p>
        </div>
        <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
          <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
        </svg>
      </div>
      <div className="folha" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.035em" }}>
          {etapa === "novo" ? "Código novo" : "Confirma o código"}
        </h2>
        <p className="sb2">
          {etapa === "novo" ? `Escolhe ${dig} dígitos, nada óbvio` : "Introduz outra vez, para confirmar"}
        </p>
        <div className={`pts${tremer ? " e tr" : ""}`}>
          {Array.from({ length: dig }).map((_, i) => (
            <i key={i} className={i < cod.length ? "on" : ""} />
          ))}
        </div>
        <p className="aviso">{erro}</p>
        <TecladoNumerico desativado={aEnviar} podeApagar={!!cod.length} onTecla={tecla} onApagar={apagar} />
      </div>
    </div>
  );
}
