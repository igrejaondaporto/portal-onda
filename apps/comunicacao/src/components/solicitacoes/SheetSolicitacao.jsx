import { useState } from "react";
import { assumirSolicitacao, atribuirSolicitacao, mudarStatusSolicitacao, transferirSolicitacao, excluirSolicitacao, nomeBase } from "../../lib/solicitacoes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const ROTULO_STATUS = {
  fila: "Na fila", producao: "Em produção", revisao: "Em revisão",
  entregue: "Entregue", recusada: "Recusada",
};

/** O fluxo tem um gate: quem produz manda para revisão (com o link),
 *  só o líder aprova (→ entregue) ou devolve (→ produção) — pedido
 *  explícito: "a revisão é feita por um líder". Antes, quem produzia
 *  também marcava "Entregue" sozinho; agora esse botão só existe para
 *  o líder, e só depois de revisao. */
export default function SheetSolicitacao({ solicitacao, uid, papel, ministerios, voluntarios, onFechar }) {
  const torrada = useTorrada();
  const souLider = papel === "lider_base";
  const [entregaUrl, setEntregaUrl] = useState(solicitacao.entregaUrl ?? "");
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [motivoDevolver, setMotivoDevolver] = useState("");
  const [aRecusar, setARecusar] = useState(false);
  const [aDevolver, setADevolver] = useState(false);
  const [aTransferir, setATransferir] = useState(false);
  const [paraId, setParaId] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [aExcluir, setAExcluir] = useState(false);
  const [ministerioSel, setMinisterioSel] = useState(solicitacao.ministerioId ?? "");
  const [pessoaSel, setPessoaSel] = useState(solicitacao.designadoParaId ?? "");

  if (!solicitacao) return null;
  const fechada = solicitacao.status === "entregue" || solicitacao.status === "recusada";
  const souResponsavel = solicitacao.responsavelId === uid;
  const ministerio = ministerios.find((m) => m.id === solicitacao.ministerioId);
  // exclui só quem já está com o pedido (transferir para quem já o
  // tem não faz sentido) — inclui-me a mim mesmo: abrir o card de
  // outra pessoa e "transferir para" o meu nome é como pegar o
  // pedido dela, pedido explícito do líder.
  const candidatosTransferencia = voluntarios.filter((p) => p.id !== solicitacao.responsavelId);

  async function assumir() {
    setAEnviar(true);
    try {
      await assumirSolicitacao(solicitacao.id);
      torrada("Assumiste este pedido");
    } catch (e) {
      torrada(e.message || "Não foi possível assumir.");
    } finally {
      setAEnviar(false);
    }
  }

  async function enviarParaRevisao() {
    if (!entregaUrl.trim()) return torrada("Falta o link da entrega, para o líder rever.");
    setAEnviar(true);
    try {
      await mudarStatusSolicitacao({ id: solicitacao.id, novoStatus: "revisao", entregaUrl: entregaUrl.trim() });
      torrada("Enviado para revisão");
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function aprovar() {
    setAEnviar(true);
    try {
      await mudarStatusSolicitacao({ id: solicitacao.id, novoStatus: "entregue" });
      torrada("Marcado como entregue");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível aprovar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function devolver() {
    setAEnviar(true);
    try {
      await mudarStatusSolicitacao({ id: solicitacao.id, novoStatus: "producao", motivo: motivoDevolver.trim() });
      torrada("Devolvido para produção");
    } catch (e) {
      torrada(e.message || "Não foi possível devolver.");
    } finally {
      setAEnviar(false);
    }
  }

  function recusar() {
    if (!motivoRecusa.trim()) return torrada("Falta o motivo.");
    setAEnviar(true);
    mudarStatusSolicitacao({ id: solicitacao.id, novoStatus: "recusada", motivo: motivoRecusa.trim() })
      .then(() => { torrada("Passou para Recusada"); onFechar(); })
      .catch((e) => torrada(e.message || "Não foi possível recusar."))
      .finally(() => setAEnviar(false));
  }

  function transferir() {
    if (!paraId) return torrada("Escolhe para quem.");
    setAEnviar(true);
    transferirSolicitacao(solicitacao.id, paraId)
      .then(() => { torrada("A aguardar que aceite"); setATransferir(false); })
      .catch((e) => torrada(e.message || "Não foi possível transferir."))
      .finally(() => setAEnviar(false));
  }

  function atribuir() {
    if (!ministerioSel && !pessoaSel) return torrada("Escolhe um ministério ou uma pessoa.");
    setAEnviar(true);
    atribuirSolicitacao({ id: solicitacao.id, ministerioId: ministerioSel || null, designadoParaId: pessoaSel || null })
      .then(() => torrada("Atribuído"))
      .catch((e) => torrada(e.message || "Não foi possível atribuir."))
      .finally(() => setAEnviar(false));
  }

  function excluir() {
    setAEnviar(true);
    excluirSolicitacao(solicitacao.id)
      .then(() => { torrada("Solicitação excluída"); onFechar(); })
      .catch((e) => torrada(e.message || "Não foi possível excluir."))
      .finally(() => setAEnviar(false));
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{solicitacao.titulo}</h2>
        <p className="sb2">
          {solicitacao.solicitanteNome} · prazo {dataPorExtenso(solicitacao.prazo)}
          {solicitacao.foraDoPrazo && " · fora do prazo mínimo"}
        </p>

        <label className="rot" style={{ marginTop: 14 }}>De que base</label>
        <p className="ds">{nomeBase(solicitacao.baseSolicitanteId)}</p>
        <label className="rot" style={{ marginTop: 10 }}>Ministério</label>
        <p className="ds">
          {ministerio ? (<><span className="quadmin" style={{ background: ministerio.cor }} />{ministerio.nome}</>) : "Por atribuir"}
        </p>
        {solicitacao.designadoParaNome && !solicitacao.responsavelId && (
          <p className="ds" style={{ marginTop: 2 }}>Designado a {solicitacao.designadoParaNome}</p>
        )}

        <label className="rot" style={{ marginTop: 14 }}>O que precisa</label>
        <p className="ds">{solicitacao.oQue}</p>
        <label className="rot" style={{ marginTop: 10 }}>Onde vai ser usado</label>
        <p className="ds">{solicitacao.ondeUsa}</p>
        {solicitacao.textoFinal && (
          <>
            <label className="rot" style={{ marginTop: 10 }}>Texto final</label>
            <p className="ds">{solicitacao.textoFinal}</p>
          </>
        )}
        {solicitacao.linkReferencia && (
          <>
            <label className="rot" style={{ marginTop: 10 }}>Referência</label>
            <p className="ds"><a href={solicitacao.linkReferencia} target="_blank" rel="noreferrer">{solicitacao.linkReferencia}</a></p>
          </>
        )}

        <label className="rot" style={{ marginTop: 14 }}>Estado</label>
        <p className="ds">
          {ROTULO_STATUS[solicitacao.status]}
          {solicitacao.responsavelNome && ` · ${solicitacao.responsavelNome}`}
        </p>
        {solicitacao.entregaUrl && solicitacao.status !== "producao" && (
          <p className="ds" style={{ marginTop: 4 }}>
            Entrega: <a href={solicitacao.entregaUrl} target="_blank" rel="noreferrer">{solicitacao.entregaUrl}</a>
          </p>
        )}
        {solicitacao.transferePendente && (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 10 }}>
            <p className="ds">A transferir para {solicitacao.transferePendente.paraNome} — a aguardar resposta.</p>
          </div>
        )}

        {souLider && solicitacao.status === "fila" && (
          <div className="caixa" style={{ marginTop: 10 }}>
            <label className="rot">Atribuir a</label>
            <select className="campo" value={ministerioSel} onChange={(e) => setMinisterioSel(e.target.value)}>
              <option value="">Ministério (opcional)</option>
              {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select className="campo" style={{ marginTop: 8 }} value={pessoaSel} onChange={(e) => setPessoaSel(e.target.value)}>
              <option value="">Pessoa responsável (opcional)</option>
              {voluntarios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <button className="btn" style={{ marginTop: 10 }} disabled={aEnviar} onClick={atribuir}>Atribuir</button>
          </div>
        )}

        {!fechada && !solicitacao.responsavelId && !solicitacao.transferePendente && (
          <button className="btn full" style={{ marginTop: 14 }} disabled={aEnviar} onClick={assumir}>Assumir</button>
        )}

        {!fechada && souResponsavel && solicitacao.status === "producao" && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Link da entrega</label>
            <input className="campo" value={entregaUrl} onChange={(e) => setEntregaUrl(e.target.value)} placeholder="Drive, Canva…" />
            <button className="btn full" style={{ marginTop: 10 }} disabled={aEnviar} onClick={enviarParaRevisao}>
              Enviar para revisão
            </button>

            {!aRecusar ? (
              <button className="btn sec full" style={{ marginTop: 10, color: "var(--magenta)" }} onClick={() => setARecusar(true)}>
                Recusar pedido
              </button>
            ) : (
              <div className="caixa" style={{ marginTop: 10 }}>
                <label className="rot">Motivo</label>
                <textarea className="campo" rows={2} value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} placeholder="Porque não dá para fazer" />
                <button className="btn" style={{ marginTop: 10, background: "var(--magenta)" }} disabled={aEnviar} onClick={recusar}>
                  Confirmar recusa
                </button>
              </div>
            )}
          </>
        )}

        {!fechada && solicitacao.status === "revisao" && (
          souLider ? (
            <>
              <button className="btn full" style={{ marginTop: 14 }} disabled={aEnviar} onClick={aprovar}>
                Aprovar e marcar como entregue
              </button>
              {!aDevolver ? (
                <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setADevolver(true)}>
                  Devolver para produção
                </button>
              ) : (
                <div className="caixa" style={{ marginTop: 10 }}>
                  <label className="rot">O que falta ajustar (opcional)</label>
                  <textarea className="campo" rows={2} value={motivoDevolver} onChange={(e) => setMotivoDevolver(e.target.value)} placeholder="Para quem produziu saber o que rever" />
                  <button className="btn sec" style={{ marginTop: 10 }} disabled={aEnviar} onClick={devolver}>
                    Confirmar devolução
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
              <p className="ds">Em revisão pelo líder — aguarda a decisão dele.</p>
            </div>
          )
        )}

        {/* Só depois de ter dono — atribuído (designadoParaId) ou já
            assumido (responsavelId). Um pedido novo, sem nenhum dos
            dois, já tem "Assumir" logo acima; "Transferir para" aí
            seria um caminho a mais para a mesma coisa. */}
        {!fechada && !solicitacao.transferePendente && (solicitacao.designadoParaId || solicitacao.responsavelId) && (
          !aTransferir ? (
            <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setATransferir(true)}>
              Transferir para…
            </button>
          ) : (
            <div className="caixa" style={{ marginTop: 10 }}>
              <label className="rot">Transferir para</label>
              <select className="campo" value={paraId} onChange={(e) => setParaId(e.target.value)}>
                <option value="">Escolhe alguém</option>
                {candidatosTransferencia.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar} onClick={transferir}>Transferir</button>
                <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar} onClick={() => setATransferir(false)}>Cancelar</button>
              </div>
            </div>
          )
        )}

        {solicitacao.historico?.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Histórico</label>
            {solicitacao.historico.map((h, i) => (
              <p className="ds" key={i}>
                {h.tipo === "transferencia" ? `${h.porNome ?? "alguém"} transferiu para ${h.para}`
                  : h.tipo === "transferencia_aceite" ? `${h.porNome ?? "alguém"} aceitou a transferência`
                  : h.tipo === "transferencia_recusada" ? `${h.porNome ?? "alguém"} recusou a transferência — voltou para a fila`
                  : h.tipo === "atribuicao" ? `${h.porNome ?? "alguém"} atribuiu${h.designadoParaNome ? ` a ${h.designadoParaNome}` : ""}${h.ministerioId ? ` · ${ministerios.find((m) => m.id === h.ministerioId)?.nome ?? h.ministerioId}` : ""}`
                  : `${ROTULO_STATUS[h.para] ?? h.para} — ${h.porNome ?? "alguém"}`}
                {h.motivo ? ` · ${h.motivo}` : ""}
              </p>
            ))}
          </>
        )}

        {souLider && (
          !aExcluir ? (
            <button className="btn sec full" style={{ marginTop: 16, color: "var(--magenta)" }} onClick={() => setAExcluir(true)}>
              Excluir solicitação
            </button>
          ) : (
            <div className="caixa" style={{ marginTop: 16 }}>
              <p className="ds">Tens a certeza? Sai da lista para sempre, em qualquer estado.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn" style={{ flex: 1, fontSize: 12.5, background: "var(--magenta)" }} disabled={aEnviar} onClick={excluir}>
                  Confirmar exclusão
                </button>
                <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar} onClick={() => setAExcluir(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
