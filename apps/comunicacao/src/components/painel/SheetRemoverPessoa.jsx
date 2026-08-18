import { useState } from "react";
import { removerVoluntario } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetRemoverPessoa({ pessoa, onFechar, onVoltar, onRemovido }) {
  const torrada = useTorrada();
  const [aEnviar, setAEnviar] = useState(false);
  if (!pessoa) return null;

  async function remover() {
    setAEnviar(true);
    try {
      await removerVoluntario(pessoa.id);
      onRemovido("Voluntário removido da base");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Remover {pessoa.nome}?</h2>
        <p className="sb2">O histórico dos domingos passados mantém-se.</p>
        <button className="btn full" style={{ marginTop: 20, background: "var(--magenta)" }} disabled={aEnviar} onClick={remover}>
          Remover da base
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => onVoltar(pessoa.id)}>
          Voltar atrás
        </button>
      </div>
    </>
  );
}
