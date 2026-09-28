import { useState } from "react";
import { confirmarPresenca } from "../lib/confirmacao";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Confirmar presença no próprio box do culto, em Escala (pedido do
 * líder, 2026-09: "um botão de Confirmar ao lado de cada dia, lá nos
 * boxes mesmo em Escala"). Substitui o popup obrigatório que abria ao
 * entrar (ConfirmacaoAutoStart, removido) — o Início passou a ter só
 * um aviso que traz a pessoa até aqui.
 *
 * Fica colada por baixo do CartaoCulto (partilhado — não tem rodapé,
 * e o cabeçalho é um <button>, onde outro botão não pode entrar), só
 * nos cultos publicados em que a pessoa serve e que ainda não
 * passaram. `resposta` vem de ouvirConfirmacoesDoMes, ao vivo.
 *
 * "Não posso" pede a justificativa aqui mesmo, sem abrir folha
 * nenhuma — é a mesma resposta `nao_vai` que o líder já via.
 */
export default function BarraConfirmarPresenca({ evento, resposta }) {
  const torrada = useTorrada();
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function responder(r, justificativa = "") {
    setAEnviar(true);
    try {
      await confirmarPresenca(evento.id, undefined, r, justificativa);
      setPedirMotivo(false);
      setMotivo("");
      torrada(r === "vai" ? "Presença confirmada" : "O líder já sabe que não podes");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAEnviar(false);
    }
  }

  if (pedirMotivo) {
    return (
      <div className="lv-confirmar lv-confirmar-motivo">
        <label className="rot" style={{ marginTop: 0 }}>Porque não podes? (opcional)</label>
        <textarea
          className="campo" rows={2} value={motivo} autoFocus
          onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: estou de viagem"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn sec" style={{ flex: 1 }} disabled={aEnviar} onClick={() => setPedirMotivo(false)}>
            Cancelar
          </button>
          <button
            className="btn" style={{ flex: 1, background: "var(--magenta)" }}
            disabled={aEnviar} onClick={() => responder("nao_vai", motivo)}
          >
            {aEnviar ? "A enviar…" : "Avisar o líder"}
          </button>
        </div>
      </div>
    );
  }

  if (resposta?.resposta === "vai") {
    return (
      <div className="lv-confirmar" data-estado="vai">
        <span className="lv-confirmar-txt">✓ Presença confirmada</span>
        <button className="lv-confirmar-link" disabled={aEnviar} onClick={() => setPedirMotivo(true)}>
          Afinal não posso
        </button>
      </div>
    );
  }

  if (resposta?.resposta === "nao_vai") {
    return (
      <div className="lv-confirmar" data-estado="nao_vai">
        <span className="lv-confirmar-txt">
          ✗ Avisaste que não podes{resposta.justificativa ? ` — ${resposta.justificativa}` : ""}
        </span>
        <button className="lv-confirmar-link" disabled={aEnviar} onClick={() => responder("vai")}>
          Afinal vou
        </button>
      </div>
    );
  }

  return (
    <div className="lv-confirmar" data-estado="pendente">
      <span className="lv-confirmar-txt">Confirmas que vais?</span>
      <button className="lv-confirmar-link" disabled={aEnviar} onClick={() => setPedirMotivo(true)}>
        Não posso
      </button>
      <button
        className="btn" style={{ background: "var(--verde)", padding: "8px 16px", fontSize: 13 }}
        disabled={aEnviar} onClick={() => responder("vai")}
      >
        {aEnviar ? "A confirmar…" : "Confirmar"}
      </button>
    </div>
  );
}
