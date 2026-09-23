import { useState } from "react";
import { ETAPAS, CORES_ETAPA, corTextoEtapa, diasParado, indiceEtapa, nomeEtapa } from "../lib/contactos";
import { arquivarContactoPastoral, moverEtapaContacto } from "../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataTimestamp, linkWhatsApp } from "@portal/shared/lib/data.js";

/**
 * Um visitante, e o caminho dele.
 *
 * Mover de etapa é a única escrita que o Painel Pastoral faz num dado
 * de outra base — e passa por Cloud Function (`moverEtapaContacto`),
 * não por escrita direta, porque o histórico tem de ficar gravado na
 * mesma escrita. Uma regra do Firestore não garante isso.
 *
 * Andar para trás é permitido de propósito: quem foi marcado como
 * "Membro" por engano tem de poder voltar, e o histórico regista as
 * duas direções — não se perde nada ao corrigir.
 *
 * O botão de WhatsApp não muda nada no sistema: abre a conversa com a
 * pessoa. É o mesmo padrão que a líder da Base Pessoal já usa para
 * "entregar" os contactos à mão — só que agora, depois de falar, há
 * onde registar que se falou.
 */
export default function SheetContacto({ contacto, onFechar }) {
  const torrada = useTorrada();
  const [aGuardar, setAGuardar] = useState(false);
  const [aArquivar, setAArquivar] = useState(false);
  const atual = contacto.etapa ?? "visita";
  const dias = diasParado(contacto);
  const wa = linkWhatsApp(contacto.telemovel);

  async function mover(etapa) {
    if (etapa === atual) return;
    setAGuardar(true);
    try {
      await moverEtapaContacto(contacto.id, etapa);
      torrada(`${contacto.nome} → ${nomeEtapa(etapa)}`);
    } catch (e) {
      torrada(e.message || "Não foi possível mover.");
    } finally {
      setAGuardar(false);
    }
  }

  /** "Excluir" nunca é um delete a sério (regra 5 do CLAUDE.md raiz) —
   *  arquiva, o mesmo campo que a Base Pessoal já usa no Formulário
   *  dela. `ouvirContactos` já filtra `arquivado`, por isso a lista
   *  perde este contacto sozinha assim que a escrita chegar. */
  async function arquivar() {
    if (!window.confirm(`Excluir ${contacto.nome} do funil? Não aparece mais em lado nenhum, mas o registo fica guardado.`)) return;
    setAArquivar(true);
    try {
      await arquivarContactoPastoral(contacto.id);
      torrada(`${contacto.nome} excluído do funil`);
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
      setAArquivar(false);
    }
  }

  const historico = Array.isArray(contacto.historicoEtapas) ? [...contacto.historicoEtapas].reverse() : [];

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{contacto.nome}</h2>
        <p className="sb2">
          <span className="quadmin" style={{ background: CORES_ETAPA[atual] }} />
          {nomeEtapa(atual)}
          {dias !== null && ` · há ${dias} dia${dias === 1 ? "" : "s"}`}
        </p>

        {(contacto.freguesia || contacto.concelho) && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Onde mora</label>
            <p className="ds">{[contacto.freguesia, contacto.concelho].filter(Boolean).join(", ")}</p>
          </>
        )}

        {contacto.gdSugerido && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>GD mais próximo</label>
            <p className="ds">{contacto.gdSugerido}</p>
          </>
        )}

        <label className="rot" style={{ marginTop: 12 }}>Chegou</label>
        <p className="ds">
          {dataTimestamp(contacto.criadoEm)}
          {contacto.eventoId ? ` · no culto de ${contacto.eventoId}` : ""}
        </p>

        {contacto.telemovel && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>Contacto</label>
            <p className="ds">{contacto.telemovel}</p>
          </>
        )}

        {wa && (
          <a className="btn sec full" href={wa} target="_blank" rel="noreferrer" style={{ marginTop: 14, display: "block", textAlign: "center" }}>
            Falar por WhatsApp
          </a>
        )}

        <label className="rot" style={{ marginTop: 18 }}>Mover para</label>
        <div className="pa-etapas">
          {ETAPAS.map((e) => {
            const i = indiceEtapa(e.id);
            const iAtual = indiceEtapa(atual);
            return (
              <button
                key={e.id}
                className={`pa-etapa${e.id === atual ? " on" : ""}${i < iAtual ? " feita" : ""}`}
                style={e.id === atual ? { background: CORES_ETAPA[e.id], borderColor: CORES_ETAPA[e.id], color: corTextoEtapa(e.id) } : undefined}
                disabled={aGuardar || e.id === atual}
                onClick={() => mover(e.id)}
              >
                {e.nome}
              </button>
            );
          })}
        </div>

        {historico.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 18 }}>O caminho até aqui</label>
            {historico.map((h, i) => (
              <p className="ds" key={i} style={{ marginTop: i === 0 ? 4 : 2 }}>
                {nomeEtapa(h.de)} → {nomeEtapa(h.para)} · {String(h.em ?? "").slice(0, 10)}
              </p>
            ))}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 18, color: "var(--magenta)" }} disabled={aArquivar} onClick={arquivar}>
          {aArquivar ? "A excluir…" : "Excluir do funil"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
