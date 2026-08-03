import { useEffect, useRef, useState } from "react";
import { ouvirReembolsos, criarReembolso, marcarPago } from "../lib/reembolsos";
import { ouvirVoluntarios } from "../lib/painel";
import { eur, dataTimestamp } from "../lib/data";
import { useTorrada } from "../lib/TorradaContext";
import Avatar from "../components/Avatar";

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

  useEffect(() => ouvirReembolsos(souLiderBase, uid, setReembolsos), [souLiderBase, uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const pendentes = reembolsos.filter((r) => r.estado === "submetido");
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";

  useEffect(() => {
    definirCabecalho({
      titulo: "Reembolsos",
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

  async function pagar(id) {
    try {
      await marcarPago(id);
      torrada("Marcado como pago");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
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
              return (
                <div className="linha" key={r.id}>
                  {p && <Avatar pessoa={p} tamanho={38} fonte={15} />}
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{eur(r.valor)}</p>
                    <p className="ds">
                      {r.descricao} · {dataTimestamp(r.criadoEm)}{souLiderBase && p ? ` · ${p.nome}` : ""}
                    </p>
                  </div>
                  {souLiderBase && r.estado === "submetido" ? (
                    <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => pagar(r.id)}>Marcar pago</button>
                  ) : (
                    <span className={`tag${r.estado === "pago" ? " verd" : ""}`}>{r.estado}</span>
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
