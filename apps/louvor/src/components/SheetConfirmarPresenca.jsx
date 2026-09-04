import { useEffect, useState } from "react";
import { confirmarPresenca } from "../lib/confirmacao";
import { emojiPapel, nomePapel } from "../lib/modelo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

/**
 * Confirmação de presença — mesmo padrão do SheetResponderEnquete
 * (passo a passo quando há mais do que um culto pendente), mas em
 * vez de indisponibilidade em bloco, cada culto tem a própria
 * resposta: "Vou" ou "Não vou" — quem não pode já deixa a
 * justificativa no mesmo gesto, sem precisar de outro toque.
 *
 * Mostra a escala completa do culto (pedido do líder, "já mostra a
 * escala que o líder subiu") — mais fácil ver de relance quem mais
 * está a servir do que abrir o cartão do culto em Escala.jsx.
 *
 * `bloqueante` é usado só pelo popup automático ao publicar
 * (ConfirmacaoAutoStart) — tira o toque no véu, mesmo padrão de
 * SheetResponderEnquete/bloqueante.
 */
export default function SheetConfirmarPresenca({ cultos, minhasRespostas, pessoaPorId, pessoaAlvo, bloqueante, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [passo, setPasso] = useState(0);
  const [resposta, setResposta] = useState(null); // "vai" | "nao_vai" | null
  const [justificativa, setJustificativa] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  const culto = cultos[passo];
  const ultimoPasso = passo === cultos.length - 1;
  const escalados = culto.escala?.escalados || [];

  useEffect(() => {
    const r = minhasRespostas?.[culto.id];
    setResposta(r?.resposta ?? null);
    setJustificativa(r?.justificativa || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [culto.id]);

  async function guardar() {
    if (!resposta) return torrada("Toca em \"Vou\" ou \"Não vou\".");
    setAEnviar(true);
    try {
      await confirmarPresenca(culto.id, pessoaAlvo?.id, resposta, justificativa);
      if (ultimoPasso) {
        onGuardado("Resposta guardada");
      } else {
        setPasso((p) => p + 1);
        setAEnviar(false);
        torrada(`Guardado — falta ${dataPorExtenso(cultos[passo + 1].data)}`);
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a resposta.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={bloqueante ? undefined : onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {cultos.length > 1 && (
          <p className="sb2" style={{ marginBottom: 4 }}>
            {cultos.length} cultos por confirmar — passo {passo + 1}/{cultos.length}
          </p>
        )}
        <h2>
          {pessoaAlvo
            ? `${pessoaAlvo.nome.split(" ")[0]} vai servir ${dataPorExtenso(culto.data)}?`
            : `Vais servir ${dataPorExtenso(culto.data)}?`}
        </h2>
        {pessoaAlvo && (
          <p className="ds" style={{ color: "var(--magenta)", fontWeight: 600, marginTop: 2 }}>
            A responder em nome de {pessoaAlvo.nome} — fica marcado que foi o líder a responder.
          </p>
        )}

        {escalados.length > 0 && (
          <div className="caixa" style={{ marginTop: 12 }}>
            <label className="rot" style={{ marginBottom: 6 }}>Quem mais serve neste culto</label>
            {escalados.map((e) => {
              const p = pessoaPorId(e.pessoaId);
              return (
                <p key={e.pessoaId} className="ds" style={{ margin: "3px 0" }}>
                  {emojiPapel(e.papel)} {nomePapel(e.papel)} — {p?.nome ?? "…"}
                </p>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            className="btn full" style={{ flex: 1, background: "var(--verde)", outline: resposta === "vai" ? "3px solid var(--tinta)" : "none" }}
            disabled={aEnviar} onClick={() => setResposta("vai")}
          >
            {resposta === "vai" ? "✓ " : ""}Vou
          </button>
          <button
            className="btn full" style={{ flex: 1, background: "var(--magenta)", outline: resposta === "nao_vai" ? "3px solid var(--tinta)" : "none" }}
            disabled={aEnviar} onClick={() => setResposta("nao_vai")}
          >
            {resposta === "nao_vai" ? "✓ " : ""}Não vou
          </button>
        </div>

        {resposta === "nao_vai" && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Justificativa</label>
            <textarea
              className="campo" rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: estou de viagem, vou trabalhar" autoFocus
            />
          </>
        )}

        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || !resposta} onClick={guardar}>
          {aEnviar ? "A guardar…" : ultimoPasso ? "Guardar resposta" : `Guardar e ir para ${dataPorExtenso(cultos[passo + 1]?.data)} (${passo + 2}/${cultos.length})`}
        </button>
        {!bloqueante && <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>}
      </div>
    </>
  );
}
