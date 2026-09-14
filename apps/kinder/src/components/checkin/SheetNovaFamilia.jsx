import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dadosRegisto, registarFamilia } from "../../lib/kinder";
import FormFamilia from "../FormFamilia";

/** Registo na receção, pelo voluntário — a mesma ficha dos pais, mais a
 *  escolha da sala. O consentimento lê-se aos pais e marca-se aqui;
 *  fica registado quem o marcou (functions/kinder.js). */
export default function SheetNovaFamilia({ restrita, onFechar, onRegistada }) {
  const torrada = useTorrada();
  const [config, setConfig] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    dadosRegisto().then(setConfig).catch(() => torrada("Não foi possível abrir o registo.", true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submeter(dados) {
    setAEnviar(true);
    try {
      const r = await registarFamilia(dados);
      torrada("Família registada");
      onRegistada(r);
    } catch (e) {
      torrada(e.message || "Não foi possível registar.", true);
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Nova família</h2>
        <p className="sb2">Os pais também podem registar-se sozinhos pelo QR da porta</p>
        {!config ? <div className="vaz" style={{ marginTop: 12 }}>A carregar…</div> : (
          <FormFamilia
            consentimento={config.consentimento} podeEscolherSala salaFixa={restrita} mostrarVisitante aEnviar={aEnviar}
            textoBotao="Registar" onSubmeter={submeter} onCancelar={onFechar} avisar={(m) => torrada(m, true)}
          />
        )}
      </div>
    </>
  );
}
