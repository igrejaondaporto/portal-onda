import { useState } from "react";
import { criarMarca, guardarMarca, novaMarcaId, contarRecursos, desativarMarca } from "../../lib/marcas";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const CORES_PADRAO = ["#0019BE", "#D8F24B", "#0A0F2E"];

/** Cores: uma paleta pequena (2 a 4 tons), não um par fixo — é o que
 *  aparece nos swatches do card e o que dá o gradiente (as duas
 *  primeiras). O líder adiciona/remove, sempre pelo menos 2. */
export default function SheetMarca({ marca, onFechar, onGuardado, onDesativada }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(marca?.nome ?? "");
  const [descricao, setDescricao] = useState(marca?.descricao ?? "");
  const [cores, setCores] = useState(marca?.cores?.length ? marca.cores : CORES_PADRAO.slice(0, 2));
  const [fotoUrl, setFotoUrl] = useState(marca?.fotoUrl ?? "");
  const [aEnviar, setAEnviar] = useState(false);
  const [aConfirmarDesativar, setAConfirmarDesativar] = useState(false);

  function definirCor(i, valor) {
    setCores((atual) => atual.map((c, idx) => (idx === i ? valor : c)));
  }
  function adicionarCor() {
    if (cores.length >= 4) return;
    setCores((atual) => [...atual, "#0092D4"]);
  }
  function removerCor(i) {
    if (cores.length <= 2) return torrada("Precisa de pelo menos 2 cores.");
    setCores((atual) => atual.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome da marca.");
    if (cores.some((c) => !/^#[0-9a-fA-F]{6}$/.test(c))) return torrada("Cada cor tem de ser um hex válido, ex.: #0019BE.");
    setAEnviar(true);
    try {
      const dados = { nome: n, descricao: descricao.trim(), cores, fotoUrl: fotoUrl.trim() || null };
      if (marca) {
        await guardarMarca(marca.id, dados);
        onGuardado("Marca atualizada");
      } else {
        await criarMarca(novaMarcaId(), dados);
        onGuardado("Marca criada");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function pedirDesativar() {
    const n = await contarRecursos(marca.id);
    if (n > 0 && !aConfirmarDesativar) {
      setAConfirmarDesativar(true);
      return torrada(`Esta marca tem ${n} recurso${n === 1 ? "" : "s"} — toca outra vez para desativar mesmo assim.`);
    }
    try {
      await desativarMarca(marca.id);
      onDesativada?.("Marca desativada");
    } catch (e) {
      torrada(e.message || "Não foi possível desativar.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{marca ? "Editar marca" : "Nova marca"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: ONDA" />

        <label className="rot">Descrição curta</label>
        <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Marca principal da igreja" />

        <label className="rot">Cores</label>
        {cores.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="color" value={c} onChange={(e) => definirCor(i, e.target.value)} style={{ width: 40, height: 40, border: 0, borderRadius: 8, padding: 0 }} />
            <input className="campo" style={{ flex: 1 }} value={c} onChange={(e) => definirCor(i, e.target.value)} />
            {cores.length > 2 && (
              <button className="btn sec" style={{ padding: "10px 12px" }} onClick={() => removerCor(i)}>✕</button>
            )}
          </div>
        ))}
        {cores.length < 4 && (
          <button className="btn sec full" style={{ marginTop: 8 }} onClick={adicionarCor}>Adicionar cor</button>
        )}
        <p className="ds" style={{ marginTop: 6 }}>As duas primeiras formam o gradiente do card; todas aparecem como swatches.</p>

        <label className="rot" style={{ marginTop: 14 }}>Foto de fundo do card (opcional)</label>
        <input className="campo" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="Link de uma imagem" />
        <p className="ds" style={{ marginTop: 6 }}>Se preenchida, substitui o gradiente no card da grelha de Marcas.</p>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {marca && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={pedirDesativar}>
            Desativar marca
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
