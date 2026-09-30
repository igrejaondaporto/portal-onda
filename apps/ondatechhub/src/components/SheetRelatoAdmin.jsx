import { useEffect, useState } from "react";
import { atribuirRelato, membrosTechHub, mudarStatusRelato, nomeBase } from "../lib/relatos.js";
import { auth } from "@portal/shared/lib/firebase.js";
import { ROTULO_TIPO_RELATO, ROTULO_STATUS_RELATO, COR_STATUS_RELATO } from "@portal/shared/lib/relatos.js";
import { haAtras } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import AnexoRelato from "@portal/shared/components/AnexoRelato.jsx";

// qualquer membro do Onda Tech Hub move para qualquer estado — são 5
// pessoas de confiança triando junto, não uma fila de aprovação (ver
// functions/relatos.js, mudarStatusRelato).
const ESTADOS = ["aberto", "em_andamento", "resolvido", "recusado"];

export default function SheetRelatoAdmin({ relato, onFechar }) {
  const torrada = useTorrada();
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [membros, setMembros] = useState(null); // null = "passar" fechado
  const eu = auth.currentUser?.uid;
  const fechado = relato.status === "resolvido" || relato.status === "recusado";

  useEffect(() => {
    if (membros !== null && !membros.length) membrosTechHub().then(setMembros).catch(() => setMembros(null));
  }, [membros]);

  async function atribuir(paraUid) {
    setAEnviar(true);
    try {
      await atribuirRelato({ id: relato.id, ...(paraUid ? { paraUid } : {}) });
      setMembros(null);
      torrada(paraUid ? "Passado" : "É teu — estás a cuidar dele");
    } catch (e) {
      torrada(e.message || "Não foi possível atribuir.");
    } finally {
      setAEnviar(false);
    }
  }

  async function mudar(novoStatus) {
    setAEnviar(true);
    try {
      await mudarStatusRelato({ id: relato.id, novoStatus, nota: nota.trim() });
      setNota("");
      torrada(`Marcado como ${ROTULO_STATUS_RELATO[novoStatus].toLowerCase()}`);
    } catch (e) {
      torrada(e.message || "Não foi possível mudar o estado.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{relato.titulo}</h2>
        <p className="sb2">{ROTULO_TIPO_RELATO[relato.tipo]} · {nomeBase(relato.baseOrigemId)}</p>

        <label className="rot" style={{ marginTop: 14 }}>O que aconteceu</label>
        <p className="ds">{relato.descricao}</p>

        <AnexoRelato url={relato.anexoUrl} tipo={relato.anexoTipo} />

        <label className="rot" style={{ marginTop: 14 }}>Reportado por</label>
        <p className="ds">
          {relato.reportadoPorNome ?? "…"} · {haAtras(relato.criadoEm)}
          {relato.paginaOrigem ? ` · estava em "${relato.paginaOrigem}"` : ""}
        </p>

        <label className="rot" style={{ marginTop: 14 }}>Estado</label>
        <p className="ds">
          <span className="tag" style={{ background: COR_STATUS_RELATO[relato.status] }}>
            {ROTULO_STATUS_RELATO[relato.status]}
          </span>
        </p>

        <label className="rot" style={{ marginTop: 14 }}>Responsável</label>
        <p className="ds">
          {relato.responsavelNome
            ? <><b>{relato.responsavelId === eu ? "Tu" : relato.responsavelNome}</b> {relato.responsavelId === eu ? "estás" : "está"} a cuidar disto</>
            : "Ninguém puxou esta tarefa ainda"}
        </p>
        {!fechado && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {relato.responsavelId !== eu && (
              <button className="btn" style={{ flex: 1, fontSize: 13 }} disabled={aEnviar} onClick={() => atribuir(null)}>
                Assumir
              </button>
            )}
            <button className="btn sec" style={{ flex: 1, fontSize: 13 }} disabled={aEnviar} onClick={() => setMembros(membros === null ? [] : null)}>
              Passar a outra pessoa
            </button>
          </div>
        )}
        {membros?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {membros.filter((p) => p.id !== relato.responsavelId).map((p) => (
              <button key={p.id} className="btn sec" style={{ flex: "1 1 auto", fontSize: 13 }} disabled={aEnviar} onClick={() => atribuir(p.id)}>
                {p.nome}
              </button>
            ))}
          </div>
        )}

        <label className="rot" style={{ marginTop: 14 }}>Nota (opcional)</label>
        <textarea className="campo" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Fica no histórico deste relato" />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {ESTADOS.filter((e) => e !== relato.status).map((e) => (
            <button
              key={e} className="btn sec" style={{ flex: "1 1 auto", fontSize: 13 }}
              disabled={aEnviar} onClick={() => mudar(e)}
            >
              {ROTULO_STATUS_RELATO[e]}
            </button>
          ))}
        </div>

        {relato.historico?.length > 1 && (
          <>
            <label className="rot" style={{ marginTop: 18 }}>Histórico</label>
            {[...relato.historico].reverse().map((h, i) => (
              <p className="ds" key={i} style={{ marginTop: 6 }}>
                {h.responsavel
                  ? (h.responsavel.para === h.porNome ? `Assumido por ${h.porNome ?? "…"}` : `Passado a ${h.responsavel.para ?? "…"} por ${h.porNome ?? "…"}`)
                  : `${ROTULO_STATUS_RELATO[h.para] ?? h.para} por ${h.porNome ?? "…"}`}
                {h.nota ? ` — "${h.nota}"` : ""}
              </p>
            ))}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
