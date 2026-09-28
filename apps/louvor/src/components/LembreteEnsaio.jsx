import { useState } from "react";
import { confirmarPresencaEnsaio } from "../lib/confirmacao";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * Lembrete do ensaio da semana, no Início (pedido do líder, 2026-09:
 * "tirar a confirmação de escala, deixar só um LEMBRETE de quando é o
 * ensaio da semana e se a pessoa vai participar"). Substitui o balão
 * "Confirma o ensaio" e o aviso "Confirma a tua escala".
 *
 * Fica visível até ao dia do ensaio, mesmo depois de a pessoa
 * responder — é um lembrete, não uma pendência que some. A resposta
 * responde-se aqui mesmo, sem abrir folha nenhuma (a regra dos três
 * toques): "Vou" grava logo; "Não posso" pede o motivo (opcional)
 * no próprio cartão. Mesma função de sempre
 * (`confirmarPresencaEnsaioLouvor`), por isso o líder continua a ver
 * as fotinhas de quem vai na caixinha "Ensaio" da Escala geral.
 */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "2026-10-01" em hora LOCAL (nunca toISOString, que é UTC e em
 *  Portugal vira o dia anterior entre a meia-noite e a 1h no verão). */
export function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoje", "Amanhã" ou "Quinta" — quem abre a app em pé, com pressa,
 *  percebe mais depressa "amanhã" do que uma data. */
function quando(iso) {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (iso === isoLocal()) return "Hoje";
  if (iso === isoLocal(amanha)) return "Amanhã";
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
}

export default function LembreteEnsaio({ evento, resposta }) {
  const torrada = useTorrada();
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const { dataEnsaio, horaEnsaio, localEnsaio } = evento.escala;

  async function responder(r, justificativa = "") {
    setAEnviar(true);
    try {
      await confirmarPresencaEnsaio(evento.id, undefined, r, justificativa);
      setPedirMotivo(false);
      setMotivo("");
      torrada(r === "vai" ? "Até ao ensaio!" : "O líder já sabe que não podes");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAEnviar(false);
    }
  }

  let rodape;
  if (pedirMotivo) {
    rodape = (
      <div className="lv-ensaio-motivo">
        <textarea
          className="campo" rows={2} value={motivo} autoFocus
          onChange={(e) => setMotivo(e.target.value)} placeholder="Porque não podes? (opcional)"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="lv-ensaio-bt sec" disabled={aEnviar} onClick={() => setPedirMotivo(false)}>Cancelar</button>
          <button className="lv-ensaio-bt" disabled={aEnviar} onClick={() => responder("nao_vai", motivo)}>
            {aEnviar ? "A enviar…" : "Avisar o líder"}
          </button>
        </div>
      </div>
    );
  } else if (resposta?.resposta === "vai") {
    rodape = (
      <div className="lv-ensaio-resposta">
        <span>✓ Vais ao ensaio</span>
        <button className="lv-ensaio-link" disabled={aEnviar} onClick={() => setPedirMotivo(true)}>Afinal não posso</button>
      </div>
    );
  } else if (resposta?.resposta === "nao_vai") {
    rodape = (
      <div className="lv-ensaio-resposta">
        <span>✗ Avisaste que não vais{resposta.justificativa ? ` — ${resposta.justificativa}` : ""}</span>
        <button className="lv-ensaio-link" disabled={aEnviar} onClick={() => responder("vai")}>Afinal vou</button>
      </div>
    );
  } else {
    rodape = (
      <div className="lv-ensaio-resposta">
        <span>Vais participar?</span>
        <button className="lv-ensaio-link" disabled={aEnviar} onClick={() => setPedirMotivo(true)}>Não posso</button>
        <button className="lv-ensaio-bt" disabled={aEnviar} onClick={() => responder("vai")}>
          {aEnviar ? "A guardar…" : "Vou"}
        </button>
      </div>
    );
  }

  return (
    <div className="destaque lv-ensaio">
      <div className="lv-ensaio-topo">
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Ensaio desta semana</p>
          <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
            {quando(dataEnsaio)}, {dataPorExtenso(dataEnsaio)}{horaEnsaio ? ` · ${horaEnsaio}` : ""}
          </p>
          <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
            {localEnsaio ? `📍 ${localEnsaio} · ` : ""}para o culto de {dataPorExtenso(evento.data)}
          </p>
        </div>
        <span style={{ fontSize: 24 }}>🎙️</span>
      </div>
      {rodape}
    </div>
  );
}
