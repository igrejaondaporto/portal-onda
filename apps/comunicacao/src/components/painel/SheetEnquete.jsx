import { useState } from "react";
import { criarEnquete, novaEnqueteId } from "../../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetEnquete({ uid, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [multiplaEscolha, setMultiplaEscolha] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  function definirOpcao(i, valor) {
    setOpcoes((atual) => atual.map((o, idx) => (idx === i ? valor : o)));
  }
  function adicionarOpcao() {
    if (opcoes.length >= 6) return;
    setOpcoes((atual) => [...atual, ""]);
  }
  function removerOpcao(i) {
    if (opcoes.length <= 2) return torrada("Precisa de pelo menos 2 opções.");
    setOpcoes((atual) => atual.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    const p = pergunta.trim();
    if (!p) return torrada("Falta a pergunta.");
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (limpas.length < 2) return torrada("Precisa de pelo menos 2 opções preenchidas.");
    if (new Set(limpas).size !== limpas.length) return torrada("Há opções repetidas.");
    setAEnviar(true);
    try {
      await criarEnquete(novaEnqueteId(), { pergunta: p, opcoes: limpas, multiplaEscolha, prazo: prazo || null }, uid);
      onGuardado("Enquete aberta");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Nova enquete</h2>

        <label className="rot" style={{ marginTop: 14 }}>Pergunta</label>
        <input className="campo" value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: Qual template preferes para os Stories?" />

        <label className="rot">Opções</label>
        {opcoes.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="campo" style={{ flex: 1 }} value={o} onChange={(e) => definirOpcao(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
            {opcoes.length > 2 && (
              <button className="btn sec" style={{ padding: "10px 12px" }} onClick={() => removerOpcao(i)}>✕</button>
            )}
          </div>
        ))}
        {opcoes.length < 6 && (
          <button className="btn sec full" style={{ marginTop: 8 }} onClick={adicionarOpcao}>Adicionar opção</button>
        )}

        <label className="rot" style={{ marginTop: 14 }}>Escolha múltipla</label>
        <div className="subtabs" style={{ marginTop: 0 }}>
          <button data-on={!multiplaEscolha ? 1 : 0} onClick={() => setMultiplaEscolha(false)}>Uma opção</button>
          <button data-on={multiplaEscolha ? 1 : 0} onClick={() => setMultiplaEscolha(true)}>Várias opções</button>
        </div>

        <label className="rot" style={{ marginTop: 14 }}>Prazo (opcional)</label>
        <input className="campo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Abrir enquete</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
