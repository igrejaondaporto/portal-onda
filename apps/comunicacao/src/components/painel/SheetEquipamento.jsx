import { useState } from "react";
import { criarEquipamento, novoEquipamentoId } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Só cria — nome e ícone. "Passar" (quem fica com o equipamento) é
 *  uma ação de qualquer voluntário, no Início, não daqui. Não há
 *  edição de nome depois de criado nesta fase (são só dois itens,
 *  ver CLAUDE.md desta base — corrige direto no Firestore se for
 *  mesmo preciso mudar o nome). */
export default function SheetEquipamento({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome do equipamento.");
    setAEnviar(true);
    try {
      await criarEquipamento({ itemId: novoEquipamentoId(), nome: n });
      onGuardado("Equipamento adicionado");
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
        <h2>Novo equipamento</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Câmara Sony" />
        <p className="ds" style={{ marginTop: 8 }}>Sem responsável ainda — atribui-se no Início, com "Passar".</p>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
