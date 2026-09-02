import { useEffect, useRef, useState } from "react";
import { ouvirReembolsos, criarReembolso, aprovarReembolso, indeferirReembolso } from "../lib/reembolsos";
import { ouvirVoluntarios } from "../lib/painel";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

// submetido → aprovado|indeferido (líder) → pago (Financeiro, ainda
// por construir — "aprovado" é onde este fluxo para, por agora).
const ROTULOS = {
  submetido: { texto: { lider: "Pendente", voluntario: "Em aberto" }, tag: "cinz" },
  aprovado: { texto: { lider: "Aprovado", voluntario: "Aguardando Financeiro" }, tag: "verd" },
  indeferido: { texto: { lider: "Indeferido", voluntario: "Indeferido" }, tag: "" },
  pago: { texto: { lider: "Pago", voluntario: "Pago" }, tag: "verd" },
};

export default function Reembolsos({ uid, papel, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const inputRef = useRef(null);
  const [reembolsos, setReembolsos] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [ficheiro, setFicheiro] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aIndeferir, setAIndeferir] = useState(null);
  const [comentario, setComentario] = useState("");
  const [aProcessar, setAProcessar] = useState(false);

  useEffect(() => ouvirReembolsos(souLiderBase, uid, setReembolsos), [souLiderBase, uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const pendentes = reembolsos.filter((r) => r.estado === "submetido");
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Reembolsos</em>,
      subtitulo: "Sobe a nota e o líder trata do resto",
      chips: souLiderBase
        ? [`${pendentes.length} por tratar`]
        : [`${reembolsos.length} pedido${reembolsos.length !== 1 ? "s" : ""}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souLiderBase, pendentes.length, reembolsos.length]);

  function escolherFicheiro(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) setFicheiro(f);
  }

  async function submeter() {
    if (!descricao.trim()) return torrada("Escreve o que compraste");
    const v = parseFloat(String(valor).replace(",", "."));
    if (!v || v <= 0) return torrada("Falta o valor");
    if (!ficheiro) return torrada("Junta a foto da nota");
    setAEnviar(true);
    try {
      await criarReembolso(uid, { descricao: descricao.trim(), valor: v, ficheiro });
      setDescricao(""); setValor(""); setFicheiro(null);
      torrada(`Pedido enviado ao ${nomeLiderBase}`);
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function aprovar(id) {
    setAProcessar(true);
    try {
      await aprovarReembolso(id);
      torrada("Pedido aprovado");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAProcessar(false);
    }
  }

  async function confirmarIndeferir() {
    if (!comentario.trim()) return torrada("Escreve o motivo");
    setAProcessar(true);
    try {
      await indeferirReembolso(aIndeferir, comentario.trim());
      setAIndeferir(null);
      setComentario("");
      torrada("Pedido indeferido");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAProcessar(false);
    }
  }

  return (
    <div className="duas">
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Novo pedido</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Descrição</label>
            <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: papel higiénico e lixívia" />
            <label className="rot">Valor</label>
            <input className="campo" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            <label className="rot">Nota ou fatura</label>
            <p className="ds" style={{ marginTop: -4, marginBottom: 8 }}>
              Se pedires fatura, pede com o NIF da igreja: 517643340 (Igreja Onda).
            </p>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={escolherFicheiro} />
            <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => inputRef.current.click()}>
              {ficheiro ? "Nota anexada ✓" : "Escolher ficheiro"}
            </button>
            <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={submeter}>Enviar ao líder</button>
            <p className="ds" style={{ marginTop: 12 }}>O {nomeLiderBase} recebe o pedido e encaminha para o Financeiro.</p>
          </div>
        </div>
      </div>
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>{souLiderBase ? "Todos os pedidos" : "Os teus pedidos"}</h3></div>
          {reembolsos.length ? (
            reembolsos.map((r) => {
              const p = voluntarios.find((x) => x.id === r.pessoaId);
              const rotulo = ROTULOS[r.estado] ?? { texto: { lider: r.estado, voluntario: r.estado }, tag: "" };
              return (
                <div key={r.id}>
                  <div className="linha">
                    {p && <Avatar pessoa={p} tamanho={38} fonte={15} />}
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{eur(r.valor)}</p>
                      <p className="ds">
                        {r.descricao} · {dataTimestamp(r.criadoEm)}{souLiderBase && p ? ` · ${p.nome}` : ""}
                      </p>
                    </div>
                    {souLiderBase && r.estado === "submetido" ? (
                      aIndeferir === r.id ? null : (
                        <div style={{ display: "flex", gap: 8, flex: "none" }}>
                          <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} disabled={aProcessar} onClick={() => aprovar(r.id)}>
                            Aprovar
                          </button>
                          <button
                            className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--magenta)" }}
                            disabled={aProcessar} onClick={() => { setAIndeferir(r.id); setComentario(""); }}
                          >
                            Indeferir
                          </button>
                        </div>
                      )
                    ) : (
                      <span className={`tag${rotulo.tag ? ` ${rotulo.tag}` : ""}`}>
                        {souLiderBase ? rotulo.texto.lider : rotulo.texto.voluntario}
                      </span>
                    )}
                  </div>
                  {aIndeferir === r.id && (
                    <div className="caixa" style={{ marginTop: -6, marginBottom: 14 }}>
                      <label className="rot" style={{ marginTop: 0 }}>Motivo do indeferimento</label>
                      <textarea
                        className="campo" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)}
                        placeholder="O que falta ou porque não pode ser reembolsado"
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="btn full" disabled={aProcessar} onClick={confirmarIndeferir}>Confirmar indeferimento</button>
                        <button className="btn sec full" onClick={() => setAIndeferir(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {r.estado === "indeferido" && r.comentarioLider && (
                    <p className="ds" style={{ marginTop: -8, marginBottom: 14, color: "var(--magenta)" }}>
                      Motivo: {r.comentarioLider}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="vaz">{souLiderBase ? "Ainda não há pedidos." : "Ainda não submeteste nenhum pedido."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
