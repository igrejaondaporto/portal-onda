import { useEffect, useState } from "react";
import { confirmarPresenca, confirmarPresencaEnsaio } from "../lib/confirmacao";
import { emojiPapel, nomePapel, pessoasEscaladas } from "../lib/modelo";
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
 * SheetResponderEnquete/bloqueante; ganha também "Ainda não sei"
 * (`onNaoSeiAinda`), pedido do líder — fecha sem gravar resposta
 * nenhuma, a pessoa responde depois pelo balão fixo no Início.
 *
 * `tipo="ensaio"` reaproveita o componente inteiro para a confirmação
 * de ENSAIO (2026-09) em vez de culto — só troca o texto e a função
 * chamada (confirmarPresencaEnsaio); a data mostrada passa a ser
 * `culto.escala.dataEnsaio`, não `culto.data` (o culto e o ensaio
 * raramente caem no mesmo dia). "Quem mais serve" continua a mostrar
 * a escala do CULTO — é quem vai ao ensaio junto, faz sentido nos
 * dois casos.
 */
export default function SheetConfirmarPresenca({ cultos, minhasRespostas, pessoaPorId, pessoaAlvo, bloqueante, tipo = "culto", onNaoSeiAinda, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [passo, setPasso] = useState(0);
  const [resposta, setResposta] = useState(null); // "vai" | "nao_vai" | null
  const [justificativa, setJustificativa] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  // `cultos` vem do chamador recalculado ao vivo (confirmações são
  // onSnapshot) — confirmar o passo atual pode fazer a lista ENCOLHER
  // a meio (o culto respondido sai de "por confirmar") antes do
  // `passo` local acompanhar, o que apontava para fora do array.
  // Grudar no último culto que sobrar em vez de rebentar.
  const passoSeguro = Math.min(passo, Math.max(cultos.length - 1, 0));
  const culto = cultos[passoSeguro];
  const ultimoPasso = passoSeguro === cultos.length - 1;
  const escalados = pessoasEscaladas(culto?.escala?.escalados); // uma entrada por pessoa
  const dataAlvo = (c) => (tipo === "ensaio" ? c?.escala?.dataEnsaio : c?.data);
  const confirmarFn = tipo === "ensaio" ? confirmarPresencaEnsaio : confirmarPresenca;
  const verbo = tipo === "ensaio" ? "ir ao ensaio de" : "servir";

  useEffect(() => {
    if (!culto) return;
    const r = minhasRespostas?.[culto.id];
    setResposta(r?.resposta ?? null);
    setJustificativa(r?.justificativa || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [culto?.id]);

  async function guardar() {
    if (!culto || !resposta) return torrada("Toca em \"Vou\" ou \"Não vou\".");
    setAEnviar(true);
    try {
      await confirmarFn(culto.id, pessoaAlvo?.id, resposta, justificativa);
      if (ultimoPasso) {
        onGuardado("Resposta guardada");
      } else {
        setPasso(passoSeguro + 1);
        setAEnviar(false);
        torrada(`Guardado — falta ${dataPorExtenso(dataAlvo(cultos[passoSeguro + 1]))}`);
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a resposta.");
      setAEnviar(false);
    }
  }

  if (!culto) return null;

  return (
    <>
      <div className="veu on" onClick={bloqueante ? undefined : onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {cultos.length > 1 && (
          <p className="sb2" style={{ marginBottom: 4 }}>
            {cultos.length} cultos por confirmar — passo {passoSeguro + 1}/{cultos.length}
          </p>
        )}
        <h2>
          {pessoaAlvo
            ? `${pessoaAlvo.nome.split(" ")[0]} confirma que vai ${verbo} ${dataPorExtenso(dataAlvo(culto))}?`
            : `Confirmas que vais ${verbo} ${dataPorExtenso(dataAlvo(culto))}?`}
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
                  {e.papeis.map((id) => `${emojiPapel(id)} ${nomePapel(id)}`).join(" · ")} — {p?.nome ?? "…"}
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
          {aEnviar ? "A guardar…" : ultimoPasso ? "Guardar resposta" : `Guardar e ir para ${dataPorExtenso(dataAlvo(cultos[passoSeguro + 1]))} (${passoSeguro + 2}/${cultos.length})`}
        </button>
        {bloqueante
          ? <button className="btn sec full" style={{ marginTop: 9 }} disabled={aEnviar} onClick={onNaoSeiAinda}>Ainda não sei</button>
          : <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>}
      </div>
    </>
  );
}
