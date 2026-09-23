import { useState } from "react";
import { definirFeedback } from "../../lib/culto";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

export default function SheetFeedback({ evento, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [texto, setTexto] = useState(evento?.escala?.feedback?.texto ?? "");
  const [aEnviar, setAEnviar] = useState(false);
  if (!evento) return null;

  async function guardar() {
    const limpo = texto.trim();
    if (!limpo) return torrada("Escreve alguma coisa primeiro");
    setAEnviar(true);
    try {
      await definirFeedback(evento.id, limpo);
      onGuardado(limpo);
      torrada("Publicado — toda a base consegue ler");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function apagar() {
    setAEnviar(true);
    try {
      await definirFeedback(evento.id, "");
      onGuardado(null);
      torrada("Feedback apagado");
    } catch (e) {
      torrada(e.message || "Não foi possível apagar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Feedback do culto</h2>
        <p className="sb2">{dataPorExtenso(evento.data)}</p>
        <textarea
          className="campo" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="O que correu bem, o que faltou, o que a base precisa."
        />
        <p className="ds" style={{ marginTop: 10 }}>Todos os voluntários da base vão conseguir ler isto.</p>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>Publicar</button>
        {evento.escala?.feedback?.texto && (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aEnviar} onClick={apagar}>Apagar</button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
